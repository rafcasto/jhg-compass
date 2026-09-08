"use client";

import { useEffect, useMemo, useState } from "react";
import { Zap } from "lucide-react";
import { DEFAULT_SEGMENTS, QUADRANTS, bucketRespondents, mergeSegments, type QuadrantKey, type SegmentsConfig } from "@/lib/segments";
import { authed, postJson, Field, Loading, NumberField, SaveBar, Section, type Notice } from "@/components/admin/shared";
import type { Analytics } from "./QuizResults";
import { fitPill } from "./QuizResults";

const TILE_STYLE: Record<QuadrantKey, string> = {
  "fit-high": "bg-rb-green-light/15 border-rb-green-dark/30",
  "fit-low": "bg-jh-blue-grey border-rb-blue/20",
  "nofit-high": "bg-[#fff4e5] border-rb-orange/30",
  "nofit-low": "bg-jh-mist border-jh-line",
};

// The 4-quadrant matrix: ICP fit (rows) × buying propensity (columns). Each tile
// shows who's in it and the ONE follow-up the team runs for that bucket.
export default function Segments({ data }: { data: Analytics }) {
  const [cfg, setCfg] = useState<SegmentsConfig | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [openTile, setOpenTile] = useState<QuadrantKey | null>(null);

  useEffect(() => {
    authed("/api/admin/segments").then((r) => r.json())
      .then((d) => setCfg(d.ok ? mergeSegments(d.config) : DEFAULT_SEGMENTS))
      .catch(() => setCfg(DEFAULT_SEGMENTS));
  }, []);

  const threshold = cfg?.propensityThreshold ?? DEFAULT_SEGMENTS.propensityThreshold;
  const buckets = useMemo(() => bucketRespondents(data.responses, threshold), [data.responses, threshold]);
  const total = data.responses.length || 1;

  const setAction = (q: QuadrantKey, k: keyof SegmentsConfig["actions"][QuadrantKey], v: string) => {
    setCfg((c) => (c ? { ...c, actions: { ...c.actions, [q]: { ...c.actions[q], [k]: v } } } : c)); setDirty(true); setNotice(null);
  };

  async function save() {
    if (!cfg) return;
    setBusy(true); setNotice(null);
    try {
      const d = await (await postJson("/api/admin/segments", cfg)).json();
      if (d.ok) { setCfg(mergeSegments(d.config)); setDirty(false); setNotice({ kind: "ok", text: "Saved." }); }
      else setNotice({ kind: "err", text: "Save failed." });
    } catch { setNotice({ kind: "err", text: "Save failed." }); }
    finally { setBusy(false); }
  }

  if (!cfg) return <Loading>Loading segments…</Loading>;

  return (
    <div className="space-y-6">
      <Section title="Prospect matrix" help={<>Two quiz scores place every respondent: <strong>ICP fit</strong> (the Q4 gate) and <strong>buying propensity</strong> (readiness 0–6, high when ≥ {threshold}). Click a tile to list who&apos;s in it.</>}
        aside={<NumberField id="propensity-threshold" label="High-propensity threshold" min={0} max={6} value={cfg.propensityThreshold}
          onChange={(v) => { setCfg((c) => (c ? { ...c, propensityThreshold: Math.min(6, v) } : c)); setDirty(true); }} className="w-44" />}>
        <div className="grid grid-cols-[auto_1fr_1fr] gap-3 items-stretch">
          <div />
          <p className="text-center text-xs font-display font-semibold uppercase tracking-wider text-jh-mute">High propensity · ≥ {threshold} pts</p>
          <p className="text-center text-xs font-display font-semibold uppercase tracking-wider text-jh-mute">Low propensity · &lt; {threshold} pts</p>
          {(["ICP fit", "Below ICP"] as const).map((row) => (
            <RowOfTiles key={row} row={row} buckets={buckets} total={total} cfg={cfg} open={openTile} onOpen={setOpenTile} />
          ))}
        </div>
        {openTile && (
          <div className="border border-jh-line rounded-md overflow-hidden">
            <div className="px-4 py-2 bg-jh-mist text-sm font-display font-semibold text-jh-ink flex items-center justify-between">
              <span>{QUADRANTS.find((q) => q.key === openTile)?.name} · {buckets[openTile].length} prospects</span>
              <button type="button" onClick={() => setOpenTile(null)} className="text-xs text-jh-mute hover:text-jh-ink">Close</button>
            </div>
            {buckets[openTile].length === 0 ? <p className="px-4 py-6 text-sm text-jh-mute text-center">Nobody here yet.</p> : (
              <ul className="divide-y divide-jh-line max-h-80 overflow-y-auto">
                {buckets[openTile].map((r, i) => (
                  <li key={i} className="px-4 py-2.5 flex flex-wrap items-center gap-2 text-sm bg-white">
                    <span className="font-display font-semibold text-jh-ink">{r.name}</span>
                    <span className="text-xs text-jh-mute">{r.email}</span>
                    <span className="ml-auto pill bg-jh-mist text-jh-ink capitalize">{r.archetype}</span>
                    <span className={`pill ${fitPill(r.fit)} capitalize`}>{r.fit}</span>
                    <span className="pill bg-jh-mist text-jh-ink">Score {r.score ?? "—"}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Section>

      <Section title="Follow-up actions" help="One action per quadrant. Write down who does it, on which channel, and the automation you want wired (Kit tag / sequence) — the numbers above tell you which bucket to automate first.">
        <div className="grid gap-4 lg:grid-cols-2">
          {QUADRANTS.map((q) => {
            const a = cfg.actions[q.key];
            return (
              <div key={q.key} className={`rounded-md border p-4 space-y-3 ${TILE_STYLE[q.key]}`}>
                <div className="flex items-center justify-between">
                  <p className="font-display font-bold text-jh-ink">{q.name} <span className="text-jh-mute font-semibold text-xs">· {q.fit} × {q.propensity} · grades {q.grades}</span></p>
                  <span className="pill bg-white text-jh-ink">{buckets[q.key].length}</span>
                </div>
                <Field id={`seg-${q.key}-title`} label="Action" value={a.title} onChange={(v) => setAction(q.key, "title", v)} />
                <Field id={`seg-${q.key}-desc`} label="What happens" textarea value={a.description} onChange={(v) => setAction(q.key, "description", v)} />
                <div className="grid grid-cols-2 gap-3">
                  <Field id={`seg-${q.key}-owner`} label="Owner" value={a.owner} onChange={(v) => setAction(q.key, "owner", v)} />
                  <Field id={`seg-${q.key}-channel`} label="Channel" value={a.channel} onChange={(v) => setAction(q.key, "channel", v)} />
                </div>
                <Field id={`seg-${q.key}-auto`} label="Automation to wire" mono value={a.automation} onChange={(v) => setAction(q.key, "automation", v)}
                  help="Not executed yet — this is the spec. Kit tags / sequences named here are the next thing to automate." />
              </div>
            );
          })}
        </div>
      </Section>

      <SaveBar onSave={save} busy={busy} dirty={dirty} notice={notice} label="Save segments"
        audit={<span className="inline-flex items-center gap-1"><Zap className="h-3.5 w-3.5" aria-hidden /> Stored at <code className="font-mono">config/segments</code></span>} />
    </div>
  );
}

function RowOfTiles({ row, buckets, total, cfg, open, onOpen }: {
  row: "ICP fit" | "Below ICP"; buckets: Record<QuadrantKey, unknown[]>; total: number; cfg: SegmentsConfig;
  open: QuadrantKey | null; onOpen: (k: QuadrantKey) => void;
}) {
  const tiles = QUADRANTS.filter((q) => q.fit === row); // high first, then low
  return (
    <>
      <p className="self-center text-xs font-display font-semibold uppercase tracking-wider text-jh-mute [writing-mode:vertical-rl] rotate-180">{row}</p>
      {tiles.map((q) => {
        const n = buckets[q.key].length;
        return (
          <button key={q.key} type="button" onClick={() => onOpen(q.key)} aria-pressed={open === q.key}
            className={`text-left rounded-md border p-4 transition ${TILE_STYLE[q.key]} ${open === q.key ? "ring-2 ring-jh-red/40" : "hover:shadow-jh-2"}`}>
            <p className="font-display font-bold text-jh-ink">{q.name}</p>
            <p className="font-display font-extrabold text-3xl text-jh-ink tabular-nums mt-1">{n} <span className="text-sm font-semibold text-jh-mute">· {Math.round((n / total) * 100)}%</span></p>
            <p className="text-xs text-jh-mute mt-2 line-clamp-2">→ {cfg.actions[q.key].title}</p>
          </button>
        );
      })}
    </>
  );
}
