# PDSA: Brain API Full-Content Retrieval + Deployment

**Date:** 2026-02-27
**Task:** brain-retrieval-full-content
**Status:** PLAN

## Plan

### Problem
Brain API returns 80-char truncated previews (`content_preview`). Agents cannot read full thought content without direct Qdrant access. The brain-first hook (commit 2018a40) injects these truncated previews on every prompt — making knowledge injection superficial. Contribution quality improvements (commit 1e51668) are wasted if agents cannot READ full knowledge back.

Additionally, the running brain API (PID 3118993, tsx from source) has not been restarted since Feb 17. New features (thought categories, correction superseding, quality flags) are in source but not running.

### Root Cause
1. `content_preview` was designed as a display summary, but became the only retrieval path.
2. No single-thought retrieval endpoint exists.
3. No documented deployment procedure — API was started manually and never restarted.

## Do

### Change 1: Full Content in API Sources
**File:** `api/src/routes/memory.ts`
- Add `content` field (full text) to source objects alongside existing `content_preview`
- Expand `content_preview` from 80 to 300 chars
- Backward compatible — `content_preview` still exists

### Change 2: Expand Highway Previews
**File:** `api/src/services/thoughtspace.ts`
- Expand `content_preview` in `HighwayResult` from 80 to 300 chars
- Expand history and consolidation previews similarly

### Change 3: Single Thought GET Endpoint
**File:** `api/src/routes/memory.ts`
- Add `GET /api/v1/memory/thought/:id`
- Returns full thought payload: content, metadata, category, source_ref, timestamps
- Uses Qdrant `client.retrieve()`
- 404 if not found

### Change 4: Deployment Script
**New file:** `scripts/deploy-brain-api.sh`
- `git pull` in best-practices repo
- Find and kill existing brain API process (by port 3200)
- Restart: `nohup npx tsx api/src/index.ts > /tmp/brain-api.log 2>&1 &`
- Wait for health check: `curl localhost:3200/api/v1/health`
- Print confirmation

### Change 5: Deploy
- Run deploy script to activate all changes (including contribution quality from 1e51668)

## Study
- Verify full content appears in API responses
- Verify GET /:id returns complete thought
- Verify new fields (thought_category, quality_flags) appear after restart
- Verify brain-first hook injects meaningful content (not truncated previews)

## Act
- Update brain-first hook to use `content` field instead of `content_preview` if available
- Document deployment procedure in CLAUDE.md or best-practices README
