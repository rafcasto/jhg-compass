"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import type { ProfileFile } from "@/lib/careerops/profile-file";
import { completedSteps, latestJobFor, type CoachScript, type Step, type StepContext } from "@/lib/engine/coach/script";
import { ENGINE_JOB_LABELS, type EngineJobType } from "@/lib/engine/keys";
import { BASE_OF, findJhSection, jhSectionHref, type ProfilePortal } from "@/lib/jobhacking/sections";
import JobStatus from "./JobStatus";

// The record of decisions (docs/UX_SCRIPTED_COACH.md §2): every answered step as the member's block, in the answer's own
// words, with the write line under it and *Change ›*. The questions are not repeated — they live in the slot. A job step's
// record is its job line. Rendered from the stored profile, never stored itself: resume is free.

export default function StepTranscript({ script, profile, ctx, portal, uid, jobHref, onChange, handoff, wide = false }: {
  script: CoachScript;
  /** Where a job line's View › goes — the page this coach writes. */
  jobHref: string;
  profile: ProfileFile;
  ctx: StepContext;
  portal: ProfilePortal;
  uid?: string;
  /** Reopen an answered step. */
  onChange: (step: Step) => void;
  /** One mute line when the panel switched coaches. */
  handoff?: string | null;
  wide?: boolean;
}) {
  const steps = completedSteps(script, profile, ctx);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView?.({ block: "end" }); }, [steps.length]);
  const body = wide ? "text-base leading-[1.75] text-jh-ink" : "text-[15px] leading-relaxed text-jh-ink";
  const base = BASE_OF[portal];

  return (
    <div className="space-y-6" aria-live="polite">
      {handoff && <p role="status" className="text-sm text-jh-mute">{handoff}</p>}
      {steps.map((step) => {
        if (step.kind === "job") {
          const job = latestJobFor(step, ctx);
          return job && uid
            ? <JobStatus key={step.id} uid={uid} job={{ id: job.id, type: job.type, label: ENGINE_JOB_LABELS[job.type as EngineJobType] ?? job.type }} href={jobHref} />
            : <p key={step.id} className="text-sm text-jh-mute">Postings read earlier — on the page.</p>;
        }
        const sections = step.sections.map((k) => findJhSection(k)).filter((d): d is NonNullable<typeof d> => !!d);
        const linked = sections.find((d) => !d.only || d.only === portal);
        return (
          <div key={step.id} className="space-y-2">
            <div className="rounded-md bg-jh-mist px-4 py-3">
              <p className="section-label mb-1">You</p>
              <p className={body}>{step.summary(step.read(profile))}</p>
            </div>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-jh-ink">
              <span className="inline-flex items-center gap-2"><Check className="h-4 w-4 shrink-0 text-rb-green-dark" aria-hidden /> {step.kind === "review" ? "Saved" : `Updated ${sections.map((d) => d.label).join(", ") || "your profile"}`}</span>
              {linked && <Link href={jhSectionHref(linked.key, base)} className="link text-sm">View ›</Link>}
              {step.kind !== "review" && <button type="button" onClick={() => onChange(step)} className="text-sm text-jh-mute underline-offset-2 hover:text-jh-ink hover:underline">Change ›</button>}
            </p>
          </div>
        );
      })}
      <div ref={end} />
    </div>
  );
}
