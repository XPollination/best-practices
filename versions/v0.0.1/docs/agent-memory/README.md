# Agent Memory Systems

How AI agents persist knowledge across sessions — what to remember, where to store it, and when to write it.

## Documents

| File | What it covers |
|------|---------------|
| [agent-memory-what.md](agent-memory-what.md) | Three memory types, filtering criteria, conclusions vs. trajectories, task DNA as memory |
| [agent-memory-where.md](agent-memory-where.md) | Six storage layers from MEMORY.md to knowledge graphs, spec-vs-practice gap analysis |
| [agent-memory-when.md](agent-memory-when.md) | Six lifecycle triggers, PDSA Study as highest-value extraction mechanism |

## PDSA Research

| File | What it covers |
|------|---------------|
| [2026-02-19-agent-memory.pdsa.md](../../pdsa/2026-02-19-agent-memory.pdsa.md) | The research journey: deep reading of all 10 spec documents, cross-referencing with Galarza and lived experience, three key tensions identified, spec-practice mapping |

## Key Insights

1. **Memory is a filtering problem**, not a storage problem. The 200-line MEMORY.md cap forces write-time filtering; the spec's "never delete" approach defers filtering to read-time (vector search). Both work.

2. **The PM system IS multi-agent memory.** Task DNA maps to the spec's thought unit schema. `findings` is episodic memory. The workflow system isn't just coordination — it's the memory layer.

3. **PDSA documents ARE thought traces.** The spec envisions preserving "how thinkers arrived at convergence." PDSA Plan→Do→Study→Act captures exactly this trajectory.

## Sources

- XPollination spec v0.0.1 — all 10 documents read in full
- XPollination multi-agent operations (January–February 2026)
- Damian Galarza, "How AI Agents Remember Things" (2026-02-17)
- Google Context Engineering framework
- CLAUDE.md + MEMORY.md + topic files (lived experience)
