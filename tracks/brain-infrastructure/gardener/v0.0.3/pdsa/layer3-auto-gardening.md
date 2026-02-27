# PDSA: Systemic Gardening Enforcement — Toolchain over Agent Instructions

**Task:** gardener-v003-layer3-skipped
**Date:** 2026-02-27
**Status:** Design (rework v4 — versioning addressed)

## Systemic Principle

Agent instructions (skill steps) may be skipped under task flow momentum. Toolchain automation (CLI/scripts) always runs. Mandatory gardening belongs in toolchain.

---

## Change 1: Layer 3 — `microGarden()` in interface-cli.js

**Source file:** `xpollination-mcp-server/src/db/interface-cli.js`
**Track:** `xpollination-mcp-server/tracks/project-management/interface-cli/`
**Version bump:** v0.0.1 → v0.0.2

### Insertion point

After the notification block (line 505) and BEFORE `output(result)` on line 507:

```javascript
  // NEW: Auto micro-garden on complete transition (Layer 3)
  if (newStatus === 'complete') {
    const gardenResult = await microGarden(node.slug, project, updatedDna);
    if (gardenResult) result.gardening = gardenResult;
  }

  output(result);  // existing line 507
```

### `microGarden()` function (place after `contributeToBrain()`, line 302)

```javascript
async function microGarden(slug, project, dna, timeoutMs = 5000) {
  const title = dna.title || slug;
  const findings = dna.findings
    ? (typeof dna.findings === 'string' ? dna.findings : JSON.stringify(dna.findings)).substring(0, 200)
    : 'N/A';
  const impl = dna.implementation?.summary || dna.implementation?.commit || 'N/A';
  const pdsaVerdict = dna.pdsa_review?.verdict || 'N/A';
  const qaVerdict = dna.qa_review?.verdict || 'N/A';

  const summary = `TASK SUMMARY: ${title} (${project}). ` +
    `Findings: ${findings}. Implementation: ${impl}. ` +
    `Reviews: PDSA=${pdsaVerdict}, QA=${qaVerdict}.`;

  return new Promise((resolve) => {
    const data = JSON.stringify({
      prompt: summary,
      agent_id: 'system',
      agent_name: 'GARDENER',
      context: `auto-garden on complete: ${slug}`,
      thought_category: 'task_summary',
      topic: slug
    });
    const req = http.request('http://localhost:3200/api/v1/memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      timeout: timeoutMs
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => resolve({ status: 'ok', summary_contributed: true }));
    });
    req.on('error', () => resolve({ status: 'skipped', reason: 'brain error' }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 'skipped', reason: 'timeout' }); });
    req.write(data);
    req.end();
  });
}
```

No brain query step needed — DNA has all info. Builds summary from DNA fields, POSTs once. ~35 lines.

---

## Change 2: Layer 1 — Brain health in pm-status.cjs

**Source file:** `xpollination-mcp-server/viz/pm-status.cjs` (NEW)
**Track:** `xpollination-mcp-server/tracks/project-management/pm-status/` (NEW work package)
**Version:** v0.0.1

Single script replaces Steps 0 + 1 + 1.5 of PM status skill. Agent runs ONE command, gets JSON with tasks + brain health. Brain health cannot be skipped.

```javascript
#!/usr/bin/env node
// pm-status.cjs v0.0.1 — PM status with integrated brain health
const http = require('http');
const { execSync } = require('child_process');

const CLI = __dirname + '/../src/db/interface-cli.js';
const DBS = {
  'best-practices': '/home/developer/workspaces/github/PichlerThomas/best-practices/data/xpollination.db',
  'xpollination-mcp-server': '/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/data/xpollination.db',
  'HomePage': '/home/developer/workspaces/github/PichlerThomas/HomePage/data/xpollination.db'
};

async function main() {
  const result = { timestamp: new Date().toISOString(), projects: {}, brain_health: null };

  // Scan all project DBs (Step 1)
  for (const [name, dbPath] of Object.entries(DBS)) {
    try {
      const out = execSync(`DATABASE_PATH="${dbPath}" node ${CLI} list`, { encoding: 'utf8', timeout: 10000 });
      result.projects[name] = JSON.parse(out);
    } catch { result.projects[name] = { error: 'scan failed' }; }
  }

  // Brain health diagnostic (Step 1.5 — ALWAYS runs)
  result.brain_health = await brainHealth();

  console.log(JSON.stringify(result, null, 2));
}

async function brainHealth() {
  return new Promise((resolve) => {
    const data = JSON.stringify({
      prompt: 'Recent brain activity across all domains and agents',
      agent_id: 'system', agent_name: 'PM-STATUS',
      read_only: true, full_content: true
    });
    const req = http.request('http://localhost:3200/api/v1/memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      timeout: 5000
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const r = JSON.parse(body);
          const sources = r.result?.sources || [];
          const highways = r.result?.highways_nearby || [];
          resolve({
            status: sources.length > 0 ? 'healthy' : 'empty',
            recent_thoughts: sources.length,
            highways: highways.length,
            top_domains: [...new Set(sources.map(s => s.topic).filter(Boolean))].slice(0, 5)
          });
        } catch { resolve({ status: 'parse_error' }); }
      });
    });
    req.on('error', () => resolve({ status: 'unavailable' }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 'timeout' }); });
    req.write(data);
    req.end();
  });
}

main();
```

