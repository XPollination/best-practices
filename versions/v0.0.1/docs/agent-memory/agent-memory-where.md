# Where Does Memory Go?

> Status: emerging
> Source: XPollination spec (10 documents, esp. 02, 04, 06, 09), multi-agent operations (2026-01–02), Galarza (2026-02-17)
> Version: 2.0.0 | Last updated: 2026-02-19
> PDSA: [2026-02-19-agent-memory.pdsa.md](../../pdsa/2026-02-19-agent-memory.pdsa.md)

---

## Summary

Memory storage is a spectrum from "always loaded, human-readable markdown" to "vector-indexed, graph-connected, machine-queryable databases." The XPollination spec envisions a 5-layer architecture; our practice uses 2.5 layers effectively. The key insight: start at the bottom (markdown files), and graduate upward only when the current layer's limitations are actually hit — not when they're theoretically possible.

---

## Context

### The Spec's 5-Layer Vision

The XPollination spec (documents 01-10) describes a comprehensive memory architecture:

| Layer | Spec Reference | What It Stores | How It's Accessed |
|-------|---------------|----------------|-------------------|
| 1. Working Memory | 02-CORE-ARCHITECTURE (Mirroring Loop) | Active conversation context | Automatic (in context window) |
| 2. Session Memory | 03-AGENT-GUIDELINES (ConversationSession nodes) | Thought units within a session | Traversal by session_id |
| 3. Structured Knowledge | 04-VECTOR-DB-AND-GRAPH (hybrid storage) | Embeddings + relationships + markdown | Vector search + graph traversal + file read |
| 4. Truth Anchoring | 05-TRUTH-ANCHORING-SYSTEM | Scripture embeddings as fixed reference | Semantic similarity scoring |
| 5. Distributed Knowledge | 09-DECENTRALIZATION-CHALLENGE | Lean central API + local processing | REST API queries from distributed agents |

### Our Actual Implementation

| Layer | Implementation | Status |
|-------|---------------|--------|
| 1. Working Memory | Context window | Automatic |
| 2. Session Memory | Handoff files + task DNA | Implemented (simpler format) |
| 3. Structured Knowledge | MEMORY.md + topic files + CLAUDE.md | Partially (markdown only, no vector/graph) |
| 4. Truth Anchoring | Protocol rules in CLAUDE.md (fixed points) | Analogy only |
| 5. Distributed Knowledge | Best-practices API (Qdrant) exists | Not integrated as agent memory |

The gap is in Layer 3: the spec envisions Vector DB + Knowledge Graph + Git working together. We have Git (markdown files) only. The vector database exists in the best-practices API but agents don't use it as a memory retrieval system.

---

## Pattern

### Layer 1: MEMORY.md — The Always-Loaded Core

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

**The 200-line cap is a feature:** It forces constant triage — every new entry must justify displacing an existing one. This is write-time filtering: the discipline of deciding what's important enough to cost prompt tokens in every future session.

**Galarza's confirmation:** "Markdown files work well — readable, debuggable, and require no infrastructure." The simplest storage that works is the right storage.

### Layer 2: Task DNA — Multi-Agent Episodic Memory

**Discovery from PDSA research:** The PM system's task DNA is functionally equivalent to the spec's thought unit schema (03-AGENT-GUIDELINES). Task DNA stores:

| Field | Memory Function |
|-------|----------------|
| `description` | What was the task (semantic) |
| `findings` | What was learned (episodic) |
| `rework_reason` | What went wrong (episodic) |
| `acceptance_criteria` | What "done" looks like (procedural) |
| `deliverables` | What was produced (semantic) |
| `rework_iteration` | How many attempts (episodic) |

**Access pattern:** Agents read DNA when claiming a task. The DNA IS the context — it contains everything the agent needs to understand the work, including the history of previous attempts.

**Key difference from MEMORY.md:** Task DNA is task-scoped (only loaded when working that task). MEMORY.md is session-scoped (always loaded). DNA can be arbitrarily long; MEMORY.md is capped.

### Layer 3: Topic Files — Detailed Reference Library

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

### Layer 4: PDSA Documents — Trajectory Preservation

**PDSA documents are NOT just process artifacts — they're the trajectory memory the spec envisions.**

The spec says: "The ability to reproduce how different thinkers arrived at convergence is itself the knowledge" (01-SYSTEM-VISION). PDSA documents capture exactly this:

| PDSA Section | Memory Function |
|---|---|
| PLAN | Hypothesis and research scope (what did we think going in?) |
| DO | What was attempted (the execution trace) |
| STUDY | What was learned, what surprised us (the distilled episodic memory) |
| ACT | What should change (the conclusions that may become MEMORY.md entries) |

**Location:** `versions/v0.0.1/pdsa/*.pdsa.md` — version-controlled, searchable, human-readable.

