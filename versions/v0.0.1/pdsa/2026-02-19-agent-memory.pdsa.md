# PDSA: Agent Memory Systems — What, Where, When

**Date:** 2026-02-19
**Author:** PDSA Agent
**Task:** best-practice-agent-memory
**Status:** ACTIVE (iteration 11 — standalone spec extraction, 9 feedback items)

---

## PLAN

### Problem Statement

Agent memory is the bridge between ephemeral context windows and persistent knowledge. Without it, agents repeat mistakes, lose insights, and can't build on prior work. The XPollination spec envisions a sophisticated 5-layer knowledge architecture (spec docs 01-09), but the actual implementation running today is simpler: markdown files loaded into prompts. The gap between vision and practice needs documentation.

This PDSA explores three fundamental questions:
1. **What** is worth remembering? (The filtering problem)
2. **Where** does it go? (The storage architecture problem)
3. **When** does it get written? (The lifecycle trigger problem)

### Research Sources

**Internal (our system — lived experience):**
- All 10 spec documents in `versions/v0.0.1/spec/` (read in full)
- CLAUDE.md files (~300 lines of accumulated agent protocols)
- MEMORY.md (200-line concise index with topic files)
- 4 topic memory files (liaison-process.md, workflow-details.md, profile-assistant.md, homepage-implementation-status.md)
- 3 existing PDSAs in the repo
- Multi-agent operational experience January–February 2026

**External:**
- Damian Galarza, "How AI Agents Remember Things" (2026-02-17)
- Google Context Engineering framework (semantic/episodic/procedural types)

### Hypothesis

The spec's 5-layer architecture (working memory → session memory → structured knowledge → truth anchoring → distributed knowledge) maps onto a practical progression that most agent systems will follow — but most will only ever need the first two layers. The spec vision is the ceiling; markdown files are the floor. The interesting questions are: when do you need more, and what triggers the upgrade?

---

## DO

### Phase 1: Deep Reading of All 10 Spec Documents

I read all 10 spec files. Here's what each contributes to the memory question:

| # | Document | Memory-Relevant Insight |
|---|----------|------------------------|
| 01 | System Vision | "The ability to reproduce how different thinkers arrived at convergence is itself the knowledge." Trajectories matter, not just conclusions. |
| 02 | Core Architecture | 5-phase data flow: Capture → Decode → Refine → Embed/Store → Resurface. The Mirroring Loop is the learning mechanism. |
| 03 | Agent Guidelines | Thought unit schema with 6 sections (content, metadata, tracing, anchoring, resonance, embedding). Defines what a "memory unit" looks like. |
| 04 | Vector DB & Graph Strategy | "Thought traces are never deleted — they represent the journey." Hybrid storage: vectors for similarity, graphs for relationships. |
| 05 | Truth Anchoring | "All overrides are traced — the system remembers both the automated score and the human adjustment." Memory preserves disagreement. |
| 06 | Integration Spec | `get_live_context()` — every time a human speaks, the system queries Vector DB + Graph + Best Practices + Truth Anchors. Memory is read on every utterance. |
| 07 | Conversation Trace 001 | Thomas: "Whatever you understand at this moment, be as granular as you can and document it now." Write early, write often. |
| 08 | Multi-Agent Access | Guided intake state machine: AIs learn the system through interaction, not documentation. The system TEACHES agents how to use it. |
| 09 | Decentralization | Thomas pivoted from centralized to decentralized: "If every AI in the world queries one server, tokens burn away." Central knowledge, distributed processing. |
| 10 | Conversation Trace 002 | Context bean pattern: structured intake with required/optional fields. This is a FILTERING mechanism — it forces agents to specify what they need before the system retrieves it. |

### Phase 2: Mapping Spec Vision to Real-World Practice

**The spec describes a 5-layer memory architecture:**

1. **Working Memory** — active conversation context (spec 02, the Mirroring Loop)
2. **Session Memory** — thought units within a session (spec 03, ConversationSession nodes)
3. **Structured Knowledge** — Vector DB + Knowledge Graph + Git (spec 04, hybrid storage)
4. **Truth Anchoring** — scripture embeddings as fixed reference (spec 05)
5. **Distributed Knowledge** — lean central API + local processing (spec 09)

**What we actually run today:**

1. **Working Memory** — context window (all agents have this automatically)
2. **Session Memory** — handoff files in `.claude/handoffs/`
3. **Structured Knowledge** — MEMORY.md (200 lines) + topic files + CLAUDE.md
4. **Truth Anchoring** — not implemented
5. **Distributed Knowledge** — not implemented; best-practices API (Qdrant) exists at `localhost:3200` but provides only basic semantic search (`/query`, `/ingest`) — no thought provenance, no access tracking, no pheromone model

**The gap:** Layers 1-2 are nearly identical between spec and practice. Layer 3 is dramatically simpler in practice (markdown vs. vector+graph+git). Layers 4-5 don't exist yet.

### Phase 3: Analyzing the Galarza Article

Galarza identifies four write mechanisms:
1. **Bootstrap loading** — inject MEMORY.md at session start
2. **Pre-compaction flush** — silent agentic turn to save before context limit
3. **Session snapshots** — capture last 15 meaningful messages on `/new`
4. **Explicit user requests** — user says "remember this"

**Key insight Galarza provides that the spec doesn't address:** The **consolidation problem**. When users express the same preference multiple ways, memory needs to collapse duplicates. Our MEMORY.md has no automated consolidation — humans edit manually. Galarza suggests a separate LLM instance for this.

**Key insight the spec provides that Galarza doesn't address:** **Convergence detection.** The spec envisions finding where multiple thinkers naturally agree (spec 04: when 3+ angles cluster, a convergence zone is created). This is a fundamentally different memory pattern — it's not "what does one user want to remember" but "what does the collective naturally converge toward." Galarza's model is single-user; the spec is multi-thinker.

### Phase 4: Identifying the Three Key Tensions

**Tension 1: Selectivity vs. Completeness**
- Spec: "Thought traces are never deleted" (04) — everything is kept
- Practice: 200-line cap on MEMORY.md — heavy filtering required
- Galarza: "Targeted filtering is necessary" — extraction must be selective
- Resolution: The spec preserves everything in the database but only surfaces relevant items via search. MEMORY.md can't do this — it's all-or-nothing. The upgrade path is clear: when 200 lines isn't enough, you need vector-backed retrieval.

**Tension 2: Trajectory vs. Conclusion**
- Spec: "The ability to reproduce how different thinkers arrived at convergence is itself the knowledge" (01) — the path matters
- Practice: MEMORY.md stores conclusions only ("Git protocol: always do X")
- Galarza: Daily logs capture some trajectory, but session snapshots are raw — not structured paths
- Resolution: Our PDSA documents ARE trajectory documentation. The PDSA format (Plan → Do → Study → Act) is a thought trace structure. We're doing trajectory preservation — just not in the database layer.

**Tension 3: Single-Agent vs. Multi-Agent Memory**
- Spec: Multi-thinker convergence detection, angle tracking, resonance scoring (03, 04)
- Practice: Shared CLAUDE.md (all agents read same memory), no per-agent memory
- Galarza: Single-user model with personal MEMORY.md
- Resolution: Our system accidentally solves this through role-based task DNA. Each agent reads shared protocols (CLAUDE.md) but gets task-specific context through DNA. The workflow system IS the multi-agent memory coordination layer — it just doesn't look like one.

### Phase 5: Writing the Deliverables

Based on this research, I produced:
1. **PDSA document** (this file) — traces the research journey
2. **agent-memory-what.md** — answers "what is worth remembering?"
3. **agent-memory-where.md** — answers "where does it go?"
4. **agent-memory-when.md** — answers "when does it get written?"
5. **README.md** — topic navigation

---

## STUDY

### What Surprised Me

1. **The workflow system is agent memory infrastructure.** I didn't see this until Phase 4. Task DNA contains: requirements, findings, deliverables, rework reasons — this IS episodic memory for agents. The PM system isn't just coordination; it's the multi-agent memory layer. The spec's "thought unit schema" (03) has a near-perfect analog in our task DNA structure (title, description, findings, acceptance criteria → content, metadata, tracing, anchoring).

2. **PDSA documents ARE thought traces.** The spec envisions "tracing how thinking arrived at conclusions" (01). Our PDSA format does exactly this: PLAN documents the hypothesis, DO documents what was tried, STUDY documents what was learned, ACT documents what changes. We're implementing the spec's core vision in a different form factor.

3. **The 200-line cap is a feature, not a limitation.** It forces a constant filtering process — deciding what to keep and what to evict is itself a knowledge distillation mechanism. The spec's approach of "never deleting" (04) avoids this hard filtering, but at the cost of requiring sophisticated retrieval (vector search) to find relevant items in a sea of stored traces.

4. **Galarza and the spec complement perfectly.** Galarza solves the single-agent-across-sessions problem (how does one agent remember between conversations). The spec solves the multi-thinker-across-angles problem (how do multiple perspectives converge). Our system needs both — and currently has the Galarza pattern (MEMORY.md) but not the spec pattern (convergence detection).

5. **The decentralization pivot (spec 09) changes everything about memory architecture.** Thomas's insight that "central server = lean knowledge API, distributed processing" means agent memory SHOULD be local. The heavy lifting (embedding, similarity search, consolidation) happens on the agent's infrastructure. The central system only stores the distilled results. This maps to our current reality: CLAUDE.md is local memory, the PM system is central coordination, and there's no central "brain" doing the thinking for agents.

### What Connections Did I Find?

**Spec ↔ Practice Mapping:**

| Spec Concept | Our Practice | Status |
|---|---|---|
| Thought unit (03) | Task DNA | Implemented (different format) |
| Mirroring loop (02) | PDSA cycle | Implemented (different mechanism) |
| Convergence zone (04) | MEMORY.md lesson entries | Partially (manual, no multi-angle detection) |
| Truth anchoring (05) | Protocol rules in CLAUDE.md | Partially (rules as fixed points, no scripture) |
| Live context injection (06) | MEMORY.md auto-load | Implemented (simpler form) |
| Session memory (03) | Handoff files | Implemented |
| Never-delete principle (04) | Git history | Implemented (git preserves all versions) |
| Context bean (10) | Task DNA acceptance criteria | Implemented (DNA specifies required context) |

**Galarza ↔ Spec Mapping:**

| Galarza Concept | Spec Equivalent | Gap |
|---|---|---|
| MEMORY.md | Best practices markdown layer | Galarza is personal; spec is collective |
| Daily logs | Conversation traces | Galarza is append-only; spec adds angle/confidence metadata |
| Session snapshots | Thought unit storage | Galarza is raw; spec structures with schema |
| Pre-compaction flush | No equivalent | Spec assumes persistent storage; doesn't model context limits |
| Consolidation LLM | Convergence detection | Both solve "collapse duplicates" but at different scales |

### What Gaps Exist?

1. **No automated consolidation.** MEMORY.md grows until a human trims it. There's no process for detecting contradictions, outdated entries, or redundancies. Galarza suggests a separate LLM for this; we have no equivalent.

2. **No vector-backed retrieval for agent memory.** The best-practices API (Qdrant at `localhost:3200`) provides basic semantic search over embedded best-practice documents, but it lacks the features needed for agent memory: no thought provenance, no access logging, no pheromone model, no co-retrieval tracking. Agents don't use it — MEMORY.md is the only thing loaded at startup. When MEMORY.md hits its cap, knowledge is simply lost (or moved to topic files that may never be read).

