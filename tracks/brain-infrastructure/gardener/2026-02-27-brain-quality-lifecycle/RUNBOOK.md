# Gardener Operational Runbook

## Pre-Gardening Backup

Run before any `depth=deep` gardening to create a safety net:

```bash
bash /home/developer/workspaces/github/PichlerThomas/best-practices/scripts/qdrant-backup.sh
```

This creates a Qdrant snapshot via the HTTP API, transfers it to the NAS via tar over SSH, and rotates using GFS (7 daily + 4 weekly + 12 monthly).

## List Available Backup Versions

```bash
# Daily backups (last 7)
ssh synology-backup "ls /volume1/backups/hetzner/brain/daily/"

# Weekly backups (last 4)
ssh synology-backup "ls /volume1/backups/hetzner/brain/weekly/"

# Monthly backups (last 12)
ssh synology-backup "ls /volume1/backups/hetzner/brain/monthly/"

# Latest backup contents
ssh synology-backup "ls /volume1/backups/hetzner/brain/latest/"
```

## Restore from Backup

### 1. Download snapshot from NAS

Use cat over SSH (scp fails on Synology):

```bash
ssh synology-backup "cat /volume1/backups/hetzner/brain/daily/<date>/<snapshot-file>" > /tmp/restore.snapshot
```

### 2. Stop brain API

```bash
cd /home/developer/workspaces/github/PichlerThomas/best-practices/api
docker compose down
```

### 3. Upload snapshot to Qdrant

```bash
docker compose up -d qdrant
curl -X POST "http://localhost:6333/collections/thought_space/snapshots/upload" \
  -H "Content-Type: multipart/form-data" \
  -F "snapshot=@/tmp/restore.snapshot"
```

### 4. Start brain API

```bash
docker compose up -d
```

### 5. Verify restoration

```bash
# Check thought count
curl http://localhost:6333/collections/thought_space | jq .result.points_count

# Check brain API health
curl http://localhost:3200/api/v1/health
```

## SSH Requirement

The backup script uses `ssh synology-backup`. The `developer` user needs this SSH config entry:

```
# ~/.ssh/config
Host synology-backup
    HostName 10.33.33.2
    User HomeAssistant
    IdentityFile ~/.ssh/synology_backup
    StrictHostKeyChecking no
    ConnectTimeout 10
```

Requires either copying thomas's `synology_backup` key or generating a new keypair for the HomeAssistant authorized_keys on Synology.

## NAS Directory Setup (First Run)

```bash
ssh synology-backup "mkdir -p /volume1/backups/hetzner/brain/{daily,weekly,monthly,latest}"
```
