# PDSA: Read-Only API for Gardener Discovery Queries

**Task:** gardener-v002-read-only-api
**Date:** 2026-02-27
**Status:** Resolved by sibling task

## Plan

Evaluate options to prevent query pollution from gardener discovery queries. POST /api/v1/memory auto-contributes every query as a new thought. A full deep gardener pass creates 5+ junk thoughts.

## Do (Evaluation)

### Option 1: Add `read_only:true` param to POST /api/v1/memory
- **Trade-offs:** Minimal code change (1 line). Backward compatible. Caller opts in.
- **Verdict:** RECOMMENDED

### Option 2: GET /api/v1/memory endpoint for discovery
- **Trade-offs:** GET with body is non-standard. New endpoint needed.
- **Verdict:** Rejected — POST with read_only flag simpler

### Option 3: Post-cleanup step to delete gardener query thoughts
- **Trade-offs:** Complex. Race conditions. Garbage created then cleaned.
- **Verdict:** Rejected — prevention better than cleanup

### Option 4: Dedicated GET /api/v1/memory/retrieve endpoint
- **Trade-offs:** Clean separation but doubles API surface.
- **Verdict:** Rejected — overkill for this use case

## Study

Option 1 was implemented in sibling task `gardener-v002-engine-validation` (commit ccbe2af):
- `read_only:boolean` added to MemoryRequest interface
- When true, `thresholdMet` forced to false, skipping contribution
- Retrieval and reinforcement still execute normally
- All 3 gardener SKILL.md discovery queries updated with `read_only: true`
- QA verified: 0 contributions with read_only:true

## Act

No further action needed. Design evaluated, best option selected and already implemented. All 4 acceptance criteria met.
