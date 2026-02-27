# PDSA: PM Status Gardening Phase (Layer 1)

**Task:** `gardener-pm-status-layer1`
**Date:** 2026-02-27
**Phase:** Plan

## Plan

### What
Add a "Brain Health" section to the PM status skill. The gardener runs `scope=recent depth=shallow` before Thomas makes decisions — Study before Act.

### Design

**File:** `best-practices/.claude/skills/xpo.claude.mindspace.pm.status/SKILL.md`

**Change 1: Add config section** at the top of the skill (after the header):

```yaml
## Configuration

gardening:
  layer1_enabled: true   # Set to false to skip brain health check
```

**Change 2: Add Step 1.5 — Brain Health** between Step 1 (Scan DBs) and Step 2 (Summary Table):

```markdown
## Step 1.5: Brain Health (Layer 1 Gardening)

If `layer1_enabled: true` in configuration above:

1. Run the gardener engine with shallow analysis:
   ```
   /xpo.claude.mindspace.garden recent shallow
   ```

2. Parse the gardener output for:
   - Thoughts analyzed count
   - Noise flagged count (keyword echoes)
   - Categories/domains active
   - Potential duplicates

3. Include in the PM status summary as a "BRAIN HEALTH" section:
   ```
   BRAIN HEALTH:
     Contributions (24h): N thoughts
     Noise: M keyword echoes
     Active domains: D
     Duplicates flagged: P pairs
   ```

If `layer1_enabled: false`: skip this step entirely.
```

**Change 3: Update Step 2 summary format** to include brain health line:

```
--- Summary: N tasks | X approvals | Y reviews | Z in-pipeline | Brain: healthy/noisy ---
```

### Acceptance Criteria
1. PM status shows "BRAIN HEALTH" section with contribution counts, noise, domains
2. Setting `layer1_enabled: false` skips the brain health section
3. Only shallow depth — no mutations, read-only analysis

### Effort
Small — ~20 lines added to existing SKILL.md.

## Do
(DEV implements)

## Study
(Post-implementation)

## Act
(Post-study)
