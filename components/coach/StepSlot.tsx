"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Segmented from "@/components/shell/Segmented";
import type { ProfileFile } from "@/lib/careerops/profile-file";
import { asList, asRecord, asString, canContinue, splitList, stepFields, validateStep, type FieldValue, type JobLike, type Step, type StepField, type StepValues } from "@/lib/engine/coach/script";
import { ENGINE_JOB_LABELS, type EngineJobType } from "@/lib/engine/keys";
import JobStatus from "./JobStatus";
import { FIRST_JOB_ASIDE } from "./Transcript";

// The step in the footer slot — where the composer was (docs/UX_SCRIPTED_COACH.md §2–§3). One question bold, the part's
// aside once, labels that recede, fields by kind, one red (Continue). A pick with no other field advances on tap. The
// answered step collapses into the transcript as the member's block; the next step fills the slot. Nothing moves.

export interface StepSlotProps {
  step: Step;
  profile: ProfileFile;
  /** The part's aside — on the first step of a part only. */
  aside?: string;
  /** The member is on an earlier step again (Back · Change): the stored answer is in the fields. */
  reopened?: boolean;
  busy?: boolean;
  error?: string | null;
  /** A job step's most recent job: its failure shows above the fields; while it runs, the slot shows only the line. */
  job?: JobLike | null;
  uid?: string;
  jobHref?: string;
  onSubmit: (values: StepValues) => void;
  onSkip?: () => void;
  onBack?: () => void;
  wide?: boolean;
}

const running = (j: JobLike | null | undefined) => !!j && (j.status === "queued" || j.status === "running");

export default function StepSlot({ step, profile, aside, reopened = false, busy = false, error, job, uid, jobHref, onSubmit, onSkip, onBack, wide = false }: StepSlotProps) {
  const fields = useMemo(() => stepFields(step, profile), [step, profile]);
  const [values, setValues] = useState<StepValues>(() => step.read(profile));
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [tried, setTried] = useState(false);
  // A new step, new fields: start from what is stored (empty for a fresh one, the answer for a reopened one).
  useEffect(() => { setValues(step.read(profile)); setTouched(new Set()); setTried(false); }, [step.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const problems = validateStep(step, values, profile);
  const ok = canContinue(step, values, profile);
  const set = (key: string, v: FieldValue) => { setValues((cur) => ({ ...cur, [key]: v })); setTouched((t) => new Set(t).add(key)); };
  const show = (key: string) => (tried || touched.has(key)) && problems[key];
  const submit = () => { setTried(true); if (ok && !busy) onSubmit(values); };
  // One pick and nothing else: the tap is the Continue.
  const soloPick = fields.length === 1 && fields[0].kind === "pick" && step.kind !== "job";

  if (step.kind === "job" && running(job) && uid) {
    return (
      <div className="space-y-3">
        <p className={`font-semibold text-jh-ink ${wide ? "text-lg" : "text-base"}`}>{step.question}</p>
        <JobStatus uid={uid} job={{ id: job!.id, type: job!.type, label: ENGINE_JOB_LABELS[job!.type as EngineJobType] ?? job!.type }} href={jobHref} aside={FIRST_JOB_ASIDE} />
      </div>
    );
  }

  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); submit(); }} aria-labelledby={`step-${step.id}`}>
      <div className="space-y-2">
        {aside && !reopened && <p className="text-sm text-jh-mute">{aside}</p>}
        <p id={`step-${step.id}`} className={`font-semibold text-jh-ink ${wide ? "text-lg" : "text-base"}`}>{step.question}</p>
        {step.help && <p className="max-w-prose text-sm text-jh-mute">{step.help}</p>}
      </div>
      {step.kind === "job" && job && uid && !running(job) && job.status === "failed" && <JobStatus uid={uid} job={{ id: job.id, type: job.type, label: ENGINE_JOB_LABELS[job.type as EngineJobType] ?? job.type }} href={jobHref} />}
      {fields.length > 0 && (
        <div className="space-y-3">
          {fields.map((f) => <Field key={f.key} field={f} value={values[f.key]} onChange={(v) => { set(f.key, v); if (soloPick) setTimeout(() => onSubmit({ ...values, [f.key]: v }), 0); }} problem={show(f.key) || undefined} disabled={busy} />)}
        </div>
      )}
      {error && <p role="alert" className="text-sm text-jh-red">{error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pt-1">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {onBack && <button type="button" onClick={onBack} disabled={busy} className="text-sm text-jh-mute underline-offset-2 hover:text-jh-ink hover:underline">‹ Back</button>}
          {step.skipValues && onSkip && <button type="button" onClick={onSkip} disabled={busy} className="text-sm text-jh-mute underline-offset-2 hover:text-jh-ink hover:underline">I don&apos;t know yet</button>}
        </div>
        {!soloPick && <button type="submit" disabled={!ok || busy} className="btn-primary h-11 disabled:opacity-60">{busy ? "Saving…" : step.action ?? (reopened ? "Save" : "Continue")}</button>}
      </div>
    </form>
  );
}

// ---- fields ----

