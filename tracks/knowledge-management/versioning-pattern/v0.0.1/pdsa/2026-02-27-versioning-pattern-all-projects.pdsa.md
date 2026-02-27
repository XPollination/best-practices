# PDSA: Tracks/Work-Packages Versioning Pattern (v3 — ProfileAssistant Pattern)

**Date:** 2026-02-27
**Task:** versioning-pattern-all-projects
**Status:** PLAN (v3 — fundamental restructure to tracks/work-packages)

## Plan

### Problem
Flat `versions/{v0.0.1,v0.0.2}/` lumps unrelated work into shared version numbers. Brain API PDSAs and workflow engine PDSAs share "v0.0.1" even though they're independent feature streams. No independent iteration per feature — bumping version requires all features to advance together.

### Reference: ProfileAssistant Pattern
Analyzed `ProfileAssistant/tracks/ventures/xpollination-gruendung/UGP/`:

```
tracks/ventures/xpollination-gruendung/UGP/
  context/                        ← shared source material (NOT versioned)
    ugp-kurzkonzept-xpollination.md
    wko-berufsbild.pdf
  research/                       ← shared research PDSAs (NOT versioned)
    2026-02-26-berufsbild.pdsa.md
  kurzkonzept/                    ← WORK PACKAGE #1
    v0.0.1/pdsa/ deliverables/    ← iteration 1
    ...
    v0.0.9/pdsa/ deliverables/    ← iteration 9 (independently!)
  ugp-checkliste/                 ← WORK PACKAGE #2
    v0.0.1/ v0.0.2/               ← iterates independently
  antwortschreiben/               ← WORK PACKAGE #3
    v0.0.1/
```

**Key principles:**
1. Work packages iterate INDEPENDENTLY (kurzkonzept at v0.0.9, checkliste at v0.0.2)
2. `context/` = shared source material at category level
3. `research/` = shared research PDSAs outside version folders
4. Each version: `pdsa/` + `deliverables/`

### Adaptation for Code+Docs Projects

