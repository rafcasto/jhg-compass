"use client";

import { createContext, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, X } from "lucide-react";
import { useContent } from "@/lib/firestore/content";

// Shared bottom-sheet (mobile) / centred modal (desktop) used by every Progress-tab
// dialog: add / edit job, add / edit contact, reminders, job detail and CSV import.
//
// Anatomy — three parts so the title and the actions never scroll away:
//   header (sticky)  ← back · eyebrow · title · description · headerActions · ×
//   body   (scrolls)
//   footer (sticky)  SheetFooter: [danger ←] [secondary ghost] [primary]
//
// Behaviour:
//   • A module-level stack: only the TOP sheet handles Esc / Tab, only the BOTTOM
//     one paints the scrim, and the page stops scrolling while any sheet is open.
//     (Two sheets each listening on `document` was how Esc in "Edit job" used to
//     close the job detail underneath it as well.)
//   • `dirty` makes a backdrop click a no-op so a stray click can't discard a
//     half-filled form. Esc and × still close.
//   • Focus moves to the first field on open (and again whenever `viewKey`
//     changes, for sheets that swap views in place) and returns to the opener on close.
//   • `dvh` + safe-area padding so the footer sits above the iOS keyboard / home bar.

export type SheetSize = "sm" | "md" | "lg";
export type SheetCloseReason = "esc" | "backdrop" | "button";

const SIZE: Record<SheetSize, string> = { sm: "sm:max-w-sm", md: "sm:max-w-md", lg: "sm:max-w-xl" };
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// ---- stack registry -----------------------------------------------------------
interface Entry { el: HTMLElement; close: (reason: SheetCloseReason) => void }
const stack: Entry[] = [];
let keyBound = false;

