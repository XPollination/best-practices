# Brain Architecture: PageIndex-Informed Redesign

**Date:** 2026-02-27 | **Author:** Claude Web + Thomas Pichler
**Purpose:** Actionable research for the agentic team. Read this, understand the problems, build the solutions.

---

## The Core Problem (Experienced, Not Theorized)

During this research session, I queried the brain 10+ times to understand its own problems. I experienced every problem I was researching:

1. **Can't read what's in the brain.** Every response: 80-char previews. The MCP tool has no `drill_down(thought_id)` or `include_full_content` parameter. The API has both — the MCP doesn't expose them.

2. **Every read pollutes the brain.** Each `query_brain` call persists the query as a new thought. 10 research queries = 10 noise entries. `keyword_echo` is now detected but still stored.

3. **No structure.** All thoughts are flat — no hierarchy, no parent-child, no domains. Related thoughts (same task, same topic) appear as disconnected items.

4. **Highways are broken.** Every query returns the same 5 entries about "role separation prevents coordination collapse" (236 accesses). These are popularity-weighted, not context-relevant. A query about PageIndex gets the same highways as a query about UGP applications.

5. **Vector similarity ≠ relevance.** PageIndex calls this "vibe retrieval." The brain finds things that SOUND similar to the query, not things that ARE relevant to the intent.

---

## The PageIndex Principle

PageIndex replaced vector search for document retrieval with: **hierarchical tree index + LLM reasoning-based navigation.** Don't search for similar text — navigate a structure and reason about where the answer lives.

Key difference: PageIndex works on **static documents** with pre-existing structure. Our brain stores **emergent knowledge** — structure must be CREATED, not discovered. This is why we need the Gardener.

---

## The Gardener: Central Engine + Three Invocation Layers

### Rahmenbedingung

The system never pauses. There is no "idle time." The LIAISON loop is always in motion. Gardening must be interleaved, not separated.

### Core Architecture Decision

**One central engine, three invocation patterns.**

```
┌─────────────────────────────────────────────────┐
│  /xpo.claude.mindspace.garden  (SKILL.md)       │
│  = THE ENGINE                                    │
│                                                  │
│  Parameters:                                     │
│    scope:  "recent" | "task:<slug>" | "full"     │
│    depth:  "shallow" | "micro" | "deep"          │
│    dry_run: true | false                         │
│                                                  │
│  Operations (all layers use the same code):      │
│    - Read contributions (scoped)                 │
│    - Cluster by domain/topic                     │
│    - Flag/prune noise (keyword echoes, dupes)    │
│    - Generate/update summaries                   │
│    - Build/update curated highways               │
│    - Report changes                              │
└──────────┬──────────────┬──────────────┬─────────┘
           │              │              │
     Layer 1 call    Layer 2 call   Layer 3 call
           │              │              │
    scope="recent"   scope="full"   scope="task:<slug>"
    depth="shallow"  depth="deep"   depth="micro"
```

**Why central:** Changes to gardening logic happen in ONE place. All three layers inherit improvements automatically. No drift between implementations.

### Design Principle: The Gardening Aperture Follows the Decision Context

Why does Layer 1 scan "recent" (everything) while Layer 3 scans "task:slug" (one task)?

Because the scope of gardening must match the cognitive scope of the moment it runs in.

**Layer 1 runs during PM Status** — Thomas is looking at the WHOLE system. All projects, all tasks, all agents. His question is "what's the state of the whole?" So the gardener scans everything since the last check. Wide aperture, low depth. System-level health.

**Layer 3 runs at Task Completion** — one agent just finished ONE specific thing. It knows exactly which task, which thoughts it contributed, which slug. So it gardens only its own thread. Narrow aperture, high depth. Local consolidation.

**Layer 2 is the darkroom** — Thomas deliberately develops the full picture. No time constraint, maximum thoroughness.

Inverted would break: Layer 1 as task-specific would require gardening 15 tasks individually during PM status (too slow, wrong context). Layer 3 as "recent" would have the cover-letter agent reorganizing UGP thoughts it has no context for (wrong scope, bad consolidation).

Same principle as consulting: you don't assess the whole organization when closing a workshop day, and you don't look at one process when doing a system assessment. Analysis level matches decision moment.

### Layer 1: PM Status Gardening (systemic, toggleable)

**When:** BEFORE Thomas makes decisions in the PM status flow. The gardener output INFORMS decisions — it's Study before Act.

**Flow:**
```
Thomas triggers /xpo.claude.mindspace.pm.status
  → LIAISON scans project DBs
  → LIAISON calls garden engine (scope="recent", depth="shallow")
  → LIAISON presents:
      1. PM status overview (tasks, states, roles)
      2. Brain health section (from gardener)
  → Thomas decides with full picture
```

**What "shallow" means:**
- Count new contributions since last gardening timestamp
- Categorize by domain (using existing topic/category fields)
- Count noise entries (keyword echoes detected)
- Flag obvious duplicates (high similarity between recent entries)
- NO tree rebuilding, NO highway curation, NO deep merging
- Output: 3-5 line summary

