# What Is Worth Remembering?

> Status: emerging
> Source: XPollination spec (15 documents), multi-agent operations (2026-01–02), Galarza (2026-02-17), academic literature (A-MEM, Collaborative Memory, MemAct)
> Version: 4.0.0 | Last updated: 2026-02-23
> PDSA: [2026-02-19-agent-memory.pdsa.md](../../pdsa/2026-02-19-agent-memory.pdsa.md)

---

## Summary

Agent memory is a filtering problem at small scale and a self-organization problem at large scale. A MEMORY.md with a 200-line cap forces write-time filtering — the agent decides what's important enough to persist. A vector database with pheromone decay provides read-time filtering — everything is stored, but only reinforced memories rise to the top. Both are valid strategies for different scales. The deeper question isn't "what to store" but "what becomes an attractor" — a memory that other memories cluster around and that survives the noise of diverse access patterns.

---

## Context

### The Three Memory Types

The Google Context Engineering framework classifies agent memory as:

- **Semantic memory** — stable facts and preferences ("We use git add with specific files, never git add .")
- **Episodic memory** — events and interactions ("On 2026-02-01, the PDSA agent spent 10 hours in an unbounded research loop")
- **Procedural memory** — workflows and learned routines ("After every file write, commit and push immediately")

This classification is useful but incomplete. It answers "what kind of thing is this memory?" but not "is this memory worth keeping?"

### The Three Thought Types

The XPollination MVP spec (13-MVP-SPEC-THOUGHT-TRACING) adds a complementary classification based on provenance:

- **Original** — a new thought, no parent. The first statement of an insight.
- **Refinement** — builds on an existing thought, linked via `source_ids`. Adds nuance, challenges, or extends.
- **Consolidation** — abstracts from multiple thoughts into a higher-order insight. The sleep consolidation product.

This matters because refinements and consolidations carry **provenance chains** — they connect back to the originals that spawned them. A refinement without its sources loses the trajectory. A consolidation without its cluster loses the evidence.

### The Deeper Question: Attractors, Not Categories

The Hopfield-Attention-VectorDB equivalence (Ramsauer et al., ICLR 2021; detailed in 12-DEEP-DIVE) reveals that vector database retrieval, transformer attention, and Hopfield network pattern completion are the **same mathematical operation**. This reframes memory:

- **Stored vectors** = memory attractors (energy minima in a landscape)
- **Queries** = probes descending toward attractors
- **Frequently queried regions** = deep energy wells (strong attractors)
- **Rarely queried regions** = shallow wells that may not survive noise

A memory worth keeping is one that becomes a **deep attractor** — something that multiple queries converge toward, that survives the noise of diverse access patterns. The diversity of thinkers IS the noise that selects for genuine, robust knowledge over coincidental overlap (Input-Driven Plasticity, Science Advances 2025).

### Conclusions vs. Trajectories

The XPollination spec articulates a principle that changes how you think about memory:

> "The ability to reproduce how different thinkers arrived at convergence is itself the knowledge." (01-SYSTEM-VISION)

Most agent memory systems store conclusions: "always do X", "never do Y". These are semantic memories — stable facts. But the spec argues that the **path** to the conclusion is equally valuable. A PDSA document that records Plan → Do → Study → Act preserves the trajectory. A MEMORY.md entry preserves only the conclusion.

Both have value. Conclusions are compact and fast to load (good for the 200-line cap). Trajectories enable understanding *why* a conclusion exists and *when* it might need revision (good for PDSA docs and task DNA).

---

## Pattern

### What TO Remember (by attractor depth)

The attractor model provides a practical test for what to remember: **how deep is the energy well?** Deep attractors survive noise (diverse access patterns, time decay). Shallow ones don't. Ephemeral ones were never worth storing.

**Deep Attractors — memories that survive everything**

These are accessed in virtually every session. Forgetting them causes repeated failures. In a pheromone model, they would quickly reach the 10.0 ceiling and stay there.

