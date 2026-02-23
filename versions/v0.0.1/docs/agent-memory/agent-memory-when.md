# When Does Memory Get Written?

> Status: emerging
> Source: XPollination spec (15 documents), multi-agent operations (2026-01–02), Galarza (2026-02-17), MVP spec (doc 13), sleep consolidation research (doc 12)
> Version: 4.0.0 | Last updated: 2026-02-23
> PDSA: [2026-02-19-agent-memory.pdsa.md](../../pdsa/2026-02-19-agent-memory.pdsa.md)

---

## Summary

Memory writing happens at three timescales: **continuous** (every retrieval reinforces pheromone, every access gets logged), **event-driven** (session boundaries, user requests, context pressure), and **periodic** (sleep consolidation transforms episodic traces into semantic knowledge). The critical tension: writing too early captures noise, writing too late loses knowledge. The pheromone model resolves this — continuous reinforcement means the system is ALWAYS writing, but prominence self-regulates through decay. The PDSA Study phase remains the highest-value discrete extraction mechanism — it forces structured reflection at a natural stopping point.

---

## Context

### Three Timescales of Memory Writing

Agent memory triggers distribute across three timescales, from millisecond-level access tracking to weekly consolidation cycles:

| Timescale | Mechanism | What Gets Written |
|-----------|-----------|------------------|
| **Continuous** | Every retrieval logs access + reinforces pheromone | Access patterns, co-retrieval associations, pheromone weights |
| **Event-driven** | Session start, compaction, user requests, task completion | MEMORY.md entries, handoff files, DNA findings, PDSA docs |
| **Periodic** | Sleep consolidation (NREM + REM), scheduled maintenance | Abstract insights, cross-cluster bridges, pruned stale knowledge |

The XPollination specification (a thought-tracing and knowledge-synthesis system) envisions continuous-timescale writing — every thought unit is immediately stored via vector database middleware. Most practical agent systems operate at the event-driven timescale — discrete moments trigger writes to markdown files. Sleep consolidation adds the periodic timescale: systematic transformation of accumulated experience into higher-order knowledge during low-activity windows.

### Two Failure Modes

- **Write too eagerly** → memory fills with unverified noise that contradicts itself
- **Write too late** → context window fills, compaction triggers, and knowledge is lost

The pheromone model provides a third option: **write everything, let reinforcement sort it out.** New memories start at weight 1.0. If nobody accesses them, they decay toward 0.1 (~11%/day). If they prove useful, they grow toward 10.0. No manual filtering decision needed.

---

## Pattern

### Continuous Triggers

#### Trigger 1: Pheromone Reinforcement (Every Retrieval = Memory Write)

**When:** Every time an agent retrieves a thought from the vector database.

**What happens (from 13-MVP-SPEC):**
```
Agent queries POST /retrieve
  → Results returned (semantic similarity)
  → For each result: access_count += 1
  → For each result: pheromone_weight += 0.05 (ceiling 10.0)
  → accessed_by list updated with querying agent
  → co_retrieved_with updated for all result pairs
  → Query vector logged for later pattern analysis
```

This is the most frequent write trigger in the full system — it fires on EVERY retrieval. The write is lightweight (payload update, not new vector insertion), but it continuously reshapes the energy landscape of the knowledge base.

**Why this matters:** In the Hopfield formalism, each reinforcement deepens the energy well around that memory. Frequently accessed memories become strong attractors. This is Input-Driven Plasticity (IDP) — the system's energy landscape is reshaped by usage, not by explicit curation.

**Markdown equivalent:** None exists today. The closest approximation would be tracking which MEMORY.md entries agents actually reference each session — but this isn't implemented.

#### Trigger 2: Pheromone Decay (Every Hour = Forgetting)

**When:** Hourly scheduled job.

**What happens:**
```
For each vector not accessed in the last hour:
  pheromone_weight *= 0.995  (floor at 0.1)
  → ~11% total decay per day without reinforcement
  → After 1 week without access: weight ≈ 0.45 (halved)
  → After 1 month without access: weight ≈ 0.10 (floor)
```

