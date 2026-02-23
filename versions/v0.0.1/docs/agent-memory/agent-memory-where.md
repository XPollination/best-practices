# Where Does Memory Go?

> Status: emerging
> Source: XPollination spec (15 documents), multi-agent operations (2026-01–02), Galarza (2026-02-17), MVP spec (doc 13), 8-layer architecture (doc 12)
> Version: 3.0.0 | Last updated: 2026-02-23
> PDSA: [2026-02-19-agent-memory.pdsa.md](../../pdsa/2026-02-19-agent-memory.pdsa.md)

---

## Summary

Memory storage is not a stack you climb through — it's a set of **concurrent operations** that happen simultaneously at different scales. The XPollination spec describes an 8-layer architecture where each layer runs in parallel: the vector database stores, the observation layer watches, the pattern detector clusters, the pheromone system reinforces, and the sleep consolidation engine transforms. At the simplest scale (markdown files), you're running layers 0 and 1 manually. At the full vision, all 8 layers operate simultaneously on every interaction. The key insight: start at the bottom but **design the hooks for all layers from day one**.

---

## Context

### The 8-Layer Architecture (Concurrent, Not Sequential)

The XPollination spec (12-DEEP-DIVE-ITER3) describes 8 concurrent layers. Doc 11 (Agent Review) corrected a key misunderstanding from iteration 2: these are NOT a progression you climb through. They are simultaneous operations:

| Layer | What It Does | MVP Status | Our Practice |
|-------|-------------|------------|-------------|
| 0: Vector DB | Stores thought vectors with payloads | Qdrant with pheromone weights | MEMORY.md + topic files |
| 1: Observation | Logs all queries and retrievals | Access logging middleware | Manual (who reads what is invisible) |
| 2: Pattern Detection | Real-time clustering of query patterns | Deferred (DenStream) | None |
| 3: Convergence | Multi-user convergence math | Deferred (Wasserstein) | None |
| 4: Reinforcement | Stigmergic self-organization | Pheromone +0.05/-0.995 | Manual MEMORY.md curation |
| 5: Sleep Consolidation | Episodic → semantic transformation | Deferred | PDSA Study phase (manual) |
| 6: Knowledge Graph | Co-retrieval + relationship mapping | Co-retrieval logging | Markdown cross-references |
| 7: RL Policy | Learned memory operations | Deferred | Human curation decisions |
| 8: Visualization | Trajectory maps + highway views | /highways endpoint | None |

The important framing: even in a markdown-only system, layers 0 (storage), 1 (observation — agents reading files), 4 (reinforcement — humans curating), and 5 (consolidation — PDSA Study) are active. The difference is scale and automation, not kind.

### The Hopfield Energy Landscape

The vector database IS a Hopfield network (Ramsauer et al., ICLR 2021). Stored vectors are memory attractors — energy minima in a landscape. This gives physical intuition to storage:

- **Deep energy well** = frequently accessed, highly connected memory (strong attractor)
- **Shallow well** = rarely accessed, loosely connected (may not survive noise)
- **Saddle point** = hub node connecting knowledge regions (HNSW hub highways)
- **Basin of attraction** = cluster of related memories that queries converge toward

When agents query the database, they're descending the energy landscape. The pheromone model reshapes this landscape: frequently accessed regions get deeper wells (stronger attractors), while untouched regions gradually flatten (decay toward floor).

---

## Pattern

### Layer 0: MEMORY.md — The Always-Loaded Core

**Mechanism:** Markdown file injected into every agent prompt at session start. Our system uses a 200-line cap.

**What belongs here:**
- Critical protocols that must never be forgotten
- Concise index pointing to topic files for detail
- Cross-project stable facts (database paths, infrastructure)
- Most important lessons learned

**Architecture:**
```
~/.claude/CLAUDE.md                             → global protocols (all projects, all agents)
project/CLAUDE.md                               → project-specific protocols
~/.claude/projects/.../memory/MEMORY.md         → 200-line concise index (auto-loaded)
~/.claude/projects/.../memory/<topic>.md         → detailed notes (read on demand)
```

