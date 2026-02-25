import type { FastifyInstance } from "fastify";
import crypto from "crypto";
import { embed } from "../services/embedding.js";
import { think, retrieve, applyImplicitFeedback, highways, getExistingTags, getThoughtById, getLineage, ThoughtError } from "../services/thoughtspace.js";
import { getAgentQueryCount, getSessionReturnedIds } from "../services/database.js";

// --- Contribution Threshold (Section 3.5) ---

function meetsContributionThreshold(prompt: string): boolean {
  // 1. Length > 50
  if (prompt.length <= 50) return false;

  // 2. Not purely interrogative: single sentence ending in ? with no . or ! before it
  if (/^[^.!]*\?$/.test(prompt)) return false;

  // 3. Not a follow-up reference
  const lower = prompt.toLowerCase();
  const followUpPrefixes = ["based on", "you said", "you told me", "regarding your", "about your response"];
  for (const prefix of followUpPrefixes) {
    if (lower.startsWith(prefix)) return false;
  }

  return true;
}

// --- Tag Extraction (Section 3.8) ---
// Match prompt against existing tag values (done at /memory level with retrieve results)

function extractTagsFromResults(prompt: string, existingTags: string[]): string[] {
  const lower = prompt.toLowerCase();
  return existingTags.filter((tag) => lower.includes(tag.toLowerCase()));
}

// --- Route ---

interface MemoryRequest {
  prompt: string;
  agent_id: string;
  agent_name: string;
  context?: string;
  session_id?: string;
  refines?: string;
  consolidates?: string[];
}