~70 lines. LIAISON invokes: `node viz/pm-status.cjs` instead of 4 separate commands.

---

## Change 3: PM status SKILL.md update

**File:** `best-practices/.claude/skills/xpo.claude.mindspace.pm.status/SKILL.md`
(symlinked to `~/.claude/skills/`)

Replace Steps 0 + 1 + 1.5 with single command:

```markdown
## Step 1: Scan Projects + Brain Health

node /home/developer/.../xpollination-mcp-server/viz/pm-status.cjs

This returns JSON with all project tasks AND brain health. Parse and present.
Brain health section is always included — no separate step needed.
```

Steps 2-4 (summary table, drill-down, wrap-up) remain agent-driven — they require human interaction and cannot be automated.

---

## Versioning Plan

### 1. interface-cli v0.0.2 (xpollination-mcp-server repo)

```bash
# Create v0.0.2 using new-version.sh
cd /home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server
./scripts/new-version.sh project-management/interface-cli v0.0.2

# v0.0.2/deliverables/ gets the modified interface-cli.js (root stays as living artifact)
# v0.0.2/pdsa/ links back to this PDSA doc
```

**Deliverable:** The modified `src/db/interface-cli.js` with `microGarden()`. Root file IS the living artifact — no symlink needed (CLI is always invoked from root path).

### 2. pm-status v0.0.1 (xpollination-mcp-server repo)

```bash
# Create new work package
cd /home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server
mkdir -p tracks/project-management/pm-status/v0.0.1/pdsa
mkdir -p tracks/project-management/pm-status/v0.0.1/deliverables

# v0.0.1/deliverables/ = empty (root viz/pm-status.cjs is living artifact)
# v0.0.1/pdsa/ links back to this PDSA doc
```

**Deliverable:** New `viz/pm-status.cjs` at root. Track records version history.

### 3. gardener v0.0.3 deliverables (best-practices repo)

```bash
# Create deliverables dir (already have pdsa/)
mkdir -p tracks/brain-infrastructure/gardener/v0.0.3/deliverables

# Updated SKILL.md goes here as reference copy
# Living artifact: ~/.claude/skills/xpo.claude.mindspace.pm.status/SKILL.md
```

### Lazy migration for existing gaps

- `interface-cli/v0.0.1/deliverables/` is empty → add README noting original source at `src/db/interface-cli.js`
- `gardener/v0.0.2/deliverables/` is empty → add README noting deliverables were the read_only API change and SKILL.md update

---

## Files Modified (complete list)

| Repo | File | Action | Track Version |
|------|------|--------|---------------|
| xpollination-mcp-server | `src/db/interface-cli.js` | Add `microGarden()` + call on complete | interface-cli v0.0.2 |
| xpollination-mcp-server | `viz/pm-status.cjs` | NEW — PM status with brain health | pm-status v0.0.1 |
| best-practices | `.claude/skills/.../pm.status/SKILL.md` | Update Steps 0+1+1.5 → single script | gardener v0.0.3 |
| xpollination-mcp-server | `tracks/project-management/interface-cli/v0.0.2/` | NEW version dir | — |
| xpollination-mcp-server | `tracks/project-management/pm-status/v0.0.1/` | NEW work package | — |
| best-practices | `tracks/.../gardener/v0.0.3/deliverables/` | NEW deliverables dir | — |

## Backward Compatibility

- `microGarden()` failure doesn't block transitions (resolve, not reject)
- `pm-status.cjs` is additive — old skill still works without it
- All track dirs are documentation, not runtime dependencies

## Study / Act

To be filled after dev implements and QA tests.
