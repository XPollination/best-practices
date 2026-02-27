# PDSA: Systemic Gardening Enforcement — Toolchain over Agent Instructions

**Task:** gardener-v003-layer3-skipped
**Date:** 2026-02-27
**Status:** Design (rework v3 — more specific)

## Systemic Principle

Agent instructions (skill steps) may be skipped under task flow momentum. Toolchain automation (CLI/scripts) always runs. Mandatory gardening belongs in toolchain.

## Change 1: Layer 3 — `microGarden()` in interface-cli.js

**File:** `xpollination-mcp-server/src/db/interface-cli.js` (19.5KB, latest commit 41a3712)
**Repo:** xpollination-mcp-server
**Cross-repo note:** CLI calls brain API directly (HTTP POST), not gardener skill. The CLI already does this for transition markers (line 277-301).

### Insertion point

After the existing brain marker (line 491) and notification hook (line 505), BEFORE `output(result)` on line 507:

```javascript
  // Line 505: } (end of approval notification block)

  // NEW: Auto micro-garden on complete transition
  if (newStatus === 'complete') {
    const gardenResult = await microGarden(node.slug, project, updatedDna);
    if (gardenResult) result.gardening = gardenResult;
  }

  output(result);  // Line 507 (existing)
  db.close();      // Line 508 (existing)
```

### New function: `microGarden(slug, project, dna)`

Place after `contributeToBrain()` (line 302), before `cmdTransition()` (line 304):

```javascript
async function microGarden(slug, project, dna, timeoutMs = 5000) {
  // Step 1: Build consolidation summary from DNA (no brain query needed)
  const title = dna.title || slug;
  const findings = dna.findings
    ? (typeof dna.findings === 'string' ? dna.findings : JSON.stringify(dna.findings)).substring(0, 200)
    : 'N/A';
  const impl = dna.implementation?.summary || dna.implementation?.commit || 'N/A';
  const pdsaVerdict = dna.pdsa_review?.verdict || 'N/A';
  const qaVerdict = dna.qa_review?.verdict || 'N/A';

  const summary = `TASK SUMMARY: ${title} (${project}). ` +
    `Findings: ${findings}. ` +
    `Implementation: ${impl}. ` +
    `Reviews: PDSA=${pdsaVerdict}, QA=${qaVerdict}.`;

  // Step 2: Contribute consolidation thought via brain API
  return new Promise((resolve) => {
    const data = JSON.stringify({
      prompt: summary,
      agent_id: 'system',
      agent_name: 'GARDENER',
      context: `auto-garden on complete: ${slug}`,
      thought_category: 'task_summary',
      topic: slug
    });
    const req = http.request('http://localhost:3200/api/v1/memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      timeout: timeoutMs
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        resolve({ status: 'ok', summary_contributed: true });
      });
    });
    req.on('error', () => resolve({ status: 'skipped', reason: 'brain error' }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 'skipped', reason: 'timeout' }); });
    req.write(data);
    req.end();
  });
}
```

### What it does, step by step

1. Extracts DNA fields: `title`, `findings`, `implementation.summary`, `pdsa_review.verdict`, `qa_review.verdict`
2. Builds a one-line consolidation summary (no brain query needed — DNA has all info)
3. POSTs to `http://localhost:3200/api/v1/memory` with `agent_name: "GARDENER"`, `thought_category: "task_summary"`, `topic: <slug>`
4. Returns `{ status: "ok", summary_contributed: true }` or `{ status: "skipped", reason: "..." }`
5. Failure does NOT block the transition (result already committed to DB on line 456-467)

### Output format

```json
{
  "success": true,
  "slug": "my-task",
  "transition": "review->complete",
  "actor": "liaison",
  "gardening": { "status": "ok", "summary_contributed": true }
}
```

### Why no brain query step?

The DNA already contains everything needed for the summary. Querying brain for task-related thoughts would add latency and complexity with no value — the CLI has the DNA in memory. The consolidation thought summarizes DNA, not brain state.

