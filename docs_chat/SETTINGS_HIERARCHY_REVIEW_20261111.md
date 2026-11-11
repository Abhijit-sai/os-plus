# Settings hierarchy review — 11 November 2026

The Telegram recipient confirmation journey exposed a hierarchy problem: account setup, ordinary preferences, reconnect actions, delivery receipts and report previews appeared as one long form. This review implements a local correction to Notifications and Reply assistance. It is not a full application audit or a production release.

## Implemented

- One reusable native disclosure component, keyboard operable, with title, summary, explicit status and a visible expanded-panel boundary. Collapsing preserves form edits.
- Notifications: separate delivery schedule, recipient list, add-recipient flow, delivery history and report preview. Connected recipients are collapsed initially; unconfirmed recipients open with confirmation first.
- Each recipient has separate alert, brand, activation and test-delivery sections. Reconnection is an advanced disclosure with an explanation of its effect.
- Successful notification actions refresh saved status. An uncertain save offers a full-page reload instead of leaving the user without a recovery action. Existing idempotency and tenant checks remain in the server command path.
- Reply assistance: one disclosure per channel, showing published knowledge and reply mode. Missing knowledge, pending approval and unavailable Auto open the channel for attention.

## Reusable rules

1. Put current state and the next action before editable detail.
2. Group controls by the task or account they affect. Show the relevant save action within that group.
3. Keep confirmations and blockers visible, with text explaining disabled actions.
4. Show routine detail on demand. Separate reconnect actions from normal saves.
5. Treat logs and previews as supporting tools, rather than the main configuration journey.
6. Preserve edits when collapsing sections; use visible focus and text status on desktop and mobile.

## Follow-up candidates from source inspection

| Area | Observation | Next review |
| --- | --- | --- |
| Workflow settings | Stage-to-workgroup mappings expand every stage, including empty mappings. | Review a compact per-stage summary with an explicit unmapped state and focused editing. |
| Communications | Sender forms, templates, trigger rules and queue information form a long settings page. Template editing already uses dialogs. | Review task navigation and separate setup from ongoing delivery operations; avoid adding redundant disclosures to compact rows. |

Business knowledge and Channels already contain progressive disclosure. Reuse that approach where appropriate; do not turn every simple setting into an accordion. The follow-up candidates have not been browser audited or changed in this pass.

## Verification and limits

TypeScript, scoped ESLint, whitespace validation, the client/server boundary contract and all three Chat page authorization/error tests passed. Visual captures and browser interaction checks are recorded in the enclosing workspace's `outputs/settings-hierarchy-review` directory.

The isolated preview imports the actual changed components and AppShell, with fictional Studio Iris data and simulated server actions. It checks recipient disclosure, keyboard access, edit preservation, scoped saves, link-code preparation, confirmation gating, setup-test feedback and per-channel controls. This proves local rendering and interaction behavior; it does not prove production persistence or delivery. No provider calls, database changes, downloads or deployment are part of this UI pass. The real client's earlier successful Telegram receipt is separate evidence.

Final browser run: PASS at desktop 1440px and mobile 390px, including expanded recipient and reply-approval panels; no horizontal overflow, page errors or console errors. See `outputs/settings-hierarchy-review/last-result.json` in the enclosing workspace and the accompanying screenshots. Earlier preview failures involved cold development-server startup and cached font URLs after changing the preview build directory. The final runner warms the preview first, waits for hydration and font readiness, and serves already-cached font files locally. No download was needed.
