# Rework Feedback for Iteration 10 → Iteration 11

**Date:** 2026-02-23
**From:** Thomas (via LIAISON)
**Task:** best-practice-agent-memory

---

## Item 1: Omit Crypto from Vector DB

Remove the cryptographic access control section from the active spec. Document it as future work. We will deal with that later. The security reflection (Approach A-D, schema accommodation, etc.) should be preserved but clearly marked as **deferred — not part of MVP scope**.

---

## Item 2: Five Changes to the Conversational Interface

### Change 1: Replace Intent Classifier with Contribution Threshold

Every call retrieves. The question is only whether to also store.

Thomas's reasoning: The conversational interface assumes the system must decide whether the agent is contributing or querying. But in the XPollination model, every interaction is both. "Retrieval patterns ARE knowledge" — every query is already a form of contribution (reinforces pheromones, creates co-retrieval edges, logs access). And every contribution should trigger a retrieval (to show related thoughts, create co-retrieval connections).

The real design:
- A **query** like "What patterns exist for role separation?" is:
  - High-weight retrieve (primary intent)
  - Low-weight think (the query itself reveals what this agent cares about — stored as "interest signal", not full thought)
- A **contribution** like "I learned that task DNA maps to thought units" is:
  - High-weight think (primary intent)
  - Low-weight retrieve (return related thoughts to enrich context)

