# PDSA: MVP Architecture — bestpractice.xpollination.earth

**Date:** 2026-02-17
**Author:** PDSA Agent
**Task:** mvp-architecture
**Status:** PLAN

---

## PLAN

### Problem Statement

The XPollination Thought Tracing System has 10 spec documents (from 2 voice conversation loops with Thomas) describing a comprehensive vision: vector DB, knowledge graph, truth anchoring, decentralization, multi-agent access, and organic knowledge growth. This vision is rich but large. We need an MVP (v0.0.1) that:

1. Runs on the existing Hetzner CX22 (2 vCPU, 8GB RAM, ~3.5-4GB available)
2. Provides two entry points: Claude Code agents (local) and Claude web/claude.ai (remote HTTPS)
3. Accepts queries, stores them with embeddings, returns relevant matches
4. Defers everything that can wait (knowledge graph, truth anchoring, voice, decentralization)

### Spec Documents Analyzed

| # | Document | Key Takeaway for MVP |
|---|----------|---------------------|
| 01 | System Vision | Thought tracing, mirroring loop, truth anchoring — **defer all except basic query storage** |
| 02 | Core Architecture | 3-layer design (interface→processing→persistence). MVP implements persistence + minimal interface |
| 03 | Agent Guidelines | Thought unit schema, mirroring protocol — **defer mirroring, use simplified schema for MVP** |
| 04 | Vector DB & Graph | Qdrant recommended, 4 collections, BGE-M3 1024-dim — **MVP: Qdrant with 1-2 collections, API embeddings** |
| 05 | Truth Anchoring | Scripture scoring system — **defer entirely to Phase 2** |
| 06 | Integration Spec | Server architecture, Docker Compose, REST API design — **MVP uses subset of proposed endpoints** |
| 07 | Conversation Trace 001 | First loop: vision established — context only |
| 08 | Multi-Agent Access | Guided intake state machine, context bean, protocol options — **MVP: simplified structured JSON, REST API** |
| 09 | Decentralization | Central server = lean knowledge API, local processing — **MVP: centralized is fine for single-user Phase 1** |
| 10 | Conversation Trace 002 | Second loop: access layer + decentralization pivot — context only |

---

## Technology Stack Decision

### Vector DB: Qdrant (Docker, on-disk mode)

**Chosen over alternatives:**

| Option | RAM | Verdict |
|--------|-----|---------|
| **Qdrant (on-disk)** | ~150-250MB | **Selected.** Full features: collections, filtering, snapshots, REST+gRPC API. Spec recommends it (doc 04). Scales to Phase 2/3 without migration. |
| sqlite-vec | ~50-80MB | Lowest RAM. Brute-force only (no ANN index). Fine for <100K vectors but lacks collections model. Would require migration to Qdrant later — not worth the short-term saving. |
| ChromaDB | ~400-600MB | Python runtime overhead. Memory leak reports. No on-disk HNSW. Wastes 3-4x the RAM of Qdrant for equivalent functionality. |

**Qdrant configuration for MVP:**
```yaml
# docker-compose.yml
qdrant:
  image: qdrant/qdrant:latest
  ports: ["6333:6333"]
  volumes: ["./qdrant_data:/qdrant/storage"]
  deploy:
    resources:
      limits:
        memory: 300M
  environment:
    QDRANT__STORAGE__OPTIMIZERS__MEMMAP_THRESHOLD_KB: 1000
    QDRANT__STORAGE__HNSW_INDEX__ON_DISK: "true"
```

**RAM budget:** ~200MB with on-disk storage. At 10K vectors x 1024 dims, vector data stays on SSD; only actively queried pages load to RAM.

### Embedding: Voyage AI API (API-based, not local)

**Chosen over local BGE-M3:**

