#!/usr/bin/env bash
set -Eeuo pipefail
backup_dir="${BACKUP_DIR:-/var/backups/os-plus-chat}"
max_age_hours="${BACKUP_MAX_AGE_HOURS:-26}"
[[ "$max_age_hours" =~ ^[1-9][0-9]*$ ]] || exit 2
[[ -f "$backup_dir/last-success" ]] || { echo "No successful backup recorded." >&2; exit 1; }
read -r last <"$backup_dir/last-success"
[[ "$last" =~ ^[0-9]+$ ]] || exit 2
now="$(date -u +%s)"
(( now >= last && now - last <= max_age_hours * 3600 )) || { echo "Backup freshness check failed." >&2; exit 1; }
echo "Backup freshness check passed."
