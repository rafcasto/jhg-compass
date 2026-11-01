"use client";

import { useState } from "react";
import { setDoc } from "firebase/firestore";
import { Check, Plus, Save, TriangleAlert, X } from "lucide-react";
import { paths } from "@/lib/firestore/db";
import { ARTEFACT_CAPS, STORY_COPY, STORY_FIELDS, coerceStories, storyFilled, type Story } from "@/lib/careerops/artefacts";
import { buildSetupProfileYaml } from "@/lib/careerops/setup-yaml";
import type { CareerOpsSetupV2 } from "@/lib/careerops/types";
import type { Profile } from "@/lib/types";

// Artefacts · Stories — docs/UX_PROFILE.md §8. One card per story: the L1
// title on top, the five CCARR fields under it. Same recipe as NotesPanel:
// local draft, one Save, merge write that rebuilds profile.yml.
//
// A story with no title is dropped on save (coerceStories), not written as an
// empty row — the agents would otherwise quote a blank.

const blank = (): Story => ({ title: "" });

export default function StoriesPanel({ uid, setup, profile }: { uid: string; setup: CareerOpsSetupV2 | null; profile: Profile | null | undefined }) {
  const [stories, setStories] = useState<Story[]>(setup?.stories?.length ? setup.stories : [blank()]);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const touch = () => { setDirty(true); setMsg(null); };
  const update = (i: number, patch: Partial<Story>) => { setStories(stories.map((s, j) => (j === i ? { ...s, ...patch } : s))); touch(); };
  const remove = (i: number) => { setStories(stories.filter((_, j) => j !== i)); touch(); };

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const next = coerceStories(stories);
      await setDoc(
        paths.careerOpsSetup(uid),
        { stories: next, profileYaml: buildSetupProfileYaml({ profile, setup, overrides: { stories: next } }), updatedAt: Date.now() },
        { merge: true },
      );
      setStories(next.length ? next : [blank()]);
      setDirty(false);
      setMsg(`Saved — ${next.length} ${next.length === 1 ? "story" : "stories"}. The agents draw on these for interview prep and cover letters.`);
    } catch {
      setMsg("Couldn't save that — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-jh-mute text-sm max-w-2xl">
        Start with the project (L1). Then tell it as CCARR (L2): what the situation was, what was yours to solve, what you did, what it delivered — in numbers — and which target it is for.
      </p>

      <ol className="space-y-4">
        {stories.map((s, i) => {
          const n = storyFilled(s);
          return (
            <li key={i} className="card space-y-4 p-4 sm:p-6">
              <div className="flex items-start gap-3">
                <label className="block min-w-0 flex-1">
                  <span className="label">Story {i + 1} · title<span className="font-normal normal-case tracking-normal text-jh-mute"> · {n}/{STORY_FIELDS.length} CCARR</span></span>
                  <input className="field" value={s.title} placeholder="e.g. Monthly to fortnightly releases at 110 engineers" onChange={(e) => update(i, { title: e.target.value })} />
                </label>
                <button type="button" aria-label={`Remove story ${i + 1}`} onClick={() => remove(i)} className="icon-btn icon-btn-danger mt-5"><X className="h-4 w-4" aria-hidden /></button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {STORY_FIELDS.map((f) => (
                  <label key={f} className={`block ${f === "relevance" ? "sm:col-span-2" : ""}`}>
                    <span className="label">{STORY_COPY[f].label}</span>
                    <textarea
                      aria-label={`${STORY_COPY[f].label} ${i + 1}`}
                      className="field text-sm min-h-[4.5rem]"
                      value={s[f] ?? ""}
                      placeholder={STORY_COPY[f].placeholder}
                      onChange={(e) => update(i, { [f]: e.target.value })}
                    />
                    <span className="block text-xs text-jh-mute mt-1">{STORY_COPY[f].hint}</span>
                  </label>
                ))}
              </div>
            </li>
          );
        })}
      </ol>

      {stories.length < ARTEFACT_CAPS.stories && (
        <button type="button" onClick={() => { setStories([...stories, blank()]); touch(); }} className="btn-secondary btn-sm"><Plus className="h-4 w-4" aria-hidden /> Add story</button>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-jh-line pt-3">
        <button type="button" onClick={save} disabled={busy || !dirty} className="btn-primary text-sm disabled:opacity-60">
          <Save className="h-4 w-4" aria-hidden /> {busy ? "Saving…" : "Save stories"}
        </button>
        {msg && (
          <p role="status" className={`flex items-start gap-1.5 text-sm ${msg.startsWith("Saved") ? "text-rb-green-dark" : "text-jh-red"}`}>
            {msg.startsWith("Saved") ? <Check className="h-4 w-4 shrink-0 mt-0.5" aria-hidden /> : <TriangleAlert className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />} {msg}
          </p>
        )}
      </div>
    </div>
  );
}