This is the **forgetting** mechanism the spec envisions. Without it, early popular thoughts would permanently dominate the knowledge base. With it, highways fade if not maintained by traffic — the system self-regulates.

**Markdown equivalent:** Manual MEMORY.md pruning when the 200-line cap is hit. Much coarser — binary keep/delete vs. continuous decay.

### Event-Driven Triggers

#### Trigger 3: Bootstrap Loading (Session Start — READ)

**When:** Every session start. This is a read trigger, not a write trigger, but it's the foundation.

**What happens:**
```
Session starts
  → Claude Code loads ~/.claude/CLAUDE.md (global protocols)
  → Claude Code loads project/CLAUDE.md (project-specific protocols)
  → Claude Code loads memory/MEMORY.md (200-line index, auto-loaded)
  → Agent has accumulated knowledge without any action
```

**Cost:** Every line in MEMORY.md costs prompt tokens in every session. The 200-line cap is an economic constraint, not arbitrary.

**Spec equivalent:** `get_live_context()` (06-INTEGRATION-SPEC) queries all memory layers simultaneously. Bootstrap loading is the markdown equivalent: load everything upfront rather than querying per-utterance.

#### Trigger 4: Pre-Compaction Flush (Before Context Limits — EMERGENCY WRITE)

**When:** Context window approaches limits (below 20%, or "Compacting conversation" appears).

**Our experience (2026-02-03):** PDSA agent reached 7% context after heavy cross-repo work. Auto-compaction preserved structure but **degraded traceability first** — verbatim quotes and metadata were the first things cut. The agent claimed quotes were included; 5 of 11 were missing.

**The lesson:** Context pressure degrades the QUALITY of memory, not just the quantity. Write findings to persistent storage while context quality is still high.

**Recommended thresholds:**
```
50%+   : Work freely
20-50% : Consider persisting key findings to topic files or DNA
10-20% : Actively write to MEMORY.md or topic files
<10%   : Emergency — write handoff file, prepare for /compact
```

**Galarza's approach:** "Pre-compaction flush" — a silent agentic turn with the instruction "Store durable memories now." More automated than our manual approach.

**EverMemOS's engram lifecycle adds nuance:** Memory quality degrades in stages:
1. **Episodic traces** form first (raw, detailed, fragile)
2. **Semantic consolidation** abstracts patterns from traces (durable, compact)
3. Under context pressure, episodic traces degrade first — but if semantic consolidation hasn't happened yet, the detailed evidence is lost

**Implication:** Consolidation (PDSA Study) should happen BEFORE context pressure, not as a response to it.

#### Trigger 5: Session Snapshots (On Clear/Compact/End — BOUNDARY WRITE)

**When:** Agent executes `/clear`, `/compact`, or session ends naturally.

**What gets written (our system — handoff files):**
```markdown
# Handoff — <agent-name> — <timestamp>
## Goals: what was the objective
## Done: what was completed
## In Progress: what was started but not finished
## Blockers: what is preventing progress
## Key Decisions: decisions made and why
## Next Steps: what to do next
## Files Modified: list of changed files
```

**Galarza's approach:** `/new` command captures the last 15 meaningful messages as a session snapshot.

**Key difference:** Our handoffs are structured (specific fields force completeness). Galarza's snapshots are raw conversation excerpts.

#### Trigger 6: Explicit User Requests (On Demand — IMMEDIATE WRITE)

**When:** User says "remember this", "always do X", "never do Y".

**This trigger bypasses the filtering test.** If the user explicitly asks to remember something, it's stored. If they ask to forget, it's removed. User requests are the highest-authority memory write.

**From spec 07 (Conversation Trace 001):** Thomas said "Whatever you understand at this moment, be as granular as you can and document it now." This is an explicit user request applied to the entire system design.

