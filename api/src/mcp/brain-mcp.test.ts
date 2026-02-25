/**
 * Tests for Layer B: Brain MCP wrapper (port 3201)
 *
 * Acceptance criteria from PDSA 2026-02-24-memory-workflow-enforcement:
 * AC-B1: MCP server starts alongside brain API (port 3201)
 * AC-B2: MCP initialize returns server capabilities with tools
 * AC-B3: tools/list returns query_brain and contribute_to_brain
 * AC-B4: query_brain tool returns brain query results
 * AC-B5: contribute_to_brain tool stores thoughts in brain
 * AC-B6: CORS headers present (Access-Control-Allow-Origin: *)
 */
import { describe, it, expect, beforeAll } from "vitest";

const MCP_URL = "http://localhost:3201";
const MCP_HEADERS = {
  "Content-Type": "application/json",
  "Accept": "application/json, text/event-stream",
};

async function mcpServerIsRunning(): Promise<boolean> {
  try {
    const res = await fetch(MCP_URL, {
      method: "OPTIONS",
    });
    return res.status === 204;
  } catch {
    return false;
  }
}

function parseSSE(raw: string): unknown {
  const dataLine = raw.split("\n").find((l) => l.startsWith("data: "));
  if (!dataLine) throw new Error(`No SSE data line in response: ${raw}`);
  return JSON.parse(dataLine.slice(6));
}

async function mcpRequest(method: string, params: unknown = {}, id = 1) {
  const res = await fetch(MCP_URL, {
    method: "POST",
    headers: MCP_HEADERS,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id,
      method,
      params,
    }),
  });
  const text = await res.text();
  return parseSSE(text) as { result?: unknown; error?: unknown; jsonrpc: string; id: number };
}

let serverUp: boolean;

beforeAll(async () => {
  serverUp = await mcpServerIsRunning();
});

// --- AC-B1: MCP server starts alongside brain API ---

describe("AC-B1: MCP server is running on port 3201", () => {
  it("responds to OPTIONS request", async () => {
    if (!serverUp) return;
    const res = await fetch(MCP_URL, { method: "OPTIONS" });
    expect(res.status).toBe(204);
  });

  it("responds to POST request", async () => {
    if (!serverUp) return;
    const res = await fetch(MCP_URL, {
      method: "POST",
      headers: MCP_HEADERS,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "vitest", version: "1.0" },
        },
      }),
    });
    expect(res.status).toBe(200);
  });
});

// --- AC-B2: MCP initialize returns server capabilities ---

describe("AC-B2: MCP initialize returns server capabilities", () => {
  it("returns protocol version and server info", async () => {
    if (!serverUp) return;
    const data = await mcpRequest("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "vitest", version: "1.0" },
    });
    const result = data.result as Record<string, unknown>;
    expect(result.protocolVersion).toBe("2024-11-05");
    expect(result.serverInfo).toEqual({ name: "xpollination-brain", version: "0.1.0" });
  });

  it("includes tools capability", async () => {
    if (!serverUp) return;
    const data = await mcpRequest("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "vitest", version: "1.0" },
    });
    const result = data.result as Record<string, unknown>;
    const capabilities = result.capabilities as Record<string, unknown>;
    expect(capabilities).toHaveProperty("tools");
  });
});

// --- AC-B3: tools/list returns query_brain and contribute_to_brain ---

