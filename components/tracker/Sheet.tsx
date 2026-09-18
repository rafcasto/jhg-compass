"use client";

import { X } from "lucide-react";

// Shared bottom-sheet (mobile) / centred modal (desktop) used by every Progress-tab
// form: add / edit job, add / edit contact, reminders, job detail and CSV import.
export function Sheet({ title, onClose, children, wide }: {
  title: string; onClose: () => void; children: React.ReactNode; wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-end sm:place-items-center bg-jh-ink/60 sm:p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}
        className={`card w-full ${wide ? "sm:max-w-lg" : "sm:max-w-md"} p-6 space-y-3 rounded-b-none sm:rounded-lg max-h-[90vh] overflow-auto`}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg leading-snug pr-4">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Close"><X className="h-5 w-5 text-jh-mute" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
