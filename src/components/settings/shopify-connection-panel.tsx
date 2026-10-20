"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { checkShopifyAccess, type ShopifyAccessCheck } from "@/integrations/shopify/access-check-client";
import type { ShopifyConnectionScreen } from "@/integrations/shopify/connection-screen";

const descriptions={
  configuration_pending:["Private configuration pending","The administrator needs to finish the private Shopify settings before access can be checked."],
  database_pending:["Database setup pending","The Shopify database structure is not ready. A reviewed database update and recovery plan are required."],
  not_connected:["Tenant connection pending","No installed-store binding is saved for this Test tenant. An access check alone does not create a connection."],
  available:["Tenant connection recorded","The saved installation state is shown below. This is separate from a fresh Shopify access check."],
  unavailable:["Connection status unavailable","The saved status could not be loaded. Do not assume that no connection exists. Refresh this page to retry."],
};
export function ShopifyConnectionPanel({state,tenantId}:{state:ShopifyConnectionScreen;tenantId:string}){
  const [pending,setPending]=useState(false),[result,setResult]=useState<ShopifyAccessCheck|null>(null);
  const active=useRef<AbortController|null>(null);
  useEffect(()=>()=>{const controller=active.current;active.current=null;controller?.abort();},[]);
  async function check(){
    if(active.current || !state.canCheckAccess || !state.shopDomain)return;
    const controller=new AbortController();active.current=controller;setPending(true);setResult(null);
    const timer=setTimeout(()=>controller.abort(),30000);
    try{
      const next=await checkShopifyAccess(tenantId,state.shopDomain,controller.signal);
      if(active.current===controller)setResult(next);
    }finally{
      clearTimeout(timer);
      if(active.current===controller){active.current=null;setPending(false);}
    }
  }
  const [title,description]=descriptions[state.availability];
  return <div className="max-w-3xl space-y-4">
    <Card><CardHeader><CardTitle>{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div><dt className="text-sm text-muted-foreground">Pilot store</dt><dd className="break-all font-medium">{state.shopDomain??"Not configured"}</dd></div>
          <div><dt className="text-sm text-muted-foreground">Saved installation</dt><dd className="font-medium">{state.connection?.status??"Not available"}</dd></div>
        </dl>
        <p className="text-sm">Live imports are not available from this screen. Customer messages remain off.</p>
      </CardContent>
    </Card>
    <Card><CardHeader><CardTitle>Check store access</CardTitle><CardDescription>Confirm the app can read the installed store and required permissions. No orders or customer records are fetched.</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        <Button type="button" className="min-h-11 w-full sm:w-auto" disabled={pending||!state.canCheckAccess} aria-busy={pending} onClick={check}>
          {pending?"Checking store access…":"Check store access"}
        </Button>
        {!state.canCheckAccess?<p className="text-sm text-muted-foreground">Finish private configuration before running this check.</p>:null}
        <div aria-live="polite" aria-atomic="true" className="min-h-12 text-sm">
          {pending?<p role="status">Checking access. No records are being imported.</p>:null}
          {result?.kind==="error"?<p role="alert" className="text-destructive">{result.message}</p>:null}
          {result?.kind==="success"?<div role="status"><p className="font-medium">Store access check passed.</p><p>Checked {new Date(result.verifiedAt).toLocaleString("en-IN",{timeZone:"Asia/Kolkata"})} IST. Imports remain disabled; protected customer fields still need verification.</p></div>:null}
        </div>
      </CardContent>
    </Card>
    <Card><CardHeader><CardTitle>Before the first order</CardTitle></CardHeader><CardContent>
      <ol className="list-decimal space-y-2 pl-5 text-sm">
        <li>Verify a private database backup and approve the exact database update.</li>
        <li>Finish tenant connection, protected access and test-copy retention approval.</li>
        <li>Review one recent existing Shopify order in Test before releasing production work.</li>
      </ol>
      <p className="mt-3 text-sm text-muted-foreground">This pilot does not connect other tenants, enable scheduled syncing, or post Shopify payments into OS PLUS Finance.</p>
    </CardContent></Card>
  </div>;
}