#### Trigger 7: Post-Task Consolidation (PDSA Study/Act — HIGHEST VALUE DISCRETE WRITE)

**When:** After completing a task or PDSA iteration cycle.

**This is our most reliable memory extraction mechanism.** The PDSA structure forces reflection at a natural stopping point:

| Phase | Memory Action | 8-Layer Equivalent |
|---|---|---|
| **Plan** | Read existing memory (no write) | Layer 0 retrieval |
| **Do** | Write to task DNA `findings` (episodic) | Layer 0 storage |
| **Study** | Extract surprises, connections, gaps → MEMORY.md candidates | Layer 5 (NREM consolidation) |
| **Act** | Decide what should change → procedural memory updates | Layer 5 (REM bridging) |

**Why this works best:** The Study phase is inherently a filtering step. It asks "what did I learn?" not "what happened?" — forcing the agent to distill experience into knowledge.

**Evidence from this task:** Three iterations demonstrate compound value. Iteration 1 (shallow reformatting, ~10 min) → Iteration 2 (genuine insights about task DNA = thought units, ~45 min) → Iteration 3 (structural corrections and theoretical grounding from 1700 lines of new material). Each PDSA iteration builds on the last — the rework process itself IS the mirroring loop from spec 02.

### Periodic Triggers

#### Trigger 8: Sleep Consolidation (NREM + REM — TRANSFORMATION WRITE)

**When:** Scheduled during low-activity periods, or triggered by accumulated unprocessed data.

**This is the newest trigger from the research.** Three production-ready patterns exist (12-DEEP-DIVE-ITER3):

**NREM Phase (Deep Consolidation):**
1. Identify dense clusters in recently accessed vectors (DenStream micro-clusters)
2. For each cluster above density threshold: generate LLM-driven abstract summary
3. Embed the summary as a new consolidation vector (thought_type = "consolidation")
4. Link to source vectors via `source_ids` — provenance chain preserved
5. Hebbian reinforcement: strengthen associations between co-accessed vectors
6. Ebbinghaus decay on vectors not accessed since last sleep cycle

**REM Phase (Creative Consolidation):**
1. Identify weak cross-cluster bridges (vectors in co-retrieval graphs of multiple clusters)
2. Generate hypothetical connections: "These two knowledge regions are connected by..."
3. Create exploratory bridge vectors that increase cross-cluster discoverability
4. Test: do existing queries benefit from the new bridges?

**Letta's implementation:** Dual-agent architecture where the sleep-time agent runs during downtime. Achieves **5× token reduction** via pre-processing. The sleep-time agent reflects on interactions → generates clean memories from messy notes → reorganizes memory blocks → pre-computes embeddings.

**EverMemOS's implementation:** Episodic traces → MemCells → MemScenes via incremental clustering with conflict tracking. Profile integration adds +9.32 accuracy points.

**Our current equivalent:** The PDSA Study phase is manual NREM. The ACT phase is manual REM. But we have no periodic scheduling — consolidation happens only when a task ends, not on a clock.

#### Trigger 9: Stigmergic Phase Activation (ρ_c Threshold — MODE CHANGE)

**When:** User density in the shared vector database crosses ρ_c ≈ 0.23 (Khushiyant, arXiv:2512.10166).

**This is not a single write event — it's a mode transition.** Below ρ_c, individual memory dominates (MEMORY.md, personal knowledge). Above ρ_c, shared traces outperform individual memory by 36-41%. The write behavior changes:

| Below ρ_c | Above ρ_c |
|-----------|-----------|
| Personal MEMORY.md entries | Shared vector DB contributions |
| Individual PDSA docs | Multi-angle convergence zones |
| Manual topic file curation | Pheromone-weighted automatic prominence |
| File-based knowledge management | Highway detection + co-retrieval associations |

**Critical finding:** "Traces without memory fail completely" (Khushiyant). Raw access pattern data is meaningless without cognitive infrastructure to interpret it. The transition at ρ_c doesn't replace individual memory — it supplements it with collective intelligence features.

