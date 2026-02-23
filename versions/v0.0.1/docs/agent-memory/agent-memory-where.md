# Where Does Memory Go?

> Status: emerging
> Source: XPollination spec (15 documents), multi-agent operations (2026-01–02), Galarza (2026-02-17), MVP spec (doc 13), 8-layer architecture (doc 12)
> Version: 4.0.0 | Last updated: 2026-02-23
> PDSA: [2026-02-19-agent-memory.pdsa.md](../../pdsa/2026-02-19-agent-memory.pdsa.md)

---

## Summary

Agent memory storage falls into three practical tiers: what you use **today** (markdown files and structured task metadata), what to add **next** when markdown hits its limits (a vector database with self-regulating prominence), and the **full vision** where all storage mechanisms operate concurrently on every interaction. The organizing insight across all tiers: **retrieval patterns ARE knowledge** — the system doesn't just store and fetch, it watches the flow of knowledge between agents and uses that flow to identify what matters. Most teams should start with markdown and only graduate upward when they hit concrete limitations — but they should understand the full landscape so they can design for future growth.

---

## Context

### Why Storage Architecture Matters

Every agent system faces the same progression: at first, a single configuration file holds everything an agent needs to remember. Then the file gets too long. Then you split it into multiple files. Then you can't find what you need across files. Then you add search. Then search isn't smart enough. Each step is triggered by a real limitation, not by architectural ambition.

This document maps that progression, drawing on:
- **Our experience** running a 4-agent system (LIAISON, PDSA, DEV, QA) with markdown-based memory since January 2026
- **The XPollination specification** (15 documents) describing an 8-layer concurrent architecture with vector databases, knowledge graphs, and self-organizing pheromone models
- **Academic research** on agent memory (A-MEM, Collaborative Memory, EverMemOS, Letta Sleep-Time Compute)
- **Industry practice** from Galarza's "How AI Agents Remember Things" and Google's Context Engineering framework

### The Hopfield Intuition

A useful way to think about storage: every stored memory is an **attractor** in an energy landscape (a concept from Hopfield networks, which are mathematically equivalent to vector database retrieval — see Ramsauer et al., ICLR 2021). Frequently accessed memories are deep attractors that queries naturally converge toward. Rarely accessed memories are shallow attractors that may not survive noise. Storage architecture determines the shape of this landscape — markdown files give you a flat, manually curated landscape; vector databases with pheromone weights give you a self-organizing one.

---

## Pattern

### Today: Markdown + Task Metadata (Day 1 Setup)

This is where every agent system starts, and where many should stay.

#### Global Configuration Files

Most agent frameworks load one or more configuration files into every prompt at session start. In Claude Code, this is `CLAUDE.md`:

```
~/.claude/CLAUDE.md                             → global rules (all projects, all agents)
project/CLAUDE.md                               → project-specific protocols
```

These files hold **procedural memory** — rules and protocols that must never be forgotten. Examples: git workflow, role boundaries, infrastructure constraints. Every line costs prompt tokens in every session, so they should be concise.

**In our system:** The global `CLAUDE.md` is ~300 lines of accumulated protocol from 2 months of multi-agent operations. It includes git rules, agent role definitions, tmux session layout, and hard-won lessons from operational failures.

#### Memory Index + Topic Files

When your configuration file gets too long, split it into an always-loaded index and on-demand detail files:

```
memory/
├── MEMORY.md                  → concise index (always loaded, capped at ~200 lines)
├── workflow.md                → detailed workflow engine specifics
├── debugging.md               → debugging patterns and solutions
└── project-notes.md           → project-specific context
```

The index is loaded at session start; topic files are read only when relevant. This gives you the benefits of comprehensive memory without the token cost of loading everything.

**In our system:** MEMORY.md is a 200-line concise index with entries like "Git Protocol," "Workflow System," "Known Project Databases." Each entry links to a topic file with full detail. The 200-line cap forces constant triage — a natural filtering mechanism.

#### Task Metadata as Episodic Memory

If you use a task management or project management system, the metadata on each task is a surprisingly effective memory store. Task metadata typically includes:

| Field | Memory Function |
|-------|----------------|
| Description | What needed to be done (semantic) |
| Findings/notes | What was learned while doing it (episodic) |
| Failure reasons | What went wrong (episodic) |
| Acceptance criteria | What "done" looks like (procedural) |
| Iteration count | How many attempts were needed (episodic) |

Each task becomes a self-contained memory unit with full context. Agents read this metadata when they claim a task, getting the complete history of what was tried before.

**In our system:** The PM system's task "DNA" (structured metadata) maps closely to the XPollination spec's "thought unit schema" — a standardized format for capturing what was thought, by whom, and with what confidence. Task DNA isn't just coordination; it's multi-agent episodic memory.

