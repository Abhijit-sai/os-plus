// Exact random resource names plus ownership checks; never prune Docker state.
export async function cleanupOwned({docker,names,label,nonce}){
  const failures=[];
  for(const name of [names.api,names.db]){
    try{
      const owned=await docker('inspect','--format',`{{index .Config.Labels "${label}"}}`,name);
      if(owned!==nonce)throw new Error('ownership mismatch');
      await docker('stop','--time','5',name);
    }catch(error){
      if(!/No such (object|container)/i.test(error.message))failures.push({name,message:error.message});
    }
  }
  try{
    const owned=await docker('network','inspect','--format',`{{index .Labels "${label}"}}`,names.network);
    if(owned!==nonce)throw new Error('ownership mismatch');
    await docker('network','rm',names.network);
  }catch(error){
    if(!/not found/i.test(error.message))failures.push({name:names.network,message:error.message});
  }
  return failures;
}

export function cleanupSummary(failures){
  return failures.length
    ? `Cleanup incomplete; remaining/unverified targets: ${failures.map(row=>row.name).join(', ')}. No cleanup success claimed.`
    : 'Owned disposable containers/network removed; synthetic database was memory-backed, no host business data removed';
}
