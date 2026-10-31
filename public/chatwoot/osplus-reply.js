/* OS PLUS reply controls v1.1.0 — pinned Chatwoot4.18. No platform credentials.
 * Native window.axios owns staff authentication. Never read cookies/tokens here.
 * A timed-out public send may have committed: retain uncertainty, never blindly retry. */
(function (host) {
  "use strict";
  const version = "1.1.0",
    marker = "💬 Suggested reply";
  const positive = (value) => Number.isSafeInteger(value) && value > 0;
  const uuid = (value) =>
    typeof value === "string" &&
    /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value);
  function scope(path) {
    const match =
      /^\/app\/accounts\/([1-9][0-9]*)\/(?:[^?#]*\/)?conversations\/([1-9][0-9]*)\/?$/.exec(
        path,
      );
    if (!match || !positive(Number(match[1])) || !positive(Number(match[2])))
      throw Error("Open this conversation in Chatwoot first.");
    return { account: Number(match[1]), conversation: Number(match[2]) };
  }
  function safeText(value) {
    if (
      typeof value !== "string" ||
      !value.trim() ||
      value.length > 6000 ||
      /[{}<>\u0000-\u0008\u000b\u000c\u000e-\u001f]|\b(?:tenant_id|api[_ -]?key|access[_ -]?token|correlation_id|understanding_json|decision_json)\b|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}/i.test(
        value,
      ) ||
      value.includes(marker)
    )
      throw Error(
        "This suggestion needs review in the normal Chatwoot reply box.",
      );
    return value.trim();
  }
  function createDraftController({
    api,
    readPath,
    storage,
    locks,
    coordinator,
  }) {
    async function load(noteId, selected) {
      if (!positive(noteId)) throw Error("Suggestion unavailable.");
      const endpoint =
        "/api/v1/accounts/" +
        selected.account +
        "/conversations/" +
        selected.conversation +
        "/messages";
      const response = await api.get(endpoint, { timeout: 10000 });
      const rows = response?.data?.payload;
      if (!Array.isArray(rows) || rows.length > 1000)
        throw Error("Conversation could not be checked.");
      if (JSON.stringify(scope(readPath())) !== JSON.stringify(selected))
        throw Error("The conversation changed. Open the suggestion again.");
      const note = rows.find((row) => row.id === noteId),
        attrs = note?.content_attributes;
      if (
        !note ||
        note.private !== true ||
        Number(note.message_type) !== 1 ||
        Number(note.conversation_id) !== selected.conversation ||
        !uuid(attrs?.osplus_draft_id) ||
        attrs.osplus_engine !== "osplus-v1" ||
        !positive(attrs.osplus_trigger_message_id) ||
        String(note.sender?.type).replace(/_/g, "").toLowerCase() !==
          "agentbot" ||
        typeof note.content !== "string" ||
        !note.content.startsWith(marker + "\n\n")
      )
        throw Error("Use the normal Chatwoot reply box for this note.");
      const sent = rows.find(
        (row) =>
          row.private === false &&
          Number(row.message_type) === 1 &&
          row.content_attributes?.osplus_source_draft_id ===
            attrs.osplus_draft_id,
      );
      if (sent) return { endpoint, note, attrs, sent: true };
      const trigger = rows.find(
        (row) =>
          row.id === attrs.osplus_trigger_message_id &&
          row.private === false &&
          Number(row.message_type) === 0,
      );
      if (
        !trigger ||
        rows.some(
          (row) =>
            row.private === false &&
            [0, 1].includes(Number(row.message_type)) &&
            row.id > trigger.id,
        ) ||
        rows.some(
          (row) =>
            row.private === true &&
            row.id > noteId &&
            row.content_attributes?.osplus_engine === "osplus-v1",
        )
      )
        throw Error(
          "A newer message or suggestion exists. Review the current conversation.",
        );
      return {
        endpoint,
        note,
        attrs,
        sent: false,
        text: safeText(note.content.slice(marker.length + 2)),
      };
    }

    async function claimAndRun(noteId, edited, operation) {
      if (!locks?.request || !storage?.getItem || !storage?.setItem)
        throw Error("Use the normal Chatwoot reply box in this browser.");
      if (!coordinator?.claim || !coordinator?.record)
        throw Error(
          "Open OS PLUS and select the matching business, or use the normal Chatwoot reply box.",
        );
      const selected = scope(readPath());
      const initial = await load(noteId, selected);
      return locks.request(
        "osplus.reply:" +
          selected.account +
          ":" +
          selected.conversation +
          ":" +
          initial.attrs.osplus_draft_id,
        async () => {
          const draft = await load(noteId, selected);
          const key =
            "osplus.reply.v1:" +
            selected.account +
            ":" +
            selected.conversation +
            ":" +
            draft.attrs.osplus_draft_id;
          if (draft.sent) {
            storage.setItem(key, "sent");
            return { status: "sent" };
          }
          const stored = storage.getItem(key);
          if (stored === "sent") return { status: "sent" };
          if (stored === "uncertain") return { status: "uncertain" };
          const content = safeText(edited === undefined ? draft.text : edited);
          const profile = await api.get("/api/v1/profile", {
            timeout: 10000,
          });
          if (!positive(profile?.data?.id))
            throw Error("Use your matching Chatwoot staff account.");
          const sendInput = {
            draftId: draft.attrs.osplus_draft_id,
            accountId: selected.account,
            conversationId: selected.conversation,
            noteId,
            staffId: profile.data.id,
            content,
          };
          const shared = await coordinator.claim(sendInput);
          if (shared.status === "blocked")
            throw Error(
              "Draft could not be authorised. Open OS PLUS, select the matching business and check your staff account.",
            );
          if (shared.status !== "claimed")
            return {
              status: shared.status === "sent" ? "sent" : "uncertain",
            };
          if (JSON.stringify(scope(readPath())) !== JSON.stringify(selected))
            return { status: "uncertain" };
          // Authorisation can take time. Re-read native history after it, immediately before sending.
          try {
            const current = await load(noteId, selected);
            if (current.sent) return { status: "sent" };
            if (current.text !== draft.text) return { status: "uncertain" };
          } catch {
            return { status: "uncertain" };
          }
          // Persist uncertainty BEFORE the request; another tab/reload must reconcile rather than resend.
          storage.setItem(key, "uncertain");

          return operation({ draft, content, sendInput, key });
        },
      );
    }
    function attributes(draft) {
      return {
        osplus_source_draft_id: draft.attrs.osplus_draft_id,
        osplus_source_note_id: draft.note.id,
        osplus_reply_controls: version,
      };
    }
    async function confirmReceipt(ticket, receipt) {
      const { draft, content, sendInput, key } = ticket;
      if (
        !positive(receipt?.id) ||
        receipt.private !== false ||
        receipt.content !== content ||
        receipt.content_attributes?.osplus_source_draft_id !==
          draft.attrs.osplus_draft_id
      )
        return { status: "uncertain" };
      storage.setItem(key, "sent");
      try {
        await coordinator.record({
          ...sendInput,
          providerMessageId: receipt.id,
        });
      } catch {
        /* The authenticated webhook can reconcile a confirmed native provider receipt. */
      }
      return { status: "sent" };
    }
    return {
      async guardNativeRetry(selected, messageId) {
        const response = await api.get(
          "/api/v1/accounts/" +
            selected.account +
            "/conversations/" +
            selected.conversation +
            "/messages",
          { timeout: 10000 },
        );
        const rows = response?.data?.payload;
        const row =
          Array.isArray(rows) && rows.find((item) => item.id === messageId);
        if (!row)
          throw Error(
            "Sending is unconfirmed. Check Chatwoot before sending anything again.",
          );
        if (row.content_attributes?.osplus_source_draft_id)
          throw Error(
            "This reviewed suggestion cannot be retried here. Check its delivery status in the conversation.",
          );
      },
      preview: (noteId) => load(noteId, scope(readPath())),
      send: (noteId, edited) =>
        claimAndRun(noteId, edited, async (ticket) => {
          try {
            const response = await api.post(
              ticket.draft.endpoint,
              {
                content: ticket.content,
                message_type: "outgoing",
                private: false,
                content_attributes: attributes(ticket.draft),
              },
              { timeout: 10000 },
            );
            return confirmReceipt(ticket, response?.data);
          } catch {
            return { status: "uncertain" };
          }
        }),
      prepareNativeSend: (noteId, edited) =>
        claimAndRun(noteId, edited, async (ticket) => ({
          status: "claimed",
          content: ticket.content,
          attributes: attributes(ticket.draft),
          confirm: (receipt) => confirmReceipt(ticket, receipt),
        })),
    };
  }
  /** Decorate only an explicitly loaded suggestion. Chatwoot keeps its own Send/keyboard/echo flow. */
  function createNativeReplyBridge({
    controller,
    readPath,
    origin,
    onStatus = () => {},
    storage,
  }) {
    let active = null;
    const tickets = new WeakMap();
    const cancel = () => {
      active = null;
    };
    function syncScope() {
      if (!active) return false;
      try {
        if (
          JSON.stringify(scope(readPath())) === JSON.stringify(active.selected)
        )
          return true;
      } catch {
        /* Left the conversation. */
      }
      cancel();
      onStatus("Suggestion tracking ended after changing conversations.");
      return false;
    }
    return {
      activate(noteId) {
        if (active)
          throw Error(
            "A suggestion is already in the reply box. Send or cancel it first.",
          );
        active = { noteId, selected: scope(readPath()) };
      },
      cancel,
      syncScope,
      isActive: () => active !== null,
      async request(config) {
        if (config.osplusDirectSend === true) return config;
        let url;
        try {
          url = new URL(config.url, origin);
        } catch {
          return config;
        }
        if (
          String(config.method).toLowerCase() !== "post" ||
          url.origin !== origin ||
          url.search
        )
          return config;
        const nativeRoute =
          /^\/api\/v1\/accounts\/([1-9][0-9]*)\/conversations\/([1-9][0-9]*)\/messages(?:\/([1-9][0-9]*)\/retry)?$/.exec(
            url.pathname,
          );
        if (!nativeRoute) return config;
        const selected = {
          account: Number(nativeRoute[1]),
          conversation: Number(nativeRoute[2]),
        };
        if (!positive(selected.account) || !positive(selected.conversation))
          return config;
        const sameActive =
          active &&
          syncScope() &&
          JSON.stringify(active.selected) === JSON.stringify(selected);
        if (nativeRoute[3]) {
          if (sameActive && active.uncertain)
            throw Error(
              "Sending is unconfirmed. Check Chatwoot before sending anything again.",
            );
          await controller.guardNativeRetry(selected, Number(nativeRoute[3]));
          return config;
        }
        const echo = config.data?.echo_id;
        const echoKey =
          typeof echo === "string" && /^[a-z0-9_-]{1,160}$/i.test(echo)
            ? "osplus.reply.echo.v1:" +
              selected.account +
              ":" +
              selected.conversation +
              ":" +
              echo
            : null;
        if (echoKey && storage?.getItem(echoKey))
          throw Error(
            "This reply was already reviewed or sending is unconfirmed. Check the conversation before sending again.",
          );
        if (!sameActive) return config;
        const endpoint =
          "/api/v1/accounts/" +
          selected.account +
          "/conversations/" +
          selected.conversation +
          "/messages";
        if (
          active.uncertain &&
          String(config.method).toLowerCase() === "post" &&
          url.origin === origin &&
          url.pathname.startsWith(endpoint + "/") &&
          /^\d+\/retry$/.test(url.pathname.slice(endpoint.length + 1))
        )
          throw Error(
            "Sending is unconfirmed. Check Chatwoot before sending anything again.",
          );
        if (
          String(config.method).toLowerCase() !== "post" ||
          url.origin !== origin ||
          url.pathname !== endpoint ||
          url.search
        )
          return config;
        const pending = active,
          data = config.data;
        if (
          data?.private === true ||
          (typeof data?.get === "function" && data.get("private") === "true")
        ) {
          cancel();
          onStatus("Suggestion tracking cancelled for the private note.");
          return config;
        }
        try {
          if (
            !data ||
            typeof data !== "object" ||
            typeof data.content !== "string" ||
            data.private !== false ||
            typeof data.get === "function" ||
            data.template_params
          )
            throw Error(
              "Cancel the suggestion before using attachments or templates in the normal reply box.",
            );
          if (!echoKey || !storage?.setItem)
            throw Error(
              "The native reply could not be tracked. Keep your text and check the conversation.",
            );
          // A failed native pending bubble reuses this echo on Retry, including after reload.
          // Persist before authorisation; cancellation must never release an ambiguous public send.
          storage.setItem(echoKey, "reviewed");
          onStatus("Checking and sending…");
          const prepared = await controller.prepareNativeSend(
            pending.noteId,
            data.content,
          );
          if (prepared.status !== "claimed" || active !== pending) {
            pending.uncertain = true;
            throw Error(
              prepared.status === "sent"
                ? "This suggestion was already sent. Check the conversation."
                : "Sending is unconfirmed. Check Chatwoot before sending anything again.",
            );
          }
          config.data = {
            ...data,
            content: prepared.content,
            content_attributes: {
              ...(data.content_attributes || {}),
              ...prepared.attributes,
            },
          };
          tickets.set(config, { prepared, pending });
          return config;
        } catch (error) {
          onStatus(
            error instanceof Error
              ? error.message
              : "Suggestion could not be authorised.",
          );
          throw error;
        }
      },
      async response(response) {
        const ticket = tickets.get(response.config);
        if (!ticket) return response;
        let result;
        try {
          result = await ticket.prepared.confirm(response.data);
        } catch {
          result = { status: "uncertain" };
        }
        tickets.delete(response.config);
        if (result.status === "sent") {
          if (active === ticket.pending) cancel();
        } else ticket.pending.uncertain = true;
        onStatus(
          result.status === "sent"
            ? "Reply sent. Check the conversation for delivery status."
            : "Sending is unconfirmed. Check Chatwoot before sending anything again.",
        );
        return response;
      },
      failure(error) {
        if (error?.config && tickets.has(error.config)) {
          tickets.get(error.config).pending.uncertain = true;
          onStatus(
            "Sending is unconfirmed. Check Chatwoot before sending anything again.",
          );
        }
        return Promise.reject(error);
      },
    };
  }
  async function fillNativeReply({ controller, noteId, composer, bridge }) {
    if (bridge.isActive())
      throw Error(
        "A suggestion is already in the reply box. Send or cancel it first.",
      );
    function check() {
      const current = composer.read();
      if (!current.available)
        throw Error(
          "The Chatwoot reply box is unavailable. Open Messages and try again.",
        );
      if (current.private)
        throw Error(
          "Select Reply in Chatwoot first. Take over the conversation if required.",
        );
      if (current.text.trim())
        throw Error(
          "The reply box already has text. Send or clear it before loading a suggestion.",
        );
    }
    check();
    const draft = await controller.preview(noteId);
    if (draft.sent) throw Error("This suggestion was already sent.");
    check(); // Staff may have typed while the native message check was in flight.
    composer.insert(draft.text);
    bridge.activate(noteId);
  }
  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      createDraftController,
      createNativeReplyBridge,
      fillNativeReply,
      scope,
      safeText,
      version,
    };
    return;
  }
  if (!host?.document || host.osplusReplyDebug) return;
  let mounted = 0,
    timer = null;
  const scriptUrl = host.document.currentScript?.src;
  function frameCoordinator() {
    let frame = null,
      ready = false,
      readyPromise = null;
    const requests = new Map();
    const origin = scriptUrl
      ? new URL(scriptUrl, host.location.href).origin
      : null;
    if (!origin)
      return {
        claim: async () => ({ status: "blocked" }),
        record: async () => ({ status: "blocked" }),
      };
    const readyWaiters = [];
    host.addEventListener("message", (event) => {
      if (
        !frame ||
        event.source !== frame.contentWindow ||
        event.origin !== origin
      )
        return;
      const payload = event.data;
      if (payload?.type === "osplus-draft-ready" && payload.version === 1) {
        ready = true;
        for (const done of readyWaiters.splice(0)) done();
      }
      if (
        payload?.type === "osplus-draft-response" &&
        uuid(payload.requestId) &&
        ["claimed", "sent", "uncertain", "blocked"].includes(payload.status)
      ) {
        const accept = requests.get(payload.requestId);
        if (accept) {
          requests.delete(payload.requestId);
          accept({ status: payload.status });
        }
      }
    });
    async function call(action, input) {
      if (!frame) {
        frame = host.document.createElement("iframe");
        frame.hidden = true;
        frame.title = "OS PLUS draft authorisation";
        frame.src = origin + "/chat/panel";
        host.document.body.append(frame);
      }
      if (!ready) {
        readyPromise ??= new Promise((resolve) => {
          const timer = host.setTimeout(() => resolve(false), 15000);
          readyWaiters.push(() => {
            host.clearTimeout(timer);
            resolve(true);
          });
        });
        if (!(await readyPromise)) return { status: "blocked" };
      }
      const requestId = host.crypto.randomUUID();
      return new Promise((resolve) => {
        const timer = host.setTimeout(() => {
          requests.delete(requestId);
          resolve({ status: "blocked" });
        }, 15000);
        requests.set(requestId, (result) => {
          host.clearTimeout(timer);
          resolve(result);
        });
        frame.contentWindow.postMessage(
          { type: "osplus-draft-request", requestId, action, input },
          origin,
        );
      });
    }
    return {
      claim: (input) => call("claim", input),
      record: (input) => call("record", input),
    };
  }
  const controller = createDraftController({
    api: {
      get: (path, options) =>
        host.axios.get(new URL(path, host.location.origin).href, options),
      post: (path, body, options) =>
        host.axios.post(new URL(path, host.location.origin).href, body, {
          ...options,
          osplusDirectSend: true,
        }),
    },
    readPath: () => host.location.pathname,
    storage: {
      getItem: (key) => host.localStorage.getItem(key),
      setItem: (key, value) => host.localStorage.setItem(key, value),
    },
    locks: host.navigator.locks,
    coordinator: frameCoordinator(),
  });
  let activeStatus = null,
    activeButtons = [],
    composerPanel = null,
    composerStatus = null,
    nativeClient = null;
  const nativeBridge = createNativeReplyBridge({
    controller,
    readPath: () => host.location.pathname,
    origin: host.location.origin,
    storage: {
      getItem: (key) => host.localStorage.getItem(key),
      setItem: (key, value) => host.localStorage.setItem(key, value),
    },
    onStatus(message) {
      if (activeStatus?.isConnected) activeStatus.textContent = message;
      if (composerStatus?.isConnected) composerStatus.textContent = message;
      if (!nativeBridge.isActive()) {
        composerPanel?.remove();
        composerPanel = null;
        composerStatus = null;
        for (const node of activeButtons)
          node.disabled = message.startsWith("Reply sent");
        activeButtons = [];
      }
    },
  });
  function attachNativeBridge() {
    const client = host.axios;
    if (
      !client?.interceptors?.request?.use ||
      !client?.interceptors?.response?.use
    )
      return false;
    if (nativeClient === client) return true;
    nativeClient = client;
    client.interceptors.request.use((config) => nativeBridge.request(config));
    client.interceptors.response.use(
      (response) => nativeBridge.response(response),
      (error) => nativeBridge.failure(error),
    );
    return true;
  }
  function composerElements() {
    const boxes = Array.from(
      host.document.querySelectorAll(".reply-box"),
    ).filter((node) => node.getClientRects().length);
    const box = boxes.length === 1 ? boxes[0] : null;
    const editors = box?.querySelectorAll(
      '.ProseMirror[contenteditable="true"]',
    );
    return { box, editor: editors?.length === 1 ? editors[0] : null };
  }
  const nativeComposer = {
    read() {
      const { box, editor } = composerElements();
      return {
        available: Boolean(box && editor),
        private: box?.classList.contains("is-private") ?? true,
        text: editor?.textContent ?? "",
      };
    },
    insert(text) {
      const { box, editor } = composerElements();
      if (
        !box ||
        !editor ||
        box.classList.contains("is-private") ||
        editor.textContent.trim()
      )
        throw Error("The reply box changed. Your existing draft was kept.");
      if (!host.DataTransfer || !host.ClipboardEvent)
        throw Error("Use the normal Chatwoot reply box in this browser.");
      editor.focus();
      const range = host.document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      const selection = host.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      // Native ProseMirror paste transaction updates Chatwoot's model and draft autosave.
      // No Vue internals, clipboard reading or second composer.
      const data = new host.DataTransfer();
      data.setData("text/plain", safeText(text));
      editor.dispatchEvent(
        new host.ClipboardEvent("paste", {
          clipboardData: data,
          bubbles: true,
          cancelable: true,
        }),
      );
      const comparable = (value) => value.replace(/\s+/g, " ").trim();
      if (comparable(editor.textContent) !== comparable(text))
        throw Error(
          "Suggestion could not be loaded. Your reply box was kept for review.",
        );
      editor.scrollIntoView({ block: "nearest" });
      editor.focus();
    },
  };
  function showComposerPanel() {
    const { box } = composerElements();
    if (!box) throw Error("The reply box changed. Open Messages again.");
    composerPanel?.remove();
    composerPanel = host.document.createElement("div");
    composerPanel.setAttribute("data-osplus-composer", version);
    composerPanel.style.cssText =
      "display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;padding:8px 12px;border-bottom:1px solid currentColor;font-size:12px";
    composerStatus = host.document.createElement("p");
    composerStatus.setAttribute("role", "status");
    composerStatus.textContent =
      "Editing suggestion. Use Chatwoot Send when ready.";
    const cancel = button("Cancel suggestion");
    cancel.addEventListener("click", () => {
      nativeBridge.cancel();
      composerPanel?.remove();
      composerPanel = null;
      composerStatus = null;
      if (activeStatus?.isConnected)
        activeStatus.textContent =
          "Suggestion tracking cancelled. Text stays in the normal staff reply box.";
      for (const node of activeButtons) node.disabled = false;
      activeButtons = [];
    });
    composerPanel.append(composerStatus, cancel);
    box.prepend(composerPanel);
  }
  function button(label) {
    const node = host.document.createElement("button");
    node.type = "button";
    node.textContent = label;
    node.style.cssText =
      "min-height:44px;padding:8px 12px;border:1px solid currentColor;border-radius:6px;font-size:14px;cursor:pointer";
    return node;
  }
  function scan() {
    nativeBridge.syncScope();
    attachNativeBridge();
    try {
      scope(host.location.pathname);
    } catch {
      return;
    }
    if (!host.axios?.get || !host.axios?.post) return;
    // The selected release uses these roots and a span.prose text child. API metadata is still authoritative.
    for (const bubble of host.document.querySelectorAll(
      ".message-bubble-container[data-message-id]",
    )) {
      if (bubble.querySelector("[data-osplus-controls]")) continue;
      const noteId = Number(bubble.getAttribute("data-message-id"));
      const content = bubble.querySelector("span.prose, div.prose");
      if (
        !content?.textContent.trimStart().startsWith(marker) ||
        !positive(noteId)
      )
        continue;
      const panel = host.document.createElement("div");
      panel.setAttribute("data-osplus-controls", version);
      panel.style.cssText =
        "display:flex;flex-direction:column;gap:8px;max-width:100%;padding:8px";
      const row = host.document.createElement("div");
      row.style.cssText = "display:flex;gap:8px;flex-wrap:wrap";
      const send = button("Send as is"),
        edit = button("Edit"),
        status = host.document.createElement("p");
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");
      status.style.cssText =
        "font-size:12px;max-width:320px;overflow-wrap:anywhere";
      let busy = false;
      async function submit(text) {
        if (busy) return;
        busy = true;
        send.disabled = true;
        edit.disabled = true;
        status.textContent = "Checking and sending…";
        try {
          const result = await controller.send(noteId, text);
          status.textContent =
            result.status === "sent"
              ? "Reply sent. Check the conversation for delivery status."
              : "Sending is unconfirmed. Check Chatwoot before sending anything again.";
        } catch (error) {
          status.textContent =
            error instanceof Error
              ? error.message
              : "Suggestion unavailable. Use the normal Chatwoot reply box.";
          send.disabled = false;
          edit.disabled = false;
          busy = false;
        }
      }
      send.addEventListener("click", () => submit());
      edit.addEventListener("click", async () => {
        if (busy) return;
        busy = true;
        try {
          if (!attachNativeBridge())
            throw Error(
              "This Chatwoot version cannot load a tracked suggestion into the reply box.",
            );
          await fillNativeReply({
            controller,
            noteId,
            composer: nativeComposer,
            bridge: nativeBridge,
          });
          activeStatus = status;
          activeButtons = [send, edit];
          send.disabled = true;
          edit.disabled = true;
          showComposerPanel();
          status.textContent =
            "Loaded in the main reply box. Edit there, then use Chatwoot Send.";
        } catch (error) {
          status.textContent =
            error instanceof Error
              ? error.message
              : "Open the normal Chatwoot reply box.";
        } finally {
          busy = false;
        }
      });
      row.append(send, edit);
      panel.append(row, status);
      content.parentElement.append(panel);
      mounted++;
    }
  }
  host.osplusReplyDebug = () => ({
    version,
    mounted,
    authenticatedClientAvailable: Boolean(host.axios),
    browserLockAvailable: Boolean(host.navigator.locks),
  });
  new host.MutationObserver(() => {
    if (timer !== null) return;
    timer = host.setTimeout(() => {
      timer = null;
      scan();
    }, 100);
  }).observe(host.document.documentElement, { childList: true, subtree: true });
  scan();
})(typeof window === "undefined" ? null : window);
