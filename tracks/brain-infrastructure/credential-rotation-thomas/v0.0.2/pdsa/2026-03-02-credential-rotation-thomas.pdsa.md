# PDSA: Credential Rotation — Remove Hardcoded default-thomas-key

**Date:** 2026-03-02
**Task:** credential-rotation-thomas
**Version:** v0.0.2 (security patch)
**Status:** PLAN

## Plan

### Problem
`brain-mcp.ts` line 9 has `const BRAIN_API_KEY = process.env.BRAIN_API_KEY || "default-thomas-key"`. This hardcoded fallback means:
1. Credential is in git history forever
2. Predictable key (not a UUID)
3. Every repo clone has the key
4. 5 shell scripts and interface-cli.js call brain API **without any Authorization header** — they currently get 401 (or worked before auth was added)

### Audit: All Brain API Callers

| Caller | Sends Auth? | Fix Needed |
|--------|-------------|------------|
| `api/src/mcp/brain-mcp.ts` | Yes (from env with hardcoded fallback) | Remove fallback, fail on missing |
| `xpollination-mcp-server/src/db/interface-cli.js` (brain gate) | **No** | Add Authorization header |
| `scripts/xpo.claude.compact-recover.sh` | **No** | Add Authorization header |
| `scripts/xpo.claude.brain-first-hook.sh` | **No** | Add Authorization header |
| `scripts/xpo.claude.precompact-save.sh` | **No** | Add Authorization header |
| `scripts/test-reflection-skill.sh` | **No** | Add Authorization header |
| `scripts/deploy-brain-api.sh` | N/A (health check only) | No change (health is exempt) |
| `scripts/qdrant-backup.sh` | N/A (health check only) | No change |
| Test files (*.test.ts) | Yes (use const THOMAS_KEY) | Update to use env var |
| Agent monitor skill (/xpo.claude.monitor) | Via curl with manual header | Already works |

### Design

#### Step 1: Generate UUID Key for Thomas

```bash
NEW_KEY=$(uuidgen)
# Store securely — NOT in git
echo "BRAIN_API_KEY=$NEW_KEY" >> /home/developer/.env.brain
```

#### Step 2: Update SQLite

```sql
UPDATE users SET api_key = '<NEW_UUID>' WHERE user_id = 'thomas';
```

Also update the seed in `database.ts`:

```typescript
// BEFORE (line ~50):
VALUES ('thomas', 'Thomas Pichler', 'default-thomas-key', 'thought_space');

// AFTER:
// Seed only creates if table is empty. Uses placeholder — real key set by provision script.
VALUES ('thomas', 'Thomas Pichler', 'MUST_SET_VIA_PROVISION', 'thought_space');
```

The seed is a bootstrap fallback. In production, the key is set by provisioning or manual SQL. The seed should NOT contain a usable credential.

#### Step 3: Remove Hardcoded Fallback in brain-mcp.ts

```typescript
// BEFORE:
const BRAIN_API_KEY = process.env.BRAIN_API_KEY || "default-thomas-key";

// AFTER:
const BRAIN_API_KEY = process.env.BRAIN_API_KEY;
if (!BRAIN_API_KEY) {
  throw new Error("BRAIN_API_KEY environment variable is required. Set it to your API key from the users table.");
}
```

Same for BRAIN_AGENT_ID and BRAIN_AGENT_NAME — remove defaults, require env vars.

#### Step 4: Add Auth to interface-cli.js Brain Gate

```javascript
// In contributeTransitionMarker() and microGarden():
const BRAIN_API_KEY = process.env.BRAIN_API_KEY || '';
// ...
headers: {
  'Content-Type': 'application/json',
  'Content-Length': Buffer.byteLength(data),
  'Authorization': `Bearer ${BRAIN_API_KEY}`  // ADD THIS
},
```

If `BRAIN_API_KEY` is not set, brain gate silently fails (it already handles errors gracefully). The transition still completes — brain contribution is best-effort.

#### Step 5: Add Auth to Shell Scripts

