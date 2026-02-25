# PDSA: Enforce Memory Usage in Agent Workflow

**Date:** 2026-02-24 (reworked 2026-02-25)
**Author:** PDSA Agent
**Task:** memory-workflow-enforcement
**Status:** REWORK v3 COMPLETE (Layer B: implementation-ready MCP wrapper spec)

---

## PLAN

### Problem Statement

Brain API usage is currently voluntary. The monitor skill tells agents "when to use the brain" but nothing enforces it. Thomas wants two layers:

- **Layer A:** Agents MUST query at task start and contribute at task end
- **Layer B:** Thomas converses with the brain via Claude web (voluntary, no workflow)

### Research Inputs

- Workflow engine: `xpollination-mcp-server/src/db/workflow-engine.js` — has `requiresDna` mechanism for transition gates
- Monitor skill: `~/.claude/skills/monitor/SKILL.md` — already has advisory brain integration section
- Brain API: `POST /api/v1/memory` (and soon GET) at `localhost:3200` / `bestpractice.xpollination.earth`
- Current `active->approval` already requires `pdsa_ref` via `requiresDna`

### Rework Context

Original PDSA recommended Option 3 (do-or-explain with `requiresDnaOneOf`). Thomas overrode:

> "Brain down MUST block workflow. The brain is infrastructure, not optional tooling. Escape hatches will be skipped."

**Decision: Option 1 — Hard gate via existing `requiresDna` mechanism. No escape hatch. No `requiresDnaOneOf`.**

Additional requirement: rework cycles must re-trigger memory operations. Every `rework→active` clears previous memory fields, forcing re-query.

---

## DO

### Layer A: Agent Workflow Enforcement (Option 1 — Hard Gate)

#### Design Principle

The brain is infrastructure. If it's down, agents wait — just like they'd wait if the database were down. No skip reasons, no escape hatches.

#### New DNA Fields

| Field | Type | When Required | Description |
|-------|------|---------------|-------------|
| `memory_query_session` | string | `ready→active`, `rework→active` | Session ID from brain query at task start |
| `memory_contribution_id` | string | `active→approval`, `active→review` | thought_id of contributed insight |

No `memory_skip_reason` field. These are mandatory, period.

#### Workflow Engine Changes

**1. Task type — `ready→active` transitions (add `requiresDna`):**

```javascript
// Generic (fallback)
'ready->active': { allowedActors: ['pdsa', 'dev', 'qa', 'liaison'], requiresDna: ['memory_query_session'] },
// Role-specific
'ready->active:pdsa': { allowedActors: ['pdsa'], requireRole: 'pdsa', requiresDna: ['memory_query_session'] },
'ready->active:dev': { allowedActors: ['dev'], requireRole: 'dev', requiresDna: ['memory_query_session'] },
'ready->active:qa': { allowedActors: ['qa'], requireRole: 'qa', requiresDna: ['memory_query_session'] },
'ready->active:liaison': { allowedActors: ['liaison'], requireRole: 'liaison', requiresDna: ['memory_query_session'] },
```

**2. Task type — `rework→active` transitions (add `requiresDna`):**

```javascript
// Generic (fallback)
'rework->active': { allowedActors: ['pdsa', 'dev', 'qa', 'liaison'], requiresDna: ['memory_query_session'] },
// Role-specific
'rework->active:pdsa': { allowedActors: ['pdsa'], requireRole: 'pdsa', requiresDna: ['memory_query_session'] },
'rework->active:dev': { allowedActors: ['dev'], requireRole: 'dev', requiresDna: ['memory_query_session'] },
'rework->active:qa': { allowedActors: ['qa'], requireRole: 'qa', requiresDna: ['memory_query_session'] },
'rework->active:liaison': { allowedActors: ['liaison'], requireRole: 'liaison', requiresDna: ['memory_query_session'] },
```

**3. Task type — completion transitions (add `requiresDna` for `memory_contribution_id`):**

```javascript
// Dev sends to review
'active->review': { allowedActors: ['dev'], requireRole: 'dev', newRole: 'qa', requiresDna: ['memory_contribution_id'] },
// Liaison content path
'active->review:liaison': { allowedActors: ['liaison'], requireRole: 'liaison', newRole: 'liaison', requiresDna: ['memory_contribution_id'] },
// PDSA sends to approval (already has pdsa_ref — now also requires memory_contribution_id)
'active->approval': { allowedActors: ['pdsa'], requireRole: 'pdsa', requiresDna: ['pdsa_ref', 'memory_contribution_id'], newRole: 'liaison' },
```

**4. Bug type — same pattern:**

```javascript
'ready->active': { allowedActors: ['dev'], requireRole: 'dev', requiresDna: ['memory_query_session'] },
'active->review': { allowedActors: ['dev'], newRole: 'qa', requiresDna: ['memory_contribution_id'] },
'rework->active': { allowedActors: ['dev'], requiresDna: ['memory_query_session'] },
```

