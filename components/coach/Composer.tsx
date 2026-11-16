"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Paperclip, Send, X } from "lucide-react";
import { readCoachDocument, type CoachAttachment } from "./document";

// The composer (docs/UX_COACH.md §3): a textarea that grows to six lines and the one red
// button in the panel. Enter sends, Shift+Enter breaks a line. One `.icon-btn` (Paperclip)
// left of the textarea lets a CV arrive mid-conversation (docs/UX_COACH_AGENTIC.md §3): the
// attached file shows as a pill above the textarea and goes with the next turn.
export default function Composer({ onSend, disabled = false, placeholder = "Type your answer…" }: {
  onSend: (text: string, document: CoachAttachment | null) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [text, setText] = useState("");
  const [doc, setDoc] = useState<CoachAttachment | null>(null);
  const [docError, setDocError] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 6 * 24 + 16)}px`;
  }, [text]);

  const submit = () => {
    const t = text.trim();
    if ((!t && !doc) || disabled) return;
    onSend(t, doc);
    setText(""); setDoc(null);
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
  };
  const take = async (f: File | undefined) => {
    setDocError(null);
    if (!f) return;
    const r = await readCoachDocument(f);
    if (r.ok) setDoc(r.document); else setDocError(r.error);
    if (file.current) file.current.value = "";
  };

  return (
    <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      {doc && (
        <span className="pill-visible max-w-full">
          <Paperclip className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="truncate">{doc.name}</span>
          <button type="button" onClick={() => setDoc(null)} className="icon-btn icon-btn-tight -mr-3 h-8 w-8" aria-label={`Remove ${doc.name}`}><X className="h-3.5 w-3.5" aria-hidden /></button>
        </span>
      )}
      {docError && <p role="alert" className="text-sm text-jh-red">{docError}</p>}
      <div className="flex items-end gap-2">
        <input ref={file} type="file" accept=".pdf,.md,.markdown,.txt,application/pdf,text/markdown,text/plain" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => void take(e.target.files?.[0])} />
        <button type="button" onClick={() => file.current?.click()} disabled={disabled} className="icon-btn mb-0.5" aria-label="Add a document"><Paperclip className="h-5 w-5" strokeWidth={1.75} aria-hidden /></button>
        <textarea
          ref={ref}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          rows={1}
          aria-label="Your answer"
          placeholder={doc ? "Anything to add? (optional)" : placeholder}
          disabled={disabled}
          className="field min-h-[44px] flex-1 resize-none py-2.5 text-[15px] leading-6"
        />
        <button type="submit" disabled={disabled || (!text.trim() && !doc)} className="btn-primary h-11" aria-label="Send">
          <Send className="h-4 w-4" aria-hidden /> Send
        </button>
      </div>
    </form>
  );
}
