# PDSA: Multi-User Gardening — Multi-Collection Gardener

**Date:** 2026-03-02
**Task:** multi-user-gardening
**Parent:** multi-user-brain-research
**Depends On:** multi-user-sharing (shared space exists)
**Status:** PLAN

## Plan

### Problem
The gardener skill (`/xpo.claude.mindspace.garden`) operates on whichever collection the brain API resolves from the caller's auth token. It has no mechanism to:
1. Target a specific collection (e.g., Maria's brain vs Thomas's brain)
2. Garden the shared collection independently
3. Control who can garden which collections

### Current State (What Already Works)
| Component | Multi-Collection Ready? |
|-----------|------------------------|
| `think()` / `retrieve()` | Yes — accept `collection` parameter |
| Memory API routes | Yes — resolve from user context + `space` param |
| Pheromone decay | Yes — auto-discovers all `thought_space_*` collections |
| Consolidation/refine | Yes — inherently collection-local |
| **Gardener skill** | **No** — no collection/space parameter |

### Design

#### Change 1: Add `--space` Parameter to Gardener Skill

**File:** `.claude/skills/xpo.claude.mindspace.garden/SKILL.md` (MODIFIED)

Current invocation:
```
/xpo.claude.mindspace.garden <scope> <depth>
```

New invocation:
```
/xpo.claude.mindspace.garden <scope> <depth> [--space=private|shared]
```

- `--space=private` (default): Garden the caller's private collection. Uses the brain API's default collection resolution from the auth token.
- `--space=shared`: Garden `thought_space_shared`. All brain API calls include `"space": "shared"` in the request body.

**Why not `--collection=<name>`?** The brain API routes through auth — a user can only access their own private collection or the shared collection. Direct collection targeting bypasses auth and would require a system-level API. Using `space` parameter stays within the auth model.

#### Change 2: Gardener API Calls Include Space Parameter

When the gardener makes brain API calls (Steps 4-7 in SKILL.md), it must include the `space` parameter:

```bash
# Private gardening (default — no change needed)
curl -s -X POST http://localhost:3200/api/v1/memory \
  -H "Authorization: Bearer $API_KEY" \
  -d '{"prompt": "...", "agent_id": "...", "read_only": true}'

# Shared gardening (new)
curl -s -X POST http://localhost:3200/api/v1/memory \
  -H "Authorization: Bearer $API_KEY" \
  -d '{"prompt": "...", "agent_id": "...", "read_only": true, "space": "shared"}'
```

This applies to all gardener operations:
- Thought discovery (retrieve)
- Consolidation contributions (think with `consolidates`)
- Refinement contributions (think with `refines`)
- Retroactive categorization (think with metadata)

#### Change 3: Governance Model for Shared Space

**Thomas's open question:** Who can garden the shared brain?

**Proposed model — "Owner Gardens":**

| Collection | Who Can Garden | Rationale |
|-----------|----------------|-----------|
| `thought_space_thomas` | Thomas (or agents with Thomas's API key) | Private brain = private maintenance |
| `thought_space_maria` | Maria (or agents with Maria's API key) | Private brain = private maintenance |
| `thought_space_shared` | Any authenticated user | Shared brain = community maintenance |

**Enforcement:** The brain API already enforces this via auth. The `space` parameter controls which collection is targeted. Any user's API key can write to shared (the API doesn't restrict writes to shared space). The governance is social, not technical — Thomas decides who runs gardening on shared.

**Alternative: Role-Based Gardening (presented for Thomas's decision)**

Option A (proposed): Any user can garden shared space. Simple, no new code.
Option B: Only designated "gardener" role can modify shared space. Requires a new `can_garden_shared` flag in users table and middleware check.
Option C: Shared space is read-only after initial share. No gardening of shared. Simplest but limits quality curation.

**Recommendation:** Option A. The gardener already requires a conscious invocation (`/xpo.claude.mindspace.garden`). Accidental gardening of shared space isn't a risk. Thomas can always review gardening results in the shared brain.

#### Change 4: Layer 3 (Task Completion) — Collection Awareness

The `/xpo.claude.monitor` skill's Layer 3 micro-gardening already operates on the agent's private collection (via default auth routing). No change needed — task-related thoughts are in the agent's private brain.

### Implementation Summary

| File | Change |
|------|--------|
| `.claude/skills/xpo.claude.mindspace.garden/SKILL.md` | ADD: `--space` parameter docs, update all API call examples to include `space` when targeting shared |
| Brain API (memory.ts) | No change — `space` parameter already supported |
| thoughtspace.ts | No change — collection parameter already flows through |

### Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-MUG1 | Gardener skill accepts `--space=private\|shared` parameter |
| AC-MUG2 | Default (no --space) gardens caller's private collection |
| AC-MUG3 | `--space=shared` gardens thought_space_shared |
| AC-MUG4 | All gardener API calls (discover, consolidate, refine, categorize) pass `space` parameter when shared |
| AC-MUG5 | Consolidation within shared space creates new thought in shared collection |
| AC-MUG6 | Private gardening does not affect shared collection |
| AC-MUG7 | Shared gardening does not affect private collections |

### NOT Changed
- Pheromone decay (already multi-collection)
- Brain API routes (space parameter already works)
- Auth middleware (no new access control for gardening)
- Monitor skill Layer 3 (already gardens private by default)

### Risks
- **Accidental shared gardening**: Low risk — requires explicit `--space=shared` flag. Gardener confirms scope in Step 1 output.
- **Gardener consolidating across collections**: Not possible — consolidation IDs are collection-local. A thought ID from private doesn't exist in shared (different UUID).
- **Shared space gardener conflicts**: Two users gardening shared simultaneously could both try to consolidate the same thoughts. Qdrant handles this gracefully — second consolidation gets a "already superseded" warning.

### Edge Cases
- **Shared thought references private IDs**: `shared_from_id` in shared thoughts points to private collection. Gardener in shared space should NOT follow these references (they're in a different collection). SKILL.md should note: "Do not traverse `shared_from_id` links during shared space gardening."
- **Empty shared collection**: Gardener should handle 0 thoughts gracefully (already does — shallow depth reports count).
- **User gardens another user's private space**: Not possible — API key resolves to caller's collection only. The `space` parameter only offers private (own) or shared.

## Do
(To be completed by DEV agent — skill file update only)

## Study
- Gardener targets private or shared via `--space` parameter
- All API calls pass `space` parameter when shared
- Operations stay collection-local (no cross-collection)
- Governance: any authenticated user can garden shared (Option A)
- No API code changes needed — only skill file update

## Act
- Test: garden private → verify only private affected
- Test: garden shared → verify only shared affected
- Next: multi-user initiative complete (all subtasks done)
