# XPollination MVP: Shared Thought Tracing with Provenance

**Implementation Research & Architecture Specification | 2026-02-19**

---

## MVP Definition

### What we're building

A system where **decentralized AI agents share thinking through a vector database**, and the system traces which thoughts get used by others, forming visible "highways" of collective knowledge. Each thought carries provenance — who contributed it — creating the foundation for a future value/token economy.

### What the MVP proves

1. Thoughts from one agent become discoverable by others through semantic proximity (no explicit sharing required)
2. Usage of shared thoughts is tracked — we can see "Agent A's insight is now being used by Agents C, D, F"
3. Highways form — frequently used thought vectors become more prominent
4. Provenance is preserved — every thought traces back to its originator
5. New conclusions (consolidation) link back to source contributions

### What the MVP does NOT include

- Token economy / cryptocurrency layer
- Privacy-preserving federated approach
- Full sleep consolidation engine
- Multi-family pheromone system
- RL-optimized memory policy
- Cross-cluster bridge generation

---

## Core Architecture (4 Components)

```
┌─────────────┐     ┌─────────────────────┐     ┌──────────────────┐
│  Agent API   │────▶│  Observation Layer   │────▶│  Qdrant Vector   │
│  (FastAPI)   │◀────│  (Middleware)        │◀────│  Database         │
└─────────────┘     └─────────────────────┘     └──────────────────┘
                            │                           │
                            ▼                           │
                    ┌──────────────────┐                │
                    │  Analytics &     │◀───────────────┘
                    │  Highway Tracker │
                    └──────────────────┘
```

### Component 1: Qdrant Vector Database

The shared knowledge substrate. Single collection, multi-tenant via payload filtering.

**Collection schema:**

```python
from qdrant_client import QdrantClient, models

client = QdrantClient("localhost", port=6333)

client.create_collection(
    collection_name="thought_space",
    vectors_config=models.VectorParams(
        size=1536,  # OpenAI ada-002 or comparable
        distance=models.Distance.COSINE,
    ),
)

# Payload indexes for efficient filtering and analytics
client.create_payload_index("thought_space", "contributor_id", models.PayloadSchemaType.KEYWORD)
client.create_payload_index("thought_space", "created_at", models.PayloadSchemaType.DATETIME)
client.create_payload_index("thought_space", "access_count", models.PayloadSchemaType.INTEGER)
client.create_payload_index("thought_space", "last_accessed", models.PayloadSchemaType.DATETIME)
client.create_payload_index("thought_space", "thought_type", models.PayloadSchemaType.KEYWORD)
```

**Point payload structure:**

```json
{
  "contributor_id": "agent-alice-001",
  "contributor_name": "Alice",
  "content": "The actual thought text or summary",
  "created_at": "2026-02-19T10:30:00Z",
  "thought_type": "original | refinement | consolidation",
  "source_ids": [],
  "access_count": 0,
  "last_accessed": null,
  "accessed_by": [],
  "access_log": [
    {"user_id": "agent-bob-002", "timestamp": "2026-02-19T11:00:00Z", "session_id": "sess-123"}
  ],
  "co_retrieved_with": [],
  "pheromone_weight": 1.0,
  "tags": ["organizational-design", "systems-thinking"]
}
```

### Component 2: Agent API (FastAPI)

The interface agents use to contribute and retrieve thoughts.

**Three core endpoints:**

```
POST /think          — Contribute a thought (embed + store with provenance)
POST /retrieve       — Search for relevant thoughts (semantic search + logging)
GET  /highways       — See what's trending (most accessed, fastest growing)
```

**POST /think — Contribute a thought:**

```python
@app.post("/think")
async def contribute_thought(request: ThinkRequest):
    # 1. Embed the thought
    embedding = embed(request.content)
    
    # 2. Store with full provenance
    point_id = uuid4()
    client.upsert(
        collection_name="thought_space",
        points=[models.PointStruct(
            id=str(point_id),
            vector=embedding,
            payload={
                "contributor_id": request.agent_id,
                "contributor_name": request.agent_name,
                "content": request.content,
                "created_at": datetime.utcnow().isoformat(),
                "thought_type": request.thought_type or "original",
                "source_ids": request.source_ids or [],
                "access_count": 0,
                "last_accessed": None,
                "accessed_by": [],
                "access_log": [],
                "co_retrieved_with": [],
                "pheromone_weight": 1.0,
                "tags": request.tags or [],
            }
        )]
    )
    
    return {"thought_id": str(point_id), "status": "contributed"}
```