| Option | RAM | Cost | Verdict |
|--------|-----|------|---------|
| BGE-M3 local (PyTorch) | 2-3GB | Free | **Rejected.** Consumes 50-75% of available RAM. Leaves no headroom. Cold-start 10-20s. |
| BGE-M3 local (ONNX int4) | 1-1.5GB | Free | **Rejected.** Still tight. 2 vCPU = slow inference. Risk of OOM under load. |
| **Voyage AI API** | 0MB | Free (200M tokens) | **Selected.** Anthropic-recommended. 1024 dimensions. Matches spec's BGE-M3 dimensionality. 200M free tokens covers years of MVP usage (<10K docs = <5M tokens total). ~100-300ms latency per embed. |
| OpenAI text-embedding-3-small | 0MB | $0.02/1M tokens | Backup option. 1536 dims (trimmable to 1024). |
| Google Gemini embedding | 0MB | Free tier | Second backup. 768 dims. Rate-limited. |

**Fallback strategy:** If Voyage AI changes pricing or becomes unavailable, swap to OpenAI or Gemini embedding APIs. The Qdrant collection stores embeddings — the source model is metadata. Re-embedding is a batch operation if model changes.

### API Framework: Node.js with Fastify

**Rationale:**
- Existing tech stack (xpollination-mcp-server = Node.js/TypeScript)
- Dev agent is familiar with it
- Fastify over Express: faster, built-in schema validation, TypeScript-first
- No reason to introduce Python (FastAPI) — would add a new runtime dependency
- RAM: ~50-80MB for the Node.js process

### Web Server: nginx reverse proxy

**Already installed** (nginx 1.24.0). Configuration:
```
bestpractice.xpollination.earth → reverse proxy → localhost:3200
```
- HTTPS via Let's Encrypt (certbot)
- Entry A (local agents): can hit localhost:3200 directly (skip nginx)
- Entry B (external/claude.ai): hits https://bestpractice.xpollination.earth

### Total RAM Budget

| Component | RAM | Notes |
|-----------|-----|-------|
| Qdrant (Docker, on-disk) | ~200MB | Memmap threshold, HNSW on disk |
| Node.js API server | ~80MB | Fastify + Qdrant client + Voyage client |
| Voyage AI API | 0MB | External service |
| nginx | ~5MB | Already running |
| **Total new RAM** | **~285MB** | Leaves ~3.2GB for existing processes |

**Current server state:** 3.7GB used, 3.8GB available. Adding 285MB is comfortable.

---

## Two Entry Points

### Entry A: Claude Code Agents (Local)

```
Claude Code agent (any pane in claude-agents tmux session)
    │
    │ HTTP POST http://localhost:3200/api/v1/query
    │ (or /api/v1/ingest)
    │
    ▼
Node.js API server (port 3200)
    │
    ├──→ Voyage AI API (embed query)
    │
    └──→ Qdrant (search/store)
```

**How agents use it:**
- Agents call the REST API via `curl` or `fetch` from their bash/Node.js tools
- No MCP server needed for MVP (agents can make HTTP calls directly)
- MCP wrapper is a Phase 2 addition (thin layer over the same REST API)
- Local traffic = no latency, no HTTPS overhead

### Entry B: Claude Web Interface (claude.ai)

```
User on claude.ai tells Claude about the API
    │
    │ Claude generates structured query
    │
    │ User (or Claude via tool) sends HTTPS request
    │
    ▼
https://bestpractice.xpollination.earth/api/v1/query
    │
    ▼
nginx (HTTPS termination)
    │
    ▼
Node.js API server (port 3200)
    │
    ├──→ Voyage AI API (embed query)
    │
    └──→ Qdrant (search/store)
```

**How claude.ai users use it:**
- The API is self-documenting: `GET /api/v1/` returns available endpoints and required fields
- Claude.ai users describe their intent to Claude, Claude formats the JSON request
- User executes via browser fetch, curl, or any HTTP client
- Response is structured JSON that Claude can interpret and present
- **No MCP required** — pure HTTPS REST, which any AI platform can reach
- Future: simple web form at bestpractice.xpollination.earth for browser-based queries

