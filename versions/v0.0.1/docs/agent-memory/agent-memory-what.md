# What Is Worth Remembering?

> Status: emerging
> Source: XPollination spec (10 documents), multi-agent operations (2026-01–02), Galarza (2026-02-17)
> Version: 2.0.0 | Last updated: 2026-02-19
> PDSA: [2026-02-19-agent-memory.pdsa.md](../../pdsa/2026-02-19-agent-memory.pdsa.md)

---

## Summary

Agent memory is a filtering problem, not a storage problem. The XPollination spec says "thought traces are never deleted" (04-VECTOR-DB-AND-GRAPH-STRATEGY), but in practice, a 200-line MEMORY.md forces constant triage. Both approaches work — one defers filtering to retrieval time (vector search), the other does it at write time (human curation). The three-type framework (semantic/episodic/procedural) is useful for classification, but the real question is deeper: **do you remember conclusions or trajectories?**

---

## Context

### The Three Memory Types

The Google Context Engineering framework classifies agent memory as:

- **Semantic memory** — stable facts and preferences ("We use git add with specific files, never git add .")
- **Episodic memory** — events and interactions ("On 2026-02-01, the PDSA agent spent 10 hours in an unbounded research loop")
- **Procedural memory** — workflows and learned routines ("After every file write, commit and push immediately")

This classification is useful but incomplete. It answers "what kind of thing is this memory?" but not "is this memory worth keeping?"

### The Deeper Question: Conclusions vs. Trajectories

The XPollination spec articulates a principle that changes how you think about memory:

> "The ability to reproduce how different thinkers arrived at convergence is itself the knowledge." (01-SYSTEM-VISION)

Most agent memory systems store conclusions: "always do X", "never do Y", "the API is at Z". These are semantic memories — stable facts. But the spec argues that the **path** to the conclusion is equally valuable. A PDSA document that records Plan → Do → Study → Act preserves the trajectory. A MEMORY.md entry that says "git add: always specific files" preserves only the conclusion.

Both have value. Conclusions are compact and fast to load. Trajectories enable understanding *why* a conclusion exists and *when* it might need revision.

---

## Pattern

### What TO Remember (by type and tier)

**Tier 1: Critical — forgetting causes repeated failures**

| Type | Example | Why Critical |
|------|---------|-------------|
| Procedural | Git protocol (add → commit → push, never `git add .`) | Violated in every session without it |
| Semantic | Role boundaries ("QA never fixes implementation code") | Agents default to doing everything without explicit constraints |
| Episodic | Anti-patterns with dates ("2026-02-02: QA wrote PDSA docs → broke role separation") | Prevents specific known failure modes |

**Tier 2: Important — speeds up work and reduces errors**

| Type | Example | Why Important |
|------|---------|--------------|
| Semantic | Project structure (key file paths, DB locations) | Eliminates repeated exploration |
| Procedural | Tool usage patterns (`interface-cli.js` commands, database paths) | Reduces setup time per session |
| Semantic | Infrastructure context (server specs, no-sudo constraint, VPN IPs) | Prevents impossible actions |

**Tier 3: Contextual — helpful but not essential**

| Type | Example | Lifespan |
|------|---------|----------|
| Episodic | Specific debugging sessions | Until bug is fixed |
| Semantic | Current task status | Until task completes |
| Episodic | Communication style preferences | Until explicitly changed |

### What NOT to Remember

- **Unverified single-observation patterns** — wait for confirmation across multiple interactions (exception: explicit user requests)
- **Raw conversation transcripts** — extract the lesson, discard the dialogue
- **Duplicate information** — if it's in CLAUDE.md, don't repeat in MEMORY.md
- **Speculative architecture** — "the system seems to work better when..." is noise until validated

### The Filtering Test

1. **Would forgetting this cause a repeated mistake?** → Tier 1 (must persist)
2. **Will this be true next week?** → If no, it's session-ephemeral
3. **Has this been confirmed across ≥2 interactions?** → If no, it's speculative (unless user-requested)
4. **Does this already exist elsewhere?** → If yes, link — don't duplicate

---

## Evidence

### Discovery: Task DNA IS Episodic Memory

During PDSA research, a non-obvious connection emerged: the PM system's task DNA structure is functionally equivalent to the spec's "thought unit schema" (03-AGENT-GUIDELINES):

| Spec Thought Unit | Task DNA Equivalent |
|---|---|
| `content` (decoded thought) | `description` + `findings` |
| `metadata` (speaker, session, timestamp) | `role`, `created_at`, `updated_at` |
| `tracing` (parent_id, iteration_depth) | `parent_ids`, `rework_iteration` |
| `anchoring` (truth_score, scripture_refs) | `acceptance_criteria` |
| `resonance` (convergence_zones, similar_traces) | Cross-task references in DNA |