| Type | Example | Why Deep |
|------|---------|---------|
| Procedural | Git workflow rules (e.g., "always stage specific files, never use `git add .`") | Violated in every session without it; reinforced by every commit |
| Procedural | Role boundaries (e.g., "the testing agent never fixes implementation code — it writes failing tests instead") | Agents default to doing everything; this rule is referenced every task |
| Episodic | Anti-patterns with dates and context (e.g., "On Feb 2, the QA agent wrote the design docs instead of the planning agent, breaking role separation") | Prevents specific failure modes; referenced whenever a similar situation arises |

**Shallow Attractors — memories that need periodic reinforcement**

These speed up work when present but don't cause failures when absent. In a pheromone model, they'd hover between 1.0 and 3.0 — accessed often enough to avoid decay but not dominant.

| Type | Example | Why Shallow |
|------|---------|------------|
| Semantic | Project structure — key file paths, database locations, server specs | Useful every session but recoverable by exploring the filesystem |
| Procedural | Tool-specific commands and syntax | Helpful but agents can look these up when needed |
| Semantic | Infrastructure constraints (e.g., "this server has no sudo access, use nvm for Node.js") | Prevents wasted effort but only relevant for specific operations |

**Ephemeral — memories that should decay naturally**

These are relevant for a limited time and should not compete with deeper attractors for storage space. In a pheromone model, they'd decay to the 0.1 floor within days.

| Type | Example | Lifespan |
|------|---------|----------|
| Episodic | Details of a specific debugging session | Until the bug is fixed |
| Semantic | Current task status or branch name | Until the task completes |
| Episodic | One-time workarounds for temporary issues | Until the root cause is resolved |

### What NOT to Remember

- **Unverified single-observation patterns** — wait for confirmation across multiple interactions (exception: explicit user requests)
- **Raw conversation transcripts** — extract the lesson, discard the dialogue
- **Duplicate information** — if it's in CLAUDE.md, don't repeat in MEMORY.md
- **Speculative architecture** — "the system seems to work better when..." is noise until validated

In pheromone terms: information that is never reinforced by access will naturally decay toward the floor (0.1 weight). The pheromone model provides automatic forgetting — you don't need to manually decide what to prune if the system tracks what gets used.

### The Filtering Test

1. **Would forgetting this cause a repeated mistake?** → Tier 1 (must persist)
2. **Will this be true next week?** → If no, it's session-ephemeral
3. **Has this been confirmed across ≥2 interactions?** → If no, it's speculative (unless user-requested)
4. **Does this already exist elsewhere?** → If yes, link — don't duplicate
5. **Is this an original, refinement, or consolidation?** → Refinements and consolidations need their source links preserved

### Emergent Knowledge: Co-Retrieval

The most valuable memories may be ones no agent explicitly created. When two thoughts are repeatedly retrieved together in search results, the XPollination system logs this **co-retrieval** association. Over time, these reveal functional connections that exist in the domain but weren't documented by any individual:

> "Thought A (organizational design) and Thought B (microservice architecture) are consistently co-retrieved — users working on org structure also need tech architecture insights."

This emergent knowledge — associations discovered through usage, not authorship — is worth remembering precisely because no one thought to write it down.

**Important caveat:** Co-retrieval is the most theoretically promising concept in these documents, but it remains **unvalidated in practice**. We have not yet run experiments to confirm that co-retrieval patterns reveal genuine insights versus noise. A proposed validation experiment: populate a vector database with 15+ documents on different topics, have multiple agents query for diverse tasks over a week, then check whether co-retrieval edges reveal associations not present in explicit cross-references. Until this is tested, co-retrieval should be treated as a high-priority hypothesis, not an established pattern.

---

## Evidence

### Discovery: Task Metadata IS Episodic Memory

During research for these best practices, a non-obvious connection emerged: structured task metadata (what the XPollination project management system calls "task DNA") is functionally equivalent to the spec's "thought unit schema" — a standardized format for atomic units of knowledge:

