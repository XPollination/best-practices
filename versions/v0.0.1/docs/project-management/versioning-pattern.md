# Project Versioning Pattern

## The Pattern

Every project that evolves over time needs a way to preserve history while enabling iteration. The versioning pattern separates **what was done** (versions) from **what is active** (symlinks), so you can always trace back to a specific point in time without losing access to the current state.

```
project-root/
├── versions/
│   ├── v0.0.1/           # Initial version — immutable once tagged
│   │   ├── docs/         # Documentation for this version
│   │   ├── pdsa/         # PDSA documents (Plan-Do-Study-Act)
│   │   └── deliverables/ # Compiled outputs (PDFs, builds)
│   ├── v0.0.2/           # Next iteration
│   └── v1.0.0/           # Major release
├── docs → versions/v0.0.2/docs   # Symlink to active version
└── README.md
```

## Core Principles

### 1. Version folders are snapshots

Each `vX.Y.Z/` folder represents a complete, self-contained state. Once tagged in git, its contents are fixed. New work goes into a new version folder.

### 2. PDSA lives with its version

Every version has a `pdsa/` subdirectory documenting the planning, execution, verification, and learnings for that iteration. The PDSA is the narrative companion to the code/content changes — it explains *why*, not just *what*.

### 3. Symlinks point to the active version

The `docs` symlink at the project root always points to the current version's docs. This means:
- External references (READMEs, other repos) can use `docs/WORKFLOW.md` without version numbers
- Updating the symlink is a single atomic operation when a new version becomes active
- Old versions remain accessible at their explicit path

### 4. Deliverables are outputs, not sources

The `deliverables/` folder holds compiled artifacts (PDFs, built assets). Sources live alongside as markdown or other editable formats. This separation makes it clear what is generated and what is authored.

## Versioning Scheme

Two schemes are used depending on context:

### Semantic versioning (projects, CVs)

`vMAJOR.MINOR.PATCH` — follows [SemVer](https://semver.org/) principles:
- **MAJOR**: Breaking change or complete redesign (v0.x → v1.0.0)
- **MINOR**: New feature or significant content addition
- **PATCH**: Fix, refinement, small correction

Use for: base projects, CV versions, infrastructure.

### Iteration versioning (applications, experiments)

`v0.0.N` — simple sequential numbering:
- v0.0.1 = first draft
- v0.0.2 = refinement after feedback
- v0.0.N = Nth iteration

Use for: job applications, one-off deliverables, experimental branches. The `0.0` prefix signals "this is iterating toward a goal, not building a product."

## Folder Contents by Purpose

| Subfolder | Contains | Committed to git? |
|-----------|----------|-------------------|
| `docs/` | Documentation, guides, specs | Yes |
| `pdsa/` | PDSA cycle documents | Yes |
| `deliverables/` | Compiled outputs (PDFs) | Depends — PDFs from Typst/LaTeX are generated, not committed |
| `spec/` | Technical specifications | Yes |
| `sources/` | Source content (markdown) | Yes |

Not every version needs every subfolder. Use only what the project requires.

## Git Workflow

### Tagging versions

After committing all files for a version:

```bash
git tag -a v0.0.1 -m "v0.0.1: initial version description"
git push origin v0.0.1
```

Tags create immutable reference points. You can always `git checkout v0.0.1` to see the exact state.

### Starting a new version

```bash
mkdir -p versions/v0.0.2/{docs,pdsa,deliverables}
# Copy or evolve from previous version as needed
# Update symlink:
rm docs
ln -s versions/v0.0.2/docs docs
git add docs versions/v0.0.2/
git commit -m "chore: initialize v0.0.2"
```

## Real-World Examples

### XPollination MCP Server

```
xpollination-mcp-server/
├── versions/v0.0.1/
│   ├── docs/           # WORKFLOW.md, use cases, tutorials, dashboard
│   └── pdsa/           # 46 PDSA documents from initial development
├── docs → versions/v0.0.1/docs
├── src/                # Source code (not versioned in folders — git handles this)
└── data/               # Runtime data
```

The code itself is versioned by git branches/tags. The `versions/` pattern is for **documentation and process artifacts** that accompany the code.

### Best Practices

```
best-practices/
├── versions/v0.0.1/
│   ├── docs/           # Topic directories (layout/, cv-content/, social-media/, etc.)
│   ├── spec/           # Technical specification documents
│   └── pdsa/           # PDSA documents for this version
└── README.md
```

Pure knowledge repository — no source code. Versions track the evolution of the knowledge base itself.

### ProfileAssistant (Applications)

```
ProfileAssistant/
├── sources/cv/versions/v1.0.0/   # Base CV (semantic versioning)
│   ├── cv.md                      # English source
│   ├── cv-de.md                   # German source
│   └── deliverables/              # Compiled PDFs
├── applications/company/date-role/
│   ├── v0.0.1/                    # Iteration versioning
│   │   ├── anschreiben.md
│   │   ├── pdsa/
│   │   └── deliverables/
│   │       └── cv.pdf → symlink to base CV version
│   └── opportunity/               # Job posting artifacts
└── templates/                     # Typst templates
```

Combines both schemes: semantic for the base CV product, iteration for per-application drafts. The symlink from `deliverables/cv.pdf` to the base version creates an auditable link between what was sent and which CV version it referenced.

## Anti-patterns

- **Versioning source code in folders** — git already does this. Use `versions/` for docs, PDSAs, and deliverables only.
- **Copying entire previous versions** — only copy what needs to change. Reference unchanged content via symlinks or cross-references.
- **Forgetting to update the symlink** — the `docs` symlink must point to the active version. Stale symlinks cause confusion.
- **Skipping PDSA documents** — the version folder without a PDSA is a snapshot without narrative. Future agents (or your future self) won't know *why* this version exists.

## Projection

This pattern scales naturally:

- **Single project**: One `versions/` directory tracks all iterations
- **Multi-project ecosystem**: Each repo has its own `versions/`, with cross-repo references via absolute paths or symlinks
- **Agent collaboration**: Each agent reads the current version's docs (via symlink), writes results into the current version's deliverables, and documents the process in the current version's PDSA

As version count grows, older versions become archival. The symlink always points to what matters now. Git tags make any historical state instantly retrievable.

## Sources

- ProfileAssistant project — iteration versioning for job applications (2026-02-16)
- XPollination ecosystem — documentation versioning across 3 repos (2026-02-17)
- [Semantic Versioning 2.0.0](https://semver.org/) — MAJOR.MINOR.PATCH convention
