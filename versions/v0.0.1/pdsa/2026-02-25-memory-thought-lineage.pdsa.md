# PDSA: Memory System — Thought Lineage & Explicit Iteration

**Date:** 2026-02-25
**Version:** best-practices v0.0.2 (next version)
**Status:** PLAN (high-level, needs PDSA agent refinement)
**Spec base:** `versions/v0.0.1/spec/thought-tracing-system.md` (v0.2.0)

---

## PLAN

### Problem (from LIAISON reflection, 2026-02-25)

The memory system works for basic retrieval but cannot explicitly iterate knowledge:

1. `/memory` endpoint hardcodes `thought_type: "original"` — every contribution is standalone
2. Contradictory knowledge coexists with no resolution mechanism (old "status+role monitoring" and corrected "role-only monitoring" both returned in same query)
3. No lineage visible — agents can't see that thought B refines thought A
4. No way for agents to mark a thought as superseded
5. The internal `think()` function already supports `refinement` and `consolidation` with `source_ids` — the plumbing exists but isn't exposed

### Why Now

- Recovery across sessions relies on memory. If contradictory thoughts coexist, a recovering agent gets confused.
- The workflow engine proved the pattern: less individual skill knowledge, more process in programs. The memory system should follow the same principle — let agents contribute refinements and let the system resolve contradictions, rather than relying on agents to figure out which of two conflicting thoughts is newer.
- Thomas's principle: "If the system does not PREVENT it, it WILL happen." Without explicit iteration, agents will keep appending contradictory knowledge and the brain fills with noise.

### Vision

An agent contributes a thought. Later, that thought is proven wrong or outdated. Another agent (or the same one) contributes a refinement that explicitly references the original. The system now knows: thought B supersedes thought A. When returning results, it can indicate "this thought has been refined" or prioritize the refinement. Over time, chains of thought form — visible, traceable, iterable.

### Scope: What's Needed

#### 1. Expose thought iteration in `/memory` endpoint

- Accept optional `refines` field (thought_id) in the `/memory` request
- When present: store with `thought_type: "refinement"` and `source_ids: [refines]`
- When absent: current behavior (thought_type: "original")

#### 2. Mark superseded thoughts in retrieval results

- When returning results, check if a thought has been refined (another thought has it in `source_ids`)
- Add `refined_by: thought_id` to the result payload
- Agent sees: "this thought has a newer version" and can follow the chain

#### 3. Retrieval prefers latest iteration

- When thought A has been refined by thought B, and both match a query:
  - Boost B's score (it's the latest iteration)
  - Optionally suppress A or mark it as `superseded: true`
- Decision for PDSA: suppress vs mark vs boost-only

#### 4. Lineage query

- New capability: given a thought_id, return its lineage chain (all refinements and consolidations)
- Could be internal (part of `/memory` trace) or exposed endpoint
- Decision for PDSA: how to expose this

#### 5. Brain skill update

- Add: `/brain refine <thought_id> "updated insight"` — contributes a refinement
- Add: `/brain history <thought_id>` — shows lineage chain
- Update: `/brain contribute` result shows if similar thoughts exist that might need refinement instead of a new original

#### 6. Consolidation

- When multiple thoughts cover the same topic, an agent (or background job) can consolidate them into one
- `thought_type: "consolidation"` with `source_ids: [A, B, C]`
- Consolidation supersedes all sources
- Decision for PDSA: manual (agent-triggered) vs automatic (background job) vs both

### Out of Scope (this version)

- Tree index / hybrid retrieval (spec post-MVP)
- Cryptographic access control
- Explicit feedback endpoint
- Knowledge space multi-tenancy

### Acceptance Criteria (high-level)

- AC1: Agent can contribute a refinement via `/memory` with `refines: thought_id`
- AC2: Retrieval results indicate when a thought has been refined
- AC3: Latest iteration ranks higher than original in retrieval
- AC4: Lineage chain is queryable (at minimum via trace)
- AC5: `/brain refine` skill works end-to-end
- AC6: Consolidation of multiple thoughts into one works
- AC7: Existing behavior unchanged when `refines` is not provided

---

## DO

*To be filled by PDSA agent during refinement*

---

## STUDY

*To be filled after implementation*

---

## ACT

*To be filled after study*

### Open Questions for PDSA Agent

1. **Suppression vs marking:** When a thought is refined, should the original be suppressed in results, marked as superseded, or just ranked lower?
2. **Consolidation trigger:** Manual agent action, background job, or both?
3. **Lineage depth:** How deep should lineage chains go? Cap at N levels?
4. **Backward compatibility:** The `/memory` endpoint currently returns no `refined_by` field. Adding it changes the response schema. Breaking change or additive?
5. **Brain skill UX:** Should `/brain contribute` proactively suggest "similar thought exists, do you want to refine it instead?"
6. **Pheromone inheritance:** When B refines A, should B inherit A's pheromone weight? Or start fresh at 1.0?
