# PDSA: Add Error Handling to brain-mcp.ts

**Date:** 2026-02-25
**Version:** best-practices v0.0.2
**Status:** PLAN
**Task:** `mcp-server-crash-error-handling`

---

## PLAN

### Problem

`brain-mcp.ts` (port 3201) runs in the same Node.js process as the brain API (port 3200, Fastify). The async request handler (lines 86-93) has no try-catch:

```typescript
const mcp = createMcpServer();
const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
await mcp.connect(transport);
await transport.handleRequest(req, res);
await mcp.close();
```

Any exception in these lines becomes an unhandled rejection, crashing the entire process — taking down the brain API for all agents.

Additionally:
- No `httpServer.on('error')` listener for network-level errors
- No `process.on('unhandledRejection')` safety net in `index.ts`

### Root Cause

The MCP server was added quickly during the Claude.ai connector work. Error handling was deferred.

---

## DO (Design)

### Fix 1: try-catch in brain-mcp.ts handler

**File:** `api/src/mcp/brain-mcp.ts` — `startMcpServer()` function

Wrap the async handler body (lines 86-93) in try-catch:

```typescript
try {
  const mcp = createMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  await mcp.connect(transport);
  await transport.handleRequest(req, res);
  await mcp.close();
} catch (err) {
  console.error("MCP request handler error:", err);
  if (!res.headersSent) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Internal MCP server error" }));
  }
}
```

Key: check `res.headersSent` before writing headers — if `transport.handleRequest()` partially wrote the response, writing headers again would throw.

### Fix 2: httpServer.on('error') listener

**File:** `api/src/mcp/brain-mcp.ts` — after `createServer()`

```typescript
httpServer.on("error", (err) => {
  console.error("MCP HTTP server error:", err);
});
```

This catches network-level errors (EADDRINUSE, EACCES, etc.) without crashing.

### Fix 3: process.on('unhandledRejection') in index.ts

**File:** `api/src/index.ts` — add at top, before Fastify setup

```typescript
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled rejection at:", promise, "reason:", reason);
});
```

Safety net — logs but doesn't crash. In Node.js 15+, unhandled rejections crash by default. This handler prevents that.

### Fix 4 (Out of scope)

Process isolation (running MCP as separate process) is an architectural improvement for a future task. Not needed for this fix.

---

### File Changes Summary

| File | Change |
|------|--------|
| `api/src/mcp/brain-mcp.ts` | Wrap handler in try-catch, add httpServer.on('error') |
| `api/src/index.ts` | Add process.on('unhandledRejection') handler |

2 files, minimal changes. No new files.

---

### Acceptance Criteria

**AC1:** try-catch wraps entire async handler in brain-mcp.ts
**AC2:** httpServer.on('error') listener added
**AC3:** Malformed request (`curl -X POST http://localhost:3201/mcp -d "{invalid}"`) returns 500, does NOT crash process
**AC4:** Brain API (port 3200) stays healthy after MCP error — `curl http://localhost:3200/api/v1/health` returns ok
**AC5:** curl with invalid body returns error response, not connection refused
**AC6:** process.on('unhandledRejection') handler in index.ts

---

## STUDY

*To be filled after implementation*

---

## ACT

*To be filled after study*
