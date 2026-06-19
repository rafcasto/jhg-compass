"use client";

import { useState } from "react";
import { Plus, X, ExternalLink } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useLiveCollection, paths, createDoc, updateRecord } from "@/lib/firestore/db";
import type { Opportunity, OpportunityStage } from "@/lib/types";
import type { Market } from "@/lib/categories";
import { track } from "@/lib/track-client";
import { TAGS } from "@/lib/tags";

const STAGES: { key: OpportunityStage; label: string }[] = [
  { key: "researching", label: "Researching" },
  { key: "contacted", label: "Contacted" },
  { key: "interviewing", label: "Interviewing" },
  { key: "offer", label: "Offer" },
  { key: "accepted", label: "Accepted" },
  { key: "rejected", label: "Rejected" },
];

export default function OpportunitiesPage() {
  const { user } = useAuth();
  const uid = user?.uid;
  const { data: opps } = useLiveCollection<Opportunity>(uid, paths.opportunities);
  const [open, setOpen] = useState(false);

  async function move(o: Opportunity, stage: OpportunityStage) {
    await updateRecord(uid!, "opportunities", o.id, { stage });
    track(TAGS.STAGE_CHANGE, { props: { id: o.id, stage } });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><span className="eyebrow">CRM</span><h1 className="mt-1">Job opportunities</h1></div>
        <button onClick={() => setOpen(true)} className="btn-primary"><Plus className="h-4 w-4" /> Add</button>
      </div>

      {opps.length === 0 && <div className="card p-8 text-center text-jh-mute">Track every role you’re pursuing and move it through the stages.</div>}

      <div className="space-y-3">
        {opps.map((o) => (
          <div key={o.id} className="card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-display font-semibold text-jh-ink">{o.role || "Role"} <span className="text-jh-mute font-body font-normal">@ {o.company}</span></p>
                <span className={o.market === "hidden" ? "pill-hidden mt-1" : "pill-visible mt-1"}>{o.market}</span>
              </div>
              {o.url && <a href={o.url} target="_blank" rel="noreferrer" className="text-jh-mute"><ExternalLink className="h-4 w-4" /></a>}
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {STAGES.map((s) => (
                <button key={s.key} onClick={() => move(o, s.key)}
                  className={`rounded-pill px-3 py-1 text-xs font-semibold transition ${o.stage === s.key ? "bg-jh-red text-white" : "bg-jh-mist text-jh-mute hover:bg-jh-blue-grey"}`}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {open && <AddOpp uid={uid!} onClose={() => setOpen(false)} />}
    </div>
  );
}

function AddOpp({ uid, onClose }: { uid: string; onClose: () => void }) {
  const [f, setF] = useState({ company: "", role: "", market: "hidden" as Market, source: "", url: "", stage: "researching" as OpportunityStage });
  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!f.company) return;
    await createDoc(paths.opportunities(uid), f);
    track(TAGS.ADD_OPPORTUNITY, { props: { market: f.market } });
    onClose();
  }
  return (
    <div className="fixed inset-0 z-50 grid place-items-end sm:place-items-center bg-jh-ink/60 sm:p-4" onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={save} className="card w-full sm:max-w-md p-6 space-y-3 rounded-b-none sm:rounded-lg">
        <div className="flex items-center justify-between"><h3 className="text-lg">Add opportunity</h3><button type="button" onClick={onClose}><X className="h-5 w-5 text-jh-mute" /></button></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Company</label><input className="field" value={f.company} onChange={(e) => set("company", e.target.value)} required /></div>
          <div><label className="label">Role</label><input className="field" value={f.role} onChange={(e) => set("role", e.target.value)} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Market</label>
            <select className="field" value={f.market} onChange={(e) => set("market", e.target.value)}>
              <option value="hidden">Hidden</option><option value="visible">Visible</option>
            </select></div>
          <div><label className="label">Source</label><input className="field" value={f.source} onChange={(e) => set("source", e.target.value)} /></div>
        </div>
        <div><label className="label">Link</label><input className="field" value={f.url} onChange={(e) => set("url", e.target.value)} /></div>
        <button type="submit" className="btn-primary w-full">Save</button>
      </form>
    </div>
  );
}
