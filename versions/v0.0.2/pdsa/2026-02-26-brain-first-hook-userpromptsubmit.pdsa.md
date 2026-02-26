# PDSA: Brain-First Hook — UserPromptSubmit Auto-Enforcement

**Slug:** `brain-first-hook-userpromptsubmit`
**Date:** 2026-02-26
**Author:** PDSA agent
**Status:** DESIGN

---

## PLAN

### Problem
The brain-first workflow rule (read brain before work, write brain after work) exists as a protocol but agents skip it when tasks feel simple. On 2026-02-26, LIAISON skipped the brain-read gate on a TU Graz correction because it felt obvious. Protocol compliance cannot depend on agent discipline — it must be automated.

### Goal
Implement a Claude Code `UserPromptSubmit` hook that automatically queries the brain before every user prompt is processed, injecting relevant knowledge as additional context. If brain is down, block the prompt (hard gate).

### Context
- Two existing hooks: `PreCompact` (saves state) and `SessionStart` (compact recovery)
- Brain API at `localhost:3200`
- Agent role available via `AGENT_ROLE` env var
- Claude Code hooks: stdin JSON → process → stdout JSON + exit code

---

## DO

### 1. Hook Interface (UserPromptSubmit)

**Input (stdin JSON):**
```json
{
  "session_id": "abc123",
  "transcript_path": "/path/to/transcript.jsonl",
  "cwd": "/current/working/directory",
  "permission_mode": "default",
  "hook_event_name": "UserPromptSubmit",
  "prompt": "The user's actual message text"
}
```

**Output (stdout JSON):**
```json
{
  "hookSpecificOutput": {
    "hookEventName": "UserPromptSubmit",
    "additionalContext": "Brain knowledge injected here"
  }
}
```

**Exit codes:**
- `0` = success (Claude processes prompt with injected context)
- `2` = block (prompt rejected, stderr shown to user as error)
- Other = non-blocking error (ignored, stderr shown in verbose mode only)

**Key constraint:** Hook cannot modify the prompt — only add context or block entirely.

### 2. Hook Script Design

**File:** `best-practices/scripts/xpo.claude.brain-first-hook.sh`

