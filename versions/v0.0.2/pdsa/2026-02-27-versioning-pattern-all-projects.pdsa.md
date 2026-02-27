# PDSA: Apply HomePage Versioning Pattern to All Projects (v2 — Full Audit)

**Date:** 2026-02-27
**Task:** versioning-pattern-all-projects
**Status:** PLAN (v2 — rework: complete folder audit, scripts versioned, mindspace added)

## Plan

### Problem
v1 only versioned docs/pdsa/spec and left scripts/ and other folders unaccounted for. Thomas wants 100% classified state: every folder either (a) in versions/ with root symlink, or (b) explicitly root-only with rationale. Scope now includes 3 projects: best-practices, xpollination-mcp-server, xpollination-mindspace.

### Design Principle
Every version is a complete, rollback-capable snapshot of all knowledge + operational artifacts. Living source code stays at root (versioned by git). The distinction: **frozen snapshots** (docs, pdsa, spec, scripts) vs **living code** (src, api, tests, viz).

---

## Complete Folder Audit

### 1. best-practices

#### Versioned (in versions/vX.Y.Z/, root symlink)
| Folder | Contents | Symlink | Frozen on seal? |
|--------|----------|---------|-----------------|
| docs/ | Knowledge management, tutorials, architecture | `docs → versions/vX.Y.Z/docs` | Yes |
| pdsa/ | Design documents for this version's work | (no root symlink, accessed via versions/) | Yes |
| spec/ | Specifications, schemas, type definitions | `spec → versions/vX.Y.Z/spec` | Yes |
| scripts/ | Operational scripts (deploy, hooks, tools, version mgmt) | `scripts → versions/vX.Y.Z/scripts` | Yes |

#### Root-Only (with rationale)
| Folder/File | Rationale |
|-------------|-----------|
| api/ | Living source code with own build system (node_modules, package.json, tsconfig, dist, data). Evolves continuously via git commits. Has separate dependency tree. |
| .claude/skills/ | Skill definitions deployed via symlinks to ~/.claude/skills/. Cross-project, not version-specific. Managed by auto-deploy (skill-hook-auto-deploy task). |
| data/ | Runtime SQLite database. Created at runtime, in .gitignore. |
| node_modules/ | NPM dependencies for api/. In .gitignore. |
| versions/ | Meta-container for all version directories. |
| CHANGELOG.md | Project-level changelog spanning all versions. Must be updated before seal. |
| README.md | Project-level readme. |
| LICENSE | Legal file, project-level. |
| .gitignore | Git configuration. |

#### Migration (from v1 implementation)
scripts/ is currently a regular directory at root. Migration:
1. Move scripts/ contents → versions/v0.0.2/scripts/
2. Remove root scripts/
3. Create symlink: `scripts → versions/v0.0.2/scripts`
4. Backfill: copy scripts/ into versions/v0.0.1/scripts/ (historical completeness)

### 2. xpollination-mcp-server

#### Versioned (in versions/vX.Y.Z/, root symlink)
| Folder | Contents | Symlink | Frozen on seal? |
|--------|----------|---------|-----------------|
| docs/ | Knowledge management, workflow, architecture | `docs → versions/vX.Y.Z/docs` | Yes |
| pdsa/ | Design documents for this version's work | (no root symlink) | Yes |
| scripts/ | Operational scripts (onboard, monitor, version mgmt) | `scripts → versions/vX.Y.Z/scripts` | Yes |

#### Root-Only (with rationale)
| Folder/File | Rationale |
|-------------|-----------|
| src/ | Living TypeScript source code. Evolves continuously per git commits. Core server, tools, workflow engine, DB layer. |
| dist/ | Build output generated from src/. In .gitignore. |
| data/ | Runtime SQLite database. In .gitignore. |
| tests/ | Test code tied to src/. Evolves with implementation, not docs. |
| viz/ | Visualization code (agent-monitor.cjs, task viz). Living code tied to src/db/. |
| sources/ | Data source configurations (bestPractices mirror). Runtime config. |
| node_modules/ | NPM dependencies. In .gitignore. |
| CHANGELOG.md | Project-level changelog spanning all versions. |
| CLAUDE.md | Project memory, global, not version-specific. |
| README.md | Project-level readme. |
| TODO.md | Project-level roadmap. |
| package.json, package-lock.json | NPM config tied to src/. |
| tsconfig.json | TypeScript config tied to src/. |
| vitest.config.ts | Test config tied to tests/. |
| .env.example | Config template. |
| .gitignore | Git configuration. |

