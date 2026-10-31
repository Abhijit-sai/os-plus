"use client";
import { Button } from "@/components/ui/button";
export default function LeadError({ reset }: { reset: () => void }) {
  return (
    <div role="alert" className="space-y-3 rounded-md border p-6">
      <h2 className="text-lg font-semibold">Enquiries could not be loaded</h2>
      <p>Check your connection and business access, then try again.</p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
