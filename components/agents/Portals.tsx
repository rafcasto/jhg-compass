"use client";

import { Plus, Trash2, Globe, Rss, AlertTriangle } from "lucide-react";
import { MAX_COMPANIES } from "@/lib/careerops/portals-yaml";
import type { CareerOpsPortals, PortalStatus } from "@/lib/careerops/types";

// Agents → Setup → Portals: the companies the Scout watches and the title
// keywords that decide which postings are worth listing.
export default function Portals({ value, onChange, status = [], suggested = [] }: { value: CareerOpsPortals; onChange: (v: CareerOpsPortals) => void; status?: PortalStatus[]; suggested?: string[] }) {
  const set = (patch: Partial<CareerOpsPortals>) => onChange({ ...value, ...patch });
  const statusFor = (c: CareerOpsPortals["companies"][number]) => status.find((s) => s.careersUrl === c.careersUrl.trim() || (s.name && s.name === c.name.trim()));
  const setCo = (i: number, patch: Partial<CareerOpsPortals["companies"][number]>) => set({ companies: value.companies.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  const list = (s: string) => s.split(/[,\n]/).map((k) => k.trim()).filter(Boolean);

  return (
    <div className="space-y-4">
      <div>
        <p className="label">Companies to watch <span className="font-normal text-jh-mute">({value.companies.length}/{MAX_COMPANIES})</span></p>
        <p className="text-xs text-jh-mute mb-2">Paste the company&apos;s careers page. If it runs on a known job board (Greenhouse, Lever, Ashby, Workable, SmartRecruiters, Workday, Eightfold and 80+ others) the Scout reads the board directly; otherwise the Pi opens the page in a browser and pulls the job list from it — slower and best-effort, but it works for most bank and corporate career sites. After a scan each row shows what happened.</p>
        <ul className="space-y-2">
          {value.companies.map((c, i) => {
            const st = statusFor(c);
            return (
              <li key={i} className="space-y-1">
                <div className="grid grid-cols-[1fr_2fr_auto] gap-2 items-center">
                  <input aria-label={`Company ${i + 1} name`} className="field text-sm" placeholder="Xero" value={c.name} onChange={(e) => setCo(i, { name: e.target.value })} />
                  <input aria-label={`Company ${i + 1} careers URL`} className="field text-sm font-mono" placeholder="https://jobs.lever.co/xero" value={c.careersUrl} onChange={(e) => setCo(i, { careersUrl: e.target.value })} />
                  <button type="button" onClick={() => set({ companies: value.companies.filter((_, j) => j !== i) })} className="btn-ghost text-jh-red p-2" aria-label={`Remove ${c.name || "company"}`}><Trash2 className="h-4 w-4" /></button>
                </div>
                {st && <PortalBadge st={st} />}
              </li>
            );
          })}
        </ul>
        {value.companies.length < MAX_COMPANIES && (
          <button type="button" onClick={() => set({ companies: [...value.companies, { name: "", careersUrl: "" }] })} className="btn-secondary text-xs px-3 py-2 mt-2"><Plus className="h-4 w-4" /> Add company</button>
        )}
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="label">Title keywords — include</span>
          <textarea aria-label="Include keywords" className="field text-sm min-h-[4.5rem]" placeholder="Product Owner, Product Manager" value={value.positive.join(", ")} onChange={(e) => set({ positive: list(e.target.value) })} />
          <span className="text-xs text-jh-mute-2">A posting is listed when its title <em>contains</em> any of these (case-insensitive). Short stems catch more: <code className="font-mono">Test</code> finds Test Lead, Test Analyst and Test Automation; <code className="font-mono">QA Manager</code> only finds that exact phrase. Comma-separated.</span>
          {suggested.filter((k) => !value.positive.some((p) => p.toLowerCase() === k.toLowerCase())).length > 0 && (
            <span className="block mt-1.5 text-xs text-jh-mute">Suggested for your goal:{" "}
              {suggested.filter((k) => !value.positive.some((p) => p.toLowerCase() === k.toLowerCase())).map((k) => (
                <button key={k} type="button" onClick={() => set({ positive: [...value.positive, k] })} className="inline-flex items-center rounded-pill border border-jh-line px-2 py-0.5 mr-1 mb-1 text-xs text-jh-ink hover:border-jh-red hover:text-jh-red">+ {k}</button>
              ))}
            </span>
          )}
        </label>
        <label className="block">
          <span className="label">Title keywords — exclude</span>
          <textarea aria-label="Exclude keywords" className="field text-sm min-h-[4.5rem]" placeholder="Junior, Intern" value={value.negative.join(", ")} onChange={(e) => set({ negative: list(e.target.value) })} />
          <span className="text-xs text-jh-mute-2">Drop titles containing these. <code className="font-mono">word:Intern</code> matches the whole word only.</span>
        </label>
      </div>
    </div>
  );
}

// Last-scan outcome for one company: how it was read, how many postings, how many matched the title filter.
export function PortalBadge({ st }: { st: PortalStatus }) {
  if (st.method === "none") return (
    <p className="text-xs text-jh-red flex items-center gap-1.5 pl-1"><AlertTriangle className="h-3.5 w-3.5 shrink-0" /> Last scan: nothing readable{st.error ? ` — ${st.error}` : ""}. Try the company&apos;s job-search page (the one that lists roles) or its board URL.</p>
  );
  const Icon = st.method === "board" ? Rss : Globe;
  const nearMiss = st.matched === 0 && (st.sample?.length ?? 0) > 0;
  return (
    <div className="text-xs text-jh-mute pl-1 space-y-0.5">
      <p className="flex items-center gap-1.5">
        <Icon className={`h-3.5 w-3.5 shrink-0 ${st.found > 0 ? "text-rb-green-dark" : "text-jh-mute"}`} />
        Last scan: {st.method === "board" ? `job board${st.provider ? ` (${st.provider})` : ""}` : "careers page via browser"} · {st.found} posting{st.found === 1 ? "" : "s"} · <span className={st.matched === 0 && st.found > 0 ? "text-jh-red" : ""}>{st.matched} matched your keywords</span>{st.error ? ` · ${st.error}` : ""}
      </p>
      {nearMiss && <details><summary className="cursor-pointer">None matched — titles seen there (tune your keywords)</summary><p className="mt-1 pl-3 text-jh-mute-2">{st.sample!.join(" · ")}</p></details>}
    </div>
  );
}
