"use client";

import { cloneElement, useId, useState, type ReactElement } from "react";
import { useContent } from "@/lib/firestore/content";
import type { Contact, Opportunity } from "@/lib/types";
import type { Market } from "@/lib/categories";
import { CONTACT_TYPES, CONTACT_TYPE_TKEY, DEFAULT_CONTACT_TYPE, normalizeContactType, type ContactType } from "@/lib/contacts";
import Segmented from "@/components/shell/Segmented";

// Form building blocks for the Progress-tab sheets. ONE contact form and ONE job
// form, used by add / edit / create-and-attach alike so the three never drift.
//
// Layout rules (docs/UX_AUDIT_PROGRESS_MODALS.md §3):
//   rows gap-4 (16) · groups gap-6 (24) with a section label · single column on
//   phones, pairs only for short siblings · the one required field is starred,
//   nothing is marked "(optional)".

// ---- state -------------------------------------------------------------------
export function useForm<T extends object>(initial: T) {
  const [f, setF] = useState<T>(initial);
  const [start] = useState<T>(initial);
  const set = <K extends keyof T>(k: K, v: T[K]) => setF((p) => ({ ...p, [k]: v }));
  const dirty = (Object.keys(start) as (keyof T)[]).some((k) => f[k] !== start[k]);
  return { f, set, dirty };
}

// ---- Field -------------------------------------------------------------------
// Label + control + optional hint/error. Wires id / htmlFor / aria-describedby so
// clicking a label focuses its control and assistive tech reads the pair.
export function Field({ label, required, hint, error, children }: {
  label: string; required?: boolean; hint?: string; error?: string;
  children: ReactElement<{ id?: string; className?: string; "aria-invalid"?: boolean; "aria-describedby"?: string }>;
}) {
  const id = useId();
  const helpId = `${id}-h`;
  const base = children.props.className ?? "field";
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={`label ${required ? "after:ml-0.5 after:text-jh-red after:content-['*']" : ""}`}>{label}</label>
      {cloneElement(children, {
        id,
        className: `${base} ${error ? "border-jh-red focus:ring-jh-red/20" : ""}`.trim(),
        "aria-invalid": error ? true : undefined,
        "aria-describedby": error || hint ? helpId : undefined,
      })}
      {(error || hint) && <p id={helpId} className={`mt-1.5 text-[13px] leading-snug ${error ? "text-jh-red" : "text-jh-mute"}`}>{error ?? hint}</p>}
    </div>
  );
}

export function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>;
}

export function Group({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <fieldset className="min-w-0 space-y-4">
      {label && <legend className="section-label mb-3">{label}</legend>}
      {children}
    </fieldset>
  );
}

// ---- Contact -----------------------------------------------------------------
export interface ContactFields {
  fullName: string; company: string; role: string; type: ContactType; email: string; phone: string; linkedinUrl: string;
}
export function contactFields(c?: Partial<Contact>): ContactFields {
  return {
    fullName: c?.fullName ?? "", company: c?.company ?? "", role: c?.role ?? "",
    type: c?.type ? normalizeContactType(c.type) : (DEFAULT_CONTACT_TYPE as ContactType),
    email: c?.email ?? "", phone: c?.phone ?? "", linkedinUrl: c?.linkedinUrl ?? "",
  };
}
export function cleanContact(f: ContactFields): ContactFields {
  return { ...f, fullName: f.fullName.trim(), phone: f.phone.trim(), email: f.email.trim(), linkedinUrl: f.linkedinUrl.trim() };
}

