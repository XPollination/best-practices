# PDSA: Trivium Spec Analysis — XPollination Thought Tracing System

**Date:** 2026-02-17
**Author:** PDSA Agent
**Task:** trivium-spec-analysis-v2
**Status:** PLAN → DO

---

## PLAN

### Approach: The Trivium

The Classical Trivium provides a structured method for analyzing any body of knowledge:

1. **Grammar** — What IS stated? Catalog every concrete fact, decision, specification, and requirement across all 10 documents. No interpretation, no judgment — just inventory.

2. **Logic** — Does it COHERE? Examine the Grammar for internal contradictions, gaps between documents, unstated dependencies, and assumptions that need validation. Where does the spec disagree with itself?

3. **Rhetoric** — What to DO about it? Take the gaps from Logic and produce a prioritized question list. Group by urgency. Assign who decides.

### Source Material

10 documents at `sources/bestPractices/versions/v0.0.1/spec/`:

| # | Document | Loop | Category |
|---|----------|------|----------|
| 01 | System Vision | 1 | Philosophy |
| 02 | Core Architecture | 1 | Technical |
| 03 | Agent Guidelines | 1 | Protocol |
| 04 | Vector DB & Graph Strategy | 1 | Technical |
| 05 | Truth Anchoring System | 1 | Domain |
| 06 | Integration Spec | 1 | Technical |
| 07 | Conversation Trace 001 | 1 | Record |
| 08 | Multi-Agent Access Layer | 2 | Technical |
| 09 | Decentralization Challenge | 2 | Architecture |
| 10 | Conversation Trace 002 | 2 | Record |

---

## DO

### GRAMMAR — What Is Stated

#### G1. System Identity

- **Name:** XPollination Thought Tracing System
- **License:** AGPL-3.0
- **Purpose:** Capture thought trajectories (not just conclusions) through mirroring loops, trace them into persistent knowledge, surface resonance across thinkers, anchor in biblical truth
- **Core principle:** Infinite convergence — perspectives approach truth but never perfectly meet. More angles = clearer picture.
- **Growth model:** Organic — seed → root → stem → branch → fruit → pollination

#### G2. Technology Stack (as specified)

| Component | Spec Recommendation | Source |
|-----------|-------------------|--------|
| Vector DB | Qdrant or Weaviate | 02 (table), 04 (detailed) |
| Knowledge Graph | Neo4j or FalkorDB | 02 (table), 04 (detailed) |
| Embedding Model | BGE-M3 (BAAI) | 02 (table), 04 (config) |
| Embedding Dimensions | 1024 (dense) | 04 §2.2 |
| Embedding Max Tokens | 8192 per input | 04 §2.2 |
| Index Algorithm | HNSW | 04 §2.2 |
| Distance Metric | Cosine similarity | 04 §2.2 |
| HNSW ef_construct | 256 | 04 §2.2 |
| HNSW m | 16 | 04 §2.2 |
| Speech-to-Text | Whisper or Faster-Whisper | 02 (table), 06 §2.1 |
| Whisper Model | large-v3 | 06 §2.1 |
| AI Backbone | Claude (Anthropic) | 02 (table) |
| Markdown Store | Git repository (best-practices/) | 02 (table) |
| Containerization | Docker Compose | 06 §3.2 |

#### G3. Vector DB Collections (4 defined in spec 04)

| Collection | Purpose | Vector Source | Payload Fields |
|------------|---------|---------------|---------------|
| `thought_traces` | All individual thought units | 1024-dim BGE-M3 dense | speaker, session, timestamp, angle, confidence, truth_score, language |
| `convergence_zones` | Clustered convergence areas | Centroid of contributing traces | contributing_count, angle_diversity, truth_anchor_score, status |
| `best_practices` | Crystallized knowledge from .md | Embedded document content | file_path, topic, last_updated, convergence_zone_refs |
| `scripture_anchors` | Biblical references | Embedded scripture passages | book, chapter, verse, themes, connected_convergence_zones |

