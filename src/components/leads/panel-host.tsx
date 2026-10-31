"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { parsePanelContext } from "@/features/leads/panel";
import { loadPanelLeadAction } from "@/features/leads/actions";
import type { getPanelLead } from "@/features/leads/queries";
import { LeadEditor } from "./editor";
import { LeadBusinessActions } from "./business-actions";
import { Stage, replyLabel, money, linkClass } from "./workspace";
type PanelData = NonNullable<Awaited<ReturnType<typeof getPanelLead>>>;
export function PanelHost({
  config,
}: {
  config: { origin: string; accountId: number };
}) {
  const { origin, accountId } = config;
  const [data, setData] = useState<PanelData | null>(null),
    [message, setMessage] = useState("Waiting for the Chatwoot conversation…"),
    generation = useRef(0);
  useEffect(() => {
    if (window.parent === window) return;
    let active = true;
    const listener = async (event: MessageEvent) => {
      const lookup = parsePanelContext(
        event.data,
        event.origin,
        { origin, accountId },
        event.source === window.parent,
      );
      if (!lookup) return;
      const ticket = ++generation.current;
      setData(null);
      setMessage("Loading this enquiry…");
      try {
        const result = await loadPanelLeadAction(lookup);
        if (!active || generation.current !== ticket) return;
        if (result.ok) {
          setData(result.data);
          setMessage("");
        } else setMessage(result.message);
      } catch {
        if (active && generation.current === ticket)
          setMessage("This card could not be loaded. Open Leads in OS PLUS.");
      }
    };
    window.addEventListener("message", listener);
    window.parent.postMessage("chatwoot-dashboard-app:fetch-info", origin);
    const timer = window.setTimeout(() => {
      if (active && generation.current === 0)
        setMessage(
          "The conversation could not be verified here. Open Leads in OS PLUS.",
        );
    }, 10000);
    return () => {
      active = false;

      window.clearTimeout(timer);
      window.removeEventListener("message", listener);
    };
  }, [origin, accountId]);
  return (
    <div className="space-y-4">
      {message ? (
        <p role="status" className="text-sm">
          {message}
        </p>
      ) : null}
      {data ? (
        <>
          <div className="space-y-2">
            <h2 className="break-words text-lg font-semibold">
              {data.lead.name}
            </h2>
            <p className="text-xs text-muted-foreground">
              {data.lead.reference} · {data.lead.channel}
            </p>
            <Stage value={data.lead.stage} />
            <p className="text-sm">
              {money(data.lead.estimatedValue, data.lead.currency)}
            </p>
            <p className="text-sm">{replyLabel(data.lead)}</p>
          </div>
          <LeadEditor
            key={data.lead.id + ":" + data.lead.version}
            lead={data.lead}
            owners={data.owners}
            onSaved={() =>
              window.parent.postMessage(
                "chatwoot-dashboard-app:fetch-info",
                config.origin,
              )
            }
          />
          {data.actions ? (
            <LeadBusinessActions
              data={data.actions}
              owners={data.owners}
              onSaved={() =>
                window.parent.postMessage(
                  "chatwoot-dashboard-app:fetch-info",
                  config.origin,
                )
              }
            />
          ) : null}
          <Link
            className={linkClass}
            href={"/leads/" + data.lead.id}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open lead in OS PLUS ↗
          </Link>
        </>
      ) : (
        <Link
          className={linkClass}
          href="/leads"
          target="_blank"
          rel="noopener noreferrer"
        >
          Open Leads in OS PLUS ↗
        </Link>
      )}
    </div>
  );
}
