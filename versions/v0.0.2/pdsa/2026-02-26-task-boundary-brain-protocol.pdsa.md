# PDSA: Task-Boundary Brain Documentation Protocol

**Slug:** `task-boundary-brain-protocol`
**Date:** 2026-02-26
**Author:** PDSA agent
**Status:** DESIGN (Rework v2 — both phases)

---

## PLAN

### Problem
Agents lose context when they stop mid-task (crash, context compaction, session restart, workflow errors). Current recovery mechanisms have gaps:

| Mechanism | Fires When | Captures | Gap |
|-----------|-----------|----------|-----|
| DNA (PM system) | Agent writes to it | Task findings, status | Not queryable by role across projects; no "in-flight" signal |
| PreCompact hook | Auto-compact triggers | PM state + transcript excerpt | Only fires on compaction, not on crash/restart/error |
| Session handoff | Agent discipline | Whatever agent remembers | Requires discipline, missed on crashes |
| Brain (current) | Agent contributes | Ad-hoc learnings | No structured task lifecycle markers |

**Evidence:** PDSA agent analyzed `cli-create-missing-parent-ids`, wrote findings to DNA, hit a workflow error (role mismatch), and stopped. On resume, brain had NO record of the in-progress work.

### Goal
Every task lifecycle transition creates a brain marker automatically. Two implementation phases:
- **Phase 1:** SKILL.md instructions (immediate value, agent discipline)
- **Phase 2:** Workflow engine enforcement (structural, zero discipline)

### Architectural Decision (Thomas)
Brain markers on transitions are a **first-class engine requirement**, not a bolt-on. Regardless of future technology (Node.js, Rust, etc.), state transitions with side effects is the pattern. Current CLI prototype validates the concept; the design targets the engine layer.

---

## DO

### Phase 1: SKILL.md Protocol Instructions

**Target:** `best-practices/.claude/skills/xpo.claude.monitor/SKILL.md`

#### Brain Marker Format

**TASK START** (after claiming/reclaiming):
```
TASK START: {ROLE} claiming {slug} ({project}) — {DNA title or brief context}
```

**TASK TRANSITION** (on any forward transition):
```
TASK {from→to}: {ROLE} {slug} ({project}) — {outcome summary, max 1 sentence}
```

**TASK BLOCKED** (on error/stop/inability to proceed):
```
TASK BLOCKED: {ROLE} {slug} ({project}) — {what blocked, what was done so far}
```

#### SKILL.md Changes

1. **Step 2** — Add Query 3 (in-flight task recovery):
```bash
# Query 3: In-flight tasks from previous sessions
curl -s -X POST http://localhost:3200/api/v1/memory \
  -H "Content-Type: application/json" \
  -d "{\"prompt\": \"TASK START or TASK BLOCKED markers for $ARGUMENTS agent. What tasks were in-flight?\", \"agent_id\": \"agent-$ARGUMENTS\", \"agent_name\": \"$(echo $ARGUMENTS | tr a-z A-Z)\", \"session_id\": \"$SESSION_ID\"}"
```

2. **Step 4** — Split into 4a (claim) + 4b (TASK START marker)
3. **Step 7** — Split into 7a (transition) + 7b (TASK TRANSITION marker) + 7c (TASK BLOCKED on error)

### Phase 2: Workflow Engine Enforcement

**Target:** `xpollination-mcp-server/src/db/interface-cli.js` (prototype) → eventually engine layer

#### Design: Transition Side Effect

After every successful transition in `cmdTransition()` (line ~312, after DB update, before output), emit a brain marker:

```javascript
// === BRAIN MARKER (after successful transition, before output) ===
// Non-blocking: brain failure must NOT block transitions
const project = guessProject(process.env.DATABASE_PATH);
const markerType = fromStatus === 'blocked' ? 'UNBLOCKED' :
                   newStatus === 'blocked' ? 'BLOCKED' :
                   `${fromStatus}→${newStatus}`;
const brainPayload = JSON.stringify({
  prompt: `TASK ${markerType}: ${actor.toUpperCase()} ${node.slug} (${project}) — transition by ${actor}`,
  agent_id: `agent-${actor}`,
  agent_name: actor.toUpperCase(),
  context: `task: ${node.slug}`
});

// Fire-and-forget HTTP POST (3s timeout, ignore errors)
try {
  const { request } = await import('http');
  const req = request('http://localhost:3200/api/v1/memory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    timeout: 3000
  });
  req.on('error', () => {}); // Ignore brain errors
  req.write(brainPayload);
  req.end();
} catch (e) { /* brain down — proceed silently */ }
```

#### Key Design Constraints

1. **Non-blocking:** Brain API failure must NOT prevent transitions. Use fire-and-forget with 3s timeout.
2. **No new dependencies:** Use Node.js built-in `http` module, not fetch or axios.
3. **Project detection:** Derive project name from `DATABASE_PATH` env var (map known paths).
4. **Actor = contributor:** The actor performing the transition is the brain contributor.
5. **Marker content:** `TASK {transition}: {ACTOR} {slug} ({project}) — transition by {actor}`. Agents can enrich via SKILL.md protocol (which adds DNA context).

#### Complementary Design

Phase 1 (SKILL.md) and Phase 2 (engine) are **complementary, not redundant**:
- Phase 2 guarantees a marker exists for EVERY transition (structural)
- Phase 1 enriches markers with DNA context and human-readable summaries (quality)
- An agent following SKILL.md produces richer markers; the engine provides the safety net

### Implementation Scope

**Phase 1 (this task):**
- Modify: `best-practices/.claude/skills/xpo.claude.monitor/SKILL.md`

**Phase 2 (this task):**
- Modify: `xpollination-mcp-server/src/db/interface-cli.js` (`cmdTransition()` function)
- Add: `guessProject()` helper function (map DATABASE_PATH to project name)

### Files to Create/Modify

| File | Phase | Action | Description |
|------|-------|--------|-------------|
| `best-practices/.claude/skills/xpo.claude.monitor/SKILL.md` | 1 | EDIT | Add recovery query, task markers to steps 4+7 |
| `xpollination-mcp-server/src/db/interface-cli.js` | 2 | EDIT | Add brain marker side effect to cmdTransition() |

### Acceptance Criteria (Updated)

| AC | Phase | How Met |
|----|-------|---------|
| Protocol defined: brain marker format | 1 | 3 marker types documented in SKILL.md |
| All roles follow protocol | 1 | Integrated into SKILL.md which all roles use |
| Contributions include role, slug, context | 1+2 | Format includes all fields |
| Protocol integrated into SKILL.md | 1 | Steps 4b, 7b, 7c, recovery query 3 |
| Recovery query returns transition markers | 1+2 | Recovery query pattern + engine markers |
| Cost per marker < 500ms | 2 | Fire-and-forget with 3s timeout cap |
| Workflow engine spec: transitions emit markers | 2 | cmdTransition() side effect code |
| Prototype in current CLI | 2 | interface-cli.js implementation |
| Design is technology-agnostic | 2 | Pattern documented: "every transition emits brain marker" |

### Cost Analysis

- Phase 1: 2-3 markers per task at ~400ms each (agent curl calls)
- Phase 2: 1 marker per transition, fire-and-forget (~50ms agent-side, brain processes async)
- Phase 2 replaces some Phase 1 markers (the basic transition record) but Phase 1 adds richer context
- Brain deduplication handles overlapping markers

---

## STUDY

*To be completed after implementation review.*

## ACT

*To be completed after study phase.*
