# PDSA: Auto Layer 3 Micro-Gardening on Task Completion

**Task:** gardener-v003-layer3-skipped
**Date:** 2026-02-27
**Status:** Design

## Plan

Move micro-gardening from agent responsibility (SKILL.md step 7d) to CLI automation (interface-cli.js). When the CLI processes a transition to `complete`, it automatically creates a consolidation thought from DNA content. No agent compliance needed.

## Root Cause

The SKILL.md step 7d is optional ("best-effort") and buried after the critical transition. Agents under task flow momentum skip it. 3/3 completions missed in the observed session. This is a design gap — enforcement belongs in the toolchain, not agent instructions.

## Options Evaluated

### Option A: CLI-level micro-garden (RECOMMENDED)
- After successful `complete` transition, CLI queries brain for task thoughts and creates consolidation
- Automatic, synchronous, part of transition flow
- ~30 lines in interface-cli.js
- **Trade-off:** Adds ~2-3s to complete transitions (brain API calls)

### Option B: Garden queue file + async worker
- CLI writes `/tmp/garden-queue/<slug>.json`, monitor picks up and gardens
- Decoupled, non-blocking
- **Trade-off:** New moving part (queue file + monitor changes). More complex. Gardening can be indefinitely delayed.

### Option C: Enrich complete brain marker only
- Make the `TASK →complete` marker include DNA summary instead of sparse text
- Simplest change (~5 lines)
- **Trade-off:** Doesn't archive old intermediate markers. Partial solution.

### Option D: Keep agent-level (status quo)
- **Rejected:** Already proven unreliable.

## Design Spec (Option A)

### Changes to `interface-cli.js`

Add `microGarden()` function and call it after successful `complete` transition:

```javascript
// After line 491 (brain marker), before output:
if (newStatus === 'complete') {
  const gardenResult = await microGarden(node.slug, actor, project, updatedDna);
  if (gardenResult) result.gardening = gardenResult;
}
```

### `microGarden(slug, actor, project, dna)` function:

1. **Query** brain for task-related thoughts (read_only:true, topic filter):
   ```
   POST /api/v1/memory { prompt: "task: <slug>", read_only: true, full_content: true }
   ```

2. **Build** consolidation summary from DNA:
   ```
   TASK SUMMARY: <title> (<project>)
   Outcome: <status from findings or "completed">
   Key findings: <dna.findings summary, max 200 chars>
   Implementation: <dna.implementation.summary or "N/A">
   Reviews: <PDSA verdict>, <QA verdict>
   ```

3. **Contribute** consolidation thought:
   ```
   POST /api/v1/memory {
     prompt: <summary>,
     agent_id: "system",
     agent_name: "GARDENER",
     thought_category: "task_summary",
     topic: <slug>,
     context: "auto-garden on complete"
   }
   ```

4. **Return** result:
   ```json
   { "status": "ok", "summary_contributed": true }
   ```
   Or on failure: `{ "status": "skipped", "reason": "brain error" }`

### Output format

Successful transition with gardening:
```json
{
  "success": true,
  "slug": "my-task",
  "transition": "review->complete",
  "actor": "liaison",
  "gardening": { "status": "ok", "summary_contributed": true }
}
```

### Backward Compatibility
- New `gardening` field in output — additive only
- If brain is down, gardening is skipped silently (transition already succeeded)
- Old CLI versions without this change still work — just no auto-gardening
- `layer3_enabled` config in SKILL.md becomes moot (CLI handles it), but can stay for manual runs

### What about archiving old markers?
Deferred to v0.0.4. The consolidation thought is the primary value. Old intermediate markers (TASK START, status updates) naturally decay via pheromone weight over time. Active archiving is nice-to-have, not critical.

## Study (Post-Implementation)

To be filled after dev implements and QA tests.

## Act

To be filled after study.
