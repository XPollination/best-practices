# PDSA: Multi-User Routing — Dynamic Collection Resolution

**Date:** 2026-03-02
**Task:** multi-user-routing
**Parent:** multi-user-brain-research
**Depends On:** multi-user-auth (provides `req.user` context)
**Status:** PLAN

## Plan

### Problem
Brain API hardcodes `COLLECTION = "thought_space"` (thoughtspace.ts:8). All 14 exported functions use this constant for every Qdrant operation. After multi-user-auth adds `req.user` to requests, the service layer needs to route operations to the correct per-user collection (`thought_space_{user_id}`) or the shared collection (`thought_space_shared`).

### Design

#### Approach: Add `collection` parameter to all service functions

The existing vectordb.ts already takes `collection` as a parameter — thoughtspace.ts just doesn't pass it through. The change is mechanical: every function that uses `COLLECTION` gets an optional `collection?: string` parameter that defaults to `"thought_space"` for backward compatibility.

---

#### Change 1: thoughtspace.ts — Make collection dynamic

**File:** `api/src/services/thoughtspace.ts`

**Replace COLLECTION constant with resolver:**

```typescript
// Line 8: replace
const COLLECTION = "thought_space";

// With:
const DEFAULT_COLLECTION = "thought_space";
```

**Add `collection` parameter to all 14 exported functions:**

Functions that need the parameter (with their current signatures → new signatures):

| # | Function | Line | Change |
|---|----------|------|--------|
| 1 | `ensureThoughtSpace()` | 13 | `ensureThoughtSpace(collection?: string)` |
| 2 | `think(params)` | 169 | Add `collection?: string` to ThinkParams interface |
| 3 | `retrieve(params)` | 299 | Add `collection?: string` to RetrieveParams interface |
| 4 | `runPheromoneDecay()` | 502 | `runPheromoneDecay(collection?: string)` — NOTE: decay runs for ALL collections, see below |
| 5 | `applyImplicitFeedback(ids)` | 572 | `applyImplicitFeedback(ids, collection?: string)` |
| 6 | `highways(params)` | 614 | Add `collection?: string` to HighwayParams interface |
| 7 | `getExistingTags()` | 771 | `getExistingTags(collection?: string)` |
| 8 | `getThoughtById(id)` | 800 | `getThoughtById(id, collection?: string)` |
| 9 | `getThoughtsByIds(ids)` | (called internally) | `getThoughtsByIds(ids, collection?: string)` |
| 10 | `updateThoughtMetadata(id, fields)` | 835 | `updateThoughtMetadata(id, fields, collection?: string)` |
| 11 | `listUncategorizedThoughts(limit, offset)` | 860 | `listUncategorizedThoughts(limit, offset, collection?: string)` |
| 12 | `listDomainSummaries(limit, offset)` | 894 | `listDomainSummaries(limit, offset, collection?: string)` |
| 13 | `getRefiningThoughts(ids)` | 929 | `getRefiningThoughts(ids, collection?: string)` |
| 14 | `getLineage(id, maxDepth)` | 979 | `getLineage(id, maxDepth, collection?: string)` |

**Internal replacement pattern** (23 locations):
```typescript
// Before:
await client.upsert(COLLECTION, { ... });

// After:
const coll = collection ?? DEFAULT_COLLECTION;
await client.upsert(coll, { ... });
```

For functions with interface-based params (think, retrieve, highways), add `collection` to the interface and extract it:
```typescript
interface ThinkParams {
  // ... existing fields ...
  collection?: string;
}

export async function think(params: ThinkParams): Promise<ThinkResult> {
  const coll = params.collection ?? DEFAULT_COLLECTION;
  // ... use coll instead of COLLECTION ...
}
```

**Pheromone decay special case:** `runPheromoneDecay()` runs as a cron job (every 24h, started by `startPheromoneDecayJob()`). In multi-user mode, it needs to decay ALL user collections. Two options:

