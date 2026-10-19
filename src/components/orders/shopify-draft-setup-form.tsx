"use client";
import { useActionState, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { shopifyDraftSetupMissing, type ShopifyDraftSetup, type ShopifyDraftSetupView, type ShopifyDraftActionState } from "@/integrations/shopify/draft-setup";

type Option={id:string;name:string;itemTypeId?:string|null};
type SearchOptions=(input:{orderId:string;kind:"customers"|"itemTypes"|"workflows"|"sizes";search:string;offset:number})=>Promise<{status:"error";message:string}|{status:"success";rows:Option[];hasMore:boolean}>;
const field="min-h-11 w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring";
// Search is paged and tenant-scoped on the server; no hidden first-100 ceiling.
function Choice({label,kind,orderId,value,onChange,initial,itemTypeId,disabled,searchOptions}:{label:string;kind:"customers"|"itemTypes"|"workflows"|"sizes";
  orderId:string;value:string|null;onChange:(id:string|null)=>void;initial:Option[];itemTypeId?:string|null;disabled:boolean;searchOptions:SearchOptions}){
  const id=useId(),[search,setSearch]=useState(""),[options,setOptions]=useState(initial),[offset,setOffset]=useState(0),
    [hasMore,setHasMore]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState("");
  const selected=options.find(x=>x.id===value)??initial.find(x=>x.id===value);
  const compatible=(x:Option)=>kind==="workflows"?(!x.itemTypeId||x.itemTypeId===itemTypeId):kind==="sizes"?x.itemTypeId===itemTypeId:true;
  const visible=options.filter(compatible);
  if(selected&&!visible.some(x=>x.id===selected.id))visible.unshift(selected);
  async function find(next=0){setLoading(true);setError("");try{
    const result=await searchOptions({orderId,kind,search,offset:next});
    if(result.status==="error"){setError(result.message);return;}
    setOptions(result.rows);setHasMore(result.hasMore);setOffset(next);
  }catch{setError("Search could not be completed. Retry shortly.");}finally{setLoading(false);}}
  return <div className="space-y-2"><label htmlFor={id} className="text-sm font-medium">{label}</label>
    <select id={id} value={value??""} disabled={disabled||loading} onChange={e=>onChange(e.target.value||null)} className={field}>
      <option value="">Not assigned</option>{value&&!selected&&<option value={value}>Saved selection — search to change</option>}
      {visible.map(x=><option value={x.id} key={x.id}>{x.name}</option>)}</select>
    <details><summary className="cursor-pointer py-2 text-sm">Find another {label.toLowerCase()}</summary>
      <div className="flex flex-wrap gap-2"><label className="flex-1 text-sm">Search name<input className={field} value={search} maxLength={100} disabled={disabled||loading}
        onChange={e=>setSearch(e.target.value)}/></label><Button type="button" variant="outline" disabled={disabled||loading} onClick={()=>find()}>Search</Button></div>
      {error&&<p role="alert" className="mt-2 text-sm">{error}</p>}
      <div className="mt-2 flex flex-wrap gap-2">{offset>0&&<Button type="button" variant="outline" disabled={disabled||loading} onClick={()=>find(offset-50)}>Previous results</Button>}
        {hasMore&&offset<10000&&<Button type="button" variant="outline" disabled={disabled||loading} onClick={()=>find(offset+50)}>More results</Button>}</div>
      {hasMore&&offset>=10000&&<p>Narrow the search to see remaining matches.</p>}
      <p role="status" className="text-sm">{loading?"Searching…":`${visible.length} choices shown. Workflow and size choices match the garment type.`}</p>
    </details></div>;
}

export function ShopifyDraftSetupForm({view,lines,submitAction,searchOptions}:{view:ShopifyDraftSetupView;lines:Array<{id:string;title:string;variant:string|null;quantity:number}>;
  submitAction:(state:ShopifyDraftActionState,form:FormData)=>Promise<ShopifyDraftActionState>;searchOptions:SearchOptions}){
  const router=useRouter();
  const deliveryId=useId();
  const initial:ShopifyDraftSetup={customerId:view.choices?.customerId??view.customerId,deliveryType:view.choices?.deliveryType??null,
    promisedDeliveryDate:view.choices?.promisedDeliveryDate??null,note:view.choices?.note??"",lines:lines.map(line=>{
      const saved=view.choices?.lines.find(x=>x.lineGid===line.id);
      return saved??{lineGid:line.id,itemTypeId:null,workflowId:null,standardSizeId:null,expectedCompletionDate:null};})};
  const [choices,setChoices]=useState(initial),[version,setVersion]=useState(view.version),[setupId,setSetupId]=useState(view.current?view.setupId:null),
    [saved,setSaved]=useState(view.current&&view.setupId?JSON.stringify(initial):"");
  const intentRef=useRef<{intent:string;key:string}|null>(null);
  const [state,action,pending]=useActionState(async(previous:ShopifyDraftActionState,form:FormData)=>{
    const operation=form.get("action"),body=operation==="complete"?{orderId:view.orderId,connectionId:view.connectionId,setupId}:
      {orderId:view.orderId,sourceRevisionId:view.sourceRevisionId,expectedVersion:version,choices};
    const intent=JSON.stringify([operation,body]);
    if(intentRef.current?.intent!==intent)intentRef.current={intent,key:crypto.randomUUID()};
    const payload=new FormData();payload.set("action",String(operation));payload.set("command",JSON.stringify({...body,requestKey:intentRef.current.key}));
    let result:ShopifyDraftActionState;
    try{result=await submitAction(previous,payload);}
    catch{return {status:"error" as const,message:"Could not confirm the result. Retry the same action; your choices are preserved."};}
    if(result.status==="saved"&&result.setupId&&result.version){setVersion(result.version);setSetupId(result.setupId);setSaved(JSON.stringify(choices));intentRef.current=null;}
    if(result.status==="complete")router.refresh();
    return result;
  },{status:"idle",message:""});
  const dirty=saved!==JSON.stringify(choices),missing=shopifyDraftSetupMissing(choices);
  function lineChange(index:number,patch:Partial<ShopifyDraftSetup["lines"][number]>){setChoices(c=>({...c,lines:c.lines.map((x,i)=>i===index?{...x,...patch}:x)}));}
  const disabled=pending||state.status==="complete";
  return <Card><CardHeader><CardTitle>Finish order setup</CardTitle>
    <p className="text-sm text-muted-foreground">This order is already in Orders. Save unfinished choices as a draft, or complete setup to create its production workflow. No variant mapping is required.</p></CardHeader>
    <CardContent><form action={action} onReset={event=>event.preventDefault()} className="space-y-5" aria-busy={pending}>
      {!view.current&&<p role="status">Shopify changed after the last saved setup. Review the latest items below before saving again.</p>}
      <fieldset disabled={disabled} className="grid min-w-0 gap-5 sm:grid-cols-2">
        <legend className="sr-only">Customer and delivery</legend>
        <Choice searchOptions={searchOptions} label="Customer" kind="customers" orderId={view.orderId} value={choices.customerId} onChange={customerId=>setChoices(c=>({...c,customerId}))} initial={view.customers} disabled={disabled}/>
        <div className="space-y-2 text-sm font-medium"><label htmlFor={deliveryId}>Delivery</label><select id={deliveryId} className={field} value={choices.deliveryType??""} onChange={e=>setChoices(c=>({...c,deliveryType:e.target.value as ShopifyDraftSetup["deliveryType"]||null}))}>
          <option value="">Not assigned</option><option value="store_pickup">Store pickup</option><option value="self_delivery">Self delivery</option><option value="courier">Courier</option></select></div>
        <label className="space-y-2 text-sm font-medium">Promised delivery date (optional)<input className={field} type="date" value={choices.promisedDeliveryDate??""} onChange={e=>setChoices(c=>({...c,promisedDeliveryDate:e.target.value||null}))}/></label>
      </fieldset>
      {choices.lines.map((line,index)=><fieldset key={line.lineGid} disabled={disabled} className="grid min-w-0 gap-4 rounded-lg border p-4 sm:grid-cols-2">
        <legend className="max-w-full break-words px-2 font-medium">{lines[index].title} × {lines[index].quantity}</legend>
        <p className="text-sm text-muted-foreground sm:col-span-2">{lines[index].variant}</p>
        <Choice searchOptions={searchOptions} label="Garment type" kind="itemTypes" orderId={view.orderId} value={line.itemTypeId} onChange={itemTypeId=>lineChange(index,{itemTypeId,workflowId:null,standardSizeId:null})} initial={view.itemTypes} disabled={disabled}/>
        <Choice searchOptions={searchOptions} label="Workflow" kind="workflows" orderId={view.orderId} value={line.workflowId} onChange={workflowId=>lineChange(index,{workflowId})} initial={view.workflows} itemTypeId={line.itemTypeId} disabled={disabled||!line.itemTypeId}/>
        <Choice searchOptions={searchOptions} label="Standard size (optional)" kind="sizes" orderId={view.orderId} value={line.standardSizeId} onChange={standardSizeId=>lineChange(index,{standardSizeId})} initial={view.sizes} itemTypeId={line.itemTypeId} disabled={disabled||!line.itemTypeId}/>
        <label className="space-y-2 text-sm font-medium">Expected completion date (optional)<input type="date" className={field} value={line.expectedCompletionDate??""} onChange={e=>lineChange(index,{expectedCompletionDate:e.target.value||null})}/></label>
      </fieldset>)}
      <label className="block space-y-2 text-sm font-medium">Team setup note (optional)<textarea className={field} maxLength={1000} disabled={disabled} value={choices.note} onChange={e=>setChoices(c=>({...c,note:e.target.value}))}/></label>
      {state.message&&<p role={state.status==="error"?"alert":"status"} className="rounded-md border p-3 text-sm">{state.message}</p>}
      {missing.length>0&&<p className="text-sm text-muted-foreground">Before completing: {missing.join(" · ")}.</p>}
      {!missing.length&&dirty&&<p className="text-sm">Save your current choices before completing setup.</p>}
      <div className="flex flex-wrap gap-3"><Button type="submit" name="action" value="save" variant="outline" disabled={disabled}>{pending?"Saving…":"Save draft"}</Button>
        <Button type="submit" name="action" value="complete" disabled={disabled||dirty||!setupId||missing.length>0}>Complete setup</Button></div>
      <p className="text-sm text-muted-foreground">Complete setup rechecks Shopify before starting work. It does not create a payment receipt or send a customer message.</p>
    </form></CardContent></Card>;
}