**The 200-line cap as pheromone system:** The cap forces constant triage — every new entry must justify displacing an existing one. Entries that survive this pressure are the deepest attractors. This is write-time filtering: the discipline of deciding what's important enough to cost prompt tokens in every future session.

**Galarza's confirmation:** "Markdown files work well — readable, debuggable, and require no infrastructure."

### Layer 1: Task DNA — Multi-Agent Episodic Memory

**Discovery from PDSA research:** The PM system's task DNA is functionally equivalent to the spec's thought unit schema (03-AGENT-GUIDELINES).

| Field | Memory Function |
|-------|----------------|
| `description` | What was the task (semantic) |
| `findings` | What was learned (episodic) |
| `rework_reason` | What went wrong (episodic) |
| `acceptance_criteria` | What "done" looks like (procedural) |
| `deliverables` | What was produced (semantic) |
| `rework_iteration` | How many attempts (episodic) |

**Access pattern:** Agents read DNA when claiming a task. The DNA IS the context — everything the agent needs, including history of previous attempts.

**Thought types in DNA:** Task DNA captures all three types:
- **Original:** initial task description
- **Refinement:** findings added during work, rework reasons
- **Consolidation:** final summary when task completes

### Layer 2: Topic Files — Detailed Reference Library

**Mechanism:** Individual markdown files organized by subject. Read on demand when MEMORY.md references them.

```
memory/
├── MEMORY.md                  → concise index (always loaded, 200-line cap)
├── liaison-process.md         → detailed liaison protocols
├── workflow-details.md        → workflow engine specifics
├── profile-assistant.md       → ProfileAssistant project notes
└── homepage-implementation-status.md  → current state tracking
```

**Access pattern:** Agent reads MEMORY.md at startup, sees "Details: memory/liaison-process.md", reads topic file only when doing liaison-related work.

**Advantage:** No prompt-token cost unless actually needed. Can be any length. Version-controlled via git.

### Layer 3: PDSA Documents — Trajectory Preservation

**PDSA documents are NOT just process artifacts — they're the trajectory memory the spec envisions.**

The spec says: "The ability to reproduce how different thinkers arrived at convergence is itself the knowledge" (01-SYSTEM-VISION). PDSA documents capture exactly this:

| PDSA Section | Memory Function | 8-Layer Equivalent |
|---|---|---|
| PLAN | Hypothesis and research scope | Layer 1 (observation of existing state) |
| DO | What was attempted (execution trace) | Layer 0 (new vectors stored) |
| STUDY | What was learned, what surprised us | Layer 5 (sleep consolidation) |
| ACT | What should change (actionable conclusions) | Layer 4 (reinforcement of important patterns) |

**PDSA = 90% of a thought unit.** The missing 10%: truth_score, explicit confidence, formal angle tagging. Extending the PDSA template with these three fields would make every PDSA automatically ingestible as a thought unit.

### Layer 4: Vector Database — Pheromone-Weighted Semantic Search

**Implementation:** The MVP spec (13-MVP-SPEC) defines a single Qdrant collection (`thought_space`) with rich payloads.

**Payload schema per vector point:**
```json
{
  "contributor_id": "agent-alice-001",
  "content": "The actual thought text",
  "thought_type": "original | refinement | consolidation",
  "source_ids": [],
  "access_count": 0,
  "accessed_by": [],
  "co_retrieved_with": [],
  "pheromone_weight": 1.0,
  "tags": []
}
```

**Pheromone model (self-regulating prominence):**
- Each access: `weight += 0.05` (ceiling at 10.0)
- Each hour without access: `weight *= 0.995` (floor at 0.1)
- ~11% decay per day without reinforcement
- Highways fade if not maintained by traffic — the system self-regulates

