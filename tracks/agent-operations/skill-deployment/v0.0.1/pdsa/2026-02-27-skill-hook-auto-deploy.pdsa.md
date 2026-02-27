# PDSA: Auto-Deploy Skills via Symlinks + Hook Config Merge

**Date:** 2026-02-27
**Task:** skill-hook-auto-deploy
**Parent:** task-boundary-brain-protocol (Phase 4)
**Status:** PLAN

## Plan

### Problem
Skills and hook configs drift from git source. Installed SKILL.md already differs from source (install section). brain/ is a regular dir copy instead of symlink. New hooks (e.g., UserPromptSubmit) require manual settings.json update.

### Design Principle
Symlinks for skills (zero maintenance). Node.js merge for hooks (preserves local config).

## Do

### File 1: claude-session.sh (modify)

Add two functions called BEFORE launching Claude agents:

```bash
sync_skills() {
    local SKILLS_SRC="/home/developer/workspaces/github/PichlerThomas/best-practices/.claude/skills"
    local SKILLS_DST="$HOME/.claude/skills"

    mkdir -p "$SKILLS_DST"

    # Symlink each skill directory
    for skill_dir in "$SKILLS_SRC"/*/; do
        local name=$(basename "$skill_dir")
        local target="$SKILLS_SRC/$name"
        local link="$SKILLS_DST/$name"

        # Skip if already correct symlink
        if [ -L "$link" ] && [ "$(readlink "$link")" = "$target" ]; then
            continue
        fi

        # Remove existing (dir or wrong symlink)
        rm -rf "$link"
        ln -sfn "$target" "$link"
    done

    # brain/ backward compat (relative symlink)
    if [ ! -L "$SKILLS_DST/brain" ] || [ "$(readlink "$SKILLS_DST/brain")" != "xpo.claude.mindspace.brain" ]; then
        rm -rf "$SKILLS_DST/brain"
        ln -sfn "xpo.claude.mindspace.brain" "$SKILLS_DST/brain"
    fi
}

sync_settings() {
    local TEMPLATE="/home/developer/workspaces/github/PichlerThomas/best-practices/scripts/xpo.claude.settings.json"
    local LOCAL="$HOME/.claude/settings.json"
    local NVM_NODE="/home/developer/.nvm/versions/node/v22.22.0/bin"

    if [ ! -f "$TEMPLATE" ]; then return; fi

    # If no local settings, copy template
    if [ ! -f "$LOCAL" ]; then
        cp "$TEMPLATE" "$LOCAL"
        return
    fi

    # Merge using Node.js script
    PATH="$NVM_NODE:$PATH" node "$SYNC_SETTINGS_SCRIPT" "$TEMPLATE" "$LOCAL"
}
```

Call order in `create_agents_session()` and `create_single_session()`:
```
sync_skills
sync_settings
# then create panes and launch Claude
```

### File 2: best-practices/scripts/xpo.claude.sync-settings.js (new)

Node.js script for JSON merge:
```javascript
// Usage: node xpo.claude.sync-settings.js <template> <local>
// Merges template hook entries into local settings.json
// Preserves all local config (permissions, local-only hooks)
// Adds missing hook entries without duplicating existing ones

const fs = require('fs');
const template = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const local = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));

// Ensure hooks object exists
if (!local.hooks) local.hooks = {};

// For each hook event in template
for (const [event, entries] of Object.entries(template.hooks || {})) {
    if (!local.hooks[event]) {
        // New event — add entirely
        local.hooks[event] = entries;
    } else {
        // Existing event — add entries not already present
        for (const entry of entries) {
            const entryStr = JSON.stringify(entry);
            const exists = local.hooks[event].some(
                existing => JSON.stringify(existing) === entryStr
            );
            if (!exists) {
                local.hooks[event].push(entry);
            }
        }
    }
}

fs.writeFileSync(process.argv[3], JSON.stringify(local, null, 2) + '\n');
```

### File 3: SKILL.md install section (modify)

Update from:
```
# Skill
mkdir -p ~/.claude/skills/xpo.claude.monitor
cp best-practices/.claude/skills/xpo.claude.monitor/SKILL.md ~/.claude/skills/xpo.claude.monitor/SKILL.md
```

To:
```
# Install all skills (symlinks — auto-update on git pull)
for skill in xpo.claude.monitor xpo.claude.unblock xpo.claude.mindspace.brain xpo.claude.mindspace.pm.status; do
  ln -sfn /home/developer/workspaces/github/PichlerThomas/best-practices/.claude/skills/$skill ~/.claude/skills/$skill
done

# Backward compat symlink for brain skill
ln -sfn xpo.claude.mindspace.brain ~/.claude/skills/brain
```

## Study
- Verify skills load correctly via symlinks (Claude Code resolves symlinks)
- Verify brain skill accessible via both /brain and /xpo.claude.mindspace.brain
- Verify settings.json merge preserves local permissions and PreCompact hook
- Verify new hook entries (UserPromptSubmit) are added

## Act
- Run sync once manually to migrate from copies to symlinks
- Future: any skill/hook addition only needs template update + git push — next session auto-deploys
