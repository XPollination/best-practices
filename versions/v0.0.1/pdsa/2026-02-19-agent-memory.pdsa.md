# PDSA: Agent Memory Systems — What, Where, When

**Date:** 2026-02-19
**Author:** PDSA Agent
**Task:** best-practice-agent-memory
**Status:** COMPLETE (iteration 2 — rework after initial submission lacked depth)

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

## Deliverables

| File | Description |
|------|-------------|
| `pdsa/2026-02-19-agent-memory.pdsa.md` | This document — the research journey |
| `docs/agent-memory/agent-memory-what.md` | Best practice: what is worth remembering |
| `docs/agent-memory/agent-memory-where.md` | Best practice: storage architecture |
| `docs/agent-memory/agent-memory-when.md` | Best practice: lifecycle triggers |
| `docs/agent-memory/README.md` | Topic navigation |
