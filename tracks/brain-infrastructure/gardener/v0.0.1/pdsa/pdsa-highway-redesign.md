# PDSA: Highway Redesign — Context-Weighted Relevance

**Task:** `gardener-highway-redesign`
**Date:** 2026-02-27
**Phase:** Plan

## Plan

### Problem
Current highways return the same 5 entries on every query regardless of topic. `highways()` scrolls ALL thoughts with high access counts, sorts by `traffic_score = access_count * unique_users`, returns top 5. No context awareness.

### Options Evaluated

**Option A: Filter by topic/category** — Rejected. Topic field is task-slug-level (e.g., "gardener-mcp-full-content"), not semantic domain. Most thoughts have no topic set (T7 retroactive categorization hasn't run). Query-to-topic matching would miss most content.

**Option B: Vector similarity + frequency filter (HYBRID)** — SELECTED. Use the query embedding (already computed at memory.ts:251) to find semantically relevant thoughts among high-access entries. Leverages existing Qdrant capabilities, doesn't require categorization.

**Option C: Gardener-curated paths** — Deferred to T5 (engine skill). Not viable for T3 standalone.

**Option D: Frequency within domain** — Rejected. Same topic-dependency problem as Option A.

### Design: Option B — Hybrid Vector+Frequency Highways

**File:** `best-practices/api/src/services/thoughtspace.ts`

Change `highways()` to accept an optional `query_embedding` parameter:

```typescript
export interface HighwayParams {
  min_access?: number;
  min_users?: number;
  limit?: number;
  query_embedding?: number[];  // NEW: when provided, filter by semantic relevance
}
```

**When `query_embedding` is provided (context-aware mode):**
1. Use Qdrant `search()` (not `scroll()`) with the query embedding
2. Apply filter: `access_count >= min_access`
3. Qdrant returns results sorted by vector similarity to the query
4. Post-filter by `min_users` (unique `accessed_by` count)
5. Compute `traffic_score` as before but rank by similarity first
6. Return top `limit` results

**When `query_embedding` is NOT provided (legacy mode):**
- Current behavior unchanged — global frequency sort

**File:** `best-practices/api/src/routes/memory.ts`

Pass `queryEmbedding` (already available at line 251) to the `highways()` call at line 395:

```typescript
// Before:
const hw = await highways({ min_access: 3, min_users: 2, limit: 5 });

// After:
const hw = await highways({ min_access: 3, min_users: 2, limit: 5, query_embedding: queryEmbedding });
```

### Implementation Detail

In `highways()`, the context-aware path replaces `scroll()` with `search()`:

```typescript
if (params.query_embedding) {
  // Context-aware: Qdrant vector search filtered to high-access thoughts
  const searchResult = await client.search(COLLECTION, {
    vector: params.query_embedding,
    filter: {
      must: [
        { key: "access_count", range: { gte: minAccess } },
      ],
    },
    limit: limit * 3,  // over-fetch to allow post-filtering by min_users
    with_payload: true,
  });

  for (const point of searchResult) {
    const p = point.payload as Record<string, unknown>;
    const accessedBy = (p.accessed_by as string[]) ?? [];
    if (accessedBy.length < minUsers) continue;
    // ... build HighwayResult with similarity score factored in
  }
} else {
  // Legacy: global frequency sort (existing scroll code)
}
```

### Backward Compatibility
- `query_embedding` is optional — callers not passing it get current behavior
- Response format unchanged — `highways_nearby` array with same string format
- No schema changes, no new Qdrant indexes needed

### Acceptance Criteria Verification
1. Query about "cover letter" → highways about positioning/career content (not agent coordination)
2. Query about "brain quality" → highways about knowledge management
3. Without query_embedding → same behavior as before (frequency-based)

### Effort
Small-medium — ~30 lines changed in thoughtspace.ts, 1 line in memory.ts.

## Do
(DEV implements)

## Study
(Post-implementation)

## Act
(Post-study)
