# What Is Worth Remembering?

> Status: emerging
> Source: XPollination multi-agent operations (2026-01–02), Galarza (2026-02-17), Google Context Engineering
> Version: 1.0.0 | Last updated: 2026-02-18

---

## Summary

Not everything an agent encounters should be persisted. The act of deciding what NOT to remember is as important as what to remember. Agent memory should be selective, filtered, and structured into three types: semantic (facts), episodic (events), and procedural (workflows).

---

## Context

AI agents operating across sessions face a fundamental problem: each new session starts with a blank context window. Without persistent memory, agents repeat mistakes, lose hard-won knowledge, and fail to build on previous work.

The Google Context Engineering framework identifies three memory types that mirror human cognition:

- **Semantic memory** — stable facts and preferences ("We use git add with specific files, never git add .")
- **Episodic memory** — events and interactions ("On 2026-02-01, the PDSA agent spent 10 hours in an unbounded research loop")
- **Procedural memory** — workflows and learned routines ("After every file write, commit and push immediately")

The challenge is not storage — it's **selectivity**. An agent that remembers everything drowns in noise. An agent that remembers nothing repeats every mistake.

---

## Pattern

### What TO Remember

**Semantic memory (facts — stable across sessions):**
- Project structure and key file paths
- Technology stack and tool versions
- User preferences and communication style
- Role boundaries and access constraints
- Infrastructure context (servers, IPs, credentials locations)

**Episodic memory (events — lessons from experience):**
- Anti-patterns discovered through failure (with dates and specifics)
- Decisions made and their rationale
- Corrections from the human ("Thomas stopped and corrected...")
- Context pressure incidents and recovery strategies
- Process violations and their consequences

**Procedural memory (workflows — how things get done):**
- Git protocols and commit conventions
- Agent coordination patterns (who does what, in what order)
- Tool usage patterns (CLI commands, database access methods)
- Recovery and handoff procedures
- Monitoring and health check routines

### What NOT to Remember

- **Session-specific state** — current task details, in-progress work, temporary variables
- **Unverified conclusions** — patterns observed once but not confirmed across multiple interactions
- **Duplicate information** — if it's already in CLAUDE.md or project docs, don't copy it to memory
- **Speculative reasoning** — hypotheses about why something might work without evidence
- **Raw conversation transcripts** — extract the lesson, discard the dialogue

### The Filtering Test

Before writing to persistent memory, ask:

1. **Will this be true next week?** If not, it's session-ephemeral.
2. **Has this been confirmed across multiple interactions?** If not, it's speculative (exception: explicit user requests to remember).
3. **Does this already exist elsewhere?** If yes, link — don't duplicate.
4. **Would forgetting this cause a repeated mistake?** If yes, it's critical memory.

---

## Evidence

### From Our System (XPollination, 2026-01–02)

Our `CLAUDE.md` files accumulated 300+ lines of protocols, anti-patterns, and lessons learned through two months of multi-agent operations. Analysis of what persisted reveals a clear pattern:

**Most valuable memories (referenced repeatedly):**
- Git protocol rules (referenced in every session)
- Agent role boundaries ("QA never fixes implementation code")
- Anti-patterns with dates ("2026-02-01: 10h research loop")
- Infrastructure constraints ("No sudo for developer user")

**Least valuable memories (eventually removed or ignored):**
- Speculative architecture notes
- One-time debugging context
- Temporary workarounds that were later fixed properly

**Memory that caused problems when missing:**
- On 2026-02-18, templates were forgotten when updating CV content because the "4-file rule" hadn't been documented yet. After documenting, the pattern was never missed again.
- On 2026-02-02, QA agent wrote PDSA docs instead of handing context to the PDSA agent — a role boundary that was learned and persisted.

### From External Research (Galarza, 2026-02-17)

The Galarza article confirms the same filtering principle: "A separate LLM instance typically handles extraction and consolidation." The act of filtering is itself a computational task that benefits from structured processing, not raw dumping.

---

## Examples

### Good Memory Entry (Semantic — Specific, Actionable)

```markdown
## CV CHANGE = 4 FILES (CRITICAL)
Markdown sources and Typst templates are NOT linked. Every CV content change requires updating ALL 4:
1. sources/cv/versions/vX.Y.Z/cv.md (EN source of truth)
2. sources/cv/versions/vX.Y.Z/cv-de.md (DE source of truth)
3. templates/cv-en-v2.typ (EN — compiles to PDF)
4. templates/cv-de-v2.typ (DE — compiles to PDF)
```

### Good Memory Entry (Episodic — Dated, Lesson Extracted)

```markdown
**Lesson (2026-02-01):** PDSA agent spent 10 hours in unbounded research.
No one challenged its scope. Rule: Research phases max 30 min.
After 30 min, redirect to action.
```

### Good Memory Entry (Procedural — Step-by-Step, No Ambiguity)

```markdown
## Git Protocol
1. `git add <specific-file>` (NEVER `git add .`)
2. `git commit -m "type: description"`
3. `git push`
Atomic commands — no `&&` chaining.
```

### Bad Memory Entry (Vague, Unverifiable)

```markdown
The system seems to work better when agents communicate less frequently.
```

---

## Open Questions

1. **Consolidation frequency** — How often should memory be reviewed for contradictions or outdated entries? Our system has no automated consolidation; humans catch drift manually.
2. **Memory capacity limits** — At what point does MEMORY.md (200-line cap) become insufficient? When should agents graduate to vector-backed retrieval?
3. **Cross-agent memory** — Should agents share a memory pool, or maintain separate memories with a shared core? Our current system uses shared CLAUDE.md + per-project CLAUDE.md, but no agent-specific persistent memory.
4. **Forgetting protocol** — How should outdated memories be retired? Currently, humans edit MEMORY.md manually. An automated decay or review cycle might scale better.

---

## Related

- [Synaptic Folder Structure](../knowledge-management/synaptic-folder-structure.md) — how to organize knowledge files
- [02-CORE-ARCHITECTURE spec](../../spec/02-CORE-ARCHITECTURE.md) — 5-phase data flow (Capture → Decode → Refine → Embed → Resurface)
- [03-AGENT-GUIDELINES spec](../../spec/03-AGENT-GUIDELINES.md) — thought unit schema defining what agents capture
- [agent-memory-where.md](agent-memory-where.md) — storage architecture options
- [agent-memory-when.md](agent-memory-when.md) — lifecycle triggers for writing memory
