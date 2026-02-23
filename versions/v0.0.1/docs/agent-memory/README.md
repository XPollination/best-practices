# Agent Memory Systems

How AI agents persist knowledge across sessions — what to remember, where to store it, and when to write it.

## Documents

| File | What it covers |
|------|---------------|
| [agent-memory-what.md](agent-memory-what.md) | Three memory types + three thought types, Hopfield attractor framing, pheromone decay as automatic filtering, co-retrieval as emergent knowledge, A-MEM/Collaborative Memory/MemAct references |
| [agent-memory-where.md](agent-memory-where.md) | 8-layer concurrent architecture (not sequential!), from MEMORY.md to sleep consolidation, MVP vs post-MVP distinction, pheromone-weighted storage, co-retrieval graphs, stigmergic phase transition |
| [agent-memory-when.md](agent-memory-when.md) | Three timescales (continuous/event-driven/periodic), 9 triggers from bootstrap to sleep consolidation, pheromone reinforcement + decay, PDSA Study as highest-value extraction |

## PDSA Research

| File | What it covers |
|------|---------------|
| [2026-02-19-agent-memory.pdsa.md](../../pdsa/2026-02-19-agent-memory.pdsa.md) | Three iterations of deepening research: (1) initial spec reading, (2) cross-referencing with lived experience, (3) integrating 5 new source documents with Hopfield theory, pheromone models, and 8-layer architecture |

## Key Insights

1. **Memory is filtering at small scale, self-organization at large scale.** The 200-line MEMORY.md cap forces write-time filtering. The pheromone model (weight += 0.05 per access, *= 0.995/hour decay) provides continuous read-time filtering. Both work — at different scales.

2. **The PM system IS multi-agent memory.** Task DNA maps to the spec's thought unit schema. `findings` is episodic memory. The workflow system isn't just coordination — it's the memory layer.

3. **PDSA documents ARE thought traces.** The spec envisions preserving "how thinkers arrived at convergence." PDSA Plan→Do→Study→Act captures exactly this trajectory. PDSA format is 90% of a spec-compliant thought unit.

4. **Retrieval patterns ARE knowledge.** When multiple agents query a shared vector database, their access patterns reveal connections no individual created. Co-retrieval — thoughts that appear together in search results — is emergent knowledge.

5. **The 8-layer architecture is concurrent, not sequential.** Even a markdown-only system runs layers 0 (storage), 1 (observation), 4 (reinforcement via curation), and 5 (consolidation via PDSA Study). The difference is automation, not kind.

6. **Stigmergic phase transition at ρ_c ≈ 0.23.** Below this user density, individual memory dominates. Above it, shared traces outperform individual memory by 36-41%. Collective features should only activate when density is sufficient.

7. **Diversity IS the noise that selects for genuine convergence.** The Hopfield IDP finding: in multi-user systems, noise (diverse perspectives) drives retrieval to the DEEPEST energy wells (most robust knowledge). Single-user systems lack this selection pressure.

## Sources

- XPollination spec v0.0.1 — 15 documents including 5 new research/MVP docs
- XPollination multi-agent operations (January–February 2026)
- Damian Galarza, "How AI Agents Remember Things" (2026-02-17)
- Google Context Engineering framework
- Academic: A-MEM (NeurIPS 2025), Collaborative Memory (ICML 2025), MemAct (arXiv:2510.12635), EverMemOS (Jan 2026), MemRL (Jan 2026)
- Research: Hopfield-Attention equivalence (Ramsauer et al., ICLR 2021), Input-Driven Plasticity (Science Advances 2025), Geometric Dynamics (Tacheny, arXiv:2512.10350), Stigmergic Phase Transition (Khushiyant, arXiv:2512.10166), FlatNav hub highways (ICML 2025 Workshop), SRRDBSCAN (EDBT 2025), Sleep-Time Compute (Letta, Apr 2025)
- CLAUDE.md + MEMORY.md + topic files (lived experience)
