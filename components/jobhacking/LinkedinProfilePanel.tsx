"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Copy, ExternalLink, FileUp } from "lucide-react";
import { JH_SETTINGS_HREF } from "@/lib/jobhacking/sections";
import { LINKEDIN_LIMITS, LINKEDIN_SECTIONS, dateRange, linkedinPresent, measure, roleLine, roleMeta, skillsText, type Measure } from "@/lib/jobhacking/linkedin-profile";
import type { LinkedinProfile } from "@/lib/careerops/types";

// JobHacking → Artefacts → LinkedIn profile — docs/UX_JOBHACKING.md §3d.
//
// The LinkedIn profile as the member builds it: one block per LinkedIn section,
// in LinkedIn's order, only the sections the file carries. Every pasteable
// block — headline, About, each role's description, the skills list — has a
// Copy button and a count against LinkedIn's limit. Over the limit is the one
// red state here: a block LinkedIn will truncate is a genuine negative. The
// rest is the portal's quiet grammar — one heavy name, a mute second line, a
// neutral pill. Read-only: the Packer writes it, the member copies it.

export default function LinkedinProfilePanel({ linkedin }: { linkedin: LinkedinProfile | null | undefined }) {
  const present = linkedinPresent(linkedin);

  if (!present.length || !linkedin) {
    return (
      <div className="mx-auto max-w-md py-6 text-center">
        <p className="font-display font-semibold text-jh-ink">No LinkedIn profile yet</p>
        <p className="mt-1 text-sm text-jh-mute">Your coach&apos;s Packer writes each LinkedIn section into your profile.yml — headline, About, roles, skills. Upload it and they appear here, ready to paste.</p>
        <Link href={JH_SETTINGS_HREF} className="btn-secondary btn-sm mt-4"><FileUp className="h-4 w-4" strokeWidth={1.5} aria-hidden /> Upload profile</Link>
      </div>
    );
  }

  const label = (k: keyof LinkedinProfile) => LINKEDIN_SECTIONS.find((s) => s.key === k)!.label;
  const li = linkedin;

  return (
    <div className="space-y-8">
      {present.map((s) => {
        switch (s.key) {
          case "headline": return <Block key={s.key} id="li-headline" label={label("headline")} text={li.headline ?? ""} m={measure(li.headline, LINKEDIN_LIMITS.headline)} />;
          case "about": return <Block key={s.key} id="li-about" label={label("about")} text={li.about ?? ""} m={measure(li.about, LINKEDIN_LIMITS.about)} />;
          case "experience": return (
            <Section key={s.key} id="li-experience" label={label("experience")} n={li.experience!.length}>
              <ol className="divide-y divide-jh-line border-t border-jh-line">
                {li.experience!.map((e, i) => {
                  const m = measure(e.description, LINKEDIN_LIMITS.description);
                  return (
                    <li key={`${e.company}-${i}`} className="space-y-2 py-3">
                      <div>
                        <p className="font-display text-[15px] font-semibold text-jh-ink">{roleLine(e)}</p>
                        {roleMeta(e) && <p className="text-sm text-jh-mute">{roleMeta(e)}</p>}
                      </div>
                      {e.description?.trim() && <Pasteable id={`li-role-${i}`} label={`${roleLine(e)} description`} text={e.description} m={m} />}
                      {!!e.skills?.length && <ul className="flex flex-wrap gap-2">{e.skills.map((k) => <li key={k} className="pill-neutral">{k}</li>)}</ul>}
                    </li>
                  );
                })}
              </ol>
            </Section>
          );
          case "featured": return (
            <Section key={s.key} id="li-featured" label={label("featured")} n={li.featured!.length}>
              <ul className="divide-y divide-jh-line border-t border-jh-line">
                {li.featured!.map((f, i) => (
                  <Row key={`${f.title}-${i}`} title={f.title} line={f.kind ? f.kind.charAt(0).toUpperCase() + f.kind.slice(1) : ""} url={f.url} />
                ))}
              </ul>
            </Section>
          );
          case "skills": return (
            <Section key={s.key} id="li-skills" label={label("skills")} n={li.skills!.length} action={<CopyButton text={skillsText(li.skills)} label="Copy skills, one per line" />}>
              <ol className="flex flex-wrap gap-2">
                {/* The first three are LinkedIn's pinned Top skills — the one place the index is worth showing. */}
                {li.skills!.map((k, i) => <li key={k} className={i < 3 ? "pill-visible" : "pill-neutral"}>{i < 3 && <span className="mr-1 font-mono text-[11px] text-jh-mute">{i + 1}</span>}{k}</li>)}
              </ol>
              <p className="text-xs text-jh-mute">{li.skills!.length} of {LINKEDIN_LIMITS.skills} · the first three are your pinned Top skills.</p>
            </Section>
          );
          case "education": return (
            <Section key={s.key} id="li-education" label={label("education")} n={li.education!.length}>
              <ul className="divide-y divide-jh-line border-t border-jh-line">
                {li.education!.map((e, i) => (
                  <Row key={`${e.school}-${i}`} title={e.school} line={[[e.degree, e.field].filter(Boolean).join(", "), dateRange(e.start, e.end, { presentWhenOpen: false })].filter(Boolean).join(" · ")} />
                ))}
              </ul>
            </Section>
          );
          case "certifications": return (
            <Section key={s.key} id="li-certifications" label={label("certifications")} n={li.certifications!.length}>
              <ul className="divide-y divide-jh-line border-t border-jh-line">
                {li.certifications!.map((c, i) => (
                  <Row key={`${c.name}-${i}`} title={c.name} line={[c.issuer, c.issued && `Issued ${dateRange(c.issued, undefined, { presentWhenOpen: false })}`].filter(Boolean).join(" · ")} url={c.url} />
                ))}
              </ul>
            </Section>
          );
        }
      })}
      <p className="text-xs text-jh-mute">Written by your coach, in LinkedIn&apos;s own sections. Copy each block into the matching section on LinkedIn; a count in red is over what LinkedIn allows. Upload a new profile.yml to change them.</p>
    </div>
  );
}

