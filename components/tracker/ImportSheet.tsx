"use client";

import { useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Upload } from "lucide-react";
import { Sheet } from "./Sheet";
import { useContent } from "@/lib/firestore/content";
import { fillTemplate } from "@/lib/content";
import { importRecords } from "@/lib/firestore/db";
import { track } from "@/lib/track-client";
import { TAGS } from "@/lib/tags";
import { CONTACT_TYPES, CONTACT_TYPE_TKEY, normalizeContactType, type ContactType } from "@/lib/contacts";
import {
  CONTACT_COLUMNS, OPPORTUNITY_COLUMNS, MAX_IMPORT_ROWS,
  contactsCsvTemplate, opportunitiesCsvTemplate, templateFile,
  parseContactsCsv, parseOpportunitiesCsv,
  type ContactDoc, type ImportResult, type OpportunityDoc,
} from "@/lib/import";
import type { Contact, Opportunity } from "@/lib/types";

export type ImportKind = "contacts" | "opportunities";

const PREVIEW_ROWS = 5;
const MAX_ISSUES = 12;

// Read a File as text — File.text() everywhere modern, FileReader as a fallback.
function readText(f: File): Promise<string> {
  if (typeof f.text === "function") return f.text();
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ""));
    r.onerror = () => reject(r.error);
    r.readAsText(f);
  });
}