**When you need this layer:**
- Knowledge base exceeds what agents can find by reading files
- Queries are fuzzy ("find anything related to authentication")
- Cross-project knowledge needs to be surfaced
- Pheromone decay is needed to prevent old knowledge from permanently dominating

### Layer 5: Co-Retrieval Graph — Emergent Knowledge

**This layer doesn't exist in isolation — it emerges from Layer 4's usage patterns.**

When two vectors appear in the same search result set, they develop a co-retrieval association. The MVP tracks this in the `co_retrieved_with` payload field. Over time, these associations form a graph:

```
W(A,B) = PPMI(A,B) × Σ[exp(-λ(t_now - t_session))] × [1 - 1/log(|unique_users| + 1)]
```

Edge weight reflects: association strength, temporal relevance, and user diversity.

**GraphRAG complement:** Microsoft's GraphRAG builds relationships from text content. Co-retrieval builds relationships from user behavior. When these overlap, confidence is high. When co-retrieval reveals associations that GraphRAG missed, that's **emergent knowledge** — the most valuable kind.

**Current lightweight equivalent:** Cross-references in markdown files serve as manual relationship edges. Links between documents are the proto-graph.

### Layer 6: Sleep Consolidation — Episodic → Semantic Transformation

**Three production-ready patterns** (from 12-DEEP-DIVE-ITER3):

**NREM Phase (Deep Consolidation):**
1. Identify dense clusters in recently accessed vectors
2. For each cluster above density threshold: generate LLM-driven abstract summary
3. Embed the summary as a new vector, linked to source vectors
4. Hebbian reinforcement: strengthen associations between co-accessed vectors

**REM Phase (Creative Consolidation):**
1. Identify weak cross-cluster bridges
2. Generate hypothetical connections between knowledge regions
3. Create exploratory bridge vectors that increase cross-cluster discoverability

**Maintenance Phase:**
- Index rebalancing, snapshot, access frequency statistics, eviction

**Letta's dual-agent architecture** achieves 5× token reduction via sleep-time processing. **EverMemOS** implements a biologically faithful engram lifecycle. **Zettelkasten sleep-consolidation** operates on knowledge graph nodes with degree ≥ 2.

**Our current equivalent:** The PDSA Study phase IS manual NREM consolidation (clustering specific experiences into abstract insights). The ACT phase IS manual REM (generating bridges between what was learned and what should change).

### Layer 7 (Future): HNSW Hub Highways — Structural Infrastructure

**Not directly controllable but architecturally significant.**

In vector databases using HNSW indexes, hub nodes emerge naturally — points that are structurally central to multiple knowledge clusters. FlatNav research (ICML 2025 Workshop) shows 50-70% of early search visits hit hub highway nodes.

These ARE the conceptual bridges — vectors semantically central to multiple domains. They're the equivalent of "gateway" memories that connect otherwise separate knowledge regions.

**Current gap:** Qdrant doesn't expose HNSW traversal data (rejected feature request #2335). The pragmatic path is application-layer observation: log query vectors + returned result IDs, run periodic offline hub analysis.

---

## Evidence

### The Upgrade Path Is Real

Our system's evolution demonstrates the natural progression:

| Date | Memory Capacity | What Triggered the Upgrade |
|------|----------------|---------------------------|
| 2026-01 | CLAUDE.md only (~50 lines) | Initial protocols |
| 2026-01 late | CLAUDE.md grew to 300+ lines | Accumulated lessons from multi-agent failures |
| 2026-02 | MEMORY.md added (200-line cap) + topic files | CLAUDE.md was too large; needed index + detail separation |
| 2026-02-17 | Best-practices API (Qdrant) deployed | Cross-project knowledge needed searchable access |
| Future | Agent startup queries Qdrant + pheromone weighting | When 200-line MEMORY.md can't hold all critical knowledge |

Each upgrade was triggered by hitting an actual limitation, not by architectural ambition.

### Git History IS the Never-Delete Layer