| Spec Thought Unit | Task DNA Equivalent |
|---|---|
| `content` (decoded thought) | `description` + `findings` |
| `metadata` (speaker, session, timestamp) | `role`, `created_at`, `updated_at` |
| `tracing` (parent_id, iteration_depth) | `parent_ids`, `rework_iteration` |
| `anchoring` (truth_score, scripture_refs) | `acceptance_criteria` |
| `resonance` (convergence_zones, similar_traces) | Cross-task references in DNA |

This means any workflow or task management system isn't just coordination — it's a multi-agent memory layer. Structured task metadata persists what agents learned, decided, and produced. It's searchable, version-tracked, and role-attributed.

**Implication:** Agents should be conscious that task metadata updates ARE memory writes. A `findings` or `notes` field is not just a status report — it's the episodic record of what was learned during the task.

### The PDSA Format IS 90% of a Thought Unit

Doc 11 (Agent Review) identified the structural parallel:

| Spec Thought Unit (doc 03) | PDSA Document |
|---|---|
| `content` | The findings and conclusions |
| `raw_input` | The original task description |
| `metadata.speaker_id` | PDSA Agent |
| `tracing.angle` | The research approach taken |
| `tracing.iteration_depth` | Iteration count |
| `tracing.confidence` | Implicit in STUDY section certainty |
| `anchoring.truth_score` | **Missing** |
| `resonance.convergence_zones` | Connections found in STUDY |

The missing 10%: truth anchoring metadata, explicit confidence scoring, and formal angle tagging. If the PDSA template were extended with these three fields, every PDSA would automatically be a spec-compliant thought unit.

### Memory Type Distribution (Quantitative Analysis)

Analyzing a real 200-line agent memory file (MEMORY.md) from a 4-agent system running for 2 months:

| Type | % of MEMORY.md | Example |
|------|----------------|---------|
| Procedural | ~40% | Git protocol, liaison process, workflow system |
| Semantic | ~35% | Project databases, pane map, GitHub auth, social buttons |
| Episodic | ~25% | Lessons learned (dates, what happened, what changed) |

The procedural and semantic entries are referenced almost every session — they are deep attractors. The episodic entries are referenced when a similar situation arises — they are shallower attractors that may eventually decay if the situation doesn't recur.

### "Never Delete" vs. 200-Line Cap vs. Pheromone Decay

Three approaches to the filtering problem:

| Approach | Mechanism | Trade-off |
|---|---|---|
| Never delete (spec 04) | Store everything; filter at read time via vector search | Requires retrieval infrastructure; no information loss; noise accumulates |
| 200-line cap (MEMORY.md) | Store only what fits; filter at write time via human curation | Simple; forces discipline; risks losing important information |
| Pheromone decay (MVP spec) | Store everything; prominence self-regulates through access reinforcement + time decay | Best of both — no information loss, but active knowledge rises naturally |

The pheromone model bridges the tension: `weight += 0.05` per access (ceiling 10.0), `weight *= 0.995` per hour without access (floor 0.1, ~11% decay/day). Memories that agents keep retrieving grow stronger. Memories nobody uses fade to near-zero prominence. No manual pruning needed.

### Academic References

- **A-MEM (NeurIPS 2025):** Zettelkasten-inspired agent memory where the agent itself decides how to organize, link, and evolve memories. Atomic notes with contextual descriptions, keywords, tags, and dynamic links.
- **Collaborative Memory (ICML 2025):** Multi-user, multi-agent framework with private + shared memory tiers. Achieves 61% reduction in resource usage compared to isolated memory.
- **MemAct (arXiv:2510.12635):** Memory operations (retain, compress, discard, insert) as learnable RL actions. MemAct-14B matches models 16× larger. Memory management can be LEARNED.
- **EverMemOS (January 2026):** Biologically faithful engram lifecycle: episodic traces → semantic consolidation → reconstructive recollection.

---

## Examples

### Trajectory Memory (PDSA Format — High Value)

