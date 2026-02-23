import { QdrantClient } from "@qdrant/js-client-rest";
import { v4 as uuidv4 } from "uuid";
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
    pheromone_weight: 1.0,
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

  return { thought_id: thoughtId, pheromone_weight: 1.0 };
}

// --- retrieve() — Section 4.2 (Phase 1: skip access tracking and pheromone) ---

export async function retrieve(params: RetrieveParams): Promise<RetrieveResult[]> {
  const limit = params.limit ?? 10;

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

  const mapped: RetrieveResult[] = results.map((r) => {
    const p = r.payload as Record<string, unknown>;
    return {
      thought_id: String(r.id),
      content: (p.content as string) ?? "",
      contributor_name: (p.contributor_name as string) ?? "",
      score: r.score,
      pheromone_weight: (p.pheromone_weight as number) ?? 1.0,
      tags: (p.tags as string[]) ?? [],
    };
  });

  // Log to query_log
  const logId = uuidv4();
  try {
    insertQueryLog({
      id: logId,
      agent_id: params.agent_id,
      query_text: "",  // Caller should set this if needed; retrieve() gets embedding not text
      context_text: null,
      query_vector: Buffer.from(new Float32Array(params.query_embedding).buffer),
      returned_ids: JSON.stringify(mapped.map((r) => r.thought_id)),
      session_id: params.session_id,
      timestamp: new Date().toISOString(),
      result_count: mapped.length,
      knowledge_space_id: "ks-default",
    });
  } catch (err) {
    // Log but don't fail retrieval if query_log insert fails
    console.error("Failed to insert query_log:", err);
  }

  return mapped;
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
