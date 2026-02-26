# PDSA: Brain Contribution Quality — From Breadcrumbs to Maps

**Slug:** `brain-contribution-quality-maps-not-breadcrumbs`
**Date:** 2026-02-26
**Author:** PDSA agent
**Status:** DESIGN (Rework v1 — knowledge evolution + Neuroimaginations-Coach case study)

---

## PLAN

### Problem
Brain currently stores breadcrumbs, not maps. During XPollination Gründung recovery (2026-02-26), LIAISON needed 4 queries and manual Qdrant access to reconstruct a management summary from 6+ fragmented entries. Many entries are keyword echoes (search terms stored as thoughts), not self-contained knowledge. No structured state snapshots exist for complex topics.

### Root Cause
Two systemic failures:

1. **No contribution quality standard.** Brain accepts everything >50 chars. Agents store keyword lists, short labels, partial context. High quantity, low recoverability.

2. **No knowledge evolution mechanism.** Facts change, but the brain is append-only with reinforcement. Wrong facts with many repetitions outweigh corrections with single contributions. The system actively resists corrections because the wrong fact has more evidence than the right one.

### Case Study: Neuroimaginations-Coach Attribution Error

**What happened:** Multiple agents across multiple sessions (v0.0.1, v0.0.2, v0.0.3) listed Thomas as "Zertifizierter Neuroimaginations-Coach." Thomas corrected this multiple times. The correct fact: Neuroimaginations-Coaching is offered via Joint Venture with Gerhard Quiring — Thomas is NOT the certified coach.

**Why it persisted:**
1. NAS source files (ugp-kurzkonzept-xpollination.md, unternehmensberater-analysis.md) contained the original incorrect attribution
2. Agents read source files and repeated the error
3. Brain stored the error with reinforcement from multiple agents/sessions
4. Corrections had low pheromone weight compared to many repetitions
5. Auto-compact drops corrections (leaves) while keeping old facts (trunk)

**The Tree Problem:** Trunk facts have deep roots from many reinforcements. Leaf corrections are fragile and fall off during compaction. The brain needs a **superseding mechanism**: when a correction is contributed, it must explicitly mark old entries as superseded, not just add a competing entry with lower weight.

**Structural lesson:** This is not just a retrieval quality problem — it is a **knowledge evolution** problem. Facts change. The system must support fact lifecycle management, not just fact storage.

### Goal
1. Define contribution quality patterns that make brain knowledge self-contained and recoverable
2. **Design knowledge evolution mechanisms** — corrections must supersede established facts, source file contamination must be detectable
3. Apply PageIndex.ai's holistic context principles to our Qdrant-based architecture
4. Produce implementation-ready design for future brain API iteration

---

## DO

### 1. PageIndex.ai Principles Mapped to Brain Architecture

PageIndex.ai replaces "chunk-and-embed" with hierarchical tree indexing and LLM-driven navigation. Key insight: it treats retrieval as a **navigation problem**, not a search problem. Here's how each principle maps to our Qdrant brain:

| PageIndex Principle | Current Brain State | Mapped Application |
|---|---|---|
| **Holistic context preservation** — no destructive chunking, preserve full semantic units | Thoughts are atomic strings with no structure requirement. A 51-char keyword echo passes threshold. | Contributions must be **self-contained knowledge units** with enough context to be useful standalone. |
| **Hierarchical structure** — tree index with summaries at each level | Flat vector space. Tags exist but are emergent/unstructured. No topic hierarchy. | Add **thought_category** (state_snapshot, decision_record, operational_learning, task_outcome) as structured metadata. |
| **Reasoning-based retrieval** — LLM reasons about where to look | Pure cosine similarity on 384-dim vectors. No metadata-aware retrieval reasoning. | Enrich payload metadata (category, project, topic, temporal_scope) to enable **filtered retrieval** beyond similarity. |
| **Traceability** — every node maps to source | `contributor_id`, `context_metadata` exist but are often empty/generic. No artifact references. | Require **source_ref** (task slug, file path, commit SHA) in structured contributions. |
| **Explainability** — visible navigation decisions | Returns similarity score only. No reasoning about why a result matches. | Include **matching_fields** in retrieval response to show which metadata fields drove the match. |
| **Cross-reference following** — navigate "see Appendix G" | No linking between thoughts except refinement/consolidation lineage. | Support **related_thoughts** field — explicit bidirectional links between related knowledge. |
| **Iterative sufficiency** — fetch more if incomplete | Single-round retrieval, top 10 results. | Multi-round retrieval: if score < 0.5 for top result, broaden search by relaxing filters. |

