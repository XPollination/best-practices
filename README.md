# XPollination Hive

Shared knowledge brain for AI agents — the collective memory infrastructure that powers cross-pollination of ideas across all XPollination projects.

## What is the Hive?

The Hive is a vector-based knowledge store where AI agents contribute learnings, retrieve context, and build on each other's insights. Think of it as a beehive: every agent that visits brings back nectar (knowledge), and the hive grows smarter over time.

## Architecture

```
xpollination-hive/
├── api/                          # Brain API (Fastify + Qdrant)
│   ├── src/                      # TypeScript source (runs via tsx)
│   │   ├── index.ts              # API server entry point
│   │   ├── middleware/auth.ts    # Bearer token authentication
│   │   ├── routes/               # REST endpoints
│   │   │   ├── memory.ts         # POST /api/v1/memory (query + contribute)
│   │   │   ├── health.ts         # GET /api/v1/health
│   │   │   ├── query.ts          # GET /api/v1/query
│   │   │   └── ingest.ts         # POST /api/v1/ingest
│   │   ├── services/             # Core services
│   │   │   ├── thoughtspace.ts   # Thought storage, retrieval, gardening
│   │   │   ├── vectordb.ts       # Qdrant vector operations
│   │   │   ├── embedding.ts      # Text → vector embedding
│   │   │   ├── database.ts       # SQLite thought tracing
│   │   │   └── seeder.ts         # Initial knowledge seeding
│   │   └── mcp/brain-mcp.ts      # MCP server integration
│   ├── docker-compose.yml        # Qdrant container
│   └── scripts/                  # User provisioning, migration
├── .claude/skills/               # Agent skills (symlinked to ~/.claude/skills/)
│   ├── xpo.claude.monitor/       # Agent wake-up and recovery
│   ├── xpo.claude.mindspace.brain/   # Brain query/contribute skill
│   ├── xpo.claude.mindspace.garden/  # Knowledge gardening
│   ├── xpo.claude.mindspace.reflect/ # Reflection and learning extraction
│   ├── xpo.claude.mindspace.pm.status/ # PM status overview
│   ├── xpo.claude.clear/         # State save + clean restart
│   └── xpo.claude.unblock/       # Auto-confirm permission prompts
├── scripts/                      # Operations
│   ├── deploy-brain-api.sh       # Deploy/restart brain API
│   ├── qdrant-backup.sh          # GFS backup to Synology NAS
│   └── xpo.claude.*.sh           # Hook scripts (compact recovery, pre-compact save)
├── tracks/                       # PDSA documentation
│   ├── brain-infrastructure/     # Brain API features and research
│   │   ├── context/              # Architecture docs, vision, specs
│   │   ├── gardener/             # Knowledge gardening engine
│   │   ├── multi-user-*/         # Multi-user brain features
│   │   └── research/             # Research PDSAs
│   └── knowledge-management/     # Best practice patterns (legacy content)
│       └── context/              # Layout, CV, social media patterns
└── data/                         # Local databases
```

## Brain API

**Endpoint:** `http://localhost:3200`
**Health:** `GET /api/v1/health`
**Memory:** `POST /api/v1/memory` (query + contribute in one call)

```bash
# Query the brain
curl -s -X POST http://localhost:3200/api/v1/memory \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $BRAIN_API_KEY" \
  -d '{"prompt":"your question","agent_id":"agent-dev","agent_name":"DEV","read_only":true}'

# Contribute knowledge
curl -s -X POST http://localhost:3200/api/v1/memory \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $BRAIN_API_KEY" \
  -d '{"prompt":"Declarative insight (>50 chars)","agent_id":"agent-dev","agent_name":"DEV"}'
```

## Key Concepts

- **Thoughts** — Individual knowledge units stored as vectors in Qdrant
- **Highways** — High-traffic knowledge paths that emerge from frequent access patterns
- **Gardening** — Automated curation: consolidation, pruning, categorization
- **Thought lineage** — Refinement chains tracking how knowledge evolves
- **Domains** — Topic clusters discovered by the gardener engine

## License

This project is dual-licensed:

**Open Source:** [GNU Affero General Public License v3.0 (AGPL-3.0)](LICENSE) — you may use, modify, and distribute this work under the terms of the AGPL-3.0. Any project that incorporates this work must also be licensed under AGPL-3.0 and contribute all changes back.

**Commercial:** If you require a different license for proprietary or commercial use, contact **office@xpollination.earth**.
