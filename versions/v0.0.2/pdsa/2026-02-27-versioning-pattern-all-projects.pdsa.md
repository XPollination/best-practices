# PDSA: Apply HomePage Versioning Pattern to Code+Docs Projects

**Date:** 2026-02-27
**Task:** versioning-pattern-all-projects
**Status:** PLAN

## Plan

### Problem
HomePage has a mature versioning pattern (symlinks, CHANGELOG, deploy script, version sealing). MCP server and best-practices lack CHANGELOGs, deploy scripts, and consistent structure. PDSAs are scattered in MCP server (root /pdsa/ AND /versions/v0.0.1/pdsa/).

### Key Adaptation: Code vs Site
HomePage versions the **complete deliverable** (site/ is a frozen snapshot). Code+docs projects version **knowledge artifacts** (docs, pdsa, spec) while **source code stays at root** — it's a living artifact that evolves continuously, not frozen per version.

### What Gets Versioned (in versions/vX.Y.Z/)
| Directory | Contents | Frozen on seal? |
|-----------|----------|----------------|
| docs/ | Knowledge management, tutorials, architecture docs | Yes |
| pdsa/ | Design documents for this version's work | Yes |
| spec/ | Specifications, schemas, type definitions (as docs) | Yes |

### What Stays at Root (NOT versioned)
| Directory | Reason |
|-----------|--------|
| src/, api/ | Living code, evolves continuously |
| data/ | Runtime data, database files |
| scripts/ | Operational scripts (deploy, tools) |
| node_modules/ | Dependencies |
| package.json, tsconfig.json | Build config |
| CLAUDE.md | Project memory (global, not version-specific) |

## Do

### 1. CHANGELOG.md (both projects)

**Template:**
```markdown
# Changelog

All notable changes documented here.
Updated with every version — mandatory before version seal.

---

## [v0.0.2] — 2026-02-27 (Active)

### Added
- ...

### Changed
- ...

## [v0.0.1] — 2026-02-17

### Added
- Initial release
```

**Backfill:** Review git log to reconstruct v0.0.1 changelog for both projects. v0.0.2 for best-practices.

### 2. Root Symlinks

**xpollination-mcp-server** (already has `docs` symlink):
```
docs → versions/v0.0.1/docs  # already exists
```

**best-practices** (missing):
```
docs → versions/v0.0.2/docs  # new symlink
spec → versions/v0.0.2/spec  # new symlink
```

### 3. scripts/new-version.sh (adapted for code+docs)

Adapted from HomePage:
```bash
#!/bin/bash
# Creates new version directory, copies docs structure, empties pdsa/

REPO=$(git rev-parse --show-toplevel)
NEW_VER="${1:-}"

# Determine current version from docs symlink
CURRENT_TARGET=$(readlink "$REPO/docs")
CURRENT_VER=$(echo "$CURRENT_TARGET" | sed 's|versions/||; s|/docs||')

# Create new version with docs structure
mkdir -p "$REPO/versions/$NEW_VER/docs"
mkdir -p "$REPO/versions/$NEW_VER/pdsa"
mkdir -p "$REPO/versions/$NEW_VER/spec"

# Copy docs and spec from current version
cp -r "$REPO/versions/$CURRENT_VER/docs/"* "$REPO/versions/$NEW_VER/docs/"
if [ -d "$REPO/versions/$CURRENT_VER/spec" ]; then
    cp -r "$REPO/versions/$CURRENT_VER/spec/"* "$REPO/versions/$NEW_VER/spec/" 2>/dev/null
fi
# pdsa/ starts empty (new version, new work)

# Update symlinks
ln -sfn "versions/$NEW_VER/docs" "$REPO/docs"
if [ -L "$REPO/spec" ]; then
    ln -sfn "versions/$NEW_VER/spec" "$REPO/spec"
fi
```

### 4. Version Seal Script (adapted deploy.sh)

No "deploy" for code projects, but version sealing:
```bash
#!/bin/bash
# Seals a version: changelog gate, git tag

VER="${1:-}"
CHANGELOG="$REPO/CHANGELOG.md"

# Gates
if ! grep -q "^\## \[${VER}\]" "$CHANGELOG"; then
    echo "ERROR: No changelog entry for ${VER}"
    exit 1
fi

# Tag
git tag -a "$VER" -m "Version $VER sealed"
git push origin "$VER"
echo "Version $VER sealed and tagged."
```

### 5. PDSA Cleanup (MCP server)

Move scattered PDSAs from root `/pdsa/` into `/versions/v0.0.1/pdsa/`:
```bash
# In xpollination-mcp-server
mv pdsa/* versions/v0.0.1/pdsa/
rmdir pdsa
```

### 6. Version Boundary Criteria

| Trigger | Action |
|---------|--------|
| Major feature complete (e.g., brain API v2) | Bump minor: v0.0.1 → v0.0.2 |
| Architecture change | Bump minor |
| Significant docs overhaul | Bump minor |
| Bug fixes only, no new features | Patch: v0.0.1 → v0.0.1-fix.1 (rare) |
| Breaking workflow changes | Bump minor + document migration |

**Current version assessment:**
- xpollination-mcp-server: Stay at v0.0.1 (workflow engine + brain gate just added, seal when stable)
- best-practices: v0.0.2 is active (brain API, contribution quality, hooks)

### 7. Migration Plan

**xpollination-mcp-server:**
1. Create CHANGELOG.md with v0.0.1 history
2. Move root pdsa/ → versions/v0.0.1/pdsa/
3. Add scripts/new-version.sh and scripts/seal-version.sh
4. Verify docs symlink works

**best-practices:**
1. Create CHANGELOG.md with v0.0.1 and v0.0.2 history
2. Add root symlinks: docs → versions/v0.0.2/docs, spec → versions/v0.0.2/spec
3. Add scripts/new-version.sh and scripts/seal-version.sh
4. Verify symlinks work

## Study
- Verify both projects have CHANGELOG.md with accurate history
- Verify symlinks resolve correctly
- Verify new-version.sh creates correct structure
- Verify PDSA naming convention consistent

## Act
- Document version boundary criteria in versioning-pattern.md (update existing doc)
- Add CHANGELOG gate to agent workflow (agents check CHANGELOG before seal)