**5. `testing→active` transition (QA claims for implementation):**

```javascript
'testing->active': { allowedActors: ['qa'], requireRole: 'qa', requiresDna: ['memory_query_session'] },
```

#### Memory Field Clearing on Rework

When a task transitions to `rework`, the previous `memory_query_session` and `memory_contribution_id` must be cleared so the agent claiming the rework is forced to re-query the brain.

**Implementation approach:** Add a `clearsDna` property to rework-triggering transitions:

```javascript
'review->rework': { allowedActors: ['pdsa', 'qa'], newRole: 'dev', clearsDna: ['memory_query_session', 'memory_contribution_id'] },
'approval->rework': { allowedActors: ['liaison', 'thomas'], newRole: 'pdsa', clearsDna: ['memory_query_session', 'memory_contribution_id'] },
'review->rework:liaison': { allowedActors: ['liaison'], requireRole: 'liaison', newRole: 'liaison', clearsDna: ['memory_query_session', 'memory_contribution_id'] },
```

**Engine logic for `clearsDna`** (in the transition execution path, after validation passes):

```javascript
// In the transition handler (where DNA is updated):
if (rule.clearsDna && Array.isArray(rule.clearsDna)) {
  for (const field of rule.clearsDna) {
    if (dna[field]) {
      delete dna[field];
    }
  }
  // Persist the updated DNA
}
```

This is a new engine capability but simpler than `requiresDnaOneOf` — it's just field deletion on transition.

#### Agent Workflow (Enforced)

```
1. Agent discovers task (ready or rework state)
2. Before claiming (ready→active or rework→active):
   a. Query brain: curl POST /api/v1/memory with task topic
   b. Write to DNA: memory_query_session = trace.session_id
      node interface-cli.js update-dna <slug> '{"memory_query_session":"<session_id>"}' <actor>
3. Claim task: transition ready→active (engine validates memory_query_session in DNA)
4. Do the work
5. Before submitting (active→approval or active→review):
   a. Contribute to brain: curl POST /api/v1/memory with key learning
   b. Write to DNA: memory_contribution_id = thought_id from response
      node interface-cli.js update-dna <slug> '{"memory_contribution_id":"<thought_id>"}' <actor>
6. Submit: transition (engine validates memory_contribution_id in DNA)
```

If brain is down at step 2a or 5a → agent waits and retries. Brain is infrastructure.

#### Monitor Skill Update

Update `~/.claude/skills/monitor/SKILL.md` brain section:
- Change "When to use the brain" to "MANDATORY Brain Operations"
- Document the two required DNA fields
- Show the curl + update-dna command sequence
- State clearly: "If brain is unavailable, wait and retry. Do NOT skip."
- Document that rework clears memory fields — agent must re-query

---

### Layer B: Thomas Conversational Access via Claude Web

**REWORKED (v3):** Implementation-ready specification. Claude web connects via MCP connectors, not web_fetch.

#### Discovery

Claude.ai supports remote MCP servers via Settings > Connectors > Add custom connector.
- **Transport:** Streamable HTTP (SSE deprecated soon)
- **Auth:** Authless supported (sufficient — already behind Caddy HTTPS)
- **SDK:** `@modelcontextprotocol/sdk@1.27.1` — `StreamableHTTPServerTransport` from `@modelcontextprotocol/sdk/server/streamableHttp.js`
- Source: https://support.claude.com/en/articles/11503834-building-custom-connectors-via-remote-mcp-servers

#### File Structure

```
best-practices/api/
├── src/
│   ├── index.ts              # Existing — add MCP server startup call
│   └── mcp/
│       └── brain-mcp.ts      # NEW — complete MCP server (~90 lines)
└── package.json              # Add @modelcontextprotocol/sdk dependency
```

#### Dependency Addition

```bash
cd /home/developer/workspaces/github/PichlerThomas/best-practices/api
source ~/.nvm/nvm.sh
npm install @modelcontextprotocol/sdk@1.27.1
```

This brings in `zod` (already a dep of SDK), `@hono/node-server`, and other SDK dependencies. No separate zod install needed.

#### File 1: `api/src/mcp/brain-mcp.ts` (NEW — complete implementation)

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { z } from "zod";

const BRAIN_API = "http://localhost:3200/api/v1/memory";
const AGENT_ID = "thomas";
const AGENT_NAME = "Thomas Pichler";
const MCP_PORT = 3201;

