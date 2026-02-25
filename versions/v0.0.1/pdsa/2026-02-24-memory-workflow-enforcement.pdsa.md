# PDSA: Enforce Memory Usage in Agent Workflow

**Date:** 2026-02-24 (reworked 2026-02-25)
**Author:** PDSA Agent
**Task:** memory-workflow-enforcement
**Status:** REWORK v2 COMPLETE (Layer B: MCP wrapper replaces web_fetch)

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

**REWORKED (v2):** Claude web does NOT have `web_fetch`. It connects to external APIs via MCP connectors (Settings > Connectors). The previous design (raw GET endpoint) does not work. Claude web needs a thin MCP-protocol wrapper around the brain API.

#### Discovery

Claude.ai supports remote MCP servers via Settings > Connectors > Add custom connector. Requirements:
- **Transport:** Streamable HTTP (preferred) or SSE (deprecated soon)
- **Auth:** Authless or OAuth. Authless is sufficient for brain API (already behind Caddy HTTPS)
- **Features:** Tools, prompts, resources. No subscriptions or sampling yet.
- Source: https://support.claude.com/en/articles/11503834-building-custom-connectors-via-remote-mcp-servers

#### Design: Brain MCP Remote Server

A thin MCP server that wraps the brain API. Runs alongside the existing Fastify server.

**Stack:** TypeScript, `@modelcontextprotocol/sdk`, Streamable HTTP transport, Node.js HTTP
**Location:** `best-practices/api/src/mcp/` (alongside existing brain API)
**Port:** 3201 (brain API is 3200)
**URL:** `https://bestpractice.xpollination.earth/mcp` (Caddy routes `/mcp` to port 3201)

**Tools exposed (2):**

| Tool | Parameters | Description |
|------|-----------|-------------|
| `query_brain` | `prompt` (required), `context` (optional), `session_id` (optional) | Query the brain. Returns response + sources + highways. |
| `contribute_to_brain` | `prompt` (required), `context` (optional), `session_id` (optional) | Contribute a thought. Prompt must be >50 chars and declarative. |

Both tools call `POST /api/v1/memory` internally with `agent_id: "thomas"`, `agent_name: "Thomas Pichler"`.

**Implementation (~100 lines):**

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createServer } from "http";
import { z } from "zod";

const server = new McpServer({
  name: "xpollination-brain",
  version: "0.1.0",
});

server.tool("query_brain",
  "Query the shared agent brain for knowledge on a topic",
  { prompt: z.string(), context: z.string().optional(), session_id: z.string().optional() },
  async ({ prompt, context, session_id }) => {
    const res = await fetch("http://localhost:3200/api/v1/memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, agent_id: "thomas", agent_name: "Thomas Pichler", context, session_id }),
    });
    const data = await res.json();
    return { content: [{ type: "text", text: JSON.stringify(data.result, null, 2) }] };
  }
);

server.tool("contribute_to_brain",
  "Contribute a thought to the shared agent brain (>50 chars, declarative)",
  { prompt: z.string().min(51), context: z.string().optional(), session_id: z.string().optional() },
  async ({ prompt, context, session_id }) => {
    const res = await fetch("http://localhost:3200/api/v1/memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, agent_id: "thomas", agent_name: "Thomas Pichler", context, session_id }),
    });
    const data = await res.json();
    return { content: [{ type: "text", text: `Stored. Thought ID: ${data.trace?.thoughts_contributed > 0 ? 'contributed' : 'not stored (too short or interrogative)'}. Response:\n${JSON.stringify(data.result, null, 2)}` }] };
  }
);

// Streamable HTTP transport — exact wiring depends on SDK version
// Use @modelcontextprotocol/sdk StreamableHTTPServerTransport
```

**Caddy config addition:**

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

**Claude.ai connector setup (Thomas does this once):**
1. Go to claude.ai → Settings → Connectors
2. Add custom connector
3. URL: `https://bestpractice.xpollination.earth/mcp`
4. Transport: Streamable HTTP
5. Auth: None

**Claude web project instruction (updated):**

```
You have access to the XPollination shared agent brain via MCP tools.

Use query_brain to ask questions or search knowledge.
Use contribute_to_brain to share strategic insights (>50 chars, declarative statements).

Rules:
- For questions: just ask naturally via query_brain
- For contributions: make declarative statements via contribute_to_brain
- Reuse session_id within a conversation for continuity
- The response includes sources (provenance) and highways (high-traffic knowledge)
```

**Agent identity:** Hardcoded in MCP server: `agent_id: "thomas"`, `agent_name: "Thomas Pichler"`

**Session pattern:** Omit session_id on first call, use returned session_id for subsequent calls in same conversation.

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
| `best-practices/api/src/mcp/` | New MCP remote server wrapping brain API | ~100 lines TypeScript |
| Caddy config | Add `/mcp` route to port 3201 | ~3 lines |
| Claude.ai | Thomas adds custom connector in Settings | One-time manual setup |

### What Does NOT Change

- Brain API — no changes
- interface-cli.js — `update-dna` already accepts arbitrary JSON fields
- Existing DNA fields — additive only
- `validateDnaRequirements()` function — already handles `requiresDna`, just needs `clearsDna` handling in the transition executor

---

## ACT

Design ready. Four deliverables:
1. **Engine changes** (requiresDna additions + clearsDna) → DEV task in xpollination-mcp-server
2. **Monitor skill update** → DEV or PDSA can update SKILL.md
3. **Brain MCP wrapper** → DEV task in best-practices (new MCP server at port 3201, Caddy config)
4. **Claude.ai connector setup** → LIAISON presents to Thomas (add connector URL in Settings)

No open questions. No `requiresDnaOneOf`. Hard gates only.
