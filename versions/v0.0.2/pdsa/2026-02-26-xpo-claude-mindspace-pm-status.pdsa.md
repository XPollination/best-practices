# PDSA: PM Status Skill + Skill Consolidation

**Slug:** `xpo-claude-mindspace-pm-status`
**Date:** 2026-02-26
**Author:** PDSA agent
**Status:** DESIGN

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

**What the skill instructs the agent to do:**

1. Query all 3 project DBs using `interface-cli.js list` (non-terminal tasks only)
2. Parse JSON output from each
3. Format into a compact table grouped by project → status → role
4. Highlight actionable items for current agent role (from `$AGENT_ROLE` env var or detected from context)
5. Show summary counts

**Implementation approach — bash-driven queries:**

```bash
CLI=/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/src/db/interface-cli.js

# Query each project DB
for DB in \
  "/home/developer/workspaces/github/PichlerThomas/best-practices/data/xpollination.db" \
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/data/xpollination.db" \
  "/home/developer/workspaces/github/PichlerThomas/HomePage/data/xpollination.db"; do
  DATABASE_PATH="$DB" node $CLI list 2>/dev/null
done
```

Then parse with node one-liner or python3 to format:

**Output format (compact, scannable):**

```
=== PM STATUS (2026-02-26 10:00) ===

📦 best-practices (3 active)
  active+pdsa:  xpo-claude-mindspace-pm-status ← YOU
  approval:     task-boundary-brain-protocol (waiting for Thomas)
  review+liaison: agent-permission-bottleneck

📦 xpollination-mcp-server (1 active)
  review+liaison: cli-create-missing-parent-ids

📦 HomePage (0 active)
  (no non-terminal tasks)

--- Summary ---
Total: 4 | Your role (pdsa): 1 actionable | Awaiting human: 2
```

**Key design decisions:**
- Terminal statuses (`complete`, `cancelled`) are excluded
- "← YOU" marker on tasks actionable for current role
- Approval tasks show "(waiting for Thomas)" since LIAISON = human gate
- No DNA details — this is an overview. Use `interface-cli.js get <slug>` for details.

### Part 2: Brain Skill Consolidation

**Action:** Copy `~/.claude/skills/brain/SKILL.md` → `best-practices/.claude/skills/brain/SKILL.md`

No content changes needed — the brain skill is already correct. Just needs to be git-tracked.

### Part 3: Install Documentation

Add to `xpo.claude.monitor/SKILL.md` "Installation" section:

```bash
# Install all skills (from best-practices repo)
for skill in xpo.claude.monitor xpo.claude.unblock brain xpo.claude.mindspace.pm.status; do
  mkdir -p ~/.claude/skills/$skill
  cp best-practices/.claude/skills/$skill/SKILL.md ~/.claude/skills/$skill/SKILL.md
done
```

### Part 4: Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `best-practices/.claude/skills/xpo.claude.mindspace.pm.status/SKILL.md` | CREATE | New PM status skill |
| `best-practices/.claude/skills/brain/SKILL.md` | CREATE | Copy brain skill for git-tracking |
| `best-practices/.claude/skills/xpo.claude.monitor/SKILL.md` | EDIT | Update install docs section |

### Acceptance Criteria Mapping

| AC | How Met |
|----|---------|
| Skill functional | SKILL.md with bash queries + formatting |
| Scans all 3 DBs | Explicit loop over 3 DATABASE_PATH values |
| Groups by status and role | Formatting instructions in skill |
| Compact and scannable | Table format with markers (← YOU, waiting for Thomas) |
| Brain skill consolidated | Copy to best-practices/.claude/skills/brain/ |
| All 4 skills git-tracked | 4 SKILL.md files in best-practices/.claude/skills/ |
| Install docs updated | Install section in monitor SKILL.md |

---

## STUDY

*To be completed after implementation review.*

## ACT

*To be completed after study phase.*
