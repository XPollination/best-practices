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

## DO (Design)

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

**Logic:**
1. Read JSON input from stdin, extract `transcript_path` and `trigger`
2. Read `AGENT_ROLE` env var (set by `claude-session.sh` at launch)
3. Extract recent context from transcript: last 50 lines of the JSONL file (agent's recent work)
4. Summarize: extract task slugs, key decisions, current status from recent lines
5. Contribute to brain: `"Pre-compact save ({trigger}) for {ROLE} agent: Working on {task}. Key context: {summary}"`
6. Exit 0 (hook must not block compaction)

**Key constraints:**
- Must complete fast (< 5 seconds) — hook blocks compaction
- Must not fail loudly — if brain is down, exit silently
- Must extract useful context without parsing full conversation
- Transcript is JSONL format — each line is a JSON object with role, content, etc.

**Implementation approach for context extraction:**
```bash
# Extract recent assistant messages (agent's own output) from JSONL
# These contain task context, decisions, findings
tail -50 "$TRANSCRIPT_PATH" | grep '"role":"assistant"' | tail -5 | \
  grep -oP '"text":"[^"]{0,200}' | sed 's/"text":"//' | tr '\n' ' '
```

This gives a ~1000 char summary of the agent's recent output — enough for brain to store and return on recovery.

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

### Acceptance Criteria

**AC1:** PreCompact hook configured in `~/.claude/settings.json`
**AC2:** `xpo.claude.precompact-save.sh` exists and is executable
**AC3:** Script reads AGENT_ROLE env var and transcript_path from stdin JSON
**AC4:** Script contributes to brain with pre-compact context summary
**AC5:** Script completes in < 5 seconds
**AC6:** Script exits cleanly (exit 0) when brain is unavailable
**AC7:** After auto-compact, recovery query returns the pre-compact save context
**AC8:** Manual test: `echo '{"transcript_path":"/tmp/test.jsonl","trigger":"manual"}' | AGENT_ROLE=pdsa bash xpo.claude.precompact-save.sh` succeeds

---

### Open Decision

**Transcript parsing depth:** The JSONL transcript can be large. Current design takes last 50 lines and extracts assistant messages. Alternative: use a more sophisticated parser that finds the most recent task DNA references. For v1, simple tail + grep is sufficient — brain retrieval will match on keywords regardless.

---

## STUDY

*To be filled after implementation*

---

## ACT

*To be filled after study*
