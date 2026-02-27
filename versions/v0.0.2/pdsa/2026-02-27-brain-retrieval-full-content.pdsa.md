# PDSA: Brain API Full-Content Retrieval + Deployment

**Date:** 2026-02-27
**Task:** brain-retrieval-full-content
**Status:** PLAN (v2 — revised after rework)

## Plan

### Problem
Brain API returns 80-char truncated previews (`content_preview`). Agents cannot read full thought content without direct Qdrant access. No single-thought retrieval endpoint exists. No documented deployment procedure — API was started manually and never restarted.

### Design Principle: Scan vs Drill-down
Two retrieval modes. Hook fires on every prompt — it signals what exists (80-char preview). Agent drills down on demand (GET by ID or opt-in full_content param). This prevents context pollution: 3 full thoughts (2-6KB) injected on every prompt would waste context window on mostly irrelevant content.

## Do

### Change 1: GET /api/v1/memory/thought/:id (Drill-down)
**File:** `api/src/routes/memory.ts`
- New endpoint returning full thought payload
- Fields: content, contributor, category, topic, temporal_scope, source_ref, quality_flags, timestamps, pheromone_weight, access_count
- Uses Qdrant `client.retrieve()`
- 404 if not found

### Change 2: Optional full_content parameter (Opt-in)
**File:** `api/src/routes/memory.ts`
- Add `full_content` boolean parameter to POST/GET `/api/v1/memory`
- When true: sources include `content` field with full text
- When false (default): sources have only `content_preview` (80 chars)
- Backward compatible — default behavior unchanged

### Change 3: Deployment Script
**New file:** `scripts/deploy-brain-api.sh`
- `git pull` in best-practices repo
- Find brain API by port 3200, kill
- Restart: `nohup npx tsx api/src/index.ts > /tmp/brain-api.log 2>&1 &`
- Wait for health check
- Print confirmation

### Change 4: Deploy
- Run deploy script to activate all changes (contribution quality from 1e51668 + full-content retrieval)

### NOT Changed
- `content_preview` stays at 80 chars (correct for scanning)
- Brain-first hook unchanged (signals, not dumps)
- Highway previews stay at 80 chars

## Study
- Verify GET /:id returns complete thought content
- Verify full_content=true returns full text in search sources
- Verify default search still returns 80-char previews
- Verify new fields (thought_category, quality_flags) appear after restart

## Act
- Document deployment procedure in operational docs
- Consider: hook could auto-drill-down on high-score matches (>0.85) in future iteration
