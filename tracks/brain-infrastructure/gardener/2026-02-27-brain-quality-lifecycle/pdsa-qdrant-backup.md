# PDSA: Qdrant Backup Before Gardening Mutations (T8)

**Task:** `gardener-qdrant-backup`
**Date:** 2026-02-27
**Phase:** Plan

## Plan

### What
Create a Qdrant backup before the gardener engine runs its first deep gardening pass with mutations. Safety net for restore if gardening goes wrong. Uses the existing NAS versioned backup pattern from `backup-to-synology.sh`.

### Research Findings

**Existing backup strategy:**
- GFS (Grandfather-Father-Son) via `backup-to-synology.sh` (runs as thomas, 3 AM cron)
- NAS path: `/volume1/backups/hetzner/` on Synology (10.33.33.2)
- SSH config: `synology-backup` host in thomas's `~/.ssh/config`
- Retention: 7 daily, 4 weekly, 12 monthly
- Method: tar over SSH

**Qdrant data:**
- Docker volume: `best-practices/api/qdrant_data/` → `/qdrant/storage` in container
- 1245 thoughts, collection `thought_space`
- Data owned by root (Docker)
- Qdrant has native snapshot API: `POST /collections/{name}/snapshots`

**Constraints:**
- `developer` user has no sudo — cannot tar Docker-owned files directly
- Must use either Qdrant snapshot API or thomas user for file-level backup
- The gardener runs as developer — needs to trigger backup before mutations

### Design

**Two components:**

#### Component 1: Backup script — `best-practices/scripts/qdrant-backup.sh`

Uses Qdrant's native HTTP snapshot API (no sudo needed):

```bash
#!/bin/bash
# Qdrant brain backup — creates snapshot and transfers to NAS
# Can be run by developer user (uses Qdrant HTTP API, no sudo)

set -e

QDRANT_URL="http://localhost:6333"
COLLECTION="thought_space"
BACKUP_BASE="/volume1/backups/hetzner/brain"
DATE=$(date +%Y-%m-%d_%H%M%S)
SSH_CMD="ssh synology-backup"
TEMP_DIR="/tmp/qdrant-backup-$$"

# 1. Create Qdrant snapshot via API
echo "[$(date)] Creating Qdrant snapshot..."
SNAPSHOT_RESPONSE=$(curl -s -X POST "$QDRANT_URL/collections/$COLLECTION/snapshots")
SNAPSHOT_NAME=$(echo "$SNAPSHOT_RESPONSE" | node -e "
  const d=require('fs').readFileSync('/dev/stdin','utf8');
  const j=JSON.parse(d);
  console.log(j.result.name);
")

# 2. Download snapshot to temp
mkdir -p "$TEMP_DIR"
curl -s "$QDRANT_URL/collections/$COLLECTION/snapshots/$SNAPSHOT_NAME" \
  -o "$TEMP_DIR/$SNAPSHOT_NAME"

# 3. Create manifest
cat > "$TEMP_DIR/RESTORE.md" << EOF
# Qdrant Brain Backup
Date: $DATE
Collection: $COLLECTION
Snapshot: $SNAPSHOT_NAME

## Restore
1. Stop brain API: cd best-practices/api && docker compose down
2. Upload snapshot:
   curl -X POST "http://localhost:6333/collections/$COLLECTION/snapshots/upload" \
     -H "Content-Type: multipart/form-data" \
     -F "snapshot=@$SNAPSHOT_NAME"
3. Start brain API: docker compose up -d
EOF

# 4. Transfer to NAS
$SSH_CMD "mkdir -p $BACKUP_BASE/snapshots/$DATE"
tar czf - -C "$TEMP_DIR" . | $SSH_CMD "tar xzf - -C $BACKUP_BASE/snapshots/$DATE/"

# 5. Cleanup old snapshots (keep last 10)
$SSH_CMD "cd $BACKUP_BASE/snapshots && ls -1d */ 2>/dev/null | sort | head -n -10 | xargs -r rm -rf || true"

# 6. Delete snapshot from Qdrant (cleanup)
curl -s -X DELETE "$QDRANT_URL/collections/$COLLECTION/snapshots/$SNAPSHOT_NAME"

# 7. Cleanup temp
rm -rf "$TEMP_DIR"

echo "[$(date)] Backup complete: $BACKUP_BASE/snapshots/$DATE/$SNAPSHOT_NAME"
```

