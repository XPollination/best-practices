# PDSA: Task-Boundary Brain Documentation Protocol

**Slug:** `task-boundary-brain-protocol`
**Date:** 2026-02-26
**Author:** PDSA agent
**Status:** DESIGN

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

**Evidence:** PDSA agent analyzed `cli-create-missing-parent-ids`, wrote findings to DNA, hit a workflow error (role mismatch), and stopped. On resume, brain had NO record of the in-progress work. Agent re-discovered the task via monitor but had to re-analyze from scratch.

### Goal
Every task lifecycle boundary (claim, transition, error-stop) creates a brain marker that any agent can query for recovery.

---

## DO

### Protocol: Task-Boundary Brain Markers

#### Format

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

#### Integration into SKILL.md

Modify "How to Work a Task" section. Changes to existing steps:

**Step 4 (Claim)** — add TASK START contribution after successful transition:
```bash
# 4a. Claim it
DATABASE_PATH=$DB node $CLI transition <slug> active $ARGUMENTS

# 4b. Contribute TASK START marker
curl -s -X POST http://localhost:3200/api/v1/memory \
  -H "Content-Type: application/json" \
  -d "{\"prompt\": \"TASK START: $(echo $ARGUMENTS | tr a-z A-Z) claiming <slug> (<project>) — <DNA title>\", \"agent_id\": \"agent-$ARGUMENTS\", \"agent_name\": \"$(echo $ARGUMENTS | tr a-z A-Z)\", \"session_id\": \"$SESSION_ID\", \"context\": \"task: <slug>\"}"
```

**Step 7 (Transition)** — add TASK TRANSITION contribution after successful transition:
```bash
# 7a. Transition forward
DATABASE_PATH=$DB node $CLI transition <slug> <next-state> $ARGUMENTS

# 7b. Contribute TASK TRANSITION marker
curl -s -X POST http://localhost:3200/api/v1/memory \
  -H "Content-Type: application/json" \
  -d "{\"prompt\": \"TASK <from>→<to>: $(echo $ARGUMENTS | tr a-z A-Z) <slug> (<project>) — <outcome>\", \"agent_id\": \"agent-$ARGUMENTS\", \"agent_name\": \"$(echo $ARGUMENTS | tr a-z A-Z)\", \"session_id\": \"$SESSION_ID\", \"context\": \"task: <slug>\"}"
```

**New Step 7c (Error handling)** — TASK BLOCKED on transition failure:
```bash
# If transition fails or work cannot proceed:
curl -s -X POST http://localhost:3200/api/v1/memory \
  -H "Content-Type: application/json" \
  -d "{\"prompt\": \"TASK BLOCKED: $(echo $ARGUMENTS | tr a-z A-Z) <slug> (<project>) — <blocker description>\", \"agent_id\": \"agent-$ARGUMENTS\", \"agent_name\": \"$(echo $ARGUMENTS | tr a-z A-Z)\", \"session_id\": \"$SESSION_ID\", \"context\": \"task: <slug>\"}"
```

#### Recovery Query Pattern

Add to Step 2 (Recover from Memory) in SKILL.md:
```bash
# Query 3: In-flight tasks from previous sessions
curl -s -X POST http://localhost:3200/api/v1/memory \
  -H "Content-Type: application/json" \
  -d "{\"prompt\": \"TASK START or TASK BLOCKED markers for $ARGUMENTS agent. What tasks were in-flight?\", \"agent_id\": \"agent-$ARGUMENTS\", \"agent_name\": \"$(echo $ARGUMENTS | tr a-z A-Z)\", \"session_id\": \"$SESSION_ID\"}"
```

### Acceptance Criteria Mapping

| AC | How Met |
|----|---------|
| Protocol defined: TASK START/END format | Format section above with 3 marker types |
| All roles follow protocol | Integrated into SKILL.md which all roles use |
| Contributions include role, slug, context, outcome, blockers | Format includes all fields |
| Protocol integrated into SKILL.md | Steps 4b, 7b, 7c, and recovery query 3 |
| Recovery query returns task-boundary markers | Recovery Query Pattern section |
| Cost per marker < 500ms | Single curl POST, brain API responds in ~200-400ms |

### Implementation Scope

**File to modify:** `best-practices/.claude/skills/xpo.claude.monitor/SKILL.md` (single file)

**Changes:**
1. Step 2: Add Query 3 (in-flight task recovery)
2. Step 4: Split into 4a (claim) + 4b (TASK START marker)
3. Step 7: Split into 7a (transition) + 7b (TASK TRANSITION marker) + 7c (TASK BLOCKED on error)
4. Add "Task-Boundary Protocol" section explaining the format and rationale

**No changes to:** workflow-engine.js, interface-cli.js, compact-recover.sh, settings.json

### Cost Analysis

- 1 TASK START per task claim (~400ms)
- 1 TASK TRANSITION per transition (~400ms)
- 0-1 TASK BLOCKED per error (~400ms)
- Typical task: 2-3 markers = 800-1200ms total overhead
- Brain deduplication handles repeated similar markers (returns guidance to refine instead)

---

## STUDY

*To be completed after implementation review.*

## ACT

*To be completed after study phase.*
