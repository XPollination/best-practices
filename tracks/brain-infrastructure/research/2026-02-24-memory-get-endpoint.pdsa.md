# PDSA: Add GET /api/v1/memory Endpoint

**Date:** 2026-02-24
**Author:** PDSA Agent
**Task:** memory-get-endpoint
**Status:** COMPLETE

---

## PLAN

### Problem Statement

The Brain API (`POST /api/v1/memory`) is only accessible via POST. Claude web interface (claude.ai) uses `web_fetch` which only supports GET requests. Thomas wants to use Claude web for conversational access to the shared memory.

### Solution

Add a `GET /api/v1/memory` route that maps query parameters to the POST body and calls the same handler logic. No code duplication.

---

## DO

### Design: Refactoring memory.ts

**File:** `api/src/routes/memory.ts`

**Step 1: Extract shared handler function**

Extract the entire POST handler body (lines 46-266) into a standalone async function:

```typescript
async function handleMemoryRequest(
  params: MemoryRequest,
  reply: FastifyReply
): Promise<void> {
  // All existing logic from the POST handler moves here unchanged.
  // params replaces request.body destructuring.
  const { prompt, agent_id, agent_name, context, session_id } = params;
  // ... everything else stays identical ...
}
```

**Step 2: Simplify POST handler**

```typescript
app.post<{ Body: MemoryRequest }>("/api/v1/memory", async (request, reply) => {
  return handleMemoryRequest(request.body, reply);
});
```

**Step 3: Add GET handler**

```typescript
app.get<{ Querystring: MemoryRequest }>("/api/v1/memory", async (request, reply) => {
  return handleMemoryRequest({
    prompt: request.query.prompt,
    agent_id: request.query.agent_id,
    agent_name: request.query.agent_name,
    context: request.query.context,
    session_id: request.query.session_id,
  }, reply);
});
```

Fastify automatically URL-decodes query parameters, so `%20` → space, `%3F` → `?`, etc. No manual decoding needed.

**Step 4: Import FastifyReply**

Add `FastifyReply` to the existing Fastify import:

```typescript
import type { FastifyInstance, FastifyReply } from "fastify";
```

### Design: Test additions

**File:** `api/src/routes/memory.test.ts`

Add a `getMemory` helper alongside existing `postMemory`:

```typescript
async function getMemory(params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  return fetch(`${BASE_URL}/api/v1/memory?${qs}`);
}
```

Add test section:

```typescript
describe("GET /api/v1/memory", () => {
  it("returns same structure as POST for valid query params", async () => {
    const res = await getMemory({
      prompt: "What patterns exist for role separation?",
      agent_id: "agent-get-test",
      agent_name: "GET Test",
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty("result");
    expect(json).toHaveProperty("trace");
    expect(json.result).toHaveProperty("response");
    expect(json.result).toHaveProperty("sources");
  });

  it("returns 400 when prompt is missing", async () => {
    const res = await getMemory({
      agent_id: "agent-get-test",
      agent_name: "GET Test",
    });
    expect(res.status).toBe(400);
  });

  it("handles URL-encoded special characters in prompt", async () => {
    const res = await getMemory({
      prompt: "What about role separation & agent coordination?",
      agent_id: "agent-get-test",
      agent_name: "GET Test Agent",
    });
    expect(res.status).toBe(200);
  });

  it("contribution threshold works via GET (declarative insight >50 chars)", async () => {
    const res = await getMemory({
      prompt: "Role separation in multi-agent systems prevents coordination collapse by ensuring each agent has clear boundaries.",
      agent_id: "agent-get-contribute",
      agent_name: "GET Contributor",
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.trace.contribution_threshold_met).toBe(true);
    expect(json.trace.thoughts_contributed).toBe(1);
  });

  it("passes context and session_id from query params", async () => {
    const res = await getMemory({
      prompt: "How do agents handle memory?",
      agent_id: "agent-get-ctx",
      agent_name: "GET Context Test",
      context: "Working on memory system design",
      session_id: "get-test-session-123",
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.trace.context_used).toBe(true);
    expect(json.trace.session_id).toBe("get-test-session-123");
  });
});
```

### Changes Summary

| File | Change | Lines affected |
|------|--------|---------------|
| `api/src/routes/memory.ts` | Add `FastifyReply` import | Line 1 |
| `api/src/routes/memory.ts` | Extract `handleMemoryRequest()` function | Lines 45-267 refactored |
| `api/src/routes/memory.ts` | Simplify POST handler to call shared function | 3 lines |
| `api/src/routes/memory.ts` | Add GET handler calling shared function | ~10 lines |
| `api/src/routes/memory.test.ts` | Add `getMemory` helper + GET test describe block | ~50 lines |

### Edge Cases

1. **Empty query string**: Missing `prompt` → 400 VALIDATION_ERROR (same as POST)
2. **URL encoding**: Fastify handles decoding automatically via `querystring` module
3. **Long prompts in URL**: Browsers/proxies typically limit URLs to ~8KB. The 10000-char prompt limit may exceed this. Acceptable tradeoff for web_fetch use case — extremely long prompts should use POST.
4. **Caddy reverse proxy**: No config change needed — Caddy already proxies all `/api/v1/*` to port 3200. GET requests pass through.

---

## STUDY

This is a thin wrapper — no architectural decisions, no new dependencies, no schema changes. The entire change is ~15 lines of production code (extract function + add GET route) and ~50 lines of tests.

The key insight: Fastify's query string parsing handles URL decoding automatically, so the GET handler is a trivial param extraction → shared function call.

---

## ACT

Design ready for DEV implementation. No open questions.
