# PDSA: Memory System — Thought Lineage & Explicit Iteration

**Date:** 2026-02-25
**Version:** best-practices v0.0.2
**Status:** PLAN (refined — ready for approval)
**Spec base:** `versions/v0.0.1/spec/thought-tracing-system.md` (v0.2.0)
**Refinement by:** PDSA agent

---

## PLAN

### Problem (from LIAISON reflection, 2026-02-25)

The memory system works for basic retrieval but cannot explicitly iterate knowledge:

1. `/memory` endpoint hardcodes `thought_type: "original"` — every contribution is standalone
2. Contradictory knowledge coexists with no resolution mechanism (old "status+role monitoring" and corrected "role-only monitoring" both returned in same query)
3. No lineage visible — agents can't see that thought B refines thought A
4. No way for agents to mark a thought as superseded
5. The internal `think()` function already supports `refinement` and `consolidation` with `source_ids` — the plumbing exists but isn't exposed

### Why Now

- Recovery across sessions relies on memory. Contradictory thoughts confuse recovering agents.
- Thomas's principle: "If the system does not PREVENT it, it WILL happen." Without explicit iteration, agents keep appending contradictory knowledge.
- The plumbing already exists — this is about exposing it through the `/memory` endpoint and making lineage visible in retrieval.

### Vision

Agent contributes thought A. Later, A is proven wrong. Another agent contributes a refinement referencing A. The system knows B supersedes A. Retrieval marks A as refined and boosts B. Lineage chains are visible and traceable.

---

### Open Questions — Resolved

#### Q1: Suppression vs marking of refined thoughts in retrieval

**Decision: Mark with `superseded: true` + boost refinement score.**

Both original and refinement are returned. The original gets `refined_by: <thought_id>` and `superseded: true`. The refinement ranks higher via score boost.

**Rationale:** Suppression hides potentially relevant context. Boost-only is too subtle — agents might not notice the refinement exists. Marking is additive (non-breaking), preserves all information, and lets the agent decide. Matches "retrieval IS contribution" philosophy — nothing disappears.

#### Q2: Consolidation trigger

**Decision: Manual only (agent-triggered).**

Agents use `/brain consolidate "<thought_ids>" "merged insight"` to explicitly merge multiple thoughts. No background auto-consolidation.

**Rationale:** Automatic consolidation needs an LLM to decide what to merge — complex, expensive, error-prone. Manual consolidation gives agents control and aligns with Thomas's principle that deliberate action is better than automatic noise reduction. The `think()` function already supports `thought_type: "consolidation"` with `source_ids` — we just expose it.

#### Q3: Lineage depth cap

**Decision: Cap at 10 levels.**

When querying lineage, traversal stops at depth 10. Response indicates `"truncated": true` if chain is deeper.

**Rationale:** In practice, chains will rarely exceed 2-3 levels. Cap of 10 is generous. If a chain reaches 10+ levels, consolidation should be used instead. Prevents unbounded recursion in pathological cases.

#### Q4: Backward compatibility of response schema changes

**Decision: Additive change (non-breaking).**

New fields added to `result.sources[]`: `refined_by` (nullable string), `superseded` (boolean, default false). No existing fields removed or renamed. Agents consuming the API check fields they know and ignore unknowns.

**Rationale:** This follows standard API evolution practices. Existing agents work unchanged. New agents can leverage lineage information.

#### Q5: Brain skill UX for proactive refinement suggestions

**Decision: Suggest, don't block.**

When contributing via `/brain contribute`, if a thought with similarity > 0.85 exists, add a `guidance` note: `"Similar thought exists (id: X, preview: '...'). Consider /brain refine X \"updated insight\" instead."` The contribution is stored as original regardless — the agent decides.

**Rationale:** Discovery is helpful. Blocking would create friction and confusion. The guidance appears in the response for the agent to act on or ignore. Over time, agents learn to refine instead of re-contribute.

#### Q6: Pheromone inheritance on refinement

**Decision: Inherit 50% of source pheromone weight, minimum 1.0.**

- Refinement: `new_weight = max(1.0, source.pheromone_weight * 0.5)`
- Consolidation: `new_weight = max(1.0, avg(source_weights) * 0.5)`

**Rationale:** Full inheritance gives unearned prominence. No inheritance means refinements start invisible, defeating their purpose. 50% is a balanced starting point — the refinement benefits from established credibility but must prove its own value through usage.

---

### Detailed Design

#### 1. Expose thought iteration in `/memory` endpoint

**File: `api/src/routes/memory.ts`**

Add optional `refines` field to `MemoryRequest`:

```typescript
interface MemoryRequest {
  prompt: string;
  agent_id: string;
  agent_name: string;
  context?: string;
  session_id?: string;
  refines?: string;        // NEW: thought_id to refine
  consolidates?: string[]; // NEW: thought_ids to consolidate
}
```

