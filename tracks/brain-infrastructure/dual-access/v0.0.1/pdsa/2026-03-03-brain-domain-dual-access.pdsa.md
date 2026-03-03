# PDSA: Public/Private Brain — Dual-Access Concept and Domain-Aware MCP

**Track:** brain-infrastructure/dual-access
**Version:** v0.0.1
**Date:** 2026-03-03
**Status:** Plan
**Actor:** PDSA agent
**Task:** brain-domain-dual-access

## Context

Thomas's vision (from brain thought 4f568bb0): two domains — private (full personal details, experiences, wisdom) and public (abstracted principles, research methods, findings). Default contribution is private. Agents read both but write to public only through a privacy gate. Private experience is the catalyst for public knowledge but must never be the content.

### Current State (Investigation)

**Qdrant collections (live):**
- `thought_space` — Thomas's current brain (all agent thoughts land here)
- `thought_space_thomas` — created by multi-user provisioning but unused by API
- `thought_space_maria` — Maria's private collection (provisioned)
- `thought_space_shared` — shared collection (created but unused by API)
- `best_practices` / `queries` — legacy collections (46 + 32 points)

**API code (running dist):**
- Single collection: `const COLLECTION = "thought_space"` in thoughtspace.js
- No auth middleware — the `Authorization: Bearer` check exists in Fastify but only validates key, doesn't route to user-specific collections
- No domain parameter in `/api/v1/memory` endpoint
- Multi-user tasks completed (8 tasks) but code NOT deployed — the dist still targets single `thought_space`

**MCP tool (brain-mcp.js):**
- `query_brain` and `contribute_to_brain` — no `space` parameter
- Hardcoded `AGENT_ID = "thomas"` and `AGENT_NAME = "Thomas Pichler"`
- No dual-query support

## Problem Statement

1. All thoughts go to one collection — no public/private separation
2. MCP tools have no `space` parameter for routing
3. No privacy gate for private→public sharing
4. No dual-query (read from both private + public, merge results)
5. Multi-user provisioning created collections but API doesn't use them

## Plan

### Architecture: Two-Layer Domain Model

```
                 ┌─────────────────────┐
                 │    /api/v1/memory    │
                 └─────────┬───────────┘
                           │
              ┌────────────┼────────────┐
              │ Auth middleware          │
              │ Bearer → user_id        │
              │ user_id → collection    │
              └────────────┼────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                  │
    ┌────▼────┐     ┌──────▼──────┐    ┌─────▼─────┐
    │ private │     │   shared    │    │  private  │
    │ thomas  │     │ (public)    │    │  maria    │
    └─────────┘     └─────────────┘    └───────────┘
    thought_space   thought_space      thought_space
    _thomas         _shared            _maria
```

### 1. Collection Routing (thoughtspace.js)

Replace hardcoded `COLLECTION` with dynamic resolution:

```javascript
function resolveCollection(userId, space) {
  if (space === 'shared' || space === 'public') return 'thought_space_shared';
  return `thought_space_${userId}`;
}
```

