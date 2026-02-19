# When Does Memory Get Written?

> Status: emerging
> Source: XPollination spec (esp. 01, 02, 03, 06, 07), multi-agent operations (2026-01–02), Galarza (2026-02-17)
> Version: 2.0.0 | Last updated: 2026-02-19
> PDSA: [2026-02-19-agent-memory.pdsa.md](../../pdsa/2026-02-19-agent-memory.pdsa.md)

---

## Summary

Memory writing is triggered by five lifecycle events: bootstrap loading, pre-compaction flush, session snapshots, explicit user requests, and post-task consolidation. The spec adds a sixth: continuous real-time injection during conversations. The critical tension: writing too early captures noise, writing too late loses knowledge. The PDSA Study phase is the most reliable memory extraction mechanism we've found — it forces structured reflection at a natural stopping point.

---

## Context

### Two Failure Modes

- **Write too eagerly** → memory fills with unverified noise that contradicts itself
- **Write too late** → context window fills, compaction triggers, and knowledge is lost

The spec's approach (06-INTEGRATION-SPEC) avoids both by writing continuously during conversations — every aligned thought unit is immediately stored. But this requires the full vector+graph infrastructure. For markdown-based systems, you need discrete triggers.

### The Spec's Continuous Write Model

From 02-CORE-ARCHITECTURE, the Mirroring Loop operates continuously:

```
Human speaks → AI decodes → AI reflects back → Human refines → AI integrates
→ System documents BOTH the convergence point AND the path → Next cycle
```

Every iteration of this loop produces a thought unit that gets stored (06-INTEGRATION-SPEC): embedded in Qdrant, added as a node in Neo4j, and eventually crystallized as markdown if convergence stabilizes.

This is fundamentally different from Galarza's discrete-event model (write at session boundaries) or our practice (write at PDSA Study/Act phases). The spec envisions **continuous memory accumulation** during work. Our system does **batch memory extraction** after work.

---

## Pattern

### Trigger 1: Bootstrap Loading (Session Start — READ)

**When:** Every session start. This is a read trigger, not a write trigger.

**What happens:**
```
Session starts
  → Claude Code loads ~/.claude/CLAUDE.md (global protocols)
  → Claude Code loads project/CLAUDE.md (project-specific protocols)
  → Claude Code loads memory/MEMORY.md (200-line index, auto-loaded)
  → Agent has accumulated knowledge without any action
```

**Cost:** Every line in MEMORY.md costs prompt tokens in every session. This is why the 200-line cap matters — it's not arbitrary, it's an economic constraint.

**Spec equivalent:** 06-INTEGRATION-SPEC describes `get_live_context()` which queries Vector DB + Graph + Best Practices + Truth Anchors on every utterance. Bootstrap loading is the markdown equivalent: load everything upfront rather than querying per-utterance.

### Trigger 2: Pre-Compaction Flush (Before Context Limits — EMERGENCY WRITE)

**When:** Context window approaches limits (below 20%, or "Compacting conversation" appears).

**What happens:** Agent should proactively write any session knowledge to persistent storage before compaction degrades or removes it.

**Our experience (2026-02-03):** PDSA agent reached 7% context remaining after heavy cross-repo work. Auto-compaction preserved structure but **degraded traceability first** — verbatim quotes and metadata were the first things cut. The agent claimed quotes were included; 5 of 11 were missing.

**The lesson:** Context pressure degrades the QUALITY of memory, not just the quantity. Write findings to persistent storage while context quality is still high.

**Recommended thresholds:**
```
50%+   : Work freely
20-50% : Consider persisting key findings
10-20% : Actively write to MEMORY.md or topic files
<10%   : Emergency — write handoff file, prepare for /compact
```

**Galarza's approach:** "Pre-compaction flush" — a silent agentic turn with the instruction "Store durable memories now. If nothing to store, reply with NO_REPLY." This is more automated than our manual approach.

### Trigger 3: Session Snapshots (On Clear/Compact/End — BOUNDARY WRITE)

**When:** Agent executes `/clear`, `/compact`, or session ends naturally.

**What gets written:**

Our system uses handoff files:
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

**Galarza's approach:** `/new` command captures the last 15 meaningful messages as a session snapshot with a descriptive filename (e.g., `2026-02-08-api-design.md`).

**Key difference:** Our handoffs are structured (specific fields force completeness). Galarza's snapshots are raw conversation excerpts (more faithful to the actual exchange but less organized).

### Trigger 4: Explicit User Requests (On Demand — IMMEDIATE WRITE)

**When:** User says "remember this", "always do X", "never do Y".

**What happens:** The instruction is persisted immediately — no waiting for confirmation across multiple interactions.

**This trigger bypasses the filtering test.** If the user explicitly asks to remember something, it's stored. If they ask to forget, it's removed. User requests are the highest-authority memory write.

**From spec 07 (Conversation Trace 001):** Thomas said "Whatever you understand at this moment, be as granular as you can and document it now." This is an explicit user request applied to the entire system design — document immediately, don't wait for polish.

### Trigger 5: Post-Task Consolidation (PDSA Study/Act — HIGHEST VALUE WRITE)

**When:** After completing a task or PDSA iteration cycle.

**This is our most reliable memory extraction mechanism.** The PDSA structure forces reflection at a natural stopping point:

| Phase | Memory Action |
|---|---|
| **Plan** | (no memory write — this is reading existing memory) |
| **Do** | (writes to task DNA `findings` — episodic memory) |
| **Study** | Extracts surprises, connections, gaps → candidates for MEMORY.md |
| **Act** | Decisions about what should change → procedural memory updates |