function downloadCsv(filename: string, csv: string) {
  if (typeof URL.createObjectURL !== "function") return; // jsdom / SSR guard
  const blob = new Blob([templateFile(csv)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// Three steps: pick (file or paste) → preview (counts, issues, sample) → done.
export default function ImportSheet({ kind, uid, contacts, opps, onClose }: {
  kind: ImportKind; uid: string; contacts: Contact[]; opps: Opportunity[]; onClose: () => void;
}) {
  const { t, stages } = useContent();
  const [pasting, setPasting] = useState(false);
  const [pasted, setPasted] = useState("");
  const [result, setResult] = useState<ImportResult<ContactDoc> | ImportResult<OpportunityDoc> | null>(null);
  const [skipDup, setSkipDup] = useState(true);
  const [busy, setBusy] = useState(false);
  const [imported, setImported] = useState<number | null>(null);
  const [readError, setReadError] = useState<string | null>(null);

  const columns = kind === "contacts" ? CONTACT_COLUMNS : OPPORTUNITY_COLUMNS;
  const typeLabels = useMemo(() => Object.fromEntries(CONTACT_TYPES.map((ct) => [ct, t(CONTACT_TYPE_TKEY[ct])])) as Record<ContactType, string>, [t]);
  const stageLabel = (id: string) => stages.find((s) => s.id === id)?.label ?? id;

  function parse(text: string) {
    setReadError(null);
    setResult(kind === "contacts"
      ? parseContactsCsv(text, { existing: contacts, typeLabels })
      : parseOpportunitiesCsv(text, { stages, contacts, existing: opps }));
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try { parse(await readText(f)); }
    catch { setReadError("Couldn't read that file."); }
  }

  function download() {
    downloadCsv(`${kind}-template.csv`, kind === "contacts" ? contactsCsvTemplate() : opportunitiesCsvTemplate(stages));
  }

  const dupCount = result?.rows.filter((r) => r.duplicate).length ?? 0;
  const toImport = useMemo(() => (result?.rows ?? []).filter((r) => !(skipDup && r.duplicate)), [result, skipDup]);
  const warnings = useMemo(() => (result?.rows ?? []).flatMap((r) => r.warnings.map((w) => ({ line: r.line, message: w }))), [result]);

  async function doImport() {
    if (!result || toImport.length === 0) return;
    setBusy(true);
    try {
      const n = await importRecords(uid, kind, toImport.map((r) => r.data as Record<string, unknown>));
      track(kind === "contacts" ? TAGS.IMPORT_CONTACTS : TAGS.IMPORT_OPPORTUNITIES, {
        props: { count: n, skippedErrors: result.errors.length, skippedDuplicates: skipDup ? dupCount : 0 },
      });
      setImported(n);
    } finally { setBusy(false); }
  }

  const title = t(`import.${kind}.title`);

  // ---- done ----
  if (imported !== null) {
    return (
      <Sheet title={title} onClose={onClose}>
        <div className="py-6 text-center space-y-3">
          <CheckCircle2 className="mx-auto h-10 w-10 text-rb-green-dark" />
          <p className="text-sm text-jh-ink">{fillTemplate(t(`import.${kind}.done`), { n: imported })}</p>
          <button onClick={onClose} className="btn-primary w-full">{t("import.close")}</button>
        </div>
      </Sheet>
    );
  }

  // ---- preview ----
  if (result) {
    const blocked = result.missingColumns.length > 0 || result.totalRows === 0;
    return (
      <Sheet title={title} onClose={onClose} wide>
        <div className="space-y-4">
          {result.missingColumns.length > 0 && (
            <Issue>{fillTemplate(t("import.missingColumns"), { cols: result.missingColumns.join(", ") })}</Issue>
          )}
          {result.totalRows === 0 && result.missingColumns.length === 0 && <Issue>{t("import.empty")}</Issue>}

          {!blocked && (
            <>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className="inline-flex items-center gap-1 font-display font-semibold text-jh-ink">
                  <CheckCircle2 className="h-4 w-4 text-rb-green-dark" /> {fillTemplate(t("import.ready"), { n: toImport.length })}
                </span>
                {result.errors.length > 0 && (
                  <span className="inline-flex items-center gap-1 text-jh-red">
                    <AlertCircle className="h-4 w-4" /> {fillTemplate(t("import.errors"), { n: result.errors.length })}
                  </span>
                )}
              </div>
              {result.tooMany && <p className="text-xs text-jh-mute">{fillTemplate(t("import.tooMany"), { n: MAX_IMPORT_ROWS })}</p>}
              {dupCount > 0 && (
                <label className="flex items-center gap-2 text-sm text-jh-ink">
                  <input type="checkbox" checked={skipDup} onChange={(e) => setSkipDup(e.target.checked)} className="h-4 w-4 accent-jh-red" />
                  {fillTemplate(t("import.duplicates"), { n: dupCount })}
                </label>
              )}

              {/* sample rows */}
              {toImport.length > 0 && (
                <div className="overflow-x-auto rounded-[10px] border border-jh-line">
                  <table className="w-full text-xs">
                    <thead className="bg-jh-mist/60 text-left text-jh-mute">
                      <tr>{previewHeaders(kind, t).map((h) => <th key={h} className="px-2 py-1.5 font-semibold whitespace-nowrap">{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {toImport.slice(0, PREVIEW_ROWS).map((r) => (
                        <tr key={r.line} className="border-t border-jh-line">
                          {previewCells(kind, r.data, t, stageLabel, typeLabels).map((c, i) => (
                            <td key={i} className="px-2 py-1.5 text-jh-ink max-w-40 truncate">{c}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {toImport.length > PREVIEW_ROWS && <p className="px-2 py-1.5 text-[11px] text-jh-mute border-t border-jh-line">+{toImport.length - PREVIEW_ROWS}</p>}
                </div>
              )}

              {result.errors.length > 0 && (
                <IssueList title={fillTemplate(t("import.errors"), { n: result.errors.length })} tone="error"
                  items={result.errors} lineLabel={(n) => fillTemplate(t("import.line"), { n })} />
              )}
              {warnings.length > 0 && (
                <IssueList title={fillTemplate(t("import.warnings"), { n: warnings.length })} tone="warn"
                  items={warnings} lineLabel={(n) => fillTemplate(t("import.line"), { n })} />
              )}
            </>
          )}

          <div className="flex gap-2">
            <button type="button" onClick={() => { setResult(null); setPasted(""); setPasting(false); }} className="btn-secondary flex-1">{t("import.back")}</button>
            {!blocked && (
              <button type="button" onClick={doImport} disabled={busy || toImport.length === 0} className="btn-primary flex-1 disabled:opacity-60">
                {busy ? t("import.busy") : toImport.length === 0 ? t("import.nothing") : fillTemplate(t("import.submit"), { n: toImport.length })}
              </button>
            )}
          </div>
        </div>
      </Sheet>
    );
  }

  // ---- pick ----
  return (
    <Sheet title={title} onClose={onClose} wide>
      <div className="space-y-4">
        <p className="text-sm text-jh-mute">{t(`import.${kind}.intro`)}</p>

        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="btn-primary flex-1 cursor-pointer">
            <Upload className="h-4 w-4" /> {t("import.chooseFile")}
            <input type="file" accept=".csv,text/csv,text/plain" className="sr-only" onChange={onFile} aria-label={t("import.chooseFile")} />
          </label>
          <button type="button" onClick={download} className="btn-secondary flex-1">
            <Download className="h-4 w-4" /> {t("import.template")}
          </button>
        </div>
        {readError && <Issue>{readError}</Issue>}

        {!pasting ? (
          <button type="button" onClick={() => setPasting(true)} className="link text-sm">{t("import.pasteToggle")}</button>
        ) : (
          <div className="space-y-2">
            <textarea className="field min-h-28 font-mono text-xs" placeholder={t("import.pastePlaceholder")}
              aria-label={t("import.pasteToggle")} value={pasted} onChange={(e) => setPasted(e.target.value)} />
            <button type="button" onClick={() => parse(pasted)} disabled={!pasted.trim()} className="btn-secondary w-full disabled:opacity-60">
              <FileSpreadsheet className="h-4 w-4" /> {t("import.preview")}
            </button>
          </div>
        )}

        {/* column guide */}
        <div>
          <p className="mb-1.5 text-xs font-display font-semibold uppercase tracking-wide text-jh-mute-2">{t("import.columns")}</p>
          <ul className="divide-y divide-jh-line rounded-[10px] border border-jh-line text-xs">
            {columns.map((c) => (
              <li key={c.key} className="flex gap-2 px-3 py-1.5">
                <span className="w-24 shrink-0 font-semibold text-jh-ink">
                  {c.header}
                  {c.required && <span className="ml-1 rounded-full bg-jh-red-soft px-1.5 text-[10px] text-jh-red">{t("import.required")}</span>}
                </span>
                <span className="text-jh-mute">{c.help}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Sheet>
  );
}

/* ---------------- bits ---------------- */
function Issue({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-[10px] bg-jh-red-soft px-3 py-2 text-sm text-jh-red">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> <span>{children}</span>
    </p>
  );
}

function IssueList({ title, tone, items, lineLabel }: {
  title: string; tone: "error" | "warn"; items: { line: number; message: string }[]; lineLabel: (n: number) => string;
}) {
  const [open, setOpen] = useState(tone === "error");
  return (
    <div className="text-xs">
      <button type="button" onClick={() => setOpen((o) => !o)}
        className={`font-display font-semibold ${tone === "error" ? "text-jh-red" : "text-jh-mute"}`}>
        {open ? "▾" : "▸"} {title}
      </button>
      {open && (
        <ul className="mt-1 space-y-0.5 text-jh-mute">
          {items.slice(0, MAX_ISSUES).map((it, i) => (
            <li key={i}><span className="text-jh-mute-2">{lineLabel(it.line)} · </span>{it.message}</li>
          ))}
          {items.length > MAX_ISSUES && <li className="text-jh-mute-2">+{items.length - MAX_ISSUES}</li>}
        </ul>
      )}
    </div>
  );
}

function previewHeaders(kind: ImportKind, t: (k: string) => string): string[] {
  return kind === "contacts"
    ? [t("tracker.f.fullName"), t("tracker.f.company"), t("tracker.f.role"), t("tracker.f.contactType"), t("tracker.f.email")]
    : [t("tracker.f.company"), t("tracker.f.role"), t("tracker.f.market"), "Stage", t("tracker.contacts")];
}

function previewCells(kind: ImportKind, d: ContactDoc | OpportunityDoc, t: (k: string) => string,
  stageLabel: (id: string) => string, typeLabels: Record<ContactType, string>): string[] {
  if (kind === "contacts") {
    const c = d as ContactDoc;
    return [c.fullName, c.company ?? "", c.role ?? "", typeLabels[normalizeContactType(c.type)], c.email ?? ""];
  }
  const o = d as OpportunityDoc;
  return [o.company, o.role ?? "", t(o.market === "hidden" ? "tracker.f.hidden" : "tracker.f.visible"), stageLabel(o.stage), String((o.contactIds ?? []).length)];
}
