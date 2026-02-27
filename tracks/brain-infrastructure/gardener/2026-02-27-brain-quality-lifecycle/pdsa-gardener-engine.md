# PDSA: Gardener Engine Skill

**Task:** `gardener-engine-skill`
**Date:** 2026-02-27
**Phase:** Plan

## Plan

### What This Is

A Claude Code skill (`/xpo.claude.mindspace.garden`) that instructs the executing agent to perform brain maintenance operations. It is NOT a code module — it's an instruction set, like all SKILL.md files.

### Architecture Decision

The gardener uses existing brain API capabilities via `curl`:
- `POST /api/v1/memory` with `full_content: true` — semantic search with full content
- `GET /api/v1/memory/thought/:id` — drill down single thought
- `POST /api/v1/memory` with `refines` — supersede and replace a thought
- `POST /api/v1/memory` with `consolidates` — merge multiple thoughts

**Gap identified:** No endpoint to list/scroll thoughts by creation time. For `scope=recent` and `scope=full`, the agent needs to discover thoughts via semantic queries (multiple broad queries across domains). This is sufficient for shallow/micro depth. For deep gardening (Layer 2), a new scroll endpoint would improve coverage but is NOT blocking — the agent can use multiple targeted queries to achieve ~80% coverage.

### Skill Parameters

```
/xpo.claude.mindspace.garden [scope] [depth] [--dry-run]
```

| Param | Values | Default |
|-------|--------|---------|
| scope | `recent`, `task:<slug>`, `full` | `recent` |
| depth | `shallow`, `micro`, `deep` | `shallow` |
| --dry-run | flag | off (mutations enabled) |

### Operations by Depth

#### Shallow (read-only, ~2 min)
1. **Discover recent thoughts** — query brain with 5-6 domain keywords (e.g., "task transition", "design decision", "agent coordination", "brain quality", "implementation"). Use `full_content: true`.
2. **Count** — total retrieved, unique contributors, unique topics
3. **Flag noise** — count thoughts with `keyword_echo` in quality_flags
4. **Flag duplicates** — identify sources with >0.9 similarity scores within results
5. **Report** — output summary table:
   ```
   Brain Health (since last check):
   - New contributions: N
   - Noise entries: M (keyword_echo)
   - Potential duplicates: P pairs
   - Active domains: D
   - Top contributors: agent-X (N), agent-Y (M)
   ```

#### Micro (targeted mutations, ~5 min)
All shallow operations PLUS:
6. **Consolidate task thread** — for `scope=task:<slug>`, query all thoughts with topic matching slug. Read full content. Write ONE summary thought consolidating the task's learnings (using `consolidates` with all source IDs).
7. **Mark intermediates** — task start markers, status update markers get consolidated into the summary. Sources are auto-superseded by the consolidate operation.

#### Deep (full cycle, ~15-30 min)
All micro operations PLUS:
8. **Domain clustering** — group discovered thoughts by `thought_category` and `topic`. For each cluster with >3 entries, check for:
   - Near-duplicates (same contributor, >0.85 similarity) → consolidate
   - Outdated thoughts superseded by newer versions → refine
   - Keyword echoes still persisted (pre-T2 fix) → consolidate into domain summary
9. **Domain summaries** — for each active domain, generate/update a summary thought with `thought_category: "domain_summary"`. Use `refines` if summary already exists.
10. **Report changes** — list all mutations performed (consolidations, refinements, superseded thoughts)

### Scope Behavior

| Scope | What gets queried | Use case |
|-------|-------------------|----------|
| `recent` | 5-6 broad domain queries, each with full_content. Discovers thoughts across all domains. | Layer 1 (PM status), Layer 2 (manual) |
| `task:<slug>` | Query brain with topic=slug filter. Focused on one task's thread. | Layer 3 (task completion) |
| `full` | Extended query set (10+ domain keywords), deeper scroll. Maximum coverage. | Layer 2 (deep gardening) |

### Dry Run

When `--dry-run` is set:
- All discovery and analysis operations run normally
- Mutations are SKIPPED but REPORTED: "Would consolidate thoughts X, Y, Z into summary"
- Allows Thomas to preview what the gardener would do

### Gardening Timestamp

After each run, write timestamp to a known location:
```bash
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > /tmp/gardener-last-run.txt
```

For `scope=recent`, read this timestamp to know "since when" to report. If file doesn't exist, treat as first run (report everything discovered).

### File Location

`best-practices/.claude/skills/xpo.claude.mindspace.garden/SKILL.md`

### SKILL.md Structure

```markdown
---
name: xpo.claude.mindspace.garden
description: Brain quality maintenance — discover, analyze, consolidate, prune
user-invocable: true
allowed-tools: Bash, Read
---

# Gardener Engine

[Usage section with parameters]

## Step 1: Parse Arguments
[Parse scope, depth, dry-run from args]

## Step 2: Set Identity
[Same agent identity mapping as other skills]

## Step 3: Discover Thoughts
[Scope-dependent query strategy with curl commands]

## Step 4: Analyze (all depths)
[Count, flag noise, flag duplicates]

## Step 5: Report (shallow stops here)
[Summary output]

## Step 6: Consolidate (micro/deep)
[Task thread consolidation for micro, domain consolidation for deep]

## Step 7: Domain Summaries (deep only)
[Generate/update domain_summary thoughts]

## Step 8: Final Report
[List all mutations, update timestamp]
```

### Integration Points

- **Layer 1 (PM status)**: LIAISON calls `/xpo.claude.mindspace.garden recent shallow` before presenting PM status. Output appended to status presentation as "Brain Health" section.
- **Layer 2 (manual)**: Thomas invokes `/xpo.claude.mindspace.garden full deep` directly.
- **Layer 3 (task completion)**: Completing agent calls `/xpo.claude.mindspace.garden task:<slug> micro` after transitioning task to complete.

### Acceptance Criteria
1. `/xpo.claude.mindspace.garden` runs independently with default params (recent shallow)
2. `scope=recent depth=shallow` produces brain health summary
3. `scope=task:<slug> depth=micro` consolidates task's brain thread
4. `scope=full depth=deep` performs full gardening cycle
5. `--dry-run` reports without mutating
6. All three layers can invoke the engine with appropriate params

### Effort
High — ~200 lines SKILL.md with complete agent instructions, curl templates, analysis logic.

### Dependencies
- T1 (MCP Full Content) — COMPLETE: full_content and drill_down available
- T2 (Query Pollution) — COMPLETE: keyword_echo queries no longer pollute

### Future Enhancement
- New API endpoint `GET /api/v1/memory/thoughts?since=<timestamp>` for precise time-based discovery (currently uses broad semantic queries)
- Integration with curated highways (T3) — deep gardening updates highway curation

## Do
(DEV implements SKILL.md)

## Study
(Post-implementation)

## Act
(Post-study)
