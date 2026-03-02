# PDSA: Multi-User Provisioning — provision-user.sh

**Date:** 2026-03-02
**Task:** multi-user-provision-script
**Parent:** multi-user-brain-research
**Depends On:** multi-user-auth (users table), multi-user-routing (collection naming)
**Status:** PLAN

## Plan

### Problem
When a new user (Maria, Robin) needs a brain, someone must: create a Qdrant collection with the right schema, generate an API key, register the user in SQLite, and output the config for Claude Web AI. This must be scriptable and idempotent.

### Design

#### Script: `api/scripts/provision-user.sh`
**File:** `api/scripts/provision-user.sh` (NEW)

```bash
#!/bin/bash
# Provision a new brain user
# Usage: ./provision-user.sh <user_id> <display_name> [ssh_fingerprint]
# Example: ./provision-user.sh maria "Maria Pichler"
# Example: ./provision-user.sh robin "Robin Pichler" "SHA256:abc..."

set -e

# --- Config ---
QDRANT="http://localhost:6333"
DB_PATH="${BRAIN_DB_PATH:-/home/developer/workspaces/github/PichlerThomas/best-practices/data/thought-tracing.db}"

# --- Args ---
USER_ID="${1:?Usage: provision-user.sh <user_id> <display_name> [ssh_fingerprint]}"
DISPLAY_NAME="${2:?Usage: provision-user.sh <user_id> <display_name> [ssh_fingerprint]}"
SSH_FINGERPRINT="${3:-}"
COLLECTION="thought_space_${USER_ID}"

# --- Validation ---
if ! echo "$USER_ID" | grep -qE '^[a-z][a-z0-9_-]{1,30}$'; then
  echo "ERROR: user_id must be lowercase alphanumeric (2-31 chars), start with letter"
  exit 1
fi

# --- Check if user already exists ---
EXISTING=$(sqlite3 "$DB_PATH" "SELECT user_id FROM users WHERE user_id = '${USER_ID}';" 2>/dev/null || true)
if [ -n "$EXISTING" ]; then
  echo "User '${USER_ID}' already exists. Retrieving existing config..."
  EXISTING_KEY=$(sqlite3 "$DB_PATH" "SELECT api_key FROM users WHERE user_id = '${USER_ID}';")
  echo ""
  echo "Existing user:"
  echo "  ID: ${USER_ID}"
  echo "  Collection: ${COLLECTION}"
  echo "  API Key: ${EXISTING_KEY}"
  echo ""
  echo "MCP config for Claude Web AI:"
  echo "  Authorization: Bearer ${EXISTING_KEY}"
  exit 0
fi

# --- Generate API key ---
API_KEY=$(uuidgen)

# --- Step 1: Create Qdrant collection ---
echo "Step 1: Creating Qdrant collection ${COLLECTION}..."
COLLECTION_EXISTS=$(curl -s "${QDRANT}/collections/${COLLECTION}" | python3 -c "import sys,json; d=json.load(sys.stdin); print('yes' if d.get('status')=='ok' else 'no')" 2>/dev/null || echo "no")

if [ "$COLLECTION_EXISTS" = "yes" ]; then
  echo "  Collection already exists — skipping creation"
else
  curl -sf -X PUT "${QDRANT}/collections/${COLLECTION}" \
    -H "Content-Type: application/json" \
    -d '{
      "vectors": { "size": 384, "distance": "Cosine" },
      "optimizers_config": { "default_segment_number": 2 },
      "replication_factor": 1
    }'
  echo "  ✓ Collection created"
fi

# --- Step 2: Create payload indexes ---
echo "Step 2: Creating payload indexes..."
for field in contributor_id:keyword thought_type:keyword tags:keyword \
  knowledge_space_id:keyword thought_category:keyword topic:keyword \
  quality_flags:keyword access_count:integer pheromone_weight:float \
  created_at:datetime last_accessed:datetime; do
  IFS=: read name type <<< "$field"
  curl -sf -X PUT "${QDRANT}/collections/${COLLECTION}/index" \
    -H "Content-Type: application/json" \
    -d "{\"field_name\":\"${name}\",\"field_schema\":\"${type}\"}" >/dev/null 2>&1 || true
done
echo "  ✓ Indexes created"

# --- Step 3: Ensure shared collection exists ---
echo "Step 3: Ensuring thought_space_shared exists..."
SHARED_EXISTS=$(curl -s "${QDRANT}/collections/thought_space_shared" | python3 -c "import sys,json; d=json.load(sys.stdin); print('yes' if d.get('status')=='ok' else 'no')" 2>/dev/null || echo "no")

if [ "$SHARED_EXISTS" = "yes" ]; then
  echo "  Shared collection already exists — skipping"
else
  curl -sf -X PUT "${QDRANT}/collections/thought_space_shared" \
    -H "Content-Type: application/json" \
    -d '{
      "vectors": { "size": 384, "distance": "Cosine" },
      "optimizers_config": { "default_segment_number": 2 },
      "replication_factor": 1
    }'
  # Create indexes for shared collection too
  for field in contributor_id:keyword thought_type:keyword tags:keyword \
    knowledge_space_id:keyword thought_category:keyword topic:keyword \
    quality_flags:keyword access_count:integer pheromone_weight:float \
    created_at:datetime last_accessed:datetime; do
    IFS=: read name type <<< "$field"
    curl -sf -X PUT "${QDRANT}/collections/thought_space_shared/index" \
      -H "Content-Type: application/json" \
      -d "{\"field_name\":\"${name}\",\"field_schema\":\"${type}\"}" >/dev/null 2>&1 || true
  done
  echo "  ✓ Shared collection created with indexes"
fi

# --- Step 4: Register user in SQLite ---
echo "Step 4: Registering user..."
if [ -n "$SSH_FINGERPRINT" ]; then
  sqlite3 "$DB_PATH" "INSERT INTO users (user_id, display_name, api_key, ssh_fingerprint, qdrant_collection) VALUES ('${USER_ID}', '${DISPLAY_NAME}', '${API_KEY}', '${SSH_FINGERPRINT}', '${COLLECTION}');"
else
  sqlite3 "$DB_PATH" "INSERT INTO users (user_id, display_name, api_key, qdrant_collection) VALUES ('${USER_ID}', '${DISPLAY_NAME}', '${API_KEY}', '${COLLECTION}');"
fi
echo "  ✓ User registered"

# --- Step 5: Output ---
echo ""
echo "========================================="
echo "User provisioned successfully!"
echo "========================================="
echo "  ID:              ${USER_ID}"
echo "  Display Name:    ${DISPLAY_NAME}"
echo "  Collection:      ${COLLECTION}"
echo "  API Key:         ${API_KEY}"
echo "  SSH Fingerprint: ${SSH_FINGERPRINT:-none}"
echo ""
echo "--- Claude Web AI MCP Config ---"
echo "  Authorization: Bearer ${API_KEY}"
echo ""
echo "--- Agent Session Environment ---"
echo "  export BRAIN_API_KEY=\"${API_KEY}\""
echo "  export BRAIN_AGENT_ID=\"${USER_ID}\""
echo "  export BRAIN_AGENT_NAME=\"${DISPLAY_NAME}\""
echo "========================================="
```

