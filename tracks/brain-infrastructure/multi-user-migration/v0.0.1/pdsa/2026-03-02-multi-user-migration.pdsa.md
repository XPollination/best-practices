# PDSA: Multi-User Migration — thought_space to thought_space_thomas

**Date:** 2026-03-02
**Task:** multi-user-migration
**Parent:** multi-user-brain-research
**Depends On:** multi-user-auth (users table), multi-user-routing (dynamic collection)
**Status:** PLAN

## Plan

### Problem
Thomas's brain lives in `thought_space` (1817 thoughts). Multi-user naming requires `thought_space_{user_id}`. We need to map `thought_space` → `thought_space_thomas` without copying 1817 vectors.

### Research: Qdrant Collection Rename
Qdrant **does not support collection rename**. Two alternatives:

**Option A: Alias (recommended)**
Create an alias `thought_space_thomas` pointing to the physical `thought_space` collection. The API uses the alias name in all operations — Qdrant resolves it transparently.

```bash
curl -X POST http://localhost:6333/collections/aliases \
  -H "Content-Type: application/json" \
  -d '{
    "actions": [
      { "create_alias": { "collection_name": "thought_space", "alias_name": "thought_space_thomas" } }
    ]
  }'
```

**Pros:** Zero downtime, zero data movement, instant, reversible.
**Cons:** Physical collection name stays `thought_space` (cosmetic only — invisible to API callers).

**Option B: Copy + Delete**
Create new `thought_space_thomas`, scroll all 1817 points from `thought_space`, upsert into new collection, delete old.

**Pros:** Clean physical naming.
**Cons:** Slow (1817 vectors to copy), downtime, data loss risk, memory spike during copy.

**Decision: Option A — Alias.** Zero-risk migration. Physical name is an implementation detail.

### Design

#### Change 1: Create alias via Qdrant API
**Execution:** One-time curl command (or script)

```bash
# Create alias thought_space_thomas → thought_space
curl -X POST http://localhost:6333/collections/aliases \
  -H "Content-Type: application/json" \
  -d '{
    "actions": [
      { "create_alias": { "collection_name": "thought_space", "alias_name": "thought_space_thomas" } }
    ]
  }'
```

Alias creation is atomic. After this, both `thought_space` and `thought_space_thomas` resolve to the same data.

#### Change 2: Create shared collection alias
```bash
# Create thought_space_shared collection (for multi-user shared space)
curl -X PUT http://localhost:6333/collections/thought_space_shared \
  -H "Content-Type: application/json" \
  -d '{
    "vectors": { "size": 384, "distance": "Cosine" },
    "optimizers_config": { "default_segment_number": 2 },
    "replication_factor": 1
  }'
```

Then create payload indexes matching thought_space (same indexes needed for search/filter).

#### Change 3: Update Thomas's user record
**Precondition:** multi-user-auth deployed (users table exists, Thomas seeded with `qdrant_collection = "thought_space"`).

Update Thomas's record to point to the alias:
```sql
UPDATE users SET qdrant_collection = 'thought_space_thomas' WHERE user_id = 'thomas';
```

#### Change 4: Update DEFAULT_COLLECTION in thoughtspace.ts
**File:** `api/src/services/thoughtspace.ts`

After multi-user-routing changes `COLLECTION` to `DEFAULT_COLLECTION`:
```typescript
// Keep backward compat — default resolves via Thomas's alias
const DEFAULT_COLLECTION = "thought_space";
```

**No change needed here.** The default `"thought_space"` still works because:
1. `thought_space` (physical) and `thought_space_thomas` (alias) both resolve to the same data
2. Authenticated requests use `req.user.qdrant_collection` which is `"thought_space_thomas"` (from the updated user record)
3. Unauthenticated requests (if any) fall through to `"thought_space"` — same data

#### Change 5: Verify existing data integrity

Verification script (run post-migration):
```bash
# Count via alias
curl -s http://localhost:6333/collections/thought_space_thomas | python3 -c "import sys,json; print(json.load(sys.stdin)['result']['points_count'])"

# Count via physical name
curl -s http://localhost:6333/collections/thought_space | python3 -c "import sys,json; print(json.load(sys.stdin)['result']['points_count'])"

# Both should return 1817 (same data)
```

### Migration Script
**File:** `api/scripts/migrate-thomas-alias.sh` (NEW)

