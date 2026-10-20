"use client";
import { useActionState, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { shopifyDraftSetupMissing, type ShopifyDraftSetup, type ShopifyDraftSetupView, type ShopifyDraftActionState } from "@/integrations/shopify/draft-setup";
import { ShopifyImagePreview } from "@/components/orders/shopify-image-preview";
import type { ShopifyImageReference } from "@/integrations/shopify/image-reference";

type Option={id:string;name:string;itemTypeId?:string|null};
type SearchOptions=(input:{orderId:string;kind:"customers"|"itemTypes"|"workflows"|"sizes";search:string;offset:number})=>Promise<{status:"error";message:string}|{status:"success";rows:Option[];hasMore:boolean}>;
const field="min-h-11 w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring";
// Search is paged and tenant-scoped on the server; no hidden first-100 ceiling.
function Choice({label,kind,orderId,value,onChange,initial,itemTypeId,disabled,searchOptions}:{label:string;kind:"customers"|"itemTypes"|"workflows"|"sizes";
  orderId:string;value:string|null;onChange:(id:string|null)=>void;initial:Option[];itemTypeId?:string|null;disabled:boolean;searchOptions:SearchOptions}){
  const id=useId(),[search,setSearch]=useState(""),[options,setOptions]=useState(initial),[offset,setOffset]=useState(0),
    [hasMore,setHasMore]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState(""),[searched,setSearched]=useState(false);
  const [known,setKnown]=useState(()=>new Map(initial.map(option=>[option.id,option])));
  const selected=value?known.get(value):undefined;
  const compatible=(x:Option)=>kind==="workflows"?(!x.itemTypeId||x.itemTypeId===itemTypeId):kind==="sizes"?x.itemTypeId===itemTypeId:true;
  const visible=options.filter(compatible);
  if(selected&&!visible.some(x=>x.id===selected.id))visible.unshift(selected);
  async function find(next=0){setLoading(true);setError("");try{
    const result=await searchOptions({orderId,kind,search,offset:next});
    if(result.status==="error"){setError(result.message);return;}
    setKnown(previous=>new Map([...previous,...result.rows.map(option=>[option.id,option] as const)]));
    setOptions(result.rows);setHasMore(result.hasMore);setOffset(next);setSearched(true);
  }catch{setError("Search could not be completed. Retry shortly.");}finally{setLoading(false);}}
  return <div className="space-y-2"><label htmlFor={id} className="text-sm font-medium">{label}</label>
    <select id={id} value={value??""} disabled={disabled||loading} onChange={e=>onChange(e.target.value||null)} className={field}>
      <option value="">Not assigned</option>{value&&!selected&&<option value={value}>Saved selection — search to change</option>}
      {visible.map(x=><option value={x.id} key={x.id}>{x.name}</option>)}</select>
    <div className="flex gap-2">
      <label className="min-w-0 flex-1"><span className="sr-only">Search {label.toLowerCase()}</span>
        <input className={field} placeholder={`Search ${label.toLowerCase()}`} value={search} maxLength={100} disabled={disabled||loading}
          onChange={e=>setSearch(e.target.value)} onKeyDown={event=>{if(event.key==="Enter"){event.preventDefault();void find();}}}/></label>
      <Button type="button" variant="outline" className="min-h-11" aria-label={`Search ${label.toLowerCase()} choices`} disabled={disabled||loading} onClick={()=>find()}>Search</Button>
    </div>
      {error&&<p role="alert" className="mt-2 text-sm">{error}</p>}
      <div className="mt-2 flex flex-wrap gap-2">{offset>0&&<Button type="button" variant="outline" disabled={disabled||loading} onClick={()=>find(offset-50)}>Previous results</Button>}
        {hasMore&&offset<10000&&<Button type="button" variant="outline" disabled={disabled||loading} onClick={()=>find(offset+50)}>More results</Button>}</div>
      {hasMore&&offset>=10000&&<p>Narrow the search to see remaining matches.</p>}
      {(searched||loading)&&<p role="status" className="text-sm text-muted-foreground">{loading?"Searching…":`${visible.length} matching choices shown.`}</p>}
      {(kind==="workflows"||kind==="sizes")&&!itemTypeId&&<p className="text-sm text-muted-foreground">Choose a garment type first.</p>}
    </div>;
}

export function ShopifyDraftSetupForm({view,lines,submitAction,searchOptions}:{view:ShopifyDraftSetupView;lines:Array<{id:string;title:string;variant:string|null;quantity:number;
  image?:ShopifyImageReference|null;sku?:string|null;unitCurrency?:string;unitPrice?:string;currentLineSubtotal?:string;currentQuantity?:number;properties?:Array<{name:string;value:string}>}>;
  submitAction:(state:ShopifyDraftActionState,form:FormData)=>Promise<ShopifyDraftActionState>;searchOptions:SearchOptions}){
  const router=useRouter();
  const deliveryId=useId(),formId=useId();
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
  const pendingActions=[
    ...(!choices.customerId?[{target:`${formId}-customer`,label:"Choose a customer"}]:[]),
    ...(!choices.deliveryType?[{target:deliveryId,label:"Choose delivery method"}]:[]),
    ...choices.lines.flatMap((line,index)=>[
      ...(!line.itemTypeId?[{target:`${formId}-line-${index}`,label:`${lines[index].title}: choose garment type`}]:[]),
      ...(!line.workflowId?[{target:`${formId}-line-${index}`,label:`${lines[index].title}: choose workflow`}]:[]),
    ]),
  ];
  function lineChange(index:number,patch:Partial<ShopifyDraftSetup["lines"][number]>){setChoices(c=>({...c,lines:c.lines.map((x,i)=>i===index?{...x,...patch}:x)}));}
  const disabled=pending||state.status==="complete";
  return <form action={action} onReset={event=>event.preventDefault()} className="space-y-5" aria-busy={pending}>
    <Card id={`${formId}-pending`} className="scroll-mt-28"><CardHeader><CardTitle>Pending actions</CardTitle>
      <p className="text-sm text-muted-foreground">Complete the missing order and garment details below. Save at any point; this order stays a draft until you complete setup.</p>
    </CardHeader><CardContent className="space-y-4">
      {!view.current&&<p role="status">Shopify changed after the last saved setup. Review the latest items below before saving again.</p>}
      <p role="status" className="font-medium">{pendingActions.length?`${pendingActions.length} choices needed`:
        dirty?"All required details entered — save draft to continue.":"All required details saved — ready to complete setup."}</p>
      {pendingActions.length>0&&<ul className="grid gap-1 sm:grid-cols-2">{pendingActions.map((item,index)=><li key={index}>
        <a className="inline-flex min-h-11 items-center rounded-md text-sm underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
          href={`#${item.target}`} onClick={()=>document.getElementById(item.target)?.focus()}>{item.label}</a>
      </li>)}</ul>}
      {state.message&&<p role={state.status==="error"?"alert":"status"} className="rounded-md border p-3 text-sm">{state.message}</p>}
      <div className="flex flex-wrap gap-3"><Button type="submit" name="action" value="save" variant="outline" className="min-h-11" disabled={disabled}>{pending?"Working…":"Save draft"}</Button>
        <Button type="submit" name="action" value="complete" className="min-h-11" disabled={disabled||dirty||!setupId||missing.length>0}>Complete setup</Button></div>
      <p className="text-sm text-muted-foreground">Complete setup rechecks Shopify, creates the selected garment workflows and updates this same order to confirmed. It does not record a local payment or send a customer message.</p>
    </CardContent></Card>
    <Card><CardHeader><CardTitle>Order details</CardTitle></CardHeader><CardContent className="space-y-5">
      <fieldset disabled={disabled} className="grid min-w-0 gap-5 sm:grid-cols-2">
        <legend className="sr-only">Customer and delivery</legend>
        <div id={`${formId}-customer`} tabIndex={-1} className="scroll-mt-28"><Choice searchOptions={searchOptions} label="Customer" kind="customers" orderId={view.orderId} value={choices.customerId} onChange={customerId=>setChoices(c=>({...c,customerId}))} initial={view.customers} disabled={disabled}/></div>
        <div className="space-y-2 text-sm font-medium"><label htmlFor={deliveryId}>Delivery</label><select id={deliveryId} className={field} value={choices.deliveryType??""} onChange={e=>setChoices(c=>({...c,deliveryType:e.target.value as ShopifyDraftSetup["deliveryType"]||null}))}>
          <option value="">Not assigned</option><option value="store_pickup">Store pickup</option><option value="self_delivery">Self delivery</option><option value="courier">Courier</option></select></div>
        <label className="space-y-2 text-sm font-medium">Promised delivery date (optional)<input className={field} type="date" value={choices.promisedDeliveryDate??""} onChange={e=>setChoices(c=>({...c,promisedDeliveryDate:e.target.value||null}))}/></label>
      </fieldset>
      <label className="block space-y-2 text-sm font-medium">Team setup note (optional)<textarea className={field} maxLength={1000} disabled={disabled} value={choices.note} onChange={e=>setChoices(c=>({...c,note:e.target.value}))}/></label>
    </CardContent></Card>
    <Card><CardHeader><CardTitle>Garments</CardTitle>
      <p className="text-sm text-muted-foreground">Edit each garment’s production setup here. Product names, quantities and prices remain the Shopify source facts.</p>
    </CardHeader><CardContent className="space-y-5">
      {choices.lines.map((line,index)=><fieldset key={line.lineGid} id={`${formId}-line-${index}`} tabIndex={-1} disabled={disabled} className="grid min-w-0 scroll-mt-28 gap-4 rounded-lg border p-4 sm:grid-cols-2">
        <legend className="max-w-full break-words px-2 font-medium">{lines[index].title} × {lines[index].quantity}</legend>
        <div className="flex min-w-0 gap-4 sm:col-span-2">
          <ShopifyImagePreview image={lines[index].image} title={lines[index].title}/>
          <div className="min-w-0 space-y-2 break-words text-sm">
            <p className="text-muted-foreground">{[lines[index].variant,lines[index].sku].filter(Boolean).join(" · ")}</p>
            <p className="font-medium">{line.itemTypeId&&line.workflowId?"Required choices entered":"Needs garment setup"}</p>
            {lines[index].unitPrice!==undefined&&<p>Unit price · {lines[index].unitCurrency} {lines[index].unitPrice}</p>}
            {lines[index].currentLineSubtotal!==undefined&&<p>Line subtotal · {lines[index].unitCurrency} {lines[index].currentLineSubtotal} <span className="text-muted-foreground">(after discounts, before tax)</span></p>}
            {lines[index].currentQuantity!==undefined&&lines[index].currentQuantity!==lines[index].quantity&&<p>Current Shopify quantity · {lines[index].currentQuantity}</p>}
          </div>
        </div>
        {!!lines[index].properties?.length&&<dl className="grid gap-3 rounded-md bg-muted/40 p-3 text-sm sm:col-span-2 sm:grid-cols-2">
          {lines[index].properties?.map((property,i)=><div key={i} className="min-w-0 break-words"><dt className="font-medium">{property.name}</dt><dd>{property.value}</dd></div>)}</dl>}
        <Choice searchOptions={searchOptions} label="Garment type" kind="itemTypes" orderId={view.orderId} value={line.itemTypeId} onChange={itemTypeId=>lineChange(index,{itemTypeId,workflowId:null,standardSizeId:null})} initial={view.itemTypes} disabled={disabled}/>
        <Choice searchOptions={searchOptions} label="Workflow" kind="workflows" orderId={view.orderId} value={line.workflowId} onChange={workflowId=>lineChange(index,{workflowId})} initial={view.workflows} itemTypeId={line.itemTypeId} disabled={disabled||!line.itemTypeId}/>
        <Choice searchOptions={searchOptions} label="Standard size (optional)" kind="sizes" orderId={view.orderId} value={line.standardSizeId} onChange={standardSizeId=>lineChange(index,{standardSizeId})} initial={view.sizes} itemTypeId={line.itemTypeId} disabled={disabled||!line.itemTypeId}/>
        <label className="space-y-2 text-sm font-medium">Expected completion date (optional)<input type="date" className={field} value={line.expectedCompletionDate??""} onChange={e=>lineChange(index,{expectedCompletionDate:e.target.value||null})}/></label>
      </fieldset>)}
      <a href={`#${formId}-pending`} className="inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4">Back to save draft / complete setup ↑</a>
    </CardContent></Card>
  </form>;
}