### 2. Contribution Quality Standard

#### 2a. Thought Categories (New Payload Field)

Every contribution must declare a **thought_category**:

| Category | Purpose | Required Fields | Example |
|---|---|---|---|
| `state_snapshot` | Self-contained status of a complex topic | `topic`, `temporal_scope`, `supersedes` | "XPollination Gründung state 2026-02-26: EPU path, Befähigungsprüfung chosen, Kurzkonzept ready, next AMS submission" |
| `decision_record` | Key decision with reasoning | `topic`, `alternatives_considered` | "Befähigungsprüfung chosen over Vorpraxis because Kleinstunternehmen rule makes Vorpraxis risky" |
| `operational_learning` | Reusable insight from experience | `topic`, `source_ref` | "Agents must query brain on session start — 4 queries needed to reconstruct Gründung state proves recovery depends on pre-existing knowledge" |
| `task_outcome` | Result of completed task | `source_ref` (task slug) | "task-boundary-brain-protocol: designed brain-gated transitions with PAUSE+RESUME blocked state, WORKFLOW.md v13" |
| `correction` | Explicit fact correction with superseding | `topic`, `supersedes` (thought IDs), `corrected_fact`, `correct_fact` | "CORRECTION: Thomas is NOT Zertifizierter Neuroimaginations-Coach. Correct: NI-Coaching via JV with Gerhard Quiring. Supersedes: [ids of wrong entries]" |

**Uncategorized contributions** (current behavior) still accepted but flagged as `uncategorized` in payload. The threshold (>50 chars, not interrogative) remains as minimum gate.

#### 2b. Self-Containment Rule

A thought must be **readable and useful without any other context**. Test: if someone finds this thought via a query, can they understand and act on it without needing to query further?

**Good (self-contained):**
> "XPollination Gründung state 2026-02-26: EPU (Einzelpersonenunternehmen) path selected. Befähigungsprüfung route chosen over Vorpraxis (Kleinstunternehmen rule risk). Kurzkonzept ready, Finanzplan drafted. Next step: submit to AMS. Timeline: Kurs March, Prüfung June/July, Gewerbe Summer."

**Bad (fragment requiring reassembly):**
> "Befähigungsprüfung is the chosen path"

The bad example answers "what" but not "why", "when", "what's next", or "what's the context".

#### 2c. Reference Requirement

Structured contributions (`state_snapshot`, `decision_record`, `task_outcome`) must include at least one **source_ref**:

```json
{
  "source_ref": {
    "type": "task",           // task | file | commit | url
    "value": "brain-contribution-quality-maps-not-breadcrumbs",
    "project": "best-practices"
  }
}
```

`operational_learning` may omit source_ref if the learning is general.

#### 2d. Anti-Patterns (What Gets Rejected/Flagged)

| Anti-Pattern | Example | Why It's Bad | Gate |
|---|---|---|---|
| **Keyword echo** | "brain contribution quality patterns, PageIndex.ai principles for knowledge management" | Search terms repeated as thought — adds noise, not knowledge | Detect: if >60% of words appear in recent queries by same agent, flag as `keyword_echo` |
| **Naked statement** | "Brain is important for recovery" | No context, no specifics, not actionable | Existing threshold catches some; category requirement catches rest |
| **Orphaned reference** | "See the PDSA doc for details" | No self-contained content, depends on external context | Self-containment rule: if thought contains "see X" without also containing the referenced substance, flag |
| **Stale snapshot** | State snapshot from 2 weeks ago never updated | Decays via pheromone but still returns in queries | `temporal_scope` field enables time-aware retrieval; old snapshots get lower relevance |
| **Duplicate near-miss** | Same insight rephrased 3 times across sessions | Brain already suggests refinement at >85% similarity | Strengthen: at >90% similarity, auto-flag and suggest consolidation |
| **Stale source contamination** | Agent reads old NAS file, contributes outdated fact that has been corrected | Re-introduces wrong facts that override corrections via volume | Correction category with explicit superseding; retrieval warns when contributing fact contradicts existing correction |

### 3. State Snapshot Pattern

#### 3a. Lifecycle

```
CREATE: First time a complex topic is contributed to brain
  → Agent creates state_snapshot with full context
  → Sets temporal_scope (e.g., "2026-02-26")
  → Sets topic (e.g., "xpollination-gruendung")

UPDATE: Topic state changes (new decision, milestone, status change)
  → Agent uses /brain refine <snapshot_id> "updated state..."
  → Refinement inherits pheromone, supersedes original
  → Temporal_scope updated to current date

RETRIEVE: Another agent needs current state
  → Query by topic returns latest refinement (superseded originals penalized 30%)
  → Result includes full context — no reassembly needed
```

