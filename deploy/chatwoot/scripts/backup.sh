#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
kit="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
cd -- "$kit"

backup_dir="${BACKUP_DIR:-/var/backups/os-plus-chat}"
recipient_file="${BACKUP_RECIPIENT_FILE:-/etc/os-plus-chat/backup-recipients.txt}"
retention_days="${BACKUP_RETENTION_DAYS:-14}"
[[ "$backup_dir" = /* && "$backup_dir" != / ]] || { echo "Use an absolute backup directory other than /." >&2; exit 2; }
[[ "$retention_days" =~ ^[1-9][0-9]*$ ]] || { echo "Invalid retention days." >&2; exit 2; }
for tool in docker age flock tar sha256sum mktemp; do
  command -v "$tool" >/dev/null || { echo "Missing backup prerequisite: $tool" >&2; exit 2; }
done
[[ -s "$recipient_file" && -f .env ]] || { echo "Backup recipients or deployment environment missing." >&2; exit 2; }
mkdir -p -- "$backup_dir"
backup_dir="$(cd -- "$backup_dir" && pwd -P)"
exec 9>"$backup_dir/.backup.lock"
flock -n 9 || { echo "A backup is already running." >&2; exit 2; }
compose=(docker compose --env-file "$kit/.env" -f "$kit/compose.yaml")
# Quiet ALL writers before dumping data or copying attachments. A live tar of the
# volume or a DB-only dump can produce an archive that cannot restore a conversation.
work="$(mktemp -d "$backup_dir/.partial.XXXXXXXX")"
running=()
resume_needed=false
published=false
archive=""
cleanup() {
  local code=$?
  trap - EXIT
  if [[ "$resume_needed" = true && ${#running[@]} -gt 0 ]]; then
    if ! "${compose[@]}" start "${running[@]}" >"$work/restart.log" 2>&1; then
      code=1
      echo "Backup recovery could not restart all previously running apps; inspect services." >&2
    fi
  fi
  if [[ "$work" = "$backup_dir"/.partial.* ]]; then rm -rf -- "$work"; fi
  if [[ "$published" = false && -n "$archive" ]]; then rm -f -- "$archive.partial"; fi
  if (( code != 0 )); then
    echo "Backup failed; no success marker was written. Alert operations." >&2
  fi
  exit "$code"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

service_list="$("${compose[@]}" ps --status running --services)"
while IFS= read -r service; do
  case "$service" in rails|sidekiq|n8n) running+=("$service") ;; esac
done <<<"$service_list"
if (( ${#running[@]} > 0 )); then
  resume_needed=true
  "${compose[@]}" stop --timeout 90 "${running[@]}" >"$work/stop.log" 2>&1
fi
"${compose[@]}" exec -T cw-postgres pg_dump -U chatwoot -d chatwoot -Fc >"$work/chatwoot.dump" 2>"$work/db.log"
"${compose[@]}" exec -T n8n-postgres pg_dump -U postgres -d n8n -Fc >"$work/n8n.dump" 2>>"$work/db.log"
"${compose[@]}" exec -T redis sh -ec 'REDISCLI_AUTH="$REDIS_PASSWORD" redis-cli SAVE >/dev/null; cat /data/dump.rdb' >"$work/redis.rdb" 2>"$work/redis.log"
"${compose[@]}" run --rm --no-deps --entrypoint tar backup-files -C /snapshots/chatwoot -czf - . >"$work/chatwoot-storage.tar.gz" 2>"$work/storage.log"
"${compose[@]}" run --rm --no-deps --entrypoint tar backup-files -C /snapshots/n8n -czf - . >"$work/n8n-storage.tar.gz" 2>>"$work/storage.log"
# .env contains encryption keys. It is included ONLY inside the encrypted archive;
# without the n8n key, restored workflow credentials would be unusable.
cp -- .env compose.yaml Caddyfile "$work/"
mkdir "$work/scripts"
cp -- scripts/init-n8n-db.sh "$work/scripts/"
(
  cd -- "$work"
  sha256sum chatwoot.dump n8n.dump redis.rdb chatwoot-storage.tar.gz n8n-storage.tar.gz .env compose.yaml Caddyfile scripts/init-n8n-db.sh >SHA256SUMS
)
archive="$backup_dir/os-plus-chat-$(date -u +%Y%m%dT%H%M%SZ)-$$.tar.age"
tar -C "$work" -czf - chatwoot.dump n8n.dump redis.rdb chatwoot-storage.tar.gz n8n-storage.tar.gz .env compose.yaml Caddyfile scripts/init-n8n-db.sh SHA256SUMS \
  | age --recipients-file "$recipient_file" --output "$archive.partial"
[[ -s "$archive.partial" ]] || { echo "Empty backup archive." >&2; exit 1; }
mv -- "$archive.partial" "$archive"
published=true
if (( ${#running[@]} > 0 )); then
  "${compose[@]}" start "${running[@]}" >"$work/restart.log" 2>&1
fi
resume_needed=false
date -u +%s >"$backup_dir/.last-success.partial"
mv -- "$backup_dir/.last-success.partial" "$backup_dir/last-success"
# Retention runs only after a successful complete backup, within the resolved path.
find "$backup_dir" -maxdepth 1 -type f -name 'os-plus-chat-*.tar.age' -mtime "+$retention_days" -delete
echo "Encrypted backup complete: $archive"