When `refines` is provided:
- Validate the referenced thought exists in Qdrant
- Call `think()` with `thought_type: "refinement"`, `source_ids: [refines]`
- Apply pheromone inheritance: `max(1.0, source.pheromone_weight * 0.5)`

When `consolidates` is provided:
- Validate all referenced thoughts exist
- Call `think()` with `thought_type: "consolidation"`, `source_ids: consolidates`
- Apply pheromone inheritance: `max(1.0, avg(source_weights) * 0.5)`

When neither is provided: current behavior (`thought_type: "original"`, `source_ids: []`).

#### 2. Mark superseded thoughts in retrieval results

**File: `api/src/services/thoughtspace.ts`**

After `retrieve()` returns results, for each result:
1. Query Qdrant for any thought where `source_ids` contains this thought's ID and `thought_type` is `"refinement"` or `"consolidation"`
2. If found, add `refined_by: <newest_refiner_id>` and `superseded: true` to the result

**Implementation:** Add a batch lookup function `getRefiningThoughts(thoughtIds: string[])` that does a single Qdrant scroll with filter on `source_ids` field. This avoids N+1 queries.

**File: `api/src/services/thoughtspace.ts` — `RetrieveResult` type**

```typescript
export interface RetrieveResult {
  thought_id: string;
  content: string;
  contributor_name: string;
  score: number;
  pheromone_weight: number;
  tags: string[];
  refined_by?: string;    // NEW
  superseded?: boolean;    // NEW
}
```

#### 3. Retrieval prefers latest iteration (score boost)

**File: `api/src/services/thoughtspace.ts` — `retrieve()`**

After marking superseded thoughts, apply score adjustment:
- Superseded thoughts: `score *= 0.7` (30% penalty)
- Thoughts that ARE refinements of a superseded thought in the result set: `score *= 1.2` (20% boost, capped at 1.0)

Re-sort results by adjusted score before returning.

#### 4. Lineage query

**File: `api/src/services/thoughtspace.ts`**

New function:
```typescript
export async function getLineage(thoughtId: string, maxDepth: number = 10): Promise<LineageResult>
```

Traverses both directions:
- **Up (sources):** Follow `source_ids` recursively until originals found or depth cap hit
- **Down (refinements):** Find thoughts whose `source_ids` contain this ID, recurse

