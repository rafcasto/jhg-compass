"use client";

import { MAX_DOCUMENT_CHARS, isCoachDocumentName, type CoachDocument } from "@/lib/engine/coach/turn";

export type { CoachDocument };

/** Read a CV the member picked — Markdown or plain text, in the browser (the same rule as CvPanel). */
export async function readCoachDocument(file: File): Promise<{ ok: true; document: CoachDocument } | { ok: false; error: string }> {
  if (!isCoachDocumentName(file.name)) return { ok: false, error: "CVs come in as Markdown or plain text — a .md or .txt file. Save or export yours as one." };
  try {
    const text = (await file.text()).trim();
    if (!text) return { ok: false, error: "That file looks empty." };
    if (text.length > MAX_DOCUMENT_CHARS) return { ok: false, error: `That file is too long — ${MAX_DOCUMENT_CHARS.toLocaleString()} characters at most.` };
    return { ok: true, document: { name: file.name, text } };
  } catch {
    return { ok: false, error: "Couldn't read that file." };
  }
}