---

## Evidence

### Trigger Effectiveness Ranking (Updated with Iteration 3 Insights)

| Rank | Trigger | Value | Why |
|------|---------|-------|-----|
| 1 | Post-task consolidation (PDSA Study) | Highest discrete | Forces structured reflection; produces distilled insights |
| 2 | Pheromone reinforcement (continuous) | Highest continuous | Self-regulating; no human decision needed; scales to any knowledge volume |
| 3 | Explicit user requests | High | User knows what matters; bypasses speculation filter |
| 4 | Sleep consolidation (NREM/REM) | High periodic | Transforms episodic traces to semantic knowledge; bridges knowledge regions |
| 5 | Bootstrap loading | Essential | Foundation — without it, agents are amnesiac |
| 6 | Pre-compaction flush | Safety net | Prevents catastrophic knowledge loss |
| 7 | Session snapshots | Moderate | Good for continuity but lower signal-to-noise |
| 8 | Pheromone decay (continuous forgetting) | Essential maintenance | Prevents old knowledge from permanently dominating |

### When We Lost Knowledge (Real Incidents)

| Date | What Happened | Which Trigger Would Have Saved It |
|------|--------------|----------------------------------|
| 2026-02-01 | PDSA agent looped for 10h in unbounded research; no lesson extracted | Trigger 7 (post-task consolidation wasn't practiced yet) |
| 2026-02-02 | QA wrote PDSA docs; role violation repeated twice before documented | Trigger 6 (user correction wasn't immediately persisted) |
| 2026-02-03 | Context at 7%, compaction lost verbatim quotes from PDSA output | Trigger 4 (pre-compaction flush; should have written findings at 20%) |
| 2026-02-18 | CV templates forgotten — 4-file rule not documented | Trigger 7 (the "always update 4 files" lesson should have been extracted from first occurrence) |

Every knowledge loss corresponds to a missed trigger. With pheromone reinforcement (trigger 1), the loss pattern would change: information used repeatedly would be automatically preserved; information used once would decay — but that might be acceptable.

### The Spec's Three-Phase Agent Lifecycle Maps to Trigger Timescales

From 03-AGENT-GUIDELINES:
```
BEFORE work: Read relevant knowledge                → Trigger 3 (bootstrap) — event-driven
DURING work: Apply patterns, log access             → Triggers 1-2 (pheromone) — continuous
AFTER work:  Contribute findings back               → Trigger 7 (consolidation) — event-driven
OVERNIGHT:   Transform episodic → semantic           → Trigger 8 (sleep) — periodic
THRESHOLD:   Activate collective features            → Trigger 9 (stigmergy) — mode change
```

---

## Examples

### Post-Task Memory Write (Best Practice)

After discovering the task DNA / thought unit equivalence:

```markdown
## PDSA STUDY — 2026-02-19
### Discovery: Task DNA IS Episodic Memory
The PM system's task DNA maps to spec 03's thought unit schema:
- description → content
- findings → decoded interpretation
- rework_iteration → iteration_depth
- acceptance_criteria → anchoring criteria
**Implication:** Agents should treat DNA `findings` field as formal memory writes.
```

Then, if this proves stable across multiple tasks, promote to MEMORY.md:
```markdown
## PM System = Multi-Agent Memory Layer
Task DNA maps to spec's thought unit schema.
`findings` field = episodic memory. Treat DNA updates as memory writes.
```

### Continuous Pheromone Write (Full System)

```
Agent Bob queries POST /retrieve: "scaling challenges in distributed teams"
  → Alice's thought on matrix organizations appears (score 0.87)
  → Alice's pheromone: 1.0 → 1.05
  → Bob added to Alice's accessed_by list
  → Carol's thought on communication patterns co-retrieved
  → co_retrieved_with updated for both Alice and Carol's thoughts
  → Query vector logged for pattern analysis

[1 hour later, no access]
  → Alice's pheromone: 1.05 → 1.05 * 0.995 = 1.045

[Next day, 3 more agents retrieve Alice's thought]
  → pheromone: 1.045 → 1.195 (growing — this is becoming a highway)
```

### Sleep Consolidation Write (Periodic)

```
[NREM Phase — 2am, low activity]
  Cluster detected: 5 vectors about "role separation in multi-agent systems"
    → LLM generates abstract: "Role boundaries prevent coordination collapse.
       QA writes tests (specification), Dev implements (never changes tests),
       PDSA plans (never codes). Violations cause cascading failures."
    → New consolidation vector stored with thought_type="consolidation"
    → source_ids links to all 5 cluster members
    → Provenance preserved: Alice contributed 2, Bob contributed 3

[REM Phase]
  Bridge detected: "role separation" cluster weakly connected to "git protocol" cluster
    → Hypothesis: "Both enforce boundaries — role boundaries for agents,
       process boundaries for code changes"
    → Exploratory bridge vector created
    → If future queries benefit from this bridge, it persists; if not, it decays
```

### Pre-Compaction Emergency Save (Good Practice)

Agent at 15% context:
```bash
# Write handoff BEFORE running /compact
cat > .claude/handoffs/pdsa-2026-02-23.md << 'EOF'
# Handoff — PDSA — 2026-02-23T09:00Z
## Done: Completed agent-memory iteration 3 research
## Key Discovery: 8-layer architecture is concurrent, not sequential
## Key Discovery: Pheromone model bridges "never delete" vs "200-line cap"
## Files Modified: pdsa/2026-02-19-agent-memory.pdsa.md, docs/agent-memory/*.md
EOF
```

---

## Minimal Viable Memory Writing Setup

### Day 1: Bootstrap + User Requests (Triggers 3 + 6)

**What to set up:**
- Create `CLAUDE.md` (or equivalent config file) with initial project rules
- Establish convention: when the user says "remember this," persist it immediately

**What to write:**
- Essential protocols (git workflow, role boundaries, tool paths)
- Anything the user explicitly asks you to remember

**Checklist:**
- [ ] `CLAUDE.md` exists with project-specific rules
- [ ] Agent knows to persist explicit "remember this" instructions

### Week 1: Add Session Boundaries + Context Pressure (Triggers 4 + 5)

**What to set up:**
- Create `memory/MEMORY.md` as a 200-line concise index
- Create topic files for detailed notes (e.g., `memory/debugging.md`)
- Define a handoff file format for session transitions

**What to write at session boundaries:**
- When running `/compact` or `/clear`: write a handoff file with Goals/Done/In Progress/Blockers/Next Steps
- When context drops below 20%: write key findings to a topic file before compaction degrades them

**Checklist:**
- [ ] `memory/MEMORY.md` exists with concise index
- [ ] At least 1 topic file exists for detailed notes
- [ ] Agent writes handoff file before session transitions
- [ ] Agent watches context percentage and writes findings proactively at 20%

### Month 1: Add Post-Task Consolidation (Trigger 7)

**What to set up:**
- Adopt a structured reflection format (PDSA, retrospective, or equivalent)
- Define a `findings` or `lessons_learned` field in task metadata
- Add a "last reviewed" date to MEMORY.md entries for staleness detection

**What to write after each task:**
- **Study:** What did I learn? What surprised me? What connections did I find?
- **Act:** What should change in our protocols or memory?
- Promote stable insights from task findings to MEMORY.md

**Checklist:**
- [ ] Post-task reflection is part of the workflow (not optional)
- [ ] Task metadata includes a `findings` field that agents treat as episodic memory
- [ ] A process exists for promoting stable findings to MEMORY.md
- [ ] MEMORY.md entries have "last reviewed" dates

### Month 3+: Add Vector Search + Pheromone Model (Triggers 1 + 2)

**When to add this:** When agents routinely can't find information in MEMORY.md + topic files, or when you need cross-project knowledge discovery.

**What to set up:**
- Deploy a vector database (Qdrant, Pinecone, or similar)
- Build API endpoints for contributing thoughts (`/think`) and retrieving them (`/retrieve`)
- Implement pheromone reinforcement (+0.05 per access, ceiling 10.0)
- Schedule hourly pheromone decay (×0.995/hour, floor 0.1)

**Checklist:**
- [ ] Vector database deployed and accessible
- [ ] Agents can contribute thoughts with provenance metadata
- [ ] Retrieval logs access patterns (who, when, co-retrieved with what)
- [ ] Pheromone model runs (reinforcement on access, decay on schedule)
- [ ] `/highways` endpoint surfaces emerging patterns

### Month 6+: Add Sleep Consolidation (Trigger 8)

**When to add this:** When accumulated vector data is large enough to benefit from periodic abstraction.

**What to set up:**
- Schedule NREM consolidation: cluster dense regions → LLM-generated abstracts → new consolidation vectors
- Schedule REM consolidation: identify cross-cluster bridges → generate hypothetical connections
- Define maintenance: evict vectors below relevance threshold, rebalance indexes

**Checklist:**
- [ ] Consolidation runs during low-activity periods
- [ ] Consolidation vectors link back to sources via `source_ids`
- [ ] Cross-cluster bridges are tested against real queries before permanent storage

---

## Key Takeaways

- **Day 1: bootstrap config + honor user requests.** These two triggers alone cover most memory needs for a new project.
- **The highest-value discrete trigger is post-task consolidation.** After completing work, ask: "What did I learn? What surprised me? What should change?" This structured reflection produces the most useful memories.
- **Pre-compaction saves are a safety net, not a strategy.** Write findings proactively at 20% context remaining — don't wait for compaction to force it.
- **Pheromone reinforcement makes memory self-regulating.** Every retrieval is a memory write (+0.05 weight). Every hour without access is forgetting (x0.995 decay). No manual curation needed at scale.
- **Start the implementation checklist at Day 1, not Month 3.** The checklist in this document provides a prescriptive path from one config file to full vector-DB-backed memory with sleep consolidation. Each step is triggered by a real limitation, not architectural ambition.

---

## Open Questions

1. **Automated pre-compaction flush** — Can agents be taught to detect context pressure and automatically persist findings? Galarza's "silent agentic turn" is one model. Could the PDSA template include a "context checkpoint" section?

2. **Sleep consolidation scheduling** — When should consolidation run? During agent idle time? On a fixed schedule? Triggered by accumulated unprocessed data volume? Letta's "downtime processing" and EverMemOS's "event boundary" detection offer different approaches.

3. **Continuous write for markdown systems** — Is there a practical way to approximate pheromone reinforcement for MEMORY.md? Perhaps a "last used" field on each entry, updated by agents who reference it?

4. **Stigmergic activation detection** — How do you know when your system has crossed ρ_c? What metrics signal that collective trace features should be activated?

See also: [pheromone tuning](agent-memory-where.md#open-questions) | [co-retrieval validation experiment](agent-memory-where.md#open-questions) | [write-time filtering limits](agent-memory-what.md#open-questions)

---

## Related

- [PDSA: Agent Memory Research](../../pdsa/2026-02-19-agent-memory.pdsa.md) — the research journey (6 iterations)
- [14-AGENT-CONTEXT](../../feedback/agent-memory/14-AGENT-CONTEXT.md) — consolidated vision with MVP and pheromone model
- [12-DEEP-DIVE-ITER3](../../feedback/agent-memory/12-DEEP-DIVE-THINKING-INFRASTRUCTURE-ITER3.md) — sleep consolidation, stigmergic phase transition, RL formulation
- [13-MVP-SPEC](../../feedback/agent-memory/13-MVP-SPEC-THOUGHT-TRACING.md) — pheromone model details, thought lifecycle
- [agent-memory-what.md](agent-memory-what.md) — what is worth remembering
- [agent-memory-where.md](agent-memory-where.md) — storage architecture
