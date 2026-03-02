# PDSA: Multi-User MCP Config — Per-User API Key in Headers

**Date:** 2026-03-02
**Task:** multi-user-mcp-config
**Parent:** multi-user-brain-research
**Depends On:** multi-user-auth (API keys exist)
**Status:** PLAN

## Plan

### Problem
MCP connector (brain-mcp.ts) hardcodes `AGENT_ID = "thomas"` and `AGENT_NAME = "Thomas Pichler"` (lines 7-8). It calls the Brain API at localhost:3200 without auth headers. After multi-user-auth adds Bearer token authentication, the MCP connector must:
1. Send an Authorization header when calling the Brain API
2. Stop hardcoding Thomas's identity — derive it from the authenticated user

### Design

#### Change 1: Add Authorization header to internal API calls
**File:** `api/src/mcp/brain-mcp.ts`

```typescript
// Line 6-8: replace hardcoded identity
const BRAIN_API = "http://localhost:3200/api/v1/memory";
const BRAIN_API_KEY = process.env.BRAIN_API_KEY || "default-thomas-key";
const MCP_PORT = 3201;
```

Remove `AGENT_ID` and `AGENT_NAME` constants entirely. They come from the request body (each MCP caller provides their own agent_id/agent_name).

In `callBrain()`:
```typescript
async function callBrain(prompt: string, context?: string, session_id?: string, full_content?: boolean, read_only?: boolean): Promise<unknown> {
  const body: Record<string, unknown> = { prompt, agent_id: AGENT_ID, agent_name: AGENT_NAME };
  // ...
  const res = await fetch(BRAIN_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${BRAIN_API_KEY}`,  // NEW
    },
    body: JSON.stringify(body),
  });
}
```

**Wait — agent_id and agent_name:** The MCP tools (query_brain, contribute_to_brain) don't expose agent_id/agent_name as parameters. The current design has these hardcoded to "thomas". In a multi-user setup, the API key determines the user, and the auth middleware sets `req.user`. But the MCP connector makes internal API calls where the `agent_id` in the request body is informational (stored in thought payloads).

**Decision:** Keep AGENT_ID/AGENT_NAME derivable from the API key. The auth middleware resolves the user from the Bearer token. The `agent_id` and `agent_name` in the request body should match the authenticated user. Two options:

**Option A (recommended):** Read from env vars:
```typescript
const BRAIN_API_KEY = process.env.BRAIN_API_KEY || "default-thomas-key";
const AGENT_ID = process.env.BRAIN_AGENT_ID || "thomas";
const AGENT_NAME = process.env.BRAIN_AGENT_NAME || "Thomas Pichler";
```
Each user's MCP process runs with their env vars set. Simple, no code logic changes.

**Option B:** Remove agent_id/agent_name from request body, let the API derive them from the auth token. Requires API route changes — out of scope for this task.

Go with **Option A** — env vars for identity + API key. Backward compatible (defaults to Thomas).

#### Change 2: Add Authorization header to getThought
**File:** `api/src/mcp/brain-mcp.ts`

```typescript
async function getThought(thought_id: string): Promise<unknown> {
  const res = await fetch(`${BRAIN_API}/thought/${thought_id}`, {
    headers: {
      "Authorization": `Bearer ${BRAIN_API_KEY}`,  // NEW
    },
  });
  // ...
}
```

#### Change 3: Document MCP config template for Claude Web AI

Create a config template file that users can reference when setting up Claude Web AI:

**File:** `api/docs/mcp-config-template.md` (NEW)

```markdown
# MCP Configuration for Claude Web AI

Each user gets their own API key from the provisioning script.
Configure Claude Web AI's MCP settings with:

## MCP Server URL
```
https://<brain-host>:3201/mcp
```

## Headers (set in Claude Web AI MCP settings)
```json
{
  "Authorization": "Bearer <your-api-key>"
}
```

## For local MCP process (agent sessions)
Set environment variables before starting the MCP server:
```bash
export BRAIN_API_KEY="<your-api-key>"
export BRAIN_AGENT_ID="<your-user-id>"
export BRAIN_AGENT_NAME="<Your Display Name>"
```

## Example: Thomas
```bash
export BRAIN_API_KEY="default-thomas-key"
export BRAIN_AGENT_ID="thomas"
export BRAIN_AGENT_NAME="Thomas Pichler"
```

## Example: Maria
```bash
export BRAIN_API_KEY="<maria-uuid-key>"
export BRAIN_AGENT_ID="maria"
export BRAIN_AGENT_NAME="Maria Pichler"
```
```

**Note:** Claude Web AI passes the Authorization header with every MCP request. The MCP connector reads it from `process.env.BRAIN_API_KEY` for internal API calls. Claude Web AI users set the header in their MCP config; agent sessions set the env var.

### Files Modified
| File | Change |
|------|--------|
| `api/src/mcp/brain-mcp.ts` | Add `Authorization: Bearer` header to callBrain() and getThought(); read AGENT_ID, AGENT_NAME, BRAIN_API_KEY from env vars with Thomas defaults |
| `api/docs/mcp-config-template.md` | NEW: Configuration template for Claude Web AI users |

### NOT Changed
- Auth middleware (that's multi-user-auth task)
- Memory routes (MCP calls the API, API handles auth)
- Qdrant / collection routing (that's multi-user-routing task)

### Risks
- **MCP connector restart required after auth deployment.** Without BRAIN_API_KEY env var, MCP connector gets 401 from brain API. Mitigation: default-thomas-key in env var matches Thomas's seeded API key.
- **Claude Web AI header support.** Assumption: Claude Web AI MCP config supports custom headers. If not, need reverse proxy or alternative auth.

### Edge Cases
- **No BRAIN_API_KEY env var:** Falls back to `"default-thomas-key"` — backward compatible with Thomas's seeded user.
- **Multiple MCP users on same server:** Each user runs a separate MCP process with their env vars. Not a shared process.

## Do
(To be completed by DEV agent)

## Study
- MCP connector sends Authorization header to brain API
- Thomas defaults work without any env vars set
- Maria config with different API key reaches correct brain
- Environment variables: BRAIN_API_KEY, BRAIN_AGENT_ID, BRAIN_AGENT_NAME
- Config template documented

## Act
- Deploy: set env vars in agent session scripts
- Test: Claude Web AI with custom header reaches brain API
- Monitor: no 401 errors from MCP connector after auth deployment