export function ContactForm({ id, f, set, onSubmit, autoFocus = true }: {
  id: string; f: ContactFields; set: <K extends keyof ContactFields>(k: K, v: ContactFields[K]) => void;
  onSubmit: (e: React.FormEvent) => void; autoFocus?: boolean;
}) {
  const { t } = useContent();
  return (
    <form id={id} onSubmit={onSubmit} className="space-y-6">
      <Group>
        <Row>
          <Field label={t("tracker.f.fullName")} required>
            <input value={f.fullName} onChange={(e) => set("fullName", e.target.value)} autoFocus={autoFocus} required autoComplete="name" />
          </Field>
          <Field label={t("tracker.f.contactType")}>
            <select value={f.type} onChange={(e) => set("type", e.target.value as ContactType)}>
              {CONTACT_TYPES.map((ct) => <option key={ct} value={ct}>{t(CONTACT_TYPE_TKEY[ct])}</option>)}
            </select>
          </Field>
        </Row>
        <Row>
          <Field label={t("tracker.f.company")}>
            <input value={f.company} onChange={(e) => set("company", e.target.value)} autoComplete="organization" />
          </Field>
          <Field label={t("tracker.f.role")}>
            <input value={f.role} onChange={(e) => set("role", e.target.value)} autoComplete="organization-title" />
          </Field>
        </Row>
      </Group>
      <Group label={t("tracker.f.reach")}>
        <Row>
          <Field label={t("tracker.f.email")}>
            <input type="email" inputMode="email" autoComplete="email" value={f.email} onChange={(e) => set("email", e.target.value)} />
          </Field>
          <Field label={t("tracker.f.phone")}>
            <input type="tel" inputMode="tel" autoComplete="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} />
          </Field>
        </Row>
        <Field label={t("tracker.f.linkedin")}>
          <input type="url" inputMode="url" placeholder="https://linkedin.com/in/…" value={f.linkedinUrl} onChange={(e) => set("linkedinUrl", e.target.value)} />
        </Field>
      </Group>
    </form>
  );
}

// ---- Opportunity ---------------------------------------------------------------
export interface OpportunityFields { company: string; role: string; market: Market; source: string; url: string; notes: string }
export function opportunityFields(o?: Partial<Opportunity>): OpportunityFields {
  return {
    company: o?.company ?? "", role: o?.role ?? "", market: (o?.market ?? "hidden") as Market,
    source: o?.source ?? "", url: o?.url ?? "", notes: o?.notes ?? "",
  };
}
export function cleanOpportunity(f: OpportunityFields): OpportunityFields {
  return { ...f, company: f.company.trim(), role: f.role.trim(), source: f.source.trim(), url: f.url.trim(), notes: f.notes.trim() };
}

export function OpportunityForm({ id, f, set, onSubmit, autoFocus = true }: {
  id: string; f: OpportunityFields; set: <K extends keyof OpportunityFields>(k: K, v: OpportunityFields[K]) => void;
  onSubmit: (e: React.FormEvent) => void; autoFocus?: boolean;
}) {
  const { t } = useContent();
  return (
    <form id={id} onSubmit={onSubmit} className="space-y-6">
      <Group>
        <Row>
          <Field label={t("tracker.f.company")} required>
            <input value={f.company} onChange={(e) => set("company", e.target.value)} autoFocus={autoFocus} required autoComplete="organization" />
          </Field>
          <Field label={t("tracker.f.role")}>
            <input value={f.role} onChange={(e) => set("role", e.target.value)} autoComplete="organization-title" />
          </Field>
        </Row>
        <div>
          {/* Two options → show both; a select hides the alternative behind a tap. */}
          <p className="label">{t("tracker.f.market")}</p>
          <Segmented<Market> fill label={t("tracker.f.market")} value={f.market} onChange={(m) => set("market", m)}
            items={[{ key: "hidden", label: t("tracker.f.hidden") }, { key: "visible", label: t("tracker.f.visible") }]} />
        </div>
        <Row>
          <Field label={t("tracker.f.source")}>
            <input value={f.source} onChange={(e) => set("source", e.target.value)} placeholder={t("tracker.f.sourcePlaceholder")} />
          </Field>
          <Field label={t("tracker.f.link")}>
            <input type="url" inputMode="url" autoComplete="url" placeholder="https://" value={f.url} onChange={(e) => set("url", e.target.value)} />
          </Field>
        </Row>
        <Field label={t("tracker.f.notes")}>
          <textarea rows={3} value={f.notes} onChange={(e) => set("notes", e.target.value)} className="field min-h-20 resize-y" />
        </Field>
      </Group>
    </form>
  );
}
