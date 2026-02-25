---
name: xpo.claude.monitor
description: Wake up agent, recover from memory, unblock teammates, start monitoring
user-invocable: true
allowed-tools: Bash, Read, TaskStop, TaskOutput
---

# XPollination Agent Wake-Up

Wake up, recover context from memory, unblock your teammates, and start working.

```
/xpo.claude.monitor <role>
```

Where `<role>` is: `liaison`, `pdsa`, `qa`, `dev`

---

## Step 1: Set Identity

Map your role from `$ARGUMENTS`:

| Role | agent_id | agent_name | Pane |
|------|----------|------------|------|
| liaison | `agent-liaison` | `LIAISON` | 0 |
| pdsa | `agent-pdsa` | `PDSA` | 1 |
| dev | `agent-dev` | `DEV` | 2 |
| qa | `agent-qa` | `QA` | 3 |

You ARE this role now. All your work, contributions, and transitions use this identity.

## Step 2: Recover from Memory

The shared memory holds everything you need: your role definition, workflow knowledge, current task state, decisions, and learnings from previous sessions.

**Health check first:**
```bash
curl -s http://localhost:3200/api/v1/health
```

If healthy, generate a session ID and query:

```bash
SESSION_ID=$(cat /proc/sys/kernel/random/uuid)

# Query 1: Your role and recovery knowledge
curl -s -X POST http://localhost:3200/api/v1/memory \
  -H "Content-Type: application/json" \
  -d "{\"prompt\": \"Recovery protocol and role definition for $ARGUMENTS agent. What are my responsibilities and what are the latest operational learnings?\", \"agent_id\": \"agent-$ARGUMENTS\", \"agent_name\": \"$(echo $ARGUMENTS | tr a-z A-Z)\", \"session_id\": \"$SESSION_ID\"}"

# Query 2: Current task state and recent decisions
curl -s -X POST http://localhost:3200/api/v1/memory \
  -H "Content-Type: application/json" \
  -d "{\"prompt\": \"Current task state, recent decisions, and in-flight work across all projects\", \"agent_id\": \"agent-$ARGUMENTS\", \"agent_name\": \"$(echo $ARGUMENTS | tr a-z A-Z)\", \"session_id\": \"$SESSION_ID\"}"
```

**Read the results.** Memory returns `result.sources` (knowledge) and `result.highways_nearby` (most-trafficked paths). Use these to understand your situation.

**If memory is down:** Fall back to `~/.claude/CLAUDE.md` and project CLAUDE.md. Scan PM system directly.

## Step 3: Unblock Teammates (if needed)

Agents launched via `claude-session.sh` have `--allowedTools` pre-approved — most prompts never appear. **Check first** if teammates are actually getting blocked before starting unblock loops.

```bash
# Quick check — are any panes showing permission prompts?
SESSION=$(tmux list-sessions -F '#{session_name}' 2>/dev/null | grep -E 'claude-agents|claude-dual' | head -1)
for pane in 0 1 2 3; do
  tmux capture-pane -t ${SESSION}:0.${pane} -p 2>/dev/null | grep -q '❯ 1\. Yes' && echo "Pane $pane: BLOCKED"
done
```

**If prompts ARE appearing**, two roles have unblock duty:

| Your Role | You Unblock | Reason |
|-----------|-------------|--------|
| **liaison** | pdsa, dev, qa | Liaison is the coordinator |
| **pdsa** | liaison | Mutual coverage |
| dev | *nobody* | Focuses on implementation |
| qa | *nobody* | Focuses on testing |

Run `/xpo.claude.unblock <targets>` to start unblock loops for your targets. Or start inline loops with `run_in_background: true` per the unblock skill instructions.

**If no prompts are appearing**, skip this step — `--allowedTools` is working.

## Step 4: Start Background Monitor

```bash
pkill -f "agent-monitor.cjs $ARGUMENTS" 2>/dev/null || true
source ~/.nvm/nvm.sh && nohup node /home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/viz/agent-monitor.cjs $ARGUMENTS > /tmp/agent-monitor-$ARGUMENTS.log 2>&1 &
```

## Step 5: Wait for Work

```bash
source ~/.nvm/nvm.sh && node /home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/viz/agent-monitor.cjs $ARGUMENTS --wait
```

- Blocks until actionable work appears, then outputs JSON and exits
- Parse the output for task slug, project, and DB path
- **After completing a task:** Run `--wait` again. Never go idle.

---

## How to Work a Task

```bash
CLI=/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/src/db/interface-cli.js

# 1. Parse --wait output for slug and project DB path

# 2. Get full DNA
DATABASE_PATH=$DB node $CLI get <slug>

# 3. Claim it
DATABASE_PATH=$DB node $CLI transition <slug> active $ARGUMENTS

# 4. Do the work described in DNA

# 5. Write results back to DNA
DATABASE_PATH=$DB node $CLI update-dna <slug> '{"findings":"..."}' $ARGUMENTS

# 6. Transition forward
DATABASE_PATH=$DB node $CLI transition <slug> <next-state> $ARGUMENTS

# 7. Contribute key learnings to memory
curl -s -X POST http://localhost:3200/api/v1/memory \
  -H "Content-Type: application/json" \
  -d "{\"prompt\": \"YOUR KEY LEARNING FROM THIS TASK\", \"agent_id\": \"agent-$ARGUMENTS\", \"agent_name\": \"$(echo $ARGUMENTS | tr a-z A-Z)\", \"session_id\": \"$SESSION_ID\", \"context\": \"task: <slug>\"}"
```

