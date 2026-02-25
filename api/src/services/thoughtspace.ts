import { QdrantClient } from "@qdrant/js-client-rest";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import { embed, EMBEDDING_DIM } from "./embedding.js";
import { insertQueryLog } from "./database.js";

const COLLECTION = "thought_space";
const client = new QdrantClient({ url: "http://localhost:6333" });

// --- Collection Setup ---

export async function ensureThoughtSpace(): Promise<void> {
  const collections = await client.getCollections();
  const names = collections.collections.map((c) => c.name);

  if (!names.includes(COLLECTION)) {
    await client.createCollection(COLLECTION, {
      vectors: { size: EMBEDDING_DIM, distance: "Cosine" },
      optimizers_config: { default_segment_number: 2 },
      replication_factor: 1,
    });
    console.log("Created collection: thought_space");

    // Create payload indexes per Section 5.1
    const keywordIndexes = [
      "contributor_id",
      "thought_type",
      "tags",
      "knowledge_space_id",
    ];
    const integerIndexes = ["access_count"];
    const floatIndexes = ["pheromone_weight"];
    const datetimeIndexes = ["created_at", "last_accessed"];

    for (const field of keywordIndexes) {
      await client.createPayloadIndex(COLLECTION, {
        field_name: field,
        field_schema: "keyword",
        wait: true,
      });
    }
    for (const field of integerIndexes) {
      await client.createPayloadIndex(COLLECTION, {
        field_name: field,
        field_schema: "integer",
        wait: true,
      });
    }
    for (const field of floatIndexes) {
      await client.createPayloadIndex(COLLECTION, {
        field_name: field,
        field_schema: "float",
        wait: true,
      });
    }
    for (const field of datetimeIndexes) {
      await client.createPayloadIndex(COLLECTION, {
        field_name: field,
        field_schema: "datetime",
        wait: true,
      });
    }

    console.log("Created 8 payload indexes on thought_space");
  }
}

// --- Types ---

export interface ThinkParams {
  content: string;
  contributor_id: string;
  contributor_name: string;
  thought_type: "original" | "refinement" | "consolidation";
  source_ids: string[];
  tags: string[];
  context_metadata?: string;
}

export interface ThinkResult {
  thought_id: string;
  pheromone_weight: number;
}

export interface RetrieveParams {
  query_embedding: number[];
  agent_id: string;
  session_id: string;
  limit?: number;
  filter_tags?: string[];
}

export interface RetrieveResult {
  thought_id: string;
  content: string;
  contributor_name: string;
  score: number;
  pheromone_weight: number;
  tags: string[];
  refined_by?: string;
  superseded?: boolean;
}

export interface LineageResult {
  thought_id: string;
  chain: LineageNode[];
  truncated: boolean;
}

export interface LineageNode {
  thought_id: string;
  thought_type: "original" | "refinement" | "consolidation";
  content_preview: string;
  contributor: string;
  created_at: string;
  source_ids: string[];
  depth: number;
}

// --- think() — Section 4.1 ---

