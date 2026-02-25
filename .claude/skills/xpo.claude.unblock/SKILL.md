---
name: xpo.claude.unblock
description: Manual fallback — monitor tmux panes and auto-confirm permission prompts
user-invocable: true
allowed-tools: Bash, Read, TaskStop
---

# Agent Prompt Unblock (Manual Fallback)

Auto-confirm permission prompts in tmux panes so agents stay unblocked.

**Note:** This is a manual fallback. The primary approach is `--allowedTools` at launch (see claude-session.sh). Use this skill only when agents still get prompted for commands not covered by `--allowedTools`, or for ad-hoc unblocking.

## Usage

```
/xpo.claude.unblock <targets...>     Start monitoring (e.g., /xpo.claude.unblock pdsa dev)
/xpo.claude.unblock stop             Stop all running monitors
/xpo.claude.unblock status           Check monitor logs
```

**Targets:** `liaison`, `pdsa`, `qa`, `dev`, or explicit pane IDs like `claude-agents:0.2`

## Pane Map

| Name | Pane |
|------|------|
| liaison | `{session}:0.0` |
| pdsa | `{session}:0.1` |
| dev | `{session}:0.2` |
| qa | `{session}:0.3` |

Detect session: `tmux list-sessions -F '#{session_name}' 2>/dev/null | grep claude`

## Start Monitoring

For EACH target, start a **separate** background bash loop using `run_in_background: true`:

```bash
while true; do
  output=$(tmux capture-pane -t <PANE> -p 2>/dev/null)
  if echo "$output" | grep -qE '❯ 1\. Yes'; then
    if echo "$output" | grep -qE '2\. Yes'; then
      tmux send-keys -t <PANE> 2
      echo "[$(date +%H:%M:%S)] <NAME>: Confirmed option 2 (allow all)"
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

## Stop Monitoring

Use `TaskStop` for each running monitor task ID. Report: "Monitor stopped."

## CRITICAL RULES (v5 — learned from 4 failed iterations)

1. **ONLY handle `❯ 1. Yes` permission prompts.** Nothing else. Ever.
2. **NEVER send Enter for "accept edits on".** It's a mode indicator, not a prompt.
3. **NEVER summarize or add context after monitoring stops.**
4. **Prefer option 2** ("Yes, allow all during session") to reduce future prompts.

## Iteration History

| Version | What it tried | Bug |
|---------|--------------|-----|
| v1 | Enter on "accept edits on" always | Interfered with human typing |
| v2 | Enter on "accept edits on" + activity keywords | Activity keywords always match stale scrollback |
| v3 | Same as v2 with pause rules | Same scrollback bug, 98 false Enters in 5 min |
| v4 | `tail -5` idle detection | Human input wraps, pushes `❯` above tail window |
| **v5** | **Permission prompts only** | **No bugs. Simple. Reliable.** |

## PDSA Reference

Full history: `HomeAssistant/systems/hetzner-cx22-ubuntu/pdca/monitoring/2026-02-13-agent-prompt-monitoring.pdsa.md`
