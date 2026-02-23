# Thought Tracing System — Technical Specification

> **Version:** 0.2.0 | **Date:** 2026-02-23 | **Status:** Implementation-Ready
> **PDSA:** [2026-02-19-agent-memory.pdsa.md](../pdsa/2026-02-19-agent-memory.pdsa.md)

---

## How to Read This Document

This is a **technical blueprint** for a developer building the system. Read sections 1-10 sequentially — each builds on the previous. Section 2 defines what exists today. Sections 3-4 define what to build. Section 5 defines the data model. Sections 6-8 define runtime behavior. Section 9 defines the build order (phases with explicit dependencies). Section 10 lists related documents for background context only — everything needed to build is in this file.

**Conventions:**
- All examples show exact JSON shapes. Implement as shown.
- `MVP` = build now (Phases 1-4). `Post-MVP` = build later (clearly labeled, skip during implementation).
- Error responses follow a single schema defined in Section 3.1.

---

## 1. Overview

Transform the existing best-practices API (`localhost:3200`) from a basic semantic search tool into a **self-organizing knowledge substrate** where:

1. Thoughts become discoverable through semantic proximity
2. Usage is tracked — every retrieval reinforces, every hour without access decays
3. Highways form — frequently accessed thoughts become prominent
4. Provenance is preserved — every thought traces back to its originator
5. Retrieval IS contribution — every query reshapes the knowledge landscape

**Agent-facing interface:** A single conversational endpoint (`POST /api/v1/memory`). Agents send natural language. The system handles everything internally.

**Internal endpoints:** `/think`, `/retrieve`, `/highways` — called by the `/memory` endpoint, never by agents.

**Existing endpoints preserved:** `/api/v1/query`, `/api/v1/ingest`, `/api/v1/health` continue to work unchanged.

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
- `queries` (deprecated — replaced by SQLite `query_log` in this spec)

**Not present:** No provenance, no access logging, no pheromone, no co-retrieval, no agent integration, no background jobs.

---

## 3. Agent-Facing Interface: `POST /api/v1/memory`

### 3.1 Error Response Schema