**Both entry points hit the same API.** The only difference is the network path (localhost vs public HTTPS).

---

## MVP Scope (v0.0.1)

### BUILD NOW

1. **Node.js REST API** (Fastify + TypeScript)
   - `POST /api/v1/query` — accept structured query, embed, search Qdrant, return matches
   - `POST /api/v1/ingest` — accept content + metadata, embed, store in Qdrant
   - `GET /api/v1/health` — server status (Qdrant connection, uptime)
   - `GET /api/v1/` — API documentation / self-describing endpoint

2. **Qdrant Docker container** (on-disk mode)
   - Collection: `best_practices` (embed and store the existing markdown best-practice documents)
   - Collection: `queries` (store every incoming query with its embedding for future analysis)
   - Payload fields: `content`, `source`, `domain`, `timestamp`, `language`, `intent`

3. **Voyage AI integration**
   - Embed queries on arrival (for search)
   - Embed documents on ingest (for storage)
   - Model: `voyage-3` or `voyage-3-lite` (1024 dimensions)

4. **Seed data: existing best-practices markdown**
   - Parse and embed all `.md` files from best-practices repo
   - Store in `best_practices` collection with file path, domain tag, content
   - CLI command: `npm run seed` to re-embed all documents

5. **nginx configuration**
   - `bestpractice.xpollination.earth` → `localhost:3200`
   - HTTPS via Let's Encrypt
   - CORS headers for cross-origin API access

6. **Minimal guided intake** (simplified from spec 08)
   - Structured JSON request body for `/api/v1/query`:
     ```json
     {
       "query": "How should I structure a DACH CV?",
       "domain": "cv",
       "intent": "research",
       "language": "en"
     }
     ```
   - Required: `query`
   - Optional: `domain`, `intent`, `language` (defaults: null, "research", "en")
   - Response includes: matched documents with similarity scores, metadata

### DEFER TO PHASE 2

| Feature | Why Defer | Spec Reference |
|---------|-----------|----------------|
| Knowledge Graph (Neo4j/FalkorDB) | Adds ~500MB RAM + complexity. Vector search alone serves MVP queries. | 04, 02 |
| Truth Anchoring | Requires scripture database + scoring engine. Not needed for basic query/match. | 05 |
| Mirroring Loop | Full decode-reflect-refine cycle needs the knowledge graph. MVP just stores and retrieves. | 01, 03 |
| MCP Server wrapper | Agents can use REST API directly. MCP adds convenience, not capability. | 08 |
| WebSocket live feedback | Queries return in <1s. No need for streaming status updates at this scale. | 08 |
| Convergence zone detection | Requires multiple thinkers + enough data to detect patterns. | 04 |
| Thought unit full schema | Simplified metadata for MVP. Full schema (angle, confidence, parent_id, resonance) in Phase 2. | 03 |

### DEFER TO PHASE 3+

| Feature | Why Defer | Spec Reference |
|---------|-----------|----------------|
| Decentralization | Single-user Phase 1 doesn't need distributed architecture. | 09 |
| Voice input (Whisper) | Requires GPU or significant CPU. Not MVP scope. | 06 |
| Multi-thinker support | Privacy layers, access control, anonymization. Single user first. | 01, 03 |
| Federated instances | Far future. Needs sync protocol design. | 09 |

---

## Project Structure