#### 3b. Ownership

- **No exclusive owner.** Any agent can create/update a state snapshot for their domain.
- **Convention:** The agent closest to the topic owns updates.
  - LIAISON owns business/human-facing topics (Gründung, partnerships)
  - PDSA owns design/architecture topics (workflow design, brain architecture)
  - DEV owns implementation topics (deployment state, build status)
  - QA owns quality topics (test coverage, known defects)

#### 3c. Update Triggers

| Trigger | Action |
|---|---|
| Session end (for complex topic work) | Refine existing snapshot or create new one |
| Major decision made | Create decision_record + refine state_snapshot |
| Task completed | Create task_outcome + refine related state_snapshot |
| Recovery query returns fragmented results | Create consolidation from fragments, then refine into state_snapshot |

#### 3d. Template

```
{topic} state {date}: {current_status}. {key_decisions}. {blockers_if_any}. Next: {next_actions}. Timeline: {milestones}.
```

Example:
```
XPollination Gründung state 2026-02-26: EPU path, Befähigungsprüfung route (not Vorpraxis — Kleinstunternehmen risk). Kurzkonzept done, Finanzplan drafted, UGP pending. Next: AMS submission. Timeline: Kurs March, Prüfung June/July, Gewerbe Summer.
```

### 4. Decision Record Pattern

#### 4a. Structure

```
Decision: {what was decided}
Context: {what prompted the decision}
Alternatives: {what else was considered}
Reasoning: {why this option was chosen}
Consequences: {what changes as a result}
Source: {task slug or meeting/session reference}
```

#### 4b. Required Fields

| Field | Required | Notes |
|---|---|---|
| Decision statement | Yes | Clear, unambiguous |
| Context | Yes | What prompted this decision |
| Alternatives considered | Yes | At least one alternative (even "do nothing") |
| Reasoning | Yes | Why this over alternatives |
| Consequences | No | What changed downstream |
| Source reference | Yes | Task slug, session, or meeting |

#### 4c. Template

```
Decision ({date}, {project}): {decision}. Context: {why now}. Chose {option} over {alternatives} because {reasoning}. Source: {reference}.
```

Example:
```
Decision (2026-02-26, brain-protocol): Brain-gated transitions with synchronous health check. Context: agents lose context at task boundaries. Chose hard gate (no brain = no action) over fire-and-forget because brain is transaction integrity — acting without documentation is amnesia. Source: task-boundary-brain-protocol v3 rework.
```

### 5. Implementation Design

#### 5a. Payload Schema Extension

Add to Qdrant `thought_space` point payload:

```json
{
  "thought_category": "state_snapshot|decision_record|operational_learning|task_outcome|uncategorized",
  "topic": "string — topic identifier for filtered retrieval",
  "temporal_scope": "ISO date — when this knowledge was current",
  "source_ref": {
    "type": "task|file|commit|url",
    "value": "string",
    "project": "string"
  },
  "alternatives_considered": "string — for decision_records",
  "quality_flags": ["keyword_echo", "orphaned_reference", "stale"]
}
```

All new fields are **optional** — existing uncategorized contributions continue working. Quality flags are set server-side based on detection rules.

#### 5b. API Changes (memory.ts)

**Contribution validation (enhanced threshold):**

```typescript
function assessContributionQuality(prompt: string, metadata: any, recentQueries: string[]): QualityAssessment {
  // Existing threshold checks (>50 chars, not question, not follow-up)
  const passesThreshold = meetsContributionThreshold(prompt);

  // New quality detection (non-blocking, sets flags)
  const flags: string[] = [];

  // Keyword echo detection: >60% word overlap with recent queries
  if (recentQueries.length > 0) {
    const promptWords = new Set(prompt.toLowerCase().split(/\s+/));
    for (const query of recentQueries) {
      const queryWords = new Set(query.toLowerCase().split(/\s+/));
      const overlap = [...promptWords].filter(w => queryWords.has(w)).length;
      if (overlap / promptWords.size > 0.6) {
        flags.push('keyword_echo');
        break;
      }
    }
  }

  // Orphaned reference: contains "see" + reference without substance
  if (/\bsee (the |my |our )?\w+\b/i.test(prompt) && prompt.length < 150) {
    flags.push('orphaned_reference');
  }

  return { passesThreshold, flags, category: metadata.thought_category || 'uncategorized' };
}
```

**Key design choice:** Quality flags are **advisory, not blocking**. Contributions still store even with flags. This preserves the brain's open-accept nature while making quality visible.

