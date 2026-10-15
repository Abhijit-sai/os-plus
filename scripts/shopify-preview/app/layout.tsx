import "../../../src/app/globals.css";
import { UnsavedChangesProvider } from "@/components/layout/unsaved-changes-provider";
export default function Layout({children}:{children:React.ReactNode}){
  return <html lang="en"><body style={{fontFamily:"Arial, sans-serif"}}><main className="mx-auto max-w-6xl p-3 sm:p-6"><p className="mb-4 rounded-md border p-3 text-sm">Local fictional UI preview. No Shopify, Clerk or database connection. Actions are simulated.</p><UnsavedChangesProvider>{children}</UnsavedChangesProvider></main></body></html>;
}
