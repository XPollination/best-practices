# PDSA: Agent Memory Systems — What, Where, When

**Date:** 2026-02-19
**Author:** PDSA Agent
**Task:** best-practice-agent-memory
**Status:** COMPLETE (iteration 4 — usability improvements after LIAISON review)

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
5. **Distributed Knowledge** — not implemented; best-practices API (Qdrant) exists but isn't integrated as memory

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

2. **No vector-backed retrieval for agent memory.** The best-practices API (Qdrant) exists but agents don't use it as a memory retrieval system. MEMORY.md is the only thing loaded at startup. When MEMORY.md hits its cap, knowledge is simply lost (or moved to topic files that may never be read).

3. **No per-agent memory.** All agents share CLAUDE.md/MEMORY.md. There's no mechanism for one agent to remember something that only it needs. The spec envisions per-thinker nodes in the knowledge graph; our system has no equivalent.

4. **Context pressure is undocumented as a memory trigger.** We learned through experience that compaction degrades traceability. This is a real-world pattern that neither the spec nor Galarza explicitly addresses: the moment BEFORE context loss is a critical write window.

---

## ACT

### What Should Change in Our System?

**Immediate (can implement now):**

1. **Add a "last reviewed" date to MEMORY.md entries.** This enables manual staleness detection. If an entry hasn't been reviewed in 30 days, flag it for human inspection during the next edit.

2. **Document the PM system as a memory layer.** Task DNA is agent memory — we should acknowledge this in our architecture docs rather than treating PM and memory as separate concerns.

3. **Integrate best-practices API as agent memory retrieval.** When an agent starts a task in a specific domain, it should query the Qdrant API for relevant best practices, not just rely on MEMORY.md. This bridges the gap between our simple markdown memory and the spec's vector-backed retrieval.

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

## Deliverables

| File | Description |
|------|-------------|
| `pdsa/2026-02-19-agent-memory.pdsa.md` | This document — the research journey (4 iterations) |
| `docs/agent-memory/agent-memory-what.md` | Best practice: what is worth remembering |
| `docs/agent-memory/agent-memory-where.md` | Best practice: storage architecture |
| `docs/agent-memory/agent-memory-when.md` | Best practice: lifecycle triggers |
| `docs/agent-memory/README.md` | Topic navigation |