#### 5c. Retrieval Enhancement

**Category-filtered retrieval:**

```typescript
// When querying with topic filter
const filter = topic ? {
  must: [{ key: 'topic', match: { value: topic } }]
} : undefined;

// Prefer latest temporal_scope when multiple snapshots match
// Penalize flagged thoughts (keyword_echo: -20% score)
```

**Multi-round retrieval (future iteration):**
If top result score < 0.5 and category filter was applied, retry without category filter. This implements PageIndex's "iterative sufficiency" principle.

#### 5d. Retrieval Response Enhancement

Add to response:

```json
{
  "sources": [{
    "thought_id": "uuid",
    "score": 0.87,
    "thought_category": "state_snapshot",
    "topic": "xpollination-gruendung",
    "temporal_scope": "2026-02-26",
    "quality_flags": [],
    "matching_reason": "topic match + high similarity"
  }]
}
```

### 6. Migration Path

| Phase | Scope | Blocking? |
|---|---|---|
| Phase 1: Schema extension | Add new fields to payload, all optional | No — backward compatible |
| Phase 2: Quality detection | Server-side flag detection on new contributions | No — flags are advisory |
| Phase 3: Retrieval enhancement | Category filtering, flag penalties, matching_reason | No — enhances existing results |
| Phase 4: Agent skill update | Update SKILL.md with category templates, teach agents | No — old patterns still work |
| Phase 5: Snapshot conventions | Establish session-end snapshot practice via SKILL.md | No — convention, not enforcement |

No breaking changes. Each phase adds value independently.

### 7. Knowledge Evolution — Fact Lifecycle Management

This section addresses the core rework feedback: the brain must support **fact evolution**, not just fact storage. The Neuroimaginations-Coach case proves that append-only + reinforcement actively resists corrections.

#### 7a. The Tree Problem

```
TRUNK (wrong fact, deeply rooted):
  "Thomas is Zertifizierter Neuroimaginations-Coach"
  → Contributed by 3+ agents across 3+ sessions
  → Reinforced by: pheromone from access_count=15, accessed_by=5 agents
  → Source: NAS files ugp-kurzkonzept, unternehmensberater-analysis

LEAF (correction, fragile):
  "Thomas is NOT the NI-Coach, it's a JV with Gerhard Quiring"
  → Contributed once by Thomas
  → pheromone_weight: 1.0 (base)
  → No reinforcement (rarely retrieved because trunk fact matches queries first)
```

The trunk fact wins every similarity search because: (1) more contributors = more embedding reinforcement, (2) higher pheromone from more accesses, (3) correction has low traffic because queries match the wrong fact first.

#### 7b. Correction Category — Explicit Superseding

A new thought category `correction` with hard superseding semantics:

```json
{
  "thought_category": "correction",
  "corrected_fact": "Thomas is Zertifizierter Neuroimaginations-Coach",
  "correct_fact": "Neuroimaginations-Coaching offered via Joint Venture with Gerhard Quiring. Thomas is NOT the certified coach.",
  "supersedes": ["thought-id-1", "thought-id-2", "thought-id-3"],
  "topic": "xpollination-gruendung",
  "source_ref": { "type": "url", "value": "human-correction", "project": "best-practices" }
}
```

**When a correction is contributed:**
1. All thought IDs in `supersedes` are marked `superseded: true` in Qdrant payload
2. Superseded thoughts get **hard penalty**: -50% score (up from current -30% for refinement superseding)
3. The correction itself gets a **correction_boost**: +30% score in retrieval
4. Guidance response warns: "This correction supersedes N previous thoughts on this topic"

**Key difference from refinement:**
- **Refinement** = "here's an updated version of what I said" (evolutionary, single lineage)
- **Correction** = "that fact was WRONG, here is the right fact" (contradictory, cross-lineage, may supersede thoughts from different contributors)

#### 7c. Contradiction Detection

When a new contribution is stored, check if it contradicts an existing `correction`:

```typescript
// After storing new thought, check for contradictions
const corrections = await searchByCategory('correction', newThought.topic);
for (const correction of corrections) {
  const similarityToWrongFact = cosineSimilarity(
    newThought.embedding,
    await embed(correction.corrected_fact)
  );
  if (similarityToWrongFact > 0.85) {
    // New contribution looks like the wrong fact that was already corrected
    newThought.quality_flags.push('contradicts_correction');
    newThought.contradicted_by = correction.thought_id;
    // Return warning in response
    guidance = `WARNING: This contribution is similar to a corrected fact. ` +
      `Correction ${correction.thought_id}: "${correction.correct_fact}". ` +
      `Please verify your source is current.`;
  }
}
```

