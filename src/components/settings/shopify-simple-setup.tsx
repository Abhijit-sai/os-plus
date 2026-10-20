"use client";
import Link from "next/link";
import {startTransition,useActionState,useEffect,useRef,useState} from "react";
import {Button} from "@/components/ui/button";
import {Card,CardHeader,CardTitle,CardContent} from "@/components/ui/card";
import type {UnifiedWorkspace,UnifiedActionState,UnifiedImportPreview} from "@/integrations/shopify/unified-contract";

const labels={new:"New — ready to import",already_imported:"Already in Orders",reference_match:"Reference matches an existing order",conflict:"Conflict — not imported"};
export function ShopifySimpleSetup({initial,shopDomain,today,submitAction}:{initial:UnifiedWorkspace;shopDomain:string;today:string;submitAction:(state:UnifiedActionState,form:FormData)=>Promise<UnifiedActionState>}){
  const [view,setView]=useState(initial),[from,setFrom]=useState(today),[through,setThrough]=useState(today),[consent,setConsent]=useState(false),
    [preview,setPreview]=useState<UnifiedImportPreview|null>(null),[page,setPage]=useState(0),[running,setRunning]=useState(false),[processed,setProcessed]=useState(0);
  const intent=useRef<{body:string;key:string}|null>(null);
  const [state,action,pending]=useActionState(async(previous:UnifiedActionState,form:FormData)=>{
    const raw=form.get("operation"),operation=typeof raw==="string"?raw:"";
    const body=operation==="preview"?{action:operation,from,through}:operation==="import"?{action:operation,previewId:preview?.previewId}:
      operation==="enable"?{action:operation,consent}:operation==="automatic"?{action:operation,enabled:!view.connection?.automatic}:{action:operation};
    const command={...body,...(!view.workerConfigured&&consent&&["enable","import","process"].includes(operation)?{manualCleanupAcknowledged:true}:{})};
    const encoded=JSON.stringify(command);
    if(intent.current?.body!==encoded||operation==="preview"||operation==="process")intent.current={body:encoded,key:crypto.randomUUID()};
    const input=new FormData();input.set("command",JSON.stringify({...command,requestKey:intent.current.key}));
    let result:UnifiedActionState;
    try{result=await submitAction(previous,input);}catch{result={status:"error",message:"The connection was interrupted. Retry the same action safely."};}
    if(result.view)setView(result.view);
    if(result.preview){setPreview(result.preview);setPage(0);}
    if(result.receipt){setPreview(null);setProcessed(0);}
    if(operation==="process")setProcessed(n=>n+1);
    setRunning(result.continueProcessing===true);
    if(result.status==="success")intent.current=null;
    return result;
  },{status:"idle",message:""});
  // Bounded automatic progress while this page remains open. Durable jobs survive
  // navigation; the scheduled worker is the background recovery mechanism.
  useEffect(()=>{
    if(!running||pending||processed>=100)return;
    const timer=setTimeout(()=>{const form=new FormData();form.set("operation","process");startTransition(()=>action(form));},500);
    return ()=>clearTimeout(timer);
  },[running,pending,processed,action]);
  const c=view.connection,disabled=pending||running&&processed<100,newCount=preview?.rows.filter(r=>r.status==="new").length??0;
  const manual=!view.workerConfigured,importDisabled=disabled||manual&&!consent;
  const field="min-h-11 w-full rounded-md border bg-background px-3 py-2";
  return <div className="mx-auto max-w-5xl space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-semibold">Shopify</h1>
      <p className="text-sm text-muted-foreground">{shopDomain} → Phantom Threads Test</p></div><Button asChild variant="outline"><Link href="/orders">Open Orders</Link></Button></header>
    <p className="rounded-lg border p-4 text-sm">Shopify orders appear in the normal Orders table as drafts. Your managers add garment types and workflows there. No customer messages or local payment receipts are created.</p>
    <ol className="flex flex-wrap gap-4 text-sm" aria-label="Setup steps"><li>1. Connect</li><li>2. Import orders</li><li>3. Automatic sync</li></ol>
    {state.message&&<p role={state.status==="error"?"alert":"status"} className="rounded-lg border p-4">{state.message}</p>}
    <Card><CardHeader><CardTitle>1. Connect your store</CardTitle></CardHeader><CardContent className="space-y-4">
      <p>{c?.unified?"Connected for Test-account imports.":c?.ready?"Your store connection is verified. Confirm how Test data is kept to continue.":"This Test store connection needs administrator verification before importing."}</p>
      {!c?.unified&&<form action={action} className="space-y-4"><input type="hidden" name="operation" value="enable"/>
        <label className="flex min-h-11 items-start gap-3 text-sm"><input type="checkbox" className="mt-1 size-5" checked={consent} disabled={disabled} onChange={e=>setConsent(e.target.checked)}/>
          <span>Keep imported Test orders and customers until removed. Temporary raw Shopify payloads expire after one day.
            {manual&&" With background cleanup off, I will return after 24 hours and run Remove expired raw payloads. Expiry alone does not delete them."}</span></label>
        <Button disabled={disabled||!consent||!c?.ready}>{pending?"Checking…":"Verify and enable Test imports"}</Button></form>}
    </CardContent></Card>
    <Card><CardHeader><CardTitle>2. Import existing orders</CardTitle></CardHeader><CardContent className="space-y-4">
      {manual&&<div className="space-y-3 rounded-lg border p-4 text-sm"><p>Manual mode: keep this page open while importing. If you close it, return and select Continue import. n8n is not needed for this test.</p>
        {c?.unified&&<label className="flex min-h-11 items-start gap-3"><input type="checkbox" className="mt-1 size-5" checked={consent} disabled={disabled} onChange={e=>setConsent(e.target.checked)}/>
          I will return after 24 hours and run Remove expired raw payloads. Background cleanup is off; expiry alone does not delete them. Imported orders and customers will remain.</label>}</div>}
      <form action={action} className="flex flex-wrap items-end gap-3"><input type="hidden" name="operation" value="preview"/>
        <label className="space-y-2 text-sm">From (India time)<input type="date" required className={field} value={from} max={today} disabled={disabled||!c?.unified}
          onChange={e=>{setFrom(e.target.value);setPreview(null);}}/></label>
        <label className="space-y-2 text-sm">Through (inclusive)<input type="date" required className={field} value={through} min={from} max={today} disabled={disabled||!c?.unified}
          onChange={e=>{setThrough(e.target.value);setPreview(null);}}/></label>
        <Button disabled={disabled||!c?.unified}>Preview orders</Button></form>
      <p className="text-sm text-muted-foreground">Choose up to 31 days. We compare Shopify identity and Reference order ID within this tenant. Existing matching orders are never overwritten.</p>
      {preview&&<div className="space-y-3"><h3 className="font-medium">{preview.rows.length} orders found · {newCount} new</h3>
        {!preview.complete&&<p role="alert">Incomplete range. Narrow the dates before importing.</p>}
        {preview.rows.length===0?<p>No Shopify orders were created in this range.</p>:<div className="overflow-x-auto"><table className="w-full text-left text-sm">
          <thead><tr className="border-b"><th className="p-3">Reference order ID</th><th className="p-3">Shopify payment</th><th className="p-3">Import result</th></tr></thead>
          <tbody>{preview.rows.slice(page*50,(page+1)*50).map(row=><tr key={row.orderGid} className="border-b"><td className="p-3">{row.reference||"Missing reference"}</td>
            <td className="p-3">{row.financialStatus??"Unknown"} · {row.currency} {row.amount}</td><td className="p-3">{labels[row.status]}
              {row.orderIds.map(id=><Link key={id} className="ml-2 underline" href={`/orders/${id}`}>Open existing order</Link>)}</td></tr>)}</tbody></table></div>}
        <div className="flex flex-wrap items-center gap-3"><Button variant="outline" disabled={page===0} onClick={()=>setPage(p=>p-1)}>Previous</Button>
          <span>Page {page+1} of {Math.max(1,Math.ceil(preview.rows.length/50))}</span><Button variant="outline" disabled={(page+1)*50>=preview.rows.length} onClick={()=>setPage(p=>p+1)}>Next</Button></div>
        <form action={action}><input type="hidden" name="operation" value="import"/><Button disabled={importDisabled||!preview.complete||!preview.previewId||!newCount}>Import {newCount} new orders</Button></form>
        <p className="text-sm text-muted-foreground">Preview expires after 10 minutes. References are checked again when orders are created.</p>
      </div>}
      {!!c?.pending&&<div role="status" className="space-y-3 rounded-lg border p-4"><p>{c.pending} orders waiting to finish importing. {running&&processed<100?"Importing…":"You can safely continue this import."}</p>
        <form action={action}><input type="hidden" name="operation" value="process"/><Button variant="outline" disabled={importDisabled} onClick={()=>setProcessed(0)}>Continue import</Button></form>
        <p className="text-sm">Completed orders are available in Orders even while the rest are processing.</p></div>}
      {!!c?.needsAttention&&<p role="alert">{c.needsAttention} imports need administrator review. They have not been reported as completed.</p>}
      {c?.unified&&<div className="space-y-3 border-t pt-4"><p className="text-sm">Raw-payload cleanup removes only temporary payloads older than 24 hours, up to 100 per click. It does not delete orders or customers.</p>
        <form action={action}><input type="hidden" name="operation" value="cleanup"/><Button variant="outline" disabled={disabled}>Remove expired raw payloads</Button></form></div>}
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
  </div>;
}