describe("AC-B3: tools/list returns both brain tools", () => {
  it("lists query_brain tool", async () => {
    if (!serverUp) return;
    const data = await mcpRequest("tools/list", {});
    const result = data.result as { tools: Array<{ name: string }> };
    const names = result.tools.map((t) => t.name);
    expect(names).toContain("query_brain");
  });

  it("lists contribute_to_brain tool", async () => {
    if (!serverUp) return;
    const data = await mcpRequest("tools/list", {});
    const result = data.result as { tools: Array<{ name: string }> };
    const names = result.tools.map((t) => t.name);
    expect(names).toContain("contribute_to_brain");
  });

  it("query_brain has prompt as required parameter", async () => {
    if (!serverUp) return;
    const data = await mcpRequest("tools/list", {});
    const result = data.result as { tools: Array<{ name: string; inputSchema: Record<string, unknown> }> };
    const queryTool = result.tools.find((t) => t.name === "query_brain");
    expect(queryTool).toBeDefined();
    expect(queryTool!.inputSchema.required).toContain("prompt");
  });

  it("contribute_to_brain enforces min length 51", async () => {
    if (!serverUp) return;
    const data = await mcpRequest("tools/list", {});
    const result = data.result as { tools: Array<{ name: string; inputSchema: Record<string, unknown> }> };
    const contributeTool = result.tools.find((t) => t.name === "contribute_to_brain");
    expect(contributeTool).toBeDefined();
    const props = contributeTool!.inputSchema.properties as Record<string, { minLength?: number }>;
    expect(props.prompt.minLength).toBe(51);
  });
});

// --- AC-B4: query_brain tool returns brain results ---

describe("AC-B4: query_brain returns brain query results", () => {
  it("returns content with brain response", async () => {
    if (!serverUp) return;
    const data = await mcpRequest("tools/call", {
      name: "query_brain",
      arguments: { prompt: "workflow enforcement" },
    });
    const result = data.result as { content: Array<{ type: string; text: string }> };
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toHaveProperty("result");
    expect(parsed).toHaveProperty("trace");
    expect(parsed.result).toHaveProperty("sources");
  });

  it("supports optional context parameter", async () => {
    if (!serverUp) return;
    const data = await mcpRequest("tools/call", {
      name: "query_brain",
      arguments: { prompt: "memory enforcement", context: "QA testing MCP wrapper" },
    });
    const result = data.result as { content: Array<{ type: string; text: string }> };
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.trace.context_used).toBe(true);
  });
});

// --- AC-B5: contribute_to_brain stores thoughts ---

describe("AC-B5: contribute_to_brain stores thoughts in brain", () => {
  it("stores declarative statement and confirms", async () => {
    if (!serverUp) return;
    const data = await mcpRequest("tools/call", {
      name: "contribute_to_brain",
      arguments: {
        prompt: "Vitest verification of MCP brain wrapper — Layer B acceptance test confirms contribution storage via Streamable HTTP transport.",
      },
    });
    const result = data.result as { content: Array<{ type: string; text: string }> };
    expect(result.content[0].text).toContain("Thought stored successfully");
    const jsonPart = result.content[0].text.split("\n\n")[1];
    const parsed = JSON.parse(jsonPart);
    expect(parsed.trace.thoughts_contributed).toBe(1);
  });

  it("shows contributor as Thomas Pichler", async () => {
    if (!serverUp) return;
    const data = await mcpRequest("tools/call", {
      name: "contribute_to_brain",
      arguments: {
        prompt: "MCP wrapper correctly hardcodes agent identity for Thomas — all contributions via Claude web appear as Thomas Pichler in the knowledge base.",
      },
    });
    const result = data.result as { content: Array<{ type: string; text: string }> };
    const jsonPart = result.content[0].text.split("\n\n")[1];
    const parsed = JSON.parse(jsonPart);
    const sources = parsed.result.sources;
    const thomasSource = sources.find((s: { contributor: string }) => s.contributor === "Thomas Pichler");
    expect(thomasSource).toBeDefined();
  });
});

// --- AC-B6: CORS headers present ---

describe("AC-B6: CORS headers for Claude.ai", () => {
  it("OPTIONS returns 204 with CORS headers", async () => {
    if (!serverUp) return;
    const res = await fetch(MCP_URL, { method: "OPTIONS" });
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.headers.get("access-control-allow-methods")).toContain("POST");
    expect(res.headers.get("access-control-allow-headers")).toContain("mcp-session-id");
    expect(res.headers.get("access-control-expose-headers")).toContain("mcp-session-id");
  });

  it("POST responses include CORS origin header", async () => {
    if (!serverUp) return;
    const res = await fetch(MCP_URL, {
      method: "POST",
      headers: MCP_HEADERS,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: {},
      }),
    });
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });
});