**Why this works best:** The Study phase is inherently a filtering step. It asks "what did I learn?" not "what happened?" — forcing the agent to distill experience into knowledge.

**Evidence from this task:** The initial submission (iteration 1) skipped the PDSA process and produced shallow reformatted DNA. Iteration 2 with full PDSA research discovered non-obvious connections (task DNA = thought units, PDSA = thought traces, PM system = multi-agent memory). The process IS the value.

### Trigger 6 (Spec Vision): Continuous Real-Time Injection

**When:** Every time a human speaks during a conversation.

**From 06-INTEGRATION-SPEC:**
1. Embed the latest input
2. Query Vector DB for relevant thought traces (top 10)
3. Retrieve convergence zones (limit 5)
4. Retrieve best practices (limit 3)
5. Retrieve truth anchors with score ≥ 0.7 (limit 3)
6. All returned as unified context

**This is both a READ and WRITE trigger:** The system reads to inject context, but also writes the new thought unit to storage after decoding and alignment.

**Our system has no equivalent.** The closest is the PM system's `update-dna` command, which agents call during task work. But this is deliberate, not automatic.

---

## Evidence

### Trigger Effectiveness Ranking (From Our Experience)

| Rank | Trigger | Value | Why |
|------|---------|-------|-----|
| 1 | Post-task consolidation (PDSA Study) | Highest | Forces structured reflection; produces distilled insights |
| 2 | Explicit user requests | High | User knows what matters; bypasses speculation filter |
| 3 | Bootstrap loading | Essential | Foundation — without it, agents are amnesiac |
| 4 | Pre-compaction flush | Safety net | Prevents catastrophic knowledge loss |
| 5 | Session snapshots | Moderate | Good for continuity but lower signal-to-noise |

### The Spec's Three-Phase Agent Lifecycle Maps to Triggers

From 03-AGENT-GUIDELINES:

```
BEFORE work: Read relevant best practices and thought traces → Trigger 1 (Bootstrap)
DURING work: Apply documented patterns                       → Trigger 6 (Continuous injection, spec only)
AFTER work:  Contribute findings back                        → Trigger 5 (Post-task consolidation)
```

### When We Lost Knowledge (Real Incidents)

| Date | What Happened | Which Trigger Would Have Saved It |
|------|--------------|----------------------------------|
| 2026-02-01 | PDSA agent looped for 10h in unbounded research; no lesson extracted | Trigger 5 (post-task consolidation wasn't practiced yet) |
| 2026-02-02 | QA wrote PDSA docs; role violation repeated twice before documented | Trigger 4 (Thomas corrected, but correction wasn't immediately persisted) |
| 2026-02-03 | Context at 7%, compaction lost verbatim quotes from PDSA output | Trigger 2 (pre-compaction flush; should have written findings at 20%) |
| 2026-02-18 | CV templates forgotten — 4-file rule not documented | Trigger 5 (the "always update 4 files" lesson should have been extracted from the first occurrence) |

Every knowledge loss corresponds to a missed trigger.

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
Task DNA is functionally equivalent to spec's thought unit schema.
`findings` field = episodic memory. Treat DNA updates as memory writes.
```

### Pre-Compaction Emergency Save (Good Practice)

Agent at 15% context:
```bash
# Write handoff BEFORE running /compact
cat > .claude/handoffs/pdsa-2026-02-19.md << 'EOF'
# Handoff — PDSA — 2026-02-19T11:00Z
## Done: Completed agent-memory PDSA iteration 2
## Key Decision: task DNA = thought unit equivalence confirmed
## Files Modified: pdsa/2026-02-19-agent-memory.pdsa.md, docs/agent-memory/*.md
EOF
```

### Too-Early Write (Anti-Pattern)

After reading one spec document:
```markdown
## The spec uses Neo4j for all relationship tracking.
```

Why bad: Spec 04 SUGGESTS Neo4j/FalkorDB; it's not implemented. Writing this as fact after one read creates misleading memory. Wait until the pattern is confirmed across multiple documents or by implementation.

---

## Open Questions

1. **Automated pre-compaction flush** — Can agents be taught to detect context pressure and automatically persist findings? Galarza's approach ("silent agentic turn") is one model.
2. **Continuous injection for markdown systems** — Is there a practical way to approximate the spec's real-time context injection without vector infrastructure? Perhaps auto-querying topic files based on task domain?
3. **Memory write cadence** — Should there be a time-based trigger (e.g., every 30 minutes, persist key findings)? Or is event-based (triggers 1-5) sufficient?
4. **Post-task vs. mid-task extraction** — The PDSA Study phase happens AFTER the task. Should agents also extract memory during long tasks (e.g., at each sub-task completion)?

---

## Related

- [PDSA: Agent Memory Research](../../pdsa/2026-02-19-agent-memory.pdsa.md) — the research journey
- [01-SYSTEM-VISION spec](../../spec/01-SYSTEM-VISION.md) — "document it now" principle
- [03-AGENT-GUIDELINES spec](../../spec/03-AGENT-GUIDELINES.md) — three-phase agent lifecycle
- [06-INTEGRATION-SPEC spec](../../spec/06-INTEGRATION-SPEC.md) — continuous context injection pipeline
- [agent-memory-what.md](agent-memory-what.md) — what is worth remembering
- [agent-memory-where.md](agent-memory-where.md) — storage architecture
