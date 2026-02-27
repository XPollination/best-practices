# PDSA: Qdrant Backup Before Gardening Mutations (T8)

**Task:** `gardener-qdrant-backup`
**Date:** 2026-02-27
**Phase:** Plan (Rework v2 — aligned with existing GFS strategy)

## Plan

### What
Create a Qdrant backup before the gardener engine runs its first deep gardening pass with mutations. Safety net for restore if gardening goes wrong. Must align with the existing GFS (Grandfather-Father-Son) backup strategy documented in `HomeAssistant/systems/hetzner-cx22-ubuntu/pdca/backup-strategy/2026-01-26-main-backup-strategy.pdca.md`.

### Research Findings

**Existing backup strategy (from backup PDCA + backup-to-synology.sh):**
- GFS rotation: 7 daily + 4 weekly + 12 monthly = ~23 versions max
- Method: **tar over SSH** (rsync FAILS on Synology — documented lesson)
- SSH alias: `synology-backup` (HostName 10.33.33.2, User HomeAssistant, key `/home/thomas/.ssh/synology_backup`)
- Base path: `/volume1/backups/hetzner/{daily,weekly,monthly,latest}/`
- Hardlinks (`cp -al`) for space-efficient snapshots between tiers
- Runs as thomas user via cron at 3 AM

**Qdrant data:**
- Docker volume: `best-practices/api/qdrant_data/` → `/qdrant/storage` in container
- 1245 thoughts, collection `thought_space`
- Data owned by root (Docker)
- Qdrant native snapshot API: `POST /collections/{name}/snapshots`

**Constraints:**
- `developer` user has no sudo — cannot tar Docker-owned files directly
- Must use Qdrant snapshot API (atomic, no root needed)
- The gardener runs as developer — needs to trigger backup before mutations
- developer needs SSH access to synology-backup (key setup required)

### Design (v2 — GFS-aligned)

**Three components:**

#### Component 1: Backup script — `best-practices/scripts/qdrant-backup.sh`

Uses Qdrant HTTP snapshot API + GFS rotation matching the existing strategy:

