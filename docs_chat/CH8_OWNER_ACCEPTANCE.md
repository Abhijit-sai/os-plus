# CH-8 owner acceptance — local synthetic test

Not executed by owner yet. Engineering evidence CH8_QA.md; main checklist CHECKLIST.md CH8. Live AI and transcription stay disabled. No keys, Meta setup or server purchase needed.

Sign into local OS PLUS as owner-a+clerk_test@example.com and choose Local QA A (Chat Local1). Chatwoot still has its separate local login from earlier phases. Existing channels are staff-reviewed drafts.

|Step|What you do|Expected|
|---|---|---|
|C8-L1|Open http://localhost:4141/app/accounts/901/conversations/38 (CH8 synthetic wav). Play the original one-second audio if desired.|It is a synthetic tone. One private note labelled “Automatic voice transcript — local mock” and one separate Suggested reply; original attachment preserved.|
|C8-L2|Review the suggested hours response. Edit using the existing Chatwoot reply composer; send only in this synthetic local conversation if testing Send.|No nested editor is introduced. A transcript note has no reply/send buttons. Nothing has been sent automatically to a real customer.|
|C8-L3|Open http://localhost:4141/app/accounts/901/conversations/37 (CH8 synthetic unknown).|No invented transcript. Private safe review/handoff response. OS PLUS linked enquiry shows one unreadable team task.|
|C8-L4|Open http://localhost:4131/leads/b1f538b7-d4f6-4995-8ecb-7eb1d6e5dcf8.|Read-only original audio placeholder plus clearly labelled mock transcript; reply in Chatwoot. Inspect desktop and narrow/mobile layout.|
|C8-L5|Open http://localhost:4131/settings/chat → Voice notes. Check maximum120seconds/10MB and local-only wording. Optionally lower/save then restore120/10.|Only owner settings; confirmed save. Changes revoke in-flight voice jobs. Ordinary tenant defaults remainoff; only these synthetic local tenants opted in. Do not save an old A form after switching business.|
|C8-L6|Switch OS PLUS to Local QA B and open the copied A lead URL; then open http://localhost:4131/leads/11a9549c-d565-49a9-a218-4ef845700bb7. Return to A afterward.|A URL404; B’s own synthetic Ogg transcript visible. Chatwoot account902 conversation12 is B's provider counterpart, requiring its separate local account access.|
|C8-L7|Confirm inquiry-first scope and report any problem or accept reported local results.|Typed customer confirmation plus separate staff approval remain required for operational bookings. A spoken yes cannot book. Real speech/WhatsApp accuracy remains untested.|

Fresh upload is optional: fixture files D:/Develop/os-plus-chat-ch0/outputs/chat-local/ch8-synthetic-hours.wav and .ogg contain deterministic tones whose known hashes map to the synthetic opening-hours enquiry. Upload through the customer website visitor attachment control (http://localhost:4142) if available; a staff outgoing attachment in Chatwoot is not a customer trigger. If that control is unavailable, C8-L1 uses a fresh native local Rails-uploaded customer fixture already verified through actual account/agent callbacks. Arbitrary microphone recordings intentionally go to staff; this build does not perform speech recognition.

After this exercise, confirm local acceptance and state whether live speech/WhatsApp gates should remain deferred. This file records no acceptance in advance. Existing local commit authority takes effect only after closure gates; CH8 is uncommitted and CH9 has not started.


## Accepted local disposition — 28 October 2026
Supersedes the pending-owner status above. Owner explicitly accepted local CH8 results, deferred live testing and authorized local commit plus CH9 continuation (CHAT-D058). C8-L7 is accepted on reported engineering evidence; independent owner execution of every C8-L1–L6 step is not asserted. Live speech/WhatsApp and provider/privacy/cost acceptance remain unexecuted/release-blocking. LiveAI/STT stay disabled; domain/server/Meta later. No external release authority.
