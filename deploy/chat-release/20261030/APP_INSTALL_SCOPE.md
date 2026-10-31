# Initial app installation - exact proposed scope
31 October 2026 IST. **Prepared; not executed or approved by this document.** CH10 implemented engineering is accepted under CHAT-D072. This installation is a separate shared-app release scope.

## What would change
Merge draftPR10 from source commit79763a223e948de6d0db70078717e75efb907f4f into then-current main ONLY after rechecking main remainsc686337c0f059cbe6ae40bbcadc2f6c0da2ffc0a. The existing Git integration would build/deploy that code to os-plus.vercel.app. No checkout/branch switch, rebase or replacement of a newer main. The app is shared by every tenant even while Chat is disabled.

Keep CHAT_FOUNDATION_ENABLED=false, CHAT_DRY_RUN=true, CHAT_ADMIN_LIVE_ENABLED=false and every execution/model/mock/draft/voice/STT/Telegram/notification/platform-alert/cron/lead-refresh flagOFF. Exact names/literal desired values are in app-install-scope.json. Preserve all unrelated Clerk/Supabase/Shopify environment configuration. Verify production and preview/branch overrides; source defaults are not runtime-env proof. Do not add Chat/provider secrets for the all-off installation.

There is **no SQL to run**. The35Chat additions were already applied by the owner and verified against the exact reviewed candidate; no migration ledger exists, so no historical106 replay or reapply35. Keep all tenant Chat modules disabled. No new account, inbox, operator/password/invitation, browser identity, Shopify store connection, Meta asset/number or n8n workflow change.

## Evidence already available
- Accepted source79763a2; fresh GitHub PR10 isdraft/open/unmerged/mergeableclean and Vercel previewFUdjCLapi1voGs58RmCgjsM6KhRm isSUCCESS. GitHub Production deployment record still referencesc686337.
- Fresh authenticated Vercel overview directly confirms productionReady/mainc686337, os-plus.vercel.app, deployment9WpBNhMhAuTvPFumCSCwtKjVmfYp. This is separate from CI status.
- Fresh read-only VPS check31Oct06:35UTC:7services running/pins match,4configuredhealthy, zeroactiveworkflows and no ownedtestcontainers; HTTPS200/TLSverified,1642MiBavailable/64GiBfree/noSwap. Check-only backup freshness0 is not a scheduled independent backup PASS.
- Prior five platform gates and final315/315Chat on ownedPG17.6 remain dated PASS; latest exactcandidate7atomic/recovery and post-apply40RLS-table/69function security catalogue checks pass within documented redundant trigger ACL variance. No new code has changed since those checks; no repeated suite is claimed.

## Remaining checks / staged disposition
Runtime environment review now verified through authenticated native accessibility plus owner confirmation: Project search chat returns No Results Found with All Types/All Environments/All Editors/All Variables; Shared with search cleared says No shared variables linked. No secret value was read/revealed and no setting changed. The initial installation therefore needs NO environment changes: unset Chat flags use strict safe defaults. Use a fresh main Production build after approved merge, not promotion of the preview environment.

The application source commit is79763a2; the final published PR head may include ONLY these release-review documentation descendants. The final action must pin that reviewed published head and recheck current main. Never merge a later code change under an earlier approval.

Current production public GET now200/TLSverified in0.36s; an initial20s GET timeout and a404 on the unconfigured favicon path are retained as diagnostics, not a confirmed app defect or a business-regression PASS. No root cause is invented. Preview no-cookie GET302 redirects to Vercel protection, so no authenticated preview acceptance is claimed.

Fresh candidate full saved-record Boutique critical regression, independent roles/tenant/mobile/Clerk and SSO are still pending/partial. Initial all-off installation must carry an explicit scoped staged disposition before deployment; this proposal does not silently waive those checks. No authenticated preview/business action before its flag/identity configuration is reviewed. Backup work remains owner-deferredD069/notPASS; no new backup destination or purchase is requested. Operational real-data encryption/access/recovery gates remain open.

After an approved installation, verify actual deployed source/domain and that Chat remains hidden/denied, preserve existing login/customer/order/payment/GST/Shopify behavior, then prepare a separate exact Phantom Threads Test-only provisioning/capture scope. Hosted Test acceptance must precede real business binding or WhatsApp onboarding. Keep synthetic901/902 intact; no reuse.

## Rollback
Preserve current production deployment9WpBNhMhAuTvPFumCSCwtKjVmfYp/sourcec686337 and unrelated env. If the new app fails, return the production alias to that verified prior deployment and restore only reviewed env changes. Keep the additive Chat schema/data; never drop tables or restore sharedDB over newer business records. Do not rotate keys or recreate VPS volumes. Reverify prior deployment availability immediately before any release.

No AI/STT/Telegram/real Meta messages, workflow activation or purchase. Feature provider/STT/judge spendUSD0. This file and app-install-scope.json are review material, not an execution script or permission.
