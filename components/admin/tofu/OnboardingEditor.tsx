"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { TEXT_FIELDS, fillTemplate } from "@/lib/content";
import type { ContentConfig } from "@/lib/types";
import {
  authed, postJson, AuditLine, EditorLayout, Loading, PhoneFrame, PreviewAside, SaveBar, Section, TextFields, type Notice,
} from "@/components/admin/shared";

const FIELDS = TEXT_FIELDS.filter((f) => f.group === "Onboarding");
const KEYS = new Set(FIELDS.map((f) => f.key));

// The three-step first-run flow. Only the onboarding strings are saved from here;
// the activity list + banners it re-uses on step 3 are owned by CMS → Performance.
export default function OnboardingEditor() {
  const [cfg, setCfg] = useState<ContentConfig | null>(null);
  const [meta, setMeta] = useState<{ updatedAt: number | null; updatedBy: string | null } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  useEffect(() => {
    authed("/api/admin/content").then((r) => r.json()).then((d) => { if (d.ok) { setCfg(d.content); setMeta(d.meta ?? null); } });
  }, []);

  const t = useMemo(() => (k: string) => cfg?.text[k] ?? "", [cfg]);
  const setText = (key: string, value: string) => { setCfg((c) => (c ? { ...c, text: { ...c.text, [key]: value } } : c)); setDirty(true); setNotice(null); };

  async function save() {
    if (!cfg) return;
    setBusy(true); setNotice(null);
    const text: Record<string, string> = {};
    for (const k of KEYS) text[k] = cfg.text[k] ?? "";
    try {
      const d = await (await postJson("/api/admin/content", { content: { text } })).json();
      if (d.ok) { setCfg(d.content); setMeta(d.meta ?? null); setDirty(false); setNotice({ kind: "ok", text: "Saved — live for new members now." }); }
      else setNotice({ kind: "err", text: "Save failed." });
    } catch { setNotice({ kind: "err", text: "Save failed." }); }
    finally { setBusy(false); }
  }

  if (!cfg) return <Loading>Loading onboarding…</Loading>;
  const hidden = cfg.activities.filter((a) => a.market === "hidden").slice(0, 2);

  return (
    <div className="space-y-6">
      <EditorLayout
        form={
          <Section title="Onboarding copy" help="Step 1 asks for identity, step 2 the goal statement (same fields as the Compass tab), step 3 the daily targets (same activities as Performance).">
            <TextFields fields={FIELDS} text={cfg.text} onChange={setText} idPrefix="onb" />
          </Section>
        }
        preview={
          <PreviewAside caption={<span className="text-xs text-jh-mute">All three steps, stacked</span>}>
            <PhoneFrame active="compass" title="Onboarding preview">
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-2 pt-1">
                  {[0, 1, 2].map((i) => <span key={i} className={`h-2 rounded-pill ${i === 0 ? "w-8 bg-jh-red" : "w-2 bg-jh-line-2"}`} />)}
                </div>
                <div className="card p-5 space-y-3">
                  <div>
                    <h1 className="text-2xl">{t("onb.welcomeTitle")}</h1>
                    <p className="text-jh-mute text-sm mt-1">{t("onb.welcomeSubtitle")}</p>
                  </div>
                  {["onb.firstName", "onb.lastName", "onb.country"].map((k) => (
                    <div key={k}><span className="label">{t(k)}</span><div className="field py-2.5 text-sm text-jh-mute-2">—</div></div>
                  ))}
                  <button type="button" tabIndex={-1} className="btn-primary w-full">Continue <ArrowRight className="h-4 w-4" /></button>
                </div>
                <div className="rounded-lg bg-jh-ink text-white p-5">
                  <span className="eyebrow text-white/60">{t("onb.goalEyebrow")}</span>
                  <p className="mt-2 text-sm text-white/80">{t("onb.goalIntro")}</p>
                </div>
                <div className="card p-5">
                  <h1 className="text-2xl">{t("onb.targetsTitle")}</h1>
                  <p className="text-jh-mute text-sm mt-1">{t("onb.targetsSubtitle")}</p>
                </div>
                <div className="card overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3" style={{ background: "#e2ebfb" }}>
                    <span className="text-2xl leading-none">{t("perf.hiddenEmoji")}</span>
                    <div>
                      <div className="font-display font-bold text-jh-ink text-sm">{t("perf.hiddenTitle")}</div>
                      <div className="text-xs text-jh-mute">{fillTemplate(t("perf.effortNote"), { pct: cfg.effortSplit.hidden })}</div>
                    </div>
                  </div>
                  <div className="px-4">
                    {hidden.map((a) => (
                      <div key={a.id} className="flex items-center justify-between py-3 border-b border-jh-line last:border-0">
                        <span className="font-display font-semibold text-sm text-jh-ink">{a.label}</span>
                        <span className="text-[10.5px] uppercase tracking-wider text-jh-mute-2 font-display font-semibold">{t("onb.perDay")}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <button type="button" tabIndex={-1} className="btn-primary w-full">{t("onb.finish")} <Check className="h-4 w-4" /></button>
              </div>
            </PhoneFrame>
          </PreviewAside>
        }
      />
      <SaveBar onSave={save} busy={busy} dirty={dirty} notice={notice} label="Save onboarding"
        audit={<AuditLine updatedAt={meta?.updatedAt} updatedBy={meta?.updatedBy} />} />
    </div>
  );
}