function Section({ id, label, n, action, children }: { id: string; label: string; n?: number; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-3">
      <header className="flex items-center justify-between gap-3">
        <h3 id={id} className="section-label flex items-center gap-2">
          {label}
          {n !== undefined && <span className="font-mono text-xs font-normal normal-case tracking-normal text-jh-mute">{n}</span>}
        </h3>
        {action}
      </header>
      {children}
    </section>
  );
}

/** A top-level pasteable section: heading, count, Copy, the text. */
function Block({ id, label, text, m }: { id: string; label: string; text: string; m: Measure }) {
  return (
    <Section id={id} label={label} action={<CopyButton text={text} label={`Copy ${label.toLowerCase()}`} />}>
      <Pasteable id={`${id}-text`} label={label} text={text} m={m} copy={false} />
    </Section>
  );
}

/** The text as it will be pasted, with its length against LinkedIn's limit. */
function Pasteable({ id, label, text, m, copy = true }: { id: string; label: string; text: string; m: Measure; copy?: boolean }) {
  return (
    <div className="space-y-1.5">
      <p id={id} className="whitespace-pre-wrap rounded-sm border border-jh-line bg-jh-mist/40 p-3 text-sm text-jh-body">{text}</p>
      <div className="flex items-center justify-between gap-3">
        <Count m={m} />
        {copy && <CopyButton text={text} label={`Copy ${label}`} />}
      </div>
    </div>
  );
}

/** "187 / 220" — red only when over; that is the panel's one negative state. */
function Count({ m }: { m: Measure }) {
  return (
    <p className={`font-mono text-xs tabular-nums ${m.over ? "text-jh-red" : "text-jh-mute"}`} role={m.over ? "alert" : undefined}>
      {m.length.toLocaleString()} / {m.limit.toLocaleString()}{m.over && <span> · over by {(m.length - m.limit).toLocaleString()}</span>}
    </p>
  );
}

/** A quiet row: name, one mute line, one link target where there is a URL. */
function Row({ title, line, url }: { title: string; line?: string; url?: string }) {
  return (
    <li className="grid min-h-[44px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2">
      <div className="min-w-0">
        <p className="truncate font-display text-[15px] font-semibold text-jh-ink">{title}</p>
        {line && <p className="truncate text-sm text-jh-mute">{line}</p>}
      </div>
      {url?.trim() && (
        <a href={url} target="_blank" rel="noreferrer" className="icon-btn" aria-label={`${title} — opens in a new tab`} title="Open">
          <ExternalLink className="h-4 w-4" strokeWidth={1.5} aria-hidden />
        </a>
      )}
    </li>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  useEffect(() => { if (!done) return; const t = setTimeout(() => setDone(false), 1800); return () => clearTimeout(t); }, [done]);
  async function copy() {
    try { await navigator.clipboard.writeText(text); setDone(true); } catch { /* the text is on screen to select by hand */ }
  }
  return (
    <button type="button" onClick={copy} className="btn-secondary btn-sm" aria-label={done ? "Copied" : label}>
      {done ? <Check className="h-4 w-4" strokeWidth={1.5} aria-hidden /> : <Copy className="h-4 w-4" strokeWidth={1.5} aria-hidden />}
      {done ? "Copied" : "Copy"}
    </button>
  );
}
