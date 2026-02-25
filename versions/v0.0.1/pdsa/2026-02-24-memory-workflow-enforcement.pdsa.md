# PDSA: Enforce Memory Usage in Agent Workflow

**Date:** 2026-02-24 (reworked 2026-02-25)
**Author:** PDSA Agent
**Task:** memory-workflow-enforcement
**Status:** REWORK COMPLETE

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

**Approved as-is from original PDSA.** No changes needed.

#### Design

Thomas uses Claude web (claude.ai) to converse with the brain. The GET endpoint (UC1) enables `web_fetch` from Claude web.

**Claude web project instruction:**

```
You have access to the XPollination shared agent brain.

To query or contribute: use web_fetch with this URL pattern:
https://bestpractice.xpollination.earth/api/v1/memory?prompt={URL_ENCODED_PROMPT}&agent_id=thomas&agent_name=Thomas%20Pichler

Optional params: &context={CONTEXT}&session_id={SESSION_ID}

Rules:
- For questions: just ask naturally
- For contributions: make declarative statements >50 chars (these get stored)
- Reuse session_id within a conversation for continuity
- Parse result.response for the answer, result.sources for provenance
- Parse result.highways_nearby for high-traffic knowledge paths
```

**Agent identity:** `agent_id`: `thomas`, `agent_name`: `Thomas Pichler`

**Session pattern:** Generate UUID at conversation start, reuse throughout. Or omit session_id on first call, use returned `trace.session_id` for subsequent calls.

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
| Claude web project | Create project instruction for Thomas | ~10 lines of text |

### What Does NOT Change

- Brain API — no changes
- interface-cli.js — `update-dna` already accepts arbitrary JSON fields
- Caddy/HTTPS — no changes
- Existing DNA fields — additive only
- `validateDnaRequirements()` function — already handles `requiresDna`, just needs `clearsDna` handling in the transition executor

---

## ACT

Design ready. Three deliverables:
1. **Engine changes** (requiresDna additions + clearsDna) → DEV task in xpollination-mcp-server
2. **Monitor skill update** → DEV or PDSA can update SKILL.md
3. **Claude web project instruction** → LIAISON presents to Thomas for setup

No open questions. No `requiresDnaOneOf`. Hard gates only.