The spec says thought traces should never be deleted (04). Our git history achieves this: every version of MEMORY.md, every CLAUDE.md edit, every PDSA document is preserved in git. The 200-line cap trims the ACTIVE memory, but the HISTORY is permanent.

### The Phase Transition Matters for Storage Strategy

From Khushiyant (arXiv:2512.10166): critical density ρ_c ≈ 0.23. Below this threshold, individual memory (MEMORY.md, CLAUDE.md) dominates — shared trace patterns don't have enough data to be useful. Above it, shared traces outperform individual memory by 36-41%.

**Architectural implication:**
- Below ρ_c: Focus storage on individual files (MEMORY.md, topic files, PDSA docs)
- Near ρ_c: Begin logging access patterns to shared vector DB
- Above ρ_c: Full stigmergic mode — pheromone-weighted storage with highway detection

Our 4-agent system (LIAISON, PDSA, DEV, QA) is likely below ρ_c. At this scale, individual memory correctly dominates.

---

## Examples

### Minimal Setup (New Project, Day 1)

```
project/
├── CLAUDE.md                  → project protocols
```

One file. Layers active: 0 (storage), 4 (manual reinforcement via editing). This is enough to start.

### Working System (Multi-Agent, Month 2)

```
project/
├── CLAUDE.md                  → shared protocols
├── .claude/
│   └── memory/
│       ├── MEMORY.md          → 200-line index (layer 0)
│       ├── workflow.md        → workflow details (layer 2)
│       └── debugging.md       → debugging patterns (layer 2)
├── data/xpollination.db       → PM system (layer 1: task DNA = episodic memory)
└── versions/v0.0.1/
    └── pdsa/                  → trajectory memory (layer 3: PDSA documents)
```

Layers active: 0 (markdown storage), 1 (task DNA), 2 (topic files), 3 (PDSA trajectory), 4 (manual curation), 5 (PDSA Study = manual consolidation).

### Full Vision (Cross-Project, Semantic Search, Self-Organizing)

Add to the above:
```
Qdrant Vector DB               → layer 4: pheromone-weighted semantic search
Co-retrieval graph              → layer 5: emergent associations from usage
Sleep consolidation cron        → layer 6: NREM/REM periodic processing
/highways API endpoint          → layer 8: visibility into emerging patterns
```

All 8 layers operating concurrently.

---

## Open Questions

1. **Concurrent layer hooks in practice** — How do you implement placeholder hooks for layers 3-7 in a markdown-only system? Is it sufficient to structure files in a way that's later ingestible by vector DB?

2. **Pheromone decay for markdown** — Can the 200-line cap be enhanced with access-frequency metadata? Could agents annotate which MEMORY.md entries they actually used each session?

3. **Co-retrieval without a vector DB** — Is there a markdown-world equivalent of co-retrieval tracking? Perhaps tracking which topic files are read together in the same session?

4. **Knowledge graph necessity** — At what relationship complexity do markdown cross-references break down? Current hypothesis: when convergence detection across 3+ independent analysis paths is needed.

5. **ρ_c calibration** — The 0.23 threshold is from simulated environments. What is the equivalent density for a shared vector database with real LLM agents?

---

## Related

- [PDSA: Agent Memory Research](../../pdsa/2026-02-19-agent-memory.pdsa.md) — the research journey (3 iterations)
- [14-AGENT-CONTEXT](../../feedback/agent-memory/14-AGENT-CONTEXT.md) — consolidated vision with MVP architecture
- [12-DEEP-DIVE-ITER3](../../feedback/agent-memory/12-DEEP-DIVE-THINKING-INFRASTRUCTURE-ITER3.md) — 8-layer architecture, Hopfield formalism, sleep consolidation
- [13-MVP-SPEC](../../feedback/agent-memory/13-MVP-SPEC-THOUGHT-TRACING.md) — payload schema, pheromone model, endpoint design
- [agent-memory-what.md](agent-memory-what.md) — what is worth remembering
- [agent-memory-when.md](agent-memory-when.md) — lifecycle triggers
