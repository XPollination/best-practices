# PDSA: Eliminate Agent Permission Bottleneck

**Date:** 2026-02-25
**Status:** Draft
**Task:** `agent-permission-bottleneck`
**Author:** PDSA agent

---

## PLAN

### Problem Statement

Two related problems create a process bottleneck where agents stall waiting for permission confirmations:

1. **`--allowedTools` gaps**: `claude-session.sh` launches agents with 51 pre-approved tool patterns, but agents still get prompted because common tools and bash commands are missing from the list.
2. **`xpo.claude.unblock` skill gaps**: The fallback monitoring skill (v6) only detects one prompt pattern (`❯ 1. Yes`), and may miss other Claude Code permission prompt formats.

Both layers of defense have gaps, so agents regularly block on permission prompts.

### Root Cause Analysis

#### Layer 1: `--allowedTools` in `claude-session.sh`

**File:** `HomeAssistant/systems/synology-ds218/features/infrastructure/scripts/claude-session.sh` lines 72-123

**Current state:** 51 patterns covering common bash commands + 5 non-Bash tools.

**Missing non-Bash tools (agents use these constantly):**

| Tool | Usage | Impact |
|------|-------|--------|
| `Glob` | File pattern matching — every codebase search | HIGH — agents use this 10+ times per task |
| `Grep` | Content search — finding code, patterns | HIGH — agents use this 10+ times per task |
| `Task` | Subagent delegation — parallel research | MEDIUM — PDSA/DEV use for exploration |
| `Skill` | Skill invocation (`/brain`, `/xpo.claude.monitor`) | HIGH — every wake-up and brain query |
| `AskUserQuestion` | Clarification from user | LOW — used occasionally |
| `TaskCreate` | Task tracking | LOW |
| `TaskUpdate` | Task tracking | LOW |
| `TaskList` | Task tracking | LOW |
| `TaskGet` | Task tracking | LOW |
| `NotebookEdit` | Jupyter notebooks | LOW |
| `EnterPlanMode` | Planning mode | LOW |
| `ExitPlanMode` | Planning mode | LOW |

**Missing bash commands (agents encounter these frequently):**

| Command | Usage |
|---------|-------|
| `jq` | JSON parsing (brain API responses, DNA output) |
| `sed` | Text replacement in scripts/configs |
| `awk` | Text field extraction |
| `date` | Timestamps for logs, commits |
| `tr` | Case conversion (e.g., `echo pdsa \| tr a-z A-Z`) |
| `cut` | Column extraction |
| `touch` | File creation |
| `which` / `command` | Executable location |
| `dirname` / `basename` | Path manipulation |
| `free` | Memory monitoring |
| `tee` | Write to file and stdout |
| `diff` | File comparison |
| `python3` | JSON formatting, quick scripts |
| `cd` | Directory change (used in compound commands) |
| `rm` | File deletion (intentionally excluded for safety, but blocks cleanup ops) |
| `true` / `false` | Shell builtins used in `|| true` patterns |
| `[` / `[[` | Test expressions |
| `read` | Shell variable reading |
| `printf` | Formatted output |
| `set` | Shell options |
| `local` | Variable scoping |

**Pattern fragility problem:** The `--allowedTools Bash(node:*)` pattern matches commands that START with `node`. But agents write complex compound commands like:
```bash
source ~/.nvm/nvm.sh && DATABASE_PATH=/tmp/x.db node script.js
```
This command starts with `source`, not `node` — so `Bash(source:*)` must also be in the list. Every unique first-word of a command needs its own pattern entry. This is a whack-a-mole game.

**Variable assignment workaround:** The current list includes entries like `Bash(DATABASE_PATH:*)`, `Bash(CLI:*)`, `Bash(DB:*)`, `Bash(SESSION_ID:*)` — these are variable assignments used as command prefixes. Any new variable name triggers a new permission prompt.

#### Layer 2: `xpo.claude.unblock` skill (v6)

**File:** `~/.claude/skills/xpo.claude.unblock/SKILL.md`

**Current detection pattern:**
```bash
if echo "$output" | grep -qE '❯ 1\. Yes'; then
    if echo "$output" | grep -qE '2\. Yes'; then
      tmux send-keys -t <PANE> 2
    else
      tmux send-keys -t <PANE> 1
    fi
fi
```

**Known gaps:**
1. Only matches `❯ 1. Yes` — Claude Code may show different prompt text (e.g., `❯ 1. Yes, allow once`)
2. Does not handle prompts where the option text differs from "Yes"
3. The `tail -8` window may miss prompts that render with more context lines (long command descriptions)
4. No logging of WHAT prompt was confirmed — makes debugging gaps difficult

**What works well:**
- `tail -8` prevents stale scrollback matches (v6 fix)
- Prefers option 2 ("allow all during session") to reduce future prompts
- 6-second poll interval is adequate

---

## DO (Recommendations)

### Recommendation 1: Expand `--allowedTools` comprehensively

**Priority: HIGH — this is the preventive layer, most impactful fix**

Add all missing tools to `ALLOWED_TOOLS` in `claude-session.sh`:

