# Agent Memory Systems

How AI agents persist knowledge across sessions — what to remember, where to store it, and when to write it.

## Quick Start

**Setting up agent memory for a new project?** Start with the implementation checklist in [agent-memory-when.md](agent-memory-when.md#minimal-viable-memory-writing-setup) — it has a prescriptive Day 1 → Month 6+ setup guide with checklists for each milestone.

## Documents

| File | What it covers |
|------|---------------|
| [agent-memory-what.md](agent-memory-what.md) | What to remember: deep/shallow/ephemeral attractors, thought types, co-retrieval as emergent knowledge |
| [agent-memory-where.md](agent-memory-where.md) | Where it goes: Today (markdown + task metadata) → Next (vector DB + pheromone) → Full Vision (8 concurrent layers) |
| [agent-memory-when.md](agent-memory-when.md) | When to write: 9 triggers across 3 timescales + **implementation checklist** for setup |

## PDSA Research

| File | What it covers |
|------|---------------|
| [2026-02-19-agent-memory.pdsa.md](../../pdsa/2026-02-19-agent-memory.pdsa.md) | Four iterations of deepening research: (1) initial spec reading, (2) cross-referencing with lived experience, (3) integrating 5 new source documents with Hopfield theory and 8-layer architecture, (4) usability restructuring and implementation checklists |

## Key Insights

1. **Memory is filtering at small scale, self-organization at large scale.** A 200-line memory file forces write-time filtering. A pheromone model (weight += 0.05 per access, *= 0.995/hour decay) provides continuous read-time filtering. Both work — at different scales.

2. **Task metadata IS multi-agent memory.** Structured task metadata (description, findings, rework reasons) maps to the XPollination spec's thought unit schema. The workflow system isn't just coordination — it's the memory layer.

3. **Structured research documents ARE thought traces.** The Plan-Do-Study-Act format preserves "how thinkers arrived at convergence" — the trajectory, not just the conclusion. This format is 90% of a spec-compliant thought unit.

4. **Retrieval patterns ARE knowledge.** When multiple agents query a shared vector database, their access patterns reveal connections no individual created. Co-retrieval — thoughts that appear together in search results — is emergent knowledge (unvalidated hypothesis; see proposed experiment in WHERE doc).

5. **The 8-layer architecture is concurrent, not sequential.** Even a markdown-only system runs layers 0 (storage), 4 (reinforcement via curation), and 5 (consolidation via structured reflection). The difference is automation, not kind.

6. **Stigmergic phase transition at ρ_c ≈ 0.23.** Below this user density, individual memory dominates. Above it, shared traces outperform individual memory by 36-41%.

7. **Diversity IS the noise that selects for genuine convergence.** The Hopfield IDP finding: in multi-user systems, noise (diverse perspectives) drives retrieval to the deepest energy wells (most robust knowledge).

## Sources

- XPollination spec v0.0.1 — 15 documents including 5 new research/MVP docs
- Multi-agent operations (January–February 2026)
- Damian Galarza, "How AI Agents Remember Things" (2026-02-17)
- Google Context Engineering framework
- Academic: A-MEM (NeurIPS 2025), Collaborative Memory (ICML 2025), MemAct (arXiv:2510.12635), EverMemOS (Jan 2026), MemRL (Jan 2026)
- Research: Hopfield-Attention equivalence (Ramsauer et al., ICLR 2021), Input-Driven Plasticity (Science Advances 2025), Geometric Dynamics (Tacheny, arXiv:2512.10350), Stigmergic Phase Transition (Khushiyant, arXiv:2512.10166), FlatNav (ICML 2025 Workshop), Sleep-Time Compute (Letta, Apr 2025)