**Concrete change:** Replace the 4-way intent classifier with a **contribution threshold** — a simple heuristic that determines whether the prompt content is substantial enough to store as a thought (>50 chars, contains declarative statements, isn't purely interrogative). Everything always retrieves. The question is only: does this also get stored?

### Change 2: Split Response into Result and Trace

Current response conflates two audiences (agent usage and monitoring).

**Concrete change:** Two clean sections:
- `result` — what the agent needs (response text, sources)
- `trace` — what the system logs (operations, counts, session_id, reasoning path)

Agent can ignore trace. Monitoring reads both. Future-proofs for pheromone visualization layer.

### Change 3: Define Context Handling Explicitly

The `context` field in the request is doing no work in the spec. But it's the most valuable input for pheromone model and convergence detection.

Two agents asking the same query from different contexts need different results. DEV asking about "role separation" while implementing needs implementation patterns. PDSA asking about "role separation" while writing a best practice needs design rationale.

**Concrete change — define context handling:**
- **For embedding:** Concatenate context + prompt before embedding (weighted — context provides direction, prompt provides specificity)
- **For storage:** If the prompt is stored as a thought, context becomes metadata (not part of embedded content, but stored for provenance)
- **For analytics:** Context + prompt pairs in query log enable richer trajectory analysis

### Change 4: Add Feedback Loop

Current design is one-way: agent sends prompt → system responds. No mechanism for agent to signal whether response was useful.

This matters for pheromone: right now reinforcement is triggered by retrieval alone (+0.05 regardless of utility). Frequently retrieved but unhelpful thoughts accumulate undeserved weight.

**Concrete change — two approaches:**

**Lightweight (MVP):** Response includes session_id. If agent sends follow-up prompt referencing that session ("Based on what you told me, I built X and it worked"), system infers positive reinforcement for previously retrieved thoughts. No explicit feedback API — system detects follow-up contributions as implicit confirmation.

**Explicit (post-MVP):** `POST /api/v1/memory/feedback` with `{session_id, thought_id, signal: "useful" | "irrelevant"}`. Useful thoughts get bonus reinforcement, irrelevant get dampened. Beginning of RL policy (layer 7).

### Change 5: Implement Guided Intake Through Conversational Interface

The conversational interface should BE the guided intake from spec 08. Currently passive (prompt → response). Should guide.

**New agent onboarding:**
- System detects agent_id not in any space_memberships
- Returns guidance: "I don't recognize you yet. What knowledge space are you working in?"
- This IS the onboarding. No documentation needed.

**Ambiguous queries:**
- Agent sends: "stuff about architecture"
- System responds: "I found 23 thoughts about architecture across 4 tag clusters: system-architecture (12), org-architecture (6), data-architecture (3), security-architecture (2). Which area?"
- This is spec 08's context bean pattern implemented conversationally.

**Concrete change:** Add `dialogue_state` to session. System can hold multi-turn conversations. MVP version: return results with disambiguation notes.

---

## Item 3: Extract Buildable Spec from PDSA

The PDSA document has become the product instead of the product being the product. A developer building Phase 1 must read through Hopfield theory, pheromone math, trivium reflections, and 9 previous iterations to find endpoint signatures.

**Concrete change:** Extract iteration 9 spec (sections 1-10) into a standalone document: `spec/thought-tracing-system.md`. The PDSA remains as the research trace. The spec is the buildable conclusion.

This is the trajectory vs. conclusion tension that iteration 7 flagged. PDSA = trajectory. Standalone spec = conclusion.

---

## Item 4: PageIndex Integration Analysis

Thomas researched PageIndex (vectorless, reasoning-based RAG by VectifyAI). Key findings:

### What PageIndex Is
- Transforms documents into hierarchical tree index (JSON ToC with nodes, descriptions, sub-nodes)
- Gives LLM the tree structure as in-context data
- LLM reasons over tree to navigate to relevant sections (like human scanning table of contents)
- Retrieval is traceable — you see which nodes LLM visited and why
- 98.7% accuracy on FinanceBench vs vector RAG
- Has MCP integration, Python SDK, open-source (GitHub: VectifyAI/PageIndex)

### How It Shifts Thinking

**1. Tree navigation + vector search hybrid for thought_space:**
- Tree index over thought collection — organized by topic hierarchy, contributor, thought_type, time
- LLM reasons about which branch to explore
- Vector search within a branch — cosine similarity finds specific thought
- Pheromone weighting modifies results within a branch

**2. Conversational interface becomes agentic retriever:**
- Not just: embed query → cosine search → return top-N
- Instead: system reasons over thought_space structure → navigates to relevant region → retrieves specific thoughts → returns with full navigation trace

**3. Retrieval traceability:**
- Log the reasoning/navigation path for each retrieval
- The retrieval path IS thinking — connects to "reproduce how thinkers arrived at convergence"

**4. Co-retrieval hypothesis gets sharper:**
- Tree-navigated co-retrieval = high signal (LLM actively decided both thoughts relevant)
- Vector-based co-retrieval = potentially noise (geometric proximity)
- System could weight co-retrieval edges differently based on retrieval method

**5. MEMORY.md's 200-line cap has a PageIndex-shaped solution:**
- Don't load all of MEMORY.md into context
- Build tree index over it, let agent navigate to what it needs
- Memory becomes navigable, not all-or-nothing
- More immediate/practical than full thought_space redesign

**6. Heterogeneous retrieval methods:**
- Some knowledge best found by vector similarity (unexpected connections)
- Some by tree navigation (structured domain answers)
- Some by pheromone prominence (collectively validated)
- Conversational endpoint routes to different strategies, not just different endpoints

### Two Practical MVP Additions

**Addition 1:** Generate tree index over thought_space as background job. When collection reaches 50+ thoughts, auto-generate hierarchical topic tree. Store as JSON. Cheap (one LLM call periodically), creates foundation for reasoning-based retrieval.

**Addition 2:** Add PageIndex as MCP integration for PDSA document retrieval. PDSA docs are exact use case — long, structured, hierarchical. Let agents query via tree search instead of embedding chunks.

### Bottom Line from Thomas

PageIndex doesn't invalidate the spec. It complements it where the spec is weakest (retrieval quality for structured knowledge). The most interesting future: tree navigation finds the right region, pheromone-weighted vector search finds the right thought within that region, conversational interface abstracts both behind natural language.

---

## Summary of Required Changes

| # | Change | Priority |
|---|--------|----------|
| 1 | Remove crypto from active spec, mark as deferred future work | Must |
| 2 | Replace intent classifier with contribution threshold | Must |
| 3 | Split response into result + trace | Must |
| 4 | Define context handling explicitly | Must |
| 5 | Add feedback loop (implicit MVP, explicit post-MVP) | Must |
| 6 | Implement guided intake through conversational interface | Must |
| 7 | Extract buildable spec into standalone `spec/thought-tracing-system.md` | Must |
| 8 | Integrate PageIndex analysis — hybrid retrieval, tree index background job, heterogeneous routing | Must |
| 9 | Add PageIndex MCP for PDSA doc retrieval as practical addition | Should |
