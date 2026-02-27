# PDSA: Retroactive Categorization (T7)

**Task:** `gardener-retroactive-categorization`
**Date:** 2026-02-27
**Phase:** Plan

## Plan

### What
Batch job to categorize existing uncategorized thoughts. Currently `thought_category` and `topic` are set only at creation time — existing thoughts have `thought_category: "uncategorized"` and `topic: null`. This makes them invisible to category/topic filters. T7 retroactively assigns categories and topics using LLM classification.

### Problem Analysis

1. **No metadata update endpoint exists.** The brain API has no PATCH/PUT route for updating thought metadata. The only options are:
   - Direct Qdrant `setPayload()` (internal only, no HTTP endpoint)
   - `refines` (creates new thought, supersedes original — too destructive)

2. **Discovery gap.** `client.scroll()` with `thought_category: "uncategorized"` filter can find all unclassified thoughts. Full content is in the Qdrant payload — no additional fetch needed.

3. **Classification needs LLM.** The agent running the gardener IS the LLM. The gardener reads thought content, reasons about the category/topic, then calls the update endpoint.

### Design

**Two changes needed:**

#### Change 1: New API endpoint — `PATCH /api/v1/memory/thought/:id/metadata`

**File:** `best-practices/api/src/routes/memory.ts`

Add a new route that updates metadata fields on an existing thought without changing its content or vector:

```typescript
app.patch<{
  Params: { id: string };
  Body: {
    thought_category?: ThoughtCategory;
    topic?: string;
    temporal_scope?: string;
    quality_flags?: string[];
  };
}>("/api/v1/memory/thought/:id/metadata", async (request, reply) => {
  const { id } = request.params;
  const { thought_category, topic, temporal_scope, quality_flags } = request.body;

  // Verify thought exists
  const existing = await getThoughtById(id);
  if (!existing) {
    return reply.status(404).send({
      error: { code: "THOUGHT_NOT_FOUND", message: `Thought ${id} not found` }
    });
  }

  // Build payload update (only include provided fields)
  const update: Record<string, unknown> = {};
  if (thought_category !== undefined) update.thought_category = thought_category;
  if (topic !== undefined) update.topic = topic;
  if (temporal_scope !== undefined) update.temporal_scope = temporal_scope;
  if (quality_flags !== undefined) update.quality_flags = quality_flags;

  if (Object.keys(update).length === 0) {
    return reply.status(400).send({
      error: { code: "NO_FIELDS", message: "At least one metadata field must be provided" }
    });
  }

  // Apply via setPayload
  await updateThoughtMetadata(id, update);

  return reply.send({ success: true, thought_id: id, updated: Object.keys(update) });
});
```

**File:** `best-practices/api/src/services/thoughtspace.ts`

Add a new exported function:

```typescript
export async function updateThoughtMetadata(
  thoughtId: string,
  fields: Record<string, unknown>
): Promise<void> {
  await client.setPayload(COLLECTION, {
    points: [thoughtId],
    payload: fields,
    wait: true,
  });
}
```

#### Change 2: New API endpoint — `GET /api/v1/memory/thoughts/uncategorized`

**File:** `best-practices/api/src/routes/memory.ts`

Add a listing endpoint that scrolls uncategorized thoughts with pagination:

```typescript
app.get<{
  Querystring: { limit?: number; offset?: string };
}>("/api/v1/memory/thoughts/uncategorized", async (request, reply) => {
  const limit = Math.min(request.query.limit ?? 50, 100);
  const offset = request.query.offset;

  const result = await listUncategorizedThoughts(limit, offset);

  return reply.send({
    thoughts: result.thoughts,
    next_offset: result.nextOffset,
    total_returned: result.thoughts.length,
  });
});
```

**File:** `best-practices/api/src/services/thoughtspace.ts`

Add a listing function:

```typescript
export async function listUncategorizedThoughts(
  limit: number,
  offset?: string
): Promise<{
  thoughts: Array<{
    thought_id: string;
    content: string;
    contributor_name: string;
    thought_category: string;
    topic: string | null;
    created_at: string;
    tags: string[];
  }>;
  nextOffset: string | null;
}> {
  const scrollResult = await client.scroll(COLLECTION, {
    filter: {
      should: [
        { key: "thought_category", match: { value: "uncategorized" } },
        { is_empty: { key: "thought_category" } },
      ],
    },
    limit,
    with_payload: true,
    with_vector: false,
    offset: offset || undefined,
  });

  const thoughts = scrollResult.points.map((point) => {
    const p = point.payload as Record<string, unknown>;
    return {
      thought_id: String(point.id),
      content: (p.content as string) ?? "",
      contributor_name: (p.contributor_name as string) ?? "unknown",
      thought_category: (p.thought_category as string) ?? "uncategorized",
      topic: (p.topic as string) ?? null,
      created_at: (p.created_at as string) ?? "",
      tags: (p.tags as string[]) ?? [],
    };
  });

  return {
    thoughts,
    nextOffset: scrollResult.next_page_offset
      ? String(scrollResult.next_page_offset)
      : null,
  };
}
```

#### Change 3: Gardener engine — add categorization step

**File:** `best-practices/.claude/skills/xpo.claude.mindspace.garden/SKILL.md`

Add a new **Step 5.5: Retroactive Categorization** between Step 5 (Analyze) and Step 6 (Report):

```markdown
### Step 5.5: Retroactive categorization (deep only)

If `depth=deep` and `scope=full`:

1. Fetch uncategorized thoughts in batches:
   ```bash
   curl -s "http://localhost:3200/api/v1/memory/thoughts/uncategorized?limit=50"
   ```

2. For each thought, classify using the valid ThoughtCategory values:
   - `state_snapshot` — current state of something (config, system, architecture)
   - `decision_record` — why a choice was made
   - `operational_learning` — lesson from doing (bug fix, process insight)
   - `task_outcome` — result of completing a task
   - `correction` — correcting wrong information
   - `transition_marker` — task state change record (TASK START, TASK active→review, etc.)

   Also assign a `topic` string (free-form, short, e.g., "agent-coordination", "gardener", "brain-api").

3. Update each thought's metadata:
   ```bash
   curl -s -X PATCH "http://localhost:3200/api/v1/memory/thought/<id>/metadata" \
     -H "Content-Type: application/json" \
     -d '{"thought_category":"<category>","topic":"<topic>"}'
   ```

4. Continue with next_offset until all batches processed.

5. Report count of categorized thoughts in final report.
```

Note: `transition_marker` is not in the TypeScript type — it is an observed convention in the data. The design should add it to the `ThoughtCategory` type:

```typescript
export type ThoughtCategory =
  | "state_snapshot"
  | "decision_record"
  | "operational_learning"
  | "task_outcome"
  | "correction"
  | "transition_marker"
  | "design_decision"
  | "uncategorized";
```

Added `transition_marker` (used extensively by all agents for TASK START/transition brain markers) and `design_decision` (used by PDSA for design contributions).

### Acceptance Criteria

1. `PATCH /api/v1/memory/thought/:id/metadata` updates category/topic without changing content
2. `GET /api/v1/memory/thoughts/uncategorized` returns paginated list of uncategorized thoughts with full content
3. `ThoughtCategory` type includes `transition_marker` and `design_decision`
4. Gardener engine (SKILL.md) documents retroactive categorization as Step 5.5
5. More than 80% of existing thoughts have a category and topic after a full deep gardening run
6. Does not modify thought content — only metadata fields

### Effort

Medium — new route, new service function, type update, skill doc update.

## Do
(DEV implements)

## Study
(Post-implementation)

## Act
(Post-study)
