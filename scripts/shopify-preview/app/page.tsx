"use client";
import { useState } from "react";
import { ShopifyWorkspace } from "@/components/settings/shopify-workspace";
import { applicationView } from "../../fixtures/shopify-application-view.mjs";
export default function Page(){
  // The fixture is validated separately by the application/component tests.
  const [view,setView]=useState(()=>applicationView());
  return <ShopifyWorkspace view={view} action={async(_state,form)=>{
    const command=JSON.parse(String(form.get("command")));
    if(command.action==="save_review")setView(current=>({...current,sources:current.sources.map(s=>({...s,review:{id:"c0000000-0000-4000-8000-000000000001",version:1,current:true,decision:command.decision}}))}));
    if(command.action==="release")setView(current=>({...current,sources:current.sources.map(s=>({...s,orderStatus:"confirmed"}))}));
    return {status:"success",message:"Fictional preview saved. No real data changed."};
  }}/>;
}
