# Spec Delta: Thought Lineage & Explicit Iteration

**Base spec:** `versions/v0.0.1/spec/thought-tracing-system.md` (v0.2.0)
**Target version:** v0.2.1
**PDSA ref:** `versions/v0.0.2/pdsa/2026-02-25-memory-thought-lineage.pdsa.md`

---

## Section 3.3 — Request: Add fields

Add to the `/api/v1/memory` request body:

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `refines` | string | No | Valid UUID, must exist in `thought_space` | Thought ID to refine. Mutually exclusive with `consolidates`. |
| `consolidates` | string[] | No | Array of valid UUIDs (min 2), all must exist in `thought_space` | Thought IDs to consolidate. Mutually exclusive with `refines`. |

**Validation rules:**
- If both `refines` and `consolidates` are provided: return 400 `MUTUAL_EXCLUSION`
- If `consolidates` has fewer than 2 entries: return 400 `MIN_CONSOLIDATION`
- If `refines` references a non-existent thought: return 404 `THOUGHT_NOT_FOUND`
- If any `consolidates` entry references a non-existent thought: return 404 `THOUGHT_NOT_FOUND`

---

## Section 3.1 — Error Response Schema: Add codes

| HTTP Status | Code | When |
|-------------|------|------|
| 400 | `MUTUAL_EXCLUSION` | Both `refines` and `consolidates` provided in same request |
| 400 | `MIN_CONSOLIDATION` | `consolidates` array contains fewer than 2 thought IDs |

---

## Section 3.5 — Contribution Threshold: Add bypass

**Add after existing threshold rules:**

When `refines` or `consolidates` is provided, the contribution threshold is **bypassed**. These are explicit iteration actions, not organic contributions. The prompt is always stored as a thought regardless of length or interrogative form.

---

## Section 3.7 — Response: Add fields to sources

Add to each entry in `result.sources[]`:

| Field | Type | Description |
|-------|------|-------------|
| `refined_by` | string \| null | ID of the newest thought that refines this one. Null if not refined. |
| `superseded` | boolean | `true` if this thought has been refined or consolidated by another thought. Default `false`. |

**Example source entry with lineage:**
```json
{
  "thought_id": "uuid-A",
  "contributor": "PDSA Agent",
  "score": 0.61,
  "content_preview": "Status+role monitoring is needed for...",
  "refined_by": "uuid-B",
  "superseded": true
}
```

---

## Section 4.1 — think(): Add pheromone inheritance

**Add after "Return `{ thought_id, pheromone_weight: 1.0 }`":**

When `thought_type` is `"refinement"`:
1. Lookup source thought (first entry in `source_ids`) from Qdrant
2. Read its `pheromone_weight`
3. Set initial weight: `max(1.0, source.pheromone_weight * 0.5)`
4. Return `{ thought_id, pheromone_weight: <inherited_weight> }`

When `thought_type` is `"consolidation"`:
1. Lookup all source thoughts from Qdrant
2. Calculate average `pheromone_weight` across sources
3. Set initial weight: `max(1.0, avg(source_weights) * 0.5)`
4. Return `{ thought_id, pheromone_weight: <inherited_weight> }`

When `thought_type` is `"original"`: unchanged (weight = 1.0).

---

## Section 4.2 — retrieve(): Add lineage awareness

**Add after step 5 (return results):**

6. Batch lookup: for all result thought IDs, query Qdrant for thoughts where `source_ids` contains any result ID AND `thought_type` is `"refinement"` or `"consolidation"`
7. For each result that has a refining thought:
   - Set `refined_by` to the newest refiner's ID (by `created_at`)
   - Set `superseded` to `true`
8. Apply score adjustment:
   - Superseded thoughts: `score *= 0.7`
   - Thoughts that are refinements of a superseded thought in the same result set: `score *= 1.2` (capped so final score <= 1.0)
9. Re-sort results by adjusted score

---

## New: Section 4.4 — getLineage(): Lineage query

**Internal function.** Not exposed as an HTTP endpoint.

```
getLineage(thoughtId: string, maxDepth: number = 10): LineageResult
```

**Behavior:**
1. Retrieve the target thought
2. Traverse UP (sources): follow `source_ids` recursively until originals or depth cap
3. Traverse DOWN (refinements): find thoughts with this ID in their `source_ids`, recurse
4. Stop at `maxDepth` in either direction
5. If chain exceeds depth cap, set `truncated: true`

**Return type:**
```typescript
interface LineageResult {
  thought_id: string;
  chain: LineageNode[];
  truncated: boolean;
}

interface LineageNode {
  thought_id: string;
  thought_type: "original" | "refinement" | "consolidation";
  content_preview: string; // first 80 chars
  contributor: string;
  created_at: string;
  source_ids: string[];
  depth: number; // 0 = queried thought, negative = ancestors, positive = descendants
}
```

**Integration with `/memory`:** When a contributed or retrieved thought has lineage, include a `lineage_summary` field in `trace`:
```json
"trace": {
  ...existing fields...,
  "lineage_summary": {
    "has_lineage": true,
    "chain_length": 3,
    "deepest_ancestor": "uuid-original",
    "latest_refinement": "uuid-latest"
  }
}
```

---

## Section 3.11 — Orchestration Flow: Updated steps

Replace step 3 with:

```
3. Check contribution:
   a. If refines or consolidates provided:
      - Validate referenced thought(s) exist → 404 if not
      - Validate mutual exclusion → 400 if both
      - Lookup source pheromone weights for inheritance
      - Call think() with appropriate thought_type, source_ids, inherited weight
      - Skip contribution threshold check
   b. Else: check contribution threshold (Section 3.5)
      - If met: call think() with thought_type "original"
      - Check for similar existing thought (score > 0.85):
        If found, set result.guidance with refinement suggestion
```

---

## Data Model: No schema changes

The `thought_space` Qdrant collection payload already includes `thought_type`, `source_ids`, and all necessary fields. No new indexes needed — `thought_type` is already indexed as keyword.

The `query_log` SQLite table needs no changes.

---

## Brain Skill: New commands

Add to the brain skill (`~/.claude/skills/brain/SKILL.md`):

### `/brain refine <thought_id> "updated insight"`
Calls POST `/api/v1/memory` with:
```json
{
  "prompt": "updated insight",
  "agent_id": "<agent_id>",
  "agent_name": "<agent_name>",
  "refines": "<thought_id>"
}
```

### `/brain consolidate "<id1>,<id2>,..." "merged insight"`
Calls POST `/api/v1/memory` with:
```json
{
  "prompt": "merged insight",
  "agent_id": "<agent_id>",
  "agent_name": "<agent_name>",
  "consolidates": ["<id1>", "<id2>", ...]
}
```

### `/brain history <thought_id>`
Calls `getLineage(thought_id)` internally and displays the chain in human-readable format.
