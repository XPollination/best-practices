# When Does Memory Get Written?

> Status: emerging
> Source: XPollination multi-agent operations (2026-01–02), Galarza (2026-02-17), PDSA methodology
> Version: 1.0.0 | Last updated: 2026-02-18

---

## Summary

Memory writing is triggered by five lifecycle events: bootstrap loading, pre-compaction flush, session snapshots, explicit user requests, and post-task consolidation. Each trigger serves a different purpose and writes to different storage layers. The critical insight: writing too early captures noise; writing too late loses knowledge.

---

## Context

Agents face a tension between two failure modes:

- **Write too eagerly** → memory fills with unverified, session-specific noise that contradicts itself across sessions
- **Write too late** → context window fills, auto-compaction triggers, and hard-won knowledge is lost before it's persisted

The solution is event-driven memory writes at well-defined lifecycle moments, each with its own filter for what qualifies.

---

## Pattern

### Trigger 1: Bootstrap Loading (Session Start)

**When:** Every time an agent session begins.

**What happens:** MEMORY.md and CLAUDE.md are injected into the agent's context window automatically. The agent starts with accumulated knowledge from all previous sessions.

**What gets loaded:**
- MEMORY.md (200-line concise index)
- CLAUDE.md (project protocols and global instructions)
- Topic files referenced in MEMORY.md are NOT loaded automatically — agent reads them on demand

**Our implementation:**
```
Session starts
  → Claude Code loads ~/.claude/CLAUDE.md (global)
  → Claude Code loads project/CLAUDE.md (project-specific)
  → Claude Code loads ~/.claude/projects/.../memory/MEMORY.md (auto memory)
  → Agent has full accumulated knowledge without any action needed
```

**Key insight:** Bootstrap loading is READ-only. It consumes prompt tokens proportional to memory size, which is why MEMORY.md has a 200-line cap. Every line in MEMORY.md costs tokens in every session.

### Trigger 2: Pre-Compaction Flush (Before Context Limits)

**When:** Agent detects context window is approaching limits (below 20%, or "Compacting conversation" message appears).

**What happens:** Agent should proactively persist any knowledge gained during the session before compaction or clearing removes it.

**What gets written:**
- Lessons learned during the session
- Updated procedures or protocols
- Corrections to existing memory entries
- New anti-patterns discovered

**Our experience:**
- On 2026-02-03, a PDSA agent reached 7% context remaining after heavy cross-repo work. Auto-compaction preserved context but degraded traceability — verbatim quotes and metadata were the first things cut.
- Lesson: **Write findings to persistent storage BEFORE context pressure forces compaction.** Don't trust that compaction preserves everything.

**Recommended practice:**
```
Context at 20%: Consider persisting key findings
Context at 10%: Actively write to MEMORY.md or topic files
Context at <5%: Emergency — write handoff file, prepare for /compact
```

### Trigger 3: Session Snapshots (On Clear/Compact/End)

**When:** Agent executes `/clear`, `/compact`, or session ends naturally.

**What happens:** A snapshot of the session's meaningful work is captured.

**What gets written:**
- Handoff files (`.claude/handoffs/`) with goals, done, in-progress, blockers, next steps
- Updated MEMORY.md entries if the session produced stable new knowledge
- PDSA documents if the session was a planning cycle

**Galarza pattern:** `/new` command captures the last 15 meaningful messages as a session snapshot with a descriptive filename. This preserves episodic context without manual curation.

**Our equivalent:** The handoff protocol:
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

### Trigger 4: Explicit User Requests

**When:** User says "remember this", "always do X", "never do Y".

**What happens:** The instruction is persisted immediately — no waiting for confirmation across multiple interactions.

**What gets written:** Exactly what the user requested, stored in MEMORY.md or a topic file depending on scope.

**Examples:**
- "Always use bun instead of npm" → MEMORY.md (affects every session)
- "The staging server is at 10.0.0.50" → MEMORY.md or project CLAUDE.md
- "Stop remembering the old API key" → remove from memory files

**Key insight:** User requests bypass the "verify across multiple interactions" filter. If the user explicitly asks to remember something, save it immediately.

### Trigger 5: Post-Task Consolidation (PDSA Study/Act)

**When:** After completing a task or iteration cycle.

**What happens:** The agent extracts lessons learned from the work just completed and writes them to persistent memory.

