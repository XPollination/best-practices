# PDSA: Systemic Gardening Enforcement — Toolchain over Agent Instructions

**Task:** gardener-v003-layer3-skipped
**Date:** 2026-02-27
**Status:** Design (rework v2)

## Plan

Move ALL mandatory gardening steps from agent skill instructions to toolchain automation. Agents skip optional skill steps under task flow momentum. The fix is systemic: **if a step must always run, implement it in a tool/script, not as an agent instruction.**

Two affected layers:
- **Layer 3** (task completion micro-gardening): Move to `interface-cli.js` transition handler
- **Layer 1** (PM status brain health): Move to `pm-status.cjs` script

## Root Cause (Systemic)

The pattern: any skill step marked optional/conditional/best-effort gets skipped by agents under task flow momentum.

**Evidence:**
- Layer 3: 3/3 task completions in session 2026-02-27 skipped step 7d (micro-gardening)
- Layer 1: 3/4 PM status calls in same session skipped step 1.5 (brain health diagnostic)

**Root cause:** Skills are instructions. Agents execute core steps reliably but drop post-steps. The more "optional" a step reads, the more likely it's skipped. This is not an agent defect — it's a design gap. Enforcement belongs in toolchain.

## Systemic Principle

```
AGENT INSTRUCTION (skill step)  →  May be skipped  →  Use for guidance only
TOOLCHAIN AUTOMATION (CLI/script) →  Always runs     →  Use for mandatory steps
```

Any mandatory gardening operation must be embedded in the tool the agent calls, not in the skill that tells the agent what to do.

## Design: Two Changes

### Change 1: Layer 3 — CLI `microGarden()` on complete transition

**File:** `xpollination-mcp-server/src/db/interface-cli.js`

After successful `complete` transition (line ~491), before output:

```javascript
if (newStatus === 'complete') {
  const gardenResult = await microGarden(node.slug, actor, project, updatedDna);
  if (gardenResult) result.gardening = gardenResult;
}
```

`microGarden(slug, actor, project, dna)`:
1. Query brain for task thoughts: `POST /api/v1/memory { prompt: "task: <slug>", read_only: true, full_content: true }`
2. Build consolidation summary from DNA fields (title, findings, implementation, reviews)
3. Contribute consolidation: `POST /api/v1/memory { prompt: <summary>, agent_name: "GARDENER", thought_category: "task_summary", topic: <slug> }`
4. Return `{ status: "ok" }` or `{ status: "skipped", reason: "..." }`

**Output:** New `gardening` field in transition result (additive, backward compatible).
**Failure mode:** If brain is down, gardening is skipped. Transition already succeeded.
**Estimate:** ~40 lines added to interface-cli.js.

### Change 2: Layer 1 — Brain health integrated into PM status script

**File:** `xpollination-mcp-server/viz/pm-status.cjs` (NEW)

Create a script that does the full PM status scan INCLUDING brain health:

```javascript
// pm-status.cjs — single script for PM status
// 1. Brain context query (Step 0)
// 2. Scan all project DBs for non-terminal tasks (Step 1)
// 3. Brain health diagnostic (Step 1.5) — ALWAYS runs, not optional
// 4. Output structured JSON with tasks + brain health
```

The PM status skill (SKILL.md) changes from:
```
Step 1: Run CLI list per project  ←  agent runs 3 commands
Step 1.5: Run gardener shallow    ←  agent runs 1 command (SKIPPED)
```
To:
```
Step 1: Run pm-status.cjs         ←  agent runs 1 command (brain health included)
```

The script outputs JSON:
```json
{
  "timestamp": "...",
  "projects": {
    "best-practices": { "tasks": [...] },
    "xpollination-mcp-server": { "tasks": [...] },
    "HomePage": { "tasks": [...] }
  },
  "brain_health": {
    "status": "healthy|attention|degraded",
    "recent_thoughts": 15,
    "noise_flagged": 2,
    "active_domains": ["gardener", "workflow"],
    "duplicates": 0
  }
}
```

The agent reads the JSON and presents it. Brain health is baked in — cannot be skipped.

**Estimate:** ~80 lines new script. ~10 lines skill update.

### SKILL.md updates

Both the monitor skill (step 7d) and PM status skill (step 1.5) get updated:
- **Monitor step 7d:** Remove or mark as "handled automatically by CLI". Keep for reference.
- **PM status step 1.5:** Remove as separate step. Brain health is now in the script output.

## Backward Compatibility

- Layer 3: New `gardening` field in CLI output — additive. Old CLIs still work.
- Layer 1: pm-status.cjs is new. Old PM status skill still works (just without guaranteed brain health). Skill update points to new script.
- Skills remain operational without the scripts — they just lose the automated steps.

## Scope

This task covers Layer 3 (CLI change) and Layer 1 (pm-status.cjs). The systemic principle is documented here for future gardening layers.

Marker archiving (consolidating old transition markers) deferred to v0.0.4.

## Study (Post-Implementation)

To be filled after dev implements and QA tests.

## Act

To be filled after study.