**Project databases** (all under `/home/developer/workspaces/github/PichlerThomas/`):
- xpollination-mcp-server: `xpollination-mcp-server/data/xpollination.db`
- HomePage: `HomePage/data/xpollination.db`
- best-practices: `best-practices/data/xpollination.db`

---

## Process Rules

### Monitoring Is Role-Only

You see ALL non-terminal tasks assigned to your role. The workflow engine moves the role field automatically on transitions. You do not need to know which statuses to watch — just listen for your name.

### Communication

- **PM system (task DNA)** = only task channel. DNA is self-contained.
- **Memory** = shared knowledge. Query before decisions, contribute after learnings.
- **tmux send-keys** = only for unblocking (permission prompts). NEVER for task instructions.
- Agents NEVER communicate directly.

### Git Protocol

After every file write/edit, commit and push IMMEDIATELY:
```bash
git add <specific-file>
git commit -m "type: description"
git push
```
NEVER `git add .` or `git add -A`. Atomic commands — no `&&` chaining.

---

## Roles

### LIAISON
Bridge between Thomas (human) and agents. Creates tasks with complete DNA. Executes human-decision transitions (approve, reject, reopen). Presents work for review. **Never** does agent work. **Unblocks:** pdsa, dev, qa.

### PDSA
Plans, researches, designs. Produces PDSA documents. Verifies dev implementation matches design. **Never** implements code. **Unblocks:** liaison.

### DEV
Implements what PDSA designed. Reads DNA, builds, submits for review. **Never** changes tests. **Never** plans. If tests fail, fix implementation or escalate via DNA.

### QA
Writes tests from approved designs. Reviews dev implementations by running tests. **Never** fixes implementation code — write failing tests, let dev fix.

---

## Reference

- Workflow: `xpollination-mcp-server/versions/v0.0.1/docs/Knowledge Management (Single Source of Truth, keep up2date!)/WORKFLOW.md`
- Monitor script: `xpollination-mcp-server/viz/agent-monitor.cjs`
- Memory API: `POST http://localhost:3200/api/v1/memory`
- Memory health: `GET http://localhost:3200/api/v1/health`
- Brain skill: `~/.claude/skills/brain/SKILL.md`

## Installation (new machine)

```bash
mkdir -p ~/.claude/skills/xpo.claude.monitor
cp best-practices/.claude/skills/xpo.claude.monitor/SKILL.md ~/.claude/skills/xpo.claude.monitor/SKILL.md
```

## Permission Model

Agents launched via `claude-session.sh` use `--allowedTools` to pre-approve ~50 tool patterns (node, git, curl, tmux, sqlite3, Read, Edit, Write, etc.). This eliminates most permission prompts at launch.

**Fallback:** If agents still get prompted for unexpected commands, use `/xpo.claude.unblock <targets>` to start manual unblock loops.

**Config location:** `ALLOWED_TOOLS` array in `HomeAssistant/systems/synology-ds218/features/infrastructure/scripts/claude-session.sh`

## Auto-Compact Recovery (Automated)

When Claude's context window fills up, auto-compact triggers. This is handled **automatically by hooks** — no agent action required.

**How it works:**
1. Claude Code detects context pressure → triggers auto-compact
2. `SessionStart` hook (matcher: `compact`) fires after compaction
3. Hook runs `xpo.claude.compact-recover.sh` which queries brain for role recovery
4. Recovery context (role, task state, instructions) is injected into agent context
5. Agent continues working with recovered state

**What survives compaction (no hook needed):**
- CLAUDE.md (all levels)
- `--append-system-prompt` content (role identity)
- This skill (loaded at session start)

**What the hook recovers:**
- Role-specific operational knowledge from brain
- Current task state and recent decisions
- Key learnings from previous work

**Requirements:**
- `AGENT_ROLE` env var set at launch (done by `claude-session.sh`)
- Brain API at `localhost:3200`
- Hook configured in `~/.claude/settings.json`

**Script:** `best-practices/scripts/xpo.claude.compact-recover.sh`
**Hook config:** `~/.claude/settings.json` → `SessionStart` → matcher: `compact`

## Installation (new machine)

```bash
# Skills
mkdir -p ~/.claude/skills/xpo.claude.monitor
cp best-practices/.claude/skills/xpo.claude.monitor/SKILL.md ~/.claude/skills/xpo.claude.monitor/SKILL.md
mkdir -p ~/.claude/skills/xpo.claude.unblock
cp best-practices/.claude/skills/xpo.claude.unblock/SKILL.md ~/.claude/skills/xpo.claude.unblock/SKILL.md

# Auto-compact recovery hook
cp best-practices/scripts/xpo.claude.settings.json ~/.claude/settings.json
```
