# PDSA: Brain Contribution Quality — From Breadcrumbs to Maps

**Slug:** `brain-contribution-quality-maps-not-breadcrumbs`
**Date:** 2026-02-26
**Author:** PDSA agent
**Status:** DESIGN

---

## PLAN

### Problem
Brain currently stores breadcrumbs, not maps. During XPollination Gründung recovery (2026-02-26), LIAISON needed 4 queries and manual Qdrant access to reconstruct a management summary from 6+ fragmented entries. Many entries are keyword echoes (search terms stored as thoughts), not self-contained knowledge. No structured state snapshots exist for complex topics.

### Root Cause
No contribution quality standard. The brain accepts everything >50 chars that isn't purely interrogative. Agents store whatever they produce — keyword lists, short labels, partial context. Result: high quantity, low recoverability.

### Goal
Define contribution quality patterns that make brain knowledge self-contained and recoverable. Apply PageIndex.ai's holistic context principles to our Qdrant-based architecture. Produce implementation-ready design for future brain API iteration.

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

### Acceptance Criteria Mapping

| AC | Section | How Met |
|----|---------|---------|
| PageIndex.ai principles mapped to brain architecture | Section 1 | 7-row mapping table with current state + application |
| Contribution quality standard defined | Section 2 | Categories (2a), self-containment rule (2b), reference requirement (2c) |
| State snapshot pattern defined | Section 3 | Lifecycle (3a), ownership (3b), update triggers (3c), template (3d) |
| Decision record pattern defined | Section 4 | Structure (4a), required fields (4b), template (4c) |
| Anti-patterns documented | Section 2d | 5 anti-patterns with examples, detection, and gates |
| Design is implementation-ready | Section 5 | Payload schema (5a), API changes (5b-5d), migration path (Section 6) |

---

## STUDY

*To be completed after implementation review.*

## ACT

*To be completed after study phase.*
