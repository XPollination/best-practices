# Completion Abstract: multi-user-mcp-config

**Date:** 2026-03-02
**Status:** Complete
**Project:** best-practices

## Outcome

MCP connector now supports per-user authentication via environment variables. Each user configures BRAIN_API_KEY, BRAIN_AGENT_ID, and BRAIN_AGENT_NAME. Authorization Bearer header sent on all brain API calls. Config template provided for Claude Web AI users.

## Key Decisions

- **Env var approach:** BRAIN_API_KEY/ID/NAME read from environment with Thomas defaults for backward compatibility.
- **Bearer header on all calls:** Both callBrain() and getThought() include Authorization header.
- **JSON config template:** api/scripts/mcp-config-template.json for Claude Web AI setup.

## Changes

- `api/src/brain-mcp.ts`: Reads env vars, adds Authorization Bearer to API calls
- `api/scripts/mcp-config-template.json`: New config template for Claude Web AI users
- Commit: b78fdff

## Test Results

- 7/7 tests pass
- QA PASS, PDSA PASS

## Related Documentation

- PDSA: [2026-03-02-multi-user-mcp-config.pdsa.md](../pdsa/2026-03-02-multi-user-mcp-config.pdsa.md)
- Part of: multi-user-brain initiative (task 5 of 8)
