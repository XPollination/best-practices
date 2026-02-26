# PDSA: Task-Boundary Brain Documentation Protocol

**Slug:** `task-boundary-brain-protocol`
**Date:** 2026-02-26
**Author:** PDSA agent
**Status:** DESIGN (Rework v3 — brain as hard quality gate)

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

### Architectural Decision (Thomas, v3)
Brain documentation is **transaction integrity**, not a side effect. No brain = no action. If brain is unavailable, transitions MUST FAIL — acting without documenting creates amnesia disguised as availability. Like financial systems: the audit trail IS the transaction integrity. The workflow engine health-checks brain BEFORE executing any transition. Brain down = transition blocked + error surfaced.

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
  // Brain accepted health check but rejected contribution
  // Log warning but don't rollback — health was confirmed
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
  // Synchronous HTTP GET to localhost:3200/api/v1/health
  // Returns true if status 200 within 3s, false otherwise
  // Uses Node.js built-in http module
}

async function contributeToBrain(payload) {
  // Synchronous HTTP POST to localhost:3200/api/v1/memory
  // Returns true if status 200 within 5s, false otherwise
  // Uses Node.js built-in http module
}
```

#### Key Design Constraints (v3 — corrected)

1. **Brain is mandatory:** Brain health-check BEFORE transition. Brain down = transition blocked with clear error.
2. **Synchronous:** Brain contribution is part of the transaction, not fire-and-forget.
3. **Timeout:** Health check 3s, contribution 5s. Reasonable for localhost API.
4. **No rollback on contribution failure:** If health check passes but contribution fails, log warning but keep the DB transition. The health check is the gate; contribution failure after health-check is a transient issue.
5. **No new dependencies:** Node.js built-in `http` module only.
6. **Project detection:** `guessProject()` maps DATABASE_PATH to project name.

#### Complementary Design (unchanged)

Phase 1 (SKILL.md) and Phase 2 (engine) are **complementary, not redundant**:
- Phase 2 guarantees a marker exists for EVERY transition (structural gate)
- Phase 1 enriches markers with DNA context and human-readable summaries (quality)
- Engine marker is the audit trail; SKILL.md marker is the human-readable journal

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

### Acceptance Criteria (v3 — hard gate)

| AC | Phase | How Met |
|----|-------|---------|
| Protocol defined: brain marker format | 1 | 3 marker types documented in SKILL.md |
| All roles follow protocol | 1 | Integrated into SKILL.md which all roles use |
| Contributions include role, slug, context | 1+2 | Format includes all fields |
| Protocol integrated into SKILL.md | 1 | Steps 4b, 7b, 7c, recovery query 3 |
| Recovery query returns transition markers | 1+2 | Recovery query pattern + engine markers |
| Brain health-check gates transitions | 2 | Health check BEFORE DB update; brain down = error |
| Brain contribution is synchronous | 2 | POST to brain after DB update, 5s timeout |
| Transition fails if brain unavailable | 2 | Clear error: "Brain unavailable" |
| Prototype in current CLI | 2 | interface-cli.js cmdTransition() implementation |
| Design is technology-agnostic | 2 | Pattern: "brain = transaction integrity" |

### Cost Analysis

- Phase 1: 2-3 rich markers per task at ~400ms each (agent curl calls with DNA context)
- Phase 2: 1 structural marker per transition (~200-500ms synchronous, health check + contribution)
- Total per transition: ~500ms for brain gate (3s health + 5s contribution timeouts are caps, not typical)
- Brain downtime blocks all transitions — this is intentional (audit trail integrity)
- Brain deduplication handles overlapping markers from Phase 1 + Phase 2

---

## STUDY

*To be completed after implementation review.*

## ACT

*To be completed after study phase.*