**Key design decisions:**
- Uses Qdrant HTTP API — no sudo needed, developer user can run it
- Snapshot is atomic — Qdrant handles consistency internally
- Downloads snapshot locally, then transfers to NAS
- Keeps 10 backup versions (more than daily GFS, since gardening is less frequent)
- Cleans up Qdrant-side snapshot after transfer

#### Component 2: Gardener pre-flight check — SKILL.md update

**File:** `best-practices/.claude/skills/xpo.claude.mindspace.garden/SKILL.md`

Add **Step 0.5: Pre-flight Backup** before Step 1 (Parse arguments), only for `depth=deep`:

```markdown
### Step 0.5: Pre-flight Backup (deep only)

If `depth=deep` (mutations will occur):

1. Run the backup script:
   ```bash
   bash /home/developer/workspaces/github/PichlerThomas/best-practices/scripts/qdrant-backup.sh
   ```

2. If backup fails: abort gardening with error. Do NOT proceed with mutations without a backup.

3. Log: "Brain backup created at /volume1/backups/hetzner/brain/snapshots/<date>"

If `depth=shallow` or `depth=micro`: skip this step (no destructive operations).
```

#### Component 3: Operational runbook entry

**File:** `best-practices/tracks/brain-infrastructure/gardener/2026-02-27-brain-quality-lifecycle/RUNBOOK.md`

Document the backup and restore procedure:

```markdown
# Gardener Operational Runbook

## Pre-Gardening Backup
Run before any `depth=deep` gardening:
```bash
bash best-practices/scripts/qdrant-backup.sh
```

## Restore from Backup
1. List available backups:
   ```bash
   ssh synology-backup "ls /volume1/backups/hetzner/brain/snapshots/"
   ```
2. Download snapshot:
   ```bash
   scp synology-backup:/volume1/backups/hetzner/brain/snapshots/<date>/<snapshot> /tmp/
   ```
3. Stop services, upload, restart:
   ```bash
   cd best-practices/api && docker compose down
   curl -X POST "http://localhost:6333/collections/thought_space/snapshots/upload" \
     -H "Content-Type: multipart/form-data" -F "snapshot=@/tmp/<snapshot>"
   docker compose up -d
   ```
4. Verify:
   ```bash
   curl http://localhost:6333/collections/thought_space | jq .result.points_count
   ```
```

### SSH Requirement

The backup script uses `ssh synology-backup` which is configured in thomas's SSH config. The `developer` user needs its own SSH config entry or the script must run via thomas.

**Option A (preferred):** Add `synology-backup` SSH config for developer user:
```
# ~/.ssh/config addition for developer
Host synology-backup
    HostName 10.33.33.2
    User HomeAssistant
    IdentityFile ~/.ssh/synology_backup
    StrictHostKeyChecking no
    ConnectTimeout 10
```
This requires copying thomas's `synology_backup` key to developer or creating a new key pair.

**Option B (fallback):** Script uses `sshpass` to go through thomas:
```bash
sshpass -p '<password>' ssh thomas@localhost "ssh synology-backup 'mkdir -p ...'"
```

The design uses Option A as the implementation target. If developer's SSH to NAS is not set up, the script will fail with a clear error and the gardener will abort before mutations.

### Acceptance Criteria

1. Qdrant snapshot created via HTTP API and transferred to NAS
2. Multiple backup versions retained (10 snapshots)
3. Backup verified restorable (restore instructions in manifest)
4. Documented as part of gardener operational runbook
5. Gardener `depth=deep` requires successful backup before proceeding
6. `depth=shallow` and `depth=micro` skip backup (no mutations)

### Effort

Medium — new script, skill update, runbook document, SSH config for developer.

## Do
(DEV implements)

## Study
(Post-implementation)

## Act
(Post-study)
