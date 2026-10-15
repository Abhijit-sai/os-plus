import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
const script=fileURLToPath(new URL('./prepare-shopify-private-backup-access.ps1',import.meta.url));
test('a child process with an unsafe nonexistent local-folder override fails before password or writes',()=>{
  const unsafeRoot=fileURLToPath(new URL('../.tmp-unsafe-private-fixture-not-created',import.meta.url));
  const result=spawnSync('pwsh',['-NoProfile','-File',script,'-DatabaseHost','db.abcdefghijklmnopqrst.supabase.co','-ValidateOnly'],
    {encoding:'utf8',windowsHide:true,timeout:10000,env:{...process.env,LOCALAPPDATA:unsafeRoot}});
  assert.notEqual(result.status,0,'Unsafe Git/OneDrive child destination must be rejected');
  assert.ok(!result.stdout.includes('Enter the EXISTING'));
});
test('private setup validates synthetic host without prompting, writing files or connecting',()=>{
  const result=spawnSync('pwsh',['-NoProfile','-File',script,'-DatabaseHost','db.abcdefghijklmnopqrst.supabase.co','-ValidateOnly'],
    {encoding:'utf8',windowsHide:true,timeout:10000});
  assert.equal(result.status,0,result.stderr);
  const state=JSON.parse(result.stdout);assert.equal(state.networkRequests,0);assert.equal(state.filesWritten,0);assert.equal(state.passwordRequested,false);
});
test('unreviewed hosts/ports/users and credential-leaking host strings fail before any prompt',()=>{
  for(const args of [['-DatabaseHost','localhost'],['-DatabaseHost','db.abcdefghijklmnopqrst.supabase.co.evil.test'],
    ['-DatabaseHost','https://db.abcdefghijklmnopqrst.supabase.co'],['-DatabaseHost','db.abcdefghijklmnopqrst.supabase.co','-DatabasePort','6543'],
    ['-DatabaseHost','db.abcdefghijklmnopqrst.supabase.co','-DatabaseUser','foreign']]){
    const result=spawnSync('pwsh',['-NoProfile','-File',script,...args,'-ValidateOnly'],{encoding:'utf8',windowsHide:true,timeout:10000});
    assert.notEqual(result.status,0);assert.ok(!result.stdout.includes('Enter the EXISTING'));
  }
});
test('actual setup uses hidden SecureString, DPAPI, protected local ACLs and no backup/SQL invocation',()=>{
  const source=readFileSync(script,'utf8');
  for(const check of ['-AsSecureString','ConvertFrom-SecureString','SetAccessRuleProtection($true,$false)',
    '$env:LOCALAPPDATA','ReparsePoint','FileMode]::CreateNew','passwordDpapi','GetAccessRules'])assert.ok(source.includes(check),check);
  assert.ok(!/ExecutionPolicy\s+Bypass|PGPASSWORD|postgresql:\/\/|Invoke-WebRequest|Start-Process|Remove-Item|ConvertTo-SecureString.*AsPlainText/.test(source));
});
