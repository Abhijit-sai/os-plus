"use client";

import * as React from "react";
import { LoaderCircle } from "lucide-react";

type ActionFeedbackContextValue = {
  finishAction: (id: string) => void;
  isBusy: boolean;
  startAction: (id: string, label?: string) => void;
};

const ActionFeedbackContext = React.createContext<ActionFeedbackContextValue | null>(null);
const navigationActionId = "route-navigation";

function isEligibleNavigationClick(event: MouseEvent) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return null;
  }

  const target = event.target;
  if (!(target instanceof Element)) {
    return null;
  }

  const anchor = target.closest("a[href]");
  if (!(anchor instanceof HTMLAnchorElement) || anchor.target === "_blank" || anchor.hasAttribute("download")) {
    return null;
  }

  const destination = new URL(anchor.href, window.location.href);
  if (destination.origin !== window.location.origin) {
    return null;
  }

  const current = new URL(window.location.href);
  if (
    destination.pathname === current.pathname &&
    destination.search === current.search &&
    destination.hash === current.hash
  ) {
    return null;
  }

  if (
    destination.pathname === current.pathname &&
    destination.search === current.search &&
    destination.hash
  ) {
    return null;
  }

  return destination;
}

export function ActionFeedbackProvider({ children }: { children: React.ReactNode }) {
  const [activeActions, setActiveActions] = React.useState<Map<string, string>>(() => new Map());
  const interactiveRootRef = React.useRef<HTMLDivElement>(null);

  const startAction = React.useCallback((id: string, label = "Working...") => {
    setActiveActions((current) => {
      const next = new Map(current);
      next.set(id, label);
      return next;
    });
  }, []);

  const finishAction = React.useCallback((id: string) => {
    setActiveActions((current) => {
      if (!current.has(id)) {
        return current;
      }

      const next = new Map(current);
      next.delete(id);
      return next;
    });
  }, []);

  React.useEffect(() => {
    const root = interactiveRootRef.current;
    if (!root) {
      return;
    }

    root.inert = activeActions.size > 0;
    root.setAttribute("aria-busy", activeActions.size > 0 ? "true" : "false");

    return () => {
      root.inert = false;
      root.setAttribute("aria-busy", "false");
    };
  }, [activeActions.size]);

  React.useEffect(() => {
    function handleClick(event: MouseEvent) {
      const destination = isEligibleNavigationClick(event);
      if (!destination) {
        return;
      }

      const startingHref = window.location.href;
      startAction(navigationActionId, "Opening page...");

      const startedAt = Date.now();
      const timer = window.setInterval(() => {
        if (window.location.href !== startingHref || Date.now() - startedAt > 15000) {
          window.clearInterval(timer);
          finishAction(navigationActionId);
        }
      }, 50);
    }

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [finishAction, startAction]);

  const activeLabel = Array.from(activeActions.values()).at(-1) ?? "Working...";
  const isBusy = activeActions.size > 0;
  const contextValue = React.useMemo(
    () => ({ finishAction, isBusy, startAction }),
    [finishAction, isBusy, startAction],
  );

  return (
    <ActionFeedbackContext.Provider value={contextValue}>
      <div ref={interactiveRootRef}>{children}</div>
      {isBusy ? (
        <>
          <div className="fixed inset-0 z-[90] cursor-progress bg-background/20" aria-hidden="true" />
          <div className="fixed inset-x-0 top-0 z-[100] h-1 overflow-hidden bg-primary/15" aria-hidden="true">
            <div className="h-full w-1/3 animate-[pulse_900ms_ease-in-out_infinite] bg-primary motion-reduce:animate-none" />
          </div>
          <div
            role="status"
            aria-live="polite"
            className="fixed right-4 top-4 z-[100] inline-flex min-h-10 items-center gap-2 rounded-md border bg-background px-3 text-sm font-medium shadow-lg"
          >
            <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            {activeLabel}
          </div>
        </>
      ) : null}
    </ActionFeedbackContext.Provider>
  );
}

export function useActionFeedback() {
  return React.useContext(ActionFeedbackContext);
}
