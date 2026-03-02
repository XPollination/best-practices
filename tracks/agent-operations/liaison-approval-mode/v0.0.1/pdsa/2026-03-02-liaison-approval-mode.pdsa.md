# PDSA: LIAISON Approval Mode (Auto vs Manual)

**Date:** 2026-03-02
**Task:** liaison-approval-mode
**Status:** PLAN

## Plan

### Problem
LIAISON agent autonomously approved 4 PDSA designs without presenting to Thomas (2026-03-02 incident, repeat of 2026-02-25). WORKFLOW.md states LIAISON must present to human for approval decisions, but there is no enforcement mechanism — LIAISON can execute `approval->approved`, `review->complete`, etc. freely.

### Design: Global Toggle with Workflow Engine Enforcement

#### Storage: `system_settings` table
**File:** `xpollination-mcp-server/src/db/schema.sql`

New table for global persistent settings:
```sql
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

Initial row: `('liaison_approval_mode', 'manual', 'system', CURRENT_TIMESTAMP)`

**Why a table, not per-task DNA:** The requirement is GLOBAL — one switch controls ALL LIAISON approval transitions. Per-task DNA would require setting the flag on every new task. A global setting is set once, applies everywhere, and survives agent restarts/compacts/clears.

#### Human-Decision Transitions (the ones gated by this toggle)
From workflow-engine.js:
- `approval->approved` (line 51) — LIAISON approves PDSA design
- `approval->rework` (line 53) — LIAISON rejects design
- `review->complete` (line 79) — LIAISON finalizes task
- `review->rework:liaison` (line 82) — LIAISON rejects final result
- `complete->rework` (line 88) — LIAISON reopens task

#### Change 1: Schema migration
**File:** `xpollination-mcp-server/src/db/schema.sql`

Add `system_settings` table. Also add migration in interface-cli.js startup to create table if not exists (same pattern as existing schema migrations).

#### Change 2: Workflow engine — `requiresHumanConfirm` flag
**File:** `xpollination-mcp-server/src/db/workflow-engine.js`

Add `requiresHumanConfirm: true` to each human-decision transition:
```javascript
'approval->approved': {
  allowedActors: ['liaison', 'thomas'],
  newRole: 'qa',
  requiresHumanConfirm: true  // NEW
},
```

Export new function `getHumanConfirmTransitions()` returning list of transition keys with this flag — used by viz to know which transitions need gating.

#### Change 3: Interface CLI — mode enforcement gate
**File:** `xpollination-mcp-server/src/db/interface-cli.js`

In `cmdTransition()`, after standard validation (line ~462), add:

```javascript
// Check LIAISON approval mode for human-decision transitions
const transitionKey = `${fromStatus}->${newStatus}`;
const rule = ALLOWED_TRANSITIONS[nodeType]?.[transitionKey] || /* role-specific lookup */;

if (rule?.requiresHumanConfirm && actor === 'liaison') {
  const mode = db.prepare("SELECT value FROM system_settings WHERE key = 'liaison_approval_mode'").get();
  if (!mode || mode.value === 'manual') {
    // Manual mode: require human_confirmed in DNA
    if (!currentDna.human_confirmed) {
      db.close();
      error(`LIAISON manual mode active. Set dna.human_confirmed=true via mindspace viz before executing ${transitionKey}`);
    }
    // Clear human_confirmed after use (one-time confirmation)
    // DNA update handled in transition mutation step
  }
  // Auto mode: liaison proceeds freely, but must document reasoning
  if (mode?.value === 'auto' && !currentDna.liaison_reasoning) {
    db.close();
    error(`LIAISON auto mode: dna.liaison_reasoning required for ${transitionKey}`);
  }
}
```

**Protection against agent gaming:** The `human_confirmed` field in DNA is set via the viz UI (human clicks "confirm"), NOT via `update-dna` CLI. Add validation in `cmdUpdateDna()` to reject `human_confirmed` field when actor is `liaison`:
```javascript
if (actor === 'liaison' && dnaUpdate.human_confirmed !== undefined) {
  error('human_confirmed can only be set via mindspace viz (human action)');
}
```

#### Change 4: Viz server — settings API
**File:** `xpollination-mcp-server/viz/server.js`

New API endpoints:

```
GET  /api/settings/liaison-approval-mode
     → { mode: "manual"|"auto", updated_by: "thomas", updated_at: "..." }