This directly addresses the **stale source contamination** problem: when an agent reads an old NAS file and contributes a fact that has already been corrected, the system warns immediately.

#### 7d. Source File Contamination Prevention

The Neuroimaginations-Coach case had a specific attack vector: NAS source files contained wrong facts, agents read them, and reproduced the error. Prevention requires action at two levels:

**Level 1 — Brain-side (this design):**
- Contradiction detection (7c) catches re-introduction of corrected facts
- Quality flag `contradicts_correction` alerts the contributing agent
- Response guidance includes the correct fact so the agent can self-correct

**Level 2 — Source-side (separate concern, documented here for completeness):**
- Correct the source files themselves (NAS docs)
- Add correction notices to files that are known to contain outdated facts
- Add anti-pattern warnings to agent profile files (e.g., profile-framing.md)

Level 2 is out of scope for this brain API design but must happen in parallel.

#### 7e. Correction Lifecycle

```
DISCOVER: Agent or human identifies wrong fact in brain
  → Query brain to find all instances of wrong fact
  → Collect thought IDs of wrong entries

CORRECT: Contribute correction with explicit superseding
  → category: correction
  → supersedes: [list of wrong thought IDs]
  → corrected_fact: what was wrong
  → correct_fact: what is right

PROPAGATE: System automatically handles
  → Superseded thoughts get -50% penalty
  → Correction gets +30% boost
  → Future contributions matching wrong fact get flagged

VERIFY: Next retrieval on this topic
  → Correction appears prominently
  → Old wrong facts are deprioritized but not deleted (audit trail)
  → Guidance explains the correction history
```

#### 7f. State Snapshots as Evolution Anchors

State snapshots (Section 3) solve the evolution problem for complex topics:

**Before snapshots (current):**
```
Many fragments from many sessions → some wrong, some right, no way to tell which is current
```

**After snapshots:**
```
One authoritative state_snapshot per topic, refined on each update
→ Snapshot IS the current truth
→ Old fragments automatically deprioritized (superseded by refinement)
→ Corrections can supersede specific wrong fragments AND update the snapshot
```

The state snapshot becomes the **single source of truth** for a topic in the brain, just like WORKFLOW.md is the single source of truth for workflow design. When queried, the latest snapshot is the answer — no assembly from fragments needed.

### 8. Updated Migration Path

| Phase | Scope | Blocking? |
|---|---|---|
| Phase 1: Schema extension | Add new fields to payload, all optional (including correction fields) | No — backward compatible |
| Phase 2: Quality detection | Server-side flag detection + contradiction detection (7c) | No — flags are advisory |
| Phase 3: Correction category | Hard superseding semantics, -50% penalty, +30% boost | No — enhances existing results |
| Phase 4: Retrieval enhancement | Category filtering, flag penalties, contradiction warnings | No — enhances existing results |
| Phase 5: Agent skill update | Update SKILL.md with category templates, correction workflow | No — old patterns still work |
| Phase 6: Snapshot conventions | Establish session-end snapshot practice via SKILL.md | No — convention, not enforcement |
| Phase 7: Source file cleanup | Correct NAS files, add anti-patterns to agent profiles | No — separate from brain API |

### Acceptance Criteria Mapping

| AC | Section | How Met |
|----|---------|---------|
| PageIndex.ai principles mapped to brain architecture | Section 1 | 7-row mapping table with current state + application |
| Contribution quality standard defined | Section 2 | Categories incl. correction (2a), self-containment rule (2b), reference requirement (2c) |
| State snapshot pattern defined | Section 3 | Lifecycle (3a), ownership (3b), update triggers (3c), template (3d) |
| Decision record pattern defined | Section 4 | Structure (4a), required fields (4b), template (4c) |
| Anti-patterns documented | Section 2d | 6 anti-patterns incl. stale source contamination |
| Knowledge evolution designed | Section 7 | Tree Problem (7a), correction category (7b), contradiction detection (7c), source contamination prevention (7d), correction lifecycle (7e), snapshots as evolution anchors (7f) |
| Neuroimaginations-Coach case study addressed | Plan + Section 7 | Case study in Plan, Tree Problem analysis (7a), contradiction detection prevents re-contamination (7c) |
| Design is implementation-ready | Sections 5+8 | Payload schema (5a), API changes (5b-5d), 7-phase migration path (Section 8) |

---

## STUDY

*To be completed after implementation review.*

## ACT

*To be completed after study phase.*
