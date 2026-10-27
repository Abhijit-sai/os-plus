# Inactive Chat notification scheduler template

chat-hourly.json is a credential-free, inactive export for the new isolated platform n8n only. It has not been imported, activated or runtime-tested in n8n. No existing business instance or workflow is reused. The historical hourly endpoint polls every five minutes; tenant-local cutoffs and delivery dedupe live in OS PLUS, not the scheduler.

After separate owner release approval: import into the new isolated instance, replace the .invalid URL with the approved OS PLUS HTTPS origin, assign a newly created HTTP Header Auth credential (Authorization = Bearer plus the private CHAT_NOTIFICATIONS_CRON_SECRET), and verify local/approved-test destinations before considering activation. Credentials, names, IDs and actual secrets are deliberately absent from the export. Never paste a secret into node parameters or commit it. Keep the workflow inactive during setup.

The endpoint returns accepted:true after authentication and queues background work; this is not a delivery receipt. Check OS PLUS delivery status. Unknown POST receipts are held and never automatically retried. This template does not authorize activation or real Telegram messages.