```markdown
# PDSA: Agent Memory Systems
## STUDY (Iteration 3)
### What Surprised Me
1. Vector retrieval = attention = Hopfield pattern completion (same math).
   Stored vectors are attractors. Queries descend the energy landscape.
2. Diversity of thinkers IS the noise that selects for robust convergence.
   IDP Hopfield: noise drives to deepest wells.
```

### Conclusion Memory (MEMORY.md Format — Compact)

```markdown
## Git Protocol — MANDATORY AFTER EVERY FILE CHANGE
1. `git add <specific-file>` (NEVER `git add .` or `git add -A`)
2. `git commit -m "type: description"`
3. `git push`
```

### Emergent Memory (Co-Retrieval — Highest Value)

```
co_retrieved_with: ["org-design-scaling-001", "microservice-arch-pattern-042"]
# No agent wrote this association. Users working on org design
# consistently also needed architecture patterns. The system
# discovered this connection from usage.
```

### Bad Memory (Conclusion Without Context)

```markdown
## Note
The system works better with fewer agents. Use 3 panes, not 4.
```

Why bad: No date. No reason. No trace of how this was learned. No source provenance. When circumstances change, there's no way to evaluate if this conclusion still holds. In pheromone terms, this memory has no reinforcement signal — it will decay without anyone noticing.

---

## Key Takeaways

- **If forgetting it would cause a repeated mistake, it's a deep attractor** — persist it immediately (git protocol, role boundaries, anti-patterns with dates).
- **If it's been confirmed only once, it's speculative** — wait for reinforcement across multiple interactions, unless the user explicitly asks you to remember it.
- **Store conclusions in MEMORY.md, trajectories in PDSA docs, both in task metadata.** Conclusions are compact and fast to load; trajectories preserve *why* and *when to revise*.
- **Pheromone models automate what you'd otherwise do manually.** Access reinforcement + time decay replaces the binary keep/delete decision with continuous self-regulation.
- **The most valuable memories may be ones nobody wrote.** Co-retrieval associations — memories that are repeatedly retrieved together — reveal domain connections that no individual created (unvalidated; experiment proposed in WHERE doc).

---

## Open Questions

1. **How do you implement pheromone decay for markdown memory?** The theoretical bridge between "200-line cap" and "pheromone weight" exists but has no practical implementation. Could memory file entries carry access-frequency metadata? Could git blame + search logs approximate access patterns?

2. **When does write-time filtering fail?** At what knowledge volume does a 200-line cap become destructive rather than disciplining? Concrete signal: when agents routinely can't find information they need.

3. **Should task metadata carry explicit memory-intent fields?** If agents knew that `findings` is episodic memory, would they write it differently? Should task schemas include `lessons_learned`, `persist_to_memory`, `confidence_score`?

4. **Can memory operations be learned?** MemAct shows RL can optimize memory management. Could agents learn when to store, compress, discard, or consolidate — optimized by downstream retrieval utility?

See also: [co-retrieval validation experiment](agent-memory-where.md#open-questions) | [stigmergic activation detection](agent-memory-when.md#open-questions) | [pheromone tuning](agent-memory-where.md#open-questions)

---

## Related

- [PDSA: Agent Memory Research](../../pdsa/2026-02-19-agent-memory.pdsa.md) — the research journey (6 iterations)
- [14-AGENT-CONTEXT](../../feedback/agent-memory/14-AGENT-CONTEXT.md) — consolidated XPollination vision
- [12-DEEP-DIVE-ITER3](../../feedback/agent-memory/12-DEEP-DIVE-THINKING-INFRASTRUCTURE-ITER3.md) — Hopfield theory, pheromone model, stigmergy
- [13-MVP-SPEC](../../feedback/agent-memory/13-MVP-SPEC-THOUGHT-TRACING.md) — buildable thought tracing spec
- [11-SPEC-DOC](../../feedback/agent-memory/11-SPEC-DOC.md) — academic review with A-MEM, Collaborative Memory
- [agent-memory-where.md](agent-memory-where.md) — storage architecture
- [agent-memory-when.md](agent-memory-when.md) — lifecycle triggers