3. **No per-agent memory.** All agents share CLAUDE.md/MEMORY.md. There's no mechanism for one agent to remember something that only it needs. The spec envisions per-thinker nodes in the knowledge graph; our system has no equivalent.

4. **Context pressure is undocumented as a memory trigger.** We learned through experience that compaction degrades traceability. This is a real-world pattern that neither the spec nor Galarza explicitly addresses: the moment BEFORE context loss is a critical write window.

---

## ACT

### What Should Change in Our System?

**Immediate (can implement now):**

1. **Add a "last reviewed" date to MEMORY.md entries.** This enables manual staleness detection. If an entry hasn't been reviewed in 30 days, flag it for human inspection during the next edit.

2. **Document the PM system as a memory layer.** Task DNA is agent memory — we should acknowledge this in our architecture docs rather than treating PM and memory as separate concerns.

3. **Extend the best-practices API into the XPollination thought tracing system.** The current API provides basic semantic search (`POST /api/v1/query`) and storage (`POST /api/v1/ingest`) with 384-dim embeddings and no access tracking. It needs new endpoints (`/think`, `/retrieve`, `/highways`), a pheromone model, access logging, co-retrieval tracking, and provenance metadata to serve as agent memory infrastructure. See iteration 9 for the general specification.

**Medium-term (next iteration):**

4. **Build automated memory consolidation.** Run a periodic process that reads MEMORY.md + topic files, detects contradictions and redundancies, and proposes consolidation. This could be a PDSA task for the next cycle.

5. **Add memory metadata to PDSA documents.** Each PDSA's STUDY and ACT sections should explicitly flag what should be persisted to MEMORY.md. Currently this happens implicitly; making it explicit creates a reliable memory extraction pipeline.

**Long-term (spec alignment):**

6. **Implement thought unit schema for task DNA.** Extend the PM system's DNA structure to match the spec's thought unit schema (confidence, angle, parent_id, resonance). This would enable the convergence detection patterns described in spec 04 without building a separate knowledge graph.

### Process Improvements

- **Rework lesson:** The initial submission reformatted DNA into markdown without deep research. The PDSA process exists precisely to prevent this — PLAN forces research, STUDY forces reflection, ACT forces conclusions. Skipping the process produces shallow output regardless of the template format.

- **Research time:** This iteration took ~45 minutes of active research (reading 10 spec files, analyzing Galarza, cross-referencing patterns). The initial attempt took ~10 minutes. The depth difference is substantial and visible in the deliverables.

---

---

# ITERATION 3: Deep Integration of New Source Material

**Date:** 2026-02-23
**Rework reason:** Thomas provided 5 new source documents (~1700 lines) with substantially deeper research: Hopfield network theory, pheromone models, stigmergic phase transitions, MVP specification, academic literature review, and an 8-layer architecture vision. The existing deliverables needed to integrate this material.

---

## PLAN (Iteration 3)

### New Sources

| Doc | Title | Lines | Key Contribution |
|-----|-------|-------|-----------------|
| 15 | Framing Guide (docs 01-11) | ~203 | Map of how original specs feed into MVP; reading priorities per role |
| 14 | Agent Context (consolidated) | ~195 | "Retrieval patterns ARE knowledge"; mining metaphor; MVP summary; glossary |
| 13 | MVP Spec: Thought Tracing | ~611 | Buildable spec with code: /think, /retrieve, /highways; pheromone model; payload schema |
| 12 | Deep Dive Iter 3 | ~497 | Hopfield-Attention-VectorDB unification; geometric dynamics; stigmergic ρ_c ≈ 0.23; sleep consolidation; 8-layer architecture |
| 11 | Agent Review (PDSA Memory) | ~187 | A-MEM, Collaborative Memory, MemAct references; concurrent-not-sequential correction; PDSA = 90% of thought unit |

### Hypothesis (Iteration 3)

The iteration 2 PDSA treated the spec's architecture as an aspirational ceiling and markdown files as the practical floor. The new material suggests a different framing: the spec vision is **convergent with cutting-edge research** (not aspirational), and the practical markdown implementation is the **first layer of a concurrent architecture** (not a separate thing). The pheromone model provides the missing bridge — a self-regulating mechanism that works at every scale from MEMORY.md to vector databases.

---

## DO (Iteration 3)

### Phase 1: Reading the Framing Guide (doc 15)

The framing guide reveals that docs 01-11 are not a specification — they're **three conversation loops** that trace Thomas's thinking in real-time:

- **Loop 1** (01-07): Vision crystallizes. What is XPollination? How does it work?
- **Loop 2** (08-10): Scale challenge. How do other AIs connect? Why does centralization break?
- **Loop 3** (11-12+): Research grounding. How does this compare to academic work?

Key insight: the specification itself is a thought trace. The documents are not describing a system from the outside — they ARE the mirroring loop they describe.

### Phase 2: The Core Insight from doc 14

> "When multiple agents query a shared vector database, their retrieval patterns ARE knowledge."

This reframes everything. Memory is not just "what you store" — it's "how stored things flow between agents." The mining metaphor: contributing a thought is like mining a token. When others retrieve and build on it, value flows downstream. The proof-of-work is genuine intellectual contribution, validated by actual usage.

The MVP proves 5 things:
1. Thoughts become discoverable through semantic proximity (no explicit sharing)
2. Usage is tracked (who accessed what)
3. Highways form (frequently used thoughts become prominent)
4. Provenance is preserved (every thought traces back to its originator)
5. Refinements link back to source contributions

### Phase 3: The MVP Spec (doc 13) — Concrete Architecture

Three endpoints define the entire system:

- **POST /think** — contribute a thought (embed + store with provenance, initial pheromone = 1.0)
- **POST /retrieve** — search with tracing (log access, update co-retrieval, reinforce pheromone +0.05)
- **GET /highways** — see emerging thought highways (access_count × unique_users)

The **pheromone model** is the key self-regulation mechanism:
- Each access: weight += 0.05 (ceiling at 10.0)
- Each hour without access: weight *= 0.995 (floor at 0.1)
- ~11% decay per day without reinforcement
- Highways fade if not maintained by traffic

This directly addresses iteration 2's "selectivity vs. completeness" tension: you don't need to choose between "never delete" and "200-line cap." Pheromone weight provides a continuous spectrum of memory prominence. Everything is kept, but only reinforced memories rise to the top.

The **co-retrieval** tracking is equally significant: when two thoughts appear in the same search result set, that association is logged. Repeated co-retrieval reveals functional connections that no individual agent explicitly created. This is **emergent knowledge** — the most valuable kind.

### Phase 4: Theoretical Foundation (doc 12)

**Hopfield-Attention-VectorDB Equivalence:**

The deepest insight: vector database retrieval, transformer attention, and Hopfield network pattern completion are the **same mathematical operation** (Ramsauer et al., ICLR 2021):

```
ξ_new = X · softmax(β · X^T · ξ)
```

A vector database is a Hopfield network. Stored vectors are memory attractors. Queries are probes descending the energy landscape. Hub nodes are saddle points connecting basins. Frequently queried regions are deep energy wells.

**Input-Driven Plasticity (IDP):** Under noise, the IDP model drives retrieval to the DEEPEST energy wells. Translation: **the diversity of multiple thinkers IS the noise that ensures only genuine convergence survives.** Shallow overlap (coincidental) gets washed out; deep convergence (genuine shared insight) gets reinforced.

**Geometric Dynamics (Tacheny, arXiv:2512.10350):** Formalizes agentic loops as dynamical systems with three regimes:
1. **Contractive** — convergence toward stable attractors (local similarity > 0.85)
2. **Oscillatory** — cycling among attractors
3. **Exploratory** — unbounded divergence

Nobody has applied this framework to **multiple simultaneous users** — this is XPollination's novel contribution.

**Stigmergic Phase Transition (Khushiyant, arXiv:2512.10166):** Critical density ρ_c ≈ 0.23. Below it, individual memory dominates. Above it, shared traces outperform individual memory by 36-41%. XPollination's collective features only activate meaningfully when user density crosses this threshold.

Critical finding: "Traces without memory fail completely" — raw retrieval counts are meaningless without cognitive infrastructure to interpret them.

**Sleep Consolidation:** Three production-ready patterns identified:
- Letta's dual-agent architecture (5× token reduction via sleep-time processing)
- EverMemOS's engram lifecycle (episodic → semantic transformation via incremental clustering)
- Zettelkasten sleep-consolidation (degree ≥ 2 nodes → LLM abstraction → insight nodes)

**8-Layer Architecture:** Layers 0-8 are concurrent operations, not a progression:
0. Vector DB (Qdrant) — storage substrate
1. Observation — log all queries and retrievals
2. Pattern Detection — streaming micro-clusters (DenStream + SRRDBSCAN)
3. Convergence — multi-user convergence math (Sliced Wasserstein + Bayesian changepoint)
4. Reinforcement — stigmergic self-organization (pheromones + Hebbian updates)
5. Sleep Consolidation — episodic → semantic transformation (NREM + REM)
6. Knowledge Graph — co-retrieval + GraphRAG hybrid
7. RL Policy — learned memory operations (DCPO-style)
8. Visualization — trajectory maps + highway views

### Phase 5: Agent Review (doc 11) — Critical Corrections

Doc 11 is an external review of iteration 2's PDSA. Five challenges:

1. **Scope too narrow** — missed A-MEM (NeurIPS 2025), Collaborative Memory (ICML 2025, 61% resource reduction), MemoryArena (Feb 2026), ICLR 2026 MemAgents Workshop
2. **Layers are concurrent, not sequential** — the spec's 5 layers aren't a progression you climb through; they're simultaneous operations on every interaction
3. **Consolidation gap deeper than realized** — needs active deduplication, contradiction resolution, relevance decay, provenance tracking, sleep consolidation
4. **PDSA format IS 90% of a thought unit** — missing only: truth_score, explicit confidence, formal angle tagging
5. **The rework itself is a thought trace** — iteration 1→2→3 IS the mirroring loop

### Cross-Reference: What Changes From Iteration 2

| Iteration 2 Understanding | Iteration 3 Correction |
|---|---|
| 5-layer architecture as floor→ceiling progression | Concurrent operations, all active from day one |
| "Never delete" vs "200-line cap" as binary tension | Pheromone decay provides continuous spectrum |
| No automated consolidation possible yet | Sleep consolidation has production-ready patterns |
| Spec vision is aspirational ceiling | Spec vision is convergent with cutting-edge research |
| Our system "accidentally" implements spec patterns | Our system implements spec patterns AT A DIFFERENT SCALE |
| Memory is stored knowledge | Retrieval patterns ARE knowledge; co-retrieval = emergent knowledge |
| Single-agent memory problem | Phase transition at ρ_c ≈ 0.23 determines individual vs collective mode |

---

## STUDY (Iteration 3)

### What Surprised Me

1. **The mathematical unification is real.** Vector retrieval = attention = Hopfield pattern completion isn't a metaphor — it's a proven equivalence (Ramsauer et al., ICLR 2021). This means the entire field of associative memory theory applies to vector databases. Every insight about Hopfield energy landscapes translates directly to how knowledge organizes in Qdrant.