Returns:
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
  depth: number; // 0 = the queried thought
}
```

**Exposure:** Include lineage summary in `/memory` trace when the contributed or retrieved thought has lineage. Not a separate HTTP endpoint — stays internal, accessible through trace.

#### 5. Brain skill update

**File: `~/.claude/skills/brain/SKILL.md`**

Add three new commands:
- `/brain refine <thought_id> "updated insight"` — contributes a refinement via `/memory` with `refines: thought_id`
- `/brain consolidate "<id1>,<id2>,..." "merged insight"` — consolidates via `/memory` with `consolidates: [ids]`
- `/brain history <thought_id>` — queries lineage and displays chain

Update `/brain contribute` result: when the response includes `guidance` about similar thoughts (Q5), display it to the agent.

#### 6. Refinement suggestion on contribute (Q5)

**File: `api/src/routes/memory.ts`**

After contribution threshold is met and before calling `think()`, check if a very similar thought exists:
1. Embed the prompt
2. Search with high similarity threshold (score > 0.85)
3. If found, set `result.guidance` to suggest refinement
4. Still store as original — don't block

---

### File Changes Summary

| File | Change | Type |
|------|--------|------|
| `api/src/routes/memory.ts` | Add `refines`/`consolidates` fields, validation, pheromone inheritance, refinement suggestion | Modify |
| `api/src/services/thoughtspace.ts` | Add `getRefiningThoughts()`, `getLineage()`, score adjustment in `retrieve()`, pheromone inheritance in `think()`, update `RetrieveResult` type | Modify |
| `~/.claude/skills/brain/SKILL.md` | Add `/brain refine`, `/brain consolidate`, `/brain history` commands | Modify |

No new files needed. All changes are modifications to existing files.

---

### Acceptance Criteria (testable by QA)

**AC1: Refinement via `/memory`**
- POST `/api/v1/memory` with `{ prompt: "updated insight", agent_id: "test", agent_name: "Test", refines: "<existing_thought_id>" }`
- Response `trace.operations` includes `"contribute"`
- New thought in Qdrant has `thought_type: "refinement"` and `source_ids: ["<existing_thought_id>"]`
- New thought's `pheromone_weight` = `max(1.0, source.pheromone_weight * 0.5)`

**AC2: Consolidation via `/memory`**
- POST `/api/v1/memory` with `{ prompt: "merged insight", agent_id: "test", agent_name: "Test", consolidates: ["<id1>", "<id2>"] }`
- New thought has `thought_type: "consolidation"` and `source_ids: ["<id1>", "<id2>"]`
- Pheromone weight = `max(1.0, avg(source_weights) * 0.5)`

**AC3: Superseded marking in retrieval**
- Create thought A, then refine it with thought B
- Query that matches both A and B
- A's result includes `refined_by: B.id` and `superseded: true`
- B's result has `superseded: false` (or field absent)

**AC4: Score adjustment**
- Same setup as AC3
- B's adjusted score > A's adjusted score (A gets 0.7x penalty, B gets 1.2x boost)
- Results sorted by adjusted score

**AC5: Lineage query**
- Create chain: A → B (refines A) → C (refines B)
- `getLineage(B.id)` returns chain with A (depth -1), B (depth 0), C (depth +1)
- `getLineage(A.id)` returns chain with A (depth 0), B (depth +1), C (depth +2)

**AC6: Lineage depth cap**
- Create chain of 12 refinements
- `getLineage(first.id)` returns 10 nodes + `truncated: true`

**AC7: Refinement suggestion**
- Contribute thought with content X
- Contribute another thought with content nearly identical to X (similarity > 0.85)
- Response `result.guidance` contains suggestion to use `/brain refine`
- Second thought is stored as original (not blocked)

**AC8: Backward compatibility**
- POST `/api/v1/memory` without `refines` or `consolidates` fields
- Behavior identical to current: `thought_type: "original"`, `source_ids: []`
- Response schema includes new nullable fields but no existing field changed

**AC9: Validation**
- `refines` with non-existent thought_id returns 404 `THOUGHT_NOT_FOUND`
- `consolidates` with any non-existent thought_id returns 404 `THOUGHT_NOT_FOUND`
- Both `refines` and `consolidates` in same request returns 400 `VALIDATION_ERROR`

**AC10: Brain skill commands**
- `/brain refine <id> "text"` calls `/memory` with `refines` field and returns success
- `/brain consolidate "<ids>" "text"` calls `/memory` with `consolidates` field and returns success
- `/brain history <id>` displays lineage chain

---

## DO

*Implementation order (suggested for DEV agent):*

1. **thoughtspace.ts changes first** — add `getRefiningThoughts()`, update `RetrieveResult` type, add lineage query, update `think()` for pheromone inheritance
2. **memory.ts changes** — add request fields, validation, wire through to `think()` with correct types, add refinement suggestion logic, add lineage to trace
3. **Brain skill** — update SKILL.md with new commands

---

## STUDY

*To be filled after implementation*

---

## ACT

*To be filled after study*

---

## Spec Delta

### Changes to `versions/v0.0.1/spec/thought-tracing-system.md`

The following sections need updates for v0.0.2:

#### Section 3.3 Request — Add fields

```
| refines      | string   | No  | Valid UUID | Thought ID to refine. Mutually exclusive with consolidates. |
| consolidates | string[] | No  | Array of valid UUIDs, min 2 | Thought IDs to consolidate. Mutually exclusive with refines. |
```

#### Section 3.5 Contribution Threshold — Add refinement bypass

When `refines` or `consolidates` is provided, the contribution threshold is BYPASSED — these are explicit iteration actions, not organic contributions. The thought is always stored.

#### Section 3.7 Response — Add fields to sources

```
sources[].refined_by  — string | null — ID of the thought that refines this one (newest if multiple)
sources[].superseded  — boolean — true if this thought has been refined or consolidated
```

#### Section 4.1 think() — Add pheromone inheritance

When `thought_type` is `"refinement"`:
- Lookup source thought's `pheromone_weight`
- Set initial weight: `max(1.0, source.pheromone_weight * 0.5)`

When `thought_type` is `"consolidation"`:
- Lookup all source thoughts' `pheromone_weight`
- Set initial weight: `max(1.0, avg(source_weights) * 0.5)`

#### Section 4.2 retrieve() — Add lineage awareness

After retrieving results:
1. Batch lookup refinements for all result thought IDs
2. Mark superseded results with `refined_by` and `superseded: true`
3. Apply score adjustment: superseded thoughts get `score *= 0.7`, active refinements get `score *= 1.2` (capped at 1.0)
4. Re-sort by adjusted score

#### New: Section 4.4 getLineage() — Lineage query

Internal function that traverses thought chains bidirectionally. Max depth: 10. Returns `LineageResult` with chain nodes and truncation flag. Called during `/memory` response when lineage exists.

#### Section 3.1 Error Response Schema — Add errors

```
| 400 | MUTUAL_EXCLUSION  | Both refines and consolidates provided           |
| 400 | MIN_CONSOLIDATION | consolidates must contain at least 2 thought IDs |
```
