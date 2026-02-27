# LIAISON Gap Analysis: PM Status vs Operational Reality

**Date:** 2026-02-27 evening | **Author:** LIAISON agent
**Input:** Claude Web evening review + PM system state
**Purpose:** Document the gap, identify root cause, define v2 scope

---

## The Gap

| Task | PM Status | Operational Reality | Gap Type |
|------|-----------|-------------------|----------|
| T1 | complete | PASS — works in production | None |
| T2 | complete | FAIL — code merged, server not restarted | Deployment |
| T3 | complete | PARTIAL — contextual but test-polluted | Data quality |
| T4 | complete | NOT STARTED — blocked by T5 in practice | Premature completion |
| T5 | complete | NOT STARTED — skill file exists but untested | Premature completion |
| T6 | complete | NOT STARTED — hook added but never triggered | Premature completion |
| T7 | complete | NOT STARTED — designed but batch never ran | Premature completion |
| T8 | complete | N/A — backup script, not tested against live | Unknown |

**5 of 8 tasks** show a gap between PM "complete" and operational state.

---

## Root Cause Analysis

### What happened

The v1 iteration ran the full workflow in a single day (2026-02-27):
1. LIAISON created 8 tasks from the morning research session
2. PDSA designed each task
3. QA wrote TDD tests
4. DEV implemented against tests
5. QA reviewed implementations
6. PDSA reviewed implementations
7. LIAISON (me) approved/completed

The workflow executed correctly — every gate was passed. But:

### The workflow measures code completion, not operational deployment

- **T2:** Code was merged into the brain API repo. Nobody restarted the Docker container. The workflow has no "deploy" gate.
- **T4-T7:** PDSA docs were written, tests were created, skill files were authored. All passed review. But "the gardener engine exists as a SKILL.md file" ≠ "the gardener engine runs and produces results."
- **T3:** Highway redesign code was written and deployed. But test data from QA automated tests pollutes the results — a data quality issue the workflow didn't check.

### The acceptance criteria were tested in isolation, not in production

QA tests verified:
- "Does the script file exist?" ✓
- "Does it contain GFS rotation logic?" ✓
- "Does the skill file have the right parameters?" ✓

QA did NOT verify:
- "Does the pollution guard actually prevent noise in live queries?"
- "Does the gardener engine produce meaningful results when invoked?"
- "Are highways actually diverse in production?"

### This is a systemic gap, not a one-off mistake

The v1 workflow treats tasks as "code artifacts to produce." The review tested "operational outcomes in production." These are different things.

---

## What This Means for v2

### v2 is NOT "redo T2-T7"

The code artifacts from v1 exist and may be correct. v2 should:

1. **Deploy what's written** — restart brain API (T2 fix is one command)
2. **Validate in production** — run the review's test protocol against live brain
3. **Clean test data** — remove QA test artifacts polluting highways
4. **Fix what doesn't work** — iterate on T3 (highway dedup), T5 (gardener engine validation)
5. **Add the missing gate** — operational validation as part of the workflow

### v2 acceptance criteria must be production-observable

Not "does the file exist?" but "does the brain's noise ratio decrease after gardening?"

### Suggested v2 task structure

| # | Task | Type | Description |
|---|------|------|-------------|
| 1 | Deploy T2 | ops | Restart brain API Docker container |
| 2 | Clean test artifacts | ops | Delete/archive QA test contributor thoughts |
| 3 | Validate T2 in production | verification | Run 5 queries, confirm 0 pollution |
| 4 | T3 highway dedup | code | Add >0.95 similarity dedup to highway results |
| 5 | Validate T3 in production | verification | Run 5 queries, confirm diverse highways |
| 6 | T5 gardener engine validation | verification | Run garden skill, confirm it produces results |
| 7 | T7 retroactive categorization | execution | Run the batch, confirm >80% categorized |
| 8 | Production integration test | verification | Claude Web re-runs the full review protocol |

### The key process learning

**"Complete" should mean "working in production," not "code reviewed and merged."** For infrastructure tasks, add an operational verification step after dev/QA review and before LIAISON completion.

---

*Analysis by LIAISON agent, 2026-02-27 evening. Based on Claude Web review findings.*
