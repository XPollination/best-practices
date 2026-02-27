# XPollination — Full Agent Context Document

**Last updated: 2026-02-19 | Status: MVP specification complete, ready to build**

---

## 1. What Is XPollination?

XPollination is a **Thought Tracing and Knowledge Synthesis System** that transforms a shared vector database into a self-organizing cognitive substrate. Decentralized AI agents contribute thoughts, the system traces how those thoughts get used by others, and "highways" form where collective thinking concentrates — all with full provenance tracking back to the original contributor.

**The core insight**: When multiple agents query a shared vector database, their retrieval patterns ARE knowledge. The system doesn't just store thoughts — it observes how they flow between agents and uses that flow to surface emerging consensus, bridge disconnected knowledge domains, and reward contributors whose thinking proves valuable downstream.

**The mining metaphor**: Contributing a thought is like mining a token. The thought carries provenance (who created it). When others retrieve and build on it, value flows — like a river powering watermills downstream. The proof-of-work is not computational waste but genuine intellectual contribution, validated by actual usage.

---

## 2. Research Foundation (3 iterations of deep research)

### Iteration 1: Landscape
- Reviewed cutting-edge agent memory systems: A-MEM (NeurIPS 2025), EverMemOS (January 2026), G-Memory, Collaborative Memory (ICML 2025), Mem0
- Identified that XPollination's vision is convergent with academic research direction
- Found five major gaps in existing systems: no cross-system knowledge tracing, no retrieval-as-signal, no consolidation from usage patterns

### Iteration 2: Building blocks
- **HNSW hub highways**: Vector databases naturally form navigation highways through hub nodes (arXiv:2412.01940, FlatNav). 50-70% of early search visits hit hub nodes. These are the natural "thought highways."
- **Biological memory parallels**: Hebbian learning (co-accessed vectors strengthen association), hippocampal consolidation (episodic→semantic transformation during "sleep"), complementary learning systems (fast store + slow consolidation)
- **Stigmergy**: Indirect coordination through environmental traces (like ant pheromone trails). Applied to vector databases: retrieval patterns ARE the traces. No direct communication needed between agents.
- **Key gap found**: No vector database natively tracks semantic query patterns. No published algorithm detects multi-user convergence in shared embedding space.
- **Three-layer architecture proposed**: Observation (log access patterns) → Pattern Detection (streaming clustering) → Reinforcement/Consolidation (Hebbian updates + sleep cycles)

### Iteration 3: Deep substrate (novel contributions)
- **Hopfield-Attention-Vector Database unification**: Vector retrieval, transformer attention, and Hopfield network pattern completion are the SAME mathematical operation. The vector database IS a Hopfield network. Stored vectors = memory attractors. Queries = probes descending the energy landscape. Hub nodes = saddle points connecting basins. This gives XPollination a formal theoretical foundation.
- **Input-Driven Plasticity (Science Advances, 2025)**: In Hopfield networks with IDP, noise drives retrieval to the DEEPEST energy wells. Translation: the diversity of multiple thinkers is the noise that ensures only genuine convergence (not coincidental overlap) becomes a permanent attractor.
- **Geometric Dynamics (Tacheny, arXiv:2512.10350)**: Formalizes agentic loops as dynamical systems in embedding space with three regimes: contractive (convergence), oscillatory (cycling), exploratory (divergence). Provides exact metrics: local drift, global drift, dispersion, cluster persistence. **Nobody has applied this to multiple simultaneous users** — this is XPollination's novel contribution.
- **Stigmergic phase transition (Khushiyant, arXiv:2512.10166)**: Critical density ρ_c ≈ 0.23. Below it, individual memory dominates. Above it, shared traces outperform individual memory by 36-41%. XPollination needs minimum user density before collective features activate.
- **Memory-as-Action RL (MemAct, arXiv:2510.12635)**: Memory operations (store, compress, discard, consolidate) can be learned via reinforcement learning. MemAct-14B matches models 16× larger. Future XPollination evolution: RL-optimized knowledge management.

---

## 3. MVP Specification