```bash
readonly ALLOWED_TOOLS=(
    # === Non-Bash tools (agents need ALL of these) ===
    "Read"
    "Edit"
    "Write"
    "Glob"
    "Grep"
    "Task"
    "Skill"
    "WebSearch"
    "WebFetch"
    "AskUserQuestion"
    "TaskCreate"
    "TaskUpdate"
    "TaskList"
    "TaskGet"
    "NotebookEdit"
    "EnterPlanMode"
    "ExitPlanMode"
    "EnterWorktree"

    # === Bash: Core runtime ===
    "Bash(node:*)"
    "Bash(npm:*)"
    "Bash(npx:*)"
    "Bash(source:*)"
    "Bash(bash:*)"
    "Bash(sh:*)"

    # === Bash: Git ===
    "Bash(git:*)"

    # === Bash: Network ===
    "Bash(curl:*)"

    # === Bash: Process management ===
    "Bash(pkill:*)"
    "Bash(pgrep:*)"
    "Bash(kill:*)"
    "Bash(ps:*)"
    "Bash(nohup:*)"

    # === Bash: File operations ===
    "Bash(ls:*)"
    "Bash(cat:*)"
    "Bash(head:*)"
    "Bash(tail:*)"
    "Bash(mkdir:*)"
    "Bash(cp:*)"
    "Bash(mv:*)"
    "Bash(chmod:*)"
    "Bash(touch:*)"
    "Bash(realpath:*)"
    "Bash(stat:*)"
    "Bash(du:*)"
    "Bash(diff:*)"
    "Bash(tee:*)"

    # === Bash: Text processing ===
    "Bash(echo:*)"
    "Bash(printf:*)"
    "Bash(grep:*)"
    "Bash(sed:*)"
    "Bash(awk:*)"
    "Bash(cut:*)"
    "Bash(tr:*)"
    "Bash(sort:*)"
    "Bash(wc:*)"
    "Bash(jq:*)"
    "Bash(find:*)"

    # === Bash: Database ===
    "Bash(sqlite3:*)"

    # === Bash: tmux ===
    "Bash(tmux:*)"

    # === Bash: Shell builtins & control ===
    "Bash(test:*)"
    "Bash([:*)"
    "Bash(set:*)"
    "Bash(unset:*)"
    "Bash(export:*)"
    "Bash(sleep:*)"
    "Bash(timeout:*)"
    "Bash(true:*)"
    "Bash(false:*)"
    "Bash(read:*)"
    "Bash(local:*)"
    "Bash(cd:*)"
    "Bash(which:*)"
    "Bash(command:*)"
    "Bash(date:*)"
    "Bash(env:*)"
    "Bash(python3:*)"
    "Bash(free:*)"
    "Bash(dirname:*)"
    "Bash(basename:*)"

    # === Bash: Shell loops/conditions (used as first word) ===
    "Bash(for:*)"
    "Bash(while:*)"
    "Bash(if:*)"
    "Bash(do:*)"
    "Bash(done:*)"
    "Bash(case:*)"

    # === Bash: Variable assignments as command prefixes ===
    # Agents frequently start commands with VAR=value cmd...
    "Bash(DATABASE_PATH:*)"
    "Bash(DB:*)"
    "Bash(CLI:*)"
    "Bash(SESSION_ID:*)"
    "Bash(AGENT_ROLE:*)"
    "Bash(PATH:*)"
    "Bash(NODE_ENV:*)"
)
```

**Changes from current (51 → ~80 patterns):**
- Added: `Glob`, `Grep`, `Task`, `Skill`, `AskUserQuestion`, `TaskCreate/Update/List/Get`, `NotebookEdit`, `EnterPlanMode`, `ExitPlanMode`, `EnterWorktree`
- Added bash: `jq`, `sed`, `awk`, `date`, `tr`, `cut`, `touch`, `which`, `command`, `dirname`, `basename`, `free`, `tee`, `diff`, `python3`, `cd`, `true`, `false`, `printf`, `set`, `read`, `local`, `sh`, `case`, `[`
- Added variable prefixes: `AGENT_ROLE`, `PATH`, `NODE_ENV`
- Organized into clear sections with comments

**Safety preserved:** `rm` is NOT included — file deletion still requires confirmation. `git reset --hard`, `git push --force` are not pre-approved because `git:*` allows normal git but Claude Code's own safety layer still prompts for destructive git.

### Recommendation 2: Improve `xpo.claude.unblock` prompt detection

**Priority: MEDIUM — this is the reactive fallback, needed for edge cases**

Update the detection pattern to be more robust:

