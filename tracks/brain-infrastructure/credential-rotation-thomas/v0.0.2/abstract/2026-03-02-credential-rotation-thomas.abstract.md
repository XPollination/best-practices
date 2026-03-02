# Completion Abstract: credential-rotation-thomas

**Date:** 2026-03-02
**Status:** Complete
**Project:** best-practices

## Outcome

Rotated Thomas's API key from hardcoded `default-thomas-key` to proper UUID. Removed all hardcoded credential fallbacks from source code. All brain API callers now require explicit `BRAIN_API_KEY` environment variable — missing key fails loudly instead of silently authenticating.

## Key Decisions

- **Fail-loud over fail-safe:** `brain-mcp.ts` throws on missing `BRAIN_API_KEY` instead of falling back to a default.
- **Seed placeholder:** `database.ts` now seeds `MUST_SET_VIA_PROVISION` — unusable as a real key, forces proper provisioning.
- **Cross-repo change:** `interface-cli.js` in xpollination-mcp-server also updated with auth headers.
- **No .env.brain file created:** Key lives in SQLite `users` table and must be set in env at launch. Documentation needed for deployment.

## Changes

- `api/src/mcp/brain-mcp.ts`: Removed hardcoded fallback, throws on missing env
- `api/src/services/database.ts`: Seed uses MUST_SET_VIA_PROVISION placeholder
- `api/data/thought-tracing.db`: Thomas key rotated to UUID
- `scripts/xpo.claude.compact-recover.sh`: Added Authorization Bearer header
- `scripts/xpo.claude.brain-first-hook.sh`: Added Authorization Bearer header
- `scripts/xpo.claude.precompact-save.sh`: Added Authorization Bearer header
- `scripts/test-reflection-skill.sh`: Added Authorization Bearer header
- `xpollination-mcp-server/src/db/interface-cli.js`: Auth headers on contributeToBrain + microGarden
- 4 test files: Replaced hardcoded keys with process.env.BRAIN_API_KEY
- Commits: 51b4bb7 (best-practices), fc55f74 (xpollination-mcp-server)

## Test Results

- 21/21 credential-rotation tests pass
- 32/32 regression tests pass
- QA PASS, PDSA PASS

## Security Note

Old key `default-thomas-key` now returns 401. Thomas's Claude Web AI MCP config must be updated with new UUID key.

## Related Documentation

- PDSA: [2026-03-02-credential-rotation-thomas.pdsa.md](../pdsa/2026-03-02-credential-rotation-thomas.pdsa.md)
- Origin: Thomas security review feedback on multi-user initiative