function Field({ field: f, value, onChange, problem, disabled }: { field: StepField; value: FieldValue | undefined; onChange: (v: FieldValue) => void; problem?: string; disabled: boolean }) {
  const id = `field-${f.key}`;
  const line = problem ? <p id={`${id}-problem`} className="mt-1 text-sm text-jh-red" role="alert">{problem}</p> : f.help ? <p id={`${id}-help`} className="mt-1 text-xs text-jh-mute">{f.help}</p> : null;
  const describedBy = problem ? `${id}-problem` : f.help ? `${id}-help` : undefined;

  if (f.kind === "pick") {
    const options = f.options ?? [];
    return (
      <div>
        <span className="label" id={`${id}-label`}>{f.label}</span>
        {options.length <= 4
          ? <Segmented items={options.map((o) => ({ key: o.value, label: o.label }))} value={asString(value)} onChange={(k) => onChange(k)} fill label={f.label} />
          : <select id={id} aria-labelledby={`${id}-label`} aria-describedby={describedBy} value={asString(value)} onChange={(e) => onChange(e.target.value)} disabled={disabled} className="field h-11 py-0">
              <option value="">{f.placeholder ?? "Choose"}</option>
              {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>}
        {line}
      </div>
    );
  }

  if (f.kind === "chips") return <Chips field={f} value={value} onChange={onChange} line={line} describedBy={describedBy} disabled={disabled} />;

  if (f.kind === "multi") {
    const picked = asList(value);
    const toggle = (v: string) => onChange(picked.includes(v) ? picked.filter((x) => x !== v) : [...picked, v]);
    return (
      <fieldset>
        <legend className="label">{f.label}</legend>
        <ul className="divide-y divide-jh-line border-y border-jh-line">
          {(f.options ?? []).map((o) => (
            <li key={o.value}>
              <label className="flex min-h-[44px] cursor-pointer items-center gap-3 py-2">
                <input type="checkbox" checked={picked.includes(o.value)} onChange={() => toggle(o.value)} disabled={disabled || (!picked.includes(o.value) && !!f.max && picked.length >= f.max)} className="h-4 w-4 accent-jh-ink" />
                <span className="min-w-0 flex-1 text-[15px] text-jh-ink">{o.label}</span>
                {o.hint && <span className="shrink-0 font-mono text-xs text-jh-mute">{o.hint}</span>}
              </label>
            </li>
          ))}
        </ul>
        <p className="mt-1 font-mono text-xs text-jh-mute" aria-live="polite">{picked.length} of {f.max ?? f.options?.length ?? 0} picked{f.min ? ` · at least ${f.min}` : ""}</p>
        {line}
      </fieldset>
    );
  }

  if (f.kind === "bucket") {
    const r = asRecord(value);
    return (
      <fieldset>
        <legend className="label">{f.label}</legend>
        <ul className="divide-y divide-jh-line border-y border-jh-line">
          {(f.rows ?? []).map((row) => (
            <li key={row} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
              <span className="min-w-0 flex-1 text-[15px] text-jh-ink">{row}</span>
              <Segmented items={(f.options ?? []).map((o) => ({ key: o.value, label: o.label }))} value={r[row] ?? ""} onChange={(k) => onChange({ ...r, [row]: k })} label={`${row}: ${f.label}`} />
            </li>
          ))}
        </ul>
        {line}
      </fieldset>
    );
  }

  const text = asString(value);
  const counter = f.max && (f.kind === "text" || f.kind === "textarea") ? <span className={`font-mono text-xs ${text.length > f.max ? "text-jh-red" : "text-jh-mute"}`}>{text.length} / {f.max}</span> : null;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2"><label htmlFor={id} className="label">{f.label}</label>{counter}</div>
      {f.kind === "textarea"
        ? <textarea id={id} value={text} onChange={(e) => onChange(e.target.value)} disabled={disabled} placeholder={f.placeholder} aria-describedby={describedBy} aria-invalid={!!problem} rows={3} className="field resize-none text-[15px]" />
        : <input id={id} type="text" inputMode={f.kind === "number" ? "numeric" : undefined} value={text} onChange={(e) => onChange(e.target.value)} disabled={disabled} placeholder={f.placeholder} aria-describedby={describedBy} aria-invalid={!!problem} className="field h-11 py-0" />}
      {line}
    </div>
  );
}

// A free list: the typed text is local state and the parsed list is emitted — never control the input from the parsed
// list (KeywordArea's rule, CLAUDE.md).
function Chips({ field: f, value, onChange, line, describedBy, disabled }: { field: StepField; value: FieldValue | undefined; onChange: (v: FieldValue) => void; line: ReactNode; describedBy?: string; disabled: boolean }) {
  const id = `field-${f.key}`;
  const [text, setText] = useState(() => asList(value).join(", "));
  const n = asList(value).length;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="label">{f.label}</label>
        {f.max ? <span className={`font-mono text-xs ${n > f.max ? "text-jh-red" : "text-jh-mute"}`}>{n} / {f.max}</span> : null}
      </div>
      <input id={id} type="text" value={text} onChange={(e) => { setText(e.target.value); onChange(splitList(e.target.value)); }} disabled={disabled} placeholder={f.placeholder} aria-describedby={describedBy} className="field h-11 py-0" />
      {line}
    </div>
  );
}
