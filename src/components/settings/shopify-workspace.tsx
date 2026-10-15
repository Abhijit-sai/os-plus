"use client";
import { startTransition,useActionState,useEffect,useId,useRef,useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { ShopifyApplicationView } from "@/integrations/shopify/application-view";
import type { ShopifyApplicationActionState } from "@/integrations/shopify/application-contract";
import { shopifyPilotTime } from "@/integrations/shopify/application-display";

type Action=(state:ShopifyApplicationActionState,form:FormData)=>Promise<ShopifyApplicationActionState>;
const inputClass="mt-1 min-h-11 w-full min-w-0 rounded-md border bg-background px-3 py-2 text-base sm:text-sm";
const sectionClass="rounded-lg border bg-card p-4 sm:p-6";
const text=(form:FormData,key:string)=>String(form.get(key)??"").trim();
function Field({label,name,defaultValue="",type="text",required=false,placeholder}: {label:string;name:string;defaultValue?:string;type?:string;required?:boolean;placeholder?:string}){
  return <label className="block min-w-0 text-sm font-medium">{label}<input className={inputClass} name={name} type={type} defaultValue={defaultValue} required={required} placeholder={placeholder}/></label>;
}
function Select({label,name,options,value="",required=false}:{label:string;name:string;options:{id:string;name:string}[];value?:string;required?:boolean}){
  return <label className="block min-w-0 text-sm font-medium">{label}<select className={inputClass} name={name} defaultValue={value} required={required}>
    <option value="">Choose {label.toLowerCase()}</option>{options.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}
  </select></label>;
}
function Command({action,build,children,label,disabled=false,confirm,onSuccess,onPendingChange}: {action:Action;build:(form:FormData)=>Record<string,unknown>;children?:React.ReactNode;label:string;disabled?:boolean;confirm?:string;onSuccess?:()=>void;onPendingChange?:(pending:boolean)=>void}){
  const router=useRouter(),feedbackId=useId();
  const intent=useRef<{serialized:string;key:string}|null>(null);
  const formRef=useRef<HTMLFormElement>(null);
  const [state,dispatch,pending]=useActionState(async(previous:ShopifyApplicationActionState,form:FormData)=>{
    const value=build(form),serialized=JSON.stringify(value);
    if(intent.current?.serialized!==serialized)intent.current={serialized,key:crypto.randomUUID()};
    const payload=new FormData();payload.set("command",JSON.stringify({...value,requestKey:intent.current.key}));
    let next:ShopifyApplicationActionState;
    try{next=await action(previous,payload);}catch{next={status:"error",message:"Completion could not be confirmed. Keep these choices and retry safely."};}
    if(next.status==="success"){intent.current=null;if(formRef.current)delete formRef.current.dataset.unsavedDirty;onSuccess?.();router.refresh();}return next;
  },{status:"idle",message:""});
  useEffect(()=>{onPendingChange?.(pending);},[pending,onPendingChange]);
  // Keep uncontrolled inputs and the exact retry key after returned failures.
  // Native form-action reset would otherwise erase the operator's review.
  return <form ref={formRef} data-unsaved-guard="true" data-preserve-dirty-on-submit="true" className="space-y-4" onInvalidCapture={event=>{let node=(event.target as HTMLElement).parentElement;while(node){if(node instanceof HTMLDetailsElement)node.open=true;node=node.parentElement;}}} onSubmit={event=>{event.preventDefault();if(pending||disabled)return;
    if(confirm&&!window.confirm(confirm))return;const form=new FormData(event.currentTarget);startTransition(()=>dispatch(form));}} aria-describedby={state.message?feedbackId:undefined}>
    <fieldset disabled={pending||disabled} className="min-w-0 space-y-4">{children}<Button type="submit" disabled={pending||disabled} className="min-h-11">{pending?"Working…":label}</Button></fieldset>
    {state.message&&<div id={feedbackId} role={state.status==="error"?"alert":"status"} className="rounded-md border p-3 text-sm">{state.message}
      {state.orderId&&<Link className="ml-2 underline" href={`/orders/${state.orderId}`}>Open order</Link>}</div>}
  </form>;
}
type Mapping=ShopifyApplicationView["mappings"][number];
function MappingEditor({view,action,mapping,variantGid,sku}: {view:ShopifyApplicationView;action:Action;mapping?:Mapping;variantGid?:string;sku?:string|null}){
  const [classification,setClassification]=useState(mapping?.classification??"production"),[itemType,setItemType]=useState(mapping?.itemTypeId??"");
  const [open,setOpen]=useState(false),[busy,setBusy]=useState(false);
  return <Dialog title={mapping?"Edit variant mapping":"Add variant mapping"} description="Match an exact Shopify variant. Prices and quantities always come from Shopify."
    open={open} preventClose={busy} onOpenChange={value=>{setOpen(value);if(!value){setClassification(mapping?.classification??"production");setItemType(mapping?.itemTypeId??"");}}}
    trigger={<span className="inline-flex min-h-11 items-center rounded-md border px-3 py-2 text-sm">{mapping?"Edit mapping":"Add mapping"}</span>}>
    <Command action={action} onPendingChange={setBusy} onSuccess={()=>{setOpen(false);setClassification(mapping?.classification??"production");setItemType(mapping?.itemTypeId??"");}} label="Save mapping" build={form=>({action:"save_mapping",connectionId:view.connection!.id,input:{
      mappingId:mapping?.id??null,expectedRevision:mapping?.revision??0,variantGid:text(form,"variant"),sku:text(form,"sku")||null,classification,
      itemTypeId:classification==="production"?itemType:null,workflowId:classification==="production"?text(form,"workflow"):null,
      standardSizeId:classification==="production"?text(form,"size")||null:null,isActive:form.has("active"),reason:text(form,"reason")}})}>
      <Field label="Shopify variant GID" name="variant" defaultValue={mapping?.variantGid??variantGid} required placeholder="gid://shopify/ProductVariant/…"/>
      <Field label="Exact SKU, if present" name="sku" defaultValue={mapping?.sku??sku??""}/>
      <label className="block text-sm font-medium">Classification<select className={inputClass} value={classification} onChange={e=>setClassification(e.target.value as "production"|"nonproduction")}>
        <option value="production">Production item</option><option value="nonproduction">Non-production line</option></select></label>
      {classification==="production"&&<>
        <label className="block text-sm font-medium">Item type<select className={inputClass} required value={itemType} onChange={e=>setItemType(e.target.value)}>
          <option value="">Choose item type</option>{view.itemTypes.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
        <Select key={itemType+"workflow"} label="Workflow" name="workflow" required value={mapping?.itemTypeId===itemType?mapping.workflowId??"":""}
          options={view.workflows.filter(w=>w.itemTypeId===null||w.itemTypeId===itemType)}/>
        <Select key={itemType+"size"} label="Standard size (optional)" name="size" value={mapping?.standardSizeId??""} options={view.sizes.filter(s=>s.itemTypeId===itemType)}/>
      </>}
      <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={mapping?.isActive??true}/>Active mapping</label>
      <Field label="Reason for this mapping" name="reason" required/>
    </Command>
  </Dialog>;
}
function SourceReview({view,source,action}:{view:ShopifyApplicationView;source:ShopifyApplicationView["sources"][number];action:Action}){
  const c=view.connection!,canWork=view.policy?.active&&c.status==="verified"&&c.processingEnabled;
  const ready=source.sourceStatus==="complete"&&source.lines.length>0;
  const defaultCustomer=source.review?.decision.customerId??source.customerId??"";
  const customerOptions=view.customers.some(c=>c.id===defaultCustomer)||!defaultCustomer?view.customers:[{id:defaultCustomer,name:"Current linked customer"},...view.customers];
  return <article className="border-t py-5 first:border-t-0 first:pt-0">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{source.number}</h3>
      <p className="break-all text-sm text-muted-foreground">{source.orderGid}</p><p className="mt-1 text-sm">{source.orderStatus==="draft"?"Draft, not in production":source.orderStatus} · Source {source.sourceStatus}</p></div>
      <Link className="min-h-11 rounded-md border px-3 py-2 text-sm underline" href={`/orders/${source.orderId}`}>Order details</Link></div>
    {!!source.reviewReasons.length&&<p className="mt-3 break-words rounded-md bg-muted p-3 text-sm">Review: {source.reviewReasons.join(", ").replaceAll("_"," ").toLowerCase()}</p>}
    {source.state?.held&&<div className="mt-3 rounded-md border border-destructive p-3 text-sm"><p className="font-medium">Production held</p>
      <p>{source.state.reasons.join(", ").replaceAll("_"," ").toLowerCase()}</p>
      {source.state.latest_case_id&&<details className="mt-3"><summary className="cursor-pointer py-2 font-medium">Review source change</summary>
        <Command action={action} label="Record source decision" disabled={!canWork} confirm="This records your decision about changed Shopify facts. It does not rewrite existing production or payments."
          build={form=>({action:"review_change",connectionId:c.id,sourceOrderId:source.id,caseId:source.state!.latest_case_id,decision:text(form,"decision"),reason:text(form,"reason")})}>
          <Select label="Decision" name="decision" required options={[{id:"keep_on_hold",name:"Keep production on hold"},{id:"keep_os_plus_continue",name:"Keep existing OS Plus work and continue"}]}/>
          <Field label="Reason" name="reason" required/>
        </Command></details>}
    </div>}
    {source.payment&&<div className="mt-4 rounded-md bg-muted p-3 text-sm"><p className="font-medium">Shopify payment: {source.payment.statusLabel}</p>
      <p>{source.payment.currency} {source.payment.amounts.total} total · {source.payment.amounts.received} received · {source.payment.amounts.outstanding} outstanding</p>
      <p className="mt-1 text-muted-foreground">Source facts only. No OS Plus receipt, GST posting or message is created.</p></div>}
    <div className="mt-4 space-y-2">{source.lines.map(line=>{const mapping=view.mappings.find(m=>m.variantGid===line.variantGid);return <div key={line.id} className="flex flex-wrap items-center justify-between gap-3 border-b py-3">
      <div className="min-w-0 flex-1"><p className="font-medium">{line.title} <span className="text-muted-foreground">× {line.quantity}</span></p>
        <p className="break-words text-sm text-muted-foreground">{[line.sku,line.colour,line.size].filter(Boolean).join(" · ")||"No SKU, colour or size"}</p>
        <p className="text-sm">{mapping?.isActive?"Mapped":"Needs mapping"}{!line.variantGid?" · Custom/deleted variant requires manual review":""}</p></div>
      {line.variantGid&&<MappingEditor view={view} action={action} mapping={mapping} variantGid={line.variantGid} sku={line.sku}/>}</div>;})}</div>
    {source.orderStatus==="draft"&&<details className="mt-4" open={ready}><summary className="min-h-11 cursor-pointer py-2 font-medium">Review customer, delivery and items</summary>
      <p className="mb-4 text-sm text-muted-foreground">{source.customerName?`Shopify name: ${source.customerName}. `:""}Choose the correct local customer. Search all customers with the name filter above. No existing customer profile is overwritten.</p>
      <Command action={action} label="Save review" disabled={!canWork||!ready}
        build={form=>({action:"save_review",connectionId:c.id,sourceOrderId:source.id,sourceRevisionId:source.revisionId,expectedVersion:source.review?.version??0,
          decision:{customerId:text(form,"customer"),deliveryType:text(form,"delivery"),promisedDeliveryDate:text(form,"promised")||null,reason:text(form,"reason"),
            lines:source.lines.map((line,index)=>{const mapping=view.mappings.find(m=>m.id===text(form,`mapping-${index}`));return {
              lineGid:line.id,mappingId:mapping?.id??"",mappingRevision:mapping?.revision??0,
              ...(text(form,`name-${index}`)?{nameOverride:text(form,`name-${index}`)}:{}),...(text(form,`colour-${index}`)?{colourOverride:text(form,`colour-${index}`)}:{}),
              sizeAcknowledged:form.has(`size-${index}`),skuChangeAcknowledged:form.has(`sku-${index}`),expectedCompletionDate:text(form,`date-${index}`)||null};})}})}>
        <div className="grid min-w-0 gap-4 sm:grid-cols-2"><Select label="Customer" name="customer" options={customerOptions} value={defaultCustomer} required/>
          <Select label="Delivery" name="delivery" required value={source.review?.decision.deliveryType??""} options={[{id:"store_pickup",name:"Store pickup"},{id:"self_delivery",name:"Self delivery"},{id:"courier",name:"Courier"}]}/>
          <Field label="Promised delivery date (optional)" name="promised" type="date" defaultValue={source.review?.decision.promisedDeliveryDate??""}/></div>
        {source.lines.map((line,index)=>{const saved=source.review?.decision.lines.find(l=>l.lineGid===line.id),mapping=view.mappings.find(m=>m.variantGid===line.variantGid&&m.isActive);return <details key={line.id} className="border-b pb-3">
          <summary className="cursor-pointer py-2 text-sm font-medium">{line.title}: mapping and optional corrections</summary><div className="grid gap-4 pt-2 sm:grid-cols-2">
            <Select label="Exact variant mapping" name={`mapping-${index}`} required value={saved?.mappingId??mapping?.id??""} options={view.mappings.filter(m=>m.isActive&&m.variantGid===line.variantGid).map(m=>({id:m.id,name:`${view.itemTypes.find(i=>i.id===m.itemTypeId)?.name??"Non-production"} · v${m.revision}`}))}/>
            <Field label="Item name override (optional)" name={`name-${index}`} defaultValue={saved?.nameOverride??""}/>
            <Field label="Colour override (optional)" name={`colour-${index}`} defaultValue={saved?.colourOverride??""}/>
            <Field label="Expected completion (optional)" name={`date-${index}`} type="date" defaultValue={saved?.expectedCompletionDate??""}/>
            <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name={`size-${index}`} defaultChecked={saved?.sizeAcknowledged}/>I checked the source size</label>
            <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name={`sku-${index}`} defaultChecked={saved?.skuChangeAcknowledged}/>I checked any changed SKU</label>
          </div></details>;})}
        <Field label="Review note" name="reason" required defaultValue={source.review?.decision.reason??""}/>
      </Command>
    </details>}
    {source.orderStatus==="draft"&&source.review&&<div className="mt-5 border-t pt-4"><Command action={action} label="Release reviewed items" disabled={!canWork||!c.releaseEnabled||!source.review.current||!ready}
      confirm="Release this reviewed draft into the Test tenant's production workflow? No worker assignment, payment or message is created."
      build={()=>({action:"release",connectionId:c.id,sourceOrderId:source.id,reviewId:source.review!.id})}>
      <p className="text-sm text-muted-foreground">Review v{source.review.version}{source.review.current?" matches the current source.":" is stale. Save a new review."} Shopify is rechecked before release.</p>
    </Command></div>}
  </article>;
}
export function ShopifyWorkspace({view,action}:{view:ShopifyApplicationView;action:Action}){
  const [tab,setTab]=useState<"setup"|"inbox"|"mappings"|"activity">(view.sources.length?"inbox":"setup");
  const c=view.connection,scope={connectionId:c?.id},active=!!view.policy?.active&&c?.status==="verified"&&c.processingEnabled;
  return <div className="min-w-0 space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-2xl font-semibold tracking-tight">Shopify</h2>
      <p className="mt-1 break-all text-sm text-muted-foreground">{view.shopDomain} · Test tenant pilot · API 2026-10</p></div><Link href="/settings" className="min-h-11 rounded-md border px-3 py-2 text-sm">Back to settings</Link></div>
    <p className="rounded-md bg-muted p-3 text-sm">One approved existing Shopify order only. Other store orders are excluded. Messages and local financial posting stay off.</p>
    <nav aria-label="Shopify workspace" className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">{(["setup","inbox","mappings","activity"] as const).map(t=><Button key={t} variant={tab===t?"default":"outline"} className="min-h-11" aria-current={tab===t?"page":undefined} onClick={()=>setTab(t)}>{({setup:"Setup",inbox:"Order inbox",mappings:"Variant mappings",activity:"Health & privacy"})[t]}</Button>)}</nav>
    <section hidden={tab!=="setup"} className={sectionClass}><h3 className="mb-2 text-lg font-semibold">Connect, then approve a Test copy</h3>
      {!c?<Command action={action} label="Connect configured store" build={form=>({action:"connect",cutoff:new Date(text(form,"cutoff")).toISOString()})}>
        <p className="text-sm text-muted-foreground">Checks installed app identity and permissions. This step does not import orders.</p>
        <Field label="Import orders created after" name="cutoff" type="datetime-local" required/>
        <p className="text-sm text-muted-foreground">Choose a cutoff within the last seven days. It is fixed for this connection.</p>
      </Command>:<div className="space-y-5"><p className="text-sm">Connection: <strong>{c.status}</strong> · v{c.revision}. Cutoff: {shopifyPilotTime(c.cutoff)}</p>
        {!view.policy&&c.status!=="disconnected"&&<Command action={action} label="Verify access and approve one copy" confirm="This reads protected Shopify fields to verify access and authorizes copying this one real order into the Test tenant. Continue?"
          build={form=>({action:"authorize_copy",...scope,expectedRevision:c.revision,orderGid:text(form,"orderGid"),retentionDays:Number(text(form,"retentionDays")),reason:text(form,"reason"),consent:form.has("consent")})}>
          <Field label="Approved Shopify order GID" name="orderGid" required placeholder="gid://shopify/Order/…"/>
          <label className="block text-sm font-medium">Test source-copy retention<select className={inputClass} name="retentionDays" defaultValue="1"><option value="1">1 day</option><option value="3">3 days</option><option value="7">7 days</option></select></label>
          <Field label="Purpose and authorization note" name="reason" required/>
          <label className="flex min-h-11 items-start gap-2 text-sm"><input type="checkbox" required name="consent" className="mt-1"/>I authorize this real order&apos;s customer and order data in the Test tenant for the selected period. Business-record disposal still needs review.</label>
        </Command>}
        {view.policy&&<div className="space-y-3"><p className="break-all text-sm">Approved: {view.policy.orderGid}</p><p className="text-sm">{view.policy.active?"Expires":"Expired"}: {shopifyPilotTime(view.policy.expiresAt)}</p>
          {!view.policy.active&&<p role="alert" className="text-sm">Copy approval expired. Source viewing, processing and release are blocked. Ask the owner to review retention and disposal; no business history was deleted.</p>}
          {!view.policy.active&&<Command action={action} label="Purge expired source copies" confirm="Permanently redact expired Shopify source copies? Business records and audit history remain for a separate retention review."
            build={()=>({action:"purge_expired_source",...scope})}/>}
          <p className="text-sm text-muted-foreground">Source expiry cleanup runs on the approved worker schedule, or with the owner purge action after expiry. Approve scheduling or assign the owner cleanup task before copying real data.</p>
          {view.policy.active&&c.status==="paused"&&<Command action={action} label="Reverify and resume" build={form=>({action:"authorize_copy",...scope,expectedRevision:c.revision,
            orderGid:view.policy!.orderGid,retentionDays:1,reason:text(form,"reason"),consent:form.has("consent")})}>
            <Field label="Resume reason" name="reason" required/><label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="consent" required/>Reverify the same approved order. Keep the original expiry.</label></Command>}
          <div className="flex flex-wrap gap-3"><Command action={action} label="Copy approved order" disabled={!active} build={()=>({action:"queue_order",...scope})}/>
            <Command action={action} label="Process queued copy" disabled={!active} build={()=>({action:"run_worker",...scope})}/></div></div>}
        <details className="border-t pt-3"><summary className="cursor-pointer py-2 text-sm font-medium">Connection controls</summary><div className="flex flex-wrap gap-3 pt-3">
          {c.status!=="disconnected"&&<Command action={action} label="Pause processing" disabled={c.status!=="verified"} build={()=>({action:"connection_state",...scope,expectedRevision:c.revision,state:"pause"})}/>}
          <Command action={action} label="Disconnect" disabled={c.status==="disconnected"} confirm="Disconnect Shopify? Existing OS Plus orders and audit history are preserved."
            build={()=>({action:"connection_state",...scope,expectedRevision:c.revision,state:"disconnect"})}/></div>
          <p className="mt-2 text-sm text-muted-foreground">Resume requires a fresh store check and keeps the same order and expiry. Expiry or disconnect needs a separately approved renewal or cutover.</p></details>
      </div>}
    </section>
    <section hidden={tab!=="inbox"} className={sectionClass}><h3 className="text-lg font-semibold">Review before production</h3>
      <p className="mt-1 text-sm text-muted-foreground">Copying creates an inert draft. Map variants, choose customer and delivery, save the review, then release.</p>
      <form method="get" className="my-5 flex flex-wrap items-end gap-2"><div className="min-w-0 flex-1"><Field label="Find local customer by name" name="customerSearch" placeholder="Customer name"/></div><Button type="submit" variant="outline" className="min-h-11">Search customers</Button></form>
      {view.customersTruncated&&<p className="mb-3 text-sm text-muted-foreground">Showing the first 100 matching customers. Narrow your search to find another.</p>}
      {!view.sources.length?<p className="py-8 text-sm text-muted-foreground">No copied orders yet. Complete Setup, copy the approved order and process it.</p>:view.sources.map(s=><SourceReview key={s.id+":"+s.revisionId+":"+s.review?.version} view={view} source={s} action={action}/>)}</section>
    <section hidden={tab!=="mappings"} className={sectionClass}><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-lg font-semibold">Exact variant mappings</h3><p className="text-sm text-muted-foreground">No fuzzy SKU matches. Inactive or changed rules require review.</p></div>{c&&<MappingEditor view={view} action={action}/>}</div>
      {!view.mappings.length?<p className="py-8 text-sm text-muted-foreground">Map the copied order&apos;s variants from the inbox, or add a known exact variant here.</p>:<ul className="mt-4 divide-y">{view.mappings.map(m=><li key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div className="min-w-0"><p className="break-all text-sm font-medium">{m.sku??m.variantGid}</p><p className="text-sm text-muted-foreground">{m.classification} · {m.isActive?"Active":"Inactive"} · v{m.revision}</p></div><MappingEditor key={m.id+":"+m.revision} view={view} action={action} mapping={m}/></li>)}</ul>}</section>
    <div hidden={tab!=="activity"} className="space-y-5"><section className={sectionClass}><h3 className="text-lg font-semibold">Job health</h3><p className="mt-1 text-sm text-muted-foreground">No scheduler is enabled by this screen. Pending jobs need a manual process action until scheduling is approved.</p>
      {!view.jobs.length?<p className="py-5 text-sm">No jobs requested.</p>:view.jobs.map(job=><div key={job.id} className="space-y-2 border-t py-4"><p className="break-all text-sm">{job.orderGid}</p><p className="text-sm">{job.completed>=job.requested?"Up to date":job.deadLetteredAt?"Needs attention":"Pending"} · {job.attempts} attempts{job.error?` · ${job.error}`:""}</p>
        {job.completed<job.requested&&<Command action={action} label="Retry pending job" disabled={!active||job.leaseActive} build={form=>({action:"retry_job",...scope,jobId:job.id,reason:text(form,"reason")})}><Field label="Retry reason" name="reason" required/></Command>}</div>)}</section>
      <section className={sectionClass}><h3 className="text-lg font-semibold">Privacy requests</h3><p className="mt-1 text-sm text-muted-foreground">A receipt is not fulfilment. Source redaction does not erase customer, finance or production history. Record a separate business-retention decision.</p>
        {!view.privacy.length?<p className="py-5 text-sm">No received privacy requests.</p>:view.privacy.map(r=><details key={r.id} className="border-t py-3"><summary className="cursor-pointer py-2 text-sm font-medium">{r.topic} · Due {shopifyPilotTime(r.dueAt)}</summary>
          <p className="my-3 break-all text-sm">Request {r.id} · Business disposition pending</p>
          <a className="inline-flex min-h-11 items-center py-2 text-sm underline" href={`/api/integrations/shopify/privacy-export?request=${r.id}`}>Download owner review package</a>
          <Command action={action} label="Record privacy review note" build={form=>({action:"privacy_note",...scope,privacyRequestId:r.id,disposition:text(form,"disposition"),reason:text(form,"reason")})}>
            <Select label="Disposition" name="disposition" required options={[{id:"under_review",name:"Under review"},{id:"external_followup",name:"External follow-up required"},{id:"business_retention_review",name:"Business retention review required"}]}/><Field label="Review note" name="reason" required/></Command>
          {r.topic!=="customers/data_request"&&<div className="mt-4"><Command action={action} label="Redact source copies" confirm="Redact retained Shopify source copies for this request? This cannot be undone. Business records remain for a separate retention review."
            build={()=>({action:"redact_source",...scope,privacyRequestId:r.id})}/></div>}
        </details>)}</section>
      <section className={sectionClass}><h3 className="text-lg font-semibold">Recent owner activity</h3>{!view.history.length?<p className="py-5 text-sm">No owner actions recorded.</p>:<ol className="mt-3 divide-y">{view.history.map(a=><li key={a.id} className="py-3 text-sm"><p className="font-medium">{a.action.replaceAll("_"," ")}</p><p className="text-muted-foreground">{shopifyPilotTime(a.at)}{a.disposition?` · ${a.disposition.replaceAll("_"," ")}`:""}</p>{a.reason&&<p className="mt-1 break-words">{a.reason}</p>}</li>)}</ol>}</section>
    </div>
  </div>;
}