#### Migration
scripts/ is currently a regular directory at root. Migration:
1. Move scripts/ contents → versions/v0.0.1/scripts/
2. Remove root scripts/
3. Create symlink: `scripts → versions/v0.0.1/scripts`

### 3. xpollination-mindspace

#### Versioned (in versions/vX.Y.Z/, root symlink)
| Folder | Contents | Symlink | Frozen on seal? |
|--------|----------|---------|-----------------|
| docs/ | Knowledge management docs | `docs → versions/vX.Y.Z/docs` (exists) | Yes |
| pdsa/ | Design documents | (no root symlink) | Yes |

#### Root-Only (with rationale)
| Folder/File | Rationale |
|-------------|-----------|
| .claude/ | Project-specific Claude config. |
| CLAUDE.md | Project memory, global. |
| README.md | Project-level readme. |

#### Migration
- docs symlink already exists and works
- Create CHANGELOG.md with v0.0.1 history
- No scripts/ to version (minimal project)

---

## Do

### 1. CHANGELOG.md (all 3 projects)

Same template as v1. Backfill from git log.
- best-practices: v0.0.1 + v0.0.2 (already created in v1, verify)
- xpollination-mcp-server: v0.0.1 (already created in v1, verify)
- xpollination-mindspace: v0.0.1 (NEW)

### 2. Scripts Migration (best-practices)

```bash
# Move scripts into active version
cp -r scripts/* versions/v0.0.2/scripts/
# Backfill v0.0.1 scripts (subset that existed then)
mkdir -p versions/v0.0.1/scripts
# Only backfill scripts that existed in v0.0.1 era if identifiable from git log
# Otherwise copy current as baseline
cp -r scripts/* versions/v0.0.1/scripts/
# Replace root with symlink
rm -rf scripts
ln -sfn versions/v0.0.2/scripts scripts
```

### 3. Scripts Migration (xpollination-mcp-server)

```bash
# Move scripts into version
mkdir -p versions/v0.0.1/scripts
cp -r scripts/* versions/v0.0.1/scripts/
# Replace root with symlink
rm -rf scripts
ln -sfn versions/v0.0.1/scripts scripts
```

### 4. Update new-version.sh (both projects)

Add scripts/ copying to existing script:
```bash
# After docs and spec copy, add:
# Copy scripts from current version
if [ -d "$REPO/versions/$CURRENT_VER/scripts" ]; then
    cp -r "$REPO/versions/$CURRENT_VER/scripts/"* "$REPO/versions/$NEW_VER/scripts/" 2>/dev/null
fi

# Update symlinks — add scripts
ln -sfn "versions/$NEW_VER/scripts" "$REPO/scripts"
```

### 5. xpollination-mindspace Setup

```bash
# CHANGELOG.md — backfill v0.0.1 from git log
# Verify docs symlink: docs → versions/v0.0.1/docs (already exists)
# No scripts/ to version
```

### 6. Root Symlinks (complete map)

**best-practices:**
```
docs    → versions/v0.0.2/docs     (exists from v1)
spec    → versions/v0.0.2/spec     (exists from v1)
scripts → versions/v0.0.2/scripts  (NEW — from migration)
```

**xpollination-mcp-server:**
```
docs    → versions/v0.0.1/docs     (pre-existing)
scripts → versions/v0.0.1/scripts  (NEW — from migration)
```

**xpollination-mindspace:**
```
docs    → versions/v0.0.1/docs     (pre-existing)
```

### 7. Version Boundary Criteria (unchanged from v1)

| Trigger | Action |
|---------|--------|
| Major feature complete | Bump minor: v0.0.1 → v0.0.2 |
| Architecture change | Bump minor |
| Significant docs overhaul | Bump minor |
| Bug fixes only | Patch: v0.0.1 → v0.0.1-fix.1 (rare) |
| Breaking workflow changes | Bump minor + document migration |

**Current versions:**
- xpollination-mcp-server: v0.0.1 (active)
- best-practices: v0.0.2 (active)
- xpollination-mindspace: v0.0.1 (active)

## Study
- Verify all 3 projects: every root-level folder is either symlinked to versions/ or documented as root-only
- Verify scripts symlinks resolve correctly and scripts execute via symlink
- Verify new-version.sh copies scripts/ in addition to docs/spec
- Verify CHANGELOG.md exists in all 3 projects
- Verify xpollination-mindspace has working docs symlink

## Act
- Update versioning-pattern.md with complete folder audit methodology
- Future: when adding new root-level folders to any project, classify as versioned or root-only in this audit