```bash
#!/bin/bash
# One-time migration: Create alias thought_space_thomas for thought_space
# Run ONCE after multi-user-auth is deployed.

set -e

QDRANT="http://localhost:6333"

echo "Step 1: Create alias thought_space_thomas → thought_space"
curl -sf -X POST "$QDRANT/collections/aliases" \
  -H "Content-Type: application/json" \
  -d '{"actions":[{"create_alias":{"collection_name":"thought_space","alias_name":"thought_space_thomas"}}]}'
echo " ✓ Alias created"

echo "Step 2: Create thought_space_shared collection"
curl -sf -X PUT "$QDRANT/collections/thought_space_shared" \
  -H "Content-Type: application/json" \
  -d '{"vectors":{"size":384,"distance":"Cosine"},"optimizers_config":{"default_segment_number":2},"replication_factor":1}'
echo " ✓ Shared collection created"

echo "Step 3: Create payload indexes for shared collection"
for field in contributor_id:keyword thought_type:keyword tags:keyword \
  knowledge_space_id:keyword thought_category:keyword topic:keyword \
  quality_flags:keyword access_count:integer pheromone_weight:float \
  created_at:datetime last_accessed:datetime; do
  IFS=: read name type <<< "$field"
  curl -sf -X PUT "$QDRANT/collections/thought_space_shared/index" \
    -H "Content-Type: application/json" \
    -d "{\"field_name\":\"${name}\",\"field_schema\":\"${type}\"}" >/dev/null
done
echo " ✓ Payload indexes created"

echo "Step 4: Update Thomas user record"
sqlite3 /home/developer/workspaces/github/PichlerThomas/best-practices/data/thought-tracing.db \
  "UPDATE users SET qdrant_collection = 'thought_space_thomas' WHERE user_id = 'thomas';"
echo " ✓ Thomas record updated"

echo "Step 5: Verify"
ALIAS_COUNT=$(curl -s "$QDRANT/collections/thought_space_thomas" | python3 -c "import sys,json; print(json.load(sys.stdin)['result']['points_count'])")
PHYSICAL_COUNT=$(curl -s "$QDRANT/collections/thought_space" | python3 -c "import sys,json; print(json.load(sys.stdin)['result']['points_count'])")
echo "  Alias count: $ALIAS_COUNT"
echo "  Physical count: $PHYSICAL_COUNT"
if [ "$ALIAS_COUNT" = "$PHYSICAL_COUNT" ]; then
  echo " ✓ Counts match — migration successful"
else
  echo " ✗ MISMATCH — investigate!"
  exit 1
fi
```

### Files Modified
| File | Change |
|------|--------|
| `api/scripts/migrate-thomas-alias.sh` | NEW: One-time migration script |

### NOT Changed
- `thoughtspace.ts` — DEFAULT_COLLECTION stays "thought_space" (still valid)
- `memory.ts` — No routing changes (that's multi-user-routing)
- `database.ts` — User record update is in the script, not code
- Qdrant data — Zero data movement

### Deployment Order
1. Deploy multi-user-auth (users table + Thomas seed with `qdrant_collection = "thought_space"`)
2. Deploy multi-user-routing (dynamic collection parameter)
3. **Run this migration script** (creates alias, updates Thomas to `thought_space_thomas`)
4. No restart needed — alias is transparent

### Risks
- **Alias + physical name both valid.** If code uses `thought_space` directly (bypassing routing), it still works. But this means unauthenticated access reaches Thomas's data. Mitigation: auth middleware blocks unauthenticated requests after deployment.
- **Qdrant alias not supported in older versions.** Mitigation: Qdrant alias API has been available since v1.x.
- **SQLite path in script.** Hardcoded to `thought-tracing.db`. Must match actual DB path after auth deployment.

### Edge Cases
- **Script run twice.** Alias creation is idempotent (Qdrant returns 200 if alias already exists pointing to same collection). Shared collection creation fails if already exists — script uses `-sf` (silent fail ok) or can be wrapped with existence check.
- **No agents running during migration.** Not required — alias creation is atomic, no downtime needed. Agents can continue using `thought_space` during migration. After alias is created, they work on the same data regardless of which name they use.

## Do
(To be completed by DEV agent — primarily the migration script)

## Study
- Alias `thought_space_thomas` resolves to same data as `thought_space`
- Point count matches before/after (1817)
- Thomas user record updated to `thought_space_thomas`
- Shared collection created with correct indexes
- Script is idempotent

## Act
- Run migration after auth + routing are deployed
- Monitor: no 404 errors on collection access
- Consider: remove `thought_space` physical name reference from DEFAULT_COLLECTION after all callers use auth