async function callBrain(prompt: string, context?: string, session_id?: string): Promise<unknown> {
  const body: Record<string, string> = { prompt, agent_id: AGENT_ID, agent_name: AGENT_NAME };
  if (context) body.context = context;
  if (session_id) body.session_id = session_id;

  const res = await fetch(BRAIN_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Brain API error ${res.status}: ${err}`);
  }
  return res.json();
}

export async function startMcpServer(): Promise<void> {
  const mcp = new McpServer(
    { name: "xpollination-brain", version: "0.1.0" },
    { capabilities: { tools: {} } }
  );

  mcp.tool(
    "query_brain",
    "Query the shared agent brain for knowledge on a topic. Returns matching thoughts with sources and high-traffic knowledge paths.",
    {
      prompt: z.string().describe("Natural language question or topic to search"),
      context: z.string().optional().describe("What you are currently working on — changes retrieval direction"),
      session_id: z.string().optional().describe("Reuse from previous call for conversation continuity"),
    },
    async ({ prompt, context, session_id }) => {
      const data = await callBrain(prompt, context, session_id) as Record<string, unknown>;
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  mcp.tool(
    "contribute_to_brain",
    "Contribute a strategic thought or learning to the shared agent brain. Must be >50 chars and a declarative statement (not a question).",
    {
      prompt: z.string().min(51).describe("Declarative statement to store as knowledge (>50 chars, not a question)"),
      context: z.string().optional().describe("What you are currently working on — stored as provenance"),
      session_id: z.string().optional().describe("Reuse from previous call for conversation continuity"),
    },
    async ({ prompt, context, session_id }) => {
      const data = await callBrain(prompt, context, session_id) as Record<string, unknown>;
      const trace = data.trace as Record<string, unknown> | undefined;
      const contributed = trace?.thoughts_contributed ?? 0;
      const prefix = contributed > 0
        ? "Thought stored successfully."
        : "Not stored (too short or interrogative). Still retrieved related thoughts:";
      return { content: [{ type: "text" as const, text: `${prefix}\n\n${JSON.stringify(data, null, 2)}` }] };
    }
  );

  // One transport per connection — each request creates a stateless transport
  const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    // CORS for Claude.ai
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, mcp-session-id");
    res.setHeader("Access-Control-Expose-Headers", "mcp-session-id");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // Stateless mode: no session management needed for Thomas's use case
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless
    });

    await mcp.connect(transport);

    await transport.handleRequest(req, res);
  });

  httpServer.listen(MCP_PORT, "0.0.0.0", () => {
    console.log(`MCP server (brain wrapper) running on http://0.0.0.0:${MCP_PORT}`);
  });
}
```

#### File 2: `api/src/index.ts` (MODIFY — add one import + one call)

Add at the top with other imports:
```typescript
import { startMcpServer } from "./mcp/brain-mcp.js";
```

Add after line 31 (`await app.listen(...)`) and before the final console.log:
```typescript
await startMcpServer();
```

Final `index.ts` lines 30-33 become:
```typescript
await app.listen({ port: 3200, host: "0.0.0.0" });
console.log("API server running on http://0.0.0.0:3200");
await startMcpServer();
```

#### Caddy Config (`/etc/caddy/Caddyfile`)

Current Caddy config routes all traffic to port 3200. Add MCP path handling:

```
bestpractice.xpollination.earth {
    handle /mcp* {
        reverse_proxy localhost:3201
    }
    handle {
        reverse_proxy localhost:3200
    }
}
```

**Note:** Caddy config is at `/etc/caddy/Caddyfile` (requires thomas user). After editing: `sudo systemctl reload caddy`.

#### Startup

MCP server starts alongside the brain API in the same process. One `npm run dev` (or `tsx src/index.ts`) starts both:
- Port 3200: Brain API (Fastify)
- Port 3201: MCP server (raw Node.js HTTP)

No separate systemd unit needed. If the brain API crashes, the MCP server goes down too — this is correct behavior (brain is infrastructure).

#### npm script (no change needed)

Existing `"dev": "tsx src/index.ts"` already covers both servers since MCP starts from index.ts.

#### Claude.ai Connector Setup (Thomas does this once)

1. Go to claude.ai → Settings → Connectors
2. Click "Add custom connector"
3. URL: `https://bestpractice.xpollination.earth/mcp`
4. Name: `XPollination Brain`
5. Auth: None (authless)
6. Save

#### Claude.ai Project Instruction (for Thomas's XPollination project)

```
You have access to the XPollination shared agent brain via MCP tools.

## Available Tools

**query_brain** — Ask questions or search knowledge
- prompt: your question in natural language
- context: (optional) what you're working on, changes retrieval direction
- session_id: (optional) reuse across calls for conversation continuity

**contribute_to_brain** — Share strategic thoughts and learnings
- prompt: declarative statement, >50 chars (questions are not stored)
- context: (optional) what you're working on, stored as provenance
- session_id: (optional) reuse across calls

## Usage
- For questions: use query_brain naturally
- For contributions: make declarative statements via contribute_to_brain
- Reuse session_id from first response for subsequent calls in same conversation
- Response includes: sources (provenance), highways (high-traffic knowledge paths)

## Your Identity
You appear as agent_id=thomas, agent_name=Thomas Pichler in the brain.
```

