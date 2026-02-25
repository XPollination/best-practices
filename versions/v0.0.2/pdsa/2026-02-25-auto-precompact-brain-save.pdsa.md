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
3. Extract meaningful context from transcript using smart extraction (see below)
4. Contribute to brain: `"Pre-compact save ({trigger}) for {ROLE} agent: {context_summary}"`
5. Exit 0 (hook must not block compaction)

**Key constraints:**
- Must complete fast (< 5 seconds) — hook blocks compaction
- Must not fail loudly — if brain is down, exit silently
- Transcript is JSONL format — NOT simple text
- Brain contribution limit: prompt must be < 10,000 chars

### JSONL Transcript Format (from analysis of live session)

A typical session transcript has ~700 lines (1.4MB). Line types:

| Type | Count | Avg size | Content |
|------|-------|----------|---------|
| `assistant` | 237 | 1,551B | Agent output: text blocks + tool_use blocks |
| `user` | 178 | 3,428B | User input + system reminders (large!) |
| `progress` | 220 | 1,862B | Tool execution progress (bash output, etc.) |
| `file-history-snapshot` | 37 | 513B | File state snapshots |
| `system` | 8 | 449B | System messages |

**Key insight:** 50 raw lines = ~75KB of mixed data, mostly noise (progress, system). The useful context is in `assistant` type lines with `text` content blocks (not `tool_use` blocks). These contain the agent's reasoning, decisions, and status updates.

### Smart Extraction Strategy

**Step 1: Find task context** — grep for task slugs in recent assistant text blocks
```bash
# Extract last 100 assistant lines, find text blocks, take last 10
tail -200 "$TRANSCRIPT_PATH" | \
  grep '"type":"assistant"' | \
  python3 -c "
import sys, json
texts = []
for line in sys.stdin:
    try:
        d = json.loads(line)
        for block in d.get('message',{}).get('content',[]):
            if isinstance(block, dict) and block.get('type') == 'text':
                texts.append(block['text'])
    except: pass
# Take last 10 text blocks, truncate each to 200 chars
for t in texts[-10:]:
    print(t[:200])
"
```

**Step 2: Build summary** — concatenate extracted texts (max 2000 chars total for brain)

**Why 10 text blocks:** Assistant text blocks average ~100 chars of meaningful content (after tool calls are filtered). 10 blocks = ~1000 chars = comfortably under brain's 10,000 char limit while capturing the agent's recent reasoning chain.

**Why python3:** The JSONL parsing requires JSON decoding of nested structures (message.content[].type == "text"). Pure bash grep/sed would be fragile. python3 is available on the system and adds ~50ms overhead — well within the 5s budget.

**Fallback:** If python3 fails or transcript is unreadable, contribute a minimal save: `"Pre-compact save for {ROLE}: context extraction failed, manual recovery needed."` This ensures brain always gets a timestamp marker for the compact event.

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

### Rework: Transcript Analysis (requested by Thomas)

**Q1: What does a JSONL transcript line contain?**
Each line is a complete JSON object. Lines have a `type` field: `assistant` (agent output), `user` (input + system), `progress` (tool execution), `file-history-snapshot`, `system`. Assistant lines contain a `message.content` array with blocks of type `text` (reasoning) or `tool_use` (tool calls). Only `text` blocks contain meaningful context.

**Q2: How many lines does a typical mid-task context require?**
A single task cycle (claim → analyze → write findings → transition) generates ~50-80 assistant lines, of which ~15-20 are text blocks (the rest are tool calls). The last 10 text blocks capture the most recent reasoning chain — typically 1-2 complete task actions.

**Q3: Why 10 text blocks, not 50 raw lines?**
50 raw lines = ~75KB of mixed types (progress, snapshots, tool calls) — mostly noise. 10 filtered assistant text blocks = ~1-2KB of pure reasoning — the agent's actual decisions and status. Quality over quantity. Brain's vector search matches on semantic content, so even a 200-char summary of "working on task X, found Y, next step Z" is sufficient for recovery.

**Q4: 5-second timeout constraint?**
`tail -200` on a 1.4MB file: <10ms. `grep + python3 JSON parse`: ~50-100ms. `curl to brain API`: ~200ms. Total: <500ms — well within 5s budget even with 3x safety margin.

---

## STUDY

*To be filled after implementation*

---

## ACT

*To be filled after study*
