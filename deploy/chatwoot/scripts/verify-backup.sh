#!/usr/bin/env bash
# Decrypt ONLY on a trusted offline recovery host; the archive contains secrets.
set -Eeuo pipefail
umask 077
[[ $# = 2 ]] || { echo "Usage: verify-backup.sh ARCHIVE AGE_IDENTITY_FILE" >&2; exit 2; }
archive="$(realpath -- "$1")"
identity="$(realpath -- "$2")"
for tool in age tar sha256sum mktemp; do command -v "$tool" >/dev/null || exit 2; done
work="$(mktemp -d "${TMPDIR:-/tmp}/os-plus-chat-verify.XXXXXXXX")"
trap 'rm -rf -- "$work"' EXIT
age --decrypt --identity "$identity" --output "$work/bundle.tar.gz" "$archive"
# Fixed outer archive membership prevents unexpected paths, links or executables.
expected=$'.env\nCaddyfile\nSHA256SUMS\nchatwoot-storage.tar.gz\nchatwoot.dump\ncompose.yaml\nn8n-storage.tar.gz\nn8n.dump\nredis.rdb\nscripts/init-n8n-db.sh'
actual="$(tar -tzf "$work/bundle.tar.gz" | LC_ALL=C sort)"
[[ "$actual" = "$expected" ]] || { echo "Unexpected archive membership." >&2; exit 1; }
tar --no-same-owner -xzf "$work/bundle.tar.gz" -C "$work"
(cd "$work" && sha256sum --check --status SHA256SUMS)
tar -tzf "$work/chatwoot-storage.tar.gz" >/dev/null
tar -tzf "$work/n8n-storage.tar.gz" >/dev/null
echo "Encrypted archive integrity passed. Run a separate isolated DB/file restore drill before live use."
