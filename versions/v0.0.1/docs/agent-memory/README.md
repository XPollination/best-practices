# Agent Memory Systems

How AI agents persist knowledge across sessions — what to remember, where to store it, and when to write it.

## Documents

| File | What it covers |
|------|---------------|
| [agent-memory-what.md](agent-memory-what.md) | Three memory types (semantic/episodic/procedural), filtering criteria, what NOT to remember |
| [agent-memory-where.md](agent-memory-where.md) | Five storage layers from MEMORY.md to knowledge graphs, when each is appropriate |
| [agent-memory-when.md](agent-memory-when.md) | Five lifecycle triggers for writing memory, from bootstrap loading to post-task consolidation |

## Key Insight

Memory is a **filtering problem**, not a storage problem. The challenge is deciding what deserves persistence — not building infrastructure to hold it. Start with markdown files. Graduate to vector databases and knowledge graphs only when file-based access can't keep up.

## Sources

- XPollination multi-agent operations (January–February 2026)
- Damian Galarza, "How AI Agents Remember Things" (2026-02-17)
- Google Context Engineering framework (semantic/episodic/procedural memory types)
- XPollination spec v0.0.1 (01-SYSTEM-VISION, 02-CORE-ARCHITECTURE, 03-AGENT-GUIDELINES)
