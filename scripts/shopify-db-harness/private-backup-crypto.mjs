import { createCipheriv,createDecipheriv,randomBytes } from 'node:crypto';
import { createReadStream,createWriteStream } from 'node:fs';
import { stat,open } from 'node:fs/promises';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export const maximumPlaintext=268435456;
export function limitTransform(max){
  let total=0;
  return new Transform({transform(chunk,encoding,callback){total+=chunk.length;callback(total>max?new Error('ARCHIVE_LIMIT'):null,chunk);}});
}
export async function encryptStream(readable,destination,aad,key,signal){
  if(key.length!==32)throw new Error('KEY_LENGTH_INVALID');
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
  cipher.setAAD(aad);
  const output=createWriteStream(destination,{flags:'wx',mode:0o600});
  output.write(aad);output.write(iv);
  await pipeline(readable,limitTransform(maximumPlaintext),cipher,output,{signal});
  const handle=await open(destination,'a');
  try{await handle.write(cipher.getAuthTag());await handle.sync();}finally{await handle.close();}
}
export async function decryptStream(file,aad,key){
  const size=(await stat(file)).size;
  if(size<aad.length+28||size>maximumPlaintext+4096)throw new Error('ARCHIVE_FORMAT_INVALID');
  const handle=await open(file,'r');
  const header=Buffer.alloc(aad.length+12),tag=Buffer.alloc(16);
  try{await handle.read(header,0,header.length,0);await handle.read(tag,0,16,size-16);}finally{await handle.close();}
  if(!header.subarray(0,aad.length).equals(aad))throw new Error('ARCHIVE_HEADER_INVALID');
  const decipher=createDecipheriv('aes-256-gcm',key,header.subarray(aad.length));
  decipher.setAAD(aad);decipher.setAuthTag(tag);
  return {input:createReadStream(file,{start:header.length,end:size-17}),decipher};
}
// Must finish this pass before plaintext is ever consumed by a restore process.
export async function authenticateArchive(file,aad,key,signal){
  let bytes=0;const decrypted=await decryptStream(file,aad,key);
  await pipeline(decrypted.input,decrypted.decipher,new Transform({transform(chunk,encoding,callback){bytes+=chunk.length;callback();}}),{signal});
  return bytes;
}
