"use client";

import { useEffect, useState } from "react";
import { Plus, Bell, Users, Columns3 } from "lucide-react";
import { TEXT_FIELDS, type TextField } from "@/lib/content";
import { stageDotClass } from "@/lib/stages";
import type { ContentConfig } from "@/lib/types";
import StagesEditor from "./StagesEditor";
import {
  authed, postJson, AuditLine, EditorLayout, Loading, PhoneFrame, PreviewAside, SaveBar, Section, TextFields, type Notice,
} from "@/components/admin/shared";

// The Progress tab has ~70 strings; split them by the screen they appear on so
// an editor can find "the reminders empty-state" without scrolling a wall.
const TRACKER_FIELDS = TEXT_FIELDS.filter((f) => f.group === "Progress (Tracker)");
const KEYS = new Set(TRACKER_FIELDS.map((f) => f.key));
const BOARD_KEYS = new Set(["tracker.eyebrow", "tracker.title", "tracker.addJob", "tracker.intro", "tracker.dropHere", "tracker.moveTo", "tracker.roleFallback"]);

type GroupName = "Board" | "Job sheets & detail" | "Form fields" | "Reminders" | "Contacts";
const GROUP_ORDER: { name: GroupName; help: string }[] = [
  { name: "Board", help: "Header, view toggle and kanban copy." },
  { name: "Reminders", help: "The Reminders view and its add sheet." },
  { name: "Contacts", help: "The Contacts view and its add sheet." },
  { name: "Job sheets & detail", help: "Add / edit job sheets, the detail modal, notes and reminders on a card." },
  { name: "Form fields", help: "Field labels and option names shared by every sheet." },
];
function groupOf(f: TextField): GroupName {
  if (f.key.startsWith("tracker.f.")) return "Form fields";
  if (f.key.startsWith("reminders.")) return "Reminders";
  if (f.key.startsWith("contacts.")) return "Contacts";
  if (f.key.startsWith("tracker.view.") || BOARD_KEYS.has(f.key)) return "Board";
  return "Job sheets & detail";
}
const GROUPS = GROUP_ORDER.map((g) => ({ ...g, fields: TRACKER_FIELDS.filter((f) => groupOf(f) === g.name) }));

export default function ProgressCms() {
  const [cfg, setCfg] = useState<ContentConfig | null>(null);
  const [meta, setMeta] = useState<{ updatedAt: number | null; updatedBy: string | null } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    authed("/api/admin/content").then((r) => r.json()).then((d) => {
      if (d.ok) { setCfg(d.content); setMeta(d.meta ?? null); } else setLoadError("Couldn't load the Progress tab content.");
    }).catch(() => setLoadError("Couldn't load the Progress tab content."));
  }, []);

  const setText = (key: string, value: string) => { setCfg((c) => (c ? { ...c, text: { ...c.text, [key]: value } } : c)); setDirty(true); setNotice(null); };
  const setStages = (stages: ContentConfig["stages"]) => { setCfg((c) => (c ? { ...c, stages } : c)); setDirty(true); setNotice(null); };

  async function save() {
    if (!cfg) return;
    if (cfg.stages.some((s) => !s.label.trim())) { setNotice({ kind: "err", text: "Every stage needs a name." }); return; }
    setBusy(true); setNotice(null);
    const text: Record<string, string> = {};
    for (const k of KEYS) text[k] = cfg.text[k] ?? "";
    try {
      const d = await (await postJson("/api/admin/content", { content: { text, stages: cfg.stages } })).json();
      if (d.ok) { setCfg(d.content); setMeta(d.meta ?? null); setDirty(false); setNotice({ kind: "ok", text: "Saved — live for members now." }); }
      else setNotice({ kind: "err", text: "Save failed." });
    } catch { setNotice({ kind: "err", text: "Save failed." }); }
    finally { setBusy(false); }
  }

  if (loadError && !cfg) return <p className="text-jh-red">{loadError}</p>;
  if (!cfg) return <Loading>Loading Progress tab…</Loading>;
  const t = (k: string) => cfg.text[k] ?? "";

  return (
    <div className="space-y-6">
      <EditorLayout
        form={
          <>
            <StagesEditor stages={cfg.stages} onChange={setStages} />
            {GROUPS.map((g) => (
              <Section key={g.name} title={g.name} help={g.help}>
                <TextFields fields={g.fields} text={cfg.text} onChange={setText} idPrefix="cms-progress" />
              </Section>
            ))}
          </>
        }
        preview={
          <PreviewAside caption={<span className="text-xs text-jh-mute">Board view · empty pipeline</span>}>
            <PhoneFrame active="tracker" labels={{ compass: t("nav.compass"), performance: t("nav.performance"), tracker: t("nav.tracker"), coaching: t("nav.coaching") }}>
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="eyebrow">{t("tracker.eyebrow")}</span>
                    <h1 className="text-2xl mt-0.5">{t("tracker.title")}</h1>
                    <p className="text-sm text-jh-mute mt-1">{t("tracker.intro")}</p>
                  </div>
                  <button type="button" tabIndex={-1} className="btn-primary shrink-0 text-sm px-3 py-2"><Plus className="h-4 w-4" /> {t("tracker.addJob")}</button>
                </div>
                <div className="flex gap-1 rounded-pill bg-jh-mist p-1 text-xs font-display font-semibold">
                  <span className="flex-1 flex items-center justify-center gap-1 rounded-pill bg-white py-2 text-jh-ink shadow-jh-1"><Columns3 className="h-3.5 w-3.5" /> {t("tracker.view.board")}</span>
                  <span className="flex-1 flex items-center justify-center gap-1 py-2 text-jh-mute"><Bell className="h-3.5 w-3.5" /> {t("tracker.view.reminders")}</span>
                  <span className="flex-1 flex items-center justify-center gap-1 py-2 text-jh-mute"><Users className="h-3.5 w-3.5" /> {t("tracker.view.contacts")}</span>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
                  {cfg.stages.map((s) => (
                    <div key={s.id} className="w-[200px] shrink-0 rounded-md border border-jh-line bg-white">
                      <div className="flex items-center gap-2 px-3 py-2 border-b border-jh-line">
                        <span className={`h-2.5 w-2.5 rounded-full ${stageDotClass(s.color)}`} aria-hidden />
                        <span className="font-display font-semibold text-sm text-jh-ink truncate">{s.label}</span>
                      </div>
                      <p className="px-3 py-5 text-xs text-jh-mute-2 text-center">{t("tracker.dropHere")}</p>
                    </div>
                  ))}
                </div>
              </div>
            </PhoneFrame>
          </PreviewAside>
        }
      />
      <SaveBar onSave={save} busy={busy} dirty={dirty} notice={notice} label="Save Progress tab"
        audit={<AuditLine updatedAt={meta?.updatedAt} updatedBy={meta?.updatedBy} />} />
    </div>
  );
}
