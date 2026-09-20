"use client";

import { useEffect, useMemo, useState } from "react";
import { BellRing, Check, Save } from "lucide-react";
import { arrayUnion, doc, setDoc, updateDoc } from "firebase/firestore";
import { paths, useLiveCollection, useLiveDoc } from "@/lib/firestore/db";
import { useContent } from "@/lib/firestore/content";
import type { Opportunity } from "@/lib/types";
import { DEFAULT_FOLLOWUP_DAYS, type CareerOpsNote, type FollowupRules } from "@/lib/careerops/types";
import type { ToolProps } from "../SectionScreen";
import { CopyButton, NoteHistory, NoteView, useNoteJob } from "../shared";

const DAY = 86_400_000;
// Board stages that count as "waiting on them"; the last column(s) are terminal.
const IN_FLIGHT = /outreach|application|applied|interview|offer|negotiation/;

// Tracking → followup: cadence rules × Progress board → overdue list → drafted nudge.
export default function Followup({ ctx }: ToolProps) {
  const { stages } = useContent();
  const { data: opps } = useLiveCollection<Opportunity>(ctx.uid, paths.opportunities);
  const { data: rulesDoc } = useLiveDoc<FollowupRules>(paths.careerOpsFollowup(ctx.uid));
  const [days, setDays] = useState<Record<string, number>>(DEFAULT_FOLLOWUP_DAYS);
  const [dirty, setDirty] = useState(false);
  const [open, setOpen] = useState<CareerOpsNote | null>(null);
  const [target, setTarget] = useState<Opportunity | null>(null);
  const [channel, setChannel] = useState<"email" | "linkedin">("email");
  const job = useNoteJob(ctx.notes, "followup");
  const shown = job.note ?? open;
  const flight = stages.filter((s) => IN_FLIGHT.test(s.id) || IN_FLIGHT.test(s.label.toLowerCase()));

  useEffect(() => { if (rulesDoc?.days && !dirty) setDays({ ...DEFAULT_FOLLOWUP_DAYS, ...rulesDoc.days }); }, [rulesDoc, dirty]);

  const rows = useMemo(() => {
    const now = Date.now();
    return opps.filter((o) => flight.some((s) => s.id === o.stage)).map((o) => {
      const last = Math.max(o.createdAt ?? 0, ...(o.log ?? []).map((l) => l.at ?? 0));
      const since = last ? Math.floor((now - last) / DAY) : null;
      const rule = days[o.stage] ?? 7;
      const overdue = since != null && since >= rule;
      return { o, since, rule, overdue, cold: (o.log ?? []).filter((l) => /follow-up sent/i.test(l.text)).length >= 2 };
    }).sort((a, b) => Number(b.overdue) - Number(a.overdue) || (b.since ?? 0) - (a.since ?? 0));
  }, [opps, flight, days]);
  const overdue = rows.filter((r) => r.overdue);

  async function saveRules() { await setDoc(paths.careerOpsFollowup(ctx.uid), { days, updatedAt: Date.now() }); setDirty(false); }
  async function draft(o: Opportunity, since: number | null) {
    setOpen(null); setTarget(o);
    const report = ctx.reports.find((r) => r.addedOpportunityId === o.id);
    const lastNote = (o.log ?? []).slice(-1)[0]?.text ?? "";
    await job.run({ type: "followup", opportunityId: o.id, company: o.company, role: o.role ?? "", stage: stages.find((s) => s.id === o.stage)?.label ?? o.stage, daysSince: since ?? 0, channel, lastNote, ...(report ? { reportJobId: report.jobId } : {}) });
  }
  async function markSent(o: Opportunity) {
    await updateDoc(doc(paths.opportunities(ctx.uid), o.id), { log: arrayUnion({ at: Date.now(), text: `Follow-up sent (${channel}) — CareerOps` }) });
  }
  const body = typeof shown?.data?.body === "string" ? (shown.data.body as string) : null;

  return (
    <div className="space-y-5">
      <section className="card p-5 space-y-3">
        <h3 className="font-display font-bold text-jh-ink flex items-center gap-2"><BellRing className="h-5 w-5 text-jh-red" strokeWidth={1.5} /> Cadence rules — days of silence before a nudge is due</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {flight.map((s) => (
            <label key={s.id} className="block"><span className="label text-xs">{s.label}</span><input type="number" min={1} max={60} className="field text-sm" value={days[s.id] ?? 7} onChange={(e) => { setDays((d) => ({ ...d, [s.id]: Math.max(1, +e.target.value || 1) })); setDirty(true); }} aria-label={`${s.label} cadence days`} /></label>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={saveRules} disabled={!dirty} className="btn-secondary text-xs px-3 py-2 disabled:opacity-40"><Save className="h-3.5 w-3.5" /> Save rules</button>
          <span className="text-xs text-jh-mute">Silence = days since the card&apos;s last logged note. Career-ops defaults: applied 7 · responded 3 · interview 1–2.</span>
        </div>
      </section>

      <section className="card divide-y divide-jh-line">
        <div className="px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm font-display font-semibold text-jh-ink">{overdue.length} overdue · {rows.length - overdue.length} waiting</p>
          <div role="radiogroup" aria-label="Channel" className="inline-flex gap-1 rounded-pill bg-jh-mist p-1">{(["email", "linkedin"] as const).map((c) => <button key={c} type="button" role="radio" aria-checked={channel === c} onClick={() => setChannel(c)} className={`px-3 py-1 rounded-pill text-xs font-display font-semibold ${channel === c ? "bg-white text-jh-ink shadow-jh-1" : "text-jh-mute"}`}>{c === "email" ? "Email" : "LinkedIn"}</button>)}</div>
        </div>
        {rows.length === 0 ? <p className="px-5 py-8 text-center text-jh-mute text-sm">No cards in flight on your Progress board. Move a card to Outreach or Application and it shows up here.</p> : (
          <ul className="divide-y divide-jh-line">
            {rows.map(({ o, since, rule, overdue: od, cold }) => (
              <li key={o.id} className="px-5 py-3 flex items-center gap-3 flex-wrap">
                <span className={`pill ${od ? "bg-jh-red-soft text-jh-red" : "bg-jh-mist text-jh-mute"}`}>{cold ? "COLD" : od ? "OVERDUE" : "waiting"}</span>
                <span className="flex-1 min-w-0"><span className="block font-semibold text-jh-ink truncate">{o.company}{o.role ? ` — ${o.role}` : ""}</span><span className="block text-xs text-jh-mute">{stages.find((s) => s.id === o.stage)?.label ?? o.stage} · {since == null ? "no date" : `${since} day${since === 1 ? "" : "s"} quiet`} · rule {rule}d{cold ? " · 2+ nudges sent — consider closing" : ""}</span></span>
                <button type="button" onClick={() => draft(o, since)} disabled={job.busy || (!!job.jobId && !job.note && !job.failed)} className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-60">Draft nudge</button>
                <button type="button" onClick={() => markSent(o)} className="btn-ghost text-xs" title="Log a follow-up on the card"><Check className="h-3.5 w-3.5" /> Sent</button>
              </li>
            ))}
          </ul>
        )}
        {job.err && <p role="alert" className="px-5 py-3 text-sm text-jh-red">{job.err}</p>}
        {job.status && <div className="px-5 py-3">{job.status}</div>}
      </section>

      {shown && <NoteView note={shown} extra={body ? <div className="rounded-md border border-jh-line p-4 space-y-2"><div className="flex items-center justify-between"><span className="label mb-0">Ready to send</span><div className="flex gap-1"><CopyButton text={body} label="Copy message" />{target && <button type="button" onClick={() => markSent(target)} className="btn-ghost text-xs"><Check className="h-3.5 w-3.5" /> Mark sent</button>}</div></div><p className="text-sm whitespace-pre-wrap text-jh-ink">{body}</p></div> : undefined} />}
      <NoteHistory notes={ctx.notes} kind="followup" onOpen={(n) => { job.reset(); setOpen(n); }} current={shown?.id} />
    </div>
  );
}
