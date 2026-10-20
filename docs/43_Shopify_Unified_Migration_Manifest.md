# Unified Orders migration manifest — 19 October 2026

Approval companion to [the deployment package](42_Shopify_Unified_Orders_Approval.md).
SHA-256 of the exact local file bytes applied during the approved release. Any
content or line-ending change requires regenerating this manifest and reviewing
the change. Execution status is recorded in document 44. Git checkout line-ending
conversion can produce different working-file hashes; do not rerun installed SQL.

| Order | File under `supabase/migrations/` | SHA-256 |
|---|---|---|
| 1 | `20261019190000_shopify_import_preview.sql` | `8CBB2ABD9CC39A20F854CAEB2F18CE66B290712BC6E741B4ACBA3AA751D391CD` |
| 2 | `20261019191000_shopify_retained_business_details.sql` | `78AA8318AF85DC780F7E5AA429DBA42C18D1A3B106BBB7ABF1123ECBBACCE617` |
| 3 | `20261019192000_shopify_unified_order_reads.sql` | `4AB7AD6C738AB8E9822314CFD78EB8977ACD95068BC737B4CC5F50614F60E771` |
| 4 | `20261019193000_shopify_raw_retention.sql` | `E7E22291B506A806A8B144F1FBE1513699B858872A7450A2F46D3E524799FDF2` |
| 5 | `20261019194000_shopify_manager_draft_setup.sql` | `7BD45562F1956BAC0C756BEBD1220EB283FAB90506C96B810A206F65BD655EDA` |
| 6 | `20261019195000_shopify_complete_manager_setup.sql` | `B9C7140E91583E1A27EAA47FD8666D75F795F00D8BB4DF7688B90BE64A9147E4` |
| 7 | `20261019200000_shopify_unified_import_batches.sql` | `B799628FF89FFFCA2A00F2D2BF962047911A077586EFC21360D49B7BCD06C2F1` |

These are new files only. The package does not authorize re-running historical
migrations, applying an older permission-cleanup proposal, changing repo
visibility, touching Chat/CRM, or enabling production-tenant imports.
