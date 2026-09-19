"use client";

import { Plus, Trash2 } from "lucide-react";
import { MAX_COMPANIES } from "@/lib/careerops/portals-yaml";
import type { CareerOpsPortals } from "@/lib/careerops/types";

// Agents → Setup → Portals: the companies the Scout watches and the title
// keywords that decide which postings are worth listing.
export default function Portals({ value, onChange }: { value: CareerOpsPortals; onChange: (v: CareerOpsPortals) => void }) {
  const set = (patch: Partial<CareerOpsPortals>) => onChange({ ...value, ...patch });
  const setCo = (i: number, patch: Partial<CareerOpsPortals["companies"][number]>) => set({ companies: value.companies.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  const list = (s: string) => s.split(/[,\n]/).map((k) => k.trim()).filter(Boolean);

  return (
    <div className="space-y-4">
      <div>
        <p className="label">Companies to watch <span className="font-normal text-jh-mute">({value.companies.length}/{MAX_COMPANIES})</span></p>
        <p className="text-xs text-jh-mute mb-2">Use the company&apos;s careers page. Boards on Greenhouse, Lever, Ashby, Workable, SmartRecruiters, BambooHR, Teamtailor, Workday and 80+ others are read directly; other sites may return nothing.</p>
        <ul className="space-y-2">
          {value.companies.map((c, i) => (
            <li key={i} className="grid grid-cols-[1fr_2fr_auto] gap-2 items-center">
              <input aria-label={`Company ${i + 1} name`} className="field text-sm" placeholder="Xero" value={c.name} onChange={(e) => setCo(i, { name: e.target.value })} />
              <input aria-label={`Company ${i + 1} careers URL`} className="field text-sm font-mono" placeholder="https://jobs.lever.co/xero" value={c.careersUrl} onChange={(e) => setCo(i, { careersUrl: e.target.value })} />
              <button type="button" onClick={() => set({ companies: value.companies.filter((_, j) => j !== i) })} className="btn-ghost text-jh-red p-2" aria-label={`Remove ${c.name || "company"}`}><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
        {value.companies.length < MAX_COMPANIES && (
          <button type="button" onClick={() => set({ companies: [...value.companies, { name: "", careersUrl: "" }] })} className="btn-secondary text-xs px-3 py-2 mt-2"><Plus className="h-4 w-4" /> Add company</button>
        )}
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="label">Title keywords — include</span>
          <textarea aria-label="Include keywords" className="field text-sm min-h-[4.5rem]" placeholder="Product Owner, Product Manager" value={value.positive.join(", ")} onChange={(e) => set({ positive: list(e.target.value) })} />
          <span className="text-xs text-jh-mute-2">A posting is listed when its title contains any of these. Comma-separated.</span>
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
