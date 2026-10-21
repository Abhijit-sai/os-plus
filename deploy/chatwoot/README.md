# New OS PLUS Chatwoot + n8n platform kit (CH-0)

This kit is for a **new, isolated server**. OS PLUS stays on Vercel/Supabase.
Chatwoot is the staff inbox; n8n will schedule OS PLUS endpoints. No application
leads, bot engine, login handoff, workflow activation or OS PLUS migrations ship
in CH-0. Nothing in this directory is applied automatically.

Owner approvals still govern server purchases, DNS, deployments, shared DB changes,
Meta settings and real messages. All local tests must use synthetic credentials;
`CHAT_DRY_RUN` is an OS PLUS integration flag implemented in later phases, not a
Chatwoot switch. Do not connect real inboxes as a way to test this deployment kit.

## Topology and resource budget

- Caddy owns 80/443 and proxies Chatwoot, including WebSockets.
- Only the scheduler editor binds to host loopback (127.0.0.1:5678), accessed by SSH.
- Chatwoot Postgres+pgvector, Redis and attachment volume share one private network.
- n8n has its own Postgres, non-superuser application credential, network and volume.
- Backup file reads use a dedicated ops-profile helper with no network and read-only
  file mounts; neither application image must supply tar.
- No databases or Docker socket are published. Never mount the Docker socket in n8n.
- Memory limits total approximately 6 GiB. Start with a dedicated 8 GiB RAM class
  Linux VM plus operational headroom; capacity must be measured with real approved
  volume. A worker migration or backup can temporarily add memory usage.
- Chatwoot 4.18.0 CE and n8n 2.41.7 are explicit new-platform release selections,
  based on upstream releases reviewed 2026-10-07. Major-version DB/proxy tags are
  defaults for preparation; resolve **every image to a tested digest before live use**.
  Recheck releases/security advisories at deployment; never auto-upgrade.

CHAT-D029 updates navigation: Chats opens Chatwoot at `chat.<domain>`; Leads is an OS PLUS workspace module. The earlier proposed `/crm` namespace is reserved and returns
a safe preparation response for now. No global basePath is added to OS PLUS. Before
forwarding that namespace to Vercel, prove asset URLs, navigation, Clerk sessions,
tenant switching, logout/revocation, proxy headers and server-action allowed origins.
One login requires an authenticated server-side Chatwoot handoff; it is not supplied
by a shared domain or this Caddyfile.

## Prepare locally (no live configuration)

Run the OS PLUS locked install and baseline from the repo root. Run the deployment
policy checks with `node --test deploy/chatwoot/tests/config.test.mjs`. On Linux,
run `bash -n deploy/chatwoot/scripts/*.sh` individually and the backup orchestration
suite with `wsl -d Ubuntu --exec python3 /mnt/d/Develop/os-plus-chat-ch0/deploy/chatwoot/tests/backup_test.py` on this Windows checkout. See CH0 verification evidence in `docs_chat/CH0_SCHEMA_AUDIT.md`.

To check Compose without generating a real credential, the test runner writes a
temporary synthetic env under the ignored `outputs/` directory. Use `docker compose
--env-file outputs/chat-ch0/example.env -f deploy/chatwoot/compose.yaml config --quiet`.
Never print `docker compose config` for a real env: the rendered output contains secrets.

## Prepare the new server (owner-authorised deployment only)

1. Choose/link the root domain, allocate `chat.<domain>`, provision a dedicated Ubuntu
   LTS server with SSH keys and host backups. Restrict SSH to provider IP/VPN; expose
   only 80/443 for the chat service. Provision encrypted-at-rest disks/volumes for
   database, attachments, Docker metadata and secrets before storing real tokens.
   Chatwoot MFA keys do not by themselves encrypt all provider token fields.
   Follow Docker's official Engine/Compose install
   instructions. Install `age`, `util-linux` (flock), `cron`, `openssl` and Node LTS.
2. Copy this directory to `/opt/os-plus-chat`. Use a provider-only directory; set
   owner-only access on its `.env`. Do not copy an existing business environment.
