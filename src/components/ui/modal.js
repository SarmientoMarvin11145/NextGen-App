"use client";

import { useEffect, useRef } from "react";
import { Icon } from "./icon";
import { BTN_QUIET, BTN_ICON, MICRO } from "@/lib/ui";

// Accessible dialog used by the admin forms (sessions, scanner assignment).
// Focus moves to the panel on open, Escape closes it, and the backdrop click
// is disabled while a save is in flight so work is never discarded by accident.
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  busy = false,
  labelledBy = "modal-title",
}) {
  const panelRef = useRef(null);
  const previouslyFocusedRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    previouslyFocusedRef.current = document.activeElement;
    const panel = panelRef.current;
    const focusable = panel?.querySelector(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    (focusable || panel)?.focus();

    const onKeyDown = (event) => {
      if (event.key === "Escape" && !busy) onClose?.();
      if (event.key !== "Tab" || !panel) return;

      const items = Array.from(
        panel.querySelectorAll(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (items.length === 0) return;

      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previouslyFocusedRef.current instanceof HTMLElement) {
        previouslyFocusedRef.current.focus();
      }
    };
  }, [open, onClose, busy]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="presentation"
    >
      <button
        type="button"
        aria-label="Close dialog"
        onClick={() => {
          if (!busy) onClose?.();
        }}
        className="absolute inset-0 h-full w-full cursor-default bg-slate-950/45 backdrop-blur-[2px]"
        tabIndex={-1}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className="animate-rise relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-slate-200 bg-white shadow-2xl outline-none sm:max-w-lg sm:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <p className={MICRO}>Details</p>
            <h2 id={labelledBy} className="mt-1 text-base font-semibold tracking-[-0.02em] text-slate-950">
              {title}
            </h2>
            {description ? (
              <p className="mt-1 text-[13px] leading-5 text-slate-500">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => onClose?.()}
            disabled={busy}
            aria-label="Close"
            className={`${BTN_QUIET} ${BTN_ICON} -mr-2 shrink-0`}
          >
            <Icon name="x" className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 py-5 sm:px-6">{children}</div>

        {footer ? (
          <div className="flex flex-col-reverse gap-2 border-t border-slate-100 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