**This is the PDSA methodology applied to memory:**
- **Plan:** What was the task?
- **Do:** What was attempted?
- **Study:** What worked? What didn't? What was surprising?
- **Act:** What should change for next time? → This becomes the memory entry.

**What gets written:**
- Anti-patterns discovered ("never do X because Y happened")
- Process improvements ("after file writes, commit immediately")
- Corrections to existing assumptions
- New stable facts learned during the work

**Our implementation:**
```bash
# After completing a task, update DNA with findings
DATABASE_PATH=$DB node $CLI update-dna <slug> '{"findings":"..."}' <actor>

# Findings then inform future MEMORY.md updates
# The Study phase IS the memory extraction step
```

---

## Evidence

### From Our System

**Trigger effectiveness ranking (most to least valuable):**

1. **Post-task consolidation** — Highest value. Every lesson in our CLAUDE.md came from a specific failure or success during task work. The PDSA Study phase is the most reliable generator of stable memory.

2. **Explicit user requests** — Second most valuable. Thomas's corrections ("PDSAs live with their project, not in a single repo") became permanent protocol immediately.

3. **Bootstrap loading** — Essential infrastructure. Without MEMORY.md loading, agents repeat every known mistake.

4. **Pre-compaction flush** — Critical safety net. The 7% context incident taught us that knowledge not written before compaction may be lost or degraded.

5. **Session snapshots** — Useful for continuity but lower signal-to-noise. Handoff files often contain session-specific detail that doesn't survive to become permanent memory.

### From External Research (Galarza)

Galarza identifies the same triggers but adds a nuance: **consolidation should be done by a separate LLM instance** to prevent the working agent from being distracted by memory management. In our system, the agent itself handles consolidation (during the PDSA Study phase), which is simpler but requires discipline to not let memory writing consume the session.

### From XPollination Spec (03-AGENT-GUIDELINES)

The spec defines a three-phase agent lifecycle that maps directly to memory triggers:

```
BEFORE work:  Read relevant best practices and thought traces   → Trigger 1 (Bootstrap)
DURING work:  Apply documented patterns                         → Trigger 2 (Pre-compaction) + 4 (User requests)
AFTER work:   Contribute findings back                          → Trigger 3 (Snapshot) + 5 (Consolidation)
```

---

## Examples

### Post-Task Memory Write (Good)

After discovering that tmux send-keys doesn't work for task instructions:

```markdown
## LIAISON PROCESS — CRITICAL (2026-02-17)
**MCP/PM system is the ONLY communication channel between agents.**
- NEVER use `tmux send-keys` for task instructions (ONLY for `/unblock` permission prompts)
- **Lesson:** Liaison sent detailed instructions to PDSA/DEV via tmux send-keys. Thomas stopped and corrected.
```

This is specific, dated, includes the anti-pattern AND the correction, and is stored in MEMORY.md because it affects every session.

### Pre-Compaction Save (Good)

Agent at 15% context, about to compact:

```markdown
# Handoff — PDSA — 2026-02-03T14:30Z
## Done: Completed 4 PDSA iterations for CV layout
## Key Decision: Topic files preferred over single large MEMORY.md
## Files Modified: memory/MEMORY.md, memory/profile-assistant.md
```

Knowledge is persisted BEFORE compaction removes the working context.

### Too-Early Write (Bad)

After reading one file in a new project:

```markdown
## Project Architecture
This project seems to use a microservices pattern with React frontend.
```

This is speculative — one file read doesn't confirm architecture. Wait for verification across multiple interactions before persisting.

---

## Open Questions

1. **Automated consolidation** — Should a background process periodically review session logs and extract memories, or should agents self-consolidate? Galarza suggests a separate LLM; our system uses the agent itself.
2. **Write conflict resolution** — When two agents independently discover contradictory lessons, which one persists? Currently, the last writer wins.
3. **Compaction-aware memory** — Can agents be taught to automatically persist high-value context when they detect context pressure, without explicit instructions?
4. **Memory review cadence** — How often should accumulated memory be audited for outdated or contradictory entries? Our system has no scheduled review.

---

## Related

- [01-SYSTEM-VISION spec](../../spec/01-SYSTEM-VISION.md) — thought tracing captures trajectory, not just conclusions
- [03-AGENT-GUIDELINES spec](../../spec/03-AGENT-GUIDELINES.md) — three-phase agent lifecycle (before/during/after)
- [agent-memory-what.md](agent-memory-what.md) — what is worth remembering
- [agent-memory-where.md](agent-memory-where.md) — storage architecture options
