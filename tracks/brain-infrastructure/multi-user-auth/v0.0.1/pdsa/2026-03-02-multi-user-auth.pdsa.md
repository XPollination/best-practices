# PDSA: Multi-User Auth — Users Table + API Key Middleware

**Date:** 2026-03-02
**Task:** multi-user-auth
**Parent:** multi-user-brain-research
**Status:** PLAN

## Plan

### Problem
Brain API (localhost:3200) has no authentication — completely open. MCP connector (port 3201) hardcodes `agent_id="thomas"`. Multi-user requires per-user API keys and user identification on every request.

### Design

#### Change 1: Users table in SQLite
**File:** `api/src/services/database.ts`

Add to `initSchema()`:

```sql
CREATE TABLE IF NOT EXISTS users (
  user_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  api_key TEXT UNIQUE NOT NULL,
  ssh_fingerprint TEXT,
  qdrant_collection TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  active INTEGER NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_api_key ON users(api_key);
```

Export type:

```typescript
export interface User {
  user_id: string;
  display_name: string;
  api_key: string;
  ssh_fingerprint: string | null;
  qdrant_collection: string;
  created_at: string;
  active: number;  // 0 or 1
}
```

Export lookup function:

```typescript
export function getUserByApiKey(apiKey: string): User | null {
  const db = getDb();
  return db.prepare("SELECT * FROM users WHERE api_key = ? AND active = 1").get(apiKey) as User | null;
}
```

**Seed Thomas as default user** (in initSchema, after table creation):

```sql
INSERT OR IGNORE INTO users (user_id, display_name, api_key, qdrant_collection)
VALUES ('thomas', 'Thomas Pichler', 'default-thomas-key', 'thought_space');
```

The `default-thomas-key` ensures backward compatibility — existing MCP connections (which send no auth) can be migrated gradually. The provisioning script generates proper UUID keys.

#### Change 2: Auth middleware
**File:** `api/src/middleware/auth.ts` (NEW)

```typescript
import { FastifyRequest, FastifyReply } from "fastify";
import { getUserByApiKey, User } from "../services/database.js";

declare module "fastify" {
  interface FastifyRequest {
    user?: User;
  }
}

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  // Skip auth for health check
  if (request.url === "/api/v1/health" || request.url === "/health") {
    return;
  }

  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    reply.status(401).send({ error: { code: "UNAUTHORIZED", message: "Missing or invalid Authorization header. Use: Bearer <api_key>" } });
    return;
  }

  const apiKey = authHeader.slice(7);
  const user = getUserByApiKey(apiKey);
  if (!user) {
    reply.status(401).send({ error: { code: "UNAUTHORIZED", message: "Invalid API key" } });
    return;
  }

  request.user = user;
}
```

#### Change 3: Register middleware in server
**File:** `api/src/index.ts`

```typescript
import { authMiddleware } from "./middleware/auth.js";

// After CORS, before routes
app.addHook("onRequest", authMiddleware);
```

#### Change 4: Update MCP connector to use auth
**File:** `api/src/mcp/brain-mcp.ts`

The MCP server runs on port 3201 and calls the API internally at localhost:3200. It needs to send Thomas's API key:

```typescript
const BRAIN_API_KEY = process.env.BRAIN_API_KEY || "default-thomas-key";

async function callBrain(...) {
  // Add auth header to internal API calls
  const resp = await fetch(BRAIN_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${BRAIN_API_KEY}`,
    },
    body: JSON.stringify(body),
  });
}
```

**Why env var?** When MCP is used by different users (Maria, Robin), the MCP process reads the user's API key from env. For Thomas, the default works.

#### Change 5: Backward compatibility for agent callers
Current agents (PDSA, DEV, QA, LIAISON) call the API directly via curl without auth. During migration:

**Option A (recommended):** Add `BRAIN_API_KEY` env var to agent session scripts. Each agent process reads the key and sends it in headers.

**Option B:** Allow unauthenticated access from localhost only (IP whitelist). Less secure but smoother migration.

Go with Option A — env var in agent sessions. The `claude-session.sh` script sets `BRAIN_API_KEY` for all agents.

### Files Modified
| File | Change |
|------|--------|
| `api/src/services/database.ts` | Users table, User type, getUserByApiKey(), seed Thomas |
| `api/src/middleware/auth.ts` | NEW: Auth middleware with Bearer token extraction |
| `api/src/index.ts` | Register auth middleware as onRequest hook |
| `api/src/mcp/brain-mcp.ts` | Add Authorization header to internal API calls |

### NOT Changed
- Memory routes (they receive `req.user` from middleware, use it in next task: routing)
- Qdrant configuration (collection routing is task 2)
- Agent monitor scripts (BRAIN_API_KEY handled in deployment, not in this task)
- Health endpoint (explicitly exempted from auth)

### Risks
- **Breaking existing agents:** During deployment, agents without BRAIN_API_KEY get 401. Mitigation: seed Thomas with `default-thomas-key` and set that as default env var.
- **API key in plaintext SQLite:** Acceptable for 3 trusted users. For public deployment, hash keys.
- **MCP connector restart needed:** After adding auth, MCP process must be restarted with BRAIN_API_KEY env var.

### Edge Cases
- **Health check without auth:** Must work — monitoring tools don't authenticate.
- **Agent restart mid-session:** Agent picks up BRAIN_API_KEY from env, continues working.
- **Invalid key format:** Any non-empty string after "Bearer " is looked up. UUID format not enforced at auth layer (enforced at provisioning time).

## Do
(To be completed by DEV agent)

## Study
- Unauthenticated requests to /api/v1/memory return 401
- Authenticated requests with valid key succeed
- Health endpoint works without auth
- MCP connector sends auth header to internal API
- Thomas seeded as default user
- getUserByApiKey returns null for invalid keys

## Act
- Deploy: set BRAIN_API_KEY in agent session env vars
- Provision Maria: create user record with UUID key (task 3)
- Monitor: verify no 401 errors in agent logs after deployment
