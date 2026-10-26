"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Minus } from "lucide-react";
import type { Activity } from "@/lib/types";
import { fillTemplate } from "@/lib/content";
import { WORKDAYS_PER_WEEK } from "@/lib/period";
import { resolveWeeklyTarget, targetEdits, type WeeklyTargets } from "@/lib/targets";
import { Sheet, SheetFooter } from "@/components/tracker/Sheet";
import { MarketBanner, marketSections } from "@/components/performance/MarketSection";

// The ONE place a member sets targets — opened from the Performance tab ("Edit
// targets", or tapping a row's target) and from onboarding step 3 ("Adjust targets").
//
// Targets are edited in the unit they are stored in: per WEEK. Day and month figures
// on the Performance tab are derived from this number for display only, so there is
// no lossy reverse conversion (a "1 / day" tap used to write 5 / wk). The row's
// stepper acts on the loudest number on the row (24/700 ink); the derived daily share
// and the admin's recommendation sit under it in 13px mute, the latter only when the
// member's figure differs. Done writes only the rows that changed (lib/targets.ts).
export interface TargetsSheetProps {
  t: (key: string) => string;
  hidden: Activity[];
  visible: Activity[];
  effortSplit: { hidden: number; visible: number };
  /** Admin default weekly targets, by activity id. */
  weeklyTargets: WeeklyTargets;
  /** The member's own overrides, by activity id. */
  userTargets: WeeklyTargets;
  onClose: () => void;
  /** Rows to write (set) and overrides to remove (unset). Absent in the admin preview. */
  onSave?: (edits: { set: WeeklyTargets; unset: string[] }) => void | Promise<void>;
  /** Scroll this row into view and focus its + on open. */
  focusId?: string;
}

export default function TargetsSheet({ t, hidden, visible, effortSplit, weeklyTargets, userTargets, onClose, onSave, focusId }: TargetsSheetProps) {
  const [values, setValues] = useState<WeeklyTargets>({});
  const [busy, setBusy] = useState(false);
  const focusRef = useRef<HTMLButtonElement>(null);

  const current = (id: string) => values[id] ?? resolveWeeklyTarget(id, userTargets, weeklyTargets);
  const setValue = (id: string, v: number) => setValues((s) => ({ ...s, [id]: Math.max(0, Math.round(v)) }));
  const dirty = Object.keys(values).some((id) => values[id] !== resolveWeeklyTarget(id, userTargets, weeklyTargets));

  const sections = useMemo(() => marketSections({ t, hidden, visible, effortSplit }), [t, hidden, visible, effortSplit]);
  const all = useMemo(() => [...hidden, ...visible], [hidden, visible]);

  useEffect(() => {
    if (!focusId) return;
    const el = focusRef.current;
    el?.scrollIntoView?.({ block: "center" });
    el?.focus({ preventScroll: true });
  }, [focusId]);

  function resetAll() {
    const next: WeeklyTargets = {};
    for (const a of all) next[a.id] = weeklyTargets[a.id] ?? 0;
    setValues(next);
  }

  async function done() {
    const final: WeeklyTargets = {};
    for (const id of Object.keys(values)) final[id] = values[id];
    const edits = targetEdits(userTargets, weeklyTargets, final);
    if (onSave && (Object.keys(edits.set).length || edits.unset.length)) {
      setBusy(true);
      try { await onSave(edits); } finally { setBusy(false); }
    }
    onClose();
  }

  const anyOverride = all.some((a) => current(a.id) !== (weeklyTargets[a.id] ?? 0));

  return (
    <Sheet size="lg" title={t("perf.targetsTitle")} description={t("perf.targetsIntro")} onClose={onClose} dirty={dirty}
      footer={
        <SheetFooter
          primary={{ label: t("perf.done"), onClick: done, busy, busyLabel: "Saving…" }}
          secondary={anyOverride ? { label: t("perf.resetAll"), onClick: resetAll } : undefined}
        />
      }>
      <div className="space-y-6">
        {sections.map((section) => (
          <section key={section.market}>
            <MarketBanner emoji={section.emoji} main={section.main} subtitle={section.subtitle} tint={section.tint} />
            <div>
              {section.cats.map((c) => {
                const v = current(c.id);
                const recommended = weeklyTargets[c.id] ?? 0;
                const differs = v !== recommended;
                const perDay = v >= WORKDAYS_PER_WEEK ? Math.round(v / WORKDAYS_PER_WEEK) : 0;
                return (
                  <div key={c.id} className="flex items-center gap-4 border-b border-jh-line py-4">
                    <div className="min-w-0 flex-1">
                      <div className="font-display text-base font-semibold leading-snug text-jh-ink">{c.label}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[13px] text-jh-mute">
                        {perDay > 0 && <span>{fillTemplate(t("perf.perDay"), { n: perDay })}</span>}
                        {differs && (
                          <span>
                            {perDay > 0 && <span aria-hidden>· </span>}
                            {fillTemplate(t("perf.recommended"), { n: recommended })}
                            <span aria-hidden> · </span>
                            <button type="button" onClick={() => setValue(c.id, recommended)}
                              className="font-display font-semibold text-jh-ink underline-offset-2 hover:underline">
                              {t("perf.reset")}
                            </button>
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-none items-center gap-2">
                      <button type="button" onClick={() => setValue(c.id, v - 1)} disabled={v <= 0} aria-label={`Lower weekly target: ${c.label}`}
                        className="grid h-10 w-10 place-items-center rounded-pill border border-jh-line-2 bg-white text-jh-mute transition-colors duration-200 ease-out hover:border-jh-ink hover:text-jh-ink disabled:opacity-40 disabled:hover:border-jh-line-2 disabled:hover:text-jh-mute">
                        <Minus className="h-5 w-5" strokeWidth={1.5} aria-hidden />
                      </button>
                      <span aria-live="polite" className={`w-8 text-center font-display text-2xl font-bold leading-none ${v > 0 ? "text-jh-ink" : "text-jh-mute"}`}>{v}</span>
                      <button type="button" ref={c.id === focusId ? focusRef : undefined}
                        onClick={() => setValue(c.id, v + 1)} aria-label={`Raise weekly target: ${c.label}`}
                        className="grid h-10 w-10 place-items-center rounded-pill border border-jh-ink bg-white text-jh-ink transition-colors duration-200 ease-out hover:bg-jh-ink hover:text-white">
                        <Plus className="h-5 w-5" strokeWidth={1.5} aria-hidden />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </Sheet>
  );
}
