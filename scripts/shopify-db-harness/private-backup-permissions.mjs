import { identifier } from './private-backup-contract.mjs';
export const rolesSql=`SELECT rolname AS name,rolinherit AS inherit,rolbypassrls AS bypassrls,
 rolsuper AS superuser,rolcreatedb AS createdb,rolcreaterole AS createrole,rolreplication AS replication
 FROM pg_roles WHERE rolname !~ '^pg_' ORDER BY rolname`;
export function membershipSql(version){return `SELECT r.rolname AS role,m.rolname AS member,g.rolname AS grantor,a.admin_option AS admin,
 ${Number(version)>=160000?'a.inherit_option':'true'} AS inherit,${Number(version)>=160000?'a.set_option':'true'} AS set
 FROM pg_auth_members a JOIN pg_roles r ON r.oid=a.roleid JOIN pg_roles m ON m.oid=a.member JOIN pg_roles g ON g.oid=a.grantor
 ORDER BY r.rolname,m.rolname,g.rolname`;}
export const defaultsSql=`SELECT r.rolname AS owner,n.nspname AS schema,d.defaclobjtype::text AS type,
 coalesce(g.rolname,'PUBLIC') AS grantee,coalesce(gr.rolname,r.rolname) AS grantor,a.privilege_type AS privilege,a.is_grantable AS grantable
 FROM pg_default_acl d JOIN pg_roles r ON r.oid=d.defaclrole LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace
 LEFT JOIN LATERAL aclexplode(d.defaclacl) a ON true LEFT JOIN pg_roles g ON g.oid=a.grantee LEFT JOIN pg_roles gr ON gr.oid=a.grantor
 WHERE d.defaclnamespace=0 OR n.nspname='public' ORDER BY r.rolname,n.nspname,d.defaclobjtype,grantee,grantor,a.privilege_type`;
export const schemaAclSql=`SELECT r.rolname AS owner,coalesce(g.rolname,'PUBLIC') AS grantee,gr.rolname AS grantor,
 a.privilege_type AS privilege,a.is_grantable AS grantable FROM pg_namespace n JOIN pg_roles r ON r.oid=n.nspowner
 CROSS JOIN LATERAL aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a LEFT JOIN pg_roles g ON g.oid=a.grantee
 JOIN pg_roles gr ON gr.oid=a.grantor WHERE n.nspname='public' ORDER BY grantee,grantor,a.privilege_type`;
const grantee=name=>name==='PUBLIC'?'PUBLIC':identifier(name);
const permitted=new Set(['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN','EXECUTE','USAGE','CREATE']);
const objectTypes={r:'TABLES',S:'SEQUENCES',f:'FUNCTIONS',T:'TYPES',n:'SCHEMAS'};
function privilege(value){if(!permitted.has(value))throw new Error('PERMISSION_KIND_UNSUPPORTED');return value;}
export function roleFlags(role){return `${role.superuser?'SUPERUSER':'NOSUPERUSER'} ${role.createdb?'CREATEDB':'NOCREATEDB'} ${role.createrole?'CREATEROLE':'NOCREATEROLE'} ${role.replication?'REPLICATION':'NOREPLICATION'} ${role.inherit?'INHERIT':'NOINHERIT'} ${role.bypassrls?'BYPASSRLS':'NOBYPASSRLS'}`;}
export function membershipCommands(row){
  const base=`GRANT ${identifier(row.role)} TO ${identifier(row.member)}`;
  return ['admin','inherit','set'].map(option=>`${base} WITH ${option.toUpperCase()} ${row[option]?'TRUE':'FALSE'} GRANTED BY ${identifier(row.grantor)};`).join('\n');
}
export function globalDefaultCommands(rows){
  const groups=new Map();
  for(const row of rows){
    if(row.schema!==null)continue;
    if(!objectTypes[row.type]||row.grantor!==row.owner)throw new Error('DEFAULT_PERMISSION_SCOPE_UNSUPPORTED');
    const id=JSON.stringify([row.owner,row.type]);if(!groups.has(id))groups.set(id,[]);groups.get(id).push(row);
  }
  let sql='';
  for(const group of groups.values()){
    const row=group[0],base=`ALTER DEFAULT PRIVILEGES FOR ROLE ${identifier(row.owner)}`;
    for(const name of new Set(['PUBLIC',row.owner,...group.map(r=>r.grantee)]))sql+=`${base} REVOKE ALL ON ${objectTypes[row.type]} FROM ${grantee(name)};\n`;
    for(const grant of group)if(grant.privilege)sql+=`${base} GRANT ${privilege(grant.privilege)} ON ${objectTypes[row.type]} TO ${grantee(grant.grantee)}${grant.grantable?' WITH GRANT OPTION':''};\n`;
  }
  return sql;
}
export function schemaAclCommands(rows,existing=[]){
  if(!rows.length)throw new Error('SCHEMA_PERMISSION_EMPTY');
  let sql=`ALTER SCHEMA public OWNER TO ${identifier(rows[0].owner)};\n`;
  for(const name of new Set(['PUBLIC',...existing.map(r=>r.grantee),...rows.map(r=>r.grantee)]))sql+=`REVOKE ALL ON SCHEMA public FROM ${grantee(name)} CASCADE;\n`;
  for(const grant of rows)sql+=`SET ROLE ${identifier(grant.grantor)}; GRANT ${privilege(grant.privilege)} ON SCHEMA public TO ${grantee(grant.grantee)}${grant.grantable?' WITH GRANT OPTION':''}; RESET ROLE;\n`;
  return sql;
}
