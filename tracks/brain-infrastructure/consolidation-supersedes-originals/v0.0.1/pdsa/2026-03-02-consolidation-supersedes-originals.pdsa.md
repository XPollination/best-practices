# PDSA: Gardener Consolidation Should Supersede Original Duplicate Thoughts

**Date:** 2026-03-02
**Task:** consolidation-supersedes-originals
**Status:** PLAN

## Plan

### Problem
When the gardener consolidates N duplicate thoughts into one consolidated thought, the originals persist in Qdrant and compete in vector search. Example: 4 QA Format role-separation duplicates still exist alongside the CONSOLIDATED thought. Both appear in results.

**Current state:** Consolidation is read-side only. During retrieval, `getRefiningThoughts()` discovers consolidation relationships and applies a 0.7 penalty to originals. But this requires an extra Qdrant query on every retrieval and doesn't mark the originals in any persistent way.

**Desired state:** After consolidation, originals are marked write-side with a `superseded_by_consolidation: true` flag. This is persistent, efficient, and follows the same pattern as `superseded_by_correction`.

### Design

#### Change 1: Mark originals after consolidation in `think()`
**File:** `api/src/services/thoughtspace.ts`

After the consolidation thought is created (after line 277, the `return` from `think()`), add a block similar to the correction superseding at lines 262-275:

```typescript
// Consolidation: mark source thoughts as superseded
if (params.thought_type === "consolidation" && params.source_ids.length > 0) {
  for (const sourceId of params.source_ids) {
    try {
      await client.setPayload(COLLECTION, {
        points: [sourceId],
        payload: { superseded_by_consolidation: true },
        wait: true,
      });
    } catch (err) {
      console.error(`Failed to mark thought ${sourceId} as superseded by consolidation:`, err);
    }
  }
}
```

**Placement:** After the Qdrant upsert for the consolidated thought (line ~257) but before the return (line ~277). Follows the exact pattern of the correction superseding block at lines 262-275.

#### Change 2: Scoring check for `superseded_by_consolidation`
**File:** `api/src/services/thoughtspace.ts` (scoring section, around line 420)

Add after the `superseded_by_correction` check:

```typescript
if (thoughtPayload.superseded_by_consolidation === true) {
  m.score *= SCORING_CONFIG.supersededByConsolidation;
  m.superseded = true;
}
```

**Note:** This is in addition to the existing read-side detection via `getRefiningThoughts()`. Both paths now lead to the same result, but the write-side flag is checked first (cheaper — no extra Qdrant query needed for these thoughts).

#### Change 3: Add scoring config entry
**File:** `api/src/scoring-config.ts`

```typescript
export const SCORING_CONFIG = {
  supersededByRefinement: 0.7,
  supersededByCorrection: 0.5,
  supersededByConsolidation: 0.7,  // NEW — same as refinement, not as harsh as correction
  keywordEchoFlag: 0.8,
  keywordEchoTopic: 0.3,
  correctionCategory: 1.3,
  refinementOfSuperseded: 1.2,
};
```

**Why 0.7 (same as refinement)?** Consolidation merges duplicates — the originals aren't wrong, just redundant. Corrections fix errors (0.5 = harsher). Consolidation just deduplicates (0.7 = moderate penalty, originals still findable if needed).

#### Change 4: Include `superseded_by_consolidation` in retrieval response
**File:** `api/src/routes/memory.ts` (sources mapping, around line 510)

```typescript
superseded_by_correction: thought.superseded_by_correction ?? false,
superseded_by_consolidation: thought.superseded_by_consolidation ?? false,
```

#### Change 5: Gardener dry-run shows supersession plan
**File:** `api/src/services/thoughtspace.ts` or gardener skill

When the gardener runs in dry-run/shallow mode, the output already shows "Would consolidate: [ids]". The skill instructions in SKILL.md should document that consolidation implies superseding originals. No code change needed — the gardener already shows source_ids in its plan output.

### Files Modified
| File | Change |
|------|--------|
| `api/src/services/thoughtspace.ts` | Add `superseded_by_consolidation` write-side marking in `think()` + scoring check |
| `api/src/scoring-config.ts` | Add `supersededByConsolidation: 0.7` |
| `api/src/routes/memory.ts` | Include `superseded_by_consolidation` in retrieval response |

### NOT Changed
- Gardener skill (SKILL.md) — consolidation plan already shows source_ids
- `getRefiningThoughts()` — read-side detection remains as fallback
- PATCH metadata endpoint — supersession is automatic, not manual
- Correction mechanism — separate concern

### Edge Cases

**Double penalty prevention:** A thought could be marked both by write-side (`superseded_by_consolidation: true`) and read-side (`getRefiningThoughts()`). The read-side sets `m.superseded = true` and applies 0.7. The write-side also sets `m.superseded = true` and applies 0.7. Since `m.superseded` is set to `true` by the first path, the `supersededByRefinement` check at line 411 would also apply. Total: 0.7 × 0.7 = 0.49. This is acceptable — double-confirmed supersession should be penalized more.

**Consolidation of already-superseded thoughts:** If an original was already superseded by correction (0.5), consolidation adds 0.7 → total 0.35. The original is very demoted. Fine — it's both wrong and redundant.

**Rollback:** If a consolidation was wrong, manually PATCH the source thoughts to set `superseded_by_consolidation: false`. This requires extending the PATCH metadata endpoint (from `correction-lifecycle-activation` task) to also accept `superseded_by_consolidation`. Add this field alongside `superseded_by_correction`.

### Risks
- **Consolidation errors are harder to undo** — if the gardener consolidates wrong thoughts, the originals are penalized. Mitigation: gardener always operates in shallow/dry-run first, micro/deep requires explicit invocation.
- **Ordering dependency:** The write-side marking happens after the upsert. If the process crashes between upsert and marking, the consolidated thought exists but originals aren't marked. Mitigation: read-side detection still works as fallback.

## Do
(To be completed by DEV agent — all changes in best-practices repo)

## Study
- After consolidation, original thoughts have `superseded_by_consolidation: true` in Qdrant payload
- Retrieval scoring applies 0.7 penalty to consolidation-superseded originals
- Consolidated thought ranks above its originals in query results
- `superseded_by_consolidation` appears in API response sources
- Dry-run shows which originals will be superseded

## Act
- Monitor consolidation quality — are the right thoughts being superseded?
- Consider: batch retroactive supersession for existing consolidations (source_ids already tracked)
- Consider: gardener undo command that removes supersession flags from source_ids