All scripts that call brain API need:
```bash
# Read key from env (set by claude-session.sh)
BRAIN_KEY="${BRAIN_API_KEY:-}"
if [ -z "$BRAIN_KEY" ]; then
  echo "WARNING: BRAIN_API_KEY not set, brain calls will fail"
fi

# All curl calls add:
-H "Authorization: Bearer $BRAIN_KEY"
```

Scripts to update:
1. `scripts/xpo.claude.compact-recover.sh`
2. `scripts/xpo.claude.brain-first-hook.sh`
3. `scripts/xpo.claude.precompact-save.sh`
4. `scripts/test-reflection-skill.sh`

#### Step 6: Set BRAIN_API_KEY in Session Environment

The `claude-session.sh` launcher needs to set `BRAIN_API_KEY` in the tmux session environment:

```bash
# In claude-session.sh:
export BRAIN_API_KEY="$(cat /home/developer/.env.brain | grep BRAIN_API_KEY | cut -d= -f2)"
```

Or source from `.env.brain` file. The key file lives outside git, readable only by developer user.

#### Step 7: Update Test Files

Test files that hardcode `default-thomas-key` should read from env or use a test-specific constant:

```typescript
// BEFORE:
const THOMAS_KEY = "default-thomas-key";

// AFTER:
const THOMAS_KEY = process.env.BRAIN_API_KEY || "test-key-not-for-production";
```

### Deployment Order (CRITICAL)

1. Generate new UUID key
2. Store in `/home/developer/.env.brain`
3. Update SQLite `users` table with new key
4. Set `BRAIN_API_KEY` env var in current session
5. Deploy code changes (all steps 3-7 above)
6. Restart brain API
7. Verify: brain API responds with new key, rejects old key
8. Update Claude Web AI MCP config with new key

**Important:** Steps 2-4 must happen BEFORE step 5, or the brain API will reject all connections (new code requires env var, but env var not set yet).

### Files Modified

| File | Change |
|------|--------|
| `api/src/mcp/brain-mcp.ts` | Remove hardcoded fallback, require env vars |
| `api/src/services/database.ts` | Change seed key to placeholder |
| `xpollination-mcp-server/src/db/interface-cli.js` | Add Authorization header to brain gate calls |
| `scripts/xpo.claude.compact-recover.sh` | Add Authorization header |
| `scripts/xpo.claude.brain-first-hook.sh` | Add Authorization header |
| `scripts/xpo.claude.precompact-save.sh` | Add Authorization header |
| `scripts/test-reflection-skill.sh` | Add Authorization header |
| Test files (4 files) | Use env var instead of hardcoded key |

### NOT Changed
- Auth middleware (already works correctly)
- Qdrant (no credential involvement)
- Memory routes (auth handled at middleware level)
- Provision-user.sh (already generates UUID keys)

### Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-CRT1 | brain-mcp.ts has no hardcoded credential fallback |
| AC-CRT2 | brain-mcp.ts fails with clear error when BRAIN_API_KEY not set |
| AC-CRT3 | database.ts seed does not contain usable credential |
| AC-CRT4 | interface-cli.js brain gate sends Authorization header |
| AC-CRT5 | All 4 shell scripts send Authorization header |
| AC-CRT6 | Thomas's API key is a UUID (not "default-thomas-key") |
| AC-CRT7 | Old key "default-thomas-key" returns 401 |
| AC-CRT8 | New UUID key returns 200 |
| AC-CRT9 | Test files don't hardcode "default-thomas-key" |

### Risks
- **Breaking all agents during deployment.** Mitigation: deployment order (key first, then code). Session env var set before code deploys.
- **Key stored in .env.brain** could be lost. Mitigation: Thomas can always regenerate via SQLite access.
- **Git history still has "default-thomas-key".** Acceptable — key is being rotated. The old key will stop working after the SQLite update.

## Do
(To be completed by DEV agent)

## Study
- Hardcoded credential removed from source
- All callers authenticated
- UUID key generated and stored securely
- Deployment order prevents service disruption

## Act
- Verify all agents can still contribute to brain with new key
- Monitor for 401 errors in agent logs
- Document key rotation process for future rotations
