import type {UnifiedActionState,UnifiedWorkspace} from '../../src/integrations/shopify/unified-contract';
import type {ShopifyDraftActionState} from '../../src/integrations/shopify/draft-setup';
export const fictionalId=(n:number)=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
let workspace:UnifiedWorkspace={connection:{id:fictionalId(1),shopGid:'gid://shopify/Shop/1',status:'verified',revision:1,
  ready:true,unified:false,automatic:false,pilotOrderGid:null,pending:0,needsAttention:0}};
let imported=false,version=0;
export function initialWorkspace(){return structuredClone(workspace);}
export async function shopifyUnifiedAction(_state:UnifiedActionState,form:FormData):Promise<UnifiedActionState>{
  await new Promise(resolve=>setTimeout(resolve,100));
  const c=JSON.parse(String(form.get('command'))),connection=workspace.connection!;
  if(c.action==='enable')connection.unified=true;
  if(c.action==='automatic')connection.automatic=c.enabled;
  if(c.action==='preview')return {status:'success',message:'Fictional preview ready.',view:structuredClone(workspace),preview:{previewId:fictionalId(4),
    expiresAt:'2026-10-19T13:00:00Z',complete:true,from:c.from,through:c.through,rows:[
      {orderGid:'gid://shopify/Order/11',reference:'PT-101',amount:'3902.20',currency:'INR',financialStatus:'PAID',status:imported?'already_imported':'new',orderIds:imported?[fictionalId(11)]:[]},
      {orderGid:'gid://shopify/Order/12',reference:'PT-102',amount:'1500.00',currency:'INR',financialStatus:'PENDING',status:'reference_match',orderIds:[fictionalId(12)]},
      {orderGid:'gid://shopify/Order/13',reference:'PT-103',amount:'2500.00',currency:'INR',financialStatus:'PAID',status:'conflict',orderIds:[]},
    ]}};
  if(c.action==='import'){connection.pending=1;return {status:'success',message:'One fictional order queued; existing orders skipped.',view:structuredClone(workspace),
    receipt:{status:'queued',previewId:fictionalId(4),rows:[]},continueProcessing:true};}
  if(c.action==='process'){connection.pending=0;imported=true;}
  workspace={connection};
  return {status:'success',message:c.action==='process'?'Import finished. Open Orders to complete the draft.':'Fictional setup saved.',view:structuredClone(workspace)};
}
export async function shopifyDraftSetupAction(_state:ShopifyDraftActionState,form:FormData):Promise<ShopifyDraftActionState>{
  await new Promise(resolve=>setTimeout(resolve,100));
  const c=JSON.parse(String(form.get('command')));
  if(c.choices?.note==='simulate network error')throw new Error('Fictional interrupted connection');
  if(form.get('action')==='complete')return {status:'complete',message:'Setup complete. Fictional Pant workflow started.',orderId:c.orderId};
  return {status:'saved',message:'Draft saved. No workflow has started.',version:++version,setupId:fictionalId(9)};
}
export async function searchShopifySetupOptions(input:{kind:string;search:string;offset:number}){
  return {status:'success' as const,rows:[{id:fictionalId(20),name:`Fictional ${input.search||'additional choice'}`}],hasMore:false};
}