#### PDSA Documents as Trajectory Memory

When you want to preserve not just what was concluded but **how you got there**, structured research documents are the answer. The PDSA format (Plan-Do-Study-Act) captures the full trajectory of thinking:

| Section | Memory Function |
|---------|----------------|
| **Plan** | What was the hypothesis? What did we think going in? |
| **Do** | What was actually tried? What happened? |
| **Study** | What surprised us? What connections emerged? |
| **Act** | What should change going forward? |

These documents are trajectory memory — they preserve the path, not just the destination. The XPollination spec calls this "thought tracing" and considers it the most valuable kind of memory: "The ability to reproduce how different thinkers arrived at convergence is itself the knowledge."

**In our system:** This very document (agent-memory-where.md) was produced through a multi-iteration PDSA cycle. Each iteration deepened understanding — from shallow reformatting (iter 1) to genuine insights about how our PM system functions as memory infrastructure (iter 2) to theoretical grounding in Hopfield networks and pheromone models (iter 3) to practical restructuring for standalone readability (iter 4).

#### What a Day-1 Setup Looks Like

```
project/
├── CLAUDE.md                  → project protocols and rules
```

That's it. One file. Start here and add complexity only when you hit limitations.

#### What a Month-2 Setup Looks Like

```
project/
├── CLAUDE.md                  → shared protocols
├── .claude/
│   └── memory/
│       ├── MEMORY.md          → 200-line index
│       ├── workflow.md        → workflow details
│       └── debugging.md       → debugging patterns
├── data/tasks.db              → task metadata = episodic memory
└── pdsa/                      → trajectory memory (PDSA documents)
```

---

### Next Step: Vector Database + Pheromone Model (When Markdown Isn't Enough)

You need this when:
- Knowledge exceeds what agents can find by browsing files
- Queries are fuzzy ("find anything related to scaling challenges")
- Multiple agents need to share knowledge across project boundaries
- You want memory prominence to self-regulate instead of requiring manual curation

#### Adding Semantic Search

A vector database (such as Qdrant, Pinecone, or Weaviate) stores each piece of knowledge as a high-dimensional embedding vector. Agents search by meaning rather than keywords — "how do we handle authentication?" finds relevant memories even if they don't contain the word "authentication."

The XPollination MVP specification defines a single collection (`thought_space`) with rich metadata per vector:

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

Three types of stored thoughts:
- **Original** — a new insight, no parent
- **Refinement** — builds on an existing thought, linked via `source_ids`
- **Consolidation** — abstracts multiple thoughts into a higher-order insight

#### Self-Regulating Prominence (Pheromone Model)

The key innovation in the XPollination design is that memory prominence self-regulates through a pheromone model inspired by ant colony optimization:

- **Reinforcement:** Each time a memory is retrieved, its weight increases by 0.05 (ceiling at 10.0)
- **Decay:** Each hour without access, its weight decreases by 0.5% (floor at 0.1, ~11% total decay per day)

This solves the "never delete vs. 200-line cap" tension from markdown systems:
- **Everything is stored** (no information loss)
- **Frequently accessed knowledge rises** naturally to high prominence
- **Unused knowledge fades** toward the floor without manual pruning
- **Highways emerge** — frequently-used thoughts become well-worn paths through the knowledge space

#### Co-Retrieval: Emergent Associations

When two memories appear in the same search result set, the system logs this **co-retrieval** event. Over time, co-retrieval patterns reveal functional associations that no individual agent explicitly created — emergent knowledge discovered through usage, not authorship.