export async function think(params: ThinkParams): Promise<ThinkResult> {
  // Validate
  if (!params.content || params.content.trim().length === 0) {
    throw new ThoughtError("VALIDATION_ERROR", "content is required and must be a non-empty string");
  }
  if (params.content.length > 10000) {
    throw new ThoughtError("VALIDATION_ERROR", "content must be at most 10000 characters");
  }
  if (!params.contributor_id || params.contributor_id.trim().length === 0) {
    throw new ThoughtError("VALIDATION_ERROR", "contributor_id is required");
  }
  if (!params.contributor_name || params.contributor_name.trim().length === 0) {
    throw new ThoughtError("VALIDATION_ERROR", "contributor_name is required");
  }
  const validTypes = ["original", "refinement", "consolidation"];
  if (!validTypes.includes(params.thought_type)) {
    throw new ThoughtError("INVALID_THOUGHT_TYPE", `thought_type must be one of: ${validTypes.join(", ")}`);
  }
  if (
    (params.thought_type === "refinement" || params.thought_type === "consolidation") &&
    (!params.source_ids || params.source_ids.length === 0)
  ) {
    throw new ThoughtError("MISSING_SOURCE_IDS", "source_ids is required for refinement and consolidation thoughts");
  }
  if (params.context_metadata && params.context_metadata.length > 2000) {
    throw new ThoughtError("VALIDATION_ERROR", "context_metadata must be at most 2000 characters");
  }

  // Embed content
  let vector: number[];
  try {
    vector = await embed(params.content);
  } catch (err) {
    throw new ThoughtError("EMBEDDING_FAILED", `Embedding model error: ${err}`);
  }

  // Generate UUID and upsert
  const thoughtId = uuidv4();
  const now = new Date().toISOString();

  // Pheromone inheritance (Section 4.1)
  let initialWeight = 1.0;
  if (params.thought_type === "refinement" && params.source_ids.length > 0) {
    const source = await getThoughtById(params.source_ids[0]);
    if (source) {
      const sourceWeight = (source.pheromone_weight as number) ?? 1.0;
      initialWeight = Math.max(1.0, sourceWeight * 0.5);
    }
  } else if (params.thought_type === "consolidation" && params.source_ids.length > 0) {
    const sources = await getThoughtsByIds(params.source_ids);
    if (sources.length > 0) {
      const avgWeight = sources.reduce((sum, s) => sum + ((s.pheromone_weight as number) ?? 1.0), 0) / sources.length;
      initialWeight = Math.max(1.0, avgWeight * 0.5);
    }
  }

  const payload = {
    contributor_id: params.contributor_id,
    contributor_name: params.contributor_name,
    content: params.content,
    context_metadata: params.context_metadata ?? null,
    created_at: now,
    thought_type: params.thought_type,
    source_ids: params.source_ids,
    tags: params.tags,
    access_count: 0,
    last_accessed: null,
    accessed_by: [],
    access_log: [],
    co_retrieved_with: [],
    pheromone_weight: initialWeight,
    knowledge_space_id: "ks-default",
  };

  try {
    await client.upsert(COLLECTION, {
      wait: true,
      points: [{ id: thoughtId, vector, payload }],
    });
  } catch (err) {
    throw new ThoughtError("QDRANT_ERROR", `Qdrant upsert failed: ${err}`);
  }

  return { thought_id: thoughtId, pheromone_weight: initialWeight };
}

// --- retrieve() — Section 4.2 (Phase 2: full access tracking + pheromone) ---

