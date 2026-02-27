#!/usr/bin/env node
/**
 * Brain cleanup: Delete test contributor thoughts from Qdrant
 *
 * Removes thoughts from test contributors that pollute highway results.
 * Uses Qdrant scroll + delete APIs directly.
 *
 * Usage:
 *   node scripts/brain-cleanup-test-data.js [--dry-run]
 *
 * Test contributors cleaned:
 *   - QA Spaces Test
 *   - QA Refine Test
 *   - QA Special Chars
 *   - HighwayTest
 *   - Any contributor with "Test" in the name
 */

const QDRANT_URL = "http://localhost:6333";
const COLLECTION = "thought_space";
const DRY_RUN = process.argv.includes("--dry-run");

const TEST_PATTERN = /test/i;

async function qdrant(path, method = "GET", body = null) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${QDRANT_URL}${path}`, opts);
  return res.json();
}

async function main() {
  console.log(`=== Brain Test Data Cleanup ${DRY_RUN ? "(DRY RUN)" : ""} ===`);
  console.log(`Pattern: contributor_name matching /${TEST_PATTERN.source}/${TEST_PATTERN.flags}`);

  // Scroll through all thoughts and find test contributors
  const toDelete = [];
  const contributorCounts = {};
  let offset = null;
  let totalScanned = 0;

  while (true) {
    const body = {
      limit: 100,
      with_payload: true,
      with_vector: false,
    };
    if (offset !== null) body.offset = offset;

    const result = await qdrant(`/collections/${COLLECTION}/points/scroll`, "POST", body);

    if (!result.result || !result.result.points) {
      console.error("Scroll failed:", JSON.stringify(result));
      break;
    }

    for (const point of result.result.points) {
      totalScanned++;
      const name = point.payload?.contributor_name || "";

      if (TEST_PATTERN.test(name)) {
        toDelete.push(point.id);
        contributorCounts[name] = (contributorCounts[name] || 0) + 1;
      }
    }

    if (!result.result.next_page_offset) break;
    offset = result.result.next_page_offset;
  }

  console.log(`\nScanned: ${totalScanned} thoughts`);
  console.log(`Found: ${toDelete.length} test thoughts to delete`);

  if (Object.keys(contributorCounts).length > 0) {
    console.log("\nBy contributor:");
    for (const [name, count] of Object.entries(contributorCounts).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${name}: ${count}`);
    }
  }

  if (toDelete.length === 0) {
    console.log("\nNo test thoughts found. Brain is clean.");
    return;
  }

  if (DRY_RUN) {
    console.log(`\n[DRY RUN] Would delete ${toDelete.length} thoughts. Run without --dry-run to execute.`);
    return;
  }

  // Delete in batches of 100
  let deleted = 0;
  for (let i = 0; i < toDelete.length; i += 100) {
    const batch = toDelete.slice(i, i + 100);
    const result = await qdrant(`/collections/${COLLECTION}/points/delete`, "POST", {
      points: batch,
    });

    if (result.status === "ok" || result.result === true) {
      deleted += batch.length;
      console.log(`Deleted batch ${Math.floor(i / 100) + 1}: ${batch.length} thoughts`);
    } else {
      console.error(`Batch ${Math.floor(i / 100) + 1} failed:`, JSON.stringify(result));
    }
  }

  console.log(`\n=== Cleanup complete: ${deleted}/${toDelete.length} thoughts deleted ===`);
}

main().catch((err) => {
  console.error("Cleanup failed:", err);
  process.exit(1);
});