PUT  /api/settings/liaison-approval-mode
     Body: { mode: "manual"|"auto" }
     → Updates system_settings table, returns new value
     → Always sets updated_by to "thomas" (viz = human)

PUT  /api/node/:slug/confirm
     Body: { project: "best-practices" }
     → Sets human_confirmed=true in task DNA
     → Only works for nodes in approval or review+liaison state
     → Returns updated node
```

These endpoints are human-only (viz server = human interface). Agents don't have access to the viz API.

#### Change 5: Viz UI — global mode toggle + per-task confirm button
**File:** `xpollination-mcp-server/viz/index.html`

**A. Global toggle in header controls area (near project dropdown):**
```html
<div class="approval-mode-control">
  <label>LIAISON Mode:</label>
  <select id="liaison-mode">
    <option value="manual">Manual (require confirmation)</option>
    <option value="auto">Auto (LIAISON decides)</option>
  </select>
</div>
```

On change: `PUT /api/settings/liaison-approval-mode`
On load: `GET /api/settings/liaison-approval-mode` to set initial value

**B. Per-task confirm button in detail panel (shown when node is at approval/review+liaison and mode=manual):**
```html
<button class="confirm-btn" onclick="confirmTask('${node.slug}')">
  ✓ Confirm (approve for LIAISON)
</button>
```

On click: `PUT /api/node/${slug}/confirm` → sets `human_confirmed=true` in DNA

#### Change 6: Viz server — confirm endpoint reads project DB
The viz server already discovers project databases. The confirm endpoint opens the target project DB in write mode and updates `dna_json` directly (adding `human_confirmed: true`).

### Edge Cases

**Mode changes mid-pipeline:** If Thomas switches from auto→manual while LIAISON has already approved some tasks, those approvals stand. Only future transitions are affected. No rollback.

**Thomas acting as actor:** When actor is `thomas` (not `liaison`), the gate is bypassed. Thomas can always execute transitions directly. The `allowedActors` already includes `'thomas'`.

**`human_confirmed` cleanup:** After successful transition, the `human_confirmed` field is cleared from DNA (in the transition's `clearsDna` array or post-transition mutation) so it doesn't carry forward.

### Files Modified
| File | Repo | Change |
|------|------|--------|
| `src/db/schema.sql` | xpollination-mcp-server | Add system_settings table |
| `src/db/workflow-engine.js` | xpollination-mcp-server | Add requiresHumanConfirm flag, export helper |
| `src/db/interface-cli.js` | xpollination-mcp-server | Mode enforcement gate + human_confirmed protection |
| `viz/server.js` | xpollination-mcp-server | Settings API + confirm endpoint |
| `viz/index.html` | xpollination-mcp-server | Global toggle + per-task confirm button |

### NOT Changed
- Brain API (no scoring/retrieval impact)
- Agent monitor scripts
- PDSA/DEV/QA transition logic (only LIAISON gated)
- Existing transition whitelist (only adding metadata flags)

### Risks
- **Viz server must have write access to project DBs** for confirm endpoint. Currently it opens readonly (line 66). Need to open in write mode for confirm operations only.
- **Auto mode still requires `liaison_reasoning`** — prevents fully mindless auto-approval
- **If viz server is down**, Thomas can't confirm in manual mode. Mitigation: Thomas can use CLI directly with actor=`thomas` (bypasses the gate).

## Do
(To be completed by DEV agent — all changes in xpollination-mcp-server repo)

## Study
- Manual mode: LIAISON gets rejected with clear error when trying to approve without human_confirmed
- Manual mode: Confirm button in viz sets human_confirmed, LIAISON can then transition
- Auto mode: LIAISON can transition freely but must provide liaison_reasoning
- Mode toggle persists across agent restarts
- Thomas (actor=thomas) always bypasses the gate
- Agent cannot set human_confirmed via update-dna CLI

## Act
- Update WORKFLOW.md to document the two modes
- Monitor LIAISON behavior — does the gate prevent unauthorized approvals?
- Consider: audit log of mode changes in system_settings
