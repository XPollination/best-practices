# PDSA: Enforce Memory Usage in Agent Workflow

**Date:** 2026-02-24
**Author:** PDSA Agent
**Task:** memory-workflow-enforcement
**Status:** COMPLETE

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

---

## DO

### Layer A: Agent Workflow Enforcement

#### Three Options Evaluated

**Option 1: Workflow engine hard gate (`requiresDna`)**

How: Add `requiresDna: ['memory_query_id']` to `ready->active` transitions. Add `requiresDna: ['memory_contribution_id']` to completion transitions (`active->approval`, `active->review`).

Pros:
- Impossible to skip — engine blocks transition without the field
- Already proven mechanism (`pdsa_ref` enforcement works)
- Zero agent discipline required

Cons:
- Agents must write brain session IDs to DNA before transitioning — adds a step
- If brain is down, agents are blocked (no fallback)
- Overhead for trivial tasks (typo fix needs brain query?)

**Option 2: Monitor skill soft enforcement (advisory + reminder)**

How: Expand the brain section in SKILL.md. At task claim, skill instructions say "MUST query brain first". At task completion, "MUST contribute findings". No engine gate.

Pros:
- No code changes to workflow engine
- Flexible — agent can skip for trivial tasks
- Brain downtime doesn't block workflow

Cons:
- Relies on agent discipline — if it's not enforced, it WILL be skipped
- Thomas's principle: "If the system does not PREVENT it, it WILL happen" (workflow-engine.js line 4)

**Option 3: DNA template with engine validation**

How: Add `memory_query_session` and `memory_contribution_id` as DNA fields. Engine validates presence on specific transitions. But allow a `memory_skip_reason` field as escape hatch for trivial tasks.

Pros:
- Enforced by engine (hard gate)
- Escape hatch for trivial tasks — agent sets `memory_skip_reason: "typo fix, no domain knowledge involved"`
- Brain downtime: agent sets `memory_skip_reason: "brain API unavailable"`
- Audit trail — DNA shows whether brain was consulted

Cons:
- Slightly more complex than pure hard gate
- Skip reason could be abused (but it's logged, so visible in review)

#### Recommendation: Option 3 — DNA template with engine validation

Rationale: Combines enforcement (Thomas's principle) with pragmatism (trivial tasks, brain downtime). The escape hatch is auditable — reviewers see when brain was skipped and why.

#### Concrete Design

**New DNA fields:**

| Field | Type | When Required | Description |
|-------|------|---------------|-------------|
| `memory_query_session` | string | `ready→active` | Session ID from brain query at task start |
| `memory_contribution_id` | string | Before completion transitions | thought_id of contributed insight |
| `memory_skip_reason` | string | Alternative to above | Why brain was skipped (auditable) |

**Workflow engine changes:**

Add to `ready->active` transitions for task type:
```javascript
'ready->active:pdsa': {
  allowedActors: ['pdsa'],
  requireRole: 'pdsa',
  requiresDnaOneOf: ['memory_query_session', 'memory_skip_reason']
},
```

Add to `active->approval`:
```javascript
'active->approval': {
  allowedActors: ['pdsa'],
  requireRole: 'pdsa',
  requiresDna: ['pdsa_ref'],
  requiresDnaOneOf: ['memory_contribution_id', 'memory_skip_reason']
},
```

**New engine capability: `requiresDnaOneOf`**

The engine currently has `requiresDna` (all fields required). Add `requiresDnaOneOf` — at least ONE of the listed fields must be present. This enables the skip/do pattern:

```javascript
// In validateTransition():
if (rule.requiresDnaOneOf && Array.isArray(rule.requiresDnaOneOf)) {
  const hasAny = rule.requiresDnaOneOf.some(field => dna && dna[field]);
  if (!hasAny) {
    return `Transition requires one of: ${rule.requiresDnaOneOf.join(', ')}`;
  }
}
```

**Agent workflow with enforcement:**

```
1. Agent picks up task (ready state)
2. Before claiming (ready→active):
   a. Query brain: curl POST /api/v1/memory with task topic
   b. Write to DNA: memory_query_session = trace.session_id
   c. OR write: memory_skip_reason = "reason"
3. Claim task: transition ready→active (engine validates DNA)
4. Do the work
5. Before submitting (active→approval or active→review):
   a. Contribute to brain: curl POST /api/v1/memory with key learning
   b. Write to DNA: memory_contribution_id = thought_id from trace
   c. OR write: memory_skip_reason = "reason"
6. Submit: transition (engine validates DNA)
```

**Monitor skill update:**

Update the "Brain Integration" section in SKILL.md to document the MANDATORY workflow:
- Move from "When to use the brain" (advisory) to "MANDATORY brain operations" (enforced)
- Document the DNA fields agents must set
- Show the curl + update-dna pattern

---

### Layer B: Thomas Conversational Access via Claude Web

#### Design

Thomas uses Claude web (claude.ai) to converse with the brain. The GET endpoint (UC1, in progress) enables `web_fetch` from Claude web.

**What Thomas needs:**

1. **Claude web project instruction** — A short system prompt for a Claude web project:

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

2. **Agent identity:**
   - `agent_id`: `thomas` (not `agent-thomas` — he's the human, not an agent)
   - `agent_name`: `Thomas Pichler`

3. **Session pattern:**
   - Generate a UUID at conversation start, reuse throughout
   - Or let the system generate one (omit session_id on first call, use returned `trace.session_id` for subsequent calls)

4. **No additional UX needed:**
   - The GET endpoint + project instruction is sufficient
   - Claude web handles URL encoding automatically via web_fetch
   - Thomas can contribute strategic thoughts that agents then discover
   - His contributions appear as `contributor: "Thomas Pichler"` — distinguishable from agent contributions

---

## STUDY

### Key Architectural Insight

The `requiresDnaOneOf` pattern is the important addition. It enables a **do-or-explain** gate: either do the expected action OR explain why you didn't. This is better than a hard gate (which blocks on brain downtime) and better than advisory (which gets ignored).

This pattern could generalize beyond memory — any "recommended but not always applicable" workflow step could use `requiresDnaOneOf: ['did_thing', 'skip_reason']`.

### What Changes Where

| Component | Change | Scope |
|-----------|--------|-------|
| `workflow-engine.js` | Add `requiresDnaOneOf` validation logic | ~10 lines in `validateTransition()` |
| `workflow-engine.js` | Add `requiresDnaOneOf` to transition rules | 4-6 transition entries updated |
| `workflow-engine.test.ts` | Tests for new `requiresDnaOneOf` | ~20 lines |
| `~/.claude/skills/monitor/SKILL.md` | Update brain section from advisory to mandatory | Section rewrite |
| Claude web project | Create project instruction for Thomas | ~10 lines of text |

### What Does NOT Change

- Brain API — no changes
- interface-cli.js — `update-dna` already accepts arbitrary JSON fields
- Caddy/HTTPS — no changes
- Existing DNA fields — additive only

---

## ACT

Design ready. Two deliverables:
1. Engine changes (requiresDnaOneOf + transition rules) → DEV task
2. Monitor skill update + Claude web instruction → Can be done by LIAISON or PDSA directly

No open questions.
