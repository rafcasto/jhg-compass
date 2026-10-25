"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Shared bottom-sheet (mobile) / centred modal (desktop) used by every Progress-tab
// form: add / edit job, add / edit contact, reminders, job detail and CSV import.
// Proper dialog semantics: aria-modal, Esc closes, focus moves in on open and is
// trapped while open, and returns to the opener on close.
export function Sheet({ title, onClose, children, wide }: {
  title: string; onClose: () => void; children: React.ReactNode; wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const opener = document.activeElement as HTMLElement | null;
    // Focus the first field if there is one, else the dialog itself.
    const first = el.querySelector<HTMLElement>("input, select, textarea") ?? el;
    if (first === el) el.setAttribute("tabindex", "-1");
    // autoFocus inputs win; only move focus if nothing inside already has it.
    if (!el.contains(document.activeElement)) first.focus({ preventScroll: true });

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); return; }
      if (e.key !== "Tab" || !el) return;
      const nodes = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((n) => n.offsetParent !== null);
      if (nodes.length === 0) return;
      const firstNode = nodes[0], lastNode = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === firstNode) { e.preventDefault(); lastNode.focus(); }
      else if (!e.shiftKey && document.activeElement === lastNode) { e.preventDefault(); firstNode.focus(); }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      opener?.focus?.({ preventScroll: true });
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-jh-ink/60 sm:place-items-center sm:p-4" onClick={onClose}>
      <div ref={ref} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}
        className={`card w-full ${wide ? "sm:max-w-lg" : "sm:max-w-md"} max-h-[90vh] space-y-4 overflow-auto rounded-b-none rounded-t-md p-6 sm:rounded-md`}>
        <div className="flex items-start justify-between gap-4">
          <h3 className="text-lg leading-snug">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="icon-btn icon-btn-tight -mt-2.5">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