ProfileAssistant is pure documents. Our projects have living source code. Adaptation:
- **Source code stays at root** — git-versioned, evolves continuously
- **tracks/ replaces versions/** — organizes knowledge lifecycle around code features
- **Work packages = feature domains** — each iterates its own PDSA/docs independently
- **deliverables/ = knowledge output** — specs, API docs, architecture docs, operational guides (NOT code)
- **context/ = shared reference material** — design notes, architecture decisions, external references

---

## Track/Work-Package Design

### 1. best-practices

```
best-practices/
  api/                              ← ROOT (living code: brain API)
  .claude/skills/                   ← ROOT (cross-project, auto-deployed)
  data/                             ← ROOT (runtime, .gitignore)
  node_modules/                     ← ROOT (.gitignore)
  CHANGELOG.md                      ← ROOT (project-level)
  README.md                         ← ROOT (project-level)
  .gitignore                        ← ROOT
  LICENSE                           ← ROOT
  tracks/                           ← REPLACES versions/
    brain-infrastructure/           ← TRACK
      context/                      ← shared: API architecture, Qdrant setup, deployment
      research/                     ← shared research PDSAs
      contribution-quality/         ← WORK PACKAGE
        v0.0.1/
          pdsa/                     ← 2026-02-26-brain-contribution-quality.pdsa.md
          deliverables/             ← quality gate spec, category taxonomy
      retrieval-full-content/       ← WORK PACKAGE
        v0.0.1/
          pdsa/                     ← 2026-02-27-brain-retrieval-full-content.pdsa.md
          deliverables/             ← API endpoint spec, scan vs drill-down doc
      thought-lineage/              ← WORK PACKAGE
        v0.0.1/
          pdsa/                     ← 2026-02-25-memory-thought-lineage.pdsa.md
          deliverables/
    agent-operations/               ← TRACK
      context/                      ← shared: session architecture, skill design
      research/
      skill-deployment/             ← WORK PACKAGE
        v0.0.1/
          pdsa/                     ← 2026-02-27-skill-hook-auto-deploy.pdsa.md
          deliverables/             ← symlink map, sync scripts doc
      brain-first-hook/             ← WORK PACKAGE
        v0.0.1/
          pdsa/                     ← 2026-02-26-brain-first-hook.pdsa.md
          deliverables/
      precompact-save/              ← WORK PACKAGE
        v0.0.1/
          pdsa/                     ← 2026-02-25-auto-precompact-brain-save.pdsa.md
          deliverables/
    knowledge-management/           ← TRACK
      context/                      ← shared: versioning philosophy, PDSA methodology
      research/
      versioning-pattern/           ← WORK PACKAGE (this task!)
        v0.0.1/
          pdsa/                     ← 2026-02-27-versioning-pattern.pdsa.md
          deliverables/             ← pattern documentation
      mcp-deployment/               ← WORK PACKAGE
        v0.0.1/
          pdsa/                     ← 2026-02-25-document-nginx-mcp-config.pdsa.md
          deliverables/             ← mcp-deployment-checklist.md
    scripts/                        ← VERSIONED per-track or shared
      deploy-brain-api.sh
      xpo.claude.brain-first-hook.sh
      xpo.claude.compact-recover.sh
      xpo.claude.precompact-save.sh
      xpo.claude.settings.json
      xpo.claude.sync-settings.js
      new-version.sh                ← adapted: creates version in a work package
      seal-version.sh               ← adapted: seals a work package version
```

**PDSA mapping (v0.0.2 → tracks):**
| Current PDSA | Target Track | Work Package |
|-------------|-------------|-------------|
| brain-contribution-quality-maps | brain-infrastructure | contribution-quality |
| brain-retrieval-full-content | brain-infrastructure | retrieval-full-content |
| memory-thought-lineage | brain-infrastructure | thought-lineage |
| brain-first-hook-userpromptsubmit | agent-operations | brain-first-hook |
| skill-hook-auto-deploy | agent-operations | skill-deployment |
| auto-precompact-brain-save | agent-operations | precompact-save |
| xpo-claude-mindspace-pm-status | agent-operations | pm-status-skill |
| task-boundary-brain-protocol | agent-operations | task-boundary |
| mcp-server-crash-error-handling | brain-infrastructure | error-handling |
| document-nginx-mcp-config | knowledge-management | mcp-deployment |
| versioning-pattern-all-projects | knowledge-management | versioning-pattern |

### 2. xpollination-mcp-server

```
xpollination-mcp-server/
  src/                              ← ROOT (living TypeScript code)
  dist/                             ← ROOT (build output)
  data/                             ← ROOT (runtime SQLite)
  tests/                            ← ROOT (tied to src/)
  viz/                              ← ROOT (visualization code)
  sources/                          ← ROOT (data sources)
  node_modules/                     ← ROOT (.gitignore)
  CHANGELOG.md                      ← ROOT
  CLAUDE.md                         ← ROOT
  README.md, TODO.md                ← ROOT
  package.json, tsconfig.json, etc. ← ROOT
  tracks/                           ← REPLACES versions/
    content-pipeline/               ← TRACK
      context/                      ← shared: pipeline architecture, content strategy
      research/
      frames/                       ← WORK PACKAGE
        v0.0.1/pdsa/ deliverables/
      crawling/                     ← WORK PACKAGE
        v0.0.1/pdsa/ deliverables/
      publishing/                   ← WORK PACKAGE
        v0.0.1/pdsa/ deliverables/
    workflow-engine/                 ← TRACK
      context/                      ← shared: state machine design, transition rules
      research/
      state-machine/                ← WORK PACKAGE
        v0.0.1/pdsa/ deliverables/  ← design, unit tests spec, brain gates
      blocked-state/                ← WORK PACKAGE
        v0.0.1/pdsa/ deliverables/
      role-boundaries/              ← WORK PACKAGE
        v0.0.1/pdsa/ deliverables/
    project-management/             ← TRACK
      context/                      ← shared: DNA structure, CLI design
      research/
      interface-cli/                ← WORK PACKAGE
        v0.0.1/pdsa/ deliverables/
      self-contained-dna/           ← WORK PACKAGE
        v0.0.1/pdsa/ deliverables/
    visualization/                  ← TRACK
      context/
      task-board/                   ← WORK PACKAGE
        v0.0.1/pdsa/ deliverables/
      agent-monitor/                ← WORK PACKAGE
        v0.0.1/pdsa/ deliverables/
    process/                        ← TRACK (methodology, process docs)
      context/                      ← WORKFLOW.md, tutorials
      research/
      acceptance-criteria/          ← WORK PACKAGE
        v0.0.1/pdsa/ deliverables/
```

**PDSA mapping (46 PDSAs → tracks):**
Key mappings (too many to list all):
- workflow-engine PDSAs → tracks/workflow-engine/state-machine/
- viz-* PDSAs → tracks/visualization/task-board/
- process-* PDSAs → tracks/process/
- pm-tool-* → tracks/project-management/interface-cli/

### 3. xpollination-mindspace

```
xpollination-mindspace/
  .claude/                          ← ROOT
  CLAUDE.md                         ← ROOT
  README.md                         ← ROOT
  tracks/                           ← REPLACES versions/
    architecture/                   ← TRACK
      context/                      ← shared: system design notes
      research/
      system-design/                ← WORK PACKAGE
        v0.0.1/
          pdsa/
          deliverables/             ← architecture docs (current docs/ content)
```

---

## Scripts Adaptation

### new-version.sh (work-package scoped)
```bash
#!/bin/bash
# Creates new version in a specific work package
# Usage: new-version.sh <track/work-package> <version>
# Example: new-version.sh brain-infrastructure/contribution-quality v0.0.2

REPO=$(git rev-parse --show-toplevel)
WP_PATH="${1:-}"
NEW_VER="${2:-}"

WP_DIR="$REPO/tracks/$WP_PATH"
mkdir -p "$WP_DIR/$NEW_VER/pdsa"
mkdir -p "$WP_DIR/$NEW_VER/deliverables"

# Copy deliverables from previous version as starting point
PREV_VER=$(ls -d "$WP_DIR"/v0.0.* 2>/dev/null | sort -V | tail -1 | xargs basename)
if [ -n "$PREV_VER" ] && [ -d "$WP_DIR/$PREV_VER/deliverables" ]; then
    cp -r "$WP_DIR/$PREV_VER/deliverables/"* "$WP_DIR/$NEW_VER/deliverables/" 2>/dev/null
fi
# pdsa/ starts empty (new iteration, new design work)
```

### seal-version.sh (work-package scoped)
```bash
#!/bin/bash
# Seals a work package version
# Usage: seal-version.sh <track/work-package> <version>
WP_PATH="${1:-}"
VER="${2:-}"
git tag -a "${WP_PATH//\//-}-$VER" -m "Sealed $WP_PATH $VER"
```

---

## Migration Plan (Big Bang)

### Phase 1: Create tracks/ structure
For each project, create the tracks/ tree with context/ and work-package dirs.

### Phase 2: Migrate PDSAs
Move each existing PDSA from `versions/vX.Y.Z/pdsa/` into the correct `tracks/{track}/{work-package}/v0.0.1/pdsa/`.

### Phase 3: Migrate docs
Move docs from `versions/vX.Y.Z/docs/` into appropriate `tracks/{track}/context/` or `tracks/{track}/{work-package}/v0.0.1/deliverables/`.

### Phase 4: Migrate specs
Move specs into relevant `tracks/{track}/{work-package}/v0.0.1/deliverables/`.

### Phase 5: Remove old versions/ and symlinks
Remove `versions/` directory. Remove root symlinks (docs, spec, scripts) that pointed to versions/.

### Phase 6: Update references
Update CLAUDE.md references from `versions/` paths to `tracks/` paths.

### Phase 7: Scripts
Place adapted new-version.sh and seal-version.sh in root scripts/ (NOT versioned — they're meta-tools for the tracks system).

---

## Root-Only Classification (All 3 Projects)

### best-practices root-only
| Folder/File | Rationale |
|-------------|-----------|
| api/ | Living source code with own build system. Git-versioned. |
| .claude/skills/ | Cross-project skills, auto-deployed via symlinks. |
| data/ | Runtime SQLite. .gitignore. |
| node_modules/ | Dependencies. .gitignore. |
| scripts/ | Meta-tools (version management, deployment). |
| CHANGELOG.md | Project-level, spans all tracks. |
| README.md, LICENSE, .gitignore | Project-level config/docs. |

### xpollination-mcp-server root-only
| Folder/File | Rationale |
|-------------|-----------|
| src/ | Living TypeScript source. Git-versioned. |
| dist/ | Build output from src/. |
| data/ | Runtime SQLite. .gitignore. |
| tests/ | Test code tied to src/. |
| viz/ | Visualization code. Living. |
| sources/ | Data source configs. |
| node_modules/ | Dependencies. .gitignore. |
| scripts/ | Meta-tools for tracks system. |
| CHANGELOG.md, CLAUDE.md, README.md, TODO.md | Project-level. |
| package.json, tsconfig.json, vitest.config.ts | Build config tied to src/. |
| .env.example, .gitignore | Config. |

### xpollination-mindspace root-only
| Folder/File | Rationale |
|-------------|-----------|
| .claude/ | Project Claude config. |
| CLAUDE.md, README.md | Project-level. |

## Study
- Verify tracks structure matches ProfileAssistant pattern
- Verify PDSA mapping is complete (no orphaned PDSAs)
- Verify work packages are correctly scoped (not too granular, not too broad)
- Verify context/ directories contain the right shared material
- Verify all root-only folders documented with rationale

## Act
- After migration: update CLAUDE.md in all projects to reference tracks/ paths
- Update agent workflow to use tracks/ for PDSA placement
- Document the pattern in knowledge-management track context