```bash
while true; do
  # CRITICAL: Only check last 8 lines to avoid stale scrollback matches
  output=$(tmux capture-pane -t <PANE> -p 2>/dev/null | tail -8)

  # Match any numbered permission prompt (covers all Claude Code variants)
  # Patterns seen: "❯ 1. Yes", "❯ 1. Yes, allow once", "❯ 1. Allow"
  if echo "$output" | grep -qE '❯ [0-9]+\. (Yes|Allow)'; then
    # Prefer highest "allow all" option (usually option 2 or 3)
    if echo "$output" | grep -qE '[0-9]+\. Yes.*don.t ask again'; then
      option=$(echo "$output" | grep -oE '[0-9]+\. Yes.*don.t ask again' | head -1 | grep -oE '^[0-9]+')
      tmux send-keys -t <PANE> "$option"
      echo "[$(date +%H:%M:%S)] <NAME>: Confirmed option $option (don't ask again)"
    elif echo "$output" | grep -qE '[0-9]+\. Yes.*allow'; then
      option=$(echo "$output" | grep -oE '[0-9]+\. Yes.*allow' | head -1 | grep -oE '^[0-9]+')
      tmux send-keys -t <PANE> "$option"
      echo "[$(date +%H:%M:%S)] <NAME>: Confirmed option $option (allow)"
    elif echo "$output" | grep -qE '2\. Yes'; then
      tmux send-keys -t <PANE> 2
      echo "[$(date +%H:%M:%S)] <NAME>: Confirmed option 2 (yes)"
    else
      tmux send-keys -t <PANE> 1
      echo "[$(date +%H:%M:%S)] <NAME>: Confirmed option 1 (yes)"
    fi
    sleep 5
    continue
  fi
  sleep 6
done
```

**Changes from v6:**
1. Broader initial match: `❯ [0-9]+\. (Yes|Allow)` instead of `❯ 1\. Yes`
2. Prioritizes "don't ask again" options (most permissive)
3. Extracts option number dynamically instead of hardcoding 1 or 2
4. Better logging: shows which option and why

### Recommendation 3: Audit via prompt capture session

**Priority: LOW — do this once to validate the above changes**

After applying Recommendations 1 and 2, run a controlled audit:

1. Launch `claude-session claude-agents` with updated `--allowedTools`
2. Have each agent run `/xpo.claude.monitor {role}` and process one task
3. Monitor all panes for any remaining permission prompts
4. Log any prompts that still appear — these are the remaining gaps
5. Add missing patterns to `ALLOWED_TOOLS`

---

## STUDY

### Why agents still get prompted despite `--allowedTools`

The `--allowedTools Bash(source:*)` pattern matches commands WHERE THE FIRST TOKEN IS `source`. But:
- Agent writes `CLI=/path/to/cli.js` → needs `Bash(CLI:*)`
- Agent writes `AGENT_ROLE=pdsa node script.js` → needs `Bash(AGENT_ROLE:*)`
- Each new variable prefix is a new gap

This is fundamentally fragile. The pattern syntax `Bash(prefix:*)` is a prefix-match on the command string's first word, not on the actual program being invoked. Variable assignments, subshells, and command chaining all create new first-words.

### Two-layer defense rationale

| Layer | Purpose | When it helps |
|-------|---------|---------------|
| `--allowedTools` (preventive) | Pre-approve known tools at launch | Eliminates ~90% of prompts for common operations |
| `xpo.claude.unblock` (reactive) | Auto-confirm remaining prompts | Catches the ~10% of prompts from novel command patterns |

Both layers must be maintained. `--allowedTools` reduces the load on the unblock skill. The unblock skill catches what `--allowedTools` misses.

### Risk: `rm` exclusion

Intentionally NOT adding `Bash(rm:*)` to `--allowedTools`. File deletion should require confirmation. However, agents frequently use `rm` in cleanup patterns (`rm -f /tmp/tempfile`). If this becomes a bottleneck, consider adding `Bash(rm:*-f /tmp/*)` if Claude Code supports path-scoped patterns, or accept the prompt overhead.

---

## ACT

### Implementation order

1. **DEV updates `claude-session.sh`** — expand ALLOWED_TOOLS array (Recommendation 1)
2. **DEV updates `xpo.claude.unblock/SKILL.md`** — improve prompt detection (Recommendation 2)
3. **Test** — restart session with new config, verify fewer/no prompts
4. **Audit** — capture remaining prompts over one full task cycle (Recommendation 3)

### Files to change

| File | Change | Owner |
|------|--------|-------|
| `HomeAssistant/systems/synology-ds218/features/infrastructure/scripts/claude-session.sh` | Expand ALLOWED_TOOLS (lines 72-123) | DEV |
| `~/.claude/skills/xpo.claude.unblock/SKILL.md` | Update detection pattern in "Start Monitoring" section | DEV |

### Acceptance criteria

1. ALLOWED_TOOLS expanded from 51 to ~80 patterns including `Glob`, `Grep`, `Task`, `Skill`
2. Unblock skill detects broader prompt patterns (not just `❯ 1. Yes`)
3. A full task cycle (wake → claim → work → transition) produces zero permission prompts for common operations
4. `rm` and destructive git ops still require confirmation (safety preserved)
5. Unblock skill logs which option was selected and why (debugging)

### What NOT to change

- Do NOT add `Bash(rm:*)` — keep file deletion gated
- Do NOT change the `tail -8` approach in unblock — it's proven stable
- Do NOT add a catch-all `Bash(*:*)` — maintain explicit patterns for auditability
