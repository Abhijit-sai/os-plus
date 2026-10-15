import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile,mkdtemp,rm,writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { Readable,Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { spawnSync } from 'node:child_process';
import { validateInput,pgpass,compatibleServer,archiveHeader,identifier } from './private-backup-contract.mjs';
import * as contract from './private-backup-contract.mjs';
import { encryptStream,decryptStream,authenticateArchive,limitTransform } from './private-backup-crypto.mjs';
import { membershipCommands,globalDefaultCommands,schemaAclCommands } from './private-backup-permissions.mjs';
import { rowsQuery,parseRows } from './private-backup-rows.mjs';

const ca=await readFile(new URL('../fixtures/supabase-public-ca-2021.crt',import.meta.url),'utf8');
const fake={mode:'Inspect',projectRef:'dxiyihrdfismbuqdmhit',host:'aws-1-ap-northeast-2.pooler.supabase.com',port:5432,
  database:'postgres',user:'postgres.dxiyihrdfismbuqdmhit',password:'FICTIONAL:pass\\value',ca,
  localRoot:'C:\\Users\\Synthetic\\AppData\\Local',privateRoot:'C:\\Users\\Synthetic\\AppData\\Local\\OSPlusPrivateBackups',ownerSid:'S-1-5-21-100-200-300-1001'};

test('fixed project, CA and session pooler validation accepts only the approved binding',()=>{
  assert.equal(validateInput({...fake}).mode,'Inspect');
  for(const delta of [{host:'evil.example'},{user:'postgres.foreign'},{port:6543},{projectRef:'foreign'},
    {privateRoot:'C:\\Users\\Synthetic\\OneDrive\\OSPlusPrivateBackups'},{ownerSid:'S-1-5-18'},
    {password:'abc\nDEF'},{password:''},{ca:'not a certificate'},{mode:'RestoreProduction'}]){
    assert.throws(()=>validateInput({...fake,...delta}));
  }
});
test('backup mode requires execution consent, new run id and a protected 256-bit key',()=>{
  assert.throws(()=>validateInput({...fake,mode:'BackupAndVerify'}));
  const input={...fake,mode:'BackupAndVerify',approved:true,nonce:'a'.repeat(32),key:Buffer.alloc(32,7).toString('base64'),protectedKey:'abcd'};
  assert.equal(validateInput(input).approved,true);
  assert.throws(()=>validateInput({...input,key:'AQ=='}));
  assert.throws(()=>validateInput({...input,nonce:'../backup'}));
});
test('pgpass escapes secret delimiters; SQL identifiers do not interpolate names',()=>{
  assert.ok(pgpass(fake).endsWith('FICTIONAL\\:pass\\\\value\n'));
  assert.equal(identifier('table"name'),'"table""name"');
  assert.throws(()=>identifier('bad\0name'));
  for(const v of [170009,160002,120000])assert.ok(compatibleServer(v));
  for(const v of [180000,110000,NaN])assert.ok(!compatibleServer(v));
});
test('GCM archive round trip, full authentication, random IV and no overwrite',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'osplus-fictional-backup-'));
  try{
    const key=randomBytes(32),aad=archiveHeader('b'.repeat(32)),plain=Buffer.from('FICTIONAL non-customer payload'),file=path.join(dir,'synthetic.enc');
    await encryptStream(Readable.from([plain]),file,aad,key);
    assert.equal(await authenticateArchive(file,aad,key),plain.length);
    const bytes=await readFile(file);assert.ok(!bytes.includes(plain));
    const {input,decipher}=await decryptStream(file,aad,key);const chunks=[];
    await pipeline(input,decipher,new Writable({write(chunk,encoding,callback){chunks.push(chunk);callback();}}));
    assert.deepEqual(Buffer.concat(chunks),plain);
    await assert.rejects(encryptStream(Readable.from([plain]),file,aad,key));
    assert.deepEqual(await readFile(file),bytes,'Existing archive must remain intact');
    const second=path.join(dir,'second.enc');await encryptStream(Readable.from([plain]),second,aad,key);
    assert.notDeepEqual(await readFile(second),bytes);
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('modified ciphertext, wrong key/AAD and truncated files fail before restore consumption',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'osplus-fictional-backup-'));
  try{
    const key=randomBytes(32),aad=archiveHeader('c'.repeat(32)),file=path.join(dir,'synthetic.enc');
    await encryptStream(Readable.from(['FICTIONAL payload']),file,aad,key);
    await assert.rejects(authenticateArchive(file,aad,randomBytes(32)));
    await assert.rejects(authenticateArchive(file,archiveHeader('d'.repeat(32)),key));
    const bytes=await readFile(file);bytes[aad.length+13]^=1;
    await writeFile(file,bytes);await assert.rejects(authenticateArchive(file,aad,key));
    await writeFile(file,bytes.subarray(0,10));await assert.rejects(authenticateArchive(file,aad,key));
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('plaintext byte ceiling is enforced',async()=>{
  await assert.rejects(pipeline(Readable.from([Buffer.alloc(10)]),limitTransform(9),new Writable({write(chunk,encoding,callback){callback();}})));
});
test('coverage guard rejects unsupported data or unverified permission inventories before export',()=>{
  assert.equal(typeof contract.assertCoverage,'function','Missing fail-closed coverage gate');
  const complete={unsupportedRelations:[],externalFks:[],publicExtensions:[],permissionSnapshotVerified:true};
  assert.doesNotThrow(()=>contract.assertCoverage(complete));
  for(const kind of ['f','p','m','inheritance'])assert.throws(()=>contract.assertCoverage({...complete,unsupportedRelations:[{kind}]}));
  assert.throws(()=>contract.assertCoverage({...complete,permissionSnapshotVerified:false}));
});
test('PowerShell executable selection resolves a single launchable Node path',async()=>{
  if(process.platform!=='win32')return;
  const source=await readFile(new URL('../run-shopify-private-backup.ps1',import.meta.url),'utf8');
  const expression=source.match(/\$backupNode=(.+)/)[1];
  const check=`$nodePath=${expression};$psi=[Diagnostics.ProcessStartInfo]::new();$psi.FileName=$nodePath;$psi.UseShellExecute=$false;$psi.CreateNoWindow=$true;$psi.RedirectStandardOutput=$true;$psi.ArgumentList.Add('-e');$psi.ArgumentList.Add('process.stdout.write("SYNTHETIC_OK")');$p=[Diagnostics.Process]::new();$p.StartInfo=$psi;try{$null=$p.Start();$out=$p.StandardOutput.ReadToEnd();$p.WaitForExit();if($out -ne 'SYNTHETIC_OK'){exit 1}}catch{exit 1}finally{$p.Dispose()}`;
  const result=spawnSync('pwsh',['-NoProfile','-Command',check],{encoding:'utf8',windowsHide:true,timeout:10000});
  assert.equal(result.status,0,'The executable lookup must produce one path, even when multiple Node installations exist');
});
test('permission reconstruction quotes roles and preserves membership options/default grants',()=>{
  const sql=membershipCommands({role:'group',member:'worker"x',grantor:'postgres',admin:false,inherit:true,set:false});
  assert.ok(sql.includes('WITH ADMIN FALSE'));assert.ok(sql.includes('WITH INHERIT TRUE'));assert.ok(sql.includes('WITH SET FALSE'));
  assert.ok(sql.includes('"worker""x"'));assert.ok(sql.includes('GRANTED BY "postgres"'));
  const row={owner:'postgres',schema:null,type:'r',grantee:'group',grantor:'postgres',privilege:'SELECT',grantable:true};
  assert.ok(globalDefaultCommands([row]).includes('GRANT SELECT ON TABLES TO "group" WITH GRANT OPTION'));
  assert.throws(()=>globalDefaultCommands([{...row,type:'unknown'}]));
  assert.throws(()=>globalDefaultCommands([{...row,grantor:'foreign'}]));
  assert.ok(schemaAclCommands([{...row,privilege:'USAGE'}]).includes('ALTER SCHEMA public OWNER TO "postgres"'));
});
test('private dump and restore explicitly disable Docker persistent logging',async()=>{
  const source=await readFile(new URL('./private-backup.mjs',import.meta.url),'utf8');
  assert.equal((source.match(/'--log-driver','none'/g)??[]).length,2,'Both live dump and private restore must suppress Docker plaintext logs');
});
test('offline verification accepts only archive-bound keys and rejects source credentials',()=>{
  const offline={mode:'VerifyExisting',approved:true,projectRef:fake.projectRef,localRoot:fake.localRoot,privateRoot:fake.privateRoot,
    ownerSid:fake.ownerSid,nonce:'e'.repeat(32),key:Buffer.alloc(32,2).toString('base64')};
  assert.equal(validateInput(offline).mode,'VerifyExisting');
  assert.throws(()=>validateInput({...offline,password:'must not be supplied'}));
  assert.throws(()=>validateInput({...offline,host:fake.host}));
  assert.throws(()=>validateInput({...offline,nonce:'../file'}));
});
test('psql JSON reader preserves quoted names and backslashes without COPY text escaping',()=>{
  const values=[{name:'fn("quoted",\\path)',rows:'2'}];
  assert.deepEqual(parseRows('SET\nSET\n'+JSON.stringify(values)+'\n'),values);
  assert.deepEqual(parseRows('SET\nSET\n'+JSON.stringify(values,null,2)+'\n'),values,'PostgreSQL aggregate JSON can span multiple lines');
  assert.ok(!rowsQuery('SELECT 1').includes('COPY'));
  // Simulate text COPY serialization: its doubled backslashes are not JSON.
  const copied=JSON.stringify(values).replaceAll('\\','\\\\');
  assert.throws(()=>parseRows(copied));
});
test('runner carries secrets via stdin, scopes reads and creates only disconnected restore resources',async()=>{
  const source=await readFile(new URL('./private-backup.mjs',import.meta.url),'utf8');
  const parent=await readFile(new URL('../run-shopify-private-backup.ps1',import.meta.url),'utf8');
  for(const literal of ['REPEATABLE READ READ ONLY','default_transaction_read_only=on',"'--network','none'",'PGSSLMODE=verify-full',
    'PGPASSFILE=/run/osplus/pgpass','--snapshot=','authenticateArchive','--pull','flag:\'wx\'','owner!==resourceNonce'])assert.ok(source.includes(literal),literal);
  assert.ok(source.indexOf('authenticateArchive(archive')<source.indexOf("'isolated_restore'"));
  assert.ok(source.includes('savedRecoveryKeyVerified'));assert.ok(source.includes('const recovered=await savedCatalogue'));
  assert.ok(source.includes('recovered.memberships'));assert.ok(source.includes('recovered.defaultPrivileges'));
  assert.ok(!/PGPASSWORD|process\.env\.[A-Z_]*PASSWORD|--db-url|\.env\.local|console\.error/.test(source));
  for(const literal of ['ConvertTo-SecureString','SecureStringToBSTR','ZeroFreeBSTR','RedirectStandardInput=$true',
    'CreateNoWindow=$true','ExecuteApprovedBackup','GetAccessRules','InheritanceFlags','KEY_DPAPI_ROUNDTRIP_FAILED'])assert.ok(parent.includes(literal),literal);
  assert.ok(!/Write-Output.*backupPlainPassword|ArgumentList.Add\(.*backupPlainPassword|Set-Acl|ExecutionPolicy|Remove-Item/.test(parent));
});
