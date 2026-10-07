#!/usr/bin/env bash
set -Eeuo pipefail
# Keep the scheduler's application credential separate from its DB administrator.
psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set ON_ERROR_STOP=1 \
  --set app_password="$N8N_DB_PASSWORD" <<'SQL'
CREATE ROLE n8n LOGIN PASSWORD :'app_password';
ALTER DATABASE n8n OWNER TO n8n;
GRANT USAGE, CREATE ON SCHEMA public TO n8n;
SQL