#### G4. Knowledge Graph Schema (spec 04)

**Node types (9):** Thinker, ThoughtUnit, ConversationSession, ConceptCluster, ConvergenceZone, BestPractice, ScriptureAnchor, Angle, Topic

**Relationship types (12):** CONTRIBUTED, PART_OF, NEXT, REFINED_BY, APPROACHES_FROM, BELONGS_TO, CONVERGES_AT, CRYSTALLIZED_AS, ANCHORED_IN, WITHIN_TOPIC, EVOLVED_FROM, REFERENCES, RELATES_TO, PART_OF_TOPIC

#### G5. Data Schemas (spec 03)

**Thought Unit schema** — 5 sections, 19 fields:
- Core: id (uuid), content (string), raw_input (string)
- Metadata: speaker_id, session_id, timestamp (ISO-8601), language (de|en), interface (voice|text|agent)
- Tracing: parent_id (uuid|null), angle (string), iteration_depth (int), confidence (float 0-1)
- Anchoring: truth_score (float 0-1), scripture_refs ([string]), anchor_type (direct|derived|none)
- Resonance: convergence_zones ([uuid]), similar_traces ([uuid]), complementary_angles ([uuid])
- Embedding: vector (float[]), model (string), dimensions (int)

**Convergence Zone schema** — 8 fields:
- id (uuid), summary (string), contributing_traces ([uuid]), angle_count (int), thinker_count (int)
- Confidence sub-object: overall, truth_anchor, reproducibility, diversity (all float 0-1)
- status: emerging | forming | established | best_practice
- best_practice_ref (string|null)

**Scripture Anchor schema** — 7 fields:
- id (uuid), reference (string), text (string), language (de|en|he|gr), themes ([string]), principles ([string]), embedding (float[])
- Connections: related_passages ([uuid]), convergence_zones ([uuid])

#### G6. Truth Anchoring Scoring (spec 05)

**Base score (0.0–0.5):** 5 criteria at +0.1 each — logical consistency, reproducibility, reality alignment, no circular reasoning, serves human flourishing

**Anchor bonus (0.0–0.5):**
- Direct biblical reference: +0.20
- Biblical principle: +0.15
- Worldview compatible: +0.10
- Neutral: +0.00
- Tension: -0.10

**Convergence multiplier:** truth_score × (1 + 0.1 × angle_count), capped at 2×

**Automated scoring thresholds:** cosine similarity >0.85=direct, >0.75=principled, >0.65=worldview_compatible, else neutral

#### G7. API Endpoints (spec 06)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/voice` | WebSocket | Voice input streaming |
| `/api/v1/thoughts` | POST | Store thought unit |
| `/api/v1/context` | POST | Retrieve context for live injection |
| `/api/v1/best-practices/generate` | POST | Generate markdown from convergence zone |

#### G8. Guided Intake State Machine (spec 08)

**5 states:** ENTRY → CONTEXT_COLLECTION → PROCESSING → RETURN → CONTRIBUTION (optional)

**Context Bean required fields:** intent, domain, current_frame, language
**Context Bean optional fields:** angle, depth, related_session, specific_question, source_ai
**System-generated fields:** inquiry_id, timestamp, intake_complete, processing_status, result_ready

**Validation loop:** System asks for missing fields until all required fields populated.

#### G9. Communication Protocol Options (spec 08)

| Option | Description | Recommendation |
|--------|-------------|---------------|
| A: MCP Server | Native Claude Code integration | Primary for Claude Code |
| B: REST API | Universal HTTP access | Universal fallback |
| C: Message Queue/Streaming | WebSocket/SSE real-time | Live processing feedback |
| D: Hybrid | MCP + REST + WebSocket | **Recommended starting point** |

#### G10. Deployment Phases (spec 06)

