# Where Does Memory Go?

> Status: emerging
> Source: XPollination multi-agent operations (2026-01–02), Galarza (2026-02-17), XPollination spec (v0.0.1)
> Version: 1.0.0 | Last updated: 2026-02-18

---

## Summary

Agent memory is not stored in one place. Different memory types demand different storage mechanisms — from simple markdown files loaded into every prompt, to vector databases for semantic search, to knowledge graphs for relationship mapping. The right choice depends on access pattern, update frequency, and whether the memory needs to be human-readable.

---

## Context

A common mistake is treating agent memory as a single system. In practice, memory is distributed across multiple storage layers, each optimized for different access patterns:

| Storage Type | Access Speed | Update Frequency | Human Readable | Best For |
|---|---|---|---|---|
| MEMORY.md (prompt-injected) | Instant (always loaded) | Low (manual edits) | Yes | Semantic memory — stable facts |
| Topic files (on-demand read) | Fast (file read) | Medium | Yes | Detailed procedural knowledge |
| Daily logs (append-only) | Slow (search needed) | High (every session) | Yes | Episodic memory — what happened |
| Vector database | Fast (similarity query) | Medium | No | Semantic search across large histories |
| Knowledge graph | Medium (traversal query) | Low | No | Relationships and convergence patterns |

---

## Pattern

### Layer 1: MEMORY.md — The Always-Loaded Core

**What it is:** A markdown file with a hard line cap (200 lines in our system) that is injected into every agent prompt automatically.

**What goes here:**
- Critical protocols that must never be forgotten (git rules, role boundaries)
- Project structure overview and key file paths
- Concise index pointing to topic files for detail
- Lessons learned that are universal across sessions

**What does NOT go here:**
- Detailed procedures (too long — use topic files)
- Session-specific context (changes too often)
- Speculative or unverified patterns

**Our implementation:**
```
~/.claude/projects/.../memory/MEMORY.md    → 200-line cap, concise index
~/.claude/projects/.../memory/topic.md     → detailed notes per subject
~/.claude/CLAUDE.md                        → global shared memory (all projects)
project/CLAUDE.md                          → project-specific shared memory
```

**Key insight from Galarza:** "Markdown files work well — readable, debuggable, and require no infrastructure." The simplest storage that works is the right storage.

### Layer 2: Topic Files — Detailed Reference

**What it is:** Individual markdown files organized by subject, read on demand when MEMORY.md references them.

**Structure:**
```
memory/
├── MEMORY.md                  → concise index (always loaded)
├── liaison-process.md         → detailed liaison protocols
├── workflow-details.md        → workflow engine specifics
├── profile-assistant.md       → ProfileAssistant project notes
└── debugging.md               → debugging patterns and solutions
```

**Access pattern:** Agent reads MEMORY.md at startup, sees a reference like "Details: memory/liaison-process.md", and reads the topic file only when working on a liaison-related task.

**Advantage over putting everything in MEMORY.md:** Topic files can be any length. They don't consume prompt tokens unless the agent actually needs them.

### Layer 3: Daily Logs — Episodic Record

**What it is:** Append-only files organized by date, capturing what happened in each session.

**Format (from Galarza):**
```
YYYY-MM-DD.md    → day's events, decisions, blockers, outcomes
```

**Our equivalent:** Handoff files in `.claude/handoffs/` and PDSA documents that record each iteration's findings.

**When to use:** When you need to answer "What happened on date X?" or "When did we first encounter problem Y?" Episodic memory is the record of events, not the distilled lessons (those go in MEMORY.md).

### Layer 4: Vector Database — Semantic Search

**What it is:** Embeddings of knowledge units stored for similarity-based retrieval.

**When it's necessary:**
- Knowledge base exceeds what an agent can scan via file reads
- Queries are fuzzy ("find anything related to authentication patterns")
- Multiple projects need cross-pollination of insights

**Our implementation (best-practices API):**
- Qdrant vector database
- HuggingFace embeddings (all-MiniLM-L6-v2, 384 dimensions)
- REST API at localhost:3200 / bestpractice.xpollination.earth
- Ingests best practice markdown files, returns relevant results for agent queries

**XPollination spec vision (02-CORE-ARCHITECTURE):** Every thought unit gets embedded and stored for real-time context injection during conversations. The vector DB enables "what's nearby?" queries that surface relevant prior work.

### Layer 5: Knowledge Graph — Relationships

