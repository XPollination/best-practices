# PDSA: Reflection Loop Skill Design

**Task:** `reflection-skill-research`
**Date:** 2026-03-01
**Phase:** Plan (Deep Research)

## Plan

### Problem
The brain has observations (thoughts), gardening (cleanup), corrections (single events), highways (frequency), and role rules. What's missing: **pattern extraction** across observations, **reflection** (deeper meaning), **principles** (recurring patterns → reusable rules), and **terminology alignment** (Thomas ↔ agent encode/decode calibration).

### Research Foundations

#### Frameworks Studied
| Framework | Core Mechanism | When It Reflects | Key Insight |
|-----------|---------------|------------------|-------------|
| **Reflexion** (NeurIPS 2023) | Verbal self-critique stored in memory, fed back as context for retry | After each failed attempt | Text-based reflections in vector DB replace parameter updates |
| **MARS** (arxiv 2601.11974) | Principle-based (what to avoid) + Procedural (how to succeed), three phases: Evaluate → Cluster → Enhance | After batch of failures | Group failures by pattern, then generate both "don'ts" and "dos" |
| **Kolb Cycle** | CE → RO → AC → AE (Experience → Reflect → Abstract → Test) | Continuously after each experience | Dev does CE/AE (extrinsic), PDSA does RO/AC (intrinsic) — maps to our roles |
| **Argyris Double-Loop** | Single-loop fixes actions; double-loop questions assumptions | When same error recurs despite action-level fixes | Need "governing assumption" thoughts, not just action corrections |
| **ParamMem** (2026) | Reflective diversity correlates with success; repetitive reflections have diminishing returns | After each iteration | Pheromone should reward novelty, not just frequency |
| **RMM** (ACL 2025) | Prospective (write for future self) + Retrospective (was retrieval useful?) | Both directions | Agents should structure thoughts for retrievability AND signal usefulness |
| **MemR3** (2024) | Evidence-gap tracker: what we know vs. what's missing | During retrieval | Reflection should identify brain knowledge gaps, not just add thoughts |
| **ICML 2025** (Liu & van der Schaar) | Extrinsic (human-designed) vs. intrinsic (self-adapting) metacognition | Adaptive | Current CLAUDE.md = extrinsic loops; reflection skill should evolve |

### What We Have vs. What's Missing

| Layer | Have | Missing |
|-------|------|---------|
| **Data** | Thoughts (1245+), observations, corrections | — |
| **Cleanup** | Gardener (shallow/micro/deep), dedup, consolidation | — |
| **Frequency** | Highways (access_count × unique_users), pheromone weights | — |
| **Single-loop** | Corrections (fix wrong facts), operational learnings | — |
| **Pattern extraction** | — | Cross-observation clustering, recurring failure detection |
| **Double-loop** | — | Questioning assumptions, governing variables |
| **Principles** | — | Declarative rules extracted from multiple experiences |
| **Terminology** | — | Thomas ↔ agent encode/decode calibration dictionary |
| **Knowledge gaps** | — | Domains with high observations but low synthesis |

---

## Multiple Perspectives on Reflection Skill Design

### Perspective 1: Kolb-Mapped Role Integration

Reflection maps to existing agent roles:
- **Dev** does **Concrete Experience** (CE) and **Active Experimentation** (AE) — builds, tests, ships
- **PDSA** does **Reflective Observation** (RO) and **Abstract Conceptualization** (AC) — reflects, extracts principles
- **Reflection skill** formalizes the RO→AC transition that currently happens ad-hoc

**Implication:** Reflection is NOT a separate agent or background process. It's PDSA's core function, formalized as a repeatable skill with structured inputs and outputs.

### Perspective 2: MARS Three-Phase Pipeline

Apply MARS's Evaluate → Cluster → Enhance:
1. **Evaluate**: Pull recent thoughts/observations from brain, diagnose each
2. **Cluster**: Group by pattern (topic, error type, domain)
3. **Enhance**: For each cluster, produce:
   - **Principle** (what to avoid/ensure): "When deploying SSH configs, always verify both the alias AND the target exist"
   - **Procedure** (how to succeed): "SSH config validation: (1) check ~/.ssh/config for alias, (2) test resolution, (3) test connectivity, (4) test target path"

**Implication:** Two new thought categories needed: `principle` and `procedure`. These sit above `operational_learning` in abstraction.

### Perspective 3: Double-Loop Assumption Questioning

Current system does single-loop well (corrections, operational learnings). Double-loop is missing. The skill should detect:
- **Pattern of recurring failures** despite action-level fixes → trigger assumption questioning
- **Espoused theory vs. theory-in-use gap** → e.g., "we say we test before shipping but 60% of tasks skip QA"

**Implication:** Need a `governing_assumption` thought category. These are meta-level beliefs that shape how agents interpret everything else. Changing one changes behavior system-wide.

### Perspective 4: Thomas's Encode-Decode Model

Thomas encodes intent → agent decodes. Actions reveal alignment gaps. Reflection should:
1. Track terminology mismatches (Thomas said X, agent interpreted Y)
2. Build a living terminology dictionary in the brain
3. Detect encode-decode drift over time

**Implication:** A `terminology` thought category that stores calibration entries: `{"term": "deep research", "thomas_meaning": "multiple perspectives + additional sources + when analysis", "agent_drift": "single web search and summarize"}`.

---

## WHEN Does Reflection Happen? (Critical Analysis)

