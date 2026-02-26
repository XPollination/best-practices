# PDSA: Task-Boundary Brain Documentation Protocol

**Slug:** `task-boundary-brain-protocol`
**Date:** 2026-02-26
**Author:** PDSA agent
**Status:** DESIGN (Rework v5 — blocked as PAUSE+RESUME, WORKFLOW.md update)

---

## PLAN

### Problem
Agents lose context when they stop mid-task. Brain documentation at task lifecycle boundaries provides recovery. When brain is unavailable, transitions must fail — but what happens to the task? It must be PAUSED (blocked), not reworked.

### Goal
1. Brain-gated transitions with task-boundary markers
2. Blocked state as PAUSE+RESUME meta-state (not rework)
3. WORKFLOW.md updated as source of truth

### Architectural Decisions (Thomas)
- Brain = transaction integrity. No brain = no action.
- Blocked = PAUSE. Must restore EXACT previous state+role on unblock.
- `blocked→active` is WRONG. `review+pdsa→blocked→review+pdsa` is correct.
- DNA stores `blocked_from_state` and `blocked_from_role` for restoration.

---

## DO

### Phase 1: SKILL.md Protocol Instructions

**Target:** `best-practices/.claude/skills/xpo.claude.monitor/SKILL.md`

#### Brain Marker Format

```
TASK START: {ROLE} claiming {slug} ({project}) — {DNA title}
TASK {from→to}: {ROLE} {slug} ({project}) — {outcome, 1 sentence}
TASK BLOCKED: {ROLE} {slug} ({project}) — {blocker description}
```

#### SKILL.md Changes
1. **Step 2** — Add Query 3 (in-flight task recovery)
2. **Step 4** — Split into 4a (claim) + 4b (TASK START marker)
3. **Step 7** — Split into 7a (transition) + 7b (TASK TRANSITION marker) + 7c (TASK BLOCKED on error)

### Phase 2: Workflow Engine — Brain as Hard Quality Gate

**Target:** `xpollination-mcp-server/src/db/interface-cli.js`

#### Design: Brain-Gated Transitions

```javascript
// STEP 1: Health-check brain BEFORE any DB changes
const brainHealthy = await checkBrainHealth(); // GET /api/v1/health, 3s timeout
if (!brainHealthy) {
  error('Brain unavailable — cannot document transition. Wait or escalate.');
}

// STEP 2: Execute DB transition (existing logic)
// ... existing db.prepare().run() ...

// STEP 3: Contribute brain marker (synchronous, mandatory)
const project = guessProject(process.env.DATABASE_PATH);
await contributeToBrain({
  prompt: `TASK ${fromStatus}→${newStatus}: ${actor.toUpperCase()} ${node.slug} (${project})`,
  agent_id: `agent-${actor}`,
  agent_name: actor.toUpperCase(),
  context: `task: ${node.slug}`
}); // POST /api/v1/memory, 5s timeout
```

### Phase 3: Blocked State — PAUSE+RESUME Meta-State

#### 3a: Blocked State Semantics

Blocked is fundamentally different from rework:
- **Rework** = "redo your work, something is wrong with it" → re-enters at known point
- **Blocked** = "infrastructure failed, PAUSE exactly where you are" → resumes at exact same point

Examples of correct blocked behavior:
```
review+pdsa → blocked → review+pdsa     (PDSA continues reviewing)
active+dev  → blocked → active+dev      (DEV continues implementing)
testing+qa  → blocked → testing+qa      (QA continues testing)
approval+liaison → blocked → approval+liaison  (Thomas continues deciding)
```

#### 3b: DNA Storage for Blocked State

When transitioning to blocked, store the exact state to restore:

```javascript
// In cmdTransition(), when newStatus === 'blocked':
updatedDna.blocked_from_state = fromStatus;
updatedDna.blocked_from_role = currentRole;
updatedDna.blocked_reason = dna.blocked_reason || 'unspecified';
updatedDna.blocked_at = new Date().toISOString();
```

When unblocking (restoring):
```javascript
// In cmdTransition(), when fromStatus === 'blocked':
const restoreState = dna.blocked_from_state;
const restoreRole = dna.blocked_from_role;
// Override newStatus with restoreState
// Override role with restoreRole
// Clear blocked_* fields from DNA
```

#### 3c: Workflow Engine Changes

**workflow-engine.js additions:**

For BOTH task and bug types:
```javascript
// Any agent can block (infrastructure failure)
'any->blocked': {
  allowedActors: ['liaison', 'system', 'pdsa', 'dev', 'qa'],
  // No newRole — role is stored in blocked_from_role
  requiresDna: ['blocked_reason']
},

// Only liaison/system can unblock (after infra fix)
// Special: restores previous state+role from DNA
'blocked->restore': {
  allowedActors: ['liaison', 'system'],
  clearsDna: ['blocked_from_state', 'blocked_from_role', 'blocked_reason', 'blocked_at']
}
```