**What it is:** Explicit relationship mapping between concepts, people, decisions, and outcomes.

**When it's necessary:**
- You need to trace HOW a conclusion was reached (not just THAT it was reached)
- Multiple thinkers converge on the same idea from different angles
- You need to answer "What depends on X?" or "What influenced Y?"

**XPollination spec vision (02-CORE-ARCHITECTURE, 03-AGENT-GUIDELINES):**
```yaml
convergence_zone:
  id: uuid
  summary: "What multiple thinkers are converging toward"
  contributing_traces: [uuid]    # Which thought paths led here
  angle_count: int               # How many distinct perspectives
  status: "emerging" | "forming" | "established" | "best_practice"
```

**Our current state:** Not yet implemented. The spec envisions Neo4j or FalkorDB for graph storage. Currently, cross-references in markdown serve as a lightweight alternative.

---

## Evidence

### From Our System

**What works (Layer 1+2 — markdown files):**
- MEMORY.md has been the backbone of multi-agent coordination since January 2026
- 200-line cap forces prioritization — only the most important facts survive
- Topic files prevent MEMORY.md bloat while keeping detail accessible
- Git-versioned: every change is tracked, reversible, and auditable

**What's missing (Layers 4+5):**
- When MEMORY.md reaches its cap, we manually decide what to cut — no automated promotion/demotion
- Cross-project knowledge sharing relies on humans noticing connections
- The best-practices API (Layer 4) exists but isn't yet integrated into agent workflows as a memory layer

### From XPollination Spec

The 5-phase data flow (Capture → Decode → Refine → Embed/Store → Resurface) maps directly to memory layers:
- **Capture** → Daily logs / handoff files
- **Decode** → Topic files (structured interpretation of raw events)
- **Refine** → MEMORY.md (distilled, validated knowledge)
- **Embed/Store** → Vector DB + Knowledge Graph
- **Resurface** → Prompt injection (MEMORY.md) + semantic search (Vector DB)

### From External Research

Galarza emphasizes starting simple: "Markdown files work well." The progression from files → vector DB → knowledge graph should be driven by actual need, not architectural ambition. Most agent systems work well with Layer 1+2 alone until the knowledge base grows beyond what file-based access can handle.

---

## Examples

### Minimal Setup (New Project)

```
project/
├── CLAUDE.md              → project protocols (loaded automatically)
└── .claude/
    └── memory/
        └── MEMORY.md      → key facts, 200-line cap
```

### Growing Project (Multiple Agents, Accumulated Knowledge)

```
project/
├── CLAUDE.md              → shared protocols
└── .claude/
    └── memory/
        ├── MEMORY.md      → concise index
        ├── debugging.md   → debugging patterns
        ├── architecture.md → design decisions
        └── anti-patterns.md → what NOT to do
```

### Mature System (Cross-Project Knowledge)

```
~/.claude/
├── CLAUDE.md                          → global memory (all projects)
└── projects/
    └── {project}/
        └── memory/
            ├── MEMORY.md              → project-specific index
            └── *.md                   → topic files

Vector DB (Qdrant)                     → semantic search across all knowledge
Knowledge Graph (Neo4j)                → relationship mapping
REST API                               → agent query interface
```

---

## Open Questions

1. **Promotion/demotion** — When a topic file's content becomes critical enough for MEMORY.md, or when a MEMORY.md entry becomes stale enough to demote, what triggers the move? Currently manual.
2. **Vector DB integration point** — Should agents query the vector DB as part of their startup routine (alongside loading MEMORY.md), or only on-demand during specific tasks?
3. **Graph vs. cross-references** — At what knowledge volume do markdown cross-references break down and a proper knowledge graph becomes necessary?
4. **Decentralized memory** — The XPollination spec envisions distributed agents with local caches syncing to a central knowledge API. How does memory sync work when multiple agents might write conflicting memories simultaneously?

---

## Related

- [Synaptic Folder Structure](../knowledge-management/synaptic-folder-structure.md) — organizing files as knowledge units
- [02-CORE-ARCHITECTURE spec](../../spec/02-CORE-ARCHITECTURE.md) — hybrid storage (vector + graph + markdown)
- [09-DECENTRALIZATION-CHALLENGE spec](../../spec/09-DECENTRALIZATION-CHALLENGE.md) — local vs. central memory architecture
- [agent-memory-what.md](agent-memory-what.md) — what is worth remembering
- [agent-memory-when.md](agent-memory-when.md) — lifecycle triggers for writing memory