3. `cp .env.example .env`, `chmod 600 .env`. Fill the real chat hostname and operations
   email. Generate `CW_SECRET_KEY_BASE` with `openssl rand -hex 64`; generate each
   other required secret independently with `openssl rand -hex 32`. Never run a
   command that prints the completed environment to terminal/logs.
4. The preflight uses the repository's installed Zod. Run it from a checked-out,
   dependency-installed OS PLUS repo against the server env through a secure local
   operator session: `node deploy/chatwoot/scripts/check-config.mjs /path/to/.env`.
   Alternatively place the full checked-out repository on the server and use that
   script. Do not install application dependencies or source into a public web root.
   `docker compose --env-file .env config --quiet` must pass too.
5. Pull reviewed image digests. Start just `cw-postgres redis n8n-postgres`:
   `docker compose up -d --wait cw-postgres redis n8n-postgres`.
   Run `docker compose run --rm rails bundle exec rails db:chatwoot_prepare`.
   This prepares the **new Chatwoot DB**, never OS PLUS Supabase.
6. `docker compose up -d`. Check `docker compose ps`, TLS and the Chatwoot API.
   Account signup is disabled. Create the first operator through the Rails console
   using the upstream super-admin setup guide; do not leave public signup enabled.
   SMTP is required for staff invites/password resets; use fresh credentials.
7. For n8n: `ssh -N -L 5678:127.0.0.1:5678 provider@server`, open
   `http://localhost:5678`, create the new instance owner and secure recovery access.
   HTTP/non-secure cookies are confined to the SSH tunnel; do not publish 5678.
   Code, file and shell nodes are disabled; no runner is required for Schedule +
   HTTP Request. If the editor must later become public, design TLS/auth separately.
8. Complete the real DNS, TLS, callback/origin, SMTP, backup and restore checks before
   onboarding a business. See CHECKLIST Part B. Docker logs may contain PII; restrict
   host access, avoid verbose request logging, and never forward tokens into alerts.

## Centrally managed Meta assets; manual WhatsApp onboarding

One provider-managed Meta app is the implementation assumption from the owner's
central-management choice. A common operator may administer multiple business
pages/WABAs, but each business must authorise its own assets. App/product review,
business verification and permission availability still need checking against the
current Meta/Chatwoot setup screens.

Use fresh FB app id/secret and verification tokens; optional env values can stay blank
during local preparation. For manual WhatsApp, each Chatwoot inbox has its own WABA,
phone-number ID and appropriately scoped access token. There is no global WhatsApp
token in Compose. Chatwoot owns the Meta channel webhook; it forwards events to the
OS PLUS workspace webhook in CH-2. Keep account/inbox IDs mapped per OS PLUS tenant.
No Instagram comment automation, campaigns, payment screenshots or payment posting.

## n8n scheduling (build/activate in CH-7, not now)

Use an hourly Schedule Trigger calling the secret-guarded OS PLUS cron endpoint.
Store its Bearer secret in n8n encrypted credentials, never in a workflow JSON/env
expression or URL. The endpoint owns tenant iteration and per-tenant local-day
idempotency; n8n must not infer a tenant from a payload. Use a timeout, bounded retry
and an operations alert for failed runs. No workflow is supplied or activated now,
because the endpoint and notification guarantees do not exist until later phases.

## Encrypted backup + monitoring

Run backups during a documented short maintenance window: the script stops only
previously running rails/sidekiq/n8n writers, dumps both DBs, snapshots Redis (pending
jobs), and archives both persistent file volumes plus keys/config. It resumes only
the apps that were running before the backup. Concurrent backups are rejected.

1. Generate an age identity **on a separate trusted recovery host**. Store its private
   identity in the provider's secure vault, independently of the server. Install only
   its public recipient(s) in `/etc/os-plus-chat/backup-recipients.txt`.
2. `chmod 700 scripts/*.sh`; run `scripts/backup.sh`. Defaults: encrypted archives at
   `/var/backups/os-plus-chat`, retention 14 days. Optional operator environment:
   BACKUP_DIR, BACKUP_RECIPIENT_FILE, BACKUP_RETENTION_DAYS.
