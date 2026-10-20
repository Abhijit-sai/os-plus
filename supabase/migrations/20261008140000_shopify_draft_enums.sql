-- Separate migration/transaction: PostgreSQL enum additions must be committed
-- before the next migration uses them. No records are changed or imported.
alter type public.order_source add value if not exists 'shopify';
alter type public.order_status add value if not exists 'draft';