| Trigger | Pros | Cons | Recommendation |
|---------|------|------|---------------|
| **After task completion** (Layer 3 gardening slot) | Natural integration point, task context fresh, DNA has all evidence | Only fires on completed tasks; doesn't catch cross-task patterns | **Yes — micro-reflection** |
| **Periodic background** (e.g., daily) | Catches cross-task patterns, can do domain-level synthesis | No natural trigger, may produce low-quality output without context | **Yes — for deep reflection** |
| **Triggered by pattern detection** (brain detects cluster) | Most targeted, highest value output | Requires detection infrastructure (brain API changes) | **Future — after v1 proves value** |
| **Integrated into gardening** (depth=deep extension) | Reuses existing infrastructure, backup protection | Overloads gardener purpose; gardening is cleanup, reflection is synthesis | **No — keep concerns separate** |
| **User-triggered focus** (Thomas sets topic) | Highest alignment with human intent, most useful output | Requires human input, not continuous | **Yes — as explicit mode** |
| **Separate workflow track** | Clean separation, own lifecycle | Over-engineering for v1 | **No for v1, maybe v2** |

### Recommended Timing Model (v1)

```
Layer 3 gardening slot ──→ MICRO-REFLECTION (per-task)
  "What did this task teach us?"
  Input: task DNA + related brain thoughts
  Output: principle or procedure thought

Daily/weekly cadence ──→ DEEP-REFLECTION (cross-task)
  "What patterns emerge across recent work?"
  Input: last N days of brain thoughts
  Output: principles, procedures, terminology entries, gap analysis

User command ──→ FOCUSED-REFLECTION (on-demand)
  "What do we know about X? What are we missing?"
  Input: Thomas-specified topic/domain/pattern
  Output: synthesis, gaps, proposed highways, terminology calibration
```

---

## Concrete Skill Design Proposal

### Skill: `/xpo.claude.mindspace.reflect`

```
/xpo.claude.mindspace.reflect [scope] [depth]
```

#### Scopes
| Scope | Input | Use Case |
|-------|-------|----------|
| `task:<slug>` | Task DNA + related brain thoughts | Post-task micro-reflection |
| `recent` | Last 7 days of brain thoughts | Periodic pattern extraction |
| `domain:<topic>` | All thoughts tagged with topic | Deep domain synthesis |
| `focus:<query>` | Thomas-specified focus | On-demand investigation |

#### Depths (mirrors gardener pattern)
| Depth | Operations |
|-------|-----------|
| `shallow` | Scan, categorize, report gaps — no writes |
| `deep` | + Extract principles + Generate procedures + Identify terminology + Write to brain |

#### Outputs (thought categories)
| Category | Template | Example |
|----------|----------|---------|
| `principle` | "PRINCIPLE: When [condition], [rule] because [evidence]" | "PRINCIPLE: When SSH aliases are designed in PDSA, verify they exist in all user SSH configs because developer and thomas configs diverge" |
| `procedure` | "PROCEDURE: To [goal], (1) [step], (2) [step]..." | "PROCEDURE: To validate NAS connectivity, (1) check SSH config alias, (2) test hostname resolution, (3) test SSH connection, (4) test target path" |
| `terminology` | "TERM: [word] — Thomas means: [X]. Agent default: [Y]. Calibration: [Z]" | "TERM: deep research — Thomas means: multiple perspectives + new sources + when/where analysis. Agent default: web search + summarize" |
| `knowledge_gap` | "GAP: [domain] has [N observations] but [0 principles]. Need: [synthesis topic]" | "GAP: SSH infrastructure has 12 observations but 0 principles. Need: SSH config management principles" |

#### Integration Points

1. **Layer 3 gardening slot**: After task completion, `reflect task:<slug> deep` (replaces current micro-gardening or runs alongside it)
2. **PM status**: During brain health check, `reflect recent shallow` to report gaps
3. **User command**: `reflect focus:"terminology calibration" deep` for on-demand investigation

#### Relationship to Gardener

| Concern | Gardener | Reflection |
|---------|----------|------------|
| **Purpose** | Cleanup, dedup, organize | Synthesize, extract meaning, find gaps |
| **Input** | Raw thoughts, duplicates, noise | Clean thoughts, patterns, clusters |
| **Output** | Consolidated thoughts, archived noise | Principles, procedures, terminology |
| **When** | Before reflection (clean first) | After gardening (reflect on clean data) |
| **Thought types** | `consolidation`, archive markers | `principle`, `procedure`, `terminology`, `knowledge_gap` |

---

## Cross-Generation Agent Learning

Key challenge: agents have context windows that reset. Reflections must survive across agent lifetimes.

**Current mechanism:** Brain stores thoughts persistently. Pheromones reinforce useful ones.

**Enhancement for reflection:**
- Principles and procedures should have **higher initial pheromone** (2.0 vs 1.0 for raw observations) because they represent distilled knowledge
- Auto-compact recovery hook should prioritize retrieving principles over raw observations
- Terminology entries should be retrieved on every session start (like CLAUDE.md but dynamic)

---

## Effort Estimate

| Component | Effort | Notes |
|-----------|--------|-------|
| New thought categories in brain API (`principle`, `procedure`, `terminology`, `knowledge_gap`) | Low | Payload metadata, no schema change |
| Reflection skill SKILL.md | Medium | New skill, ~200 lines |
| Integration with Layer 3 gardening | Low | Conditional call after gardening |
| Integration with PM status | Low | Add shallow reflection to health check |
| Terminology calibration mode | Medium | New query pattern, needs Thomas input on terms |
| **Total** | **Medium** | No new infrastructure, builds on existing brain + skill patterns |

---

## Do
(After approval — DEV implements brain API category additions, then reflection skill SKILL.md)

## Study
(Post-implementation — does reflection produce useful principles? Do agents retrieve and use them?)

## Act
(Adjust timing, depth, categories based on Study findings)
