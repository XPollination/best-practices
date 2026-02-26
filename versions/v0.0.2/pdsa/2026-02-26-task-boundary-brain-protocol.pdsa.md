# PDSA: Task-Boundary Brain Documentation Protocol

**Slug:** `task-boundary-brain-protocol`
**Date:** 2026-02-26
**Author:** PDSA agent
**Status:** DESIGN (Rework v4 — escalation path + viz + workflow recovery)

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
Every task lifecycle transition creates a brain marker automatically. Three implementation phases:
- **Phase 1:** SKILL.md instructions (immediate value, agent discipline)
- **Phase 2:** Workflow engine enforcement (structural, zero discipline)
- **Phase 3:** Escalation path, viz fix, workflow recovery for blocked state

### Architectural Decision (Thomas, v3)
Brain documentation is **transaction integrity**, not a side effect. No brain = no action. If brain is unavailable, transitions MUST FAIL — acting without documenting creates amnesia disguised as availability. Like financial systems: the audit trail IS the transaction integrity.

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

### Phase 2: Workflow Engine — Brain as Hard Quality Gate

**Target:** `xpollination-mcp-server/src/db/interface-cli.js` (prototype) → eventually engine layer

#### Design: Brain-Gated Transitions

Every transition is a two-phase commit: (1) health-check brain, (2) execute DB update + brain contribution as atomic unit. Brain failure at any stage = transition rejected.

**Execution flow in `cmdTransition()`:**

```javascript
// === PHASE 2: Brain-gated transition ===

// STEP 1: Health-check brain BEFORE any DB changes
const brainHealthy = await checkBrainHealth(); // GET /api/v1/health, 3s timeout
if (!brainHealthy) {
  error('Brain unavailable — cannot document transition. Wait or escalate.');
}

// STEP 2: Execute DB transition (existing logic, lines 298-311)
// ... existing db.prepare().run() ...

// STEP 3: Contribute brain marker (synchronous, mandatory)
const project = guessProject(process.env.DATABASE_PATH);
const markerType = `${fromStatus}→${newStatus}`;
const contributed = await contributeToBrain({
  prompt: `TASK ${markerType}: ${actor.toUpperCase()} ${node.slug} (${project}) — transition by ${actor}`,
  agent_id: `agent-${actor}`,
  agent_name: actor.toUpperCase(),
  context: `task: ${node.slug}`
}); // POST /api/v1/memory, 5s timeout

if (!contributed) {
  console.error(`Warning: Brain marker failed for ${node.slug} ${markerType}`);
}
```

**Helper functions:**

```javascript
function guessProject(dbPath) {
  if (!dbPath) return 'unknown';
  const match = dbPath.match(/PichlerThomas\/([^/]+)\//);
  return match ? match[1] : 'unknown';
}

async function checkBrainHealth() {
  // HTTP GET to localhost:3200/api/v1/health
  // Returns true if status 200 within 3s, false otherwise
  // Uses Node.js built-in http module
}

async function contributeToBrain(payload) {
  // HTTP POST to localhost:3200/api/v1/memory
  // Returns true if status 200 within 5s, false otherwise
  // Uses Node.js built-in http module
}
```

#### Key Design Constraints

1. **Brain is mandatory:** Health-check BEFORE transition. Brain down = error.
2. **Synchronous:** Brain contribution is part of the transaction.
3. **Timeout:** Health check 3s, contribution 5s.
4. **No rollback on contribution failure:** If health passes but contribution fails, log warning. Health check is the gate.
5. **No new dependencies:** Node.js built-in `http` module only.

### Phase 3: Escalation Path, Viz, Workflow Recovery

#### 3a: Brain-Down Escalation Path

When brain gate blocks a transition, agents must follow this escalation chain:

```
Brain health-check fails
  → cmdTransition() returns error: "Brain unavailable — cannot document transition"
  → Agent writes blocker to DNA: update-dna <slug> '{"brain_blocker":"Brain API down at <timestamp>"}' <actor>
  → Agent transitions to blocked: transition <slug> blocked <actor>  ← WRONG: only liaison/system can block
```

**Issue discovered:** `any->blocked` requires `allowedActors: ['liaison', 'system']`. Agents (pdsa, dev, qa) CANNOT transition to blocked directly. The escalation needs a different approach:

**Revised escalation:**
```
Brain health-check fails
  → cmdTransition() returns error: "Brain unavailable"
  → Agent writes blocker to DNA: update-dna <slug> '{"brain_blocker":"Brain API down at <timestamp>","brain_blocker_status":"waiting"}' <actor>
  → Agent logs to /tmp/brain-outage.log: "<timestamp> <slug> <actor> brain unavailable"
  → Agent waits 30s, retries transition (brain may recover quickly)
  → If still down after 3 retries (90s): agent moves to next task or goes idle
  → Monitor surfaces brain_blocker in DNA → LIAISON escalates to Thomas
  → Thomas fixes infrastructure → agent retries transition
```