- `space` parameter: `"private"` (default) or `"shared"`/`"public"`
- Collection name: `thought_space_{userId}` for private, `thought_space_shared` for public
- Default = private (privacy-first, matches Thomas's vision)

### 2. Auth Middleware (new: auth.js)

```javascript
// Fastify preHandler hook
async function authMiddleware(request, reply) {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Missing or invalid Authorization header' });
  }
  const apiKey = authHeader.slice(7);
  const user = lookupUserByKey(apiKey); // from SQLite users table
  if (!user) {
    return reply.status(401).send({ error: 'Invalid API key' });
  }
  request.userId = user.id;
  request.userName = user.name;
}
```

The users table already exists (created by multi-user-auth task). Auth extracts `userId` from API key, passes to collection resolution.

### 3. Dual-Query for Reads

When reading (retrieve/query), search BOTH private AND shared collections, merge results by score:

```javascript
async function dualRetrieve(params, userId) {
  const privateCollection = `thought_space_${userId}`;
  const sharedCollection = 'thought_space_shared';

  const [privateResults, sharedResults] = await Promise.all([
    retrieve({ ...params, collection: privateCollection }),
    retrieve({ ...params, collection: sharedCollection }),
  ]);

  // Merge by score, tag with source domain
  const merged = [...privateResults.map(r => ({ ...r, domain: 'private' })),
                  ...sharedResults.map(r => ({ ...r, domain: 'shared' }))];
  merged.sort((a, b) => b.score - a.score);
  return merged.slice(0, params.limit || 10);
}
```

Each result tagged with `domain: "private"` or `domain: "shared"` so the consumer knows the source.

### 4. Write Routing

- **Default write → private collection** (privacy-first)
- `space: "shared"` in request body → writes to shared collection
- **Privacy gate for sharing:** `/api/v1/memory/share` endpoint:
  - Takes a `thought_id` from private collection
  - Creates an **abstracted copy** in shared collection
  - The copy strips sensitive specifics (user decides what to share)
  - Original in private collection gets `shared_as` field pointing to public copy
  - This is explicit opt-in — never automatic

### 5. MCP Tool Updates

**`query_brain`** — add optional `space` parameter:
```typescript
space: z.enum(["private", "shared", "both"]).optional()
  .describe("Which domain to search: private (your brain), shared (public), both (merged). Default: both")
```

Default for queries = `"both"` (dual-query).

**`contribute_to_brain`** — add optional `space` parameter:
```typescript
space: z.enum(["private", "shared"]).optional()
  .describe("Where to store: private (default) or shared")
```

Default for contributions = `"private"`.

**Remove hardcoded identity:**
```javascript
// Before: hardcoded
const AGENT_ID = "thomas";
const AGENT_NAME = "Thomas Pichler";

// After: from auth
// MCP server authenticates via API key, extracts user identity
```

### 6. Gardener Multi-Collection

The gardener (Layer 1, 2, 3) needs to operate on the correct collection:
- Per-user gardening: operates on `thought_space_{userId}`
- Shared gardening: operates on `thought_space_shared`
- Highway queries: span both (like dual-query)

Multi-user-gardening task was already completed — verify it works with the new routing.

### 7. Migration Plan

1. **Phase 1: Auth + Routing** — Deploy auth middleware + collection resolution. Existing `thought_space` data stays (Thomas's). New writes go to `thought_space_thomas`.
2. **Phase 2: Migration** — Move `thought_space` points to `thought_space_thomas`. Update all callers.
3. **Phase 3: Dual-Query** — Enable merged reads from private + shared.
4. **Phase 4: Share Endpoint** — `/api/v1/memory/share` for explicit private→public sharing.
5. **Phase 5: MCP Update** — Add `space` parameter to MCP tools.

### Batch-Sync Anti-Pattern (from DNA)

The DNA explicitly warns against batch-sync. Thoughts are planted in the right garden at creation time:
- Agent contributes → goes to private (default) or shared (explicit)
- No nightly batch that copies private to public
- `/share` is per-thought, explicit, human-triggered
- The gardener does NOT cross-pollinate between domains

### Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `api/src/services/auth.ts` | CREATE | Auth middleware with user lookup |
| `api/src/services/thoughtspace.ts` | EDIT | Dynamic collection resolution, dual-query |
| `api/src/routes/memory.ts` | EDIT | Accept `space` param, pass userId to thoughtspace |
| `api/src/routes/share.ts` | CREATE | `/api/v1/memory/share` endpoint |
| `api/src/mcp/brain-mcp.ts` | EDIT | Add `space` param to tools, remove hardcoded identity |
| `api/src/index.ts` | EDIT | Register auth middleware, share routes |

### Acceptance Criteria

| # | Criterion |
|---|-----------|
| 1 | MCP tool accepts `space` parameter for hard routing |
| 2 | Dual-query reads from both private + shared, merges by score |
| 3 | Public reads are live (not batch-synced copies) |
| 4 | Private-to-public is explicit opt-in via `/share` endpoint |
| 5 | Batch-sync anti-pattern is not used anywhere |
| 6 | Default write = private (privacy-first) |
| 7 | Auth middleware resolves user from API key |
| 8 | Gardener operates per-collection |
| 9 | Results tagged with `domain: "private"` or `domain: "shared"` |

## Do

_To be filled during implementation_

## Study

_To be filled after implementation_

## Act

_To be filled after study_
