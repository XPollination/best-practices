#!/usr/bin/env node
// xpo.claude.sync-settings.js — Merge template hook entries into local settings.json
//
// Usage: node xpo.claude.sync-settings.js <template> <local>
//
// Merges template hook entries into local settings.json without overwriting
// local customizations (permissions, local-only hooks like PreCompact).
// Two entries are considered identical if their JSON serialization matches.

const fs = require('fs');

const templatePath = process.argv[2];
const localPath = process.argv[3];

if (!templatePath || !localPath) {
  console.error('Usage: node xpo.claude.sync-settings.js <template> <local>');
  process.exit(1);
}

const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
const local = JSON.parse(fs.readFileSync(localPath, 'utf8'));

if (!local.hooks) local.hooks = {};

let changed = false;

for (const [event, entries] of Object.entries(template.hooks || {})) {
  if (!local.hooks[event]) {
    local.hooks[event] = entries;
    changed = true;
  } else {
    for (const entry of entries) {
      const entryStr = JSON.stringify(entry);
      const exists = local.hooks[event].some(
        existing => JSON.stringify(existing) === entryStr
      );
      if (!exists) {
        local.hooks[event].push(entry);
        changed = true;
      }
    }
  }
}

if (changed) {
  fs.writeFileSync(localPath, JSON.stringify(local, null, 2) + '\n');
  console.log('settings.json updated with new hook entries');
} else {
  console.log('settings.json already up to date');
}
