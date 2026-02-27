#!/bin/bash
# Qdrant brain backup with GFS rotation
# Mirrors backup-to-synology.sh pattern (tar over SSH, hardlinks, GFS)
# Can be run by developer user (uses Qdrant HTTP API, no sudo)
# Schedule: Run before depth=deep gardening (Step 0.5) or manually

set -e

# Configuration
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

log "=========================================="
log "Starting Qdrant brain backup"
log "Date: $DATE | Day of week: $DAY_OF_WEEK | Day of month: $DAY_OF_MONTH"
log "=========================================="

# 1. Create Qdrant snapshot via API (atomic, no root needed)
log "Step 1: Creating Qdrant snapshot via API..."
SNAPSHOT_RESPONSE=$(curl -s -X POST "$QDRANT_URL/collections/$COLLECTION/snapshots")
SNAPSHOT_NAME=$(echo "$SNAPSHOT_RESPONSE" | node -e "
  const d=require('fs').readFileSync('/dev/stdin','utf8');
  const j=JSON.parse(d);
  if (!j.result || !j.result.name) { console.error('Snapshot creation failed:', d); process.exit(1); }
  console.log(j.result.name);
")
log "Snapshot created: $SNAPSHOT_NAME"

# 2. Download snapshot to temp
log "Step 2: Downloading snapshot..."
mkdir -p "$TEMP_DIR"
curl -s "$QDRANT_URL/collections/$COLLECTION/snapshots/$SNAPSHOT_NAME" \
  -o "$TEMP_DIR/$SNAPSHOT_NAME"
log "Downloaded: $(du -h "$TEMP_DIR/$SNAPSHOT_NAME" | cut -f1)"

# 3. Create backup manifest with restore instructions
log "Step 3: Creating backup manifest..."
POINT_COUNT=$(curl -s "$QDRANT_URL/collections/$COLLECTION" | node -e "
  const d=require('fs').readFileSync('/dev/stdin','utf8');
  console.log(JSON.parse(d).result.points_count || 'unknown');
")
cat > "$TEMP_DIR/RESTORE.md" << EOF
# Qdrant Brain Backup
Date: $DATE
Collection: $COLLECTION
Snapshot: $SNAPSHOT_NAME
Thoughts: $POINT_COUNT

## Restore
1. Download snapshot from NAS:
   ssh synology-backup "cat $BACKUP_BASE/daily/$DATE/$SNAPSHOT_NAME" > /tmp/restore.snapshot
   (Note: scp fails on Synology — use cat over SSH)

2. Stop brain API:
   cd best-practices/api && docker compose down

3. Upload snapshot to Qdrant:
   docker compose up -d qdrant
   curl -X POST "$QDRANT_URL/collections/$COLLECTION/snapshots/upload" \\
     -H "Content-Type: multipart/form-data" -F "snapshot=@/tmp/restore.snapshot"

4. Start brain API:
   docker compose up -d

5. Verify:
   curl $QDRANT_URL/collections/$COLLECTION | jq .result.points_count
   curl http://localhost:3200/api/v1/health
EOF

# 4. Ensure NAS directories exist
log "Step 4: Ensuring NAS directories..."
$SSH_CMD "mkdir -p $BACKUP_BASE/latest $BACKUP_BASE/daily $BACKUP_BASE/weekly $BACKUP_BASE/monthly"

# 5. Transfer to NAS latest (tar over SSH — rsync fails on Synology)
log "Step 5: Transferring to NAS via tar over SSH..."
$SSH_CMD "rm -rf $BACKUP_BASE/latest/* 2>/dev/null || true"
tar czf - -C "$TEMP_DIR" . | $SSH_CMD "tar xzf - -C $BACKUP_BASE/latest/"
log "Transfer complete"

# 6. Create daily snapshot using hardlinks (cp -al for space efficiency)
log "Step 6: Creating daily snapshot: $DATE"
$SSH_CMD "rm -rf $BACKUP_BASE/daily/$DATE 2>/dev/null || true; cp -al $BACKUP_BASE/latest $BACKUP_BASE/daily/$DATE"
log "Daily snapshot created"

# 7. Promote to weekly (on Sunday = day 7)
if [ "$DAY_OF_WEEK" -eq 7 ]; then
    log "Step 7: Sunday detected - Creating weekly snapshot"
    $SSH_CMD "rm -rf $BACKUP_BASE/weekly/$DATE 2>/dev/null || true; cp -al $BACKUP_BASE/daily/$DATE $BACKUP_BASE/weekly/$DATE"
    log "Weekly snapshot created"
else
    log "Step 7: Not Sunday - Skipping weekly snapshot"
fi

# 8. Promote to monthly (on 1st of month)
if [ "$DAY_OF_MONTH" = "01" ]; then
    log "Step 8: 1st of month detected - Creating monthly snapshot"
    $SSH_CMD "rm -rf $BACKUP_BASE/monthly/$DATE 2>/dev/null || true; cp -al $BACKUP_BASE/daily/$DATE $BACKUP_BASE/monthly/$DATE"
    log "Monthly snapshot created"
else
    log "Step 8: Not 1st of month - Skipping monthly snapshot"
fi

# 9. Cleanup old backups (GFS retention: 7 daily + 4 weekly + 12 monthly)
log "Step 9: Cleaning up old backups (GFS retention)..."
$SSH_CMD "
    cd $BACKUP_BASE/daily 2>/dev/null && ls -1d */ 2>/dev/null | sort | head -n -7 | xargs -r rm -rf || true
    cd $BACKUP_BASE/weekly 2>/dev/null && ls -1d */ 2>/dev/null | sort | head -n -4 | xargs -r rm -rf || true
    cd $BACKUP_BASE/monthly 2>/dev/null && ls -1d */ 2>/dev/null | sort | head -n -12 | xargs -r rm -rf || true
"
log "Cleanup complete"

# 10. Delete snapshot from Qdrant (cleanup server-side storage)
log "Step 10: Cleaning up Qdrant snapshot..."
curl -s -X DELETE "$QDRANT_URL/collections/$COLLECTION/snapshots/$SNAPSHOT_NAME" > /dev/null

# 11. Cleanup local temp
rm -rf "$TEMP_DIR"

# 12. Report
log "Step 12: Backup statistics"
$SSH_CMD "
    echo 'Brain backup counts:'
    echo '  Daily: '$(ls $BACKUP_BASE/daily 2>/dev/null | wc -l)
    echo '  Weekly: '$(ls $BACKUP_BASE/weekly 2>/dev/null | wc -l)
    echo '  Monthly: '$(ls $BACKUP_BASE/monthly 2>/dev/null | wc -l)
"

log "=========================================="
log "Qdrant brain backup completed successfully!"
log "=========================================="