**Implementation detail:** `blocked->restore` is a special transition. The CLI reads `dna.blocked_from_state` and `dna.blocked_from_role`, then:
1. Sets status to `blocked_from_state` (not "restore")
2. Sets role to `blocked_from_role`
3. Clears `blocked_*` fields from DNA

The actual DB update becomes:
```sql
UPDATE mindspace_nodes SET status = ?, dna_json = ? WHERE id = ?
-- status = blocked_from_state (e.g., 'review')
-- dna_json = merged DNA with role restored and blocked_* cleared
```

#### 3d: Escalation Chain (Brain Down)

```
Brain health-check fails
  → cmdTransition() error: "Brain unavailable"
  → Agent sets DNA: { blocked_reason: "Brain API unavailable", ... }
  → Agent transitions: any → blocked (stores from_state + from_role)
  → Monitor surfaces blocked task with reason
  → LIAISON sees blocked task, presents to Thomas
  → Thomas fixes brain infrastructure
  → LIAISON transitions: blocked → restore (restores exact previous state+role)
  → Agent resumes exactly where it was
```

#### 3e: Visualization Fix

**Current state:** Blocked box exists (Y:760, red #dc2626) but missing from legend.

**Changes to viz/index.html:**
1. Add `Blocked` to legend (red #dc2626)
2. Verify blocked tasks render in their box (renderBlocked() exists)

#### 3f: WORKFLOW.md Update (Source of Truth)

**File:** `xpollination-mcp-server/versions/v0.0.1/docs/Knowledge Management (Single Source of Truth, keep up2date!)/WORKFLOW.md`

**Version:** v12 → v13

**New section (after Liaison Content Path, before Visualization Categories):**

```markdown
### Blocked State (Meta-State)

Blocked is a PAUSE, not a rework. Tasks resume at the EXACT previous state+role.

**Entry:** Any non-terminal state → blocked
- **Who can block:** Any agent (pdsa, dev, qa, liaison, system)
- **When:** Infrastructure failure (brain down, DB locked), external dependency unavailable
- **Requires:** `blocked_reason` in DNA explaining the blocker
- **Stores:** `blocked_from_state` (previous status) and `blocked_from_role` (previous role)

**Exit:** blocked → restore (returns to exact previous state+role)
- **Who can unblock:** liaison, system only (after infrastructure fix)
- **How:** Reads `blocked_from_state` and `blocked_from_role` from DNA, restores both
- **Clears:** `blocked_from_state`, `blocked_from_role`, `blocked_reason`, `blocked_at`

**Examples:**
| Before Block | Blocked | After Unblock |
|-------------|---------|---------------|
| review+pdsa | blocked (from_state=review, from_role=pdsa) | review+pdsa |
| active+dev | blocked (from_state=active, from_role=dev) | active+dev |
| testing+qa | blocked (from_state=testing, from_role=qa) | testing+qa |
| approval+liaison | blocked (from_state=approval, from_role=liaison) | approval+liaison |

**Key difference from rework:**
- Rework = "your work needs fixing" → re-enters workflow at defined entry point
- Blocked = "external failure, pause here" → resumes at exact same point
```

### Implementation Scope

| File | Phase | Action | Description |
|------|-------|--------|-------------|
| `best-practices/.claude/skills/xpo.claude.monitor/SKILL.md` | 1 | EDIT | Task markers in steps 4+7, recovery query 3 |
| `xpollination-mcp-server/src/db/interface-cli.js` | 2+3 | EDIT | Brain gate + blocked PAUSE/RESUME logic |
| `xpollination-mcp-server/src/db/workflow-engine.js` | 3c | EDIT | any->blocked (all agents) + blocked->restore |
| `xpollination-mcp-server/viz/index.html` | 3e | EDIT | Blocked in legend |
| `xpollination-mcp-server/docs/.../WORKFLOW.md` | 3f | EDIT | v13: Blocked State section |

### Acceptance Criteria (v5 — complete)

| AC | Phase | How Met |
|----|-------|---------|
| Brain markers at task boundaries | 1 | SKILL.md steps 4b, 7b, 7c |
| Brain gates transitions | 2 | Health check + synchronous contribution |
| Blocked stores previous state+role | 3b | DNA: blocked_from_state, blocked_from_role |
| Blocked→restore returns exact state+role | 3c | blocked->restore reads DNA, restores both |
| Any agent can block | 3c | any->blocked allows all agents |
| Only liaison/system unblocks | 3c | blocked->restore liaison/system only |
| Escalation chain defined | 3d | Brain down → blocked → LIAISON → Thomas → restore |
| Viz shows blocked in legend | 3e | Legend entry with red #dc2626 |
| WORKFLOW.md updated to v13 | 3f | New Blocked State section |

---

## STUDY

*To be completed after implementation review.*

## ACT

*To be completed after study phase.*