## Change 2: Layer 1 — Brain health in PM status script

**File:** `xpollination-mcp-server/viz/pm-status.cjs` (NEW file)
**Repo:** xpollination-mcp-server (alongside existing `agent-monitor.cjs`)
**Invocation:** `node viz/pm-status.cjs` (replaces 4 separate CLI commands in PM status skill)

### What the script does

```javascript
#!/usr/bin/env node
// pm-status.cjs — single-command PM status with integrated brain health

const http = require('http');
const { execSync } = require('child_process');

const CLI = '/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/src/db/interface-cli.js';
const DBS = {
  'best-practices': '/home/developer/workspaces/github/PichlerThomas/best-practices/data/xpollination.db',
  'xpollination-mcp-server': '/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/data/xpollination.db',
  'HomePage': '/home/developer/workspaces/github/PichlerThomas/HomePage/data/xpollination.db'
};

async function main() {
  const result = { timestamp: new Date().toISOString(), projects: {}, brain_health: null };

  // 1. Scan all project DBs
  for (const [name, dbPath] of Object.entries(DBS)) {
    try {
      const out = execSync(`DATABASE_PATH="${dbPath}" node ${CLI} list`, { encoding: 'utf8' });
      result.projects[name] = JSON.parse(out);
    } catch { result.projects[name] = { error: 'scan failed' }; }
  }

  // 2. Brain health diagnostic (ALWAYS runs — not optional)
  try {
    const health = await brainHealthCheck();
    result.brain_health = health;
  } catch { result.brain_health = { status: 'unavailable' }; }

  console.log(JSON.stringify(result, null, 2));
}

async function brainHealthCheck() {
  // Query brain for recent activity (read_only to avoid pollution)
  const data = JSON.stringify({
    prompt: 'Recent brain activity: new thoughts, noise, active domains',
    agent_id: 'system',
    agent_name: 'PM-STATUS',
    read_only: true,
    full_content: true
  });
  // POST to brain API, parse response for health metrics
  // Count sources, check for duplicates, flag noise
  // Return { status, recent_thoughts, noise_flagged, active_domains, duplicates }
}
```

### PM status SKILL.md update

Current skill Steps 1 + 1.5 (4 commands, Layer 1 optional) become:

```
Step 1: Run pm-status.cjs
  node /home/developer/.../xpollination-mcp-server/viz/pm-status.cjs

This outputs JSON with all project tasks AND brain health. Parse and present.
```

The agent runs ONE command. Brain health is baked into the output. Cannot be skipped.

### How LIAISON invokes it

The PM status skill (SKILL.md) tells the agent to run `node viz/pm-status.cjs` instead of running 3 separate `node $CLI list` commands + `/xpo.claude.mindspace.garden recent shallow`. The agent gets structured JSON back and presents it to Thomas. Same UX, fewer commands, brain health guaranteed.

## Backward Compatibility

- **Layer 3:** New `gardening` field in CLI transition output. Additive only. Old CLIs without `microGarden()` still work — no gardening, no field.
- **Layer 1:** New `pm-status.cjs` script. Old PM status skill still works (just without guaranteed brain health). Skill update optional.
- **Skills:** Step 7d in monitor skill and Step 1.5 in PM status skill can be kept for documentation/manual runs, marked as "automated by toolchain."

## Estimate

- **Layer 3:** ~40 lines added to interface-cli.js (one function + one if-block)
- **Layer 1:** ~80 lines new pm-status.cjs script + ~10 lines skill update
- **Total:** ~130 lines across 3 files

## Files Modified

1. `xpollination-mcp-server/src/db/interface-cli.js` — add `microGarden()` function + call on complete
2. `xpollination-mcp-server/viz/pm-status.cjs` — new file, PM status with brain health
3. `best-practices/.claude/skills/xpo.claude.mindspace.pm.status/SKILL.md` — update Steps 1/1.5 to use pm-status.cjs

## Study / Act

To be filled after dev implements and QA tests.