export async function retrieve(params: RetrieveParams): Promise<RetrieveResult[]> {
  const limit = params.limit ?? 10;
  const sessionId = params.session_id || crypto.randomUUID();
  const now = new Date().toISOString();

  // Build filter if filter_tags provided
  let filter: Record<string, unknown> | undefined;
  if (params.filter_tags && params.filter_tags.length > 0) {
    filter = {
      must: [
        {
          key: "tags",
          match: { any: params.filter_tags },
        },
      ],
    };
  }

  let results;
  try {
    results = await client.search(COLLECTION, {
      vector: params.query_embedding,
      limit,
      with_payload: true,
      ...(filter ? { filter } : {}),
    });
  } catch (err) {
    throw new ThoughtError("QDRANT_ERROR", `Qdrant search failed: ${err}`);
  }

  const resultIds = results.map((r) => String(r.id));

  // Update each result: access tracking + pheromone reinforcement
  for (const r of results) {
    const p = r.payload as Record<string, unknown>;
    const pointId = String(r.id);

    // Access count
    const accessCount = ((p.access_count as number) ?? 0) + 1;

    // Pheromone reinforcement: +0.05, cap 10.0
    const oldWeight = (p.pheromone_weight as number) ?? 1.0;
    const newWeight = Math.min(10.0, oldWeight + 0.05);

    // accessed_by: deduplicated agent_ids
    const accessedBy = (p.accessed_by as string[]) ?? [];
    if (!accessedBy.includes(params.agent_id)) {
      accessedBy.push(params.agent_id);
    }

    // access_log: append entry, cap at 100
    const accessLog = (p.access_log as Array<{ user_id: string; timestamp: string; session_id: string }>) ?? [];
    accessLog.push({ user_id: params.agent_id, timestamp: now, session_id: sessionId });
    while (accessLog.length > 100) {
      accessLog.shift();
    }

    // co_retrieved_with: update pairs
    const coRetrieved = (p.co_retrieved_with as Array<{ thought_id: string; count: number }>) ?? [];
    for (const otherId of resultIds) {
      if (otherId === pointId) continue;
      const existing = coRetrieved.find((e) => e.thought_id === otherId);
      if (existing) {
        existing.count += 1;
      } else {
        if (coRetrieved.length >= 50) {
          // Remove lowest count entry
          let minIdx = 0;
          for (let i = 1; i < coRetrieved.length; i++) {
            if (coRetrieved[i].count < coRetrieved[minIdx].count) minIdx = i;
          }
          coRetrieved.splice(minIdx, 1);
        }
        coRetrieved.push({ thought_id: otherId, count: 1 });
      }
    }

    // Upsert updated payload fields
    try {
      await client.setPayload(COLLECTION, {
        points: [pointId],
        payload: {
          access_count: accessCount,
          pheromone_weight: newWeight,
          last_accessed: now,
          accessed_by: accessedBy,
          access_log: accessLog,
          co_retrieved_with: coRetrieved,
        },
        wait: true,
      });
    } catch (err) {
      console.error(`Failed to update access tracking for ${pointId}:`, err);
    }
  }

  const mapped: RetrieveResult[] = results.map((r) => {
    const p = r.payload as Record<string, unknown>;
    const oldWeight = (p.pheromone_weight as number) ?? 1.0;
    return {
      thought_id: String(r.id),
      content: (p.content as string) ?? "",
      contributor_name: (p.contributor_name as string) ?? "",
      score: r.score,
      pheromone_weight: Math.min(10.0, oldWeight + 0.05),
      tags: (p.tags as string[]) ?? [],
    };
  });

  // Lineage awareness: mark superseded thoughts and adjust scores
  const mappedIds = mapped.map((m) => m.thought_id);
  const refinements = await getRefiningThoughts(mappedIds);
  const supersededIds = new Set<string>();

  for (const m of mapped) {
    const ref = refinements.get(m.thought_id);
    if (ref) {
      m.refined_by = ref.refined_by;
      m.superseded = true;
      supersededIds.add(m.thought_id);
    } else {
      m.superseded = false;
    }
  }

  // Score adjustments
  for (const m of mapped) {
    if (m.superseded) {
      m.score *= 0.7; // 30% penalty for superseded
    }
    // Check if this thought is a refinement of a superseded thought in the result set
    const thoughtPayload = results.find((r) => String(r.id) === m.thought_id)?.payload as Record<string, unknown> | undefined;
    if (thoughtPayload) {
      const sourceIds = (thoughtPayload.source_ids as string[]) ?? [];
      const thoughtType = (thoughtPayload.thought_type as string) ?? "original";
      if ((thoughtType === "refinement" || thoughtType === "consolidation") && sourceIds.some((sid) => supersededIds.has(sid))) {
        m.score = Math.min(1.0, m.score * 1.2); // 20% boost, capped at 1.0
      }
    }
  }

  // Re-sort by adjusted score
  mapped.sort((a, b) => b.score - a.score);

  // Log to query_log
  const logId = uuidv4();
  try {
    insertQueryLog({
      id: logId,
      agent_id: params.agent_id,
      query_text: "",  // Caller sets this if needed; retrieve() gets embedding not text
      context_text: null,
      query_vector: Buffer.from(new Float32Array(params.query_embedding).buffer),
      returned_ids: JSON.stringify(mapped.map((r) => r.thought_id)),
      session_id: sessionId,
      timestamp: now,
      result_count: mapped.length,
      knowledge_space_id: "ks-default",
    });
  } catch (err) {
    console.error("Failed to insert query_log:", err);
  }

  return mapped;
}

// --- Pheromone Decay Job — Section 6, 8 ---

export async function runPheromoneDecay(): Promise<number> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  let updated = 0;
  let offset: string | number | undefined = undefined;

  // Scroll through all points where last_accessed < 1 hour ago
  while (true) {
    const scrollResult = await client.scroll(COLLECTION, {
      filter: {
        must: [
          {
            key: "last_accessed",
            range: { lt: oneHourAgo },
          },
        ],
      },
      limit: 100,
      with_payload: true,
      with_vector: false,
      offset,
    });

    for (const point of scrollResult.points) {
      const p = point.payload as Record<string, unknown>;
      const currentWeight = (p.pheromone_weight as number) ?? 1.0;
      const decayedWeight = Math.max(0.1, currentWeight * 0.995);

      if (decayedWeight !== currentWeight) {
        await client.setPayload(COLLECTION, {
          points: [String(point.id)],
          payload: { pheromone_weight: decayedWeight },
          wait: true,
        });
        updated++;
      }
    }

    if (!scrollResult.next_page_offset) break;
    offset = scrollResult.next_page_offset;
  }

  return updated;
}

let decayInterval: ReturnType<typeof setInterval> | null = null;

export function startPheromoneDecayJob(): void {
  if (decayInterval) return;
  decayInterval = setInterval(async () => {
    try {
      const count = await runPheromoneDecay();
      if (count > 0) {
        console.log(`Pheromone decay: updated ${count} thoughts`);
      }
    } catch (err) {
      console.error("Pheromone decay job failed:", err);
    }
  }, 60 * 60 * 1000); // Every 60 minutes
  console.log("Pheromone decay job started (interval: 60 min)");
}