**Alternative (preferred):** Add agent actors to `any->blocked`:
```javascript
'any->blocked': { allowedActors: ['liaison', 'system', 'pdsa', 'dev', 'qa'] }
```
This allows any agent to self-block when infrastructure fails. LIAISON/system unblock.

#### 3b: Blocked State Recovery Transitions

**Current state:** No `blocked->active` or `blocked->ready` transitions exist. Blocked is effectively terminal.

**Add to workflow-engine.js:**

For task type:
```javascript
'blocked->ready': { allowedActors: ['liaison', 'system'], clearsDna: ['brain_blocker'] },
'blocked->active': { allowedActors: ['liaison', 'system'], clearsDna: ['brain_blocker'] }
```

For bug type:
```javascript
'blocked->ready': { allowedActors: ['liaison', 'system'], clearsDna: ['brain_blocker'] },
'blocked->active': { allowedActors: ['liaison', 'system'], clearsDna: ['brain_blocker'] }
```

**Recovery flow:**
1. Thomas fixes brain infrastructure
2. LIAISON transitions `blocked→ready` or `blocked→active` (restoring previous state)
3. `clearsDna: ['brain_blocker']` removes the blocker marker
4. Task resumes normal flow

#### 3c: Visualization Fix for Blocked State

**Current state analysis:**
- Blocked box EXISTS at Y:760 with red styling (`fill: #dc2626`, `stroke: #ef4444`)
- Blocked and cancelled share a section: `renderBlocked()` renders both
- **Missing from legend** (lines 575-582): Legend only shows Pending, Ready, Active, Review, Done

**Fix needed:**
1. Add `Blocked` to legend with red color (#dc2626)
2. Verify blocked tasks render correctly in their box (may already work since renderBlocked exists)
3. Consider if blocked should appear as a separate section from cancelled (different semantics: blocked = recoverable, cancelled = terminal)

**Viz changes (index.html):**
- Add to legend: `{ label: 'Blocked', color: '#dc2626' }` (alongside existing entries)
- Optionally split `renderBlocked()` into separate blocked and cancelled sections for visual clarity

#### 3d: WORKFLOW.md Updates

Add to WORKFLOW.md:

```markdown
### Blocked State

Tasks can be blocked from any status when infrastructure is unavailable (e.g., brain API down).

**Entry:** `any → blocked` (liaison, system, or any agent with brain-down escalation)
**Exit:** `blocked → ready` or `blocked → active` (liaison, system only)
**Recovery:** Thomas fixes infrastructure, LIAISON unblocks, task resumes.

Brain-down escalation: When brain health-check fails during transition, agent transitions to blocked with `brain_blocker` in DNA. Monitor surfaces blocked tasks. LIAISON escalates to Thomas.
```

### Implementation Scope (All Phases)

| File | Phase | Action | Description |
|------|-------|--------|-------------|
| `best-practices/.claude/skills/xpo.claude.monitor/SKILL.md` | 1 | EDIT | Add recovery query, task markers to steps 4+7 |
| `xpollination-mcp-server/src/db/interface-cli.js` | 2 | EDIT | Add brain gate to cmdTransition() |
| `xpollination-mcp-server/src/db/workflow-engine.js` | 3a+3b | EDIT | Add agents to any->blocked actors, add blocked->ready/active recovery |
| `xpollination-mcp-server/viz/index.html` | 3c | EDIT | Add Blocked to legend |
| `xpollination-mcp-server/docs/WORKFLOW.md` | 3d | EDIT | Document blocked state, recovery, brain-down escalation |

### Acceptance Criteria (v4 — complete)

| AC | Phase | How Met |
|----|-------|---------|
| Protocol defined: brain marker format | 1 | 3 marker types in SKILL.md |
| All roles follow protocol | 1 | Integrated into SKILL.md |
| Protocol integrated into SKILL.md | 1 | Steps 4b, 7b, 7c, recovery query 3 |
| Brain health-check gates transitions | 2 | Health check BEFORE DB update |
| Brain contribution is synchronous | 2 | POST after DB update, 5s timeout |
| Transition fails if brain unavailable | 2 | Error: "Brain unavailable" |
| Escalation path defined | 3a | Agent → blocked → monitor → LIAISON → Thomas |
| Blocked→active recovery exists | 3b | blocked->ready and blocked->active transitions |
| Blocked state visible in viz | 3c | Legend entry + verified rendering |
| WORKFLOW.md documents blocked state | 3d | Blocked section with entry/exit/recovery |

### Cost Analysis

- Phase 1: 2-3 rich markers per task at ~400ms each
- Phase 2: ~200-500ms per transition (health check + contribution)
- Brain downtime blocks transitions → agent self-blocks → LIAISON escalates
- Recovery: Thomas fixes infra → LIAISON unblocks → agent resumes

---

## STUDY

*To be completed after implementation review.*

## ACT

*To be completed after study phase.*
