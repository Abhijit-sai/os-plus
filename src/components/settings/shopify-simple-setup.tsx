"use client";
import Link from "next/link";
import {startTransition,useActionState,useEffect,useRef,useState} from "react";
import {Button} from "@/components/ui/button";
import {Card,CardHeader,CardTitle,CardContent} from "@/components/ui/card";
import {Dialog} from "@/components/ui/dialog";
import {importDateError,importExplanation,importLabels as labels,previewExpired} from "@/integrations/shopify/import-presentation";
import type {UnifiedWorkspace,UnifiedActionState,UnifiedImportPreview} from "@/integrations/shopify/unified-contract";

export function ShopifySimpleSetup({initial,shopDomain,today,submitAction}:{initial:UnifiedWorkspace;shopDomain:string;today:string;submitAction:(state:UnifiedActionState,form:FormData)=>Promise<UnifiedActionState>}){
  const [view,setView]=useState(initial),[from,setFrom]=useState(today),[through,setThrough]=useState(today),[consent,setConsent]=useState(false),
    [preview,setPreview]=useState<UnifiedImportPreview|null>(null),[page,setPage]=useState(0),[running,setRunning]=useState(false),[processed,setProcessed]=useState(0);
  const [open,setOpen]=useState(false),[filter,setFilter]=useState("all"),[search,setSearch]=useState(""),[now,setNow]=useState(0),
    [receipt,setReceipt]=useState<UnifiedActionState["receipt"]>(),[operation,setOperation]=useState("");
  const intent=useRef<{body:string;key:string}|null>(null);
  const importTrigger=useRef<HTMLButtonElement>(null);
  const [state,action,pending]=useActionState(async(previous:UnifiedActionState,form:FormData)=>{
    const raw=form.get("operation"),operation=typeof raw==="string"?raw:"";
    setOperation(operation);
    const body=operation==="preview"?{action:operation,from,through}:operation==="import"?{action:operation,previewId:preview?.previewId}:
      operation==="enable"?{action:operation,consent}:operation==="automatic"?{action:operation,enabled:!view.connection?.automatic}:{action:operation};
    const command={...body,...(!view.workerConfigured&&consent&&["enable","import","process"].includes(operation)?{manualCleanupAcknowledged:true}:{})};
    const encoded=JSON.stringify(command);
    if(intent.current?.body!==encoded||operation==="preview"||operation==="process")intent.current={body:encoded,key:crypto.randomUUID()};
    const input=new FormData();input.set("command",JSON.stringify({...command,requestKey:intent.current.key}));
    let result:UnifiedActionState;
    try{result=await submitAction(previous,input);}catch{result={status:"error",message:"The connection was interrupted. Retry the same action safely."};}
    if(result.view)setView(result.view);
    if(result.preview){setPreview(result.preview);setPage(0);setFilter("all");setSearch("");setReceipt(undefined);setNow(Date.now());}
    if(result.receipt){setReceipt(result.receipt);setPreview(null);setProcessed(0);}
    if(operation==="process")setProcessed(n=>n+1);
    setRunning(result.continueProcessing===true);
    if(result.status==="success")intent.current=null;
    return result;
  },{status:"idle",message:""});
  // Only drive manual jobs while the sheet is open. Closing pauses this driver,
  // not accepted server work; durable jobs and retry keys are preserved.
  useEffect(()=>{
    if(!open||!running||pending||processed>=100)return;
    const timer=setTimeout(()=>{const form=new FormData();form.set("operation","process");startTransition(()=>action(form));},500);
    return ()=>clearTimeout(timer);
  },[open,running,pending,processed,action]);
  useEffect(()=>{
    if(!open)return;
    const original=document.body.style.overflow;document.body.style.overflow="hidden";
    const timer=setInterval(()=>setNow(Date.now()),1000);
    return ()=>{document.body.style.overflow=original;clearInterval(timer);};
  },[open]);
  const c=view.connection,disabled=pending||running&&processed<100,newCount=preview?.rows.filter(r=>r.status==="new").length??0;
  const manual=!view.workerConfigured,importDisabled=disabled||manual&&!consent;
  const field="min-h-11 w-full rounded-md border bg-background px-3 py-2 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring";
  const dateError=importDateError(from,through,today),expired=preview?previewExpired(preview,now):false;
  // The server can recover an already-accepted receipt with its original key
  // even after preview expiry. Never turn a lost response into a new import.
  const retryImport=state.status==="error"&&operation==="import";
  const phase=preview?"review":receipt?"result":"dates";
  const filtered=preview?.rows.filter(row=>(filter==="all"||filter==="existing"&&["already_imported","reference_match"].includes(row.status)||row.status===filter)
    &&row.reference.toLowerCase().includes(search.trim().toLowerCase()))??[];
  const receiptQueued=receipt?.rows.filter(row=>row.status==="queued"||row.status==="already_queued").length??0;
  const feedback=state.message&&<p role={state.status==="error"?"alert":"status"} className="rounded-lg border p-4 text-sm">{state.message}</p>;
  const cleanupConsent=manual&&c?.unified&&<label className="flex min-h-11 items-start gap-3 rounded-lg border p-3 text-sm">
    <input type="checkbox" className="mt-1 size-5 shrink-0" checked={consent} disabled={disabled} onChange={e=>setConsent(e.target.checked)}/>
    <span>I will remove expired raw payloads after 24 hours using Temporary data cleanup. Automatic cleanup is off; expiry alone does not delete them. Orders and customers remain.</span>
  </label>;
  function changeOpen(value:boolean){
    setOpen(value);setNow(Date.now());
    if(!value){setRunning(false);requestAnimationFrame(()=>importTrigger.current?.focus());}
  }
  return <div className="mx-auto max-w-5xl space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-semibold">Shopify</h1>
      <p className="text-sm text-muted-foreground">{shopDomain} → Phantom Threads Test</p></div><Button asChild variant="outline"><Link href="/orders">Open Orders</Link></Button></header>
    <p className="rounded-lg border p-4 text-sm">Shopify orders appear in the normal Orders table as drafts. Your managers add garment types and workflows there. No customer messages or local payment receipts are created.</p>
    <ol className="flex flex-wrap gap-4 text-sm" aria-label="Setup steps"><li>1. Connect</li><li>2. Import orders</li><li>3. Automatic sync</li></ol>
    {!open&&feedback}
    <Card><CardHeader><CardTitle>1. Connect your store</CardTitle></CardHeader><CardContent className="space-y-4">
      <p>{c?.unified?"Connected for Test-account imports.":c?.ready?"Your store connection is verified. Confirm how Test data is kept to continue.":"This Test store connection needs administrator verification before importing."}</p>
      {!c?.unified&&<form action={action} className="space-y-4"><input type="hidden" name="operation" value="enable"/>
        <label className="flex min-h-11 items-start gap-3 text-sm"><input type="checkbox" className="mt-1 size-5" checked={consent} disabled={disabled} onChange={e=>setConsent(e.target.checked)}/>
          <span>Keep imported Test orders and customers until removed. Temporary raw Shopify payloads expire after one day.
            {manual&&" With background cleanup off, I will return after 24 hours and run Remove expired raw payloads. Expiry alone does not delete them."}</span></label>
        <Button disabled={disabled||!consent||!c?.ready}>{pending?"Checking…":"Verify and enable Test imports"}</Button></form>}
    </CardContent></Card>
    <Card><CardHeader><CardTitle>2. Import existing orders</CardTitle></CardHeader><CardContent className="space-y-4">
      <p className="text-sm">Choose dates, review new orders and reference clashes, then import only the new orders as drafts.</p>
      {!!c?.pending&&<p>{c.pending} orders waiting to finish importing. Open the import sheet to continue.</p>}
      {!!c?.needsAttention&&<p role="alert">{c.needsAttention} imports need administrator review.</p>}
      <Button type="button" ref={importTrigger} aria-haspopup="dialog" aria-expanded={open} onClick={()=>changeOpen(true)}>Import orders</Button>
      <Dialog title="Import Shopify orders" description="Phantom Threads Test only. Existing orders are never overwritten by a date-range import."
        placement="side" open={open} onOpenChange={changeOpen} preventClose={pending} confirmClose={()=>true}>
      <div className="space-y-5">
      <ol className="flex flex-wrap gap-3 rounded-lg bg-muted p-3 text-sm" aria-label="Import steps">
        <li className={phase==="dates"?"font-semibold":""} aria-current={phase==="dates"?"step":undefined}>1. Choose dates</li>
        <li className={phase==="review"?"font-semibold":""} aria-current={phase==="review"?"step":undefined}>2. Review matches</li>
        <li className={phase==="result"?"font-semibold":""} aria-current={phase==="result"?"step":undefined}>3. Import and results</li>
      </ol>
      {!(operation==="preview"&&state.status==="success")&&feedback}
      {!c?.unified&&<p role="status">Close this sheet and verify your store connection first.</p>}
      {manual&&phase!=="review"&&<p className="text-sm">Manual mode: keep this sheet open while importing. Close to pause; reopen and Continue import to resume. Work already accepted by the server is not cancelled.</p>}
      {phase==="dates"?<form action={action} className="flex flex-wrap items-end gap-3"><input type="hidden" name="operation" value="preview"/>
        <label className="space-y-2 text-sm">From (India time)<input type="date" required className={field} value={from} max={today} disabled={disabled||!c?.unified}
          onChange={e=>{setFrom(e.target.value);setPreview(null);}}/></label>
        <label className="space-y-2 text-sm">Through (inclusive)<input type="date" required className={field} value={through} min={from} max={today} disabled={disabled||!c?.unified}
          onChange={e=>{setThrough(e.target.value);setPreview(null);}}/></label>
        <Button disabled={disabled||!c?.unified||!!dateError}>{pending&&operation==="preview"?"Fetching orders…":"Preview orders"}</Button></form>:
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm">
          <p>{from} through {through} · India time, inclusive</p>
          <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={disabled}
            onClick={()=>{setPreview(null);setReceipt(undefined);setSearch("");setFilter("all");setPage(0);}}>Change dates</Button>
            <form action={action}><input type="hidden" name="operation" value="preview"/><Button variant="outline" disabled={disabled||!c?.unified}>{pending&&operation==="preview"?"Fetching orders…":"Preview orders"}</Button></form>
          </div>
        </div>}
      {dateError&&<p role="alert" className="text-sm">{dateError}</p>}
      {phase==="dates"&&<p className="text-sm text-muted-foreground">Choose up to 31 days. We compare Shopify identity and Reference order ID within this tenant. Existing matching orders are never overwritten.</p>}
      {preview&&<div className="space-y-3"><h3 className="font-medium">{preview.rows.length} orders found · {newCount} new</h3>
        {!preview.complete&&<p role="alert">Incomplete range. Narrow the dates before importing.</p>}
        <p className="text-sm">Already linked orders and matching references are skipped. A matching reference does not prove that the customer, items or amounts are identical.</p>
        <div className="flex flex-wrap gap-2" aria-label="Preview filters">{[
          ["all","All",preview.rows.length],["new","New",newCount],
          ["existing","Already present",preview.rows.filter(r=>r.status==="already_imported"||r.status==="reference_match").length],
          ["conflict","Needs review",preview.rows.filter(r=>r.status==="conflict").length]
        ].map(([value,label,count])=><Button key={value} type="button" variant={filter===value?"default":"outline"} aria-pressed={filter===value} onClick={()=>{setFilter(String(value));setPage(0);}}>{label} ({count})</Button>)}</div>
        <label className="block space-y-2 text-sm">Find Reference order ID<input type="search" className={field} value={search} onChange={e=>{setSearch(e.target.value);setPage(0);}}/></label>
        {preview.rows.length===0?<p>No Shopify orders were created in this range.</p>:filtered.length===0?<p>No results match this filter or reference. Clear the search or choose All.</p>:<div><table className="block w-full text-left text-sm sm:table">
          <thead className="sr-only sm:not-sr-only sm:table-header-group"><tr className="border-b"><th className="p-3">Reference order ID</th><th className="p-3">Shopify payment</th><th className="p-3">Import result</th></tr></thead>
          <tbody className="block space-y-3 sm:table-row-group sm:space-y-0">{filtered.slice(page*50,(page+1)*50).map(row=><tr key={row.orderGid} className="block rounded-lg border sm:table-row sm:rounded-none sm:border-x-0 sm:border-t-0"><td className="block break-words p-3 font-medium sm:table-cell">{row.reference||"Missing reference"}</td>
            <td className="block p-3 pt-0 sm:table-cell sm:pt-3">{row.financialStatus??"Unknown"} · {row.currency} {row.amount}</td><td className="block p-3 pt-0 sm:table-cell sm:pt-3"><p>{labels[row.status]}</p>
              <p className="mt-1 text-muted-foreground">{importExplanation(row)}</p>
              {row.orderIds.map((id,index)=><Link key={id} className="mt-2 inline-flex min-h-11 items-center underline" href={`/orders/${id}`} target="_blank" rel="noopener noreferrer">Compare existing order{row.orderIds.length>1?` ${index+1}`:""} (new tab)</Link>)}</td></tr>)}</tbody></table></div>}
        {filtered.length>50&&<div className="flex flex-wrap items-center gap-3"><Button variant="outline" disabled={page===0} onClick={()=>setPage(p=>p-1)}>Previous</Button>
          <span>Page {page+1} of {Math.ceil(filtered.length/50)} · {filtered.length} matching rows</span><Button variant="outline" disabled={(page+1)*50>=filtered.length} onClick={()=>setPage(p=>p+1)}>Next</Button></div>}
        {(newCount>0||!!c?.pending)&&cleanupConsent}
        <form action={action}><input type="hidden" name="operation" value="import"/><Button disabled={importDisabled||expired&&!retryImport||!preview.complete||!preview.previewId||!newCount}>{retryImport?"Retry same import":`Import ${newCount} new orders`}</Button></form>
        <p className="text-sm">Imports all {newCount} new orders in the preview, not just the filtered rows. Customer phone matches do not prevent order creation; managers can review customer links in each draft.</p>
        {expired?<p role="alert">{retryImport?"The preview expired after an attempted import. Retry same import to recover its result; the server will reject it if it was not accepted before expiry.":"This preview expired. Select Preview orders again to refresh the matches before importing."}</p>:
          <p className="text-sm text-muted-foreground">Preview expires after 10 minutes. References are checked again when orders are created.</p>}
      </div>}
      {receipt&&<section className="space-y-3 rounded-lg border p-4" aria-label="Import submission results">
        <h3 className="font-medium">Import submitted · {receiptQueued} queued</h3>
        <p className="text-sm">This is the submission receipt, not a completion count. It includes the final duplicate check. Current processing status is shown below.</p>
        <p className="text-sm">{receipt.rows.filter(r=>["already_imported","reference_match"].includes(r.status)).length} already present · {receipt.rows.filter(r=>r.status==="conflict").length} need review</p>
        {receipt.rows.some(r=>r.status==="conflict")&&<p role="alert" className="text-sm">Some references changed or clashed before submission. They were skipped. Preview the same dates again to compare them.</p>}
        {!c?.pending&&!c?.needsAttention&&<p className="text-sm">No queued imports are waiting or flagged for processing review in this connection. Open Orders to inspect the drafts. Skipped rows above were not imported.</p>}
        <Button asChild variant="outline"><Link href="/orders" target="_blank" rel="noopener noreferrer">View Orders (new tab)</Link></Button>
      </section>}
      {!!c?.pending&&!preview&&cleanupConsent}
      {!!c?.pending&&<div role="status" className="space-y-3 rounded-lg border p-4"><p>{c.pending} orders waiting to finish importing. {running&&processed<100?"Importing…":"You can safely continue this import."}</p>
        <form action={action}><input type="hidden" name="operation" value="process"/><Button variant="outline" disabled={importDisabled} onClick={()=>setProcessed(0)}>Continue import</Button></form>
        <p className="text-sm">Completed orders are available in Orders even while the rest are processing.</p></div>}
      {running&&!pending&&<Button type="button" variant="outline" onClick={()=>setRunning(false)}>Pause processing</Button>}
      {!!c?.needsAttention&&<p role="alert">{c.needsAttention} imports need administrator review. They have not been reported as completed.</p>}
      <p className="text-sm text-muted-foreground">Dates, preview and results are kept when you close this sheet, until you leave or reload this page. Accepted jobs remain stored on the server.</p>
      </div></Dialog>
    </CardContent></Card>
    <Card><CardHeader><CardTitle>3. Automatic sync</CardTitle></CardHeader><CardContent className="space-y-4">
      <p>When enabled, new Shopify orders become drafts automatically. Updates refresh Shopify details without overwriting your team&apos;s workflow choices.</p>
      <p className="font-medium">{c?.automatic?"Automatic sync is on for Phantom Threads Test.":"Automatic sync is off."}</p>
      {manual&&<p className="text-sm">Background worker setup is deferred. You can import dates and complete drafts now; automatic sync stays unavailable until the worker is configured.</p>}
      {!manual&&<p className="text-sm">Worker endpoint configured. Confirm that the external retry and cleanup schedule is running before enabling automatic sync.</p>}
      <form action={action}><input type="hidden" name="operation" value="automatic"/><Button disabled={disabled||!c?.unified||manual&&!c?.automatic}>{c?.automatic?"Turn off automatic sync":"Set up automatic sync"}</Button></form>
    </CardContent></Card>
    <details className="rounded-lg border p-4"><summary className="min-h-11 cursor-pointer py-2">Connection details</summary>
      <p className="text-sm">Status: {c?.status??"Not connected"}. These settings apply only to Phantom Threads Test. Production tenants and chat/CRM are not enabled by this setup.</p></details>
    {c?.unified&&<Card><CardHeader><CardTitle>Temporary data cleanup</CardTitle></CardHeader><CardContent className="space-y-3">
      <p className="text-sm">Removes only expired raw payloads, up to 100 per click. Imported orders and customers remain. {manual?"Return after 24 hours to run this until background cleanup is configured.":"The external worker schedule must handle cleanup."}</p>
      <form action={action}><input type="hidden" name="operation" value="cleanup"/><Button variant="outline" disabled={disabled}>Remove expired raw payloads</Button></form>
    </CardContent></Card>}
  </div>;
}
