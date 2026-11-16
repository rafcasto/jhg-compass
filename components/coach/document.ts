"use client";

import { MAX_DOCUMENT_CHARS, MAX_PDF_BYTES, isCoachDocumentName, isPdfName, type CoachDocument, type CoachPdf } from "@/lib/engine/coach/turn";

export type { CoachDocument, CoachPdf };
/** What the composer sends: the text of a .md/.txt, or the bytes of a .pdf (transcribed server-side). */
export type CoachAttachment = CoachDocument | CoachPdf;
export const isPdfAttachment = (a: CoachAttachment): a is CoachPdf => "pdfBase64" in a;

const toBase64 = (buf: ArrayBuffer): string => {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};

/** Read a CV the member picked — Markdown or plain text in the browser (the same rule as CvPanel), or a PDF as bytes. */
export async function readCoachDocument(file: File): Promise<{ ok: true; document: CoachAttachment } | { ok: false; error: string }> {
  if (!isCoachDocumentName(file.name)) return { ok: false, error: "CVs come in as a PDF, Markdown or plain text — a .pdf, .md or .txt file." };
  if (isPdfName(file.name)) {
    if (file.size > MAX_PDF_BYTES) return { ok: false, error: `That PDF is too large — ${Math.round(MAX_PDF_BYTES / 1024 / 1024)} MB at most.` };
    if (!file.size) return { ok: false, error: "That file looks empty." };
    try { return { ok: true, document: { name: file.name, pdfBase64: toBase64(await file.arrayBuffer()) } }; }
    catch { return { ok: false, error: "Couldn't read that file." }; }
  }
  try {
    const text = (await file.text()).trim();
    if (!text) return { ok: false, error: "That file looks empty." };
    if (text.length > MAX_DOCUMENT_CHARS) return { ok: false, error: `That file is too long — ${MAX_DOCUMENT_CHARS.toLocaleString()} characters at most.` };
    return { ok: true, document: { name: file.name, text } };
  } catch {
    return { ok: false, error: "Couldn't read that file." };
  }
}
