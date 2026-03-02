# Completion Abstract: multi-user-routing

**Date:** 2026-03-02
**Status:** Complete
**Project:** best-practices

## Outcome

Brain API now routes requests to correct Qdrant collection based on authenticated user. Added `space` parameter (private/shared) to request schema. Dynamic collection resolution replaces hardcoded `COLLECTION` constant.

## Key Decisions

- **Collection from user context:** `req.user.qdrant_collection` drives routing, with `thought_space` fallback for backward compatibility.
- **Space parameter:** `private` (default) routes to user's collection, `shared` routes to `thought_space_shared`.
- **Pheromone decay auto-discovery:** `runPheromoneDecay()` discovers all `thought_space*` collections via Qdrant API, iterates across all.

## Changes

- `api/src/services/thoughtspace.ts`: ThinkParams + RetrieveParams get `collection?` field, 14 functions parameterized (23 replacement sites), pheromone decay discovers all collections
- `api/src/routes/memory.ts`: `resolveCollection()` helper, `space` param in MemoryRequest, routes pass user context
- Commit: fd93fe6

## Test Results

- 9/9 tests pass (+ 10 auth tests still passing)
- QA PASS, PDSA PASS

## Related Documentation

- PDSA: [2026-03-02-multi-user-routing.pdsa.md](../pdsa/2026-03-02-multi-user-routing.pdsa.md)
- Depends on: multi-user-auth (task 1)
- Part of: multi-user-brain initiative (task 2 of 8)
