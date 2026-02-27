# PDSA: Automate Pre-Compact Brain Contribution

**Date:** 2026-02-25
**Version:** xpollination-mcp-server (cross-project)
**Status:** PLAN
**Task:** `auto-precompact-brain-save`

---

## PLAN

### Problem

When Claude Code's context window fills up, auto-compact triggers. Agents lose their working context — current task, findings, decisions. The post-compact recovery hook (`SessionStart` matcher `compact`) restores role identity from brain, but can only retrieve what was previously saved. If the agent didn't manually contribute before compact, the working context is lost.

Thomas's requirement: "I want it to be automatic process. Zero agent discipline required."

### Key Finding

**Claude Code supports a `PreCompact` hook event.** It fires BEFORE context compaction with:
- `trigger`: "manual" or "auto"
- `transcript_path`: path to the conversation JSON file
- `session_id`: current session ID

This is the missing piece. A PreCompact hook can automatically save the agent's working context to brain before compaction occurs.

### Current State

| Hook | Event | What It Does |
|------|-------|-------------|
| Post-compact recovery | `SessionStart` (matcher: `compact`) | Recovers role identity + task state from brain |
| **Pre-compact save** | **`PreCompact`** | **MISSING — this task adds it** |

### Architecture

```
Agent working... context fills up
    ↓
PreCompact hook fires
    ↓
xpo.claude.precompact-save.sh runs:
  1. Read AGENT_ROLE env var
  2. Extract last ~50 lines from transcript (recent context)
  3. Contribute to brain: "Pre-compact save for {role}: {summary}"
    ↓
Compaction occurs (context compressed)
    ↓
SessionStart hook fires (matcher: compact)
    ↓
xpo.claude.compact-recover.sh runs:
  Recovers role + task state from brain (including pre-compact save)
    ↓
Agent continues with recovered context
```

---

## DO (Design — Rework 2: Structured Handoff)

### Insight from Rework

Raw transcript extraction captures WHAT the agent was doing but not WHY or WHAT IS NEXT. For recovery, "what is next" is the most valuable information. A person writing a handoff note vs someone photocopying the last page of their notebook.

**New approach:** Build a structured handoff from multiple sources — PM system (task state), transcript (recent reasoning), and environment (infrastructure).

### New Script: `xpo.claude.precompact-save.sh`

**Location:** `best-practices/scripts/xpo.claude.precompact-save.sh`

**Input:** JSON on stdin from Claude Code hook system:
```json
{
  "session_id": "abc123",
  "transcript_path": "/home/developer/.claude/projects/.../session.jsonl",
  "hook_event_name": "PreCompact",
  "trigger": "manual|auto"
}
```

**Key constraints (unchanged):**
- Must complete fast (< 5 seconds) — hook blocks compaction
- Must not fail loudly — if brain is down, exit silently
- Brain contribution limit: prompt must be < 10,000 chars

### Structured Handoff: Three Data Sources

**Source 1: PM System (WHAT tasks, WHAT status)**

Query each project DB for active tasks assigned to this agent's role:

```bash
ROLE="${AGENT_ROLE:-unknown}"
CLI="/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/src/db/interface-cli.js"
BASE="/home/developer/workspaces/github/PichlerThomas"

TASK_STATE=""
for project_db in \
  "$BASE/xpollination-mcp-server/data/xpollination.db" \
  "$BASE/HomePage/data/xpollination.db" \
  "$BASE/best-practices/data/xpollination.db"; do

  if [ -f "$project_db" ]; then
    # Direct sqlite3 query — faster than node CLI, no nvm needed
    result=$(sqlite3 "$project_db" \
      "SELECT slug, status, json_extract(dna_json, '$.title') FROM mindspace_nodes WHERE role='$ROLE' AND status NOT IN ('complete','cancelled','pending') LIMIT 5" 2>/dev/null)
    if [ -n "$result" ]; then
      project_name=$(basename "$(dirname "$(dirname "$project_db")")")
      TASK_STATE="${TASK_STATE}${project_name}: ${result}\n"
    fi
  fi
done
```

Time: ~50ms per DB × 3 = ~150ms.

**Source 2: Transcript (WHAT the agent was reasoning about)**

Extract last 5 assistant text blocks — the agent's most recent thoughts:

```bash
RECENT_CONTEXT=""
if [ -n "$TRANSCRIPT_PATH" ] && [ -f "$TRANSCRIPT_PATH" ]; then
  RECENT_CONTEXT=$(tail -200 "$TRANSCRIPT_PATH" | \
    grep '"type":"assistant"' | \
    python3 -c "
import sys, json
texts = []
for line in sys.stdin:
    try:
        d = json.loads(line)
        for block in d.get('message',{}).get('content',[]):
            if isinstance(block, dict) and block.get('type') == 'text':
                texts.append(block['text'][:200])
    except: pass
for t in texts[-5:]:
    print(t)
" 2>/dev/null)
fi
```

Time: ~100ms. Reduced from 10 to 5 blocks — PM system provides the structured context, transcript just adds recent reasoning.

**Source 3: Environment (WHAT infrastructure is running)**

