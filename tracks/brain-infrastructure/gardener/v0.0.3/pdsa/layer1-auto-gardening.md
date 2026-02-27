# PDSA: Layer 1 Auto-Gardening in pm-status.cjs

**Task:** gardener-v003-layer1-not-automated
**Date:** 2026-02-27
**Author:** PDSA agent

## Plan

### Problem
pm-status.cjs reports brain health (status, thought count, highways) but takes no automated gardening action. Layer 1 gardening relies on agents optionally running it, which gets skipped under task flow momentum. Same root cause as Layer 3 bug (gardener-v003-layer3-skipped).

### Root Cause
v0.0.3 automated Layer 3 (microGarden in interface-cli.js on complete transition) but Layer 1 was only addressed as reporting (pm-status.cjs with read_only:true). Report != act.

### Solution
Extend pm-status.cjs to detect duplicate clusters in brain health results and auto-consolidate them via brain API `consolidates` endpoint.

**Pattern:** Same as Layer 3 microGarden — automated, best-effort, non-blocking.

### Mechanism

**Step 1: Enhanced health analysis (in `brainHealth()`)**
- Add `full_content: true` to the brain query to get full thought bodies
- After receiving sources, group by `content_preview` (exact match)
- Count groups with 3+ identical thoughts = `duplicate_groups`
- Set `needs_gardening: true` when `duplicate_groups > 0`

**Step 2: Auto-consolidation (new `layer1Garden()` function)**
- Triggered when `needs_gardening` is true
- For each duplicate group (max 3 per invocation):
  - Extract all thought IDs from the group
  - POST to brain: `{ prompt: "CONSOLIDATION: N copies of '{preview}' merged", consolidates: [ids], thought_category: "consolidation", agent_id: "system", agent_name: "GARDENER", context: "auto layer1 gardening via pm-status" }`
- Timeout: 5s per POST
- On error: resolve with `{ status: 'skipped', reason: '...' }`

**Step 3: Output (in `main()`)**
- `brain_health` gains: `duplicate_groups` (int), `needs_gardening` (bool)
- New top-level `gardening` field: `{ status, groups_found, consolidated }` or `null`

### API Operations Used
- `POST /api/v1/memory` with `consolidates: [ids]` — creates consolidation thought linking originals (verified in best-practices/api/src/services/thoughtspace.ts)
- `POST /api/v1/memory` with `full_content: true, read_only: true` — enhanced health query

### Files Modified
1. `xpollination-mcp-server/viz/pm-status.cjs` (~40-50 lines added)

### Scope Limits
- Max 3 consolidations per invocation (prevents runaway)
- No category changes, no supersession, no deep analysis (those are Layer 2)
- Incremental: each pm-status call chips away at duplicates

### Output Schema Change
```json
{
  "brain_health": {
    "status": "healthy",
    "recent_thoughts": 5,
    "highways": 3,
    "top_domains": ["..."],
    "duplicate_groups": 2,
    "needs_gardening": true
  },
  "gardening": {
    "status": "ok",
    "groups_found": 2,
    "consolidated": 2
  }
}
```

### Acceptance Criteria Mapping
1. Auto-runs when health indicates issues — `duplicate_groups > 0` triggers `layer1Garden()`
2. Best-effort — all errors resolve with skip status, never reject or throw
3. Skipped when healthy — `needs_gardening: false` = no action taken
4. Backward compatible — brain down = `gardening: null`, projects output unchanged

## Do
Implementation by DEV agent in xpollination-mcp-server/viz/pm-status.cjs.

## Study
(Post-implementation)

## Act
(Post-study)