- **Option A:** Accept `collection` parameter, run decay per-collection. The job scheduler iterates over all active users' collections.
- **Option B (recommended):** Keep single call. Modify to iterate over all collections matching `thought_space_*` pattern using Qdrant's `getCollections()`.

Go with Option B — the decay job is a background task and should be self-contained.

---

#### Change 2: memory.ts — Extract collection from request context

**File:** `api/src/routes/memory.ts`

The route handlers need to resolve the collection from `req.user`. Two concerns:
1. Which collection to use (user's private vs shared)
2. Passing collection to all service calls

**Add collection resolver helper:**

```typescript
function resolveCollection(request: FastifyRequest, space?: string): string {
  if (space === "shared") {
    return "thought_space_shared";
  }
  // Use authenticated user's collection, or default
  return request.user?.qdrant_collection ?? "thought_space";
}
```

**Add `space` to request schema:**

```typescript
interface MemoryRequest {
  // ... existing fields ...
  space?: "private" | "shared";  // NEW: defaults to "private"
}
```

**Update handleMemoryRequest to accept request:**

The current pattern passes only `request.body`:
```typescript
// Line 471 (current):
app.post("/api/v1/memory", async (request, reply) => {
  return handleMemoryRequest(request.body, reply);
});
```

Change to pass the full request:
```typescript
// After:
app.post("/api/v1/memory", async (request, reply) => {
  return handleMemoryRequest(request, reply);
});
```

Then in `handleMemoryRequest`, extract body and user:
```typescript
async function handleMemoryRequest(request: FastifyRequest, reply: FastifyReply) {
  const body = request.body as MemoryRequest;
  const collection = resolveCollection(request, body.space);

  // Pass collection to all service calls:
  const existingTags = await getExistingTags(collection);
  const thinkResult = await think({ ...params, collection });
  const results = await retrieve({ ...params, collection });
  // etc.
}
```

**All call sites that need `collection` parameter:**

| Call | Current Line | Change |
|------|-------------|--------|
| `getThoughtById(refines)` | ~159 | `getThoughtById(refines, collection)` |
| `getThoughtById(id)` (consolidates loop) | ~168 | `getThoughtById(id, collection)` |
| `getExistingTags()` | ~203 | `getExistingTags(collection)` |
| `think({...})` | ~220 | `think({..., collection})` |
| `retrieve({...})` | ~269 | `retrieve({..., collection})` |
| `highways({...})` | ~400 | `highways({..., collection})` |
| `getRefiningThoughts(ids)` | ~414 | `getRefiningThoughts(ids, collection)` |
| `getLineage(id)` | ~433 | `getLineage(id, 10, collection)` |
| `getThoughtById(id)` (drill-down) | ~489 | `getThoughtById(id, collection)` |
| `updateThoughtMetadata(id, fields)` | ~538 | `updateThoughtMetadata(id, fields, collection)` |
| `listUncategorizedThoughts(limit, offset)` | ~567 | `listUncategorizedThoughts(limit, offset, collection)` |
| `listDomainSummaries(limit, offset)` | ~586 | `listDomainSummaries(limit, offset, collection)` |

**Shared space attribution:** When `space === "shared"`, the `contributor_id` in the thought payload is already set from the `agent_id` in the request body. This naturally attributes shared contributions to the user's agent. No additional change needed.

---

#### Change 3: ensureThoughtSpace for new collections

**File:** `api/src/services/thoughtspace.ts`

Currently `ensureThoughtSpace()` only creates the default `thought_space` collection. For multi-user, it should also ensure the shared collection exists.

```typescript
export async function ensureThoughtSpace(collection?: string): Promise<void> {
  const coll = collection ?? DEFAULT_COLLECTION;
  const collections = await client.getCollections();
  const names = collections.collections.map((c) => c.name);

  if (!names.includes(coll)) {
    await client.createCollection(coll, {
      vectors: { size: EMBEDDING_DIM, distance: "Cosine" },
      optimizers_config: { default_segment_number: 2 },
      replication_factor: 1,
    });
    console.log(`Created collection: ${coll}`);
    // Create payload indexes...
  }
}
```

At startup (index.ts), call `ensureThoughtSpace()` for default AND shared:
```typescript
await ensureThoughtSpace();  // Default for backward compat
await ensureThoughtSpace("thought_space_shared");
```

User-specific collections are created by the provisioning script (separate task), not at API startup.

---

#### Change 4: Validate space parameter

**File:** `api/src/routes/memory.ts`

Add validation early in the request handler:

```typescript
if (body.space && body.space !== "private" && body.space !== "shared") {
  return reply.status(400).send({
    error: { code: "VALIDATION_ERROR", message: "space must be 'private' or 'shared'" },
  });
}
```

---

### Files Modified
| File | Change |
|------|--------|
| `api/src/services/thoughtspace.ts` | Replace `COLLECTION` with `DEFAULT_COLLECTION`, add `collection` parameter to 14 functions (23 internal replacements) |
| `api/src/routes/memory.ts` | Add `resolveCollection()` helper, `space` to MemoryRequest, pass `collection` to 12+ service calls, change handleMemoryRequest signature |
| `api/src/index.ts` | Ensure shared collection at startup |

### NOT Changed
- `api/src/services/database.ts` — Users table is in multi-user-auth task
- `api/src/middleware/auth.ts` — Auth middleware is in multi-user-auth task
- `api/src/services/vectordb.ts` — Already takes collection as parameter, no changes needed
- `api/src/services/embedding.ts` — No collection awareness needed
- MCP connector — Separate task (multi-user-mcp-config)

### Backward Compatibility
- All `collection` parameters default to `DEFAULT_COLLECTION = "thought_space"`, so existing callers (including MCP connector sending no auth) continue to work on Thomas's collection
- `space` parameter is optional and defaults to `"private"` behavior
- `ensureThoughtSpace()` without args still creates default collection
- Pheromone decay job automatically discovers all `thought_space_*` collections

### Risks
- **Wrong collection routing = data leak.** If `resolveCollection()` returns the wrong collection, a user sees another user's thoughts. Mitigation: always derive from `req.user.qdrant_collection` (set by auth middleware from database lookup), never from user-supplied input.
- **Shared space pollution.** Any authenticated user can write to shared space. Acceptable by design — shared space is opt-in and all contributions are attributed.
- **Pheromone decay across all collections.** If decay iterates over all `thought_space_*` collections and one fails, it could stop decay for others. Mitigation: catch errors per-collection, continue with next.

### Edge Cases
- **No auth header (unauthenticated):** Falls through to `req.user?.qdrant_collection ?? "thought_space"` — uses default collection. After multi-user-auth is deployed, unauthenticated requests get 401 before reaching routes.
- **User requests `space: "shared"` but no shared collection exists:** `ensureThoughtSpace("thought_space_shared")` at startup prevents this.
- **Validation of thought references across spaces:** `getThoughtById(refines)` should search the SAME collection the thought will be stored in. If user refines a thought in their private space, the refinement stays in their private space.
- **Cross-space refinement:** Not supported in this design. A user cannot refine a shared thought from their private space. If needed later, a separate "import from shared" operation can be added.

## Do
(To be completed by DEV agent)

## Study
- All 14 exported functions accept `collection` parameter
- Default value preserves backward compatibility
- `space: "private"|"shared"` parameter works on POST /api/v1/memory
- Shared collection routed to `thought_space_shared`
- Private collection routed to `req.user.qdrant_collection`
- Pheromone decay covers all `thought_space_*` collections
- Cross-space refinement not supported (by design)
- Validation rejects unknown space values

## Act
- Deploy after multi-user-auth is live (depends on req.user)
- Test: same API key routes to same collection consistently
- Monitor: no cross-collection data leaks in shared space
- Next task: multi-user-provision-script (creates per-user collections)