```bash
#!/bin/bash
#===============================================================================
# xpo.claude.brain-first-hook.sh — Brain-first protocol enforcement
#
# UserPromptSubmit hook: queries brain with user prompt before processing.
# Injects brain response as additionalContext so Claude has prior knowledge.
# Blocks prompt if brain is unavailable (hard gate).
#
# Requires: AGENT_ROLE env var (set by claude-session.sh)
# Requires: Brain API at localhost:3200
# Requires: jq for JSON parsing
#
# Exit 0 + JSON = inject brain context
# Exit 2 = block (brain down = no action)
#===============================================================================

set -uo pipefail

ROLE="${AGENT_ROLE:-unknown}"
BRAIN_URL="http://localhost:3200/api/v1/memory"
BRAIN_HEALTH_URL="http://localhost:3200/api/v1/health"
AGENT_ID="agent-${ROLE}"
AGENT_NAME=$(echo "$ROLE" | tr 'a-z' 'A-Z')
TIMEOUT_HEALTH=2
TIMEOUT_QUERY=5

# --- 1. Read stdin JSON ---
INPUT=$(cat)
PROMPT=$(echo "$INPUT" | jq -r '.prompt // empty')
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')

# --- 2. Skip empty prompts (slash commands, etc.) ---
if [ -z "$PROMPT" ] || [ ${#PROMPT} -lt 5 ]; then
  exit 0
fi

# --- 3. Brain health check (fast fail) ---
HEALTH=$(curl -s --connect-timeout "$TIMEOUT_HEALTH" \
  --max-time "$TIMEOUT_HEALTH" "$BRAIN_HEALTH_URL" 2>/dev/null || echo "")

if ! echo "$HEALTH" | grep -q '"ok"'; then
  echo "Brain API unavailable. Cannot proceed without brain-first knowledge check." >&2
  exit 2
fi

# --- 4. Query brain with user prompt as context ---
# Truncate prompt to 500 chars to stay within brain limits
QUERY_PROMPT="${PROMPT:0:500}"

RESPONSE=$(curl -s --max-time "$TIMEOUT_QUERY" -X POST "$BRAIN_URL" \
  -H "Content-Type: application/json" \
  -d "$(jq -n \
    --arg prompt "Context for ${AGENT_NAME} agent: ${QUERY_PROMPT}" \
    --arg agent_id "$AGENT_ID" \
    --arg agent_name "$AGENT_NAME" \
    --arg session_id "$SESSION_ID" \
    '{prompt: $prompt, agent_id: $agent_id, agent_name: $agent_name, session_id: $session_id}'
  )" 2>/dev/null || echo "")

# --- 5. Extract brain response ---
if [ -z "$RESPONSE" ]; then
  # Brain query failed after health check passed — soft fail, allow prompt
  exit 0
fi

# Extract top 3 sources with previews
BRAIN_CONTEXT=$(echo "$RESPONSE" | jq -r '
  .result.sources[:3] |
  map("[" + (.contributor // "unknown") + "] " + (.content_preview // "")) |
  join("\n")
' 2>/dev/null || echo "")

# Extract highways
HIGHWAYS=$(echo "$RESPONSE" | jq -r '
  .result.highways_nearby[:3] | join("\n")
' 2>/dev/null || echo "")

# --- 6. Build injection context ---
if [ -z "$BRAIN_CONTEXT" ] || [ "$BRAIN_CONTEXT" = "null" ]; then
  # No relevant knowledge found — proceed without injection
  exit 0
fi

CONTEXT="## Brain Knowledge (auto-injected by brain-first hook)
### Relevant Thoughts
${BRAIN_CONTEXT}
### High-Traffic Paths
${HIGHWAYS:-none}"

# --- 7. Return JSON with additionalContext ---
jq -n --arg ctx "$CONTEXT" '{
  hookSpecificOutput: {
    hookEventName: "UserPromptSubmit",
    additionalContext: $ctx
  }
}'

exit 0
```

### 3. Settings.json Update

**Current hooks:** PreCompact, SessionStart (compact matcher)
**Addition:** UserPromptSubmit (no matcher — fires on every prompt)

```json
{
  "permissions": {
    "allow": ["Bash(nvm-exec:*)"]
  },
  "hooks": {
    "PreCompact": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash /home/developer/workspaces/github/PichlerThomas/best-practices/scripts/xpo.claude.precompact-save.sh"
          }
        ]
      }
    ],
    "SessionStart": [
      {
        "matcher": "compact",
        "hooks": [
          {
            "type": "command",
            "command": "bash /home/developer/workspaces/github/PichlerThomas/best-practices/scripts/xpo.claude.compact-recover.sh"
          }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash /home/developer/workspaces/github/PichlerThomas/best-practices/scripts/xpo.claude.brain-first-hook.sh"
          }
        ]
      }
    ]
  }
}
```

**Note:** UserPromptSubmit ignores the `matcher` field — it fires on every prompt. No matcher is specified.

### 4. Brain Query Format

| Field | Value | Rationale |
|---|---|---|
| `prompt` | `"Context for {AGENT_NAME} agent: {truncated user prompt}"` | Personalizes retrieval to agent role; prefix ensures brain retrieves role-relevant knowledge |
| `agent_id` | `"agent-{role}"` | Consistent with all other brain interactions |
| `agent_name` | `"{ROLE}"` | Uppercase role name |
| `session_id` | From stdin JSON | Enables session continuity and implicit feedback |

**Prompt truncated to 500 chars** to prevent excessive brain queries on long messages (e.g., pasted code blocks).

### 5. Injection Format

The `additionalContext` appears in Claude's context as a system-reminder-style injection:

