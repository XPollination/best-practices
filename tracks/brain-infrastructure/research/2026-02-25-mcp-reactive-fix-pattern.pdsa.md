# PDSA: Reactive MCP Fix Pattern — Claude.ai Connector Infrastructure Gaps

**Date:** 2026-02-25
**Status:** Draft
**Task:** `mcp-claude-ai-reactive-fix-pattern`
**Author:** PDSA agent

---

## PLAN

### Problem Statement

The Claude.ai MCP connector (Layer B of memory-workflow-enforcement) required two reactive fixes to nginx config, both done ad-hoc without documentation. This is a firefighting pattern that should be analyzed to prevent recurrence.

### Incident Timeline

**Fix 1 — Missing `/mcp` route (404):**
External requests to `https://bestpractice.xpollination.earth/mcp` returned 404. No nginx location block existed. LIAISON added `/mcp proxy_pass` to port 3201.

**Fix 2 — Accept header rejection (406):**
After adding the route, Claude.ai connector still failed. MCP SDK's `WebStandardStreamableHTTPServerTransport` (line 187, 377-380 in SDK source) validates that the Accept header includes `text/event-stream`. Claude.ai only sends `Accept: application/json`. LIAISON added `proxy_set_header Accept "application/json, text/event-stream"` in nginx.

---

## DO (Root Cause Analysis)

### Question 1: Why did the PDSA spec say Caddy when the server runs nginx?

**Root cause: PDSA agent had incorrect infrastructure mental model.**

The PDSA spec (lines 172, 317-332 of `2026-02-24-memory-workflow-enforcement.pdsa.md`) specifies:
- "Already behind Caddy HTTPS"
- Config at `/etc/caddy/Caddyfile`
- `sudo systemctl reload caddy`

The actual server uses nginx (`/etc/nginx/sites-enabled/bestpractice`). The PDSA agent either:
1. Assumed Caddy because it's common for simple reverse proxies
2. Never verified the actual reverse proxy in use

**Documentation gap:** There is no single "infrastructure inventory" document that lists which reverse proxy, which config paths, and which domains point where. The `brain-api-access.md` describes port 3200 but not the HTTPS layer. The `HomeAssistant/systems/hetzner-cx22-ubuntu/credentials.md` mentions nginx for paperless and analytics but not for bestpractice.

**Fix:** Add `bestpractice.xpollination.earth` to the Hetzner infrastructure documentation with nginx config path, domain routing, and SSL certificate details.

### Question 2: Why wasn't the Accept header discovered during local testing?

**Root cause: curl sends `Accept: */*` by default, masking the SDK validation.**

The PDSA spec defined 6 curl-based acceptance criteria (AC-B1 through AC-B6). All passed locally because:
- `curl` default: `Accept: */*` — matches everything, including `text/event-stream`
- Claude.ai sends: `Accept: application/json` — does NOT include `text/event-stream`
- MCP SDK validates (line 187): `if (!acceptHeader?.includes('text/event-stream'))` → 406

The test gap: no AC tested with Claude.ai's actual Accept header. The curl tests proved the MCP server works with permissive clients, not with restrictive ones like Claude.ai.

**Fix:** Add a curl test that explicitly sets `Accept: application/json` (without `text/event-stream`) to verify the server handles Claude.ai-like clients. This catches the 406 before deployment.

### Question 3: Should there be an infrastructure checklist for MCP endpoints?

**Yes.** MCP endpoints deployed behind a reverse proxy need specific configuration that differs from standard HTTP APIs. The checklist:

#### MCP Endpoint Deployment Checklist

1. **Reverse proxy route** — Location block for the MCP path, proxying to the correct port
2. **Accept header override** — `proxy_set_header Accept "application/json, text/event-stream"` (Claude.ai sends only `application/json`; MCP SDK requires `text/event-stream`)
3. **SSE streaming support** — `proxy_buffering off`, `proxy_cache off`, `chunked_transfer_encoding on` (nginx buffers responses by default, breaking SSE)
4. **Timeout** — `proxy_read_timeout 300s` (SSE connections are long-lived)
5. **CORS** — If cross-origin, add appropriate headers (Claude.ai connector may need this)
6. **Test with restrictive Accept** — `curl -H "Accept: application/json"` must not return 406

### Question 4: Is the Accept header override the right long-term fix?

**It's the right pragmatic fix. The SDK is too strict per the MCP specification's intent.**