This means our workflow system isn't just coordination — it's the multi-agent memory layer. Task DNA persists what agents learned, decided, and produced. It's searchable, version-tracked, and role-attributed.

**Implication:** Agents should be conscious that DNA updates ARE memory writes. The `findings` field is not just a status report — it's the episodic record of what was learned during the task.

### From Our MEMORY.md (Quantitative Analysis)

Our MEMORY.md contains ~200 lines across ~15 sections. Analyzing by memory type:

| Type | % of MEMORY.md | Example |
|------|----------------|---------|
| Procedural | ~40% | Git protocol, liaison process, workflow system |
| Semantic | ~35% | Project databases, pane map, GitHub auth, social buttons |
| Episodic | ~25% | Lessons learned (dates, what happened, what changed) |

The procedural and semantic entries are referenced almost every session. The episodic entries are referenced when a similar situation arises. This suggests the ~40/35/25 ratio is a natural equilibrium for operational agent memory.

### From the Spec: "Never Delete" vs. 200-Line Cap

The spec (04-VECTOR-DB-AND-GRAPH-STRATEGY) states: "Thought traces are never deleted — they represent the journey. Even superseded best practices remain in the graph as historical nodes."

Our practice is the opposite: MEMORY.md entries are actively pruned when they become stale or space is needed. This isn't a contradiction — it's a difference in retrieval mechanism:

- **Never-delete + vector search** = filtering at READ time (the database holds everything; the search surfaces what's relevant)
- **200-line cap + prompt injection** = filtering at WRITE time (memory holds only what's important; everything is surfaced every session)

Both are valid. The upgrade path is clear: when 200 lines isn't enough to hold critical knowledge, graduate to vector-backed retrieval where filtering moves from write-time to read-time.

### From Galarza: Consolidation as Filtering

Galarza identifies that "memory becomes noisy and unreliable over time" without active consolidation. A separate LLM instance handles "deciding what to keep, what to merge, and what to update."

Our system has no automated consolidation. MEMORY.md is manually curated. This works at our current scale (~200 lines, ~4 projects) but creates risk: contradictions between MEMORY.md and CLAUDE.md can go undetected.

---

## Examples

### Trajectory Memory (PDSA Format — High Value)

```markdown
# PDSA: Agent Memory Systems
## STUDY
### What Surprised Me
1. The workflow system IS agent memory infrastructure.
   Task DNA maps to the spec's thought unit schema.
2. PDSA documents ARE thought traces.
   Plan→Do→Study→Act preserves the path, not just the conclusion.
```

### Conclusion Memory (MEMORY.md Format — Compact)

```markdown
## Git Protocol — MANDATORY AFTER EVERY FILE CHANGE
1. `git add <specific-file>` (NEVER `git add .` or `git add -A`)
2. `git commit -m "type: description"`
3. `git push`
```

### Bad Memory (Conclusion Without Context)

```markdown
## Note
The system works better with fewer agents. Use 3 panes, not 4.
```

Why bad: No date. No reason. No trace of how this was learned. When circumstances change, there's no way to evaluate if this conclusion still holds.

---

## Open Questions

1. **When does write-time filtering fail?** At what knowledge volume does the 200-line cap become destructive rather than disciplining? What signals indicate it's time to add vector-backed retrieval?
2. **Should task DNA be explicitly treated as memory?** If agents knew that `findings` is episodic memory, would they write it differently? Should we add `lessons_learned` as a formal DNA field?
3. **Automated consolidation** — Can we build a periodic process that detects contradictions between MEMORY.md, CLAUDE.md, and task DNA? Galarza suggests a separate LLM; our system has no equivalent.
4. **Per-agent memory** — The spec envisions per-thinker nodes (03). Should agents have individual MEMORY.md files alongside the shared ones? Would this reduce noise in the shared memory?

---

## Related

- [PDSA: Agent Memory Research](../../pdsa/2026-02-19-agent-memory.pdsa.md) — the research journey behind this document
- [Synaptic Folder Structure](../knowledge-management/synaptic-folder-structure.md) — organizing knowledge files
- [03-AGENT-GUIDELINES spec](../../spec/03-AGENT-GUIDELINES.md) — thought unit schema
- [04-VECTOR-DB-AND-GRAPH-STRATEGY spec](../../spec/04-VECTOR-DB-AND-GRAPH-STRATEGY.md) — "never delete" principle
- [agent-memory-where.md](agent-memory-where.md) — storage architecture
- [agent-memory-when.md](agent-memory-when.md) — lifecycle triggers