**Agent identity:** Hardcoded in MCP server: `agent_id: "thomas"`, `agent_name: "Thomas Pichler"`

#### Acceptance Criteria (testable without Claude.ai)

**AC-B1: MCP server starts**
```bash
source ~/.nvm/nvm.sh && cd best-practices/api && npm run dev
# Both "API server running on http://0.0.0.0:3200" and
# "MCP server (brain wrapper) running on http://0.0.0.0:3201" appear
```

**AC-B2: MCP endpoint responds to protocol**
```bash
# MCP initialize request
curl -s -X POST http://localhost:3201 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'
# Expected: JSON-RPC response with server capabilities including tools
```

**AC-B3: Tool listing**
```bash
curl -s -X POST http://localhost:3201 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
# Expected: list with query_brain and contribute_to_brain tools
```

**AC-B4: Query tool works**
```bash
curl -s -X POST http://localhost:3201 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"query_brain","arguments":{"prompt":"role separation"}}}'
# Expected: JSON-RPC response with brain query results
```

**AC-B5: Contribute tool works**
```bash
curl -s -X POST http://localhost:3201 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"contribute_to_brain","arguments":{"prompt":"Test contribution from MCP wrapper acceptance test — this is a declarative statement over fifty characters long."}}}'
# Expected: JSON-RPC response indicating thought stored
```

**AC-B6: CORS headers present**
```bash
curl -s -I -X OPTIONS http://localhost:3201
# Expected: Access-Control-Allow-Origin: *, status 204
```

---

## STUDY

### Key Design Decision

Thomas's override of Option 3 in favor of Option 1 reflects a clear architectural principle: **the brain is infrastructure, not a feature.** When infrastructure is down, work stops. This is the same as how agents can't work if the database is down or if git is unreachable.

The `requiresDnaOneOf` pattern (do-or-explain) is NOT being implemented. The existing `requiresDna` mechanism (all fields required) is sufficient.

### New Engine Capability: `clearsDna`

The one new engine capability needed is `clearsDna` — field deletion on rework transitions. This ensures agents can't coast on stale memory queries across rework cycles. Every active phase starts fresh with the brain.

This is simpler than `requiresDnaOneOf` and doesn't introduce optional paths.

### What Changes Where

| Component | Change | Scope |
|-----------|--------|-------|
| `workflow-engine.js` | Add `requiresDna: ['memory_query_session']` to 10 transitions | Property additions only |
| `workflow-engine.js` | Add `requiresDna: ['memory_contribution_id']` to 4 transitions | Property additions only |
| `workflow-engine.js` | Add `clearsDna` handling in transition execution | ~8 lines new logic |
| `workflow-engine.js` | Add `clearsDna` to 3 rework transitions | Property additions |
| `workflow-engine.test.ts` | Tests for memory_query_session/memory_contribution_id gates | ~30 lines |
| `workflow-engine.test.ts` | Tests for clearsDna on rework transitions | ~15 lines |
| `~/.claude/skills/monitor/SKILL.md` | Update brain section to MANDATORY | Section rewrite |
| `api/src/mcp/brain-mcp.ts` | NEW — complete MCP server wrapping brain API | ~90 lines TypeScript, copy-paste ready |
| `api/src/index.ts` | Add import + startMcpServer() call | 2 lines added |
| `api/package.json` | Add `@modelcontextprotocol/sdk@1.27.1` dependency | `npm install` |
| `/etc/caddy/Caddyfile` | Add `/mcp*` route to port 3201 | ~6 lines, requires thomas user |
| Claude.ai Settings | Thomas adds custom connector | One-time manual setup |

### What Does NOT Change

- Brain API — no changes
- interface-cli.js — `update-dna` already accepts arbitrary JSON fields
- Existing DNA fields — additive only
- `validateDnaRequirements()` function — already handles `requiresDna`, just needs `clearsDna` handling in the transition executor
- Brain API (`api/src/routes/memory.ts`, `api/src/services/thoughtspace.ts`) — no changes

---

## ACT

Design ready. Four deliverables:
1. **Engine changes** (requiresDna additions + clearsDna) → DEV task in xpollination-mcp-server
2. **Monitor skill update** → DEV or PDSA can update SKILL.md
3. **Brain MCP wrapper** → DEV task in best-practices (new MCP server at port 3201, Caddy config)
4. **Claude.ai connector setup** → LIAISON presents to Thomas (add connector URL in Settings)

No open questions. No `requiresDnaOneOf`. Hard gates only.