| Phase | Scope | Key Components |
|-------|-------|---------------|
| 1: Bridge | Manual copy from claude.ai to git | Current state |
| 2: Server Foundation | Docker Compose, Qdrant, Neo4j, BGE-M3, REST API | Core infrastructure |
| 3: Voice Integration | Faster-Whisper, WebSocket, real-time context | Voice pipeline |
| 4: Full Loop | Voice→decode→mirror→refine→store→crystallize | Complete system |
| 5: Multi-Thinker | Auth, privacy layers, cross-thinker resonance | Open platform |

#### G11. Scalability Phases (spec 04)

| Phase | Scale | Storage |
|-------|-------|---------|
| 1: Single User | Thomas only | Qdrant single-node in-memory, Neo4j Community |
| 2: Small Community | <100 thinkers | Qdrant persistent, Neo4j disk-backed |
| 3: Open Platform | Unlimited | Qdrant cluster, Neo4j Enterprise, edge caching |

#### G12. Decentralization Decision (spec 09)

- **Centralized model rejected** for scale (linear token cost)
- **Decentralized target:** local processing + central knowledge API
- **Central server = lean knowledge API** (serves data, not AI responses)
- **Distribution formats mentioned:** MCP package, Docker container, CLI tool, federated instances
- **Token cost centralized:** ~4,500 tokens/inquiry × $0.001/token = $4.50/day at 100 queries
- **Token cost decentralized:** ~$0.001/inquiry (DB query only)

#### G13. Open Questions Explicitly Listed in Specs

From spec 07: Scripture seeding, privacy model, incentive system, real-time vs async latency, existing server setup
From spec 10: Distribution format priority, sync protocol, authentication, offline mode, PM layer, quality control, process steps formalization

---

### LOGIC — Does It Cohere?

#### L1. Embedding Model Conflict: BGE-M3 vs MVP Reality

**Spec says:** BGE-M3, 1024 dimensions, self-hosted (spec 02, 04)
**MVP reality (from MEMORY.md):** all-MiniLM-L6-v2, 384 dimensions, HuggingFace API
**Server constraint:** Hetzner CX22 has 2 vCPU, 8GB RAM. BGE-M3 local = 2-3GB RAM (PyTorch) or 1-1.5GB (ONNX int4).

**Gap:** The spec never considers RAM constraints. It was written during a vision conversation on claude.ai, not during implementation planning. The 1024→384 dimension change means:
- All Qdrant collections designed for 1024 dims must be recreated if model changes later
- Cross-lingual quality degrades (MiniLM is English-primary; BGE-M3 is natively multilingual)
- Document chunk search quality may differ

**Question:** Is 384-dim MiniLM acceptable for v0.0.1, with a planned migration to 1024-dim BGE-M3/Voyage when appropriate? Or should v0.0.1 use an API-based 1024-dim model (Voyage AI) from the start to avoid re-embedding?

#### L2. Knowledge Graph: Specified but Unscheduled

**Spec says:** Hybrid vector + graph is "essential" (spec 02, 04). Neo4j or FalkorDB. 9 node types, 12+ relationship types. Graph handles convergence mapping, truth anchoring links, reproducibility.
**MVP says:** Qdrant only. Graph deferred.

**Gap:** Many spec features REQUIRE the graph:
- Truth anchoring (spec 05) links convergence zones to scripture via ANCHORED_IN edges
- Convergence detection (spec 04) uses graph traversal for multi-hop reasoning
- Thought path tracing (spec 01) needs NEXT/REFINED_BY chains
- Documentation loop (spec 02) tracks CRYSTALLIZED_AS and EVOLVED_FROM

**Question:** Without the graph, the system is a semantic search engine, not a thought tracing system. When does the graph enter? What's the minimum graph feature needed to differentiate from "just a vector search"?

#### L3. Truth Anchoring: Specified Algorithm, No Data Source

