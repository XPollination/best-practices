# Thought Tracing System — Buildable Specification

> **Status:** Draft (extracted from PDSA iterations 9-11)
> **Version:** 0.1.0 | **Date:** 2026-02-23
> **PDSA:** [2026-02-19-agent-memory.pdsa.md](../pdsa/2026-02-19-agent-memory.pdsa.md)

---

## 1. Overview

Transform the existing best-practices API (`localhost:3200`) from a basic semantic search tool into a **self-organizing knowledge substrate** where:

1. Thoughts become discoverable through semantic proximity
2. Usage is tracked — every retrieval reinforces, every hour without access decays
3. Highways form — frequently accessed thoughts become prominent
4. Provenance is preserved — every thought traces back to its originator
5. Retrieval IS contribution — every query reshapes the knowledge landscape

**Agent-facing interface:** A single conversational endpoint (`POST /api/v1/memory`). Agents send natural language. The system handles everything internally.

**Internal endpoints:** `/think`, `/retrieve`, `/highways` — implementation details, not agent-facing.

---

## 2. Current State

**Server:** Fastify + Node.js (TypeScript) at `localhost:3200` and `https://bestpractice.xpollination.earth/`

| Endpoint | Method | Behavior |
|----------|--------|----------|
| `/api/v1/query` | POST | Semantic search over `best_practices` collection. Top-5 by cosine similarity. |
| `/api/v1/ingest` | POST | Store content. No provenance, no thought_type. |
| `/api/v1/health` | GET | Qdrant connectivity + point counts. |

**Embedding:** `Xenova/all-MiniLM-L6-v2` (384-dim, cosine, HuggingFace Transformers.js)

**Qdrant Collections:**
- `best_practices` (~20 chunks, seeded from markdown)
- `queries` (search query embeddings for analytics — to be deprecated, replaced by SQLite)

**Not present:** No provenance, no access logging, no pheromone, no co-retrieval, no agent integration, no background jobs.

**Existing endpoints are preserved.** All new functionality is additive.

---

## 3. Agent-Facing Interface: `POST /api/v1/memory`

### Design Principle

Agents talk to memory like talking to a brain. They don't know about /think, /retrieve, or /highways. They send a prompt and get a response. The system decides what to do internally.

### Request

