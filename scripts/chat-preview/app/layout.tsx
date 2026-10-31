import "../../../src/app/globals.css";
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "Arial, sans-serif" }}>
        <main className="mx-auto max-w-6xl p-3 sm:p-6">{children}</main>
      </body>
    </html>
  );
}
