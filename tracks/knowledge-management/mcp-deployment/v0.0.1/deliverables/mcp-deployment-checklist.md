# MCP Endpoint Deployment Checklist

**Source:** PDSA analysis `mcp-claude-ai-reactive-fix-pattern` (2026-02-25)
**Context:** MCP endpoints behind a reverse proxy need specific configuration that differs from standard HTTP APIs.

---

## Checklist

### 1. Reverse Proxy Route

Add a location block for the MCP path, proxying to the correct port.

```nginx
location /mcp {
    proxy_pass http://127.0.0.1:3201;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Connection '';
}
```

### 2. Accept Header Override

Claude.ai sends `Accept: application/json` only. MCP SDK requires `text/event-stream` in Accept header — returns 406 without it.

```nginx
proxy_set_header Accept "application/json, text/event-stream";
```

### 3. SSE Streaming Support

Nginx buffers responses by default, breaking Server-Sent Events.

```nginx
proxy_buffering off;
proxy_cache off;
chunked_transfer_encoding on;
```

### 4. Timeout

SSE connections are long-lived. Default 60s timeout will drop them.

```nginx
proxy_read_timeout 300s;
```

### 5. CORS (if cross-origin)

Claude.ai connector may need CORS headers. Set in application code or nginx:

```nginx
add_header Access-Control-Allow-Origin "*";
add_header Access-Control-Allow-Methods "GET, POST, DELETE, OPTIONS";
add_header Access-Control-Allow-Headers "Content-Type, mcp-session-id";
```

### 6. Test with Restrictive Accept Header

After deployment, verify the endpoint works with Claude.ai's actual headers (not curl defaults):

```bash
# Must NOT return 406
curl -s -o /dev/null -w "%{http_code}" \
  -X POST https://bestpractice.xpollination.earth/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"jsonrpc":"2.0","method":"initialize","id":1,"params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"0.1.0"}}}'
```

Expected: HTTP 200. If 406 — Accept header override is missing.

---

## Why This Checklist Exists

The Claude.ai MCP connector required two reactive fixes because:
1. No nginx location block existed for `/mcp` (404)
2. curl tests passed with `Accept: */*` but Claude.ai sends `Accept: application/json` (406)

Both fixes were applied ad-hoc without documentation. This checklist prevents recurrence.

## Reference

- Nginx config: `HomeAssistant/systems/hetzner-cx22-ubuntu/configs/nginx/bestpractice.conf`
- Full analysis: `best-practices/versions/v0.0.1/pdsa/2026-02-25-mcp-reactive-fix-pattern.pdsa.md`