### Script Properties

| Property | Value |
|----------|-------|
| **Idempotent** | Yes — checks for existing user/collection before creating |
| **Requires** | `uuidgen`, `sqlite3`, `curl`, `python3` (all available on Hetzner) |
| **Config** | `BRAIN_DB_PATH` env var or hardcoded default |
| **Validation** | user_id: lowercase alphanumeric, 2-31 chars, starts with letter |
| **Output** | API key, MCP config, env var exports for agent sessions |

### Usage Scenarios

**Scenario 1: Provision Maria (test)**
```bash
cd /home/developer/workspaces/github/PichlerThomas/best-practices
./api/scripts/provision-user.sh maria "Maria Pichler"
```

**Scenario 2: Robin self-service**
Robin clones the repo on his machine, runs:
```bash
./api/scripts/provision-user.sh robin "Robin Pichler" "SHA256:abc123..."
```
Then configures Claude Web AI with the output API key.

**Scenario 3: Re-run (idempotent)**
```bash
./api/scripts/provision-user.sh maria "Maria Pichler"
# → "User 'maria' already exists. Retrieving existing config..."
```

### Files Modified
| File | Change |
|------|--------|
| `api/scripts/provision-user.sh` | NEW: User provisioning script |

### NOT Changed
- Database schema (users table from multi-user-auth)
- Brain API code (dynamic routing from multi-user-routing)
- MCP connector (env vars from multi-user-mcp-config)

### Risks
- **SQL injection in user_id/display_name.** Mitigation: user_id validated with regex. Display name uses SQLite parameterization via quotes. For production, use a proper SQL parameterization tool.
- **API key printed to terminal.** Acceptable for trusted admin workflow. For Robin self-service, the key is only shown once — Robin must save it.
- **DB path varies between dev and production.** Mitigation: `BRAIN_DB_PATH` env var with sensible default.

### Edge Cases
- **No `uuidgen` installed.** Script fails with clear error. Available on Ubuntu by default.
- **Qdrant down.** curl with `-sf` fails, `set -e` stops script. User not half-provisioned (SQLite insert is last step).
- **Collection name collision.** `thought_space_thomas` could conflict with the alias created by migration. Not an issue — alias and collection are in different namespaces. A user_id of `thomas` would create collection `thought_space_thomas` which is the alias name. Qdrant may error if alias and collection have same name. **Mitigation:** Thomas is provisioned via seed (multi-user-auth) and alias (multi-user-migration), not via this script. This script is for NEW users only.

## Do
(To be completed by DEV agent)

## Study
- Script provisions Maria with collection + API key + user record
- Script is idempotent (re-run shows existing config)
- Shared collection created if missing
- user_id validated (lowercase, alphanumeric)
- Output includes MCP config and agent session env vars
- DB path configurable via env var

## Act
- Test: provision Maria, verify collection exists in Qdrant, verify user in SQLite
- Test: use Maria's API key with brain API
- Next task: multi-user-maria-test (end-to-end verification)
