"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

const unsavedMessage =
  "You have unsaved changes. Leave this page and discard them?";

type UnsavedChangesContextValue = {
  confirmIfUnsavedChanges: () => boolean;
  hasUnsavedChanges: () => boolean;
};

const UnsavedChangesContext = createContext<UnsavedChangesContextValue>({
  confirmIfUnsavedChanges: () => true,
  hasUnsavedChanges: () => false,
});

function getDirtyForms() {
  if (typeof document === "undefined") {
    return [];
  }

  return Array.from(
    document.querySelectorAll<HTMLFormElement>(
      'form[data-unsaved-guard="true"][data-unsaved-dirty="true"]',
    ),
  );
}

function markFormDirty(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return;
  }

  if (target.closest('[data-unsaved-ignore="true"]')) {
    return;
  }

  const form = target.closest<HTMLFormElement>(
    'form[data-unsaved-guard="true"]',
  );

  if (form) {
    form.dataset.unsavedDirty = "true";
  }
}

function markFormClean(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return;
  }

  const form = target.closest<HTMLFormElement>(
    'form[data-unsaved-guard="true"]',
  );

  if (form) {
    delete form.dataset.unsavedDirty;
  }
}

function markAllFormsClean() {
  for (const form of getDirtyForms()) {
    delete form.dataset.unsavedDirty;
  }
}

export function UnsavedChangesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [, setDirtyVersion] = useState(0);

  const hasUnsavedChanges = useCallback(() => getDirtyForms().length > 0, []);

  const confirmIfUnsavedChanges = useCallback(() => {
    if (!hasUnsavedChanges()) {
      return true;
    }

    const shouldLeave = window.confirm(unsavedMessage);

    if (shouldLeave) {
      markAllFormsClean();
      setDirtyVersion((version) => version + 1);
    }

    return shouldLeave;
  }, [hasUnsavedChanges]);

  useEffect(() => {
    function handleFormChange(event: Event) {
      markFormDirty(event.target);
      setDirtyVersion((version) => version + 1);
    }

    function handleFormSubmit(event: Event) {
      const form = event.target instanceof HTMLFormElement ? event.target : null;
      if (form?.dataset.preserveDirtyOnSubmit === "true") {
        return;
      }
      markFormClean(event.target);
      setDirtyVersion((version) => version + 1);
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!hasUnsavedChanges()) {
        return;
      }

      event.preventDefault();
      event.returnValue = "";
    }

    function handleDocumentClick(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      const anchor = target.closest<HTMLAnchorElement>("a[href]");

      if (
        !anchor ||
        anchor.target === "_blank" ||
        anchor.hasAttribute("download")
      ) {
        return;
      }

      const href = anchor.getAttribute("href");

      if (
        !href ||
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:")
      ) {
        return;
      }

      if (!hasUnsavedChanges()) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (!confirmIfUnsavedChanges()) {
        return;
      }

      const url = new URL(anchor.href);

      if (url.origin === window.location.origin) {
        router.push(`${url.pathname}${url.search}${url.hash}`);
      } else {
        window.location.assign(anchor.href);
      }
    }

    document.addEventListener("input", handleFormChange, true);
    document.addEventListener("change", handleFormChange, true);
    document.addEventListener("submit", handleFormSubmit, true);
    document.addEventListener("click", handleDocumentClick, true);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      document.removeEventListener("input", handleFormChange, true);
      document.removeEventListener("change", handleFormChange, true);
      document.removeEventListener("submit", handleFormSubmit, true);
      document.removeEventListener("click", handleDocumentClick, true);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [confirmIfUnsavedChanges, hasUnsavedChanges, router]);

  const value = useMemo(
    () => ({
      confirmIfUnsavedChanges,
      hasUnsavedChanges,
    }),
    [confirmIfUnsavedChanges, hasUnsavedChanges],
  );

  return (
    <UnsavedChangesContext.Provider value={value}>
      {children}
    </UnsavedChangesContext.Provider>
  );
}

export function useUnsavedChanges() {
  return useContext(UnsavedChangesContext);
}
