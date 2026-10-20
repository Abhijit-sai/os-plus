import {createHash} from 'node:crypto';
// Exact pg_dump/restore round-trip representations observed on PG 17.6 -> 17.9.
// Never strip parentheses generally or ignore ACLs. Unknown definitions fail.
export const equivalentDefinitions=[
  {kind:'constraint',name:'shopify_connections.shopify_connections_app_ref_check',variants:[
    "CHECK ((((length(app_ref) >= 1) AND (length(app_ref) <= 256)) AND (app_ref ~ '^[A-Za-z0-9_-]+$'::text)))",
    "CHECK (((length(app_ref) >= 1) AND (length(app_ref) <= 256) AND (app_ref ~ '^[A-Za-z0-9_-]+$'::text)))"]},
  {kind:'constraint',name:'shopify_variant_mappings.shopify_variant_mappings_sku_check',variants:[
    'CHECK ((((length(sku) >= 1) AND (length(sku) <= 512)) AND (sku = btrim(sku))))',
    'CHECK (((length(sku) >= 1) AND (length(sku) <= 512) AND (sku = btrim(sku))))']},
  // null ACL means the table owner's default full rights, nobody else's.
  // Both include the same owner, RLS and FORCE RLS bits in the hashed string.
  {kind:'table_security',name:'shopify_release_capabilities',variants:[
    't|f|postgres|{postgres=arwdDxtm/postgres}','t|f|postgres']},
];
const md5=value=>createHash('md5').update(value).digest('hex');
export function canonicalBackupCatalogue(rows){
  return rows.map(row=>{
    const known=equivalentDefinitions.find(x=>x.kind===row.kind&&x.name===row.name);
    return known&&known.variants.some(v=>md5(v)===row.hash)?{...row,hash:md5(known.variants[0])}:row;
  });
}