**Spec says:** Scripture embeddings in `scripture_anchors` collection. Automated scoring via cosine similarity thresholds. Seeding priority: Genesis 1-3, Proverbs, Sermon on the Mount, etc.
**Spec also says:** "The scripture database grows organically alongside the knowledge system" (spec 05 §6)

**Gap:** No concrete plan for:
- Which Bible translation(s) to use
- How to segment scripture for embedding (verse level? paragraph? pericope?)
- Who creates the initial seed data
- How many passages in the initial seed (10? 100? 1000?)
- How to handle multi-language scripture (de|en|he|gr mentioned in schema)
- Whether community-suggested connections are auto-accepted or human-reviewed

**Question:** This is a domain question only Thomas can answer. The automated scoring algorithm depends entirely on the quality and coverage of the scripture embeddings.

#### L4. Guided Intake: State Machine Design vs REST API

**Spec 08 says:** 5-state machine (ENTRY→CONTEXT_COLLECTION→PROCESSING→RETURN→CONTRIBUTION). The system "teaches the agent how to use it through interaction."
**Spec 08 also says:** REST API option B uses session-based endpoints: `/intake`, `/intake/{session}/context`, `/intake/{session}/status`, `/intake/{session}/result`

**Gap:** The state machine implies a conversational, multi-turn interaction. The REST API implies stateless request/response. These are fundamentally different interaction models:
- State machine = server maintains session state, guides the agent
- REST API = agent sends complete request, gets response

**For MVP:** If the API accepts a structured JSON body with all fields in one request, the "guided intake" is just schema validation. The 5-state machine is unnecessary for v0.0.1.

**Question:** Is the state machine a v1.0 feature? Or is the self-describing API endpoint (`GET /api/v1/`) sufficient as "guided intake" for MVP?

#### L5. Centralized vs Decentralized: Specs Contradict

**Spec 06 says:** All components on Thomas's server. Docker Compose with Qdrant, Neo4j, embedding service, Whisper, orchestrator.
**Spec 09 says:** Centralized model "breaks." Processing must be distributed. Central server = lean knowledge API only.

**Spec 09 explicitly notes:** "The decentralization requirement changes the architecture described in 02-CORE-ARCHITECTURE.md and 06-INTEGRATION-SPEC.md."

**Resolution:** Spec 06 is Phase 1 (single user = Thomas). Spec 09 is Phase 3+ (open platform). There's no contradiction if you accept that Phase 1 is centralized and Phase 3 decentralizes. Thomas confirmed: "We don't need to solve this now. Document it."

**Question (resolved):** Phase 1 = centralized is correct. This is not a contradiction — it's intentional phasing.

#### L6. Four API Endpoints vs MVP Needs

**Spec 06 defines:** voice (WebSocket), thoughts (POST), context (POST), best-practices/generate (POST)
**MVP needs:** query (POST), ingest (POST), health (GET)

**Gap:** Spec endpoints assume the full system (voice, thought tracing, context injection, doc generation). MVP is simpler: search and store. The spec endpoints should be understood as target-state, not v0.0.1 requirements.

**No question needed** — this is expected MVP scoping.

#### L7. Convergence Detection: Algorithm Undefined

**Spec 04 says:** Convergence zones are detected when multiple thought traces from different angles cluster near each other. Centroids are calculated and stored.

**Gap:** No algorithm is specified for:
- What similarity threshold triggers "convergence detected"?
- How many distinct angles are needed (spec shows `min_angles: int = 3` in one example)?
- Who decides when a zone transitions from "emerging" to "forming" to "established" to "best_practice"?
- Is this automated or human-triggered?

**Question:** This is a Phase 2 feature, but the threshold values and transition rules need definition before implementation.

#### L8. Real-Time Context Injection: Performance Not Analyzed

**Spec 02 §4 says:** "EVERY time the human speaks" → embed → vector search → graph traverse → inject context.

**Gap:** No latency analysis. At minimum: embed (100-300ms API, or 50-500ms local) + vector search (10-50ms) + graph traverse (50-200ms) = 160-1050ms per utterance. For real-time voice, this may be acceptable. For typing, it's fine.