```json
{
  "prompt": "What do you know about role separation in multi-agent systems?",
  "agent_id": "agent-dev-002",
  "agent_name": "DEV Agent",
  "context": "I'm implementing a new agent workflow and want to avoid coordination failures.",
  "session_id": "session-uuid-optional"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `prompt` | string | Yes | Natural language — question, insight, reflection, anything |
| `agent_id` | string | Yes | Who is talking |
| `agent_name` | string | Yes | Human-readable name |
| `context` | string | No | What the agent is currently working on. Changes retrieval direction. |
| `session_id` | string | No | Continue a previous session (for feedback loop) |

### Every Call Retrieves

There is no intent classifier. Every call to `/memory` triggers retrieval. The question is only whether the prompt ALSO gets stored as a thought.

**Contribution threshold:** The prompt is stored as a thought if:
- Length > 50 characters AND
- Contains declarative content (not purely interrogative) AND
- Isn't a follow-up reference ("Based on what you told me...")

This is a simple heuristic. Not a classifier. Not an LLM decision. A few lines of code.

### Context Handling

The `context` field is not decoration — it's the most valuable input for the pheromone model:

| Use | How |
|-----|-----|
| **Embedding** | Concatenate `context + prompt` before embedding. Context provides direction, prompt provides specificity. Two agents asking "role separation" from different contexts get different results. |
| **Storage** | If prompt is stored as a thought, context becomes metadata (not embedded content). Preserved for provenance. |
| **Analytics** | Context + prompt pairs in query_log enable trajectory analysis. |

### Response: Result + Trace

Two clean sections for two audiences:

```json
{
  "result": {
    "response": "Based on collective knowledge, role boundaries prevent coordination collapse...",
    "sources": [
      {"thought_id": "uuid-1", "contributor": "PDSA Agent", "score": 0.87},
      {"thought_id": "uuid-3", "contributor": "QA Agent", "score": 0.72}
    ],
    "highways_nearby": ["role-separation (12 accesses, 4 agents)"],
    "disambiguation": null
  },
  "trace": {
    "session_id": "session-uuid",
    "operations": ["retrieve", "reinforce"],
    "thoughts_retrieved": 3,
    "thoughts_contributed": 0,
    "contribution_threshold_met": false,
    "context_used": true,
    "retrieval_method": "vector"
  }
}
```

- **`result`** — what the agent needs. Natural language response + sources for provenance.
- **`trace`** — what the system logs. Operations performed, counts, reasoning path. Agent can ignore. Monitoring reads both. Future-proofs for pheromone visualization.

### Guided Intake

The conversational interface IS the guided intake from [spec 08](08-MULTI-AGENT-ACCESS-LAYER.md).

**New agent onboarding:**
- System detects `agent_id` not in any `space_memberships`
- Returns in `result.response`: "I don't recognize you yet. What knowledge space are you working in?"
- This IS onboarding. No documentation needed.

**Ambiguous queries:**
- Agent sends: "stuff about architecture"
- `result.disambiguation`: `{"found": 23, "clusters": [{"tag": "system-architecture", "count": 12}, {"tag": "org-architecture", "count": 6}, {"tag": "data-architecture", "count": 3}, {"tag": "security-architecture", "count": 2}]}`
- `result.response`: "I found 23 thoughts about architecture across 4 areas: system-architecture (12), org-architecture (6), data-architecture (3), security-architecture (2). Which area?"

**Multi-turn via dialogue_state:**
- `session_id` enables continuation. Agent follows up: "system architecture" → system filters to that cluster.
- MVP: return results with disambiguation notes. Agent sends clarified prompt in next call with same `session_id`.

### Feedback Loop

**Implicit MVP:** If an agent sends a follow-up prompt referencing a session ("Based on what you told me, I built X and it worked"), system infers positive reinforcement for previously retrieved thoughts in that session. No explicit feedback API — follow-up contributions ARE implicit confirmation.

**Explicit (post-MVP):** `POST /api/v1/memory/feedback`
```json
{
  "session_id": "session-uuid",
  "thought_id": "uuid-1",
  "signal": "useful"
}
```
Useful thoughts get bonus reinforcement. Irrelevant get dampened. Beginning of RL policy ([layer 7](../feedback/agent-memory/12-DEEP-DIVE-THINKING-INFRASTRUCTURE-ITER3.md)).

---

## 4. Internal Endpoints

These are implementation details. Agents never call them directly. The `/memory` endpoint calls them internally.

### `POST /api/v1/think` — Store a Thought (Internal)

```json
{
  "content": "Role boundaries prevent coordination collapse.",
  "contributor_id": "agent-pdsa-001",
  "contributor_name": "PDSA Agent",
  "thought_type": "original",
  "source_ids": [],
  "tags": ["multi-agent", "role-separation"],
  "context_metadata": "Working on agent workflow design"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `content` | string | Yes | The thought in clear language |
| `contributor_id` | string | Yes | Who contributed |
| `contributor_name` | string | Yes | Human-readable name |
| `thought_type` | enum | Yes | `"original"`, `"refinement"` (requires source_ids), `"consolidation"` (requires source_ids) |
| `source_ids` | UUID[] | Conditional | Parent thoughts for refinements/consolidations |
| `tags` | string[] | No | Topic tags |
| `context_metadata` | string | No | What the agent was working on (not embedded, stored for provenance) |

**Returns:** `{ thought_id, pheromone_weight: 1.0 }`

### `POST /api/v1/retrieve` — Search + Reinforce (Internal)

```json
{
  "query_embedding": [0.1, 0.2, ...],
  "agent_id": "agent-dev-002",
  "limit": 10,
  "exclude_self": false,
  "min_score": 0.0,
  "filter_tags": []
}
```

**Behavior (every call):**
1. Search `thought_space` by cosine similarity
2. For each result:
   - `access_count += 1`
   - `pheromone_weight = min(10.0, pheromone_weight + 0.05)`
   - `last_accessed = now()`
   - Append agent_id to `accessed_by`
   - Append `{user_id, timestamp, session_id}` to `access_log` (cap 100)
   - Update `co_retrieved_with` for all result pairs (cap 50)
3. Log to SQLite `query_log`

### `GET /api/v1/highways` — Emerging Patterns (Internal)

Query params: `min_access` (default 3), `min_users` (default 2), `limit` (default 20), `sort_by` (`"traffic"`, `"pheromone"`, `"recent"`)

**Returns:** Thoughts sorted by traffic_score (access_count × unique_users).

---

## 5. Data Model

### Qdrant Collection: `thought_space`

**Vector:** 384-dim (all-MiniLM-L6-v2) — keep current model for MVP

**Payload per point:**
```json
{
  "contributor_id": "agent-pdsa-001",
  "contributor_name": "PDSA Agent",
  "content": "The actual thought text",
  "context_metadata": "What agent was working on when contributing",
  "created_at": "2026-02-23T15:00:00Z",
  "thought_type": "original",
  "source_ids": [],
  "tags": ["multi-agent", "role-separation"],

  "access_count": 0,
  "last_accessed": null,
  "accessed_by": [],
  "access_log": [],
  "co_retrieved_with": [],
  "pheromone_weight": 1.0,

  "knowledge_space_id": "ks-default"
}
```

**Payload indexes:**
| Field | Index Type | Purpose |
|-------|-----------|---------|
| `contributor_id` | KEYWORD | Filter by contributor |
| `created_at` | DATETIME | Time-range queries |
| `access_count` | INTEGER | Highway detection |
| `last_accessed` | DATETIME | Decay job efficiency |
| `thought_type` | KEYWORD | Filter by type |
| `tags` | KEYWORD | Tag-based filtering |
| `pheromone_weight` | FLOAT | Sort by prominence |
| `knowledge_space_id` | KEYWORD | Multi-space filtering |

### SQLite Tables

```sql
CREATE TABLE query_log (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  query_text TEXT NOT NULL,
  context_text TEXT,
  query_vector BLOB,
  returned_ids TEXT NOT NULL,  -- JSON array of thought UUIDs
  session_id TEXT NOT NULL,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  result_count INTEGER NOT NULL,
  knowledge_space_id TEXT NOT NULL DEFAULT 'ks-default'
);

CREATE INDEX idx_query_log_agent ON query_log(agent_id);
CREATE INDEX idx_query_log_session ON query_log(session_id);
CREATE INDEX idx_query_log_timestamp ON query_log(timestamp);
```

---

## 6. Pheromone Model

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Initial weight | 1.0 | Neutral starting point |
| Reinforcement per access | +0.05 | Small enough that single access doesn't dominate |
| Ceiling | 10.0 | Max 10× baseline prominence |
| Decay rate | 0.995 per hour | ~11% per day, ~50% per week, floor in ~1 month |
| Floor | 0.1 | Never fully invisible |

**Reinforcement:** On every `/retrieve` call: `weight = min(10.0, weight + 0.05)`

**Decay:** Hourly background job: `weight = max(0.1, weight * 0.995)` for all vectors not accessed in last hour.

**Feedback bonus (post-MVP):** Implicit positive signal from follow-up contributions in same session. Explicit signal from `/memory/feedback` endpoint.

---

## 7. Retrieval Strategy: Hybrid Approach

### Current: Vector Search Only

Embed query → cosine similarity → return top-N. Simple, works for small collections.

### Future: Hybrid Tree Navigation + Vector Search (PageIndex-Informed)

When `thought_space` reaches 50+ thoughts, a richer retrieval strategy becomes valuable. Inspired by [PageIndex](https://github.com/VectifyAI/PageIndex) (vectorless, reasoning-based RAG):

**Tree index over thought_space:**
- Auto-generated hierarchical topic tree (JSON) as background job
- Organized by: topic hierarchy → contributor → thought_type → time
- Updated periodically (every 100 new thoughts or daily)

**Hybrid retrieval flow:**
1. LLM reasons over tree structure → identifies relevant branches
2. Vector search within selected branches → finds specific thoughts
3. Pheromone weighting modifies results within branch
4. Returns results with full navigation trace

**Why this matters:**
- Tree-navigated co-retrieval = high signal (LLM actively decided both thoughts relevant)
- Vector-only co-retrieval = potentially noise (embedding proximity)
- System can weight co-retrieval edges differently by retrieval method
- Retrieval path IS thinking — connects to "reproduce how thinkers arrived at convergence"

**Heterogeneous retrieval routing (future):**
- Some knowledge best found by vector similarity (unexpected connections)
- Some by tree navigation (structured domain answers)
- Some by pheromone prominence (collectively validated)
- Conversational endpoint routes to different strategies, not just different internal endpoints

**For MVP:** Vector search only. Add tree index generation as background job when collection exceeds 50 thoughts. Full hybrid retrieval is post-MVP.

### Practical Addition: PageIndex MCP for PDSA Documents

PDSA documents are the exact use case for PageIndex — long, structured, hierarchical. Instead of chunking and embedding them:
- Use PageIndex MCP integration to index PDSA docs
- Agents query via tree navigation: "What did we learn about pheromone decay in iteration 3?"
- More accurate than embedding-based retrieval for structured documents

This is a separate, practical addition that doesn't depend on the thought_space system.

---

## 8. Background Jobs

| Job | Schedule | What It Does |
|-----|----------|-------------|
| Pheromone decay | Every hour | `weight *= 0.995` for all vectors not accessed in last hour. Floor 0.1. |
| Highway detection | Every 15 min | Scan for access_count >= 3 and unique_users >= 2. (Can compute on-demand for MVP.) |
| Tree index generation | On threshold (50+ thoughts) or daily | Generate hierarchical topic tree from thought_space. Store as JSON. (Post-MVP.) |

**MVP implementation:** `setInterval` in Fastify process. Sufficient for single-instance deployment on CX22.

---

## 9. Gap Analysis

| Capability | Current | Target | Gap |
|-----------|---------|--------|-----|
| Semantic search | ✅ `/query` | ✅ `/retrieve` (internal) | New internal endpoint |
| Content storage | ✅ `/ingest` | ✅ `/think` (internal) | New internal endpoint with provenance |
| Agent interface | ❌ None | ✅ `POST /memory` (conversational) | Conversational layer + contribution threshold |
| Access tracking | ❌ None | ✅ access_count, accessed_by, access_log | Middleware on /retrieve |
| Pheromone model | ❌ None | ✅ +0.05 reinforce, 0.995/hr decay | On /retrieve + hourly job |
| Co-retrieval | ❌ None | ✅ co_retrieved_with | Logic in /retrieve |
| Highway detection | ❌ None | ✅ /highways (internal) | New internal endpoint |
| Background jobs | ❌ None | ✅ Decay + detection | setInterval |
| Thought types | ❌ None | ✅ original/refinement/consolidation | Schema field |
| Source linking | ❌ None | ✅ source_ids | Schema field |
| Context handling | ❌ None | ✅ Concatenation + metadata + analytics | In /memory endpoint |
| Feedback loop | ❌ None | ✅ Implicit (MVP) + explicit (post-MVP) | Session follow-up detection |
| Guided intake | ❌ None | ✅ Onboarding + disambiguation + dialogue_state | In /memory endpoint |
| Query logging | ✅ Qdrant collection | ✅ SQLite table | Migrate |
| Existing endpoints | ✅ /query, /ingest | ✅ Preserved | No change |
| Tree index | ❌ None | ✅ Auto-generated topic tree (post-MVP) | Background job |
| Hybrid retrieval | ❌ None | ✅ Tree nav + vector (post-MVP) | PageIndex integration |

---

## 10. Implementation Phases

### Phase 1: Foundation (Week 1)

1. Create `thought_space` Qdrant collection (384-dim, cosine, payload indexes)
2. Implement internal `POST /think` endpoint
3. Implement internal `POST /retrieve` endpoint (basic — no access tracking yet)
4. Add SQLite `query_log` table
5. Keep existing endpoints working

**Test:** Store a thought via /think, retrieve it via /retrieve.

### Phase 2: Tracing + Pheromone (Week 2)

1. Add access tracking to /retrieve (access_count, accessed_by, access_log, co_retrieved_with)
2. Add pheromone reinforcement (+0.05, cap 10.0)
3. Implement hourly decay job (0.995, floor 0.1)
4. Session ID generation

**Test:** Retrieve same thought 5× → access_count=5, weight=1.25. Wait 24h → weight decayed ~11%.

### Phase 3: Conversational Interface (Week 3)

1. Implement `POST /api/v1/memory` endpoint
   - Contribution threshold (>50 chars, declarative, not follow-up)
   - Context concatenation for embedding
   - Response formatting (result + trace)
2. Guided intake (disambiguation for ambiguous queries)
3. Implicit feedback loop (session follow-up detection)

**Test:** Agent sends question → gets response with sources. Agent sends insight → gets stored + related thoughts returned.

### Phase 4: Visibility + Polish (Week 4)

1. Implement internal `GET /highways`
2. Surface highways in `/memory` response (highways_nearby field)
3. Test with real agents: PDSA contributes → DEV retrieves
4. Document the system (this spec + API examples)

**Test:** After multi-agent usage, /highways returns most-trafficked thoughts.

### Post-MVP

- Explicit feedback endpoint
- Tree index generation (PageIndex-informed)
- Hybrid retrieval (tree nav + vector + pheromone)
- PageIndex MCP for PDSA document retrieval
- Cryptographic access control (see [security reflection](../pdsa/2026-02-19-agent-memory.pdsa.md#item-3-security-architecture-reflection--cryptographic-access-control))

---

## 11. Decisions (for Thomas to Confirm)

| Decision | Rationale | Alternative |
|----------|-----------|-------------|
| Keep 384-dim MiniLM for MVP | Already deployed, sufficient quality, low RAM | Upgrade to BGE-M3 1024-dim |
| Stay with Fastify/TypeScript | Existing codebase | Rewrite in FastAPI/Python |
| Separate collections (best_practices + thought_space) | Different access patterns | Single collection |
| SQLite for query_log | Cheaper for analytics | Keep Qdrant queries collection |
| Conversational interface (POST /memory) | Zero-knowledge pattern for agents | Direct API |
| Contribution threshold (heuristic) | Simple, ~5 lines of code | LLM-based classifier |
| Implicit feedback loop for MVP | No extra endpoint needed | Explicit feedback from start |
| Vector search only for MVP | Sufficient for small collections | Hybrid from start |
| Crypto deferred to post-MVP | Focus on core functionality first | Security from start |

---

## 12. Related Documents

- [PDSA: Agent Memory Research](../pdsa/2026-02-19-agent-memory.pdsa.md) — research trajectory (11 iterations)
- [Rework Feedback](../pdsa/rework-feedback-iteration-10.md) — Thomas's iteration 10 feedback with PageIndex analysis
- [02-CORE-ARCHITECTURE](02-CORE-ARCHITECTURE.md) — 5-phase data flow
- [03-AGENT-GUIDELINES](03-AGENT-GUIDELINES.md) — Thought unit schema, agent lifecycle
- [04-VECTOR-DB-AND-GRAPH-STRATEGY](04-VECTOR-DB-AND-GRAPH-STRATEGY.md) — Qdrant config, search patterns
- [06-INTEGRATION-SPEC](06-INTEGRATION-SPEC.md) — Docker stack, API endpoints
- [08-MULTI-AGENT-ACCESS-LAYER](08-MULTI-AGENT-ACCESS-LAYER.md) — Guided intake, context bean
- [12-DEEP-DIVE-ITER3](../feedback/agent-memory/12-DEEP-DIVE-THINKING-INFRASTRUCTURE-ITER3.md) — 8-layer architecture, pheromone model
- [13-MVP-SPEC-THOUGHT-TRACING](../feedback/agent-memory/13-MVP-SPEC-THOUGHT-TRACING.md) — Original MVP spec
- [14-AGENT-CONTEXT](../feedback/agent-memory/14-AGENT-CONTEXT.md) — Consolidated vision
