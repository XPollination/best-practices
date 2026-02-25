# PDSA: Document Nginx Config and MCP Deployment Checklist

**Date:** 2026-02-25
**Version:** best-practices v0.0.2
**Status:** PLAN
**Task:** `document-nginx-mcp-config`
**Parent:** `mcp-claude-ai-reactive-fix-pattern`

---

## PLAN

### Problem

The reactive MCP fix pattern analysis identified 3 documentation gaps. This task produces the documentation artifacts.

### Status of Acceptance Criteria

| AC | Status | Notes |
|----|--------|-------|
| AC1: Nginx config documented | DONE | Dev committed `HomeAssistant/systems/hetzner-cx22-ubuntu/configs/nginx/bestpractice.conf` (commit d45bbe6) |
| AC2: MCP deployment checklist | TODO | Exists in parent PDSA, needs standalone reference doc |
| AC3: Restrictive-Accept curl test | TODO | Needs curl test definition for Layer B ACs |

---

## DO (Design)

### AC2: MCP Deployment Checklist Reference Doc

**File:** `best-practices/versions/v0.0.2/docs/mcp-deployment-checklist.md`

Content: Extract the 6-item checklist from the parent PDSA (`2026-02-25-mcp-reactive-fix-pattern.pdsa.md` Question 3) into a standalone reference that can be linked from future MCP deployment tasks.

### AC3: Restrictive-Accept Curl Test

**File:** Add to DNA as test definition (no code file — test is a curl command)

Test command:
```bash
curl -s -o /dev/null -w "%{http_code}" \
  -X POST https://bestpractice.xpollination.earth/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"jsonrpc":"2.0","method":"initialize","id":1,"params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"0.1.0"}}}'
```

Expected: HTTP 200 (not 406). If this returns 406, the Accept header override in nginx is missing or broken.

### Files

| File | Change | Type |
|------|--------|------|
| `versions/v0.0.2/docs/mcp-deployment-checklist.md` | Standalone 6-item checklist | Create |

1 new file. AC3 is a test definition stored in DNA (no code file needed).

---

## Acceptance Criteria (refined)

**AC1:** Nginx config documented — ALREADY DONE (commit d45bbe6)
**AC2:** MCP deployment checklist exists as standalone reference doc
**AC3:** Restrictive-Accept curl test command defined and documented

---

## STUDY / ACT

*To be filled after implementation*