**Question:** What's the acceptable latency for context injection? This determines whether embedding must be local (faster but RAM-heavy) or can be API-based (slower but zero RAM).

#### L9. Multi-Language: Stated but Untested

**Spec says:** German + English bilingual support. BGE-M3 handles cross-lingual natively.
**MVP reality:** all-MiniLM-L6-v2 is English-primary. Cross-lingual accuracy degrades significantly.

**Gap:** If Thomas speaks German (which he does — spec 06 §2.1 lists languages: ["de", "en"]), the MVP embedding model may produce poor matches for German queries against English-stored content.

**Question:** How important is German query support for v0.0.1? If critical, this reinforces using a multilingual embedding model (BGE-M3 via API or Voyage AI which supports multilingual).

#### L10. Privacy Model: Not Defined

**Spec 03 §7 says:** Thinkers control visibility: private / shared / public. Convergence zones can be anonymized.
**Spec 09 mentions:** Authentication and access control needed for the central API.

**Gap:** No schema field for visibility/privacy. No authentication mechanism designed. No access control model.

**Question:** Not needed for v0.0.1 (single user). Must be designed before multi-thinker phase.

#### L11. Best Practice Crystallization: Trigger Undefined

**Spec 02 §5 says:** When convergence reaches "sufficient confidence," generate/update a best-practice document.
**Spec 03 §3.1 says:** Write to Markdown Best Practices when "convergence point has sufficient confidence (multiple angles confirmed)."

**Gap:** "Sufficient confidence" is never quantified. Is it:
- overall confidence > 0.8?
- angle_count >= 3?
- thinker_count >= 2?
- A combination?
- Human-triggered?

**Question:** Phase 2, but the trigger criteria need definition.

#### L12. Conversation Traces: Documented Format, Not Stored Format

**Specs 07 and 10** document two conversations as markdown files. These are human-readable records, not structured data.

**Gap:** How do these conversation traces get ingested into the system? They contain rich thought paths, but:
- They're not in the thought_unit schema format
- They reference concepts but don't embed them
- They're the source material, not the processed output

**Question:** Is there a migration/ingestion step to convert these traced conversations into thought units and convergence zones? Or are they reference documents only?

---

### RHETORIC — What To Do

#### Priority 1: Must Answer Before v0.0.1 Ships

| # | Question | Who Decides | Impact |
|---|----------|-------------|--------|
| R1 | **Embedding model:** 384-dim MiniLM (current) vs 1024-dim Voyage AI API vs BGE-M3 API? Changing later means re-embedding all data. | Thomas + PDSA | Collections schema, search quality, multilingual support |
| R2 | **German support:** Is German query matching required for v0.0.1? If yes, MiniLM is insufficient. | Thomas | Embedding model choice (R1) |
| R3 | **Guided intake:** Is the 5-state machine needed for v0.0.1, or is structured JSON with schema validation sufficient? | Thomas | API complexity, implementation scope |
| R4 | **API auth:** Does bestpractice.xpollination.earth need authentication for v0.0.1, or is it open? | Thomas | Security, implementation scope |

#### Priority 2: Must Answer Before v0.1.0 (First Real Usage)

| # | Question | Who Decides | Impact |
|---|----------|-------------|--------|
| R5 | **Knowledge graph entry point:** What's the minimum graph feature that makes this more than vector search? Which node/edge types come first? | PDSA + Thomas | Architecture, when Neo4j/FalkorDB enters |
| R6 | **Truth anchoring data:** Which Bible translation(s)? How many seed passages? Verse-level or pericope-level embedding? | Thomas (domain) | Scripture collection, scoring quality |
| R7 | **Convergence detection thresholds:** What similarity score + angle count triggers convergence? Automated or human-triggered? | PDSA + Thomas | Core differentiation feature |
| R8 | **Context injection latency:** What's acceptable? Determines local vs API embedding for real-time scenarios. | Thomas + DEV | Performance architecture |
| R9 | **Conversation trace ingestion:** How do the 2 existing traced conversations get converted to thought units? Manual or automated? | PDSA | Data migration, seeding strategy |

