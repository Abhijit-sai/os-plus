"use client";
import { useState, type FormEvent } from "react";

export function ShopifyApprovalForm({ shopDomain, hasCredential = false, result }:
  { shopDomain?: string; hasCredential?: boolean; result?: string }) {
  const [pending, setPending] = useState(false), [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    setPending(true); setError("");
    try {
      const response = await fetch("/api/integrations/shopify/oauth/start", {
        method: "POST", credentials: "same-origin", redirect: "error",
        headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ shop: String(form.get("shop") ?? "") }),
      });
      const data: unknown = await response.json();
      if(response.status===409&&data&&typeof data==="object"&&"code" in data&&data.code==="APPROVAL_BUSY"){
        setError("A Shopify approval or renewal is already in progress. Wait for it to finish; an interrupted approval can take up to 10 minutes to expire.");
        setPending(false);return;
      }
      if (!response.ok || !data || typeof data !== "object" || !("url" in data) || typeof data.url !== "string") throw new Error();
      const destination = new URL(data.url);
      if (destination.protocol !== "https:" || !/^[a-z0-9-]+\.myshopify\.com$/.test(destination.hostname) ||
        destination.pathname !== "/admin/oauth/authorize") throw new Error();
      window.location.assign(destination.toString());
    } catch {
      setError("Could not start Shopify approval. Check the store domain and ask the administrator to verify the connection settings. No import was started.");
      setPending(false);
    }
  }
  return <div className="space-y-3">
    {result === "approved" && <p role="status" className="rounded-md border p-3 text-sm">
      Shopify access approved. Your existing orders are unchanged. Confirm data retention below before your first import.
    </p>}
    {(error || result === "failed") && <p role="alert" className="rounded-md border border-destructive p-3 text-sm">
      {error || "Shopify approval was not completed or expired. Try again while signed in to the same tenant. No import was started."}
    </p>}
    <form method="post" action="/api/integrations/shopify/oauth/start" onSubmit={submit} className="space-y-3" aria-busy={pending}>
      <label className="block space-y-2 text-sm"><span>Shopify store domain</span>
        <input name="shop" type="text" required maxLength={80} defaultValue={shopDomain ?? ""} readOnly={!!shopDomain}
          disabled={pending} autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="your-store.myshopify.com"
          aria-describedby="shopify-approval-help"
          className="min-h-11 w-full rounded-md border bg-background px-3 py-2 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"/>
      </label>
      <p id="shopify-approval-help" className="text-sm text-muted-foreground">
        You will approve access on Shopify, then return here. OS Plus reads orders, customers and products; it does not edit your Shopify store.
      </p>
      <button type="submit" disabled={pending}
        className="min-h-11 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
        {pending ? "Opening Shopify…" : hasCredential ? "Reauthorize Shopify" : "Connect Shopify"}
      </button>
    </form>
  </div>;
}