**POST /retrieve — Search with tracking:**

```python
@app.post("/retrieve")
async def retrieve_thoughts(request: RetrieveRequest):
    # 1. Embed the query
    query_embedding = embed(request.query)
    
    # 2. Search — optionally exclude own thoughts
    filter_condition = None
    if request.exclude_self:
        filter_condition = models.Filter(
            must_not=[models.FieldCondition(
                key="contributor_id",
                match=models.MatchValue(value=request.agent_id)
            )]
        )
    
    results = client.query_points(
        collection_name="thought_space",
        query=query_embedding,
        query_filter=filter_condition,
        limit=request.limit or 10,
        with_payload=True,
    )
    
    # 3. Log access on each returned point
    session_id = str(uuid4())
    returned_ids = [r.id for r in results.points]
    
    for point in results.points:
        # Update access metadata
        current_log = point.payload.get("access_log", [])
        current_log.append({
            "user_id": request.agent_id,
            "timestamp": datetime.utcnow().isoformat(),
            "session_id": session_id,
        })
        
        current_accessed_by = point.payload.get("accessed_by", [])
        if request.agent_id not in current_accessed_by:
            current_accessed_by.append(request.agent_id)
        
        # Update co-retrieval partners (other results in same session)
        co_retrieved = point.payload.get("co_retrieved_with", [])
        for other_id in returned_ids:
            if other_id != point.id and str(other_id) not in co_retrieved:
                co_retrieved.append(str(other_id))
        
        client.set_payload(
            collection_name="thought_space",
            payload={
                "access_count": point.payload.get("access_count", 0) + 1,
                "last_accessed": datetime.utcnow().isoformat(),
                "accessed_by": current_accessed_by,
                "access_log": current_log[-100:],  # Keep last 100 entries
                "co_retrieved_with": co_retrieved[-50:],  # Keep last 50
            },
            points=[point.id],
        )
    
    # 4. Log the query itself for highway detection
    await log_query(request.agent_id, query_embedding, returned_ids, session_id)
    
    return {
        "results": [format_result(r) for r in results.points],
        "session_id": session_id,
    }
```

**GET /highways — See emerging thought highways:**

```python
@app.get("/highways")
async def get_highways(min_access: int = 3, min_users: int = 2):
    # Scroll through points ordered by access count
    highways = client.scroll(
        collection_name="thought_space",
        scroll_filter=models.Filter(
            must=[
                models.FieldCondition(
                    key="access_count",
                    range=models.Range(gte=min_access)
                )
            ]
        ),
        order_by=models.OrderBy(key="access_count", direction="desc"),
        limit=50,
        with_payload=True,
    )
    
    result = []
    for point in highways[0]:
        unique_users = len(set(point.payload.get("accessed_by", [])))
        if unique_users >= min_users:
            result.append({
                "thought_id": point.id,
                "content": point.payload["content"],
                "contributor": point.payload["contributor_name"],
                "contributor_id": point.payload["contributor_id"],
                "access_count": point.payload["access_count"],
                "unique_users": unique_users,
                "co_retrieved_with": point.payload.get("co_retrieved_with", []),
                "pheromone_weight": point.payload.get("pheromone_weight", 1.0),
                "created_at": point.payload["created_at"],
                "last_accessed": point.payload["last_accessed"],
            })
    
    return {"highways": result}
```

### Component 3: Observation Middleware

Sits between the API and the database. Its job is to maintain the trace data that makes highways visible.