3. Before installing `backup.cron.example`, test success and deliberate failure.
   Protect the log with mode 600; configure cron mail or your host monitor to alert
   on a nonzero backup/freshness result. This kit never sends real Telegram messages.
4. Upload only encrypted archives to an independently retained off-server store
   using provider-managed credentials and a separate authorised job. Local archives
   and host snapshots alone do not protect against server/account loss.
5. On the recovery host, run `scripts/verify-backup.sh ARCHIVE AGE_IDENTITY_FILE`.
   It checks authenticated decryption, exact membership, checksums and storage tar
   integrity. This is not a database restore; complete the drill below.
6. Monitor `scripts/check-backup.sh`: missing, future or older-than-26-hour success
   timestamps fail. A failed backup never advances the success marker or retention.

A backup leaves a 700 temporary plaintext directory only while running; all exits
clean it. Encryption keys are backed up only inside the encrypted archive. Restore
credentials must remain private; never put an age identity in this repo or n8n.

## Isolated restore drill (required before live deployment)

Use a **new offline/staging host/project**, without public Caddy or running apps.
Never restore over a live volume. Decrypt the archive in a provider-only temporary
directory, validate with verify-backup first, verify SHA256SUMS again after extracting.
Restore with the archive's Compose/config and image digests, using a unique project
name; confirm it has no pre-existing containers/volumes before any start.

- Start only cw-postgres, n8n-postgres and redis, without public port mappings.
- Import the DBs with `pg_restore --exit-on-error --no-owner -U chatwoot -d chatwoot`
  and `pg_restore --exit-on-error --no-owner -U postgres -d n8n` respectively, through
  `docker compose -p <fresh-restore-project> exec -T` with each dump on stdin.
- The n8n application role is recreated by scripts/init-n8n-db.sh.
- Stop Redis, restore redis.rdb into its **new** data volume, preserve ownership,
  restart it and check pending-queue data with Redis authentication.
- Restore chatwoot-storage.tar.gz and n8n-storage.tar.gz into their **new** volumes
  using an isolated tar helper mounted only to those new target volumes with write
  access; preserve numeric application uid/gid. The normal backup helper mounts
  are read-only and must not be repurposed against live volumes.
- On isolated credentials/networks, confirm DB row counts, example attachment hash,
  n8n workflow count/credential decryption and pending jobs. Do not start restored
  senders with real tokens, SMTP or channel settings.
- Record drill date, image digests, backup age, row/hash results, RPO/RTO and teardown.
  Remove only the explicitly verified fresh restore project after review.

The kit has no automatic destructive restore command. Detailed target checks and a
successful drill are operator evidence needed before a production deployment.

## Upgrade / rollback

Take and verify a backup first. Read upstream release notes; pin new image digests,
run the upgrade on an isolated clone, prepare the Chatwoot DB with the upstream
command, then test login, assets, webhooks, private drafts and queued jobs. Test n8n
credential decryption and inactive/active workflow state explicitly. DB migrations
may prevent an image-only rollback: restore the verified pre-upgrade DB/files/keys
to a fresh environment; do not downgrade a migrated DB blindly.

## CH-0 local verification result

2026-10-07: application baseline passed; configuration 11/11, backup subprocess 13/13
(including real age encryption/decryption/tamper rejection), Caddy 4/4, Compose
configuration and shell syntax passed. Actual Docker service boot/DB restore was
not run: local Linux daemon is unavailable. Complete Part B service/restore evidence
before live use. No real messages, DNS, app configuration or workflow activation.

## Primary references (reviewed 2026-10-07)

- [Chatwoot Docker deployment](https://developers.chatwoot.com/self-hosted/deployment/docker)
- [Chatwoot 4.18.0 release](https://github.com/chatwoot/chatwoot/releases/tag/v4.18.0)
- [Pinned Chatwoot Compose/env source](https://github.com/chatwoot/chatwoot/tree/v4.18.0)
- [n8n stable releases](https://github.com/n8n-io/n8n/releases/tag/n8n%402.41.7)
- [n8n Postgres deployment](https://github.com/n8n-io/n8n-hosting/tree/main/docker-compose/withPostgres)
- [Docker Ubuntu installation](https://docs.docker.com/engine/install/ubuntu/)