**Toggle:** Enabled/disabled via config flag in the PM status SKILL.md.
```yaml
gardening:
  layer1_enabled: true   # ← toggle
  layer3_enabled: true   # ← toggle
```

**Initial state: ENABLED.**

### Layer 2: Deep Gardening (on-demand, manual)

**When:** Thomas runs `/xpo.claude.mindspace.garden` directly. No toggle needed — it's explicitly invoked.

**What "deep" means — the full cycle:**
1. Read ALL contributions since last deep garden (full content via API)
2. Cluster by domain and topic
3. For each cluster:
   - Generate/update a summary thought (`thought_category: "domain_summary"`)
   - Identify and delete keyword echoes
   - Merge near-duplicates into consolidated thoughts
   - Mark superseded thoughts
   - Ensure correction chains have latest version most visible
4. Build curated highways:
   - For each active domain, identify the most useful thought SEQUENCE
   - Create highway entries that are PATHS not single thoughts
   - Weight by resolution value, not access count
5. Report to Thomas: entries processed, noise removed, highways updated
6. Update deep gardening timestamp

### Layer 3: Transition Micro-Gardening (per-task, toggleable)

**When:** A task transitions to `complete`. The completing agent calls the garden engine scoped to that task's contributions.

**What "micro" means:**
- Read brain entries related to this task (by topic field or task slug in content)
- Write ONE consolidation thought summarizing what the task learned
- Mark intermediate thoughts (task start markers, status updates) as archivable
- NO cross-domain work, NO highway curation

**Toggle:** Same config as Layer 1.

**Initial state: ENABLED.** Each task cleans up its own thread — this is hygiene at the natural boundary.

### Why This Toggle Pattern

Thomas can evolve the system incrementally:
1. Start with Layer 1 ON + Layer 3 ON → system-level pulse + per-task hygiene
2. If Layer 1 adds too much time to PM status → disable Layer 1, keep Layer 3
3. If both cause overhead → disable both, rely on Layer 2 manual runs
4. Layer 2 always available on demand regardless of toggle state

---

## Implementation Status

### What Exists (API level, verified by QA)

| Feature | Status |
|---------|--------|
| Drill-down endpoint | ✅ Deployed |
| Opt-in full content | ✅ Deployed |
| Thought categories | ✅ Deployed |
| Keyword echo detection | ✅ Deployed |
| Topic field | ✅ Deployed |

### What's Missing (MCP level, verified by Claude Web testing)

| Gap | Status |
|-----|--------|
| MCP drill-down + full content | ❌ Not exposed |
| Query pollution prevention | ❌ Detected but still persists |
| Highway contextual relevance | ❌ Same 5 entries on every query |
| Gardener process | ❌ Not designed |
| Retroactive categorization | ❌ Only new entries tagged |

---

## Tasks for the Team

### Task 1: MCP Full Content Exposure
**What:** Update MCP wrapper to expose `drill_down(thought_id)` and `include_full_content` parameter on `query_brain`.
**Why:** API has the capability, agents can't use it. Unlocks everything else.
**Acceptance:** Agent calls `query_brain` with full content flag → receives >80 chars. Agent calls `drill_down(thought_id)` → receives complete thought.
**Effort:** Small — wiring existing API through MCP interface.
**Implementation hint:** Add optional `include_full_content: boolean` param to `query_brain` tool definition; add new `drill_down_thought` tool with `thought_id: string` param calling existing endpoint.

### Task 2: Query Pollution Prevention
**What:** When `keyword_echo` is detected, don't persist the thought.
**Why:** Every query creates a noise entry. Signal-to-noise degrades with every read.
**Acceptance:** `query_brain` call triggering `keyword_echo` returns results but creates NO new thought entry.
**Effort:** Small — conditional guard before persist: `if (quality_flags.includes('keyword_echo')) skip_persist()`.

### Task 3: Highway Redesign
**What:** Replace frequency-based highway selection with context-weighted relevance.
**Why:** Core concept is broken — same entries on every query regardless of topic.
**Acceptance:** Query about "cover letter" returns highways about positioning, not agent coordination.
**Design options (PDSA to evaluate):**
- **Option A:** Filter highways by `topic`/`thought_category` matching query context
- **Option B:** Vector similarity filtered to high-access entries only (hybrid)
- **Option C:** Gardener-curated paths replace auto-generated highways (depends on Task 5)
- **Option D:** Frequency-weighted WITHIN domain, not globally
**Effort:** Medium.

### Task 4: PM Status Gardening Phase (Layer 1)
**What:** Add gardening micro-step to PM status skill. Runs BEFORE Thomas's decision phase.
**Why:** Systemic Study phase. Runs every cycle. Prevents drift.
**Design:**
```
After DB scan, before presentation:
1. Call garden engine: scope="recent", depth="shallow"
2. Engine returns: {new_count, noise_count, domains_active, duplicates_flagged}
3. Present as "Brain Health" section within PM status output
4. Update gardening timestamp
```
**Toggle:** `layer1_enabled` flag in SKILL.md config. Default: true.
**Acceptance:** PM status includes Brain Health section. Toggleable via config.
**Effort:** Medium. Depends on Task 1 (full content access).
**Location:** Extend `best-practices/.claude/skills/xpo.claude.mindspace.pm.status/SKILL.md`