**Core operations (run asynchronously, don't block requests):**

1. **Access count increment** — Every retrieval increments the point's counter
2. **Accessor tracking** — Records which agents accessed which thoughts
3. **Co-retrieval logging** — Records which thoughts appear together in results
4. **Query vector logging** — Stores query embeddings for later pattern analysis
5. **Pheromone decay** — Periodic job that reduces pheromone_weight on aging vectors

**Pheromone decay cron job (run hourly):**

```python
async def decay_pheromones():
    """Reduce pheromone weight on vectors not recently accessed."""
    decay_rate = 0.995  # per hour — vectors lose ~11% per day without reinforcement
    cutoff = datetime.utcnow() - timedelta(hours=1)
    
    # Scroll all points accessed more than 1 hour ago
    points, offset = client.scroll(
        collection_name="thought_space",
        scroll_filter=models.Filter(
            must=[models.FieldCondition(
                key="last_accessed",
                range=models.Range(lt=cutoff.isoformat())
            )]
        ),
        limit=1000,
        with_payload=["pheromone_weight"],
    )
    
    for point in points:
        current = point.payload.get("pheromone_weight", 1.0)
        new_weight = max(0.1, current * decay_rate)  # Floor at 0.1
        client.set_payload(
            collection_name="thought_space",
            payload={"pheromone_weight": new_weight},
            points=[point.id],
        )
```

**Pheromone reinforcement (on each retrieval):**

```python
def reinforce_pheromone(point_id, current_weight):
    """Boost pheromone when a thought is accessed."""
    boost = 0.05  # Each access adds 5%
    new_weight = min(10.0, current_weight + boost)  # Ceiling at 10x
    client.set_payload(
        collection_name="thought_space",
        payload={"pheromone_weight": new_weight},
        points=[point_id],
    )
```

### Component 4: Analytics & Highway Tracker

Runs periodic analysis on accumulated trace data. For the MVP, this is a scheduled job, not real-time streaming.

**Highway detection (run every 15 minutes):**

```python
async def detect_highways():
    """Identify emerging highways — thoughts gaining traction across users."""
    
    # 1. Find thoughts with accelerating access
    recent_window = datetime.utcnow() - timedelta(hours=6)
    
    # Use Qdrant facets to find most-accessed contributors
    facets = client.facet(
        collection_name="thought_space",
        key="contributor_id",
    )
    
    # 2. Find cross-user convergence
    # Thoughts accessed by 3+ different agents in last 6 hours
    highways = []
    points, _ = client.scroll(
        collection_name="thought_space",
        scroll_filter=models.Filter(
            must=[models.FieldCondition(
                key="access_count",
                range=models.Range(gte=3)
            )]
        ),
        limit=200,
        with_payload=True,
    )
    
    for point in points:
        accessed_by = point.payload.get("accessed_by", [])
        if len(set(accessed_by)) >= 3:
            highways.append({
                "id": point.id,
                "content_preview": point.payload["content"][:200],
                "contributor": point.payload["contributor_name"],
                "user_count": len(set(accessed_by)),
                "total_accesses": point.payload["access_count"],
                "pheromone": point.payload["pheromone_weight"],
            })
    
    return sorted(highways, key=lambda h: h["user_count"] * h["total_accesses"], reverse=True)
```

**Contribution impact report:**

```python
async def contribution_report(contributor_id: str):
    """How much impact has this contributor's thinking had?"""
    
    points, _ = client.scroll(
        collection_name="thought_space",
        scroll_filter=models.Filter(
            must=[models.FieldCondition(
                key="contributor_id",
                match=models.MatchValue(value=contributor_id)
            )]
        ),
        limit=1000,
        with_payload=True,
    )
    
    total_thoughts = len(points)
    total_accesses = sum(p.payload.get("access_count", 0) for p in points)
    unique_consumers = set()
    for p in points:
        unique_consumers.update(p.payload.get("accessed_by", []))
    unique_consumers.discard(contributor_id)  # Don't count self-access
    
    highway_thoughts = [p for p in points if p.payload.get("access_count", 0) >= 3
                        and len(set(p.payload.get("accessed_by", []))) >= 2]
    
    return {
        "contributor_id": contributor_id,
        "total_thoughts_contributed": total_thoughts,
        "total_times_accessed_by_others": total_accesses,
        "unique_agents_served": len(unique_consumers),
        "thoughts_that_became_highways": len(highway_thoughts),
        "top_thoughts": sorted(
            [{"id": p.id, "content": p.payload["content"][:100],
              "accesses": p.payload["access_count"],
              "users": len(set(p.payload.get("accessed_by", [])))}
             for p in points],
            key=lambda t: t["accesses"], reverse=True
        )[:10],
    }
```

---

## Thought Lifecycle in the MVP

```
1. CONTRIBUTE
   Agent Alice has an insight → POST /think
   → Embedded, stored with Alice's provenance
   → pheromone_weight = 1.0, access_count = 0

2. DISCOVER
   Agent Bob queries a related topic → POST /retrieve
   → Alice's thought appears in results (semantic proximity)
   → access_count = 1, accessed_by = ["bob"]
   → pheromone_weight += 0.05

3. SPREAD
   Agent Carol queries similar topic → POST /retrieve
   → Alice's thought appears again (now slightly boosted by pheromone)
   → access_count = 2, accessed_by = ["bob", "carol"]
   
4. HIGHWAY FORMS
   Agents Dave, Eve, Frank all find Alice's thought useful
   → access_count = 5, accessed_by = ["bob", "carol", "dave", "eve", "frank"]
   → pheromone_weight = 1.25 (reinforced 5 times)
   → Highway detection flags it as trending

5. BUILDS ON IT
   Agent Bob creates a refinement → POST /think with source_ids = [alice_thought_id]
   → New vector with thought_type = "refinement", linking back to Alice
   → Alice's original retains provenance — she's the source of this thinking chain

6. DECAY
   If nobody accesses Alice's thought for days → pheromone decays toward 0.1
   → It's still discoverable but no longer boosted
   → The highway fades if not maintained by traffic
```

---

## Tech Stack for MVP

| Component | Technology | Reason |
|-----------|-----------|--------|
| Vector Database | Qdrant (Docker) | Payload indexing, set_payload API, scroll with order_by, facets API, multitenancy support |
| API Server | FastAPI (Python) | Async, fast, good Qdrant client support |
| Embedding | OpenAI ada-002 or local model (e5-large-v2) | For MVP, API is simpler; local model for cost control later |
| Background Jobs | APScheduler or Celery | Pheromone decay, highway detection |
| Query Log Store | SQLite or PostgreSQL | Secondary store for full query vectors and session data |
| Agent Interface | Python SDK + REST API | Agents connect via HTTP; SDK wraps the API |

**Deployment for MVP:** Single Docker Compose stack:

```yaml
services:
  qdrant:
    image: qdrant/qdrant:latest
    ports:
      - "6333:6333"
      - "6334:6334"
    volumes:
      - qdrant_data:/qdrant/storage

  api:
    build: ./api
    ports:
      - "8000:8000"
    depends_on:
      - qdrant
    environment:
      - QDRANT_URL=http://qdrant:6333
      - EMBEDDING_MODEL=text-embedding-ada-002

volumes:
  qdrant_data:
```

---

## What Makes a Good MVP Test Scenario

**Scenario: Three consultants working on overlapping problems**

- **Agent Alice** (organizational design expert): Contributes thoughts about team structure, communication patterns, scaling challenges
- **Agent Bob** (technology strategist): Contributes thoughts about system architecture, tool selection, automation
- **Agent Carol** (change management specialist): Contributes thoughts about adoption, resistance patterns, training

**Expected emergence:**
- Alice contributes "Matrix organizations create communication overhead that scales quadratically"
- Bob independently queries about "scaling challenges in distributed teams" → finds Alice's thought
- Carol queries about "organizational resistance to change" → also finds Alice's thought useful in that context
- A highway forms around Alice's insight because it connects org design, tech strategy, and change management
- Bob contributes a refinement: "Microservice architecture mirrors matrix org communication patterns" with source_id pointing to Alice
- The co-retrieval graph shows Alice's org thought and Bob's tech thought are consistently retrieved together — an emergent cross-domain connection

**What we measure:**
- Did thoughts cross domain boundaries? (accessed_by includes agents from different specialties)
- Did highways form around genuinely useful insights? (high access count + high user diversity)
- Can we trace the contribution chain? (refinements link back to originals)
- Does pheromone decay correctly remove stale thoughts from prominence?

---

## Data Model Summary

### Point (in Qdrant)

| Field | Type | Purpose |
|-------|------|---------|
| id | UUID | Unique thought identifier |
| vector | float[1536] | Semantic embedding |
| contributor_id | keyword (indexed) | Who created this thought |
| contributor_name | keyword | Human-readable name |
| content | text | The thought itself |
| created_at | datetime (indexed) | When it was contributed |
| thought_type | keyword (indexed) | original / refinement / consolidation |
| source_ids | keyword[] | Provenance links to parent thoughts |
| access_count | integer (indexed) | Times retrieved by others |
| last_accessed | datetime (indexed) | Most recent retrieval |
| accessed_by | keyword[] | List of unique agent IDs who retrieved this |
| access_log | json[] | Detailed access records (capped at 100) |
| co_retrieved_with | keyword[] | IDs of thoughts frequently returned alongside this one |
| pheromone_weight | float | Current reinforcement level (1.0 = baseline, decays/grows) |
| tags | keyword[] | Topic tags |

### Query Log (in SQLite/PostgreSQL)

| Field | Type | Purpose |
|-------|------|---------|
| id | UUID | Log entry ID |
| agent_id | string | Who queried |
| query_vector | float[1536] | The actual query embedding (for later pattern analysis) |
| returned_ids | UUID[] | Which thoughts were returned |
| session_id | UUID | Groups co-retrievals |
| timestamp | datetime | When |

---

## Path from MVP to Full Architecture

| MVP | Next Phase | Full Vision |
|-----|-----------|-------------|
| Pheromone boost on access | Hebbian co-access reinforcement | Full multi-family pheromone system |
| Hourly pheromone decay | Configurable decay per thought type | Ebbinghaus forgetting curves |
| Simple access counting | Streaming micro-clusters (DenStream) | Real-time hotspot detection |
| Scroll-based highway detection | Sliced Wasserstein convergence math | Bayesian changepoint detection |
| Provenance metadata | Contribution impact scoring | Token economy / mining |
| Manual tags | LLM-generated consolidation | Full sleep cycle (NREM + REM) |
| Single collection | Multi-tenant with access controls | Collaborative Memory (ICML 2025) privacy model |
| REST API | Agent SDK with local caching | Federated query aggregation |

---

## Implementation Order

**Week 1: Foundation**
- Docker Compose with Qdrant
- FastAPI skeleton with /think and /retrieve endpoints
- Embedding pipeline (OpenAI or local)
- Payload schema with indexes
- Basic access counting on retrieval

**Week 2: Tracing**
- Full access_log and accessed_by tracking
- Co-retrieval logging (which thoughts appear in same result set)
- Query log storage
- Pheromone reinforcement on access
- Hourly pheromone decay job

**Week 3: Visibility**
- /highways endpoint with ordering
- /contribution-report endpoint per agent
- Simple dashboard showing: top highways, top contributors, recent cross-agent discoveries
- source_ids linking for refinements/consolidations

**Week 4: Testing**
- Run the 3-consultant scenario
- Measure: Did highways form? Is provenance traceable? Does pheromone correctly boost useful thoughts?
- Document what emerged that wasn't explicitly designed

---

## Key Design Decisions

**Why Qdrant over alternatives?**
- set_payload API allows efficient incremental metadata updates without re-embedding
- Payload indexes on access_count and accessed_by enable highway queries without full scan
- Scroll with order_by enables "top highways" without secondary analytics DB
- Facets API gives contributor impact stats natively
- Multitenancy via payload filtering is production-ready
- Recommendation API can later be repurposed for "related thinking" features

**Why pheromone model over simple ranking?**
- Decay ensures the system forgets — old highways fade unless actively maintained
- This is the stigmergic principle: the environment self-regulates
- Without decay, early popular thoughts would permanently dominate
- The decay rate (0.995/hour ≈ 11%/day) is tunable

**Why track co-retrieval?**
- This is the seed of the co-retrieval knowledge graph
- Even in the MVP, knowing "thought A and thought B are consistently retrieved together" reveals connections that no individual agent explicitly made
- This is emergent knowledge — the most valuable kind

**Why provenance on every point?**
- Without it, the mining/token concept is impossible later
- contributor_id + source_ids create a directed acyclic graph of intellectual contribution
- The "river of value" you described flows along these edges
