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
    elif echo "$output" | grep -qE '2\. Yes'; then
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

**Why `tail -8`:** Permission prompts appear at the bottom of the pane. Full scrollback contains old prompts that have already been answered — matching those injects keystrokes into the agent's input buffer as literal text. `tail -8` ensures we only see the current prompt area.

## Stop Monitoring

Use `TaskStop` for each running monitor task ID. Report: "Monitor stopped."

## CRITICAL RULES (v7 — learned from 6 failed iterations)

1. **ONLY handle `❯ N. Yes/Allow` permission prompts.** Nothing else. Ever.
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
| v5 | Permission prompts only (full scrollback) | Stale scrollback matches old prompts, sends keystrokes into input buffer |
| v6 | Permission prompts only + tail -8 | Only checks last 8 lines. No stale matches. |
| **v7** | **Broader prompt detection (Yes/Allow patterns) + dynamic option extraction** | **Handles all Claude Code prompt variants** |

## PDSA Reference

Full history: `HomeAssistant/systems/hetzner-cx22-ubuntu/pdca/monitoring/2026-02-13-agent-prompt-monitoring.pdsa.md`