```
best-practices/
├── api/                          # NEW: REST API service
│   ├── src/
│   │   ├── index.ts              # Fastify server entry point
│   │   ├── routes/
│   │   │   ├── query.ts          # POST /api/v1/query
│   │   │   ├── ingest.ts         # POST /api/v1/ingest
│   │   │   └── health.ts         # GET /api/v1/health
│   │   ├── services/
│   │   │   ├── embedding.ts      # Voyage AI client
│   │   │   ├── vectordb.ts       # Qdrant client
│   │   │   └── seeder.ts         # Markdown → Qdrant seeder
│   │   └── types/
│   │       └── index.ts          # TypeScript interfaces
│   ├── package.json
│   ├── tsconfig.json
│   └── docker-compose.yml        # Qdrant service definition
├── cv-content/                   # Existing
├── knowledge-management/         # Existing
├── layout/                       # Existing
├── social-media/                 # Existing
├── data/                         # Existing (workflow DB)
├── pdsa/                         # PDSA documents
└── README.md
```

The API service lives inside the best-practices repo because it serves this repo's content directly. The `api/` directory is a self-contained Node.js project with its own package.json.

---

## Implementation Steps (for DEV agent)

### Step 1: Infrastructure Setup
1. Create `api/` directory structure
2. Initialize Node.js project (package.json, tsconfig.json)
3. Create docker-compose.yml with Qdrant (on-disk mode, 300MB limit)
4. Start Qdrant: `docker compose up -d`
5. Verify Qdrant health: `curl http://localhost:6333/healthz`

### Step 2: Embedding Service
1. Sign up for Voyage AI API key (or use existing)
2. Create `embedding.ts` — wrapper around Voyage AI REST API
3. Test: embed a sample text, verify 1024-dim vector returned

### Step 3: Vector DB Service
1. Create `vectordb.ts` — Qdrant client (using `@qdrant/js-client-rest`)
2. Create collections: `best_practices` (1024-dim, cosine), `queries` (1024-dim, cosine)
3. Implement: `search(vector, limit, filter)` and `upsert(id, vector, payload)`

### Step 4: REST API
1. Create Fastify server with routes
2. `POST /api/v1/query`: validate input → embed query → search `best_practices` → store in `queries` → return matches
3. `POST /api/v1/ingest`: validate input → embed content → upsert to `best_practices`
4. `GET /api/v1/health`: check Qdrant connection, return status
5. `GET /api/v1/`: return API docs (JSON schema of endpoints)

### Step 5: Seeder
1. Create `seeder.ts` — reads all `.md` files from best-practices repo
2. Splits large documents into chunks (~500 tokens each)
3. Embeds each chunk via Voyage AI
4. Stores in `best_practices` collection with metadata (file_path, domain, chunk_index)
5. CLI: `npm run seed`

### Step 6: nginx + HTTPS
1. Add nginx server block for `bestpractice.xpollination.earth`
2. Reverse proxy to `localhost:3200`
3. HTTPS via certbot: `certbot --nginx -d bestpractice.xpollination.earth`
4. Add CORS headers for cross-origin access

### Step 7: Smoke Test
1. Seed existing best-practices markdown
2. Query from local curl: `curl -X POST http://localhost:3200/api/v1/query -d '{"query":"CV layout for DACH"}'`
3. Query from external: `curl -X POST https://bestpractice.xpollination.earth/api/v1/query -d '{"query":"CV layout for DACH"}'`
4. Verify both return relevant matches

---

## Acceptance Criteria

1. [ ] All 10 spec documents read and analyzed — **done in this PDSA**
2. [ ] Technology stack proposed with rationale (fits 8GB RAM) — **Qdrant ~200MB + Voyage API 0MB + Node.js ~80MB = ~285MB new RAM**
3. [ ] Two entry points architecturally defined — **Entry A: localhost:3200, Entry B: https://bestpractice.xpollination.earth**
4. [ ] Vector DB integration for storing all queries — **`queries` collection in Qdrant, every query stored with embedding**
5. [ ] MVP scope clearly separated from future phases — **Phase 1 (now) vs Phase 2 vs Phase 3+ table above**
6. [ ] Implementation steps defined — **7 steps above for DEV agent**

---

## DO (Implementation)

*To be executed by DEV agent after approval.*

## STUDY

*To be completed after implementation.*

## ACT

*To be completed after study.*
