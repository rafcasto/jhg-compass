"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Send } from "lucide-react";

// The composer (docs/UX_COACH.md §3): a textarea that grows to six lines and the one red
// button in the panel. Enter sends, Shift+Enter breaks a line.
export default function Composer({ onSend, disabled = false, placeholder = "Type your answer…" }: {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 6 * 24 + 16)}px`;
  }, [text]);

  const submit = () => {
    const t = text.trim();
    if (!t || disabled) return;
    onSend(t);
    setText("");
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
  };

  return (
    <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <textarea
        ref={ref}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKey}
        rows={1}
        aria-label="Your answer"
        placeholder={placeholder}
        disabled={disabled}
        className="field min-h-[44px] flex-1 resize-none py-2.5 text-[15px] leading-6"
      />
      <button type="submit" disabled={disabled || !text.trim()} className="btn-primary h-11 px-4" aria-label="Send">
        <Send className="h-4 w-4" aria-hidden /> Send
      </button>
    </form>
  );
}
