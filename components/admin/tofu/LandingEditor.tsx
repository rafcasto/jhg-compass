"use client";

import type { FunnelConfig } from "@/lib/funnel";
import { Field, NumberField, Section } from "@/components/admin/shared";

type Patch = (fn: (f: FunnelConfig) => FunnelConfig) => void;

// The public landing → details → thank-you journey, plus the two dead-ends
// (expired link, already registered). Quiz questions live on the Quiz sub-tab.
export default function LandingEditor({ funnel: f, patch }: { funnel: FunnelConfig; patch: Patch }) {
  const set = <S extends keyof FunnelConfig>(section: S) => <K extends keyof FunnelConfig[S]>(key: K, value: FunnelConfig[S][K]) =>
    patch((c) => ({ ...c, [section]: { ...(c[section] as object), [key]: value } }));
  const landing = set("landing"), details = set("details"), lead = set("lead"), expired = set("expired"), blocked = set("blocked"), countdown = set("countdown");
  const setCard = (i: number, title: string) =>
    patch((c) => ({ ...c, landing: { ...c.landing, cards: c.landing.cards.map((x, j) => (j === i ? { ...x, title } : x)) } }));

  return (
    <div className="space-y-6">
      <Section title="Hero" help="First screen of jobhackers.global/compass — the promise and the CTA.">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Header tag" value={f.landing.headTag} onChange={(v) => landing("headTag", v)} />
          <Field label="CTA label" value={f.landing.ctaLabel} onChange={(v) => landing("ctaLabel", v)} />
          <Field label="Brand name" value={f.landing.brandName} onChange={(v) => landing("brandName", v)} />
          <Field label="Brand accent" value={f.landing.brandAccent} onChange={(v) => landing("brandAccent", v)} />
          <Field label="Hero headline" value={f.landing.heroH1} onChange={(v) => landing("heroH1", v)} />
          <Field label="Hero headline accent (red)" value={f.landing.heroH1Accent} onChange={(v) => landing("heroH1Accent", v)} />
          <Field className="sm:col-span-2" textarea label="Hero sub" value={f.landing.heroSub} onChange={(v) => landing("heroSub", v)} />
          <Field label="Proof row" value={f.landing.proofrow} onChange={(v) => landing("proofrow", v)} />
          <Field label="“What you get” eyebrow" value={f.landing.getEyebrow} onChange={(v) => landing("getEyebrow", v)} />
          <Field label="Footer" value={f.landing.footer} onChange={(v) => landing("footer", v)} />
          <Field label="Tagline" value={f.landing.tagline} onChange={(v) => landing("tagline", v)} />
        </div>
        <div>
          <p className="label">“What you get” bullets</p>
          <div className="space-y-2">
            {f.landing.cards.map((c, i) => (
              <input key={i} aria-label={`Bullet ${i + 1}`} className="field py-2 text-sm" value={c.title} onChange={(e) => setCard(i, e.target.value)} placeholder="Bullet text" />
            ))}
          </div>
        </div>
      </Section>

      <Section title="Countdown timer" help={<><strong>Evergreen</strong> = a per-visitor timer that persists across reloads; <strong>Fixed</strong> = one shared deadline for everyone.</>}>
        <div className="grid sm:grid-cols-4 gap-4">
          <div>
            <label htmlFor="cd-mode" className="label mb-0">Mode</label>
            <select id="cd-mode" className="field mt-1.5 text-sm" value={f.countdown.mode} onChange={(e) => countdown("mode", e.target.value as "fixed" | "evergreen")}>
              <option value="evergreen">evergreen</option>
              <option value="fixed">fixed</option>
            </select>
          </div>
          <NumberField label="Evergreen hours" min={1} value={f.countdown.hours} onChange={(v) => countdown("hours", Math.max(1, v))} />
          <Field label="Fixed deadline (ISO)" value={f.countdown.deadline} onChange={(v) => countdown("deadline", v)} mono />
          <Field label="Countdown label" value={f.landing.countdownLabel} onChange={(v) => landing("countdownLabel", v)} />
        </div>
      </Section>

      <Section title="Details form (before the quiz)" help="Name + email capture. This is the Acquisition moment in Pirate Metrics.">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Eyebrow" value={f.details.eyebrow} onChange={(v) => details("eyebrow", v)} />
          <Field label="Title" value={f.details.title} onChange={(v) => details("title", v)} />
          <Field className="sm:col-span-2" textarea label="Lede" value={f.details.lede} onChange={(v) => details("lede", v)} />
          <Field label="First-name label" value={f.details.firstNameLabel} onChange={(v) => details("firstNameLabel", v)} />
          <Field label="Last-name label" value={f.details.lastNameLabel} onChange={(v) => details("lastNameLabel", v)} />
          <Field label="Email label" value={f.details.emailLabel} onChange={(v) => details("emailLabel", v)} />
          <Field label="Submit button" value={f.details.submitLabel} onChange={(v) => details("submitLabel", v)} />
          <Field className="sm:col-span-2" label="Consent line" value={f.details.consent} onChange={(v) => details("consent", v)} />
        </div>
      </Section>

      <Section title="Thank-you page" help={<>Shown after the quiz. The button continues to the <strong>registration link</strong> below — generate one on the Registration &amp; access sub-tab and click “Use in funnel”.</>}>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Eyebrow" value={f.lead.eyebrow} onChange={(v) => lead("eyebrow", v)} />
          <Field label="Title" value={f.lead.title} onChange={(v) => lead("title", v)} />
          <Field className="sm:col-span-2" textarea label="Body" value={f.lead.body} onChange={(v) => lead("body", v)} />
          <Field label="CTA label" value={f.lead.ctaLabel} onChange={(v) => lead("ctaLabel", v)} />
          <Field label="Fine print" value={f.lead.fine} onChange={(v) => lead("fine", v)} />
          <Field label="Tagline" value={f.lead.tagline} onChange={(v) => lead("tagline", v)} />
          <Field className="sm:col-span-2" label="Registration link the CTA continues to" mono value={f.inviteUrl}
            onChange={(v) => patch((c) => ({ ...c, inviteUrl: v }))} placeholder="https://…/register/…"
            help="We append ?firstName=&lastName=&email= so people don't re-type their details. Use a time-boxed /register/<token> link — when it expires, visitors see the expired-link screen." />
        </div>
      </Section>

      <Section title="Expired-link screen" help="Shown when a registration link has expired — invites people to the next meetup for a fresh invite.">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Eyebrow" value={f.expired.eyebrow} onChange={(v) => expired("eyebrow", v)} />
          <Field label="Title" value={f.expired.title} onChange={(v) => expired("title", v)} />
          <Field className="sm:col-span-2" textarea label="Body" value={f.expired.body} onChange={(v) => expired("body", v)} />
          <Field label="CTA label" value={f.expired.ctaLabel} onChange={(v) => expired("ctaLabel", v)} />
          <Field label="Meetup URL" value={f.expired.meetupUrl} onChange={(v) => expired("meetupUrl", v)} mono />
        </div>
      </Section>

      <Section title="“Already done” screen" help="Shown when someone who already completed the quiz, or is already a member, tries to take it again.">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Title" value={f.blocked.title} onChange={(v) => blocked("title", v)} />
          <Field label="CTA label" value={f.blocked.ctaLabel} onChange={(v) => blocked("ctaLabel", v)} />
          <Field className="sm:col-span-2" textarea label="Body" value={f.blocked.body} onChange={(v) => blocked("body", v)} />
          <Field label="CTA link" value={f.blocked.ctaHref} onChange={(v) => blocked("ctaHref", v)} mono />
        </div>
      </Section>
    </div>
  );
}