```bash
#!/bin/bash
# Qdrant brain backup with GFS rotation
# Mirrors backup-to-synology.sh pattern (tar over SSH, hardlinks, GFS)
# Can be run by developer user (uses Qdrant HTTP API, no sudo)

set -e

QDRANT_URL="http://localhost:6333"
COLLECTION="thought_space"
BACKUP_BASE="/volume1/backups/hetzner/brain"
DATE=$(date +%Y-%m-%d)
DAY_OF_WEEK=$(date +%u)  # 1=Monday, 7=Sunday
DAY_OF_MONTH=$(date +%d)
SSH_CMD="ssh synology-backup"
TEMP_DIR="/tmp/qdrant-backup-$$"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

log "=== Starting Qdrant brain backup ==="

# 1. Create Qdrant snapshot via API (atomic)
log "Creating Qdrant snapshot..."
SNAPSHOT_RESPONSE=$(curl -s -X POST "$QDRANT_URL/collections/$COLLECTION/snapshots")
SNAPSHOT_NAME=$(echo "$SNAPSHOT_RESPONSE" | node -e "
  const d=require('fs').readFileSync('/dev/stdin','utf8');
  const j=JSON.parse(d);
  console.log(j.result.name);
")
log "Snapshot created: $SNAPSHOT_NAME"

# 2. Download snapshot to temp
mkdir -p "$TEMP_DIR"
curl -s "$QDRANT_URL/collections/$COLLECTION/snapshots/$SNAPSHOT_NAME" \
  -o "$TEMP_DIR/$SNAPSHOT_NAME"
log "Downloaded: $(du -h "$TEMP_DIR/$SNAPSHOT_NAME" | cut -f1)"

# 3. Create backup manifest
cat > "$TEMP_DIR/RESTORE.md" << EOF
# Qdrant Brain Backup
Date: $DATE
Collection: $COLLECTION
Snapshot: $SNAPSHOT_NAME
Thoughts: $(curl -s "$QDRANT_URL/collections/$COLLECTION" | node -e "
  const d=require('fs').readFileSync('/dev/stdin','utf8');
  console.log(JSON.parse(d).result.points_count);
")

## Restore
1. Stop brain API: cd best-practices/api && docker compose down
2. Upload snapshot:
   curl -X POST "http://localhost:6333/collections/$COLLECTION/snapshots/upload" \
     -H "Content-Type: multipart/form-data" \
     -F "snapshot=@$SNAPSHOT_NAME"
3. Start brain API: docker compose up -d
4. Verify: curl http://localhost:6333/collections/$COLLECTION | jq .result.points_count
EOF

# 4. Transfer to NAS latest (tar over SSH — rsync fails on Synology)
log "Transferring to NAS..."
$SSH_CMD "mkdir -p $BACKUP_BASE/latest"
$SSH_CMD "rm -rf $BACKUP_BASE/latest/* 2>/dev/null || true"
tar czf - -C "$TEMP_DIR" . | $SSH_CMD "tar xzf - -C $BACKUP_BASE/latest/"
log "Transfer complete"

# 5. Create daily snapshot (hardlinks for space efficiency)
log "Creating daily snapshot: $DATE"
$SSH_CMD "rm -rf $BACKUP_BASE/daily/$DATE 2>/dev/null || true; cp -al $BACKUP_BASE/latest $BACKUP_BASE/daily/$DATE"

# 6. Promote to weekly (on Sunday = day 7)
if [ "$DAY_OF_WEEK" -eq 7 ]; then
    log "Sunday - Creating weekly snapshot"
    $SSH_CMD "rm -rf $BACKUP_BASE/weekly/$DATE 2>/dev/null || true; cp -al $BACKUP_BASE/daily/$DATE $BACKUP_BASE/weekly/$DATE"
fi

# 7. Promote to monthly (on 1st of month)
if [ "$DAY_OF_MONTH" = "01" ]; then
    log "1st of month - Creating monthly snapshot"
    $SSH_CMD "rm -rf $BACKUP_BASE/monthly/$DATE 2>/dev/null || true; cp -al $BACKUP_BASE/daily/$DATE $BACKUP_BASE/monthly/$DATE"
fi

# 8. Cleanup old backups (GFS retention: 7 daily + 4 weekly + 12 monthly)
log "Cleaning up old backups (GFS retention)..."
$SSH_CMD "
    cd $BACKUP_BASE/daily 2>/dev/null && ls -1d */ 2>/dev/null | sort | head -n -7 | xargs -r rm -rf || true
    cd $BACKUP_BASE/weekly 2>/dev/null && ls -1d */ 2>/dev/null | sort | head -n -4 | xargs -r rm -rf || true
    cd $BACKUP_BASE/monthly 2>/dev/null && ls -1d */ 2>/dev/null | sort | head -n -12 | xargs -r rm -rf || true
"

# 9. Delete snapshot from Qdrant (cleanup server-side)
curl -s -X DELETE "$QDRANT_URL/collections/$COLLECTION/snapshots/$SNAPSHOT_NAME" > /dev/null

# 10. Cleanup local temp
rm -rf "$TEMP_DIR"

# 11. Report
$SSH_CMD "
    echo 'Brain backup counts:'
    echo '  Daily: '$(ls $BACKUP_BASE/daily 2>/dev/null | wc -l)
    echo '  Weekly: '$(ls $BACKUP_BASE/weekly 2>/dev/null | wc -l)
    echo '  Monthly: '$(ls $BACKUP_BASE/monthly 2>/dev/null | wc -l)
"

log "=== Qdrant brain backup completed ==="
```

**Alignment with existing strategy:**
- GFS rotation: 7 daily + 4 weekly + 12 monthly (matches `backup-to-synology.sh`)
- tar over SSH (NOT rsync — Synology rsync fails, documented lesson)
- Hardlinks (`cp -al`) for space-efficient snapshots
- SSH alias `synology-backup` (same as existing)
- NAS path: `/volume1/backups/hetzner/brain/{daily,weekly,monthly,latest}/` (under existing base path)
- Manifest with restore instructions (matches existing BACKUP_MANIFEST.txt pattern)

