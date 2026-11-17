"use client";

import { MAX_DOCUMENT_CHARS, MAX_PDF_BYTES, isCoachDocumentName, isPdfName, type CoachDocument, type CoachPdf } from "@/lib/engine/coach/turn";
import { MAX_CONNECTIONS_CHARS, isConnectionsCsv, isConnectionsFileName } from "@/lib/engine/coach/connections";

export type { CoachDocument, CoachPdf };
/** What the composer sends: the text of a .md/.txt, or the bytes of a .pdf (transcribed server-side). */
export type CoachAttachment = CoachDocument | CoachPdf;
export const isPdfAttachment = (a: CoachAttachment): a is CoachPdf => "pdfBase64" in a;

/** LinkedIn's Connections.csv (docs/UX_COACH_COMPANY_SCORING.md §3) — read in the browser, parsed and matched on the server, never shown to the model. */
export interface ConnectionsAttachment { kind: "connections"; name: string; text: string }
/** What the composer's Paperclip takes: a document for the coach, or the connections export for the portal. */
export type ComposerAttachment = CoachAttachment | ConnectionsAttachment;
export const isConnectionsAttachment = (a: ComposerAttachment): a is ConnectionsAttachment => "kind" in a && a.kind === "connections";

export async function readConnectionsFile(file: File): Promise<{ ok: true; connections: ConnectionsAttachment } | { ok: false; error: string }> {
  if (!isConnectionsFileName(file.name)) return { ok: false, error: "Your connections come as LinkedIn's Connections.csv." };
  if (file.size > MAX_CONNECTIONS_CHARS) return { ok: false, error: "That file is too large to be a connections export." };
  try {
    const text = await file.text();
    if (!isConnectionsCsv(text)) return { ok: false, error: "That isn't LinkedIn's Connections.csv — export it from LinkedIn → Settings → Data privacy → Get a copy of your data → Connections." };
    return { ok: true, connections: { kind: "connections", name: file.name, text } };
  } catch { return { ok: false, error: "Couldn't read that file." }; }
}

/** Either attachment from one file picker. */
export async function readComposerFile(file: File): Promise<{ ok: true; attachment: ComposerAttachment } | { ok: false; error: string }> {
  if (isConnectionsFileName(file.name)) { const r = await readConnectionsFile(file); return r.ok ? { ok: true, attachment: r.connections } : r; }
  const r = await readCoachDocument(file);
  return r.ok ? { ok: true, attachment: r.document } : r;
}

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
