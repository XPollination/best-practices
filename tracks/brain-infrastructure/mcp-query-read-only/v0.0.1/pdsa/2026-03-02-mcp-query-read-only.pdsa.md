# PDSA: Add read_only Parameter to MCP query_brain Tool

**Date:** 2026-03-02
**Task:** mcp-query-read-only
**Status:** PLAN

## Plan

### Problem
Brain API already supports `read_only: true` to prevent query persistence (memory.ts line 185-188). Internal agent callers use it. But the MCP `query_brain` tool exposed to Claude Web doesn't expose this parameter. Every Claude Web research session creates ~10 noise entries because queries pass the contribution threshold.

### Design

#### Change 1: Add `read_only` to `callBrain` function signature
**File:** `api/src/mcp/brain-mcp.ts` (line 11)

```typescript
async function callBrain(prompt: string, context?: string, session_id?: string, full_content?: boolean, read_only?: boolean): Promise<unknown> {
  const body: Record<string, unknown> = { prompt, agent_id: AGENT_ID, agent_name: AGENT_NAME };
  if (context) body.context = context;
  if (session_id) body.session_id = session_id;
  if (full_content) body.full_content = true;
  if (read_only) body.read_only = true;
  // ...rest unchanged
}
```

#### Change 2: Add `read_only` to `query_brain` tool schema
**File:** `api/src/mcp/brain-mcp.ts` (lines 48-57)

Add parameter to Zod schema and destructuring:
```typescript
mcp.tool(
  "query_brain",
  "Query the shared agent brain...",
  {
    prompt: z.string().describe("..."),
    context: z.string().optional().describe("..."),
    session_id: z.string().optional().describe("..."),
    include_full_content: z.boolean().optional().describe("..."),
    read_only: z.boolean().optional().describe("When true, query results are returned but the query itself is not stored as a thought"),
  },
  async ({ prompt, context, session_id, include_full_content, read_only }) => {
    const data = await callBrain(prompt, context, session_id, include_full_content ?? undefined, read_only ?? undefined) as Record<string, unknown>;
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  }
);
```

#### Change 3: Deploy
Restart MCP server (port 3201) to expose updated tool schema.

### NOT Changed
- Brain API itself (already supports read_only)
- `contribute_to_brain` tool (contributions should always persist)
- `drill_down_thought` tool (reads only, no writes)
- Default behavior (omitting read_only = current behavior = may persist)

### Files Modified
| File | Change |
|------|--------|
| `api/src/mcp/brain-mcp.ts` | Add `read_only` param to callBrain + query_brain tool |

### Risks
- None. Additive change. Backward compatible. Single file.

## Do
(To be completed by DEV agent)

## Study
- MCP tools/list shows read_only parameter on query_brain
- Query with read_only:true returns results but trace shows `thoughts_contributed: 0`
- Query without read_only behaves as before

## Act
- Consider making read_only the default for Claude Web sessions (future iteration)