async function handleMemoryRequest(params: MemoryRequest, reply: import("fastify").FastifyReply) {
  const { prompt, agent_id, agent_name, context, session_id, refines, consolidates } = params;

    // Step 1: Validate request (Section 3.3)
    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return reply.status(400).send({
        error: { code: "VALIDATION_ERROR", message: "prompt is required and must be a non-empty string" },
      });
    }
    if (prompt.length > 10000) {
      return reply.status(400).send({
        error: { code: "VALIDATION_ERROR", message: "prompt must be at most 10000 characters" },
      });
    }
    if (!agent_id || typeof agent_id !== "string" || agent_id.trim().length === 0) {
      return reply.status(400).send({
        error: { code: "VALIDATION_ERROR", message: "agent_id is required and must be a non-empty string" },
      });
    }
    if (agent_id.length > 100) {
      return reply.status(400).send({
        error: { code: "VALIDATION_ERROR", message: "agent_id must be at most 100 characters" },
      });
    }
    if (!agent_name || typeof agent_name !== "string" || agent_name.trim().length === 0) {
      return reply.status(400).send({
        error: { code: "VALIDATION_ERROR", message: "agent_name is required and must be a non-empty string" },
      });
    }
    if (agent_name.length > 200) {
      return reply.status(400).send({
        error: { code: "VALIDATION_ERROR", message: "agent_name must be at most 200 characters" },
      });
    }
    if (context && context.length > 2000) {
      return reply.status(400).send({
        error: { code: "VALIDATION_ERROR", message: "context must be at most 2000 characters" },
      });
    }

    // Validate refines/consolidates mutual exclusion
    if (refines && consolidates && consolidates.length > 0) {
      return reply.status(400).send({
        error: { code: "MUTUAL_EXCLUSION", message: "Cannot provide both refines and consolidates in the same request" },
      });
    }
    if (consolidates && consolidates.length < 2) {
      return reply.status(400).send({
        error: { code: "MIN_CONSOLIDATION", message: "consolidates must contain at least 2 thought IDs" },
      });
    }

    // Validate referenced thoughts exist
    if (refines) {
      const sourceThought = await getThoughtById(refines);
      if (!sourceThought) {
        return reply.status(404).send({
          error: { code: "THOUGHT_NOT_FOUND", message: `Thought ${refines} not found` },
        });
      }
    }
    if (consolidates) {
      for (const id of consolidates) {
        const sourceThought = await getThoughtById(id);
        if (!sourceThought) {
          return reply.status(404).send({
            error: { code: "THOUGHT_NOT_FOUND", message: `Thought ${id} not found` },
          });
        }
      }
    }

    // Step 2: Generate session_id if not provided
    const sessionId = session_id || crypto.randomUUID();

    const operations: string[] = [];
    let thoughtsContributed = 0;
    let contributedThoughtId: string | undefined;

    // Step 3: Check contribution threshold (Section 3.5)
    // Bypass threshold when refines or consolidates is provided (explicit iteration)
    const isExplicitIteration = !!(refines || consolidates);
    const thresholdMet = isExplicitIteration || meetsContributionThreshold(prompt.trim());

    if (thresholdMet) {
      try {
        // Tag extraction (Section 3.8): match prompt against existing tags
        const existingTags = await getExistingTags();
        const extractedTags = extractTagsFromResults(prompt.trim(), existingTags);

        // Determine thought_type and source_ids
        let thought_type: "original" | "refinement" | "consolidation" = "original";
        let source_ids: string[] = [];

        if (refines) {
          thought_type = "refinement";
          source_ids = [refines];
        } else if (consolidates) {
          thought_type = "consolidation";
          source_ids = consolidates;
        }

        const thinkResult = await think({
          content: prompt.trim(),
          contributor_id: agent_id,
          contributor_name: agent_name,
          thought_type,
          source_ids,
          tags: extractedTags,
          context_metadata: context ?? undefined,
        });
        contributedThoughtId = thinkResult.thought_id;
        thoughtsContributed = 1;
        operations.push("contribute");
      } catch (err) {
        if (err instanceof ThoughtError) {
          return reply.status(err.code === "VALIDATION_ERROR" ? 400 : 500).send({
            error: { code: err.code, message: err.message },
          });
        }
        return reply.status(500).send({
          error: { code: "INTERNAL_ERROR", message: "Failed to store thought" },
        });
      }
    }

    // Step 4: Embed prompt (with context concatenation if context provided — Section 3.6)
    let queryEmbedding: number[];
    try {
      const textToEmbed = context ? `${context} ${prompt.trim()}` : prompt.trim();
      queryEmbedding = await embed(textToEmbed);
    } catch (err) {
      return reply.status(500).send({
        error: { code: "EMBEDDING_FAILED", message: `Embedding model error: ${err}` },
      });
    }

    // Step 5: Call retrieve()
    let retrieveResults;
    try {
      retrieveResults = await retrieve({
        query_embedding: queryEmbedding,
        agent_id,
        session_id: sessionId,
        limit: 10,
        filter_tags: [],
      });
      operations.push("retrieve");
    } catch (err) {
      if (err instanceof ThoughtError) {
        return reply.status(500).send({
          error: { code: err.code, message: err.message },
        });
      }
      return reply.status(500).send({
        error: { code: "INTERNAL_ERROR", message: "Retrieval failed" },
      });
    }

    // Reinforce operations
    if (retrieveResults.length > 0) {
      operations.push("reinforce");
    }

    // Step 6: Disambiguation (Section 3.8)
    let disambiguation: { total_found: number; clusters: Array<{ tag: string; count: number }> } | null = null;
    let responseText: string;

    // Collect all tags from results
    const allTags = new Map<string, number>();
    for (const r of retrieveResults) {
      for (const tag of r.tags) {
        allTags.set(tag, (allTags.get(tag) ?? 0) + 1);
      }
    }

    if (retrieveResults.length >= 10 && allTags.size >= 3) {
      // Disambiguation triggered
      const clusters = Array.from(allTags.entries())
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count);

      disambiguation = {
        total_found: retrieveResults.length,
        clusters,
      };

      const clusterDesc = clusters.map((c) => `${c.tag} (${c.count})`).join(", ");
      responseText = `I found ${retrieveResults.length} thoughts across ${clusters.length} areas: ${clusterDesc}. Which area interests you?`;
      operations.push("disambiguate");

      // Filter sources to largest cluster
      const largestTag = clusters[0].tag;
      retrieveResults = retrieveResults.filter((r) => r.tags.includes(largestTag)).slice(0, 5);
    } else {
      // Normal response: top-3 formatted
      const top3 = retrieveResults.slice(0, 3);
      if (top3.length > 0) {
        responseText = top3
          .map((r, i) => `[${i + 1}] ${r.contributor_name}: ${r.content.substring(0, 80)} (score: ${r.score.toFixed(2)})`)
          .join("\n");
      } else {
        responseText = "No related thoughts found yet. Share what you're learning and I'll remember it.";
      }
    }

    // Step 7: New agent onboarding (Section 3.9)
    let guidance: string | null = null;
    const agentQueryCount = getAgentQueryCount(agent_id);
    // agentQueryCount is checked BEFORE this query is logged (the retrieve() above already logged one)
    // So first-time agent will have exactly 1 entry (from the retrieve above). Check <= 1.
    if (agentQueryCount <= 1) {
      guidance = "Welcome! I haven't seen you before. I'll track your interests as you interact. Ask me anything or share what you're learning.";
      operations.push("onboard");
    }

    // Step 7b: Refinement suggestion (Q5) — when contributing original, check for similar existing thought
    if (thresholdMet && !isExplicitIteration && retrieveResults.length > 0) {
      const topMatch = retrieveResults[0];
      if (topMatch.score > 0.85) {
        const suggestion = `Similar thought exists (id: ${topMatch.thought_id}, preview: '${topMatch.content.substring(0, 60)}...'). Consider using /brain refine ${topMatch.thought_id} "updated insight" instead.`;
        guidance = guidance ? `${guidance}\n\n${suggestion}` : suggestion;
      }
    }

    // Step 8: Implicit feedback (Section 3.10)
    if (session_id && thresholdMet) {
      // Agent contributed after a previous session query
      const previousIds = getSessionReturnedIds(session_id);
      if (previousIds.length > 0) {
        await applyImplicitFeedback(previousIds);
        operations.push("feedback_implicit");
      }
    }

    // Step 9: Highways (Section 4.3)
    let highwaysNearby: string[] = [];
    try {
      const hw = await highways({ min_access: 3, min_users: 2, limit: 5 });
      highwaysNearby = hw.map((h) =>
        `${h.content_preview} (${h.access_count} accesses, ${h.unique_users} agents)`
      );
    } catch (err) {
      console.error("Highway query failed:", err);
    }

    // Step 10: Format response
    const sources = retrieveResults.slice(0, 5).map((r) => ({
      thought_id: r.thought_id,
      contributor: r.contributor_name,
      score: parseFloat(r.score.toFixed(2)),
      content_preview: r.content.substring(0, 80),
      refined_by: r.refined_by ?? null,
      superseded: r.superseded ?? false,
    }));

    // Prepend guidance/disambiguation to response
    if (guidance) {
      responseText = `${guidance}\n\n${responseText}`;
    }

    // Lineage summary for trace
    let lineageSummary: { has_lineage: boolean; chain_length: number; deepest_ancestor: string | null; latest_refinement: string | null } | undefined;
    if (contributedThoughtId && isExplicitIteration) {
      try {
        const lineage = await getLineage(contributedThoughtId);
        if (lineage.chain.length > 1) {
          const ancestors = lineage.chain.filter((n) => n.depth < 0);
          const descendants = lineage.chain.filter((n) => n.depth > 0);
          lineageSummary = {
            has_lineage: true,
            chain_length: lineage.chain.length,
            deepest_ancestor: ancestors.length > 0 ? ancestors[0].thought_id : null,
            latest_refinement: descendants.length > 0 ? descendants[descendants.length - 1].thought_id : null,
          };
        }
      } catch (err) {
        console.error("Lineage summary failed:", err);
      }
    }

    return reply.send({
      result: {
        response: responseText,
        sources,
        highways_nearby: highwaysNearby,
        disambiguation,
        guidance,
      },
      trace: {
        session_id: sessionId,
        operations,
        thoughts_retrieved: retrieveResults.length,
        thoughts_contributed: thoughtsContributed,
        contribution_threshold_met: thresholdMet,
        context_used: !!context,
        retrieval_method: "vector",
        ...(lineageSummary ? { lineage_summary: lineageSummary } : {}),
      },
    });
}

export async function memoryRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: MemoryRequest }>("/api/v1/memory", async (request, reply) => {
    return handleMemoryRequest(request.body, reply);
  });

  app.get<{ Querystring: MemoryRequest }>("/api/v1/memory", async (request, reply) => {
    return handleMemoryRequest(request.query as MemoryRequest, reply);
  });
}