### What the MVP proves
1. Thoughts from one agent become discoverable by others through semantic proximity
2. Usage is tracked — "Agent A's insight is now used by Agents C, D, F"
3. Highways form — frequently used thoughts become more prominent
4. Provenance is preserved — every thought traces to its originator
5. Refinements link back to source contributions

### Architecture (4 components)
1. **Qdrant Vector Database** — shared knowledge substrate with rich payloads
2. **Agent API (FastAPI)** — 3 endpoints: /think, /retrieve, /highways
3. **Observation Middleware** — access logging, co-retrieval tracking, pheromone updates
4. **Analytics & Highway Tracker** — periodic detection of emerging highways

### Three Core Endpoints

**POST /think** — Contribute a thought
- Embeds content, stores with contributor provenance
- Sets initial pheromone_weight = 1.0
- Supports thought_type: original | refinement | consolidation
- source_ids links to parent thoughts for provenance chain

**POST /retrieve** — Search with tracing
- Semantic search against shared thought space
- Logs: who accessed, when, which session, what else was co-retrieved
- Increments access_count, updates accessed_by list
- Reinforces pheromone_weight (+5% per access)
- Optional: exclude own thoughts to focus on others' thinking

**GET /highways** — See emerging thought highways
- Returns thoughts above access threshold accessed by multiple agents
- Ordered by access_count × unique_users
- Shows contributor, pheromone weight, co-retrieval partners

### Payload Schema (per vector point)

```json
{
  "contributor_id": "agent-alice-001",
  "contributor_name": "Alice",
  "content": "The actual thought text",
  "created_at": "2026-02-19T10:30:00Z",
  "thought_type": "original | refinement | consolidation",
  "source_ids": [],
  "access_count": 0,
  "last_accessed": null,
  "accessed_by": [],
  "access_log": [],
  "co_retrieved_with": [],
  "pheromone_weight": 1.0,
  "tags": []
}
```

### Pheromone Model
- Each access: weight += 0.05 (ceiling at 10.0)
- Each hour without access: weight *= 0.995 (floor at 0.1)
- ~11% decay per day without reinforcement
- Highways fade if not maintained by traffic — the system self-regulates

### Tech Stack
- Qdrant (Docker) — vector storage with payload indexing
- FastAPI (Python) — async API server
- OpenAI ada-002 or e5-large-v2 — embeddings
- APScheduler — background jobs (decay, highway detection)
- SQLite/PostgreSQL — query log storage

### Implementation Timeline
- **Week 1**: Foundation — Qdrant + FastAPI + embedding + basic access counting
- **Week 2**: Tracing — full access logs, co-retrieval, pheromone system
- **Week 3**: Visibility — /highways, contribution reports, simple dashboard
- **Week 4**: Testing — 3-consultant scenario, measure emergence

---

## 4. Full Vision (Post-MVP Layers)

| Layer | Purpose | Key Technology |
|-------|---------|---------------|
| 0: Vector DB | Store thought vectors with payloads | Qdrant |
| 1: Observation | Log all queries and retrievals | Middleware + query log |
| 2: Pattern Detection | Real-time hotspot detection | DenStream + SRRDBSCAN |
| 3: Convergence | Multi-user convergence math | Sliced Wasserstein + Bayesian changepoint |
| 4: Reinforcement | Stigmergic self-organization | Multi-family pheromones + Hebbian updates |
| 5: Sleep Consolidation | Episodic → semantic transformation | NREM (abstraction) + REM (bridging) |
| 6: Knowledge Graph | Co-retrieval + GraphRAG hybrid | PMI-weighted edges + Leiden communities |
| 7: RL Policy | Learned memory operations | DCPO-style optimization |
| 8: Visualization | Make the geometry visible | Trajectory maps + highway views |
| 9: Token Economy | Mining metaphor realized | Provenance-based value attribution |

---

## 5. Key Concepts Glossary

**Thought vector**: An embedded unit of thinking stored in the vector database with provenance metadata.