2. **Diversity IS the noise that selects for robustness.** The IDP finding — that noise drives to deepest energy wells — means multi-user systems are INHERENTLY better at identifying genuine knowledge than single-user systems. This isn't just philosophically appealing; it's mathematically grounded.

3. **The phase transition gives concrete guidance.** ρ_c ≈ 0.23 means XPollination should design for two modes: below threshold (individual memory dominates, focus on personal knowledge management) and above threshold (collective features activate, access patterns reshape retrieval). This is actionable architecture.

4. **Sleep consolidation already has production-ready implementations.** I treated consolidation as a future dream in iteration 2. Letta's dual-agent architecture and EverMemOS's engram lifecycle are working today. The NREM/REM metaphor isn't poetic — it maps to concrete operations (cluster abstraction + bridge generation).

5. **Co-retrieval is the most underappreciated storage mechanism.** When two vectors are repeatedly retrieved together, they develop a functional association that nobody explicitly created. This emergent knowledge — the GAP between what text says entities are related (GraphRAG) and what users actually need together (co-retrieval) — is the most valuable signal in the system.

6. **Our PDSA process IS the mirroring loop.** Doc 11 points out that the rework from iteration 1→2→3 is itself a thought trace demonstrating the XPollination process working. We're not just documenting memory theory — we're DOING the memory consolidation the spec describes.

### Key Connections Found

**Pheromone Model ↔ MEMORY.md 200-Line Cap:**
The 200-line cap is a crude pheromone system. Entries that are frequently accessed (referenced every session) stay. Entries that aren't reinforced get pruned when space is needed. The pheromone model formalizes this: continuous reinforcement/decay replaces binary keep/delete.

**Sleep Consolidation ↔ PDSA Study Phase:**
The PDSA Study phase IS NREM consolidation. It clusters specific experiences (DO phase) into abstract insights. The ACT phase IS REM — it generates bridges between what was learned and what should change. We've been doing sleep consolidation manually all along.

**Stigmergic Phase Transition ↔ Multi-Agent Operations:**
Our 4-agent system (LIAISON, PDSA, DEV, QA) is likely below ρ_c for collective trace benefits. At this scale, individual agent memory (CLAUDE.md, MEMORY.md) correctly dominates. Collective features (access pattern tracking, highway detection) would only add value with more agents or users.

**Hopfield Attractors ↔ MEMORY.md Entries:**
Each MEMORY.md entry is an attractor in the agent's knowledge landscape. Strong attractors (frequently needed rules like git protocol) are deep energy wells. Weak attractors (rarely-referenced trivia) are shallow wells that may not survive noise. The 200-line cap acts as a selection pressure favoring deep attractors.

**MemAct RL ↔ Agent Decision-Making:**
Memory operations (store, compress, discard, consolidate) can be LEARNED. MemAct-14B matches models 16× larger by learning efficient memory strategies. Future XPollination agents could learn WHICH thoughts to store, WHERE to store them, and WHEN to consolidate — optimized by actual downstream utility.

### What Gaps Remain

1. **No implementation of continuous pheromone model for markdown memory.** The theoretical bridge between "200-line cap" and "pheromone decay" exists but has no practical implementation. Could be approximated with access-frequency metadata on MEMORY.md entries.

2. **Sleep consolidation needs scheduling infrastructure.** Production patterns exist (Letta, EverMemOS) but our system has no equivalent of "downtime" for consolidation. The `/compact` trigger is close but reactive, not proactive.

3. **Co-retrieval tracking doesn't exist in our markdown world.** We don't know which MEMORY.md entries are read together. Git blame can approximate authorship provenance but not access patterns.

4. **ρ_c threshold hasn't been validated for our specific system.** The 0.23 figure is from Khushiyant's simulated environment. The equivalent density for a shared vector database with real agents is unknown.

---

## ACT (Iteration 3)

### What Should Change in the Best Practice Documents

**agent-memory-what.md:**
- Add Hopfield/attractor framing: memories worth keeping are those that become deep energy wells
- Add pheromone model: memory value is self-regulating through reinforcement + decay
- Add co-retrieval: associations worth remembering include EMERGENT ones (co-retrieved, not explicitly created)
- Add thought types: original / refinement / consolidation
- Reference A-MEM, Collaborative Memory, MemAct
- Reframe "what not to remember" through pheromone decay = automatic forgetting

**agent-memory-where.md:**
- Correct "5-layer progression" to concurrent architecture
- Add 8-layer vision with clear MVP vs post-MVP distinction
- Add pheromone-weighted storage (continuous prominence, not binary keep/delete)
- Add co-retrieval graph as emergent storage layer
- Add HNSW hub highways as structural infrastructure
- Add sleep consolidation as a storage transformation mechanism

**agent-memory-when.md:**
- Add pheromone reinforcement as continuous trigger (every retrieval = memory write)
- Add sleep consolidation as periodic trigger (NREM + REM phases)
- Add stigmergic phase transition: when collective triggers activate (ρ_c ≈ 0.23)
- Add Letta sleep-time compute pattern
- Deepen pre-compaction with EverMemOS engram lifecycle

### Process Improvements

- **Research depth improved through iteration.** Iteration 1 took ~10 minutes and produced shallow reformatting. Iteration 2 took ~45 minutes and produced genuine insights (task DNA = thought units). Iteration 3 digested ~1700 lines of new material across 5 documents and produced structural corrections (concurrent not sequential) and new theoretical grounding (Hopfield, pheromone, stigmergy). The PDSA rework cycle works — each iteration builds on the last.

- **The rework process itself demonstrates the spec.** Three iterations of the same PDSA document is a mirroring loop. Each iteration reflects back more clearly. This PDSA should be the seed data for XPollination's first thought trace when the system is built.

---

---

# ITERATION 4: Usability Improvements

**Date:** 2026-02-23
**Rework reason:** LIAISON review identified 5 specific improvements needed for document usability and standalone readability.

---

## Feedback → Changes (Iteration 4)

| # | Feedback | Change Made |
|---|----------|------------|
| 1 | WHERE doc mixes practical and theoretical layers | Restructured around Today/Next Step/Full Vision tiers. 8-layer table moved to reference section. Day-1 and Month-2 setups lead the document. |
| 2 | Documents assume system familiarity | Replaced "our system" / "our MEMORY.md" with generic framing + "Example from practice" / "In a multi-agent system..." context sentences. System-specific terms explained on first use. |
| 3 | WHAT doc tiers unchanged from iter 2 | Rewrote tiers through attractor lens: Deep Attractors (survive noise, reach pheromone ceiling), Shallow Attractors (need reinforcement, hover 1.0-3.0), Ephemeral (decay to floor within days). |
| 4 | WHEN doc has no setup guidance | Added "Minimal Viable Memory Writing Setup" section with prescriptive checklists for Day 1, Week 1, Month 1, Month 3+, Month 6+ milestones. |
| 5 | Co-retrieval not grounded | Added explicit caveat: co-retrieval is "high-priority hypothesis, not established pattern." Proposed validation experiment (populate Qdrant with 15+ docs, multi-agent queries for 1 week, check co-retrieval edges vs explicit cross-refs). |

### Process Note

Iteration 4 was a usability pass, not a content pass. The theoretical depth from iteration 3 was correct — the issue was presentation: document organization, standalone readability, and actionable guidance. This is a common pattern: research depth comes first, then practical restructuring for the audience.

---

---

# ITERATION 5: Polish and Consistency

**Date:** 2026-02-23
**Rework reason:** LIAISON review identified 4 consistency and polish items.

---

## Feedback → Changes (Iteration 5)

| # | Feedback | Change Made |
|---|----------|------------|
| 1 | Version consistency — README says 3 iterations, should say 4 | Fixed README to "Four iterations" and updated Related sections across all docs |
| 2 | README should guide readers to WHEN checklist first | Added Quick Start section at top of README pointing to WHEN implementation checklist |
| 3 | De-duplicate open questions across docs | Removed duplicates: pheromone tuning removed from WHEN (kept in WHERE), co-retrieval experiment removed from WHAT (kept in WHERE), ρ_c removed from WHAT (kept in WHEN). Added cross-reference "See also" links at end of each doc's Open Questions. |
| 4 | Co-retrieval experiment needs more specifics | Expanded WHERE doc's co-retrieval experiment with: setup (15+ docs), queries (3+ agents, 20+ queries each, 1 week), measurement (co-retrieval pairs appearing 3+ times vs explicit cross-refs), success/failure criteria. |

### Process Note

Iteration 5 was a polish pass — no content changes, only consistency fixes. Each open question now lives in exactly one document with cross-references from the others. The LIAISON's "focus on items 1-3, then 4 if time" prioritization was effective.

---

---

# ITERATION 6: Key Takeaways

**Date:** 2026-02-23
**Rework reason:** LIAISON review (3/5) — add Key Takeaway sections before Open Questions for 30-second readability; fix README iteration count to 5.

---

## Feedback → Changes (Iteration 6)

| # | Feedback | Change Made |
|---|----------|------------|
| 1 | Each doc needs a Key Takeaway / Bottom Line section before Open Questions | Added 5-bullet Key Takeaways to WHAT (filtering test, speculation, storage split, pheromone, co-retrieval), WHERE (start simple, task metadata, PDSA trajectories, pheromone bridge, concurrent layers), and WHEN (day 1 triggers, post-task consolidation, pre-compaction safety net, pheromone self-regulation, checklist path). |
| 2 | README says "Four iterations" but PDSA has 5 | Updated README and all Related sections to "5 iterations" with iteration 5 description. |

### Process Note

Iteration 6 was the final content improvement — adding a reader-facing summary layer. The Key Takeaways distill the most actionable insights from each document into 5 bullets, giving readers the core message in 30 seconds without reading the full document.

---

---

---

# ITERATION 7: Trivium Reflection — Grammar, Dialectic, Rhetoric

