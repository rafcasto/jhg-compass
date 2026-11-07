"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { Sheet, SheetFooter } from "@/components/tracker/Sheet";
import { paths, useLiveDoc } from "@/lib/firestore/db";
import { shareDate, shareUrl, type ShareRecord, type SharePageKey } from "@/lib/jobhacking/share";
import { findJhPage } from "@/lib/jobhacking/sections";

// Share a JobHacking page — docs/UX_SHARE.md (decision 2026-11-07).
//
// The control sits in the page header (one secondary button, beside the
// title: you decide to share in front of the thing you are sharing), and the
// state sits on the page as a status line under the header once the link is
// on — with the two things you would do next, Copy link and Stop sharing, as
// text. No URL on screen: a URL is a value nobody reads; Copy puts it on the
// clipboard. Both read the owner's record (users/{uid}/shares/{page}) live, so
// the button and the line agree the moment the server writes.
//
// Red budget: Save stays the only primary on the page. In the sheet the
// primary is the one thing you came for — turn the link on, or copy it.

/** The owner's record for one page — null while the link is off. */
export function useShare(uid: string | undefined, page: SharePageKey | null): { record: ShareRecord | null; loading: boolean } {
  const { data, loading } = useLiveDoc<ShareRecord>(uid && page ? paths.share(uid, page) : null);
  return { record: data, loading: !!uid && !!page && loading };
}

async function call(method: "POST" | "DELETE", page: SharePageKey, token: string): Promise<void> {
  const res = await fetch("/api/share", { method, headers: { "Content-Type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ page }) });
  if (!res.ok) throw new Error(`Share ${method} failed (${res.status})`);
}

function useShareActions(page: SharePageKey) {
  const { user } = useAuth();
  const [busy, setBusy] = useState<"on" | "off" | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function run(method: "POST" | "DELETE") {
    if (!user) return;
    setBusy(method === "POST" ? "on" : "off"); setError(null);
    try { await call(method, page, await user.getIdToken()); }
    catch { setError("That didn't go through. Try again."); }
    finally { setBusy(null); }
  }
  return { turnOn: () => run("POST"), turnOff: () => run("DELETE"), busy, error };
}

/** Copies the current link; says "Copied" for a moment. */
function useCopy(record: ShareRecord | null) {
  const [done, setDone] = useState(false);
  useEffect(() => { if (!done) return; const t = setTimeout(() => setDone(false), 1800); return () => clearTimeout(t); }, [done]);
  async function copy() {
    if (!record) return;
    try { await navigator.clipboard.writeText(shareUrl(window.location.origin, record.token)); setDone(true); } catch { /* the sheet shows the link to select by hand */ }
  }
  return { copy, done };
}

/** The header button. Hidden while the page has nothing to share and no link is on. */
export function ShareButton({ page, record, empty = false }: { page: SharePageKey; record: ShareRecord | null; empty?: boolean }) {
  const [open, setOpen] = useState(false);
  if (empty && !record) return null;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-secondary btn-sm" aria-haspopup="dialog">
        <Share2 className="h-4 w-4" strokeWidth={1.5} aria-hidden /> Share
      </button>
      {open && <ShareSheet page={page} record={record} onClose={() => setOpen(false)} />}
    </>
  );
}

function ShareSheet({ page, record, onClose }: { page: SharePageKey; record: ShareRecord | null; onClose: () => void }) {
  const title = findJhPage(page)!.title;
  const { turnOn, turnOff, busy, error } = useShareActions(page);
  const { copy, done } = useCopy(record);
  const url = record && typeof window !== "undefined" ? shareUrl(window.location.origin, record.token) : "";

  if (!record) {
    return (
      <Sheet size="sm" title={`Share ${title}`} description="Anyone with the link can read this page as a document — exactly what is on it now, and nothing else on your account. You can switch the link off at any time." onClose={onClose}
        footer={<SheetFooter primary={{ label: "Turn on link", onClick: turnOn, busy: busy === "on", busyLabel: "Turning on…" }} secondary={{ label: "Cancel", onClick: onClose }} />}>
        {error && <p role="alert" className="text-sm text-jh-red">{error}</p>}
      </Sheet>
    );
  }

  return (
    <Sheet size="sm" title={`Share ${title}`} description="The link is on. Send it to whoever you want feedback from; they see this page as it is right now, without signing in." onClose={onClose}
      footer={<SheetFooter primary={{ label: done ? "Copied" : "Copy link", onClick: copy }} danger={{ label: "Stop sharing", onClick: turnOff, disabled: busy === "off" }} />}>
      <div className="space-y-3">
        <div>
          <label htmlFor="share-url" className="label">Link</label>
          <input id="share-url" type="text" readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="field font-mono text-sm" />
        </div>
        <p className="text-sm text-jh-mute">Shared {shareDate(record.createdAt)} · live — edits here show there.</p>
        {error && <p role="alert" className="text-sm text-jh-red">{error}</p>}
      </div>
    </Sheet>
  );
}

/** The status line under the page header while the link is on — the answer to "is this page public?" on the page itself. */
export function ShareStatus({ page, record }: { page: SharePageKey; record: ShareRecord | null }) {
  const { turnOff, busy, error } = useShareActions(page);
  const { copy, done } = useCopy(record);
  if (!record) return null;
  const action = "font-display font-semibold text-sm text-jh-ink underline-offset-2 hover:underline disabled:opacity-60";
  return (
    <p role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-jh-mute">
      <Share2 className="h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden />
      <span>Shared — anyone with the link can read this page.</span>
      <button type="button" onClick={copy} className={action}>{done ? <><Check className="inline h-3.5 w-3.5 align-[-2px]" aria-hidden /> Copied</> : <><Copy className="inline h-3.5 w-3.5 align-[-2px]" strokeWidth={1.5} aria-hidden /> Copy link</>}</button>
      <button type="button" onClick={turnOff} disabled={busy === "off"} className={action}>Stop sharing</button>
      {error && <span role="alert" className="text-jh-red">{error}</span>}
    </p>
  );
}
