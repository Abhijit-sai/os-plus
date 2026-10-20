import { ShopifyApprovalForm } from "@/components/settings/shopify-approval-form";

export default function Page() {
  return <div className="mx-auto max-w-xl space-y-8">
    <section className="space-y-4 rounded-xl border p-6">
      <h1 className="text-xl font-semibold">Connect your Shopify store</h1>
      <p className="text-sm text-muted-foreground">Preview only. Submitting cannot connect a store because this local app has no approval endpoint.</p>
      <ShopifyApprovalForm />
    </section>
    <section className="space-y-4 rounded-xl border p-6">
      <h2 className="text-lg font-semibold">Existing store — interrupted approval</h2>
      <ShopifyApprovalForm shopDomain="fictional.myshopify.com" hasCredential result="failed" />
    </section>
  </div>;
}
