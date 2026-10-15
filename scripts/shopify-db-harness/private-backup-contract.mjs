import { X509Certificate } from 'node:crypto';
import path from 'node:path';

export const projectRef='dxiyihrdfismbuqdmhit';
export const poolerHost='aws-1-ap-northeast-2.pooler.supabase.com';
export const image='sha256:c7526c0f6c3f30260a563d7bcf8ad778effac59a44f8ffa86678c35418338609';
export const caFingerprint='80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA';
export const label='osplus.private.backup';

export function validateInput(input){
  if(['VerifyExisting','RehearseExisting'].includes(input?.mode)){
    if(input.projectRef!==projectRef||!input.approved||!path.win32.isAbsolute(input.localRoot??'')||
      input.privateRoot!==path.win32.join(input.localRoot,'OSPlusPrivateBackups')||
      /(^|[\\/])OneDrive[^\\/]*([\\/]|$)/i.test(input.privateRoot)||!/^S-1-5-21-[0-9-]+$/.test(input.ownerSid??'')||
      !/^[a-f0-9]{32}$/.test(input.nonce??'')||Buffer.from(input.key??'','base64').length!==32||
      input.password!==undefined||input.host!==undefined||input.ca!==undefined||input.user!==undefined){throw new Error('OFFLINE_BINDING_INVALID');}
    if(input.mode==='RehearseExisting'&&(input.rehearsalApproved!==true||input.nonce!=='1b2bc4faa9b34c0b8af1e5eb1e9dba5b'))throw new Error('REHEARSAL_SCOPE_INVALID');
    return input;
  }
  if(!input||!['Inspect','BackupAndVerify'].includes(input.mode)||input.projectRef!==projectRef||
    input.host!==poolerHost||input.port!==5432||input.database!=='postgres'||input.user!==`postgres.${projectRef}`||
    typeof input.password!=='string'||!input.password.length||Buffer.byteLength(input.password)>1024||/[\r\n\0]/.test(input.password)){
    throw new Error('ACCESS_BINDING_INVALID');
  }
  const cert=new X509Certificate(input.ca);
  if(!cert.ca||cert.fingerprint256!==caFingerprint||Date.parse(cert.validTo)<=Date.now()||Date.parse(cert.validFrom)>Date.now()){
    throw new Error('CA_INVALID');
  }
  const expected=path.win32.join(input.localRoot??'','OSPlusPrivateBackups');
  if(!path.win32.isAbsolute(input.localRoot??'')||!input.privateRoot||input.privateRoot!==expected||
    /(^|[\\/])OneDrive[^\\/]*([\\/]|$)/i.test(input.privateRoot)||!/^S-1-5-21-[0-9-]+$/.test(input.ownerSid??'')){
    throw new Error('PRIVATE_PATH_INVALID');
  }
  if(input.mode==='BackupAndVerify'&&(!input.approved||
    !/^[a-f0-9]{32}$/.test(input.nonce??'')||!input.key||Buffer.from(input.key,'base64').length!==32||
    typeof input.protectedKey!=='string'||!/^[a-fA-F0-9]+$/.test(input.protectedKey))){
    throw new Error('BACKUP_APPROVAL_OR_KEY_INVALID');
  }
  return input;
}

export function pgpass(input){
  validateInput(input);
  return [input.host,String(input.port),input.database,input.user,input.password]
    .map(value=>value.replaceAll('\\','\\\\').replaceAll(':','\\:')).join(':')+'\n';
}

export function identifier(value){
  if(typeof value!=='string'||value.length===0||value.length>63||value.includes('\0'))throw new Error('IDENTIFIER_INVALID');
  return '"'+value.replaceAll('"','""')+'"';
}

export function compatibleServer(version){
  const n=Number(version);
  return Number.isInteger(n)&&n>=120000&&n<180000;
}

export function archiveHeader(nonce){
  if(!/^[a-f0-9]{32}$/.test(nonce))throw new Error('RUN_ID_INVALID');
  return Buffer.from(`OSPLUS-BACKUP-V1:${projectRef}:${nonce}\n`);
}

export function assertCoverage(metadata){
  if(metadata.unsupportedRelations?.length)throw new Error('UNSUPPORTED_APPLICATION_RELATIONS');
  if(metadata.externalFks?.length)throw new Error('OUT_OF_SCOPE_SCHEMA_DEPENDENCIES');
  if(metadata.publicExtensions?.length)throw new Error('PUBLIC_EXTENSION_RESTORE_REQUIRES_REVIEW');
  if(metadata.permissionSnapshotVerified!==true)throw new Error('PERMISSION_SNAPSHOT_NOT_VERIFIED');
}