```bash
SESSION_FILE="/tmp/${ROLE}-session-id.txt"
SESSION_ID=$(cat "$SESSION_FILE" 2>/dev/null || echo "unknown")
MONITOR_PID=$(pgrep -f "agent-monitor.cjs $ROLE" 2>/dev/null || echo "not running")
```

Time: ~10ms.

### Assembly: Structured Brain Contribution

```bash
HANDOFF="Pre-compact structured save (${TRIGGER}) for ${ROLE} agent:
## Active Tasks
${TASK_STATE:-No active tasks found}
## Recent Reasoning
${RECENT_CONTEXT:-No transcript available}
## Infrastructure
Session: ${SESSION_ID}
Monitor PID: ${MONITOR_PID}
Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Truncate to 8000 chars (safety margin under 10K brain limit)
HANDOFF="${HANDOFF:0:8000}"

# Contribute to brain
curl -s --max-time 3 -X POST http://localhost:3200/api/v1/memory \
  -H "Content-Type: application/json" \
  -d "$(python3 -c "
import json, sys
print(json.dumps({
    'prompt': sys.argv[1],
    'agent_id': 'agent-' + sys.argv[2],
    'agent_name': sys.argv[2].upper(),
    'session_id': sys.argv[3],
    'context': 'pre-compact-save'
}))
" "$HANDOFF" "$ROLE" "$SESSION_ID")" >/dev/null 2>&1
```

Time: ~200ms for curl (3s timeout).

**Total estimated time:** 150ms (DB) + 100ms (transcript) + 10ms (env) + 200ms (curl) = **~460ms** — well within 5s budget.

### Why this is better than raw extraction

| Dimension | Raw extraction (v1) | Structured handoff (v2) |
|-----------|-------------------|----------------------|
| **Task state** | Inferred from conversation | Queried from PM system (authoritative) |
| **Recent reasoning** | 10 text blocks (1-2KB, noisy) | 5 text blocks (supporting context) |
| **What is next** | Missing | Implied by task status (active = in progress, review = waiting) |
| **Infrastructure** | Missing | Session ID, monitor PID, timestamp |
| **Recovery quality** | Agent knows WHAT it was doing | Agent knows WHAT tasks exist, their status, AND recent reasoning |

### Fallback cascade

1. **All sources available:** Full structured handoff (best quality)
2. **DB unavailable:** Transcript + env only (reduced but useful)
3. **Transcript unavailable:** PM system + env only (task state without reasoning)
4. **Everything fails:** Minimal marker: `"Pre-compact save for {ROLE}: extraction failed at {timestamp}"`

The script ALWAYS exits 0 and ALWAYS contributes something to brain — even if it's just a timestamp marker.

### Hook Configuration Change

**File:** `~/.claude/settings.json`

Add `PreCompact` hook alongside existing `SessionStart`:

```json
{
  "hooks": {
    "PreCompact": [
      {
        "type": "command",
        "command": "bash /home/developer/workspaces/github/PichlerThomas/best-practices/scripts/xpo.claude.precompact-save.sh"
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
    ]
  }
}
```

### Updated Recovery Script

**File:** `best-practices/scripts/xpo.claude.compact-recover.sh`

No changes needed — the existing recovery script queries brain for recent context. The pre-compact save will be found by the recovery query because it's stored in brain with the agent's ID and role.

---

### File Changes Summary

| File | Change | Type |
|------|--------|------|
| `best-practices/scripts/xpo.claude.precompact-save.sh` | New script — pre-compact brain save | Create |
| `~/.claude/settings.json` | Add PreCompact hook entry | Modify |

2 files. 1 new script, 1 config update.

---

### Acceptance Criteria (Rework 2)

**AC1:** PreCompact hook configured in `~/.claude/settings.json`
**AC2:** `xpo.claude.precompact-save.sh` exists and is executable
**AC3:** Script reads AGENT_ROLE env var and transcript_path from stdin JSON
**AC4:** Script queries PM system DBs for active tasks by role
**AC5:** Script extracts last 5 assistant text blocks from transcript
**AC6:** Script builds structured handoff with sections: Active Tasks, Recent Reasoning, Infrastructure
**AC7:** Brain contribution includes task slugs and statuses from PM system
**AC8:** Script completes in < 5 seconds
**AC9:** Script exits 0 when brain is unavailable (silent fallback)
**AC10:** Script exits 0 when DB or transcript is unavailable (fallback cascade)
**AC11:** Manual test: `echo '{"transcript_path":"/tmp/test.jsonl","trigger":"manual"}' | AGENT_ROLE=pdsa bash xpo.claude.precompact-save.sh` succeeds
**AC12:** After auto-compact, recovery query returns structured handoff with task state

---

### File Changes Summary (Rework 2)

| File | Change | Type |
|------|--------|------|
| `best-practices/scripts/xpo.claude.precompact-save.sh` | New script — structured pre-compact brain save | Create |
| `~/.claude/settings.json` | Add PreCompact hook entry | Modify |

2 files. 1 new script, 1 config update. Same as v1 — only the script internals changed.

---

## STUDY

*To be filled after implementation*

---

## ACT

*To be filled after study*