export function stopPheromoneDecayJob(): void {
  if (decayInterval) {
    clearInterval(decayInterval);
    decayInterval = null;
  }
}

// --- Implicit Feedback — Section 3.10 ---

export async function applyImplicitFeedback(thoughtIds: string[]): Promise<void> {
  for (const id of thoughtIds) {
    try {
      const points = await client.retrieve(COLLECTION, {
        ids: [id],
        with_payload: true,
        with_vector: false,
      });
      if (points.length === 0) continue;
      const p = points[0].payload as Record<string, unknown>;
      const currentWeight = (p.pheromone_weight as number) ?? 1.0;
      const newWeight = Math.min(10.0, currentWeight + 0.02);
      await client.setPayload(COLLECTION, {
        points: [id],
        payload: { pheromone_weight: newWeight },
        wait: true,
      });
    } catch (err) {
      console.error(`Failed to apply implicit feedback to ${id}:`, err);
    }
  }
}

// --- highways() — Section 4.3 ---

export interface HighwayParams {
  min_access?: number;
  min_users?: number;
  limit?: number;
}

export interface HighwayResult {
  thought_id: string;
  content_preview: string;
  access_count: number;
  unique_users: number;
  traffic_score: number;
  pheromone_weight: number;
  tags: string[];
}

export async function highways(params: HighwayParams = {}): Promise<HighwayResult[]> {
  const minAccess = params.min_access ?? 3;
  const minUsers = params.min_users ?? 2;
  const limit = params.limit ?? 20;

  const candidates: HighwayResult[] = [];
  let offset: string | number | undefined = undefined;

  while (true) {
    let scrollResult;
    try {
      scrollResult = await client.scroll(COLLECTION, {
        filter: {
          must: [
            { key: "access_count", range: { gte: minAccess } },
          ],
        },
        limit: 100,
        with_payload: true,
        with_vector: false,
        offset,
      });
    } catch (err) {
      throw new ThoughtError("QDRANT_ERROR", `Qdrant scroll failed: ${err}`);
    }

    for (const point of scrollResult.points) {
      const p = point.payload as Record<string, unknown>;
      const accessedBy = (p.accessed_by as string[]) ?? [];
      if (accessedBy.length < minUsers) continue;

      const accessCount = (p.access_count as number) ?? 0;
      candidates.push({
        thought_id: String(point.id),
        content_preview: ((p.content as string) ?? "").substring(0, 80),
        access_count: accessCount,
        unique_users: accessedBy.length,
        traffic_score: accessCount * accessedBy.length,
        pheromone_weight: (p.pheromone_weight as number) ?? 1.0,
        tags: (p.tags as string[]) ?? [],
      });
    }

    if (!scrollResult.next_page_offset) break;
    offset = scrollResult.next_page_offset;
  }

  candidates.sort((a, b) => b.traffic_score - a.traffic_score);
  return candidates.slice(0, limit);
}

// --- Tag extraction helper — Section 3.8 ---

export async function getExistingTags(): Promise<string[]> {
  const tagSet = new Set<string>();
  let offset: string | number | undefined = undefined;

  while (true) {
    const scrollResult = await client.scroll(COLLECTION, {
      limit: 100,
      with_payload: ["tags"],
      with_vector: false,
      offset,
    });

    for (const point of scrollResult.points) {
      const p = point.payload as Record<string, unknown>;
      const tags = (p.tags as string[]) ?? [];
      for (const tag of tags) {
        tagSet.add(tag);
      }
    }

    if (!scrollResult.next_page_offset) break;
    offset = scrollResult.next_page_offset;
  }

  return Array.from(tagSet);
}

// --- Thought Lookup Helpers ---

