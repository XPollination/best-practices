# PDSA: Multi-User Maria Test — End-to-End Provision + Isolation

**Date:** 2026-03-02
**Task:** multi-user-maria-test
**Parent:** multi-user-brain-research
**Depends On:** multi-user-auth, multi-user-routing, multi-user-mcp-config, multi-user-migration, multi-user-provision-script
**Status:** PLAN

## Plan

### Problem
Multi-user brain infrastructure has been implemented across 5 tasks (auth, routing, migration, mcp-config, provision-script). Each was tested individually. Now we need end-to-end verification that a real second user (Maria) can be provisioned and that complete isolation holds.

### Pre-Conditions
Before running these tests, the following must be true:
1. Brain API running at `localhost:3200`
2. Qdrant running at `localhost:6333`
3. `migrate-thomas-alias.sh` has been run (Thomas alias exists)
4. `sqlite3` CLI installed (`apt install sqlite3`)
5. Thomas user exists in `users` table with `qdrant_collection = thought_space_thomas`

### Test Design

#### Script: `api/scripts/e2e-maria-test.sh`
**File:** `api/scripts/e2e-maria-test.sh` (NEW)

A bash script that runs all verification steps sequentially and reports pass/fail for each.

```bash
#!/bin/bash
# End-to-end multi-user isolation test
# Provisions Maria, verifies isolation against Thomas
# Usage: bash api/scripts/e2e-maria-test.sh
set -euo pipefail

BRAIN_API="http://localhost:3200"
QDRANT="http://localhost:6333"
PASS=0
FAIL=0

# Helper: assert_eq <expected> <actual> <test_name>
assert_eq() { ... }
# Helper: assert_contains <string> <substring> <test_name>
assert_contains() { ... }
# Helper: assert_http_status <url> <method> <expected_status> <test_name> [body] [auth_header]
assert_http_status() { ... }
```

#### Test Phases

**Phase 1: Provision Maria**
```
T1.1: Run provision-user.sh maria "Maria Pichler"
T1.2: Verify Qdrant collection thought_space_maria exists
T1.3: Verify collection has 384-dim Cosine vectors
T1.4: Verify all 11 payload indexes exist
T1.5: Verify Maria user record in SQLite (user_id, display_name, qdrant_collection)
T1.6: Extract Maria's API key for subsequent tests
T1.7: Verify thought_space_shared exists
```

**Phase 2: Authentication Isolation**
```
T2.1: Maria API key → 200 on /api/v1/memory (POST with read_only)
T2.2: Thomas API key → 200 on /api/v1/memory (POST with read_only)
T2.3: Invalid API key → 401
T2.4: Missing Authorization header → 401
T2.5: Empty Bearer token → 401
```

**Phase 3: Private Space Isolation — Write**
```
T3.1: Maria contributes thought "Maria test thought: Isolation verification" via her API key
T3.2: Verify thought appears in Qdrant thought_space_maria (direct Qdrant check)
T3.3: Verify thought does NOT appear in thought_space_thomas (direct Qdrant check)
T3.4: Thomas contributes thought "Thomas test thought: Cross-user check" via his API key
T3.5: Verify thought appears in thought_space_thomas (or thought_space via alias)
T3.6: Verify thought does NOT appear in thought_space_maria
```

**Phase 4: Private Space Isolation — Read**
```
T4.1: Maria queries "isolation verification" via her API key → finds her thought
T4.2: Maria queries "Cross-user check" via her API key → does NOT find Thomas's thought
T4.3: Thomas queries "Cross-user check" via his API key → finds his thought
T4.4: Thomas queries "isolation verification" via his API key → does NOT find Maria's thought
```

**Phase 5: Shared Space (if implemented)**
```
T5.1: Maria contributes to shared space (space: "shared") → thought in thought_space_shared
T5.2: Thomas queries shared space → can find Maria's shared thought
T5.3: Maria queries shared space → can find Thomas's shared thoughts
T5.4: Shared contribution does NOT appear in private collections
```

**Phase 6: Idempotency**
```
T6.1: Re-run provision-user.sh maria "Maria Pichler" → no error
T6.2: Maria API key unchanged (same as Phase 1)
T6.3: Maria collection unchanged (no duplicate or recreated)
```

**Phase 7: Cleanup**
```
T7.1: Delete Maria test thoughts from Qdrant (clean up test data)
T7.2: Report summary: X passed, Y failed
```

### Acceptance Criteria

| ID | Criterion | Phase |
|----|-----------|-------|
| AC-MMT1 | Maria provisioned with unique collection and API key | T1 |
| AC-MMT2 | Authentication rejects invalid/missing keys | T2 |
| AC-MMT3 | Maria's private writes only appear in her collection | T3 |
| AC-MMT4 | Maria's private reads only return her thoughts | T4 |
| AC-MMT5 | Thomas cannot see Maria's private thoughts | T3-T4 |
| AC-MMT6 | Shared space accessible to both users | T5 |
| AC-MMT7 | Provisioning is idempotent | T6 |

### Files Modified

| File | Change |
|------|--------|
| `api/scripts/e2e-maria-test.sh` | NEW: End-to-end test script |

### NOT Changed
- Brain API code (already multi-user)
- Qdrant schema
- Auth middleware
- MCP connector

### Implementation Notes for DEV

1. **Use curl for all API calls** — the test is bash, not TypeScript. Direct HTTP calls to brain API.
2. **Extract Maria's API key** from provision-user.sh output (grep for "API Key:" line) or query SQLite directly.
3. **Direct Qdrant queries** for collection verification — `GET /collections/{name}` for existence, `POST /collections/{name}/points/scroll` for point checks.
4. **Test thoughts should be identifiable** — use unique prefixes like "MARIA_E2E_TEST:" and "THOMAS_E2E_TEST:" so cleanup can target them.
5. **Shared space test** depends on `space: "shared"` parameter support in memory.ts. The `resolveCollection()` function already handles this.
6. **Assert helpers** should print colored pass/fail and count totals.

### Risks
- **sqlite3 not installed**: Same pre-req as migration and provision scripts. Document in test header.
- **Qdrant state**: Test assumes clean state or tolerable existing data. Use unique thought content to avoid false positives.
- **Thomas alias must exist**: If migration hasn't run, Thomas queries may route to wrong collection. Pre-condition check at test start.

### Edge Cases
- **Brain returns similar thoughts**: Similarity search may return unrelated results with low scores. Tests should verify the specific thought content exists in results, not just that results are returned.
- **Shared space may not filter by user**: Shared space is communal. Both users' thoughts coexist — that's by design, not a bug.

## Do
(To be completed by DEV agent)

## Study
- Maria provisioned successfully with unique collection + API key
- Private space writes are isolated (cross-collection verification)
- Private space reads are isolated (cross-user queries return empty)
- Shared space is accessible to both users
- Authentication rejects invalid keys
- Provisioning is idempotent

## Act
- If all tests pass: multi-user infrastructure is verified, ready for production use
- If isolation fails: identify which layer (auth, routing, thoughtspace) leaks and fix
- Next: Enable Robin self-service provisioning with documented instructions