The MCP Streamable HTTP spec says clients "MUST include text/event-stream" in Accept, but:
- Claude.ai (Anthropic's own product) doesn't comply
- The server can determine response format from the request method (POST = JSON or SSE, GET = SSE)
- Rejecting a valid client because of a header is overly strict

**Options:**

| Approach | Pros | Cons |
|----------|------|------|
| A. nginx header override (current) | Works now, no code changes | Fragile — breaks if nginx config is lost or rebuilt |
| B. Patch brain-mcp.ts to inject Accept | App-level fix, survives nginx changes | Coupling SDK internals |
| C. Wait for SDK fix | Clean long-term solution | Unknown timeline, Claude.ai may fix their client instead |

**Recommendation: Keep A (nginx override) as operational fix. Document it. No code change needed.**

The nginx config should be committed to the HomeAssistant repo so it survives rebuilds (see Question 5).

### Question 5: What testing should catch this class of bug?

**Problem class: Client-server header mismatch behind a reverse proxy.**

Recommended testing:

1. **Integration test with exact client headers** — Don't rely on curl defaults. Set `Accept`, `Content-Type`, and `Origin` to match the actual client (Claude.ai).

2. **Pre-deployment nginx config test** — After defining a new location block, test the endpoint through the reverse proxy (not just localhost):
   ```bash
   # Test through nginx, not just localhost
   curl -H "Accept: application/json" https://bestpractice.xpollination.earth/mcp
   # Must NOT return 406
   ```

3. **Checklist-driven deployment** — Use the MCP Endpoint Deployment Checklist (Question 3) for every new endpoint.

---

## STUDY

### Pattern: PDSA spec → implementation gap at infrastructure boundary

The PDSA spec was accurate for the application layer (brain-mcp.ts, tools, SDK) but wrong at the infrastructure layer (reverse proxy). This is a repeating pattern:

| Incident | App layer | Infra layer | Gap |
|----------|-----------|-------------|-----|
| Layer B deployment | MCP server correct | nginx config missing | No infra verification in PDSA |
| Accept header 406 | SDK behavior documented | Client header not tested | Tests used permissive defaults |

**Root cause pattern:** PDSA agents plan application behavior but don't verify infrastructure assumptions. Infrastructure is treated as "someone else's problem" and falls through the cracks.

### What the current process missed

1. **No infrastructure verification step** in the PDSA template — the spec said "Caddy" and nobody caught it
2. **No "test through the proxy" step** — all tests were localhost:3201 direct
3. **No nginx config as code** — the fix was applied via ssh and not committed

### What the firefighting cost

- 2 reactive fixes by LIAISON (ad-hoc, undocumented)
- Risk of config loss on server rebuild
- Context switching overhead for Thomas

---

## ACT

### Immediate actions (this task)

1. **Document the nginx config** in HomeAssistant repo: `systems/hetzner-cx22-ubuntu/` — capture the current `/etc/nginx/sites-enabled/bestpractice` contents
2. **Add the MCP deployment checklist** to the best-practices PDSA template or as a standalone reference
3. **Add restrictive-Accept curl test** to Layer B acceptance criteria

### Process improvements (future tasks if approved)

1. **PDSA template addition:** "Infrastructure verification" section — what reverse proxy, what config path, tested through proxy?
2. **Infrastructure inventory:** Single document mapping domains → ports → reverse proxy configs → SSL → config file paths
3. **nginx config as code:** Commit nginx site configs to HomeAssistant repo so they survive rebuilds

### Files to change

| File | Change | Owner |
|------|--------|-------|
| `HomeAssistant/systems/hetzner-cx22-ubuntu/` (new) | Document nginx config for bestpractice.xpollination.earth | DEV/LIAISON |
| Best-practices PDSA or reference doc (new) | MCP Endpoint Deployment Checklist | PDSA |
| Layer B test suite | Add curl test with `Accept: application/json` only | QA |

### Acceptance criteria

1. Nginx config for bestpractice.xpollination.earth documented in HomeAssistant repo
2. Root cause of Caddy/nginx confusion explained (PDSA agent incorrect assumption, no infra docs)
3. Root cause of 406 explained (curl `Accept: */*` vs Claude.ai `Accept: application/json`)
4. MCP deployment checklist defined (6 items)
5. Accept header override assessed (nginx override is correct pragmatic fix)
