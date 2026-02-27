# PDSA: PM Status Skill + Skill Consolidation

**Slug:** `xpo-claude-mindspace-pm-status`
**Date:** 2026-02-26
**Author:** PDSA agent
**Status:** DESIGN (Rework v2)

---

## PLAN

### Problem
1. **No quick PM overview**: Thomas and agents must manually list tasks per project and mentally aggregate. LIAISON does this one-by-one.
2. **Brain skill not git-tracked**: Lives only in `~/.claude/skills/brain/SKILL.md`, not in best-practices.
3. **No single install reference**: Skills are scattered, no central install process.

### Goal
1. Create `/xpo.claude.mindspace.pm.status` skill for instant cross-project PM status
2. Git-track all 4 skills in `best-practices/.claude/skills/`
3. Document install process

### Rework v2 Feedback (from LIAISON)
1. **RENAME** brain skill → `xpo.claude.mindspace.brain` (follow `xpo.claude.*` namespace)
2. **TWO-PHASE PRESENTATION** — Phase 1: summary table. Phase 2: sequential one-by-one with full DNA, wait for Thomas decision after EACH task
3. **BRAIN QUERY FIRST** — query brain for context before scanning DBs
4. **DNA DRILL-DOWN** — get full DNA for each actionable task
5. **CATEGORIZE BY ACTION TYPE** — approval vs review are different decision types
6. **SEQUENTIAL CONTINUE PATTERN** — after decision on Task 1, present Task 2

---

## DO

### Part 1: PM Status Skill

**File:** `best-practices/.claude/skills/xpo.claude.mindspace.pm.status/SKILL.md`

**Invocation:** `/xpo.claude.mindspace.pm.status` (no arguments)

**Skill structure (SKILL.md frontmatter):**
```yaml
---
name: xpo.claude.mindspace.pm.status
description: Programme Management status overview across all projects
user-invocable: true
allowed-tools: Bash, Read
---
```

**Skill execution flow (imperative instructions to agent):**

#### Step 0: Brain Context
Query brain for any pending human context before scanning:
```bash
curl -s -X POST http://localhost:3200/api/v1/memory \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Pending context for PM status presentation. Any rework notes or human decisions?", "agent_id": "agent-liaison", "agent_name": "LIAISON", "session_id": "SESSION_ID"}'
```

#### Step 1: Scan All Project DBs
```bash
CLI=/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/src/db/interface-cli.js

for DB in \
  "/home/developer/workspaces/github/PichlerThomas/best-practices/data/xpollination.db" \
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/data/xpollination.db" \
  "/home/developer/workspaces/github/PichlerThomas/HomePage/data/xpollination.db"; do
  DATABASE_PATH="$DB" node $CLI list 2>/dev/null
done
```

#### Step 2: Phase 1 — Summary Table
Filter non-terminal tasks. Present compact overview grouped by action type:

```
=== PM STATUS (2026-02-26 10:00) ===

DECISIONS NEEDED (approval — approve or rework):
  [1] task-boundary-brain-protocol (best-practices) — approval+liaison

REVIEWS PENDING (review — complete or rework):
  [2] agent-permission-bottleneck (best-practices) — review+liaison
  [3] cli-create-missing-parent-ids (xpollination-mcp-server) — review+liaison

IN PIPELINE (no action needed):
  [4] xpo-claude-mindspace-pm-status (best-practices) — active+pdsa

--- Summary: 4 tasks | 1 approval | 2 reviews | 1 in-pipeline ---
```

**Categorization rules:**
- `approval` status → "DECISIONS NEEDED" (approve/rework)
- `review+liaison` status → "REVIEWS PENDING" (complete/rework)
- All other non-terminal → "IN PIPELINE" (informational)

#### Step 3: Phase 2 — Sequential Task Presentation
For each task in DECISIONS NEEDED + REVIEWS PENDING (ordered by category, then updated_at):

1. Get full DNA: `DATABASE_PATH=$DB node $CLI get <slug>`
2. Present to Thomas with:
   - Title and project
   - Action type: "Approve or Rework?" / "Complete or Rework?"
   - Key DNA fields: findings, implementation, qa_review, pdsa_review
   - Review chain trail (who reviewed, who passed)
3. **WAIT for Thomas's decision** (use AskUserQuestion with approve/rework options)
4. Execute the transition based on decision
5. **Only then** present the next task

**CRITICAL: Never present all task details at once.** The summary is the map. Phase 2 is the decision flow, one task at a time.

#### Step 4: Continue Pattern
After all actionable tasks are presented and decided:
- Show remaining IN PIPELINE tasks (brief, no drill-down)
- End with: "All actionable items addressed. N tasks remain in pipeline."

### Part 2: Brain Skill Rename + Consolidation

**Rename:** `brain` → `xpo.claude.mindspace.brain`

**Files:**
- CREATE `best-practices/.claude/skills/xpo.claude.mindspace.brain/SKILL.md` (copy from `~/.claude/skills/brain/SKILL.md`, update name in frontmatter)
- On install: `mkdir -p ~/.claude/skills/xpo.claude.mindspace.brain && cp best-practices/.claude/skills/xpo.claude.mindspace.brain/SKILL.md ~/.claude/skills/xpo.claude.mindspace.brain/SKILL.md`
- Keep old `brain` path as symlink for backward compatibility: `ln -sf xpo.claude.mindspace.brain ~/.claude/skills/brain`

**Content changes in brain SKILL.md:**
- Frontmatter `name: xpo.claude.mindspace.brain`
- Invocation: `/xpo.claude.mindspace.brain <action> [args]`

### Part 3: Install Documentation

Update `xpo.claude.monitor/SKILL.md` Installation section:

```bash
# Install all skills (from best-practices repo)
for skill in xpo.claude.monitor xpo.claude.unblock xpo.claude.mindspace.brain xpo.claude.mindspace.pm.status; do
  mkdir -p ~/.claude/skills/$skill
  cp best-practices/.claude/skills/$skill/SKILL.md ~/.claude/skills/$skill/SKILL.md
done
# Backward compat symlink for brain skill
ln -sf xpo.claude.mindspace.brain ~/.claude/skills/brain
```

### Part 4: Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `best-practices/.claude/skills/xpo.claude.mindspace.pm.status/SKILL.md` | CREATE | New PM status skill with two-phase presentation |
| `best-practices/.claude/skills/xpo.claude.mindspace.brain/SKILL.md` | CREATE | Renamed brain skill (from ~/.claude/skills/brain/) |
| `best-practices/.claude/skills/xpo.claude.monitor/SKILL.md` | EDIT | Update install docs with all 4 skills |

### Acceptance Criteria Mapping (Rework v2)

| AC | How Met |
|----|---------|
| Skill functional | Two-phase skill: summary + sequential drill-down |
| Scans all 3 DBs | Explicit loop over 3 DATABASE_PATH values in Step 1 |
| Groups by status/role, actionable items | Categorized: DECISIONS NEEDED / REVIEWS PENDING / IN PIPELINE |
| Compact and scannable | Phase 1 summary table, Phase 2 one-at-a-time |
| Brain skill consolidated | Renamed to xpo.claude.mindspace.brain, git-tracked |
| All 4 skills git-tracked | 4 SKILL.md dirs in best-practices/.claude/skills/ |
| Install docs updated | Install section with all skills + brain symlink |
| Brain query first (new) | Step 0 queries brain before DB scan |
| DNA drill-down (new) | Phase 2 gets full DNA per task |
| Sequential continue (new) | Wait for decision → execute → present next |

---

## STUDY

*To be completed after implementation review.*

## ACT

*To be completed after study phase.*