All endpoints use this error format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "prompt is required and must be a non-empty string"
  }
}
```

| HTTP Status | Code | When |
|-------------|------|------|
| 400 | `VALIDATION_ERROR` | Missing required fields, invalid types, empty strings |
| 400 | `INVALID_THOUGHT_TYPE` | `thought_type` not in `["original", "refinement", "consolidation"]` |
| 400 | `MISSING_SOURCE_IDS` | `thought_type` is `refinement` or `consolidation` but `source_ids` is empty |
| 404 | `THOUGHT_NOT_FOUND` | Referenced `thought_id` or `source_id` does not exist in `thought_space` |
| 404 | `SESSION_NOT_FOUND` | `session_id` provided but not found in `query_log` |
| 500 | `EMBEDDING_FAILED` | Embedding model returned an error |
| 500 | `QDRANT_ERROR` | Qdrant connection or query failed |
| 500 | `INTERNAL_ERROR` | Unexpected server error |

### 3.2 Design Principle

Agents talk to memory like talking to a brain. They don't know about /think, /retrieve, or /highways. They send a prompt and get a response. The system decides what to do internally.

### 3.3 Request

```json
{
  "prompt": "What do you know about role separation in multi-agent systems?",
  "agent_id": "agent-dev-002",
  "agent_name": "DEV Agent",
  "context": "I'm implementing a new agent workflow and want to avoid coordination failures.",
  "session_id": "session-uuid-optional"
}
```

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `prompt` | string | Yes | Non-empty, max 10000 chars | Natural language — question, insight, reflection, anything |
| `agent_id` | string | Yes | Non-empty, max 100 chars | Who is talking (e.g. `"agent-dev-002"`) |
| `agent_name` | string | Yes | Non-empty, max 200 chars | Human-readable name (e.g. `"DEV Agent"`) |
| `context` | string | No | Max 2000 chars | What the agent is currently working on. Changes retrieval direction. |
| `session_id` | string | No | UUID format | Continue a previous session (for feedback loop and multi-turn) |

### 3.4 Every Call Retrieves

There is no intent classifier. Every call to `/memory` triggers retrieval. The only question is whether the prompt ALSO gets stored as a thought.

### 3.5 Contribution Threshold

The prompt is stored as a thought when ALL of the following are true:

1. **Length:** `prompt.length > 50`
2. **Not purely interrogative:** Prompt does NOT match pattern `^[^.!]*\?$` (single sentence ending in `?` with no periods or exclamation marks before it)
3. **Not a follow-up reference:** Prompt does NOT start with (case-insensitive): `"based on"`, `"you said"`, `"you told me"`, `"regarding your"`, `"about your response"`

Implementation: three checks, ~10 lines of code. No LLM, no classifier.

When the threshold is met, the prompt is stored via the internal `/think` endpoint with `thought_type: "original"`. Tags are extracted from the prompt by splitting on common topic indicators (see Section 3.8).

When the threshold is NOT met, the prompt is used only for retrieval. It still appears in `query_log`.

### 3.6 Context Handling

The `context` field modifies behavior in three concrete ways:

| Use | Implementation |
|-----|---------------|
| **Embedding** | If `context` is provided, embed `context + " " + prompt` (concatenated string). If absent, embed `prompt` alone. This means two agents asking "role separation" from different contexts get different retrieval results. |
| **Storage** | If prompt is stored as a thought, `context` is saved in `context_metadata` field (NOT embedded — stored as provenance metadata). |
| **Analytics** | Both `context` and `prompt` are written to `query_log` for trajectory analysis. |

### 3.7 Response: Result + Trace

```json
{
  "result": {
    "response": "Based on collective knowledge, role boundaries prevent coordination collapse...",
    "sources": [
      {"thought_id": "uuid-1", "contributor": "PDSA Agent", "score": 0.87, "content_preview": "Role boundaries prevent..."},
      {"thought_id": "uuid-3", "contributor": "QA Agent", "score": 0.72, "content_preview": "Testing requires..."}
    ],
    "highways_nearby": ["role-separation (12 accesses, 4 agents)"],
    "disambiguation": null,
    "guidance": null
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

| Field | Location | Description |
|-------|----------|-------------|
| `result.response` | Agent reads this | Natural language summary of retrieved thoughts. For MVP: concatenate top-3 `content` fields with attribution. |
| `result.sources` | Agent reads this | Array of retrieved thoughts with IDs, contributors, scores, and first 80 chars of content. |
| `result.highways_nearby` | Agent reads this | Strings describing high-traffic thoughts related to the query. Empty array if none. |
| `result.disambiguation` | Agent reads this | Non-null when query is ambiguous (see Section 3.8). |
| `result.guidance` | Agent reads this | Non-null for new agents (see Section 3.9). Null otherwise. |
| `trace.session_id` | System logs this | UUID. Generated if not provided in request. Used for feedback loop. |
| `trace.operations` | System logs this | List of operations performed: `"retrieve"`, `"reinforce"`, `"contribute"`, `"disambiguate"`, `"onboard"`. |
| `trace.thoughts_retrieved` | System logs this | Count of thoughts returned. |
| `trace.thoughts_contributed` | System logs this | 0 or 1. |
| `trace.contribution_threshold_met` | System logs this | Boolean. |
| `trace.context_used` | System logs this | Boolean — whether context field was provided. |
| `trace.retrieval_method` | System logs this | `"vector"` for MVP. Future: `"tree"`, `"hybrid"`. |

### 3.8 Disambiguation

When retrieval returns 10+ results AND the results span 3+ distinct tag values:

1. Group results by `tags` field values
2. Count results per tag
3. Set `result.disambiguation`:

```json
{
  "total_found": 23,
  "clusters": [
    {"tag": "system-architecture", "count": 12},
    {"tag": "org-architecture", "count": 6},
    {"tag": "data-architecture", "count": 3},
    {"tag": "security-architecture", "count": 2}
  ]
}
```

4. Set `result.response` to: `"I found {total} thoughts across {n} areas: {tag1} ({count1}), {tag2} ({count2}), ... Which area interests you?"`
5. Return top-5 results from the largest cluster as `result.sources` (agent still gets useful results)

When the agent follows up with `session_id` and a clarifying prompt (e.g., "system architecture"), filter retrieval to thoughts tagged with the selected tag.

**Tag extraction for new thoughts:** When storing a thought, extract tags by:
1. Match prompt against existing tag values in `thought_space` (case-insensitive substring match)
2. If no matches, store with empty tags array — tags accumulate organically as the collection grows

### 3.9 Guided Intake: New Agent Onboarding

When `agent_id` has zero entries in `query_log`:

1. Set `result.guidance` to: `"Welcome! I haven't seen you before. I'll track your interests as you interact. Ask me anything or share what you're learning."`
2. Still perform normal retrieval (return results as usual)
3. Log the onboarding event in `trace.operations` as `"onboard"`

This is NOT a blocker. The agent gets results AND a welcome message. After the first interaction, `guidance` is null for all subsequent calls.

### 3.10 Feedback Loop

**Implicit (MVP):** When a prompt is stored as a thought (contribution threshold met) AND `session_id` matches a previous query:
1. Look up `returned_ids` from the matching `query_log` entry
2. Apply bonus reinforcement to those thoughts: `pheromone_weight += 0.02` (half of normal retrieval reinforcement)
3. Log `"feedback_implicit"` in `trace.operations`

This means: "I contributed something after you showed me these thoughts" = implicit signal that those thoughts were useful.

**Explicit (post-MVP):** `POST /api/v1/memory/feedback` — not built in MVP. Documented here for schema planning only:
```json
{
  "session_id": "session-uuid",
  "thought_id": "uuid-1",
  "signal": "useful"
}
```

---

## 4. Internal Endpoints

These are called by the `/memory` endpoint. Agents never call them directly. They are implemented as internal functions, not necessarily as HTTP routes — the developer may implement them as functions called within the `/memory` handler. If implemented as routes, they should NOT be documented or exposed in any API docs.

### 4.1 `think(params)` — Store a Thought

**Input:**
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

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `content` | string | Yes | Non-empty, max 10000 chars | The thought in clear language |
| `contributor_id` | string | Yes | Non-empty | Who contributed |
| `contributor_name` | string | Yes | Non-empty | Human-readable name |
| `thought_type` | enum | Yes | One of: `"original"`, `"refinement"`, `"consolidation"` | Type of thought |
| `source_ids` | UUID[] | Yes | Non-empty if type is `refinement` or `consolidation` | Parent thoughts |
| `tags` | string[] | Yes | Array (may be empty) | Topic tags |
| `context_metadata` | string | No | Max 2000 chars | Provenance — not embedded |

**Behavior:**
1. Embed `content` using all-MiniLM-L6-v2
2. Generate UUID for the thought
3. Upsert to `thought_space` collection with full payload (see Section 5.1)
4. Return `{ thought_id: "uuid", pheromone_weight: 1.0 }`

**Errors:** 400 if validation fails. 500 if embedding or Qdrant fails. Use error codes from Section 3.1.

### 4.2 `retrieve(params)` — Search + Reinforce

**Input:**
```json
{
  "query_embedding": [0.1, 0.2, "... 384 floats"],
  "agent_id": "agent-dev-002",
  "session_id": "session-uuid",
  "limit": 10,
  "filter_tags": []
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `query_embedding` | float[] | Yes | — | 384-dim embedding vector |
| `agent_id` | string | Yes | — | Who is retrieving |
| `session_id` | string | Yes | — | Session UUID for logging |
| `limit` | integer | No | 10 | Max results (range 1-50) |
| `filter_tags` | string[] | No | `[]` | Filter to thoughts with any of these tags. Empty = no filter. |

**Behavior (every call):**
1. Search `thought_space` by cosine similarity (top `limit` results, min score 0.0)
2. For each returned result:
   - `access_count += 1`
   - `pheromone_weight = min(10.0, pheromone_weight + 0.05)`
   - `last_accessed = now()`
   - Append `agent_id` to `accessed_by` (deduplicated)
   - Append `{"user_id": agent_id, "timestamp": now(), "session_id": session_id}` to `access_log` (cap at 100 entries — remove oldest when full)
3. Update `co_retrieved_with` for ALL pairs in the result set:
   - For thoughts A and B both in results: increment co-retrieval count for the pair
   - Cap at 50 entries per thought — remove lowest-count pair when full
4. Insert row into SQLite `query_log`
5. Return array of results with `thought_id`, `content`, `contributor_name`, `score`, `pheromone_weight`, `tags`

**Errors:** 500 if Qdrant fails. Use error codes from Section 3.1.

### 4.3 `highways(params)` — Emerging Patterns

**Input (query params if implemented as route):**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `min_access` | integer | 3 | Minimum access_count |
| `min_users` | integer | 2 | Minimum unique users in accessed_by |
| `limit` | integer | 20 | Max results (range 1-100) |

**Behavior:**
1. Scroll `thought_space` collection with filter: `access_count >= min_access`
2. Post-filter: `accessed_by.length >= min_users`
3. Sort by `traffic_score = access_count * accessed_by.length` (descending)
4. Return top `limit` results

**Returns:**
```json
[
  {
    "thought_id": "uuid",
    "content_preview": "First 80 chars of thought...",
    "access_count": 15,
    "unique_users": 4,
    "traffic_score": 60,
    "pheromone_weight": 3.2,
    "tags": ["role-separation"]
  }
]
```

**Errors:** 500 if Qdrant fails. Use error codes from Section 3.1.

---

## 5. Data Model

### 5.1 Qdrant Collection: `thought_space`

**Vector:** 384-dim, cosine distance, using `all-MiniLM-L6-v2`

**Collection creation params:**
```json
{
  "vectors": { "size": 384, "distance": "Cosine" },
  "optimizers_config": { "default_segment_number": 2 },
  "replication_factor": 1
}
```

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

**Payload indexes (create after collection):**

| Field | Index Type | Purpose |
|-------|-----------|---------|
| `contributor_id` | keyword | Filter by contributor |
| `created_at` | datetime | Time-range queries |
| `access_count` | integer | Highway detection filter |
| `last_accessed` | datetime | Decay job efficiency |
| `thought_type` | keyword | Filter by type |
| `tags` | keyword | Tag-based filtering + disambiguation |
| `pheromone_weight` | float | Sort by prominence |
| `knowledge_space_id` | keyword | Multi-space filtering (post-MVP) |

### 5.2 SQLite Tables

```sql
CREATE TABLE IF NOT EXISTS query_log (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  query_text TEXT NOT NULL,
  context_text TEXT,
  query_vector BLOB,
  returned_ids TEXT NOT NULL DEFAULT '[]',  -- JSON array of thought UUIDs
  session_id TEXT NOT NULL,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  result_count INTEGER NOT NULL DEFAULT 0,
  knowledge_space_id TEXT NOT NULL DEFAULT 'ks-default'
);

CREATE INDEX IF NOT EXISTS idx_query_log_agent ON query_log(agent_id);
CREATE INDEX IF NOT EXISTS idx_query_log_session ON query_log(session_id);
CREATE INDEX IF NOT EXISTS idx_query_log_timestamp ON query_log(timestamp);
```

---

## 6. Pheromone Model

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Initial weight | 1.0 | Neutral starting point |
| Reinforcement per access | +0.05 | Small enough that single access doesn't dominate |
| Implicit feedback bonus | +0.02 | Half of retrieval reinforcement — weaker signal |
| Ceiling | 10.0 | Max 10x baseline prominence |
| Decay rate | 0.995 per hour | ~11% per day, ~50% per week, floor in ~1 month |
| Floor | 0.1 | Never fully invisible |

**Reinforcement (in retrieve):** `weight = min(10.0, weight + 0.05)` — applied to every thought returned by a retrieval call.

**Implicit feedback (in /memory):** `weight = min(10.0, weight + 0.02)` — applied when a contribution references a previous session (see Section 3.10).

**Decay (background job):** `weight = max(0.1, weight * 0.995)` — applied hourly to all thoughts where `last_accessed` is older than 1 hour.

---

## 7. Retrieval Strategy

### MVP: Vector Search Only

For MVP, all retrieval uses cosine similarity search against `thought_space`. This is sufficient for collections under 500 thoughts.

**Retrieval flow (MVP):**
1. Embed query (with context if provided) using all-MiniLM-L6-v2
2. Search `thought_space` by cosine similarity
3. Apply tag filter if `filter_tags` is non-empty
4. Apply pheromone reinforcement to results
5. Return results sorted by score

### Post-MVP: Hybrid Tree Navigation + Vector Search

When `thought_space` exceeds 500 thoughts, hybrid retrieval becomes valuable. This section is for future reference only — do not build during MVP.

**Tree index:** Auto-generated hierarchical topic tree (JSON) as background job. Updated daily or every 100 new thoughts.

**Hybrid flow:** LLM reasons over tree → identifies branches → vector search within branches → pheromone weighting → results with navigation trace.

**Heterogeneous routing:** Different queries route to different retrieval strategies (vector for unexpected connections, tree for structured domain answers, pheromone for collectively validated knowledge).

---

## 8. Background Jobs

| Job | Schedule | Implementation | Phase |
|-----|----------|---------------|-------|
| Pheromone decay | Every 60 minutes | `setInterval` in Fastify. Scroll all `thought_space` points where `last_accessed < (now - 1 hour)`. Update `pheromone_weight = max(0.1, weight * 0.995)`. | Phase 2 |
| Highway detection | On-demand | Computed when `/memory` response includes `highways_nearby`. No background job needed for MVP — query at response time with `access_count >= 3 AND accessed_by.length >= 2`. | Phase 4 |

**Implementation:** Use `setInterval` in the Fastify process. No external scheduler needed. Sufficient for single-instance deployment on CX22.

---

## 9. Implementation Phases

### Phase 1: Foundation (Week 1)

**Depends on:** Nothing. Start here.

**Build:**
1. Create `thought_space` Qdrant collection with payload indexes (Section 5.1)
2. Create SQLite `query_log` table (Section 5.2)
3. Implement `think()` function (Section 4.1) — embed content, upsert to Qdrant
4. Implement `retrieve()` function (Section 4.2) — search by cosine, return results. Skip access tracking and pheromone for now.
5. Verify existing `/query`, `/ingest`, `/health` endpoints still work

**Acceptance test:** Call `think()` with a thought → call `retrieve()` with a related query → thought appears in results.

### Phase 2: Tracing + Pheromone (Week 2)

**Depends on:** Phase 1 (think and retrieve must exist).

**Build:**
1. Add access tracking to `retrieve()`: increment `access_count`, update `accessed_by`, append to `access_log` (cap 100), update `last_accessed`
2. Add co-retrieval tracking: update `co_retrieved_with` for all result pairs (cap 50)
3. Add pheromone reinforcement to `retrieve()`: `weight = min(10.0, weight + 0.05)`
4. Implement pheromone decay job: `setInterval(decay, 60 * 60 * 1000)` — scroll and update
5. Add session ID generation: `crypto.randomUUID()`
6. Write retrieval results to `query_log`

**Acceptance test:** Retrieve the same thought 5 times → `access_count` is 5, `pheromone_weight` is 1.25. Run decay job → weight decreases.

### Phase 3: Conversational Interface (Week 3)

**Depends on:** Phase 2 (access tracking and pheromone must work).

**Build:**
1. Implement `POST /api/v1/memory` route (Section 3)
2. Implement contribution threshold (Section 3.5) — three checks
3. Implement context concatenation for embedding (Section 3.6)
4. Implement response formatting — `result` + `trace` (Section 3.7)
5. Implement disambiguation (Section 3.8) — tag grouping when 10+ results, 3+ tags
6. Implement new agent detection (Section 3.9) — check `query_log` for `agent_id`
7. Implement implicit feedback (Section 3.10) — bonus reinforcement on session follow-ups
8. Implement error responses (Section 3.1)

**Acceptance test:** Agent sends question → gets `result` with sources + `trace`. Agent sends insight (>50 chars, declarative) → thought is stored AND related thoughts returned. New agent gets welcome guidance.

### Phase 4: Visibility + Polish (Week 4)

**Depends on:** Phase 3 (conversational interface must work).

**Build:**
1. Implement `highways()` function (Section 4.3)
2. Wire highways into `/memory` response: query highways on each call, populate `result.highways_nearby` with formatted strings
3. Tag extraction for stored thoughts (Section 3.8 — match against existing tags)
4. End-to-end test: PDSA agent contributes a thought → DEV agent retrieves it → highway forms after repeated access

**Acceptance test:** After 10+ multi-agent interactions, `highways_nearby` returns the most-trafficked thoughts.

### Post-MVP (Not Part of This Build)

- Explicit feedback endpoint (`POST /api/v1/memory/feedback`)
- Tree index generation (PageIndex-informed background job)
- Hybrid retrieval (tree navigation + vector + pheromone)
- PageIndex MCP for PDSA document retrieval
- Cryptographic access control (see [security reflection in PDSA](../pdsa/2026-02-19-agent-memory.pdsa.md))

---

## 10. Decisions Made

| Decision | Chosen | Rationale |
|----------|--------|-----------|
| Embedding model | 384-dim all-MiniLM-L6-v2 | Already deployed, sufficient quality, low RAM |
| Runtime | Fastify + TypeScript | Existing codebase, no rewrite needed |
| Collections | Separate `best_practices` + `thought_space` | Different access patterns, backward compatible |
| Query logging | SQLite `query_log` | Structured analytics, cheaper than Qdrant |
| Agent interface | Conversational `POST /memory` | Agents don't need API knowledge |
| Store decision | Heuristic contribution threshold | 10 lines of code, no LLM dependency |
| Feedback loop | Implicit via session follow-ups (MVP) | No extra endpoint, naturally emerges from usage |
| Retrieval strategy | Vector search only (MVP) | Sufficient for <500 thoughts |
| Security | Deferred to post-MVP | Focus on core functionality first |

---

## 11. Related Documents

Background context only. Everything needed to build is in this file.

- [PDSA: Agent Memory Research](../pdsa/2026-02-19-agent-memory.pdsa.md) — research trajectory (11 iterations)
- [Rework Feedback](../pdsa/rework-feedback-iteration-10.md) — Thomas's iteration 10 feedback with PageIndex analysis
- [02-CORE-ARCHITECTURE](02-CORE-ARCHITECTURE.md) — 5-phase data flow
- [03-AGENT-GUIDELINES](03-AGENT-GUIDELINES.md) — Thought unit schema, agent lifecycle
- [04-VECTOR-DB-AND-GRAPH-STRATEGY](04-VECTOR-DB-AND-GRAPH-STRATEGY.md) — Qdrant config, search patterns
- [06-INTEGRATION-SPEC](06-INTEGRATION-SPEC.md) — Docker stack, API endpoints
- [08-MULTI-AGENT-ACCESS-LAYER](08-MULTI-AGENT-ACCESS-LAYER.md) — Guided intake, context bean
