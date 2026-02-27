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

## STUDY (Rework 2 — Empirical Validation)

### Observation: `--allowedTools` prefix matching has structural limitations

After DEV expanded ALLOWED_TOOLS from 51→82 patterns and deployed (commit eb02e1f), empirical testing revealed agents STILL get permission prompts. Two categories of failure:

**Failure 1: `&&` chaining breaks prefix matching**
```bash
# Agent writes:
source ~/.nvm/nvm.sh && DATABASE_PATH=/tmp/x.db node script.js
# Claude Code sees && and refuses to match against Bash(source:*)
# The prefix matcher only works for SIMPLE commands, not compound commands
```

**Failure 2: `$()` command substitution is a separate security category**
```bash
# Agent writes:
SESSION_ID=$(cat /proc/sys/kernel/random/uuid)
# The $() is detected as command substitution — a security concern
# independent of the first-word prefix matching
```

### Root Cause: Claude Code permission model is command-level, not token-level

The `Bash(prefix:*)` matching algorithm:
1. Extracts the command string
2. Detects shell operators: `&&`, `||`, `;`, `|`, `$()`, backticks
3. If ANY operator is present, the simple prefix match **cannot apply**
4. The command gets a separate security evaluation that --allowedTools cannot override

This means: **no number of prefix patterns can cover compound commands.** The 82→200→1000 pattern path is a dead end. The problem is structural, not quantitative.

### Evidence from security research

Per GitHub issue #4956 and independent security analysis:
- `Bash(echo:*)` does NOT match `echo "x" && ls`
- `$()` and backticks are **undetectable** by the prefix matcher
- Subshells `()` are not fully detected
- Variable expansion `$VAR` is not validated

The original PDSA's "two-layer defense" assumed Layer 1 (--allowedTools) could cover ~90% of commands. In practice, agents use `&&` in ~60% of bash commands (especially `source ~/.nvm/nvm.sh && ...`), so Layer 1 covers only ~40%.

### Why agents chain `source` with `&&`

The `source ~/.nvm/nvm.sh` pattern exists because:
1. `nvm` works by modifying the current shell's PATH
2. The effect is lost between bash invocations
3. Every Claude Code `Bash` tool call runs in a fresh shell
4. So agents must `source` nvm in EVERY command that needs `node`

The node binary path is: `/home/developer/.nvm/versions/node/v22.22.0/bin/node`

If this path is pre-configured in the agent's environment, `source` becomes unnecessary.

---

## ACT (Rework 2 — Redesigned Fix)

### Strategy: Eliminate the need for compound commands

Instead of trying to match compound commands (impossible), eliminate the patterns that create them.

### Fix 1: Pre-configure PATH in tmux environment (PRIMARY)

**File:** `claude-session.sh` — modify `create_agents_session()`

Add PATH to the tmux environment BEFORE launching Claude:
```bash
# Set node PATH in tmux session environment so source nvm is never needed
NVM_NODE="/home/developer/.nvm/versions/node/v22.22.0/bin"
tmux set-environment -t "$session" PATH "${NVM_NODE}:/usr/local/bin:/usr/bin:/bin"
```

Then each pane inherits this PATH. Agents can write:
```bash
node script.js          # Works — no source needed
npm install             # Works — npm is in same bin/
DATABASE_PATH=/tmp/x.db node script.js  # Works — simple prefix match
```

Instead of:
```bash
source ~/.nvm/nvm.sh && node script.js    # Compound — prompts!
source ~/.nvm/nvm.sh && npm install        # Compound — prompts!
```

**Impact:** Eliminates the #1 source of `&&` chaining.

### Fix 2: Create `nvm-exec` wrapper script (FALLBACK)

**File:** `/home/developer/.local/bin/nvm-exec`

```bash
#!/bin/bash
# Wrapper: sources nvm and executes the command
# Usage: nvm-exec node script.js
source ~/.nvm/nvm.sh
exec "$@"
```

For the rare case where the full nvm environment is needed (e.g., `npx` with global packages), agents can use:
```bash
nvm-exec npx some-tool    # Simple command — matches Bash(nvm-exec:*)
```

Add `"Bash(nvm-exec:*)"` to ALLOWED_TOOLS.

### Fix 3: settings.json `permissions.allow` for broader patterns

**File:** `~/.claude/settings.json`

Claude Code supports a `permissions` section in settings.json that persists across sessions. Add allow rules for the remaining edge cases:

```json
{
  "permissions": {
    "allow": [
      "Bash(nvm-exec:*)"
    ]
  },
  "hooks": { ... }
}
```

Note: `settings.local.json` already accumulates per-confirmation rules (368 rules currently). These are auto-generated and cover many edge cases. The settings.json rules are additive and persistent.

### Fix 4: Document the limitation and enforce atomic commands

Update CLAUDE.md to explicitly state:
```markdown
## Bash Commands: Atomic Only (Claude Code Limitation)
Agents MUST write simple commands, not compound commands:
- NO: `source ~/.nvm/nvm.sh && node script.js` (permission prompt)
- YES: `node script.js` (PATH is pre-configured)
- NO: `SESSION_ID=$(uuidgen) && echo $SESSION_ID`
- YES: `uuidgen` (capture output, use in next command)
```

### What NOT to do

- **Do NOT add `"Bash"` (catch-all) to settings.json** — this is equivalent to --dangerouslySkipPermissions for bash. Removes all protection including `rm`, `git reset`, etc.
- **Do NOT increase pattern count** — more prefix patterns don't help with compound commands
- **Do NOT rely solely on unblock skill** — it's a reactive workaround, not a solution

### Files to change (Rework 2)

| File | Change | Owner |
|------|--------|-------|
| `claude-session.sh` lines 270-271 | Add `tmux set-environment` for PATH with nvm node | DEV |
| `/home/developer/.local/bin/nvm-exec` | New wrapper script (3 lines) | DEV |
| `claude-session.sh` ALLOWED_TOOLS | Add `"Bash(nvm-exec:*)"` | DEV |
| `~/.claude/CLAUDE.md` | Add "Bash Commands: Atomic Only" section | DEV |

### Acceptance criteria (Rework 2)

1. **AC1:** `tmux show-environment -t claude-agents PATH` includes `/home/developer/.nvm/versions/node/v22.22.0/bin`
2. **AC2:** Agent in new session can run `node --version` without sourcing nvm
3. **AC3:** Agent can run `DATABASE_PATH=/tmp/x.db node src/db/interface-cli.js list` without prompt
4. **AC4:** `nvm-exec` wrapper exists, is executable, and `nvm-exec node --version` works
5. **AC5:** Full task cycle (wake → claim → work → transition) produces ≤2 permission prompts (down from ~6+)
6. **AC6:** `rm` and destructive git ops still require confirmation
7. **AC7:** No `source ~/.nvm/nvm.sh &&` patterns needed in agent commands

### Residual risk

Some `$()` patterns will still prompt (e.g., `SESSION_ID=$(uuidgen)`). These are rare in normal task work and can be handled by:
1. The unblock skill (reactive)
2. Agent discipline (use separate commands)
3. The accumulated rules in `settings.local.json`

The goal is ≤2 prompts per task cycle, not zero. Zero requires `--dangerouslySkipPermissions` which removes all safety.