export async function getThoughtById(thoughtId: string): Promise<Record<string, unknown> | null> {
  try {
    const points = await client.retrieve(COLLECTION, {
      ids: [thoughtId],
      with_payload: true,
      with_vector: false,
    });
    if (points.length === 0) return null;
    return points[0].payload as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function getThoughtsByIds(thoughtIds: string[]): Promise<Record<string, unknown>[]> {
  if (thoughtIds.length === 0) return [];
  try {
    const points = await client.retrieve(COLLECTION, {
      ids: thoughtIds,
      with_payload: true,
      with_vector: false,
    });
    return points.map((p) => p.payload as Record<string, unknown>);
  } catch {
    return [];
  }
}

// --- getRefiningThoughts() — batch lookup for superseded marking ---

export async function getRefiningThoughts(thoughtIds: string[]): Promise<Map<string, { refined_by: string; created_at: string }>> {
  const result = new Map<string, { refined_by: string; created_at: string }>();
  if (thoughtIds.length === 0) return result;

  try {
    let offset: string | number | undefined = undefined;
    while (true) {
      const scrollResult = await client.scroll(COLLECTION, {
        filter: {
          must: [
            {
              key: "thought_type",
              match: { any: ["refinement", "consolidation"] },
            },
          ],
        },
        limit: 100,
        with_payload: true,
        with_vector: false,
        offset,
      });

      for (const point of scrollResult.points) {
        const p = point.payload as Record<string, unknown>;
        const sourceIds = (p.source_ids as string[]) ?? [];
        const createdAt = (p.created_at as string) ?? "";
        const pointId = String(point.id);

        for (const sourceId of sourceIds) {
          if (thoughtIds.includes(sourceId)) {
            const existing = result.get(sourceId);
            if (!existing || createdAt > existing.created_at) {
              result.set(sourceId, { refined_by: pointId, created_at: createdAt });
            }
          }
        }
      }

      if (!scrollResult.next_page_offset) break;
      offset = scrollResult.next_page_offset as string | number | undefined;
    }
  } catch (err) {
    console.error("getRefiningThoughts failed:", err);
  }

  return result;
}

// --- getLineage() — Section 4.4 ---

export async function getLineage(thoughtId: string, maxDepth: number = 10): Promise<LineageResult> {
  const chain: LineageNode[] = [];
  const visited = new Set<string>();
  let truncated = false;

  // Get the target thought
  const target = await getThoughtById(thoughtId);
  if (!target) {
    return { thought_id: thoughtId, chain: [], truncated: false };
  }

  chain.push({
    thought_id: thoughtId,
    thought_type: (target.thought_type as "original" | "refinement" | "consolidation") ?? "original",
    content_preview: ((target.content as string) ?? "").substring(0, 80),
    contributor: (target.contributor_name as string) ?? "",
    created_at: (target.created_at as string) ?? "",
    source_ids: (target.source_ids as string[]) ?? [],
    depth: 0,
  });
  visited.add(thoughtId);

  // Traverse UP (ancestors via source_ids)
  async function traverseUp(id: string, currentDepth: number): Promise<void> {
    if (currentDepth >= maxDepth) { truncated = true; return; }
    const thought = await getThoughtById(id);
    if (!thought) return;
    const sourceIds = (thought.source_ids as string[]) ?? [];
    for (const sourceId of sourceIds) {
      if (visited.has(sourceId)) continue;
      visited.add(sourceId);
      const source = await getThoughtById(sourceId);
      if (!source) continue;
      chain.push({
        thought_id: sourceId,
        thought_type: (source.thought_type as "original" | "refinement" | "consolidation") ?? "original",
        content_preview: ((source.content as string) ?? "").substring(0, 80),
        contributor: (source.contributor_name as string) ?? "",
        created_at: (source.created_at as string) ?? "",
        source_ids: (source.source_ids as string[]) ?? [],
        depth: -(currentDepth + 1),
      });
      await traverseUp(sourceId, currentDepth + 1);
    }
  }

  // Traverse DOWN (descendants that reference this thought)
  async function traverseDown(id: string, currentDepth: number): Promise<void> {
    if (currentDepth >= maxDepth) { truncated = true; return; }
    try {
      const scrollResult = await client.scroll(COLLECTION, {
        filter: {
          must: [
            {
              key: "thought_type",
              match: { any: ["refinement", "consolidation"] },
            },
          ],
        },
        limit: 100,
        with_payload: true,
        with_vector: false,
      });

      for (const point of scrollResult.points) {
        const p = point.payload as Record<string, unknown>;
        const sourceIds = (p.source_ids as string[]) ?? [];
        const pointId = String(point.id);
        if (sourceIds.includes(id) && !visited.has(pointId)) {
          visited.add(pointId);
          chain.push({
            thought_id: pointId,
            thought_type: (p.thought_type as "original" | "refinement" | "consolidation") ?? "original",
            content_preview: ((p.content as string) ?? "").substring(0, 80),
            contributor: (p.contributor_name as string) ?? "",
            created_at: (p.created_at as string) ?? "",
            source_ids: sourceIds,
            depth: currentDepth + 1,
          });
          await traverseDown(pointId, currentDepth + 1);
        }
      }
    } catch (err) {
      console.error("getLineage traverseDown failed:", err);
    }
  }

  await traverseUp(thoughtId, 0);
  await traverseDown(thoughtId, 0);

  // Sort by depth
  chain.sort((a, b) => a.depth - b.depth);

  return { thought_id: thoughtId, chain, truncated };
}

// --- Error class ---

export class ThoughtError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "ThoughtError";
  }
}