```
## Brain Knowledge (auto-injected by brain-first hook)
### Relevant Thoughts
[LIAISON] XPollination Gründung state 2026-02-26: EPU path, Befähigungsprüfung...
[PDSA] Brain-gated transitions with synchronous health check designed for task-b...
[Thomas Pichler] Brain contribution quality lesson: Current brain stores breadcru...
### High-Traffic Paths
Role boundaries prevent coordination collapse...
```

**Design decisions:**
- Top 3 sources only (not all 10) — avoids context pollution
- Content previews (not full content) — keeps injection small
- Highways included for situational awareness
- Section header `## Brain Knowledge (auto-injected)` makes it clear this is automated, not user input

### 6. Error Handling

| Scenario | Behavior | Exit Code |
|---|---|---|
| Brain API down (health check fails) | Block prompt, stderr: "Brain API unavailable" | 2 (hard block) |
| Brain API slow (>5s query timeout) | Allow prompt, no injection | 0 |
| Brain returns empty/no results | Allow prompt, no injection | 0 |
| jq not installed | Script fails, Claude proceeds | non-zero (ignored) |
| Empty/short prompt (<5 chars) | Skip brain query, allow | 0 |
| Malformed brain response | jq extraction fails, allow prompt | 0 |

**Hard gate vs soft fail:** Only a complete brain outage (health check fail) blocks. Slow responses, empty results, or parse errors are soft fails — the prompt proceeds without injection. This prevents the hook from becoming a bottleneck.

### 7. Performance Considerations

- **Health check:** 2s timeout (fast fail)
- **Brain query:** 5s timeout
- **Total worst case:** 7s added to every prompt submission
- **Typical case:** Brain is local (same machine), <200ms for health + query

**Optimization (future):** Cache the last health check result for 30s to skip redundant checks. Not designed here — premature until latency is measured.

### 8. Write-Gate Limitation

The `UserPromptSubmit` hook solves the **READ gate** — brain knowledge is automatically injected before every agent action.

The **WRITE gate** (contribute to brain after work) is harder to automate:

- `Stop` hook fires when Claude finishes but cannot force brain contribution
- `PostToolUse` could fire after git commit, but cannot access conversation context to determine what was learned
- The agent itself is the only entity that knows what it learned during a task

**Proposed future approach (out of scope):**

A `PreToolUse` hook on `Bash(git commit*)` that checks whether the current session has contributed to brain:

```bash
# Check if brain was written to in this session
CONTRIBUTED=$(curl -s "$BRAIN_URL" -d '{"prompt":"check"}' |
  jq '.trace.thoughts_contributed')
if [ "$CONTRIBUTED" = "0" ]; then
  echo "No brain contribution in this session. Consider contributing before committing." >&2
  # Don't block (exit 0) — just warn
fi
```

This is advisory, not blocking, because the agent may legitimately have nothing new to contribute. The write-gate remains a protocol requirement enforced by SKILL.md instructions, not by hooks.

### 9. Files to Create/Modify

| File | Action | Description |
|---|---|---|
| `best-practices/scripts/xpo.claude.brain-first-hook.sh` | CREATE | Hook script |
| `~/.claude/settings.json` | EDIT | Add UserPromptSubmit hook entry |

### Acceptance Criteria Mapping

| AC | Section | How Met |
|----|---------|---------|
| Hook script designed with error handling and timeout | Section 2 | Full script with health check (2s), query (5s), 6 error scenarios |
| Settings.json change documented | Section 3 | Full settings.json with all 3 hooks shown |
| Brain query format defined | Section 4 | Prompt format, truncation, agent_id, session_id |
| Injection format defined | Section 5 | additionalContext with top 3 sources + highways |
| Write-gate limitation documented | Section 8 | PreToolUse proposal, advisory not blocking |
| PDSA document created | This file | In best-practices/versions/v0.0.2/pdsa/ |

---

## STUDY

*To be completed after implementation review.*

## ACT

*To be completed after study phase.*