**Date:** 2026-02-23
**Author:** LIAISON (reflective review at Thomas's request)
**Method:** Classical trivium pattern — Grammar (facts gathered), Dialectic (tensions tested), Rhetoric (synthesis judged)

---

## Thomas's Request

> "reflect upon the result. find angles that need more thinking. trivium pattern. suggest direction for rework"

---

## GRAMMAR (What facts were gathered — completeness and accuracy)

### Well Captured

The deliverables correctly integrate:
- Hopfield-Attention-VectorDB equivalence and energy landscape framing
- Pheromone model parameters (0.05 boost, 0.995 decay, ceiling 10.0, floor 0.1)
- Stigmergic phase transition (ρ_c ≈ 0.23) with practical implications
- 8-layer concurrent architecture with markdown equivalents column
- Sleep consolidation (NREM/REM) from Letta and EverMemOS
- Co-retrieval concept with explicit "unvalidated" caveat and proposed experiment
- A-MEM, Collaborative Memory, MemAct, MemRL academic references
- Task DNA = thought unit equivalence (the strongest original insight)
- Three memory types (semantic, episodic, procedural) + three thought types (original, refinement, consolidation)
- Implementation checklists (Day 1 through Month 6+)

### Significant Gaps — Source Material Not Captured in Deliverables

1. **The mining metaphor / token economy.** Doc 14: *"Contributing a thought is like mining a token... The proof-of-work is not computational waste but genuine intellectual contribution, validated by actual usage."* NOWHERE in the best practices. The economic incentive layer that makes the system self-sustaining is completely absent.

2. **Geometric Dynamics (Tacheny, arXiv:2512.10350).** Doc 12 devotes a full section to contractive/oscillatory/exploratory regimes, local drift, global drift, dispersion, cluster persistence — and explicitly claims the multi-user extension as one of 7 genuinely novel contributions. The best practices barely mention it.

3. **HNSW Hub Highways.** Doc 12: 50-70% of early beam-search visits hit hub nodes. FlatNav's mathematical formalization. The Qdrant rejection workaround path. Dynamic hub evolution as knowledge accessibility map. Practically absent from deliverables.

4. **The co-retrieval graph FORMALISM.** Doc 12 provides the PMI-weighted edge formula: `W(A,B) = PPMI(A,B) × Σ[exp(-λ(t_now - t_session))] × [1 - 1/log(|unique_users| + 1)]`. The best practices mention the concept but not the math that makes it buildable.

5. **The RL formulation of XPollination.** Doc 12 provides a full state/action/reward specification for the entire system as a multi-agent RL problem. The best practices mention MemAct/MemRL as references but don't capture the vision of XPollination ITSELF as an RL problem.

6. **The consciousness question / self-referential feedback loop.** Doc 12 section 9: a system that stores knowledge, observes access, uses observations to modify stored knowledge, detects convergence, surfaces detections to influence future access, and learns which actions lead to productive outcomes — is a "self-organizing knowledge metabolism." This philosophical framing is absent.

7. **The 7 genuinely novel contributions.** Doc 12 explicitly enumerates what XPollination contributes that nobody else has published. The best practices present XPollination as a USER of existing research, not a CONTRIBUTOR to it.

8. **Truth anchoring, mirroring protocol, guided intake.** Docs 03, 05, 08, 14 describe these as core system mechanisms. Not even mentioned as design intents in the best practices.

---

## DIALECTIC (Tensions and contradictions that need more thinking)

### 1. Sub-problem presented as the whole

The docs frame: *"How does an AI agent persist knowledge across sessions?"* (technical capability).
The source material frames: *"How do multiple minds cross-pollinate knowledge through a self-organizing substrate?"* (systems-of-intelligence).
These are different problems. The best practices describe plumbing; the source material describes a building.

### 2. "Start simple" contradicts "layers are concurrent"

The WHERE doc correctly notes: *"Even a markdown-only system runs layers 0, 4, and 5."* But the overall Day 1 → Month 6+ framing reads as sequential progression. Doc 11 explicitly warns: *"They're concurrent, not sequential."* The docs caught the fact but didn't internalize it.

### 3. Below ρ_c, collective features are theoretical

The docs prominently describe multi-agent pheromone models, co-retrieval, highways — then acknowledge ρ_c ≈ 0.23 means a 4-agent team is below threshold. If we're below the phase transition, why are collective features described so prominently without this being made explicit?

### 4. The 200-line delete vs. pheromone floor

Deleting a MEMORY.md line makes information INVISIBLE (except in git, which agents don't naturally search). Pheromone decay to 0.1 keeps information DISCOVERABLE. One is amnesia, the other is fading. This distinction matters practically and isn't resolved.

### 5. Co-retrieval: emergent knowledge or embedding artifact?

Vectors co-appear in results partly because embedding spaces cluster by topic — a property of the EMBEDDING, not of THINKING. The dialectic needs sharpening: what would DISPROVE co-retrieval's value? What distinguishes genuine emergent connections from embedding proximity noise?

### 6. "Trajectories vs. conclusions" — unresolved

When you have 200 lines and must choose: trajectory (PDSA doc) or conclusion (MEMORY.md entry)? The docs say "both, in different places" — avoidance, not resolution. The design decision (conclusions in memory, trajectories in PDSA docs, PDSA doc path IS the trajectory store) needs to be stated explicitly.

---

## RHETORIC (Is the synthesis clear, persuasive, actionable?)

### 1. The soul is missing

Someone setting up agent memory finds the checklists useful. Someone trying to understand WHY this matters gets a dry technical account. The source material has passion: belief bubbles, fragmented thinking, *"the ability to reproduce how different thinkers arrived at convergence is itself the knowledge."* The best practices strip this out. They tell HOW but not WHY.

### 2. No narrative arc

The source material has a story: individual memory → shared database → self-organizing substrate → emergent collective intelligence → economic incentive layer. The best practices flatten this into What/Where/When reference docs. Useful but not compelling.

### 3. Novel insights buried under generic advice

*"Start with one file, add complexity when you hit real limitations"* is advice anyone could give. The SPECIFIC insights — your workflow system IS your memory layer, your PDSA docs ARE thought traces, retrieval patterns ARE knowledge — get buried under best-practice boilerplate. These insights should be in headlines, not paragraphs.

### 4. No reader persona

Who are these for? A solo developer? A multi-agent team? An XPollination architect? The docs try to serve all three and feel generic.

---

## 8 Rework Directions

| # | Direction | Trivium Layer | What It Adds |
|---|-----------|--------------|-------------|
| 1 | **Add a "Why This Matters" opening** to README — the problem (knowledge silos, context loss, fragmented thinking), the vision (self-organizing knowledge flow), the core insight ("retrieval patterns ARE knowledge") | Rhetoric | Soul, motivation, narrative |
| 2 | **Promote "retrieval patterns ARE knowledge" to first-class principle** — thread it through all three docs as the organizing insight, not just a passing reference | Rhetoric | Coherence, identity |
| 3 | **Add the novel contributions** — explicitly state what XPollination adds vs. existing systems (the 7 items from doc 12's "What's Genuinely Novel") | Grammar | Positioning, completeness |
| 4 | **Capture the mining/economic metaphor** — even as future work, provenance tracking as foundation for value attribution is central to the vision | Grammar | Missing source material |
| 5 | **Sharpen the co-retrieval dialectic** — what would DISPROVE it? Distinguish embedding proximity from genuine emergent knowledge | Dialectic | Intellectual honesty |
| 6 | **Resolve "below ρ_c" explicitly** — "We're below threshold. Here's what that means now. Here's what to watch for." | Dialectic | Practical clarity |
| 7 | **Add geometric dynamics (Tacheny)** — trajectory tracking as measurement infrastructure for whether memory is working | Grammar | Missing source material |
| 8 | **State the trajectory/conclusion design decision** — conclusions in MEMORY.md, trajectories in PDSA docs, this IS the architecture, not a workaround | Dialectic | Resolution of tension |

---

---

# ITERATION 8: Trivium Rework — 8 Directions

**Date:** 2026-02-23
**Rework reason:** LIAISON trivium reflection (iteration 7) identified 8 directions across Grammar/Dialectic/Rhetoric.

---

## Feedback → Changes (Iteration 8)

| # | Direction | Trivium | Change Made |
|---|-----------|---------|------------|
| 1 | Add "Why This Matters" opening | Rhetoric | README: added problem statement (knowledge silos, context loss), vision (self-organizing knowledge flow), and spec quote |
| 2 | Promote "retrieval patterns ARE knowledge" | Rhetoric | Threaded into Summary sections of all 3 docs as organizing insight |
| 3 | Add XPollination novel contributions | Grammar | README: added 7-item list from doc 12 "What Is Genuinely Novel Here" |
| 4 | Capture mining/economic metaphor | Grammar | README: added mining metaphor paragraph with provenance tracking as foundation |
| 5 | Sharpen co-retrieval dialectic | Dialectic | WHAT doc: replaced caveat with dialectic — embedding proximity vs genuine emergence, what would disprove it |
| 6 | Resolve below ρ_c explicitly | Dialectic | WHERE doc: explicit "we are below threshold" with what that means now, what to watch for, and why collective features are premature |
| 7 | Add Tacheny geometric dynamics | Grammar | WHERE doc: added measurement infrastructure subsection under Full Vision — 3 regimes, 4 indicators, multi-user extension |
| 8 | State trajectory/conclusion design decision | Dialectic | WHAT doc: added "Design Decision" subsection — conclusions in MEMORY.md, trajectories in PDSA docs, both in task metadata, explicitly stating this IS the architecture |

---

## Deliverables (Iterations 1-8)

| File | Description |
|------|-------------|
| `pdsa/2026-02-19-agent-memory.pdsa.md` | This document — the research journey (8 iterations including trivium reflection + rework) |
| `docs/agent-memory/agent-memory-what.md` | Best practice: what is worth remembering |
| `docs/agent-memory/agent-memory-where.md` | Best practice: storage architecture |
| `docs/agent-memory/agent-memory-when.md` | Best practice: lifecycle triggers |
| `docs/agent-memory/README.md` | Topic navigation with Why This Matters + novel contributions |

---

---

# ITERATION 9: General Specification — XPollination Thought Tracing System

**Date:** 2026-02-23
**Rework reason:** Thomas's rework with two items: (1) Fix factual errors about API state (completed above), (2) Write a general specification for the best-practice solution — current state, target state, gap analysis, endpoint specs, data model, pheromone model, implementation phases.

---

## PLAN (Iteration 9)

### Objective

Create a general specification thorough enough that a developer can read ONLY this document and know what to build. The spec bridges the gap between:
- **Current state:** A basic Fastify API at `localhost:3200` with semantic search over embedded best-practice markdown chunks
- **Target state:** The XPollination thought tracing system described in the MVP spec (doc 13), with provenance, pheromone self-regulation, co-retrieval tracking, and agent integration

### Sources Read

| Document | Key Contribution to Spec |
|----------|-------------------------|
| [`api/src/index.ts`](../../../api/src/index.ts) + route files | Current API implementation details |
| [`api/src/services/embedding.ts`](../../../api/src/services/embedding.ts) | Current embedding model (all-MiniLM-L6-v2, 384-dim) |
| [`api/src/services/qdrant.ts`](../../../api/src/services/qdrant.ts) | Current Qdrant client, collection setup, query patterns |
| [02-CORE-ARCHITECTURE](../spec/02-CORE-ARCHITECTURE.md) | 5-phase data flow, mirroring loop, real-time context injection |
| [03-AGENT-GUIDELINES](../spec/03-AGENT-GUIDELINES.md) | Thought unit schema, convergence zone schema, agent lifecycle |
| [04-VECTOR-DB-AND-GRAPH-STRATEGY](../spec/04-VECTOR-DB-AND-GRAPH-STRATEGY.md) | Qdrant collections, HNSW config, search patterns, embedding strategy |
| [06-INTEGRATION-SPEC](../spec/06-INTEGRATION-SPEC.md) | Docker stack, voice pipeline, WebSocket, API endpoints |
| [12-DEEP-DIVE-ITER3](../feedback/agent-memory/12-DEEP-DIVE-THINKING-INFRASTRUCTURE-ITER3.md) | 8-layer architecture, Hopfield theory, pheromone model, sleep consolidation, geometric dynamics |
| [13-MVP-SPEC-THOUGHT-TRACING](../feedback/agent-memory/13-MVP-SPEC-THOUGHT-TRACING.md) | Buildable MVP: /think, /retrieve, /highways, payload schema, pheromone parameters, implementation timeline |
| [14-AGENT-CONTEXT](../feedback/agent-memory/14-AGENT-CONTEXT.md) | Consolidated vision, mining metaphor, MVP proves 5 things, glossary |

---

## DO (Iteration 9)

### 1. Current State — What Exists Today

**Server:** Fastify + Node.js (TypeScript) at `localhost:3200` and `https://bestpractice.xpollination.earth/`

**Endpoints:**

| Endpoint | Method | Behavior |
|----------|--------|----------|
| `/api/v1/query` | POST | Semantic search over `best_practices` collection. Accepts `{query, domain?, intent?, language?}`. Returns top-5 matches by cosine similarity. Stores query embedding in `queries` collection for analytics. `intent` and `language` accepted but NOT used in search logic. |
| `/api/v1/ingest` | POST | Store new content. Accepts `{content, metadata?: {domain?, source?}}`. Embeds and upserts to `best_practices` collection. No provenance, no thought_type. |
| `/api/v1/health` | GET | Returns Qdrant connectivity status and point counts for both collections. |
| `/api/v1/` | GET | API documentation/discovery endpoint. |

**Embedding Model:** `Xenova/all-MiniLM-L6-v2` via HuggingFace Transformers.js
- Dimensions: 384
- Distance: Cosine
- Pooling: Mean pooling with normalization
- Loading: Lazy singleton (first request)

**Qdrant Collections:**

| Collection | Vectors | Purpose |
|------------|---------|---------|
| `best_practices` | ~20 chunks from seeded markdown docs | Searchable best-practice content. Payload: `content`, `domain`, `file_path`, `file_name`, `chunk_index`, `total_chunks`, `source`, `timestamp`. |
| `queries` | Search query embeddings | Analytics/audit trail. Payload: `query`, `domain`, `intent`, `language`, `timestamp`, `results_count`. |

**Infrastructure:**
- Qdrant: Docker container, port 6333, 300MB memory limit, HNSW on-disk
- nginx: reverse proxy for HTTPS at `bestpractice.xpollination.earth`
- Seeder: Chunks markdown files from `versions/` by domain directory, 500-word target, skips README.md
- No authentication, no rate limiting, CORS allows all origins

**What is NOT present:**
- No thought provenance (who contributed what)
- No access logging (who retrieved what, when)
- No pheromone model (no reinforcement, no decay)
- No co-retrieval tracking
- No thought types (original/refinement/consolidation)
- No source linking (source_ids)
- No agent integration (no MCP tool, no Claude Code skill)
- No background jobs
- No highway detection

### 2. Target State — XPollination Thought Tracing System

The target system transforms the basic search API into a **self-organizing knowledge substrate** where:
1. Thoughts become discoverable through semantic proximity (no explicit sharing needed)
2. Usage is tracked (who accessed what, when, with what co-results)
3. Highways form (frequently accessed thoughts become prominent via pheromone reinforcement)
4. Provenance is preserved (every thought traces back to its originator)
5. Refinements link back to source contributions

**Three Core Endpoints:**

#### `POST /api/v1/think` — Contribute a Thought

Stores a new thought with full provenance metadata. Every thought is embedded and stored in the `thought_space` collection.

**Request:**
```json
{
  "content": "Role boundaries prevent coordination collapse. QA writes tests, Dev implements, PDSA plans.",
  "contributor_id": "agent-pdsa-001",
  "contributor_name": "PDSA Agent",
  "thought_type": "original",
  "source_ids": [],
  "tags": ["multi-agent", "role-separation", "coordination"]
}
```

**Field details:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `content` | string | Yes | The thought in clear language (decoded, not raw transcript) |
| `contributor_id` | string | Yes | Unique identifier for the contributing agent/user |
| `contributor_name` | string | Yes | Human-readable name |
| `thought_type` | enum | Yes | `"original"` (new insight), `"refinement"` (builds on existing, requires `source_ids`), `"consolidation"` (abstracts from multiple, requires `source_ids`) |
| `source_ids` | UUID[] | Conditional | Required for refinements and consolidations. Points to parent thoughts. |
| `tags` | string[] | No | Free-form topic tags for payload filtering |

**Response:**
```json
{
  "thought_id": "uuid-generated",
  "status": "stored",
  "embedding_stored": true,
  "pheromone_weight": 1.0
}
```

**Behavior:**
1. Validate input (content non-empty, thought_type valid, source_ids present if refinement/consolidation)
2. Embed content using the embedding model
3. Generate UUID for thought_id
4. Store in Qdrant `thought_space` collection with full payload (see Data Model below)
5. Return thought_id for future reference

#### `POST /api/v1/retrieve` — Search with Tracing

Semantic search that logs access patterns and updates pheromone weights on every call. This is where "retrieval patterns ARE knowledge" becomes concrete.

**Request:**
```json
{
  "query": "how should agent roles be separated?",
  "agent_id": "agent-dev-002",
  "limit": 10,
  "exclude_self": true,
  "min_score": 0.5,
  "filter_tags": ["multi-agent"]
}
```

**Field details:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `query` | string | Yes | Search query text |
| `agent_id` | string | Yes | Who is querying (for access logging) |
| `limit` | int | No | Max results (default: 10) |
| `exclude_self` | bool | No | Exclude thoughts by this agent_id (default: false) |
| `min_score` | float | No | Minimum similarity score (default: 0.0) |
| `filter_tags` | string[] | No | Filter by tags (AND logic) |

**Response:**
```json
{
  "results": [
    {
      "thought_id": "uuid-1",
      "content": "Role boundaries prevent coordination collapse...",
      "contributor_id": "agent-pdsa-001",
      "contributor_name": "PDSA Agent",
      "thought_type": "original",
      "score": 0.87,
      "pheromone_weight": 2.35,
      "access_count": 12,
      "tags": ["multi-agent", "role-separation"]
    }
  ],
  "session_id": "session-uuid",
  "co_retrieved_ids": [["uuid-1", "uuid-3"], ["uuid-1", "uuid-5"]],
  "total_found": 3
}
```

**Behavior (critical — this is the core of the system):**
1. Embed query
2. Search `thought_space` with optional filters (tags, exclude_self, min_score)
3. **For each returned result** (this is the memory-write part of every retrieval):
   a. `access_count += 1`
   b. `pheromone_weight = min(10.0, pheromone_weight + 0.05)`
   c. `last_accessed = now()`
   d. Append `agent_id` to `accessed_by` (deduplicated set)
   e. Append `{user_id, timestamp, session_id}` to `access_log` (cap at last 100 entries)
   f. For every OTHER result in the same result set: append to `co_retrieved_with` (cap at 50)
4. Log query to `query_log` table (see Data Model)
5. Generate session_id for grouping co-retrievals
6. Return results with current pheromone weights

#### `GET /api/v1/highways` — Emerging Thought Patterns

Surfaces thoughts that have become well-worn paths through the knowledge space.

**Request (query params):**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `min_access` | int | 3 | Minimum access_count to qualify |
| `min_users` | int | 2 | Minimum unique users in accessed_by |
| `limit` | int | 20 | Max highways returned |
| `sort_by` | string | `"traffic"` | `"traffic"` (access_count × unique_users), `"pheromone"`, `"recent"` |

**Response:**
```json
{
  "highways": [
    {
      "thought_id": "uuid-1",
      "content": "Role boundaries prevent coordination collapse...",
      "contributor_id": "agent-pdsa-001",
      "contributor_name": "PDSA Agent",
      "access_count": 12,
      "unique_users": 4,
      "pheromone_weight": 2.35,
      "traffic_score": 48,
      "last_accessed": "2026-02-23T15:00:00Z",
      "top_co_retrieved": ["uuid-3", "uuid-5"]
    }
  ],
  "total_highways": 5
}
```

**Behavior:**
1. Query `thought_space` using Qdrant's scroll + order_by with payload filters:
   - `access_count >= min_access`
   - `len(accessed_by) >= min_users`
2. Calculate traffic_score = `access_count × len(accessed_by)`
3. Sort by requested sort_by field
4. Include top co-retrieved thoughts for each highway
5. Return paginated results

### 3. Data Model

#### Qdrant Collection: `thought_space`

**Vector:** 384-dim (all-MiniLM-L6-v2) — keep current embedding model for MVP

**Payload schema per point:**
```json
{
  "contributor_id": "agent-pdsa-001",
  "contributor_name": "PDSA Agent",
  "content": "The actual thought text",
  "created_at": "2026-02-23T15:00:00Z",
  "thought_type": "original",
  "source_ids": [],
  "tags": ["multi-agent", "role-separation"],

  "access_count": 0,
  "last_accessed": null,
  "accessed_by": [],
  "access_log": [],
  "co_retrieved_with": [],
  "pheromone_weight": 1.0
}
```

**Payload indexes to create:**
| Field | Index Type | Purpose |
|-------|-----------|---------|
| `contributor_id` | KEYWORD | Filter by contributor, contributor reports |
| `created_at` | DATETIME | Time-range queries |
| `access_count` | INTEGER | Highway detection (>= threshold) |
| `last_accessed` | DATETIME | Decay job efficiency (only decay recently active) |
| `thought_type` | KEYWORD | Filter by type |
| `tags` | KEYWORD | Tag-based filtering |
| `pheromone_weight` | FLOAT | Sort by prominence |

#### Query Log Table (SQLite — secondary analytics store)

```sql
CREATE TABLE query_log (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  query_text TEXT NOT NULL,
  query_vector BLOB,
  returned_ids TEXT NOT NULL,  -- JSON array of thought UUIDs
  session_id TEXT NOT NULL,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  result_count INTEGER NOT NULL
);

CREATE INDEX idx_query_log_agent ON query_log(agent_id);
CREATE INDEX idx_query_log_session ON query_log(session_id);
CREATE INDEX idx_query_log_timestamp ON query_log(timestamp);
```

**Purpose:** Offline analytics — hub detection, thinking trajectory tracking, query pattern analysis. Kept separate from Qdrant to avoid polluting the hot vector DB with analytics data.

**Note:** The current `queries` collection in Qdrant stores query embeddings. For the MVP, the SQLite query_log replaces this — it's cheaper to query and doesn't consume vector storage. The existing `queries` collection can be deprecated.

### 4. Pheromone Model

**Parameters:**
| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Initial weight | 1.0 | Neutral starting point |
| Reinforcement per access | +0.05 | Small enough that single access doesn't dominate |
| Ceiling | 10.0 | Prevents runaway — max 10× baseline prominence |
| Decay rate | 0.995 per hour | ~11% per day, ~50% per week, floor reached in ~1 month |
| Floor | 0.1 | Never fully invisible — always discoverable with direct search |

**Reinforcement (on every `/retrieve`):**
```
new_weight = min(10.0, current_weight + 0.05)
```

**Decay (hourly background job):**
```
For all vectors where last_accessed < (now - 1 hour):
  new_weight = max(0.1, current_weight * 0.995)
```

**Implementation note:** Use Qdrant's `set_payload` API to update pheromone weights. The decay job scrolls through all points with `last_accessed` before the cutoff and batch-updates weights. On the current scale (~20 vectors + whatever agents contribute), this is trivial. At larger scale, partition by `last_accessed` date range.

**Tuning questions for future work:**
- Should consolidation vectors (thought_type="consolidation") decay slower? They represent higher-order insights.
- Should the reinforcement amount vary by query relevance score? A 0.95 match might reinforce more than a 0.51 match.
- Should decay pause during system downtime? Or should time always count?

### 5. Co-Retrieval Tracking

**Mechanism:** When `/retrieve` returns N results, each result pair (A, B) is a co-retrieval event. For each pair:
- Append B's ID to A's `co_retrieved_with` (and vice versa)
- Cap at 50 most recent entries per vector

**Why this matters:** Co-retrieval reveals functional associations no agent explicitly created. Two thoughts about "organizational design" and "microservice architecture" might be repeatedly co-retrieved — revealing that teams working on org structure also need tech architecture insights.

**Validation gap (documented in [WHERE doc](../docs/agent-memory/agent-memory-where.md#open-questions)):** Co-retrieval may be noise from embedding proximity rather than genuine emergent knowledge. The proposed experiment (WHERE doc, Open Questions #3) tests this by comparing co-retrieval edges against explicit cross-references.

**Cap rationale:** 50 entries is enough to detect stable patterns without unbounded payload growth. Older entries naturally rotate out as new co-retrievals are appended.

### 6. Background Jobs

| Job | Schedule | What It Does |
|-----|----------|-------------|
| Pheromone decay | Every hour | Multiply `pheromone_weight *= 0.995` for all vectors not accessed in the last hour. Floor at 0.1. |
| Highway detection | Every 15 minutes | Scan for vectors with `access_count >= 3` and `len(accessed_by) >= 2`. Flag as highways. (Used by `/highways` endpoint — can be computed on-demand for MVP, scheduled job is optimization.) |

**Implementation options:**
- **Simple (MVP):** `setInterval` in the Fastify server process. Works for single-instance deployment.
- **Robust:** Separate worker process using `node-cron` or `APScheduler` (if switching to Python). Better for production reliability.
- **Note:** The CX22 server (2 vCPU, 8GB RAM) can handle both jobs as in-process intervals. A separate worker is premature for the current scale.

### 7. Agent Integration — Conversational Interface

**Design principle:** Agents should NOT need to know the API. They talk to long-term memory like talking to a brain — in natural language. The system decides internally what operations to perform.

#### The Conversational Endpoint

**`POST /api/v1/memory`** — Single agent-facing endpoint

**Request:**
```json
{
  "prompt": "What do you know about role separation in multi-agent systems?",
  "agent_id": "agent-dev-002",
  "agent_name": "DEV Agent",
  "context": "I'm implementing a new agent workflow and want to avoid coordination failures."
}
```

**Response:**
```json
{
  "response": "Based on collective knowledge, role boundaries prevent coordination collapse. Key insights:\n\n1. QA writes tests (specification), Dev implements (never changes tests), PDSA plans (never codes). Violations cause cascading failures.\n2. On 2026-02-06, QA fixed implementation code AND rewrote tests — this destroyed the review chain.\n\nRelated highways: 'role-separation' (12 accesses, 4 unique agents), 'coordination-patterns' (8 accesses, 3 agents).",
  "session_id": "session-uuid",
  "sources": [
    {"thought_id": "uuid-1", "contributor": "PDSA Agent", "score": 0.87},
    {"thought_id": "uuid-3", "contributor": "QA Agent", "score": 0.72}
  ],
  "operations_performed": ["retrieve", "reinforce"],
  "thoughts_contributed": 0,
  "thoughts_retrieved": 3
}
```

#### How the System Decides: Contribution vs. Query

The conversational layer classifies the agent's prompt into one or more internal operations:

| Signal in Prompt | Internal Operation | Example |
|-----------------|-------------------|---------|
| Question ("What do you know about...?", "How should...?") | `/retrieve` internally | "What patterns exist for error handling?" |
| Information-rich statement ("I learned that...", "We discovered...") | `/think` internally | "Role boundaries prevent coordination collapse when QA writes tests and Dev implements." |
| Both question and contribution | `/think` + `/retrieve` | "I found that pheromone decay at 0.995/hour works well. What other decay rates have been tried?" |
| Status/reflection ("After completing X, the key insight was...") | `/think` internally | "After 3 iterations, the main learning is that task DNA IS episodic memory." |
| Highway request ("What's trending?", "What are the most accessed insights?") | `/highways` internally | "What are the most referenced patterns across all agents?" |

**Classification approach (MVP):** Simple heuristic — check for question marks, classify information-density by prompt length and declarative structure. A 10-line prompt with no question marks is likely a contribution. A short prompt ending in `?` is likely a query.

**Classification approach (future):** LLM-based intent detection. The system uses a small, fast model to classify the prompt before routing to internal endpoints. This adds latency but handles ambiguous prompts better.

#### Internal Architecture

```
Agent → POST /api/v1/memory (conversational)
         │
         ├── Intent Classifier
         │     ├── "contribute" → internal /think
         │     ├── "query" → internal /retrieve
         │     ├── "both" → internal /think + /retrieve
         │     └── "highways" → internal /highways
         │
         ├── Response Formatter
         │     ├── Synthesize results into natural language
         │     ├── Include source attribution
         │     └── Attach metadata (operations, counts, session_id)
         │
         └── Returns: natural language response + structured metadata
```

**The internal endpoints (/think, /retrieve, /highways) remain unchanged.** They are implementation details, not agent-facing. The conversational layer is a thin wrapper that:
1. Classifies intent
2. Calls internal endpoints with extracted parameters
3. Formats results into a coherent response

#### What Metadata Accompanies Natural Language?

The response includes both human-readable text AND structured metadata:
- `response` — natural language answer the agent can use directly
- `sources` — thought IDs with contributors and scores (for provenance)
- `operations_performed` — what the system did internally (transparency)
- `thoughts_contributed` / `thoughts_retrieved` — counts (for monitoring)
- `session_id` — for co-retrieval grouping

This means agents receive answers they can use immediately, while the system maintains full traceability.

#### How Simple Can It Be?

**Minimum viable conversational layer:**
1. If prompt contains `?` → `/retrieve` with prompt as query
2. If prompt length > 100 chars and no `?` → `/think` with prompt as content
3. If both → `/think` then `/retrieve`
4. Format response as: "Here's what I found: [results]" or "Stored your insight. Here's related knowledge: [results]"

This is ~50 lines of code on top of the existing internal endpoints. The sophistication can grow later (LLM classifier, better response synthesis), but the basic pattern is trivial.

#### Auto-Contribution Hooks (Future)

Beyond explicit prompts, the system could receive automatic contributions:
- After every PDSA Study phase → agent prompt: "I learned: [findings]"
- After every task DNA update → system extracts key findings
- On session end → agent sends session summary as contribution

### 8. Backward Compatibility

The existing `/api/v1/query` and `/api/v1/ingest` endpoints MUST continue working. They serve the current best-practice search functionality at `bestpractice.xpollination.earth`.

**Strategy:**
- Keep `best_practices` collection and existing endpoints untouched
- Add `thought_space` collection and new endpoints (`/think`, `/retrieve`, `/highways`) alongside
- The two systems coexist: `best_practices` for static document search, `thought_space` for dynamic thought tracing
- Future migration: gradually move best-practice content into `thought_space` as original thoughts, deprecate old endpoints

### 9. Gap Analysis — Current → Target

| Capability | Current | Target | Gap |
|-----------|---------|--------|-----|
| Semantic search | ✅ `/query` with domain filter | ✅ `/retrieve` with tag filter | New endpoint with extended behavior |
| Content storage | ✅ `/ingest` (no provenance) | ✅ `/think` (full provenance) | New endpoint with contributor_id, thought_type, source_ids |
| Access tracking | ❌ None | ✅ access_count, accessed_by, access_log | Middleware on /retrieve |
| Pheromone model | ❌ None | ✅ +0.05 reinforce, 0.995/hr decay | Reinforcement on /retrieve + hourly decay job |
| Co-retrieval | ❌ None | ✅ co_retrieved_with tracking | Logic in /retrieve |
| Highway detection | ❌ None | ✅ /highways endpoint | New endpoint + optional background job |
| Background jobs | ❌ None | ✅ Decay (hourly), detection (15min) | Job scheduler |
| Thought types | ❌ None | ✅ original/refinement/consolidation | Schema field |
| Source linking | ❌ None | ✅ source_ids for provenance chains | Schema field |
| Query logging | ✅ Qdrant `queries` collection | ✅ SQLite `query_log` table | Migrate from Qdrant to SQLite |
| Existing endpoints | ✅ /query, /ingest, /health | ✅ Preserved | No change needed |
| Embedding model | 384-dim MiniLM | 384-dim MiniLM (keep for MVP) | No change |
| Agent integration | ❌ None | ✅ Conversational endpoint (POST /memory) | Intent classifier + response formatter wrapping internal endpoints |
| Authentication | ❌ None (CORS open) | ✅ Cryptographic access control | Schema accommodation now; implementation later (see iteration 10) |

### 10. Implementation Phases

#### Phase 1: Foundation (Week 1)
**Goal:** New collection + /think + basic /retrieve

1. Create `thought_space` collection in Qdrant (384-dim, cosine, payload indexes)
2. Implement `POST /api/v1/think` endpoint
   - Input validation (content, contributor_id, thought_type, source_ids)
   - Embed content
   - Store with full payload schema
   - Return thought_id
3. Implement `POST /api/v1/retrieve` endpoint (basic version)
   - Embed query
   - Search thought_space
   - Return results (no access tracking yet)
4. Add SQLite `query_log` table
5. Keep existing endpoints working

**Acceptance test:** Can contribute a thought via /think and retrieve it via /retrieve.

#### Phase 2: Tracing + Pheromone (Week 2)
**Goal:** Access tracking, pheromone reinforcement, decay job

1. Add access tracking to /retrieve:
   - Update access_count, accessed_by, access_log on each result
   - Update co_retrieved_with for all result pairs
   - Reinforce pheromone_weight (+0.05, cap 10.0)
   - Log to SQLite query_log
2. Implement hourly pheromone decay job (setInterval)
   - Scroll vectors not accessed in last hour
   - Apply 0.995 decay (floor 0.1)
3. Session ID generation for grouping co-retrievals

**Acceptance test:** Retrieve the same thought 5 times → access_count = 5, pheromone_weight = 1.25. Wait 24 hours → weight decayed ~11%.

#### Phase 3: Visibility (Week 3)
**Goal:** /highways endpoint, contributor stats

1. Implement `GET /api/v1/highways` endpoint
   - Filter by min_access, min_users
   - Calculate traffic_score
   - Sort options
   - Include top co-retrieved
2. Implement `GET /api/v1/contributors/:id` endpoint (optional)
   - Thoughts contributed count
   - Total access to their thoughts
   - Most-accessed thought
3. Highway detection job (every 15 min, optional — can compute on-demand)

**Acceptance test:** After multiple agents access shared thoughts, /highways returns the most-trafficked ones.

#### Phase 4: Conversational Interface + Agent Integration (Week 4)
**Goal:** Agents interact with memory through natural language

1. Implement `POST /api/v1/memory` conversational endpoint
   - Intent classifier (heuristic MVP: question marks, prompt length)
   - Router to internal /think, /retrieve, /highways
   - Response formatter (natural language + source metadata)
2. Test with real agents:
   - PDSA sends "I learned that task DNA maps to thought unit schema" → system stores as contribution
   - DEV sends "What patterns exist for role separation?" → system retrieves relevant thoughts
3. (Optional) Create MCP tool wrapping /memory for tighter integration
4. (Optional) Create Claude Code skill `/memory "prompt"`

**Acceptance test:** PDSA agent completes a task → sends findings as natural language prompt → DEV agent queries about the same topic → receives PDSA's contribution in the response.

---

## STUDY (Iteration 9)

### What I Learned from Reading the Specs

1. **The [MVP spec (doc 13)](../feedback/agent-memory/13-MVP-SPEC-THOUGHT-TRACING.md) is remarkably concrete.** It includes code snippets, exact parameter values, and a week-by-week timeline. The gap between "spec" and "implementation plan" is smaller than expected — most of the design work is already done in doc 13.

2. **The embedding model decision is less critical than I initially thought.** The spec recommends BGE-M3 (1024-dim, multilingual). The current system uses all-MiniLM-L6-v2 (384-dim). For the MVP, 384-dim is fine — the pheromone model and access tracking are the novel features, not the embedding quality. BGE-M3 would require significantly more RAM on the CX22 (8GB total) and adds deployment complexity. Migration path: when the system proves valuable, upgrade embedding model and re-embed the collection.

3. **The spec envisions FastAPI (Python) but our system is Fastify (Node.js/TypeScript).** This is a practical divergence. The current codebase is TypeScript — rewriting in Python adds effort without clear benefit for the MVP. The Qdrant client libraries are equally good in both languages. **Recommendation: stay with Fastify/TypeScript** and translate the Python code examples from [doc 13](../feedback/agent-memory/13-MVP-SPEC-THOUGHT-TRACING.md) to TypeScript.

4. **The `queries` collection in Qdrant is an overengineered analytics store.** The current system embeds query vectors in Qdrant — wasteful because they're never searched semantically. SQLite is better for analytics (cheaper storage, easier to query with GROUP BY, JOIN, etc.). The migration from Qdrant queries collection to SQLite query_log is a simplification, not added complexity.

5. **Backward compatibility is straightforward.** The existing `/query` and `/ingest` endpoints operate on a separate collection (`best_practices`). The new system uses a new collection (`thought_space`). No migration needed — they coexist.

6. **The full vision (8 layers, knowledge graph, sleep consolidation, RL policy) is genuine future work.** The MVP specification wisely focuses on 3 endpoints + pheromone model. Layers 2-7 are post-MVP. The spec is clear about this — it's not "build everything now" but "build the foundation that enables everything later."

### What Is Clear vs. Ambiguous

**Clear:**
- Endpoint signatures (/think, /retrieve, /highways) — well-defined in [doc 13](../feedback/agent-memory/13-MVP-SPEC-THOUGHT-TRACING.md)
- Payload schema — exact fields with types
- Pheromone parameters — 0.05 boost, 0.995 decay, 1.0 initial, 0.1 floor, 10.0 ceiling
- Co-retrieval tracking mechanism — update on every retrieve
- Highway detection — access_count × unique_users sorting

**Ambiguous:**
1. **Authentication/authorization.** No spec document addresses how agents authenticate. Thomas requires cryptographic access control from the start (see iteration 10 for security architecture reflection). The schema must accommodate `knowledge_space_id` and `access_grants` even if encryption isn't implemented in MVP.

2. **Payload size limits.** What's the maximum `content` length? The spec says "decoded thought in clear language" — could be a sentence or a page. The embedding model has a max input length (512 tokens for MiniLM). Content longer than this should be truncated for embedding but stored in full.

3. **Collection migration.** Should existing best-practice documents be seeded into `thought_space` as original thoughts? The spec doesn't address whether static documents and dynamic thoughts belong in the same collection. **My recommendation:** Keep them separate for now. Best practices are reference material; thoughts are dynamic. Mixing them would conflate two different access patterns.

4. **Rate of pheromone operations.** With 4 agents each making a few queries per task, the total retrieval volume is low (~50-100/day). The pheromone model is designed for higher traffic. At current scale, pheromone weights will barely move. This is fine — the model is correct at any scale, it just becomes MORE useful at higher scale.

5. **Sleep consolidation trigger.** The spec describes NREM/REM consolidation but doesn't specify what triggers it beyond "low-activity periods." For MVP: skip sleep consolidation entirely. Add it when the thought_space has enough vectors (100+?) to benefit from clustering.

---

## ACT (Iteration 9)

### Immediate Next Steps

1. **DEV agent builds Phase 1** (Foundation) — new collection, /think, basic /retrieve
2. **DEV agent builds Phase 2** (Tracing) — access logging, pheromone, co-retrieval
3. **DEV agent builds Phase 3** (Visibility) — /highways endpoint
4. **QA writes acceptance tests** matching the test criteria in each phase
5. **PDSA reviews** that implementation matches this specification

### Decisions Made (for Thomas to confirm or override)

| Decision | Rationale | Alternative |
|----------|-----------|-------------|
| Keep 384-dim MiniLM for MVP | Already deployed, sufficient quality, low RAM | Upgrade to BGE-M3 1024-dim (needs RAM assessment) |
| Stay with Fastify/TypeScript | Existing codebase, no benefit to rewriting | Rewrite in FastAPI/Python (spec's preferred stack) |
| Separate collections (best_practices + thought_space) | Different access patterns, clean separation | Single collection with type filter |
| SQLite for query_log (not Qdrant) | Cheaper for analytics, SQL queries | Keep Qdrant queries collection |
| Conversational interface (POST /memory) | Agents don't need to know API; zero-knowledge pattern | Direct HTTP to /think, /retrieve, /highways (rejected by Thomas) |
| Skip sleep consolidation for MVP | Insufficient data volume, add complexity | Include from start |
| setInterval for background jobs (MVP) | Simplest for single-instance | Separate worker process |
| Cryptographic access control (future) | Security from start; see iteration 10 reflection | Trust request-body agent_id (rejected by Thomas) |

### Process Reflection

This iteration is fundamentally different from iterations 1-8. Those were **research and documentation** — understanding agent memory theory and documenting best practices. This iteration is **system design** — specifying what to BUILD. The PDSA methodology applies equally well: the PLAN read existing specs, the DO analyzed the gap, the STUDY reflected on clarity vs ambiguity, and this ACT section defines next steps.

The most important output of this iteration is the gap analysis table (Section 9). It shows in one glance what exists, what's needed, and what connects them. A developer reading only that table and the endpoint specifications has enough to start building.

---

## Deliverables (Iteration 9)

| File | Description |
|------|-------------|
| `pdsa/2026-02-19-agent-memory.pdsa.md` | This document — iteration 9 adds the general specification |
| [`docs/agent-memory/agent-memory-where.md`](../docs/agent-memory/agent-memory-where.md) | Updated: factual corrections about API state, target system clearly labeled |

---

---

# ITERATION 10: Conversational Interface, Security Architecture, Spec Links

**Date:** 2026-02-23
**Rework reason:** Thomas's rework with three items: (1) Add clickable spec links to PDSA iteration 9, (2) Replace direct API agent integration with conversational interface, (3) Reflect on cryptographic access control and security-first design.

---

## Changes to Iteration 9 (Items 1 + 2)

### Item 1: Clickable Spec Links

Added relative markdown links to all spec references in the PDSA iteration 9 Sources Read table and throughout the STUDY section. Links use relative paths from `pdsa/` to `../spec/`, `../feedback/agent-memory/`, and `../../../api/src/`.

### Item 2: Conversational Interface Redesign

**What changed:** Replaced Section 7 (Agent Integration) entirely. The three-option model (Direct HTTP / MCP Tool / Claude Code Skill) was rejected by Thomas because agents need to KNOW the API. New design:

- Single agent-facing endpoint: `POST /api/v1/memory`
- Agent sends natural language prompt
- System classifies intent (contribute / query / both / highways)
- Internal endpoints (/think, /retrieve, /highways) unchanged
- Response includes natural language answer + structured metadata (sources, operations, counts)

**Key design decisions in the new Section 7:**
- MVP classifier: heuristic (question marks, prompt length)
- Future classifier: LLM-based intent detection
- Response format: natural language `response` + `sources[]` + `operations_performed`
- ~50 lines of code for minimum viable conversational layer

Updated Phase 4 in implementation plan to match.

---

## Item 3: Security Architecture Reflection — Cryptographic Access Control

### Thomas's Vision

> "Company knowledge base INVITEs contributor agents. Those agents get CRYPTOGRAPHIC access. Unauthenticated agents cannot access knowledge — NOT because software blocks it, but because KNOWLEDGE ITSELF is cryptographically unavailable without the right key."

This is a fundamentally different security model than API-key authentication. The distinction:
- **API-key model:** Knowledge is readable by anyone with database access. Software enforces who can call the API. An attacker who bypasses the software (direct DB access, stolen backup, memory dump) sees everything.
- **Cryptographic model:** Knowledge is encrypted at rest. Without the decryption key, the data is meaningless. An attacker with full database access sees encrypted blobs. The knowledge ITSELF is unavailable, not just the API.

### How This Changes the Data Model

The current payload schema stores everything in plaintext:
```json
{
  "content": "Role boundaries prevent coordination collapse...",
  "contributor_id": "agent-pdsa-001",
  ...
}
```

With cryptographic access control, the schema needs:

```json
{
  "knowledge_space_id": "ks-xpollination-001",
  "encrypted_content": "<base64-encrypted>",
  "encrypted_metadata": "<base64-encrypted>",
  "content_hash": "<sha256 of plaintext for dedup>",
  "contributor_id": "agent-pdsa-001",
  "access_grants": [
    {"agent_id": "agent-dev-002", "granted_at": "2026-02-23T15:00:00Z", "granted_by": "ks-admin"},
    {"agent_id": "agent-qa-003", "granted_at": "2026-02-23T15:00:00Z", "granted_by": "ks-admin"}
  ],

  "access_count": 0,
  "pheromone_weight": 1.0,
  ...
}
```

**New concepts:**
- `knowledge_space_id` — groups thoughts into access-controlled spaces. A company has one knowledge space. An individual has a personal space. Invitation = sharing the space's decryption key.
- `encrypted_content` / `encrypted_metadata` — the thought content and sensitive metadata are encrypted with the knowledge space's key.
- `access_grants` — records which agents have been granted access (invitation tracking).
- `content_hash` — SHA-256 of plaintext content, enables deduplication without decrypting.

### Technical Challenge: Semantic Search on Encrypted Data

**This is the hardest problem.** Vector similarity search requires comparing vector distances. If embeddings are encrypted, cosine similarity produces garbage.

**Three approaches:**

#### Approach A: Encrypt Content, Keep Embeddings in Plaintext
- **How:** Encrypt `content` and `metadata`. Store embedding vectors unencrypted.
- **Tradeoff:** Search works normally. But embeddings leak semantic information — an attacker can infer topics from vector proximity even without decrypting content. This is a partial solution.
- **When appropriate:** When the threat model is "protect content from unauthorized reading" but NOT "hide what topics exist."

#### Approach B: Homomorphic Encryption on Embeddings
- **How:** Use Fully Homomorphic Encryption (FHE) to compute cosine similarity on encrypted vectors.
- **Tradeoff:** Mathematically correct but extremely slow. Current FHE implementations add 1000-10000× overhead. A 10ms search becomes 10-100 seconds.
- **When appropriate:** When topics themselves are sensitive AND performance is not critical.
- **State of the art:** Microsoft SEAL, PALISADE, ZAMA's Concrete. All are research-grade for vector operations as of 2025.

#### Approach C: Trusted Execution Environment (TEE)
- **How:** Run Qdrant inside a TEE (Intel SGX, AMD SEV). Data is encrypted at rest and in transit. Decrypted only inside the secure enclave for search.
- **Tradeoff:** Best of both worlds — full search performance, full encryption. But requires specific hardware and adds deployment complexity.
- **When appropriate:** Production systems with strict security requirements.

#### Approach D: Access-Filtered Search (Pragmatic MVP)
- **How:** Each thought belongs to a `knowledge_space_id`. Agents present a cryptographic token (signed JWT with space_id claim) when querying. The system filters results to only include thoughts from spaces the agent has access to. Content is encrypted at rest (standard disk encryption or Qdrant's built-in encryption).
- **Tradeoff:** Not end-to-end encrypted (the server can read plaintext during search). But prevents unauthorized agents from accessing thoughts. Combined with server-side encryption at rest, this handles most threat models.
- **When appropriate:** Multi-tenant knowledge systems where the server is trusted but agents are not.

### Recommendation

**For MVP:** Approach D (Access-Filtered Search). Add `knowledge_space_id` to the payload schema now. Implement JWT-based agent authentication. Encrypt at rest via Qdrant's built-in encryption. This covers the invitation model ("you need a token to access this knowledge space") without the performance penalty of homomorphic encryption.

**For future:** Evaluate Approach C (TEE) when the system handles truly sensitive data and hardware is available.

**Schema changes for immediate accommodation:**

Add to `thought_space` payload:
```json
{
  "knowledge_space_id": "ks-default",
  "access_grants": []
}
```

Add to `query_log` table:
```sql
ALTER TABLE query_log ADD COLUMN knowledge_space_id TEXT NOT NULL DEFAULT 'ks-default';
```

Add new table for knowledge space management:
```sql
CREATE TABLE knowledge_spaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT NOT NULL,
  encryption_key_hash TEXT,  -- hash of the encryption key (key itself stored securely)
  settings TEXT  -- JSON for space-specific configuration
);

CREATE TABLE space_memberships (
  space_id TEXT NOT NULL REFERENCES knowledge_spaces(id),
  agent_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'contributor',  -- 'admin', 'contributor', 'reader'
  granted_at TEXT NOT NULL DEFAULT (datetime('now')),
  granted_by TEXT NOT NULL,
  PRIMARY KEY (space_id, agent_id)
);
```

### Why "Adding Security Later Is a Completely New Project"

Thomas is right. Here's what changes if security is retrofitted:

| Component | Without Security | With Security |
|-----------|-----------------|---------------|
| Storage | Plaintext payloads | Encrypted payloads + key management |
| Search | Direct cosine similarity | Filtered by space + possibly encrypted search |
| API | Open endpoints | Auth middleware on every endpoint |
| Agent integration | Send prompt, get response | Send prompt + auth token, validate, filter, respond |
| Data model | Flat collection | Partitioned by knowledge space |
| Deployment | Single Qdrant instance | Qdrant + auth service + key management |
| Testing | Functional tests | Functional + security + penetration tests |

Every layer changes. If the data model doesn't have `knowledge_space_id` from the start, migrating existing data requires re-indexing the entire collection. If the API doesn't have auth middleware, adding it means touching every endpoint. If testing doesn't include security scenarios, they need to be written from scratch.

By adding the schema fields now (even without implementing encryption), the foundation exists for security to be a feature addition rather than an architecture replacement.

---

## STUDY (Iteration 10)

### What I Learned

1. **The conversational interface is a better architecture.** It's not just a user-experience improvement — it's a separation of concerns. Agents deal with knowledge (natural language). The system deals with operations (embed, search, reinforce, track). Neither needs to know the other's implementation details. This is the zero-knowledge pattern Thomas described.

2. **Cryptographic access control is genuinely hard for vector databases.** The fundamental tension: semantic search requires comparing vectors, encryption prevents comparison. There's no elegant solution today — only tradeoffs between security level and performance. Approach D (access-filtered + at-rest encryption) is the pragmatic path.

3. **Schema accommodation is cheap; retrofitting is expensive.** Adding `knowledge_space_id` and `access_grants` to the payload schema costs nothing in performance or complexity. But NOT having them when security needs arise means migrating every vector. Thomas's principle — "adding security later is a completely new project" — is validated by the component-by-component analysis.

4. **The conversational endpoint changes the implementation phases.** Phase 4 (previously "Document HTTP API for agents") becomes "Build conversational layer." This is architecturally cleaner — agents never see the internal endpoints.

### What Questions Remain

1. **JWT vs. other credential formats.** Thomas said "cryptographic credentials, not API keys." JWT with RSA/EC signatures is one path. Client certificates (mTLS) is another. Which fits the "invitation = sharing decryption credential" model better?

2. **Knowledge space granularity.** One space per company? Per team? Per project? The schema supports any granularity, but the invitation model changes based on how fine-grained spaces are.

3. **How does the conversational classifier handle multi-language?** Agents may prompt in English or German. The MVP heuristic (question marks, length) is language-agnostic, but an LLM classifier would need to handle both.

4. **Should pheromone weights be per-space or global?** If a thought exists in space A and space B, do they share pheromone weight? Or does each space have its own prominence landscape?

---

## ACT (Iteration 10)

### What Changed in Iteration 9 Content

1. **Sources Read table:** All 10 entries now have clickable markdown links
2. **STUDY section:** 3 doc references now linked
3. **Section 7:** Completely rewritten — conversational interface replaces direct HTTP/MCP/Skill options
4. **Decisions table:** 2 rows updated (agent integration → conversational, auth → cryptographic)
5. **Gap analysis:** Added authentication row, updated agent integration row
6. **Phase 4:** Updated to reflect conversational interface implementation

### New Content in Iteration 10

7. **Security Architecture Reflection:** 4 approaches to encrypted search analyzed (plaintext embeddings, homomorphic, TEE, access-filtered). Recommendation: Approach D for MVP.
8. **Schema Accommodation:** `knowledge_space_id`, `access_grants` added to payload spec. `knowledge_spaces` and `space_memberships` SQLite tables specified.
9. **"Why adding security later is a new project":** Component-by-component analysis showing every layer changes.

### Next Steps

1. Thomas reviews the conversational interface design and security reflection
2. If approved: create implementation tasks for DEV (Phase 1-4 with security schema from start)
3. QA writes acceptance tests including auth scenarios

---

## Deliverables (Iteration 10)

| File | Description |
|------|-------------|
| [`pdsa/2026-02-19-agent-memory.pdsa.md`](.) | This document — iteration 10 adds conversational interface + security reflection |

---

---

# ITERATION 11: Standalone Spec Extraction + 9 Feedback Items

**Date:** 2026-02-23
**Rework reason:** Thomas provided detailed feedback in [`rework-feedback-iteration-10.md`](rework-feedback-iteration-10.md) with 9 specific changes. Most significant: extract the buildable spec from the PDSA into a standalone document.

---

## Feedback → Changes (Iteration 11)

| # | Feedback | Change Made |
|---|----------|------------|
| 1 | Remove crypto from active spec, mark deferred | Moved to post-MVP section in standalone spec. Security reflection preserved in PDSA iteration 10 but not in buildable spec. |
| 2 | Replace intent classifier with contribution threshold | Removed 4-way classifier. Every call retrieves. Contribution threshold: >50 chars, declarative, not follow-up. ~5 lines of code. |
| 3 | Split response into result + trace | Response has `result` (agent needs) and `trace` (system logs). Agent can ignore trace. |
| 4 | Define context handling explicitly | Three uses: (1) concatenate with prompt for embedding, (2) store as metadata on contributions, (3) log for trajectory analytics. |
| 5 | Add feedback loop | Implicit MVP: follow-up contributions in same session = positive reinforcement. Explicit post-MVP: /memory/feedback endpoint. |
| 6 | Guided intake via conversational interface | New agent onboarding ("I don't recognize you"). Disambiguation for ambiguous queries (cluster counts). Multi-turn via session_id + dialogue_state. |
| 7 | **STRUCTURAL:** Extract buildable spec from PDSA | Created [`spec/thought-tracing-system.md`](../spec/thought-tracing-system.md) — standalone, developer-readable, no research history. PDSA remains as trajectory. |
| 8 | Integrate PageIndex analysis | Added hybrid retrieval section: tree navigation + vector search. Tree index as background job (post-MVP). Heterogeneous retrieval routing. Co-retrieval quality signal by retrieval method. |
| 9 | Add PageIndex MCP for PDSA docs | Documented as practical post-MVP addition. PDSA docs are exact use case for tree-navigated retrieval. |

### The Key Structural Change

The PDSA (this document) has 11 iterations of research trajectory — valuable for understanding WHY decisions were made, but impossible for a developer to extract buildable requirements from. The standalone spec is the **conclusion**; this PDSA is the **trajectory**. This directly implements the design decision from iteration 8: "Conclusions in standalone docs, trajectories in PDSA docs."

---

## STUDY (Iteration 11)

### What Changed Architecturally

1. **Contribution threshold replaces intent classifier.** This is cleaner — every interaction retrieves (because "retrieval patterns ARE knowledge"), and the only decision is whether the prompt is substantial enough to also store. The system is always reading AND always writing, just at different weights.

2. **Context handling is the quiet revolution.** Two agents asking the same query from different contexts should get different results. By concatenating context + prompt for embedding, the same question "role separation" from a DEV context and a PDSA context produces different retrieval vectors. This is implicit personalization without a user model.

3. **PageIndex adds a dimension I hadn't considered.** The vector-only retrieval model assumes all knowledge is equally well served by cosine similarity. But structured knowledge (PDSA docs, documentation, hierarchical specs) is better navigated than searched. The hybrid approach — tree for structure, vector for semantics, pheromone for popularity — is genuinely better than any one method alone.

4. **The guided intake insight connects spec 08 to the implementation.** Spec 08 describes context beans and guided intake. The conversational interface IS that — disambiguation, onboarding, multi-turn clarification. It's not a separate feature; it's the conversational endpoint doing its job.

### What I Now Understand vs. What Remains Ambiguous

**Clear:** The full pipeline from agent prompt → contribution threshold → context concatenation → retrieval → pheromone → response formatting → guided intake. Every component has a concrete specification in the standalone doc.

**Ambiguous:**
1. How should tree index generation work concretely? One LLM call? Multiple? What prompt?
2. How does the session follow-up detection work for implicit feedback? Pattern matching? Cosine similarity between follow-up and previous results?
3. What happens when contribution threshold disagrees with reality? (Short declarative = important insight; long question = just a question)

---

## ACT (Iteration 11)

### Deliverables

| File | Description |
|------|-------------|
| [`spec/thought-tracing-system.md`](../spec/thought-tracing-system.md) | **NEW** — Standalone buildable spec. All 9 feedback items integrated. |
| [`pdsa/2026-02-19-agent-memory.pdsa.md`](.) | This document — iteration 11 records the extraction and feedback integration |
| [`pdsa/rework-feedback-iteration-10.md`](rework-feedback-iteration-10.md) | Thomas's feedback file (input, not output) |

### Next Steps

1. Thomas reviews standalone spec
2. If approved: create implementation tasks for DEV (Phases 1-4)
3. QA writes acceptance tests from spec
4. PDSA reviews implementation matches spec