### Task 5: Gardener Engine Skill (Layer 2 — the central implementation)
**What:** New skill `/xpo.claude.mindspace.garden` containing ALL gardening logic. Layer 1 and 3 call into this.
**Why:** Single source of truth for gardening operations. Changes propagate to all layers.
**Design:**
```
Skill accepts parameters: scope, depth, dry_run
  
scope="recent":      Contributions since last gardening timestamp
scope="task:<slug>": Contributions related to specific task
scope="full":        All contributions since last deep garden

depth="shallow":     Count, categorize, flag (no mutations)
depth="micro":       Consolidate + archive for one task scope
depth="deep":        Full cycle — cluster, summarize, prune, build highways

dry_run=true:        Report what WOULD change without mutating
dry_run=false:       Execute changes

Operations (depth-dependent):
shallow: count, categorize, flag noise, report
micro:   + consolidation thought, + mark intermediates archivable
deep:    + domain summaries, + duplicate merging, + highway curation, + superseding
```
**Acceptance:** `/xpo.claude.mindspace.garden` runs independently (Layer 2). PM status can call it with scope="recent" depth="shallow" (Layer 1). Task completion can call it with scope="task:slug" depth="micro" (Layer 3).
**Effort:** High — this is the strategic investment.
**Location:** `best-practices/.claude/skills/xpo.claude.mindspace.garden/SKILL.md`

### Task 6: Transition Micro-Gardening Hook (Layer 3)
**What:** On task completion, call garden engine scoped to that task.
**Why:** Distributed gardening — each task cleans up after itself.
**Design:** Completing agent calls garden engine: `scope="task:<slug>", depth="micro"`.
**Toggle:** `layer3_enabled` flag in monitor SKILL.md config. Default: true.
**Acceptance:** On task completion with Layer 3 enabled, a consolidation thought is created and intermediate entries are archived. Toggleable.
**Effort:** Small once Task 5 exists — just a hook call.

### Task 7: Retroactive Categorization
**What:** Batch job to categorize existing uncategorized thoughts.
**Why:** Only new entries are tagged. Existing thoughts invisible to filters.
**Design:** Can run as first operation of first deep gardening (Task 5). LLM pass over all thoughts with full content, assign `thought_category` and `topic`.
**Acceptance:** >80% of existing thoughts have a category and topic.
**Effort:** Medium. Depends on Task 1.

### Task Priority, Dependencies, and Execution Order

```
                    ┌─────────┐
                    │ Task 1  │ MCP Full Content
                    │ CRITICAL│ 
                    └────┬────┘
                         │
              ┌──────────┼──────────┐
              │          │          │
        ┌─────┴───┐ ┌───┴─────┐ ┌─┴───────┐
        │ Task 4  │ │ Task 5  │ │ Task 7  │
        │ Layer 1 │ │ Engine  │ │ Retrocat│
        │ HIGH    │ │ HIGH    │ │ MEDIUM  │
        └─────────┘ └────┬────┘ └─────────┘
                         │
                    ┌────┴────┐
                    │ Task 6  │ Layer 3 hook
                    │ MEDIUM  │ (disabled initially)
                    └─────────┘

Task 2: Query Pollution — no dependencies, parallel with Task 1
Task 3: Highway Redesign — no hard dependency, but informed by Task 5
```

**Phase 1 (immediate):** Tasks 1 + 2 — small effort, parallel, unblocks everything
**Phase 2 (next):** Task 5 (engine) + Task 4 (Layer 1 wiring) + Task 3 (highway design)
**Phase 3 (after Phase 2 stable):** Task 6 (Layer 3) + Task 7 (retroactive)

---

## Key Vocabulary

| Term | Definition |
|------|-----------|
| **Vibe Retrieval** | Vector similarity returning things that SOUND similar, not ARE relevant |
| **Gardener Engine** | Central gardening logic in `/xpo.claude.mindspace.garden`. One implementation, three invocation patterns |
| **Layer 1** | PM status addon. Calls engine with scope=recent, depth=shallow. BEFORE Thomas decides. Toggle: ON |
| **Layer 2** | On-demand deep gardening. Calls engine with scope=full, depth=deep. Manual trigger |
| **Layer 3** | Transition micro-gardening. Calls engine with scope=task, depth=micro. Toggle: ON |
| **Highway (current)** | Most-accessed thought globally. Broken: same entries regardless of query |
| **Highway (target)** | Curated knowledge path — directional, domain-specific, value-weighted |
| **Query Pollution** | Every brain read creates a write. Signal degrades with every search |
| **Last Mile Gap** | API has capabilities, MCP doesn't expose them |

---

*Consolidated 2026-02-27. Claude Web research session with Thomas Pichler.*
