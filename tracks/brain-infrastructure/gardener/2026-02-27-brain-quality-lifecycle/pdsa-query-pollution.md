# PDSA: Query Pollution Prevention

**Task:** `gardener-query-pollution`
**Date:** 2026-02-27
**Phase:** Plan

## Plan

Prevent keyword_echo queries from being persisted to the brain.

### Problem
- Every `query_brain` call persists the query as a new thought (line 192-244 in memory.ts)
- `keyword_echo` is detected (line 42-53) when >60% word overlap with recent queries
- But the thought is still stored even when flagged as `keyword_echo`
- 10 research queries = 10 noise entries degrading signal-to-noise

### Design

**File:** `best-practices/api/src/routes/memory.ts`

**Change:** Add guard at line 192 to skip persistence when `keyword_echo` is detected.

Current code (line 192):
```typescript
if (thresholdMet) {
```

New code:
```typescript
const isKeywordEcho = qualityAssessment.flags.includes("keyword_echo");
if (thresholdMet && !isKeywordEcho) {
```

That's it. One line change + one variable. The quality assessment at line 189 already detects `keyword_echo`. The persistence block (lines 192-245) just needs to skip when the flag is set.

**Behavior after fix:**
- Query that triggers `keyword_echo` → retrieval works normally, but NO new thought persisted
- `trace.thoughts_contributed` will be 0 for echo queries
- Non-echo queries persist normally (no change)
- Explicit iterations (`refines`/`consolidates`) should still persist even if echo-flagged — they are intentional rewrites

**Refined guard (accounting for explicit iteration):**
```typescript
const isKeywordEcho = qualityAssessment.flags.includes("keyword_echo");
if (thresholdMet && (!isKeywordEcho || isExplicitIteration)) {
```

**File:** `best-practices/api/src/routes/memory.ts` (test section or separate test file)

**Test:** Add test verifying:
1. Query with >60% word overlap with recent query → `thoughts_contributed: 0` in trace
2. Non-echo query → `thoughts_contributed: 1` in trace (existing behavior)
3. Explicit refine with echo words → still persists (`thoughts_contributed: 1`)

### Acceptance Criteria
- `query_brain` call triggering `keyword_echo` returns results but creates NO new thought
- Non-echo queries still persist normally
- Existing `keyword_echo` detection logic unchanged
- Explicit iterations (`refines`) bypass the echo guard

### Effort
Small — 2 lines changed in memory.ts.

## Do
(DEV implements)

## Study
(Post-implementation)

## Act
(Post-study)