### Layer 5: Vector Database — Semantic Search (When Markdown Isn't Enough)

**Our implementation:** Best-practices API with Qdrant (384-dim embeddings via HuggingFace all-MiniLM-L6-v2).

**When you need this layer:**
- Knowledge base exceeds what agents can find by reading files
- Queries are fuzzy ("find anything related to authentication")
- Cross-project knowledge needs to be surfaced

**The spec's vision (04-VECTOR-DB-AND-GRAPH-STRATEGY):** Four Qdrant collections (`thought_traces`, `convergence_zones`, `best_practices`, `scripture_anchors`). Every thought unit gets embedded. Real-time context injection on every utterance via `get_live_context()` (06-INTEGRATION-SPEC).

**Current gap:** Our API stores best-practice documents but agents don't query it as part of their memory retrieval flow. The upgrade path: integrate API queries at session start or task start, alongside MEMORY.md loading.

### Layer 6 (Future): Knowledge Graph — Relationships

**Not yet implemented.** The spec envisions Neo4j/FalkorDB for:
- Tracing HOW conclusions were reached (`:EVOLVED_FROM` edges)
- Detecting convergence across multiple thinkers (`:CONVERGES_AT`)
- Truth anchoring (`:ANCHORED_IN` edges to scripture)

**Current lightweight equivalent:** Cross-references in markdown files. Links between documents serve as manual relationship edges.

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
| Future | Agent startup queries Qdrant | When 200-line MEMORY.md can't hold all critical knowledge |

Each upgrade was triggered by hitting an actual limitation, not by architectural ambition. This matches the principle: start simple, graduate when constraints bite.

### Git History IS the Never-Delete Layer

The spec says thought traces should never be deleted (04). Our git history achieves this: every version of MEMORY.md, every CLAUDE.md edit, every PDSA document is preserved in git. The 200-line cap trims the ACTIVE memory, but the HISTORY is permanent. This is an accidental implementation of the spec's principle.

### Thomas's Decentralization Insight Applies to Memory

From spec 09 (DECENTRALIZATION-CHALLENGE), Thomas pivoted from centralized to distributed: "If every AI in the world queries one server, tokens burn away."

Applied to memory: agent memory SHOULD be local (MEMORY.md, CLAUDE.md, topic files). The central system (PM database, best-practices API) stores coordination data and collective knowledge. This is exactly our current architecture — it emerged naturally before the spec articulated it.

---

## Examples

### Minimal Setup (New Project, Day 1)

```
project/
├── CLAUDE.md                  → project protocols
```

One file. No overhead. This is enough to start.

### Working System (Multi-Agent, Month 2)

```
project/
├── CLAUDE.md                  → shared protocols
├── .claude/
│   └── memory/
│       ├── MEMORY.md          → 200-line index
│       ├── workflow.md        → workflow details
│       └── debugging.md      → debugging patterns
├── data/xpollination.db      → PM system (task DNA = episodic memory)
└── versions/v0.0.1/
    └── pdsa/                  → trajectory memory (PDSA documents)
```

### Mature System (Cross-Project, Semantic Search)

Add to the above:
```
Vector DB (Qdrant)             → semantic search across all knowledge
REST API                       → agent query interface at session/task start
```

---

## Open Questions

1. **Integration trigger** — When should agents start querying the vector API as part of their memory flow? A concrete signal: when agents routinely can't find information they need in MEMORY.md + topic files.
2. **Knowledge graph necessity** — At what relationship complexity do markdown cross-references break down? Current hypothesis: when convergence detection across 3+ independent analysis paths is needed.
3. **Decentralized memory sync** — If multiple agents write to separate memory stores, how do you merge without conflicts? Git handles file-level merging; vector/graph stores have no equivalent.
4. **DNA as formal memory** — Should task DNA include explicit memory-intent fields (e.g., `lessons_learned`, `persist_to_memory`)? This would make the PM system an explicit rather than accidental memory layer.

---

## Related

- [PDSA: Agent Memory Research](../../pdsa/2026-02-19-agent-memory.pdsa.md) — the research journey
- [Synaptic Folder Structure](../knowledge-management/synaptic-folder-structure.md) — organizing knowledge files
- [02-CORE-ARCHITECTURE spec](../../spec/02-CORE-ARCHITECTURE.md) — 5-phase data flow
- [04-VECTOR-DB-AND-GRAPH-STRATEGY spec](../../spec/04-VECTOR-DB-AND-GRAPH-STRATEGY.md) — hybrid storage architecture
- [09-DECENTRALIZATION-CHALLENGE spec](../../spec/09-DECENTRALIZATION-CHALLENGE.md) — central vs. distributed
- [agent-memory-what.md](agent-memory-what.md) — what is worth remembering
- [agent-memory-when.md](agent-memory-when.md) — lifecycle triggers
