# PDSA: Transition Micro-Gardening Hook (Layer 3)

**Task:** `gardener-transition-layer3`
**Date:** 2026-02-27
**Phase:** Plan

## Plan

### What
After task completion (transition to `complete`), the completing agent calls the gardener engine to consolidate that task's brain thread. Distributed gardening — each task cleans up after itself.

### Design

**File:** `best-practices/.claude/skills/xpo.claude.monitor/SKILL.md`

**Change 1: Add config section** near the top (or in existing reference section):

```yaml
## Configuration

gardening:
  layer3_enabled: true   # Set to false to skip post-completion gardening
```

**Change 2: Add Step 7d — Micro-Gardening** after step 7b (transition marker):

```markdown
# 7d. Post-completion micro-gardening (Layer 3)
# Only runs when transitioning to complete AND layer3_enabled is true
# Consolidates this task's brain thread into one summary thought

if [ "<next-state>" = "complete" ] && layer3_enabled; then
  /xpo.claude.mindspace.garden task:<slug> micro
fi
```

The agent should:
1. Check if the transition target is `complete`
2. Check if `layer3_enabled: true` in the configuration
3. If both true: invoke `/xpo.claude.mindspace.garden task:<slug> micro`
4. The gardener will consolidate task-related thoughts and archive intermediates
5. If gardener fails: log warning but don't block the completion

### Where It Fires
- LIAISON transitions `review+liaison → complete` (the most common completion path)
- The completing agent runs the gardener after executing the transition

### What It Does NOT Do
- Does NOT run on non-complete transitions (active, review, rework, etc.)
- Does NOT do cross-domain gardening (micro depth only)
- Does NOT block task completion if gardener fails

### Acceptance Criteria
1. On task completion with Layer 3 enabled, consolidation thought is created
2. Intermediate entries (task start markers, status updates) archived for that task
3. Setting `layer3_enabled: false` skips gardening
4. Gardener failure does not block task completion

### Effort
Small — ~10 lines added to monitor SKILL.md. Just a conditional hook call.

## Do
(DEV implements)

## Study
(Post-implementation)

## Act
(Post-study)