// The top-most sheet is the last one in DOCUMENT order (a sheet rendered inside
// another, or opened after it). Push order can't be trusted: React runs a child's
// effects before its parent's, so a nested sheet registers first.
function topEntry(): Entry | undefined {
  return stack.reduce<Entry | undefined>((best, e) =>
    !best || (best.el.compareDocumentPosition(e.el) & Node.DOCUMENT_POSITION_FOLLOWING) ? e : best, undefined);
}
function isBottom(entry: Entry): boolean {
  return stack.every((e) => e === entry || (entry.el.compareDocumentPosition(e.el) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0);
}

function onDocKey(e: KeyboardEvent) {
  const top = topEntry();
  if (!top) return;
  if (e.key === "Escape") { e.preventDefault(); top.close("esc"); return; }
  if (e.key !== "Tab") return;
  const nodes = Array.from(top.el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((n) => n.offsetParent !== null);
  if (nodes.length === 0) return;
  const first = nodes[0], last = nodes[nodes.length - 1];
  const active = document.activeElement;
  if (e.shiftKey && (active === first || !top.el.contains(active))) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && (active === last || !top.el.contains(active))) { e.preventDefault(); first.focus(); }
}

function push(entry: Entry) {
  stack.push(entry);
  if (!keyBound) { document.addEventListener("keydown", onDocKey); keyBound = true; }
  document.body.style.overflow = "hidden";
}
function pop(entry: Entry) {
  const i = stack.indexOf(entry);
  if (i >= 0) stack.splice(i, 1);
  if (stack.length === 0) {
    document.removeEventListener("keydown", onDocKey); keyBound = false;
    document.body.style.overflow = "";
  }
}

// ---- footer / dirty slot ----------------------------------------------------------
// A body view can own its footer and dirty flag (e.g. the job-detail sheet swaps
// between detail / edit / new-contact views in place; each view supplies its own
// footer through this slot instead of nesting a second sheet).
interface Slot { setFooter: (n: ReactNode) => void; setDirty: (d: boolean) => void }
const SlotCtx = createContext<Slot | null>(null);
export function useSheetSlot(footer: ReactNode, dirty: boolean) {
  const ctx = useContext(SlotCtx);
  useEffect(() => { ctx?.setFooter(footer); }, [ctx, footer]);
  useEffect(() => { ctx?.setDirty(dirty); }, [ctx, dirty]);
  useEffect(() => () => { ctx?.setFooter(null); ctx?.setDirty(false); }, [ctx]);
}

// ---- Sheet ----------------------------------------------------------------------
export function Sheet({
  title, onClose, children, size = "md", eyebrow, description, onBack, headerActions, footer, dirty = false, viewKey, bodyClassName = "",
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** sm 24rem (confirm) · md 28rem (forms) · lg 36rem (detail, import). One size per flow. */
  size?: SheetSize;
  /** Small uppercase line above the title — a step ("Step 1 of 3") or a parent record (company). */
  eyebrow?: string;
  description?: string;
  /** Renders a ← button; use when the sheet swaps views in place instead of nesting. */
  onBack?: () => void;
  headerActions?: ReactNode;
  footer?: ReactNode;
  /** When true a backdrop click does nothing (Esc and × still close). */
  dirty?: boolean;
  /** Change to re-run focus-in, e.g. when the sheet switches from detail to an edit view. */
  viewKey?: string;
  bodyClassName?: string;
}) {
  const { t } = useContent();
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  // Only the bottom sheet paints the scrim. Read at first render (a sheet opened over
  // an existing one sees it in the stack) and confirmed once registered.
  const [bottom, setBottom] = useState(() => stack.length === 0);
  const [slotFooter, setSlotFooter] = useState<ReactNode>(null);
  const [slotDirty, setSlotDirty] = useState(false);
  const slot = useMemo<Slot>(() => ({ setFooter: setSlotFooter, setDirty: setSlotDirty }), []);
  const isDirty = dirty || slotDirty;
  const footerNode = footer ?? slotFooter;

  // Latest callbacks without re-registering the entry.
  const closeRef = useRef<(r: SheetCloseReason) => void>(() => {});
  closeRef.current = (reason) => {
    if (reason === "backdrop" && isDirty) return;
    onClose();
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const opener = document.activeElement as HTMLElement | null;
    const entry: Entry = { el, close: (r) => closeRef.current(r) };
    push(entry);
    setBottom(isBottom(entry));
    return () => {
      pop(entry);
      opener?.focus?.({ preventScroll: true });
    };
  }, []);

  // Focus the first field on open and whenever the view inside the sheet changes.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const first = el.querySelector<HTMLElement>("input, select, textarea") ?? el;
    if (first === el) el.setAttribute("tabindex", "-1");
    if (!el.contains(document.activeElement) || viewKey !== undefined) first.focus({ preventScroll: true });
  }, [viewKey]);

  return (
    <div
      className={`fixed inset-0 z-50 grid place-items-end sm:place-items-center sm:p-4 ${bottom ? "bg-jh-ink/60" : "bg-transparent"}`}
      onClick={() => closeRef.current("backdrop")}>
      <div ref={ref} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true"
        aria-labelledby={titleId} aria-describedby={description ? descId : undefined}
        className={`flex w-full max-h-[92dvh] flex-col rounded-t-lg bg-white shadow-jh-3 motion-safe:animate-sheet-in sm:rounded-lg ${SIZE[size]}`}>
        {/* Drag-handle affordance on the bottom sheet only */}
        <span className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-pill bg-jh-line-2 sm:hidden" aria-hidden />

        <header className="flex items-start gap-2 border-b border-jh-line px-6 pb-4 pt-4 sm:pt-5">
          {onBack && (
            <button type="button" onClick={onBack} aria-label={t("tracker.back")} className="icon-btn icon-btn-tight -ml-2 mt-0">
              <ArrowLeft className="h-5 w-5" strokeWidth={1.5} aria-hidden />
            </button>
          )}
          <div className="min-w-0 flex-1">
            {eyebrow && <p className="section-label mb-1 truncate">{eyebrow}</p>}
            <h3 id={titleId} className="text-lg leading-snug">{title}</h3>
            {description && <p id={descId} className="mt-1 text-sm leading-relaxed text-jh-mute">{description}</p>}
          </div>
          {headerActions && <div className="flex shrink-0 items-center gap-1 -mr-1">{headerActions}</div>}
          <button type="button" onClick={() => closeRef.current("button")} aria-label={t("tracker.close")} className="icon-btn icon-btn-tight -mr-2">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </header>

        <SlotCtx.Provider value={slot}>
          <div className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5 ${bodyClassName}`}>{children}</div>
        </SlotCtx.Provider>

        {footerNode && (
          <footer className="border-t border-jh-line bg-white px-6 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {footerNode}
          </footer>
        )}
      </div>
    </div>
  );
}

// ---- Footer ---------------------------------------------------------------------
// ONE footer system: primary on the right (top on mobile), secondary as a ghost,
// optional destructive action pushed to the far left. The primary can submit a form
// that lives in the body via `form={id}` so it stays sticky.
export interface FooterAction { label: string; onClick?: () => void; disabled?: boolean }
export interface FooterPrimary extends FooterAction { form?: string; busy?: boolean; busyLabel?: string }

export function SheetFooter({ primary, secondary, danger }: {
  primary: FooterPrimary; secondary?: FooterAction; danger?: FooterAction;
}) {
  return (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
      {danger && (
        <button type="button" onClick={danger.onClick} disabled={danger.disabled}
          className="btn-ghost text-jh-red sm:mr-auto">{danger.label}</button>
      )}
      {secondary && (
        <button type="button" onClick={secondary.onClick} disabled={secondary.disabled}
          className={`btn-ghost text-jh-ink hover:bg-jh-mist hover:text-jh-ink ${danger ? "" : "sm:ml-auto"}`}>{secondary.label}</button>
      )}
      <button type={primary.form ? "submit" : "button"} form={primary.form} onClick={primary.onClick}
        disabled={primary.disabled || primary.busy}
        className={`btn-primary ${secondary || danger ? "" : "sm:ml-auto"}`}>
        {primary.busy ? (primary.busyLabel ?? primary.label) : primary.label}
      </button>
    </div>
  );
}

// ---- Inline confirm --------------------------------------------------------------
// Destructive confirmation stays INSIDE the sheet as a band (no modal-on-modal).
export function ConfirmBand({ text, confirmLabel, cancelLabel, onConfirm, onCancel, busy }: {
  text: string; confirmLabel: string; cancelLabel: string; onConfirm: () => void; onCancel: () => void; busy?: boolean;
}) {
  return (
    <div role="alertdialog" aria-label={text} className="flex flex-col gap-3 rounded-sm bg-jh-red-soft p-4 sm:flex-row sm:items-center">
      <p className="flex-1 text-sm font-medium text-jh-ink">{text}</p>
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="btn-secondary btn-sm flex-1 sm:flex-none">{cancelLabel}</button>
        <button type="button" onClick={onConfirm} disabled={busy} autoFocus
          className="btn btn-sm flex-1 bg-jh-red text-white hover:bg-jh-red-hover sm:flex-none">{confirmLabel}</button>
      </div>
    </div>
  );
}
