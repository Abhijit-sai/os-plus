# Local Chat setup preview

From the repository root after npm ci:

```powershell
node node_modules/next/dist/bin/next dev scripts/chat-preview --webpack --hostname 127.0.0.1 --port 4121
```

Open http://127.0.0.1:4121/ for the synthetic setup screen or /sizes for phone/laptop frames.
The preview imports the production UI and pure permission/boundary rules, with explicit mock actions. It has no Clerk, database or live Chatwoot runtime imports and does not read the root app environment.
Use the controls to simulate failed saves, a response lost after commit, role denial and tenant switching. Reloading resets fixtures. This is interaction/layout QA, not authenticated or persistence acceptance.
See ../../docs_chat/CH1_QA.md for recorded evidence and outstanding gates.