**This is the most important open validation gap.** Co-retrieval is theoretically powerful but has not been tested in our system. See [Open Questions](#open-questions) for a proposed experiment.

---

### Full Vision: 8 Concurrent Layers

The XPollination spec (document 12, "Deep Dive: Thinking Infrastructure") describes 8 layers that operate **simultaneously**, not sequentially. Even a markdown-only system runs some of these layers — the difference is automation and scale, not kind.

| Layer | What It Does | Markdown Equivalent | Vector DB Implementation |
|-------|-------------|--------------------|-----------------------|
| 0: Storage | Stores knowledge units | MEMORY.md + topic files | Qdrant with payload metadata |
| 1: Observation | Tracks who accesses what | Invisible (no logging) | Access log middleware |
| 2: Pattern Detection | Clusters query patterns | None | DenStream micro-clusters |
| 3: Convergence | Detects multi-user agreement | None | Sliced Wasserstein distance |
| 4: Reinforcement | Makes important things prominent | Manual MEMORY.md curation | Pheromone model |
| 5: Consolidation | Transforms raw experience into insights | PDSA Study phase | NREM/REM sleep cycle |
| 6: Knowledge Graph | Maps relationships between memories | Markdown cross-references | Co-retrieval PMI edges |
| 7: RL Policy | Learns optimal memory operations | Human editorial judgment | DCPO-style optimization |
| 8: Visualization | Makes knowledge flows visible | None | /highways API endpoint |

**Key insight from doc 11 (Agent Review):** These layers are concurrent, not sequential. Even today, a markdown system runs layers 0, 4, and 5 — storage (files), reinforcement (manual curation), and consolidation (PDSA Study). Adding a vector database doesn't "upgrade" from markdown — it adds layers 1-3 and automates layers 4-5.

#### Measurement Infrastructure: Geometric Dynamics

How do you know if your memory system is *working*? Tacheny's "Geometric Dynamics of Agentic Loops" (arXiv:2512.10350) provides measurement tools by formalizing agent trajectories through embedding space as discrete dynamical systems with three regimes:

- **Contractive** — convergence toward stable semantic attractors (the system is consolidating knowledge)
- **Oscillatory** — cycling among attractors (the system is exploring related topics)
- **Exploratory** — unbounded divergence (the system is generating novel connections)

Key geometric indicators: local drift (step-to-step stability), global drift (cumulative departure from starting point), dispersion (spread of trajectory points), cluster persistence (stability of attractor regions).

The unpublished multi-user extension relevant to agent memory: given N agents with individual trajectories through shared embedding space, track pairwise inter-trajectory distances over time. Decreasing distances = convergence. When multiple agents simultaneously enter contractive mode toward the same region = **collective convergence event** — the kind of signal that validates memory infrastructure is working.

---

## Evidence

### The Upgrade Path Is Real

Our system's evolution demonstrates the natural progression:

| Date | Memory Capacity | What Triggered the Upgrade |
|------|----------------|---------------------------|
| Jan 2026 | CLAUDE.md only (~50 lines) | Initial protocols |
| Late Jan | CLAUDE.md grew to 300+ lines | Accumulated lessons from multi-agent failures |
| Feb 2026 | MEMORY.md added (200-line cap) + topic files | CLAUDE.md was too large; needed index + detail separation |
| Feb 17 | Best-practices API deployed (basic semantic search via Qdrant — `/query` and `/ingest` endpoints, 384-dim embeddings, no access tracking or provenance) | Cross-project knowledge needed searchable access |
| Future | Pheromone model on Qdrant | When 200-line MEMORY.md can't hold all critical knowledge |

Each upgrade was triggered by hitting an actual limitation. This matches the principle: **start simple, graduate when constraints bite.**

### Git History IS the Never-Delete Layer

The XPollination spec says thought traces should never be deleted (document 04). Git history achieves this: every version of every file is permanently preserved. The 200-line cap trims active memory, but the history is permanent and searchable with `git log --all -S "search term"`.

### The Phase Transition Matters

Research on stigmergic systems (Khushiyant, arXiv:2512.10166) shows a critical density threshold at ρ_c ≈ 0.23: below this user density, individual memory dominates; above it, shared environmental traces outperform individual memory by 36-41%.

**Practical implication — being explicit about where we are:** Most multi-agent teams today (including our 4-agent system) are **below ρ_c**. This means:

- **Right now:** Individual memory dominates. MEMORY.md, topic files, and PDSA docs are the correct primary investment. Collective features (pheromone highways, co-retrieval associations) would add infrastructure cost without sufficient traffic to generate meaningful patterns.
- **What to watch for:** As you add agents/users to a shared vector database, monitor (a) unique contributors per week, (b) retrieval frequency per vector, (c) whether co-retrieval patterns stabilize or remain noisy. When these metrics show consistent collective patterns, you're approaching ρ_c.
- **The threshold is not binary:** Stigmergic features don't suddenly "turn on." They become increasingly valuable as density increases. The 0.23 figure is from simulated environments; your system's effective threshold depends on query diversity and knowledge overlap.

The collective features described in these documents (pheromone model, co-retrieval, highway detection) are **designed for the above-ρ_c regime**. Below it, they're theoretically sound but practically premature.

---

## Examples

### Minimal Viable Memory (New Project)

```
project/
├── CLAUDE.md                  → "Use git add with specific files. Never git add ."
```

### Growing System (Multi-Agent, 4+ Weeks)

```
project/
├── CLAUDE.md                  → 50 lines of protocols
├── .claude/memory/
│   ├── MEMORY.md              → 200-line index linking to topic files
│   ├── workflow.md            → workflow engine details
│   └── debugging.md           → debugging patterns
├── data/tasks.db              → task metadata (episodic memory)
└── pdsa/                      → trajectory documents
```

### Full System (Vector Search + Self-Organization) — TARGET, NOT YET BUILT

```
project/
├── CLAUDE.md
├── .claude/memory/
│   ├── MEMORY.md
│   └── *.md topic files
├── data/tasks.db
├── pdsa/
└── [Qdrant vector DB]         → pheromone-weighted semantic search
    ├── POST /think            → contribute thoughts with provenance (TO BE BUILT)
    ├── POST /retrieve         → search + access logging + pheromone (TO BE BUILT)
    └── GET /highways          → emerging thought patterns (TO BE BUILT)
```

**Note:** The best-practices API at `localhost:3200` currently provides only basic semantic search (`POST /api/v1/query`) and storage (`POST /api/v1/ingest`) — no access tracking, no provenance, no pheromone model. The endpoints above represent the target XPollination thought tracing system described in [13-MVP-SPEC](../../feedback/agent-memory/13-MVP-SPEC-THOUGHT-TRACING.md). See the [general specification](../../pdsa/2026-02-19-agent-memory.pdsa.md#iteration-9-general-specification) for the gap analysis and implementation plan.

---

## Key Takeaways

- **Start with one file (`CLAUDE.md`), add complexity only when you hit real limitations.** Most agent systems should stay at markdown for months before considering a vector database.
- **Task metadata is memory infrastructure you already have.** If you use a task/project management system, its description, findings, and iteration fields are already episodic memory — treat them that way.
- **PDSA documents are trajectory memory.** They preserve *how* you arrived at a conclusion, not just the conclusion itself. This is the most valuable kind of memory for long-lived systems.
- **The pheromone model bridges "never delete" and "200-line cap."** Store everything, let access frequency determine prominence. Frequently used knowledge rises; unused knowledge fades. No manual pruning needed.
- **The 8-layer architecture is concurrent, not sequential.** Even a markdown-only system runs storage, reinforcement, and consolidation layers. Adding a vector database doesn't "upgrade" — it adds new concurrent layers.

---

## Open Questions

1. **When to add a vector database** — what concrete signal indicates that markdown isn't enough? Current hypothesis: when agents routinely can't find information they need in MEMORY.md + topic files, or when cross-project knowledge discovery matters.

2. **Pheromone tuning** — the MVP spec uses 0.995/hour decay. Should different memory types decay at different rates? Should consolidation vectors (higher-order insights) decay slower than raw observations?

3. **Co-retrieval validation experiment** — to test whether co-retrieval reveals genuine emergent knowledge:
   - **Setup:** Populate a vector database with 15+ documents on distinct topics (e.g., the XPollination spec documents covering organizational design, agent architecture, memory systems, and knowledge management).
   - **Queries:** Have 3+ agents each make 20+ diverse queries over 1 week (e.g., "how should agent roles be separated?", "what makes knowledge persist?", "how do teams scale?"). Queries should span topics, not target specific documents.
   - **Measurement:** After the week, extract all co-retrieval pairs (documents that appeared together in search results 3+ times). Compare these emergent associations against the documents' explicit cross-references.
   - **Success criteria:** At least 2 co-retrieval associations that (a) were NOT in any document's explicit cross-references, and (b) a human reviewer confirms as genuinely useful connections.
   - **Failure criteria:** All co-retrieval associations are either already in explicit cross-references (no new knowledge) or are noise (no genuine connection).
   - This would validate or invalidate the most theoretically important claim in these documents.

4. **Knowledge graph necessity** — at what relationship complexity do markdown cross-references break down? Current hypothesis: when convergence detection across 3+ independent analysis paths is needed.

5. **Concurrent layer hooks** — how do you design markdown files so they're later ingestible by a vector database? Standardized metadata headers? Consistent atomic-note structure? Zettelkasten-style unique IDs?

See also: [pheromone decay for markdown](agent-memory-what.md#open-questions) | [stigmergic activation detection](agent-memory-when.md#open-questions) | [memory operations as learnable actions](agent-memory-what.md#open-questions)

---

## Related

- [PDSA: Agent Memory Research](../../pdsa/2026-02-19-agent-memory.pdsa.md) — the research journey
- [14-AGENT-CONTEXT](../../feedback/agent-memory/14-AGENT-CONTEXT.md) — consolidated XPollination vision
- [13-MVP-SPEC](../../feedback/agent-memory/13-MVP-SPEC-THOUGHT-TRACING.md) — payload schema, pheromone model, endpoint design
- [12-DEEP-DIVE-ITER3](../../feedback/agent-memory/12-DEEP-DIVE-THINKING-INFRASTRUCTURE-ITER3.md) — 8-layer architecture, Hopfield formalism
- [agent-memory-what.md](agent-memory-what.md) — what is worth remembering
- [agent-memory-when.md](agent-memory-when.md) — lifecycle triggers
