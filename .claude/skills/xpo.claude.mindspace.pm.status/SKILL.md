---
name: xpo.claude.mindspace.pm.status
description: Programme Management status overview across all projects
user-invocable: true
allowed-tools: Bash, Read
---

# PM Status — Cross-Project Overview

Single command to scan all project databases, present a categorized summary, then drill down into each actionable task one-by-one for human decisions.

```
/xpo.claude.mindspace.pm.status
```

---

## Step 0: Brain Context

Before scanning databases, query brain for any pending human context (rework notes, verbal decisions):

```bash
SESSION_ID=$(cat /proc/sys/kernel/random/uuid)
curl -s -X POST http://localhost:3200/api/v1/memory \
  -H "Content-Type: application/json" \
  -d "{\"prompt\": \"Pending context for PM status presentation. Any rework notes or human decisions?\", \"agent_id\": \"agent-liaison\", \"agent_name\": \"LIAISON\", \"session_id\": \"$SESSION_ID\"}"
```

Read the response. If brain has relevant context (decisions, rework notes), note it for presentation.

## Step 1: Scan All Project DBs

Query all 3 project databases for non-terminal tasks:

```bash
CLI=/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/src/db/interface-cli.js

for DB in \
  "/home/developer/workspaces/github/PichlerThomas/best-practices/data/xpollination.db" \
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/data/xpollination.db" \
  "/home/developer/workspaces/github/PichlerThomas/HomePage/data/xpollination.db"; do
  echo "=== $(basename $(dirname $(dirname $DB))) ==="
  DATABASE_PATH="$DB" node $CLI list 2>/dev/null
done
```

Collect all non-terminal tasks (exclude `complete`, `cancelled`).

## Step 2: Phase 1 — Summary Table

Present a compact overview grouped by action type:

```
=== PM STATUS (YYYY-MM-DD HH:MM) ===

DECISIONS NEEDED (approval — approve or rework):
  [1] task-slug (project) — approval+role

REVIEWS PENDING (review+liaison — complete or rework):
  [2] task-slug (project) — review+liaison

IN PIPELINE (no action needed now):
  [3] task-slug (project) — status+role
  [4] task-slug (project) — status+role

--- Summary: N tasks | X approvals | Y reviews | Z in-pipeline ---
```

**Categorization rules:**
- Status `approval` → **DECISIONS NEEDED** (human approves or sends to rework)
- Status `review` AND role `liaison` → **REVIEWS PENDING** (human completes or reworks)
- All other non-terminal → **IN PIPELINE** (informational, no action needed)

## Step 3: Phase 2 — Sequential Task Drill-Down

For each task in DECISIONS NEEDED + REVIEWS PENDING (ordered by category, then updated_at):

1. **Get full DNA:**
   ```bash
   DATABASE_PATH=$DB node $CLI get <slug>
   ```

2. **Present to Thomas:**
   - Title and project
   - Action type: "Approve or Rework?" / "Complete or Rework?"
   - Key DNA fields: `findings`, `implementation`, `qa_review`, `pdsa_review`, `qa_design_review`
   - Review chain trail (who reviewed, who passed)

3. **WAIT for Thomas's decision** using AskUserQuestion:
   - For approval: options are "Approve" and "Rework" (+ Other)
   - For review: options are "Complete" and "Rework" (+ Other)

4. **Execute the transition** based on decision:
   - Approve: `DATABASE_PATH=$DB node $CLI transition <slug> approved liaison`
   - Complete: `DATABASE_PATH=$DB node $CLI transition <slug> complete liaison`
   - Rework: `DATABASE_PATH=$DB node $CLI transition <slug> rework liaison`

5. **Only then** present the next task.

**CRITICAL: Never present all task details at once.** The summary is the map. Phase 2 is the decision flow — one task at a time.

## Step 4: Wrap Up

After all actionable tasks are presented and decided:
- Show remaining IN PIPELINE tasks (brief, no drill-down)
- End with: "All actionable items addressed. N tasks remain in pipeline."

---

## Reference

- **CLI:** `xpollination-mcp-server/src/db/interface-cli.js`
- **Project DBs:**
  - `best-practices/data/xpollination.db`
  - `xpollination-mcp-server/data/xpollination.db`
  - `HomePage/data/xpollination.db`
- **Brain API:** `POST http://localhost:3200/api/v1/memory`
- **Workflow:** `xpollination-mcp-server/docs/WORKFLOW.md`
