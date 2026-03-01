# PDSA: Qdrant Backup NAS Hostname Unresolvable

**Task:** `qdrant-backup-nas-unresolvable`
**Date:** 2026-03-01
**Phase:** Plan

## Plan

### Problem
`qdrant-backup.sh` fails at Step 4 with `ssh: Could not resolve hostname synology-backup: Temporary failure in name resolution`. The Qdrant snapshot is created locally (47M) but NAS transfer fails, blocking deep gardening.

### Root Cause
SSH config mismatch: the script uses `ssh synology-backup` but the `developer` user's `~/.ssh/config` only defines `Host synology` — not `Host synology-backup`.

The original PDSA design for `gardener-qdrant-backup` specified `synology-backup` as the SSH alias (matching the `thomas` user's config pattern), but the `developer` user was never given that alias.

### Evidence
- `~/.ssh/config`: Has `Host synology` (10.33.33.2, User HomeAssistant) but NO `Host synology-backup`
- `/etc/hosts`: Cloud-managed, no custom entries
- VPN: WireGuard wg0 UP, 10.33.33.2 reachable (32ms)
- NAS: `ssh synology` works, `/volume1/backups/hetzner/` exists with GFS dirs
- Missing: `/volume1/backups/hetzner/brain/` directory does not exist yet

### Fix: Add synology-backup SSH alias

Add `Host synology-backup` entry to `~/.ssh/config` pointing to the same NAS. This keeps the script unchanged and aligns with the original PDSA design intent.

Also create `/volume1/backups/hetzner/brain/{daily,weekly,monthly,latest}` on NAS.

### Dev Tasks
1. Add `Host synology-backup` to `~/.ssh/config` (HostName 10.33.33.2, User HomeAssistant, same key)
2. Create `/volume1/backups/hetzner/brain/{daily,weekly,monthly,latest}` on NAS via SSH
3. Test end-to-end: `bash best-practices/scripts/qdrant-backup.sh`
4. Verify GFS rotation works

### Acceptance Criteria
- Script resolves `synology-backup` hostname correctly
- Backup completes end-to-end: snapshot + download + NAS transfer
- GFS directories populated on NAS

## Do
(DEV implements)

## Study
(Post-implementation)

## Act
(Post-study)