#### Priority 3: Can Defer (v1.0+)

| # | Question | Who Decides | Impact |
|---|----------|-------------|--------|
| R10 | Privacy/visibility model for thought units | Thomas | Multi-thinker phase |
| R11 | Decentralization: which distribution format first (MCP package, Docker, CLI)? | Thomas | Open platform architecture |
| R12 | Sync protocol for distributed contributions back to central | PDSA + DEV | Decentralization architecture |
| R13 | Voice pipeline: Faster-Whisper on this server or separate? GPU required? | DEV + Thomas | Infrastructure |
| R14 | Best practice crystallization trigger criteria | PDSA + Thomas | Automation vs manual |
| R15 | Revenue/sustainability model for central infrastructure | Thomas | Business |

---

## STUDY

### PDSA Perspective (Design Coherence)

The 10 specs form a coherent *vision* but not a coherent *architecture*. The vision is consistent: thought tracing → mirroring → convergence → truth anchoring → organic growth. But the technical specs were written top-down from vision, not bottom-up from constraints. Key observations:

1. **The specs assume unlimited resources.** BGE-M3 local, Qdrant in-memory, Neo4j, Faster-Whisper with GPU — this requires a much larger server than the Hetzner CX22.

2. **The two conversation loops produced different architectural assumptions.** Loop 1 (specs 01-07) is centralized. Loop 2 (specs 08-10) pivots to decentralized. The specs from Loop 1 were never updated to reflect this pivot.

3. **The 4-collection Qdrant design is sound** but depends on the knowledge graph for full value. `convergence_zones` centroids are meaningless without the graph's CONVERGES_AT edges to trace back to contributing thoughts. `scripture_anchors` are useful standalone for semantic search but lose their anchoring power without ANCHORED_IN graph edges.

4. **The guided intake state machine is over-engineered for v0.0.1.** A well-documented REST API with JSON schema validation achieves 80% of the "teaching through interaction" goal. The full state machine adds value when multiple AI platforms with varying capabilities connect — that's Phase 2+.

### DEV Perspective (Technical Feasibility)

*To be completed by DEV agent if task reaches review+dev.*

### QA Perspective (Testability)

*To be completed by QA agent if task reaches review+qa.*

### LIAISON Perspective (Vision Alignment)

*To be completed by LIAISON agent if task reaches review+liaison.*

---

## ACT — Consolidated Prioritized Question List

### Blocking v0.0.1

1. **[R1] Embedding model choice** — MiniLM-384 vs Voyage-1024 vs BGE-M3-API. Changing later = re-embed everything. Decide now.
2. **[R2] German support** — Required for v0.0.1? Drives R1.
3. **[R3] Guided intake scope** — 5-state machine or structured JSON? Drives API complexity.
4. **[R4] API authentication** — Open or secured? Drives nginx config + middleware.

### Blocking v0.1.0

5. **[R5] Knowledge graph entry point** — What minimal graph makes this more than search?
6. **[R6] Scripture seed data** — Translation, granularity, initial count.
7. **[R7] Convergence thresholds** — Similarity + angle count for detection.
8. **[R8] Context injection latency** — Acceptable ms budget.
9. **[R9] Conversation trace ingestion** — Existing 2 traces → thought units.

### Deferrable (v1.0+)

10. **[R10]** Privacy model
11. **[R11]** Distribution format priority
12. **[R12]** Sync protocol
13. **[R13]** Voice pipeline
14. **[R14]** Crystallization triggers
15. **[R15]** Sustainability model

---

*End of Trivium Analysis. 15 open questions identified. 4 block v0.0.1. 5 block v0.1.0. 6 deferrable.*
