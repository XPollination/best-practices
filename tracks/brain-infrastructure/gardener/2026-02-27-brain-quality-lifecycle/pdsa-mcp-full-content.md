# PDSA: MCP Full Content Exposure

**Task:** `gardener-mcp-full-content`
**Date:** 2026-02-27
**Phase:** Plan

## Plan

Wire existing Brain API capabilities through the MCP wrapper so agents can read full thought content.

### Problem
- API has `full_content=true` param and `GET /thought/:id` endpoint (both deployed)
- MCP wrapper (`brain-mcp.ts`) does not expose either
- Agents see only 80-char previews with no drill-down capability
- This blocks all gardening work (T4, T5, T7 depend on it)

### Design

**File:** `best-practices/api/src/mcp/brain-mcp.ts`

1. **`callBrain()` — add `full_content` param**
   - When true, include `full_content: true` in request body
   - Backward compatible: undefined/false = current behavior

2. **`query_brain` tool — add `include_full_content` param**
   - `include_full_content: z.boolean().optional()`
   - Pass through to `callBrain()`
   - Sources will include `content` field with full text instead of 80-char preview

3. **New `drill_down_thought` tool**
   - Param: `thought_id: z.string()`
   - Calls `GET http://localhost:3200/api/v1/memory/thought/{thought_id}`
   - Returns complete thought JSON

**File:** `best-practices/api/src/mcp/brain-mcp.test.ts`

4. **New acceptance tests**
   - AC-B7: `query_brain` with `include_full_content: true` returns `content` field in sources
   - AC-B8: `drill_down_thought` returns full thought by valid ID
   - AC-B9: `drill_down_thought` with invalid ID returns error
   - AC-B10: `tools/list` includes `drill_down_thought`

### Acceptance Criteria
- `tools/list` returns 3 tools (query_brain, contribute_to_brain, drill_down_thought)
- `query_brain({prompt:"test", include_full_content:true})` returns sources with full content
- `drill_down_thought({thought_id:"<valid>"})` returns complete thought
- `query_brain({prompt:"test"})` without flag returns 80-char previews (backward compat)

### Effort
Small — wiring existing API through MCP interface. ~30 lines of code changes.

## Do
(DEV implements)

## Study
(Post-implementation)

## Act
(Post-study)