#### Component 2: Gardener pre-flight check — SKILL.md update

**File:** `best-practices/.claude/skills/xpo.claude.mindspace.garden/SKILL.md`

Add **Step 0.5: Pre-flight Backup** before Step 1, only for `depth=deep`:

```markdown
### Step 0.5: Pre-flight Backup (deep only)

If `depth=deep` (mutations will occur):

1. Run the backup script:
   ```bash
   bash /home/developer/workspaces/github/PichlerThomas/best-practices/scripts/qdrant-backup.sh
   ```

2. If backup fails: abort gardening with error. Do NOT proceed with mutations without a backup.

3. Log: "Brain backup created at /volume1/backups/hetzner/brain/daily/<date>"

If `depth=shallow` or `depth=micro`: skip this step (no destructive operations).
```

#### Component 3: Operational runbook

**File:** `best-practices/tracks/brain-infrastructure/gardener/2026-02-27-brain-quality-lifecycle/RUNBOOK.md`

```markdown
# Gardener Operational Runbook

## Pre-Gardening Backup
Run before any `depth=deep` gardening:
```
bash best-practices/scripts/qdrant-backup.sh
```

## List Available Backups
```
ssh synology-backup "ls /volume1/backups/hetzner/brain/daily/"
ssh synology-backup "ls /volume1/backups/hetzner/brain/weekly/"
ssh synology-backup "ls /volume1/backups/hetzner/brain/monthly/"
```

## Restore from Backup
1. Download snapshot from NAS:
   ```
   ssh synology-backup "cat /volume1/backups/hetzner/brain/daily/<date>/<snapshot>" > /tmp/restore.snapshot
   ```
   (Note: scp fails on Synology — use cat over SSH)

2. Stop brain API:
   ```
   cd best-practices/api && docker compose down
   ```

3. Upload snapshot to Qdrant:
   ```
   docker compose up -d qdrant
   curl -X POST "http://localhost:6333/collections/thought_space/snapshots/upload" \
     -H "Content-Type: multipart/form-data" -F "snapshot=@/tmp/restore.snapshot"
   ```

4. Start brain API:
   ```
   docker compose up -d
   ```

5. Verify:
   ```
   curl http://localhost:6333/collections/thought_space | jq .result.points_count
   curl http://localhost:3200/api/v1/health
   ```
```

### SSH Requirement

The backup script uses `ssh synology-backup`. The `developer` user needs its own SSH config entry:

```
# ~/.ssh/config for developer
Host synology-backup
    HostName 10.33.33.2
    User HomeAssistant
    IdentityFile ~/.ssh/synology_backup
    StrictHostKeyChecking no
    ConnectTimeout 10
```

This requires either copying thomas's `synology_backup` key or generating a new keypair and adding it to Synology's HomeAssistant authorized_keys. If SSH is not configured, the script fails with a clear error and the gardener aborts before mutations.

### NAS Directory Setup

First run requires creating the brain backup directory structure on Synology:

```bash
ssh synology-backup "mkdir -p /volume1/backups/hetzner/brain/{daily,weekly,monthly,latest}"
```

### Acceptance Criteria

1. Qdrant snapshot created via HTTP API and transferred to NAS
2. GFS rotation: 7 daily + 4 weekly + 12 monthly (matches existing strategy)
3. tar over SSH (NOT rsync — Synology incompatibility)
4. Hardlinks (`cp -al`) for space-efficient snapshots
5. Backup path under existing base: `/volume1/backups/hetzner/brain/`
6. Restore instructions documented in manifest and runbook
7. Gardener `depth=deep` requires successful backup before proceeding
8. `depth=shallow` and `depth=micro` skip backup

### Effort

Medium — new script, skill update, runbook document, SSH config for developer.

## Do
(DEV implements)

## Study
(Post-implementation)

## Act
(Post-study)
