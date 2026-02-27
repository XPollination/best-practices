# Changelog

All notable changes documented here.
Updated with every version — mandatory before version seal.

---

## [v0.0.2] — 2026-02-17 (Active)

### Added
- Brain API: contribution quality system (ThoughtCategory, quality flags, correction superseding)
- Brain API: full-content retrieval (GET /thought/:id, full_content=true parameter)
- Brain API: deploy script (scripts/deploy-brain-api.sh)
- Brain-first UserPromptSubmit hook (auto-injects brain knowledge before every prompt)
- Pre-compact brain save hook (PreCompact → structured handoff from 3 sources)
- Auto-compact recovery hook (SessionStart → brain query for role recovery)
- Agent wake-up skill (xpo.claude.monitor) with brain markers for task lifecycle
- PM status skill (xpo.claude.mindspace.pm.status)
- Skill/hook auto-deploy: sync-settings.js merge script, symlink-based skill sync

### Changed
- SKILL.md: brain markers in steps 2/4/7 (TASK START, TRANSITION, BLOCKED)
- SKILL.md: install section updated from cp to symlinks

## [v0.0.1] — 2026-02-14

### Added
- Initial best practices hub (layout, spacing, CV design, bold-usage)
- Brain API MVP: Fastify + Qdrant vector DB, embedding service, ingest/query routes
- Thought lineage and explicit iteration (thoughtspace v0.0.2)
- Pheromone-based knowledge reinforcement
- Knowledge Management docs and specifications