**Highway**: A thought vector (or cluster of related vectors) that gets accessed by many different agents, forming a well-worn path through the knowledge space.

**Pheromone weight**: A decaying reinforcement signal on each vector. Increases with access, decreases with time. Mimics ant colony pheromone trails.

**Co-retrieval**: When two thought vectors appear in the same search result set. Repeated co-retrieval reveals functional associations that no individual agent explicitly created.

**Provenance chain**: The DAG of contributor_id + source_ids linking every thought back to its origins. The "river" along which intellectual value flows.

**Sleep consolidation**: Periodic process that abstracts dense clusters of specific thoughts into higher-order insight vectors, while pruning and decaying unused knowledge.

**Convergence zone**: A region of embedding space where multiple independent agents' query trajectories converge. Detected via streaming clustering + statistical tests.

**Stigmergic phase transition**: The critical user density (~23% of environment capacity) above which shared traces outperform individual memory. Below it, individual features dominate.

**Energy landscape**: The Hopfield network interpretation where stored vectors are attractors, queries descend toward them, and frequently accessed regions are deep energy wells.

---

## 6. Document Inventory

### Specification Documents (xpollination-spec/)

| # | File | Content |
|---|------|---------|
| 01 | SYSTEM-VISION.md | Philosophy, bubble problem, organic growth, truth anchoring |
| 02 | CORE-ARCHITECTURE.md | Data flow from thought to structured knowledge |
| 03 | AGENT-GUIDELINES.md | Mirroring protocol, knowledge contribution rules, thought unit schema |
| 04 | VECTOR-DB-AND-GRAPH-STRATEGY.md | Qdrant + graph DB hybrid, embedding strategy |
| 05 | TRUTH-ANCHORING-SYSTEM.md | Scoring mechanism, theological humility |
| 06 | INTEGRATION-SPEC.md | Server architecture, API design, Docker deployment |
| 07 | CONVERSATION-TRACE-001.md | First traced conversation |
| 08 | MULTI-AGENT-ACCESS-LAYER.md | How agents enter the system, state machine, context bean |
| 09 | DECENTRALIZATION-CHALLENGE.md | Why centralized fails, distributed architecture options |
| 10 | CONVERSATION-TRACE-002.md | Second traced conversation |
| 11 | AGENT-REVIEW-PDSA-MEMORY.md | Academic review of agent memory research |
| 12 | NEURAL-HIGHWAYS-IN-VECTOR-SPACE.md | Iteration 1-2 research: HNSW hubs, biological parallels, streaming algorithms |

### Research & MVP Documents (root outputs)

| # | File | Content |
|---|------|---------|
| 12 | DEEP-DIVE-THINKING-INFRASTRUCTURE-ITER3.md | Iteration 3 research: Hopfield unification, geometric dynamics, stigmergic phase transitions, RL formulation, 8-layer architecture |
| 13 | MVP-SPEC-THOUGHT-TRACING.md | **Complete MVP implementation spec**: endpoints, code, schema, tech stack, 4-week plan |
| 14 | AGENT-CONTEXT.md | **THIS FILE** — consolidated context for any agent |
| 15 | FRAMING-DOCS-01-11.md | Framing guide for docs 01–11: what each captures, why it exists, how they connect, and how they feed into the MVP |

---

## 7. For the Building Agent

**Start here**: Read this document (14) for full context, then read document 13 (MVP spec) for implementation details.

**If you need research depth**: Read document 12 (iteration 3 deep dive) for the theoretical foundation.

**If you need the original vision**: Read document 15 (framing guide for 01-11) for a summary of all specification documents without reading them all. Then read 01 and 03 if you need full detail on philosophy and agent rules.

**If you need database specifics**: Read document 04 (vector DB strategy) and the Qdrant sections of document 13.

**The single most important thing to understand**: Every retrieval is a signal. The system doesn't just store and fetch — it watches the flow of knowledge between agents and uses that flow to identify what matters, who contributed it, and where thinking is converging. The pheromone model makes this self-organizing. The provenance chain makes it attributable. The mining metaphor makes it economically meaningful.
