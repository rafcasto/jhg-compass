"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ComponentType } from "react";
import {
  Plus, ExternalLink, Trash2, Users, MessageSquare, Linkedin, Mail, GripVertical,
  Pencil, Columns3, Bell, Phone, Upload, MoreHorizontal, Unlink, type LucideProps,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import {
  useLiveCollection, paths, createDoc, updateRecord, deleteRecord,
} from "@/lib/firestore/db";
import { useContent } from "@/lib/firestore/content";
import type { Contact, Opportunity, OpportunityStage, Reminder, Stage } from "@/lib/types";
import { CONTACT_TYPE_TKEY, normalizeContactType } from "@/lib/contacts";
import { track } from "@/lib/track-client";
import { TAGS } from "@/lib/tags";
import { resolveStage, stageDotClass } from "@/lib/stages";
import { Sheet, SheetFooter, ConfirmBand, useSheetSlot } from "@/components/tracker/Sheet";
import { Field, Row, useForm, ContactForm, OpportunityForm, contactFields, opportunityFields, cleanContact, cleanOpportunity } from "@/components/tracker/forms";
import ImportSheet, { type ImportKind } from "@/components/tracker/ImportSheet";
import ReminderRow, { type ReminderRowLabels } from "@/components/tracker/ReminderRow";
import PageHeader from "@/components/shell/PageHeader";
import Segmented, { type SegmentedItem } from "@/components/shell/Segmented";

// Stage columns come from admin-editable content (config/content.stages) — see the
// admin "Stages" tab. Cards carrying a stage that no longer exists are shown in
// the first column (resolveStage).

type View = "board" | "reminders" | "contacts";

const HEAD: Record<View, { eyebrow: string; title: string; intro: string }> = {
  board:     { eyebrow: "tracker.eyebrow",   title: "tracker.title",   intro: "tracker.intro" },
  reminders: { eyebrow: "reminders.eyebrow", title: "reminders.title", intro: "reminders.intro" },
  contacts:  { eyebrow: "contacts.eyebrow",  title: "contacts.title",  intro: "contacts.intro" },
};

export default function TrackerPage() {
  const { user } = useAuth();
  const uid = user?.uid;
  const { t, stages } = useContent();
  const { data: opps } = useLiveCollection<Opportunity>(uid, paths.opportunities);
  const { data: contacts } = useLiveCollection<Contact>(uid, paths.contacts);
  const { data: reminders } = useLiveCollection<Reminder>(uid, paths.reminders);
  const [view, setView] = useState<View>("board");
  const [adding, setAdding] = useState(false);
  const [addingReminder, setAddingReminder] = useState(false);
  const [addingContact, setAddingContact] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<OpportunityStage | null>(null);
  const [importing, setImporting] = useState<ImportKind | null>(null);

  const byStage = useMemo(() => {
    const m: Record<OpportunityStage, Opportunity[]> = Object.fromEntries(stages.map((s) => [s.id, []]));
    for (const o of opps) m[resolveStage(o.stage, stages)].push(o);
    return m;
  }, [opps, stages]);

  const openOpp = opps.find((o) => o.id === openId) ?? null;
  const openReminders = reminders.filter((r) => !r.done).length;

  async function move(id: string, stage: OpportunityStage) {
    const o = opps.find((x) => x.id === id);
    if (!uid || !o || resolveStage(o.stage, stages) === stage) return;
    await updateRecord(uid, "opportunities", id, { stage });
    track(TAGS.STAGE_CHANGE, { props: { id, stage } });
  }

  const viewItems: SegmentedItem<View>[] = [
    { key: "board", label: t("tracker.view.board"), icon: Columns3 },
    { key: "reminders", label: t("tracker.view.reminders"), icon: Bell, badge: openReminders > 0 ? { n: openReminders, tone: "alert" } : undefined },
    { key: "contacts", label: t("tracker.view.contacts"), icon: Users, badge: contacts.length > 0 ? { n: contacts.length } : undefined },
  ];

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={t(HEAD[view].eyebrow)} title={t(HEAD[view].title)} intro={t(HEAD[view].intro)}
        actions={<>
          {/* CSV import: jobs on the Board view, contacts on the Contacts view */}
          {(view === "board" || view === "contacts") && (
            <button type="button" onClick={() => setImporting(view === "board" ? "opportunities" : "contacts")} className="btn-secondary" aria-label={t("tracker.import")}>
              <Upload className="h-4 w-4" aria-hidden /> <span className="hidden sm:inline">{t("tracker.import")}</span>
            </button>
          )}
          {view === "board" && <button type="button" onClick={() => setAdding(true)} className="btn-primary"><Plus className="h-4 w-4" aria-hidden /> {t("tracker.addJob")}</button>}
          {view === "reminders" && <button type="button" onClick={() => setAddingReminder(true)} className="btn-primary"><Plus className="h-4 w-4" aria-hidden /> {t("reminders.add")}</button>}
          {view === "contacts" && <button type="button" onClick={() => setAddingContact(true)} className="btn-primary"><Plus className="h-4 w-4" aria-hidden /> {t("contacts.add")}</button>}
        </>} />

      {/* View switch: Board (kanban) · Reminders (list) · Contacts (list) */}
      <Segmented label="View" value={view} onChange={setView} items={viewItems} />

      {view === "board" && (
        /* Board: one column per stage; scrolls horizontally on every breakpoint
           because the stage list is admin-defined and can be long */
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 snap-x">
          {stages.map((s) => {
            const cards = byStage[s.id] ?? [];
            return (
              <div key={s.id}
                onDragOver={(e) => { e.preventDefault(); setDragOver(s.id); }}
                onDragLeave={() => setDragOver((d) => (d === s.id ? null : d))}
                onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData("text/plain"); setDragOver(null); if (id) move(id, s.id); }}
                className={`w-[80vw] max-w-[18rem] shrink-0 snap-start rounded-lg border transition-colors duration-200 ease-out md:w-60
                  ${dragOver === s.id ? "border-jh-ink bg-jh-blue-grey/60" : "border-jh-line bg-jh-mist/50"}`}>
                <div className="flex items-center justify-between px-3 py-2.5 border-b border-jh-line">
                  <span className="flex items-center gap-2 font-display font-semibold text-sm text-jh-ink">
                    <span className={`h-2 w-2 rounded-full shrink-0 ${stageDotClass(s.color)}`} /> {s.label}
                  </span>
                  <span className="text-xs text-jh-mute font-semibold">{cards.length}</span>
                </div>
                <div className="p-2 space-y-2 min-h-16">
                  {cards.map((o) => (
                    <Card key={o.id} o={o} stages={stages} contacts={contacts} reminders={reminders}
                      onOpen={() => setOpenId(o.id)} onMove={(st) => move(o.id, st)} />
                  ))}
                  {cards.length === 0 && <p className="py-4 text-center text-xs text-jh-mute">{t("tracker.dropHere")}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view === "reminders" && <RemindersView uid={uid!} reminders={reminders} opps={opps} onAdd={() => setAddingReminder(true)} />}
      {view === "contacts" && <ContactsView uid={uid!} contacts={contacts} onAdd={() => setAddingContact(true)} />}

      {adding && <AddOpportunity uid={uid!} onClose={() => setAdding(false)} />}
      {addingReminder && <AddReminder uid={uid!} opps={opps} onClose={() => setAddingReminder(false)} />}
      {addingContact && <AddContactStandalone uid={uid!} onClose={() => setAddingContact(false)} />}
      {importing && <ImportSheet kind={importing} uid={uid!} contacts={contacts} opps={opps} onClose={() => setImporting(null)} />}
      {openOpp && <DetailModal uid={uid!} opp={openOpp} contacts={contacts} reminders={reminders} stages={stages} onMove={(st) => move(openOpp.id, st)} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function Card({ o, stages, contacts, reminders, onOpen, onMove }: {
  o: Opportunity; stages: Stage[]; contacts: Contact[]; reminders: Reminder[]; onOpen: () => void; onMove: (s: OpportunityStage) => void;
}) {
  const { t } = useContent();
  const attached = (o.contactIds ?? []).length;
  const openReminders = reminders.filter((r) => r.opportunityId === o.id && !r.done).length;
  return (
    <div draggable
      onDragStart={(e) => e.dataTransfer.setData("text/plain", o.id)}
      className="group cursor-pointer rounded-sm border border-jh-line bg-white p-3 shadow-jh-1 transition-shadow duration-200 ease-out hover:shadow-jh-2">
      <div className="flex items-start gap-2" onClick={onOpen}>
        <GripVertical className="mt-0.5 hidden h-4 w-4 shrink-0 text-jh-mute-2 md:block" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-display font-semibold text-jh-ink text-sm leading-snug truncate">{o.role || t("tracker.roleFallback")}</p>
          <p className="text-xs text-jh-mute truncate">{o.company}</p>
        </div>
        <span className={o.market === "hidden" ? "pill-hidden shrink-0" : "pill-visible shrink-0"}>{t(o.market === "hidden" ? "tracker.f.hidden" : "tracker.f.visible")}</span>
      </div>
      <div className="mt-2 flex items-center gap-3 text-xs text-jh-mute" onClick={onOpen}>
        {attached > 0 && <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {attached}</span>}
        {openReminders > 0 && <span className="inline-flex items-center gap-1"><Bell className="h-3.5 w-3.5" /> {openReminders}</span>}
      </div>
      {/* Mobile-friendly move control */}
      <select value={resolveStage(o.stage, stages)} onChange={(e) => onMove(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        aria-label={t("tracker.moveTo")} className="field mt-2 px-3 py-1.5 text-xs md:hidden">
        {stages.map((s) => <option key={s.id} value={s.id}>{t("tracker.moveTo")} {s.label}</option>)}
      </select>
    </div>
  );
}

/* ---------------- Reminders helpers ---------------- */
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* A date input that shows placeholder text when empty. Native date inputs render
   blank on mobile; this overlays a click-through placeholder and hides the native
   empty format text (via .date-empty) so taps still open the native picker. */
function DateField({ value, onChange, className = "", id, ariaLabel }: { value: string; onChange: (v: string) => void; className?: string; id?: string; ariaLabel?: string }) {
  const { t } = useContent();
  return (
    <div className={`relative ${className}`}>
      <input type="date" id={id} aria-label={ariaLabel} value={value} onChange={(e) => onChange(e.target.value)}
        className={`field w-full ${value ? "" : "date-empty"}`} />
      {!value && (
        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center px-4 text-[15px] text-jh-mute">
          {t("tracker.datePlaceholder")}
        </span>
      )}
    </div>
  );
}

function RemindersView({ uid, reminders, opps, onAdd }: { uid: string; reminders: Reminder[]; opps: Opportunity[]; onAdd: () => void }) {
  const { t } = useContent();
  const today = todayStr();

  const { open, done } = useMemo(() => {
    const o = reminders.filter((r) => !r.done);
    const d = reminders.filter((r) => r.done);
    // Open: earliest due first, undated last; Done: most recent first.
    o.sort((a, b) => (a.dueOn ?? "9999").localeCompare(b.dueOn ?? "9999"));
    d.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    return { open: o, done: d };
  }, [reminders]);

  const oppLabel = (id?: string) => {
    const o = id ? opps.find((x) => x.id === id) : undefined;
    return o ? [o.role || t("tracker.roleFallback"), o.company].filter(Boolean).join(" · ") : null;
  };
  const labels: ReminderRowLabels = { overdue: t("reminders.overdue"), noDue: t("reminders.noDue"), delete: t("tracker.delete") };

  async function toggle(r: Reminder) {
    await updateRecord(uid, "reminders", r.id, { done: !r.done });
    if (!r.done) track(TAGS.REMINDER_DONE, { props: { id: r.id } });
  }
  async function remove(r: Reminder) {
    await deleteRecord(uid, "reminders", r.id);
  }

  if (reminders.length === 0) {
    return (
      <EmptyState icon={Bell} text={t("reminders.empty")}
        action={<button type="button" onClick={onAdd} className="btn-primary"><Plus className="h-4 w-4" aria-hidden /> {t("reminders.add")}</button>} />
    );
  }

  return (
    <div className="space-y-6">
      <ul className="space-y-2">
        {open.map((r) => (
          <ReminderRow key={r.id} reminder={r} today={today} meta={oppLabel(r.opportunityId)}
            onToggle={() => toggle(r)} onRemove={() => remove(r)} labels={labels} />
        ))}
      </ul>

      {done.length > 0 && (
        <div>
          <p className="section-label mb-2">{t("reminders.done")} · {done.length}</p>
          <ul className="space-y-2">
            {done.map((r) => (
              <ReminderRow key={r.id} reminder={r} today={today} onToggle={() => toggle(r)} onRemove={() => remove(r)} labels={labels} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// Empty state = the one place centring is right: icon, one sentence, the primary action.
function EmptyState({ icon: Icon, text, action }: { icon: ComponentType<LucideProps>; text: string; action: React.ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-jh-line-2 bg-jh-mist/40 px-6 py-10 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-white text-jh-mute shadow-jh-1">
        <Icon className="h-6 w-6" strokeWidth={1.5} aria-hidden />
      </span>
      <p className="mx-auto mt-3 max-w-sm whitespace-pre-wrap text-sm text-jh-mute">{text}</p>
      <div className="mt-5 flex justify-center">{action}</div>
    </div>
  );
}

// Overflow menu for secondary / destructive row actions, so a row shows at most
// its links plus one "⋯" instead of six equal-weight icons.
interface ActionItem { label: string; icon: ComponentType<LucideProps>; onSelect: () => void; danger?: boolean; badge?: number }
function ActionMenu({ label, items }: { label: string; items: ActionItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);
  return (
    <div ref={ref} className="relative shrink-0">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label={label} className="icon-btn">
        <MoreHorizontal className="h-5 w-5" strokeWidth={1.5} aria-hidden />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-20 mt-1 min-w-[12rem] overflow-hidden rounded-sm border border-jh-line bg-white py-1 shadow-jh-3">
          {items.map((it) => {
            const Icon = it.icon;
            return (
              <button key={it.label} type="button" role="menuitem" onClick={() => { setOpen(false); it.onSelect(); }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left font-display text-sm font-semibold transition-colors duration-200 ease-out hover:bg-jh-mist ${it.danger ? "text-jh-red" : "text-jh-ink"}`}>
                <Icon className="h-4 w-4" strokeWidth={1.5} aria-hidden /> {it.label}
                {it.badge ? <span className="ml-auto rounded-pill bg-jh-line px-1.5 text-[11px] leading-[18px] text-jh-mute">{it.badge}</span> : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AddReminder({ uid, opps, onClose }: { uid: string; opps: Opportunity[]; onClose: () => void }) {
  const { t } = useContent();
  const { f, set, dirty } = useForm({ title: "", dueOn: "", opportunityId: "" });
  const [busy, setBusy] = useState(false);
  const formId = "add-reminder";
  const dueId = `${formId}-due`;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!f.title.trim()) return;
    setBusy(true);
    await createDoc(paths.reminders(uid), {
      title: f.title.trim(),
      done: false,
      ...(f.dueOn ? { dueOn: f.dueOn } : {}),
      ...(f.opportunityId ? { opportunityId: f.opportunityId } : {}),
    });
    track(TAGS.ADD_REMINDER, { props: { linked: !!f.opportunityId } });
    setBusy(false); onClose();
  }

  return (
    <Sheet title={t("reminders.addTitle")} onClose={onClose} dirty={dirty}
      footer={<SheetFooter primary={{ label: t("reminders.add"), form: formId, busy, busyLabel: t("tracker.adding") }}
        secondary={{ label: t("tracker.cancel"), onClick: onClose }} />}>
      <form id={formId} onSubmit={save} className="space-y-4">
        <Row>
          <Field label={t("reminders.f.title")} required>
            <input value={f.title} onChange={(e) => set("title", e.target.value)} autoFocus required />
          </Field>
          <div>
            <label htmlFor={dueId} className="label">{t("reminders.f.due")}</label>
            <DateField id={dueId} value={f.dueOn} onChange={(v) => set("dueOn", v)} />
          </div>
        </Row>
        <Field label={t("reminders.f.link")}>
          <select value={f.opportunityId} onChange={(e) => set("opportunityId", e.target.value)}>
            <option value="">{t("reminders.f.none")}</option>
            {opps.map((o) => <option key={o.id} value={o.id}>{[o.role || t("tracker.roleFallback"), o.company].filter(Boolean).join(" · ")}</option>)}
          </select>
        </Field>
      </form>
    </Sheet>
  );
}

/* ---------------- Contacts view ---------------- */
function ContactsView({ uid, contacts, onAdd }: { uid: string; contacts: Contact[]; onAdd: () => void }) {
  const { t } = useContent();
  if (contacts.length === 0) {
    return (
      <EmptyState icon={Users} text={t("contacts.empty")}
        action={<button type="button" onClick={onAdd} className="btn-primary"><Plus className="h-4 w-4" aria-hidden /> {t("contacts.add")}</button>} />
    );
  }
  return (
    <div className="space-y-2">
      {contacts.map((c) => <ContactCard key={c.id} uid={uid} c={c} />)}
    </div>
  );
}

// Links (LinkedIn · email · phone) stay inline; notes / edit / delete sit behind "⋯".
// Delete asks first — inline, inside the card, never a second dialog.
function ContactCard({ uid, c }: { uid: string; c: Contact }) {
  const { t } = useContent();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [note, setNote] = useState("");
  const log = [...(c.log ?? [])].sort((a, b) => b.at - a.at);

  async function addNote() {
    const text = note.trim();
    if (!text) return;
    await updateRecord(uid, "contacts", c.id, { log: [...(c.log ?? []), { at: Date.now(), text }] });
    setNote("");
  }
  async function remove() {
    await deleteRecord(uid, "contacts", c.id);
  }

  return (
    <div className="rounded-sm border border-jh-line bg-white p-3 shadow-jh-1">
      <div className="flex items-center gap-1">
        <div className="min-w-0 flex-1 pr-2">
          <p className="truncate font-display text-sm font-semibold text-jh-ink">{c.fullName}</p>
          <p className="truncate text-xs text-jh-mute">{[c.role, c.company].filter(Boolean).join(" · ")}</p>
        </div>
        <span className="pill-neutral mr-1 hidden shrink-0 sm:inline-flex">{t(CONTACT_TYPE_TKEY[normalizeContactType(c.type)])}</span>
        <ContactLinks c={c} />
        <ActionMenu label={t("tracker.moreActions")} items={[
          { label: t("tracker.notes"), icon: MessageSquare, onSelect: () => setOpen((o) => !o), badge: log.length || undefined },
          { label: t("tracker.edit"), icon: Pencil, onSelect: () => setEditing(true) },
          { label: t("tracker.delete"), icon: Trash2, onSelect: () => setConfirming(true), danger: true },
        ]} />
      </div>
      {confirming && (
        <div className="mt-3">
          <ConfirmBand text={t("tracker.deleteContactConfirm")} confirmLabel={t("tracker.delete")} cancelLabel={t("tracker.keep")}
            onConfirm={remove} onCancel={() => setConfirming(false)} />
        </div>
      )}
      {open && <NotesPanel note={note} setNote={setNote} addNote={addNote} log={log} />}
      {editing && (
        <Sheet title={t("tracker.editContactTitle")} onClose={() => setEditing(false)}>
          <ContactEditor uid={uid} contact={c} submitLabel={t("tracker.save")} onCancel={() => setEditing(false)} onDone={() => setEditing(false)} />
        </Sheet>
      )}
    </div>
  );
}

function ContactLinks({ c }: { c: Contact }) {
  const { t } = useContent();
  return (
    <>
      {c.linkedinUrl && <a href={c.linkedinUrl} target="_blank" rel="noreferrer" className="icon-btn" aria-label="LinkedIn"><Linkedin className="h-4 w-4" strokeWidth={1.5} aria-hidden /></a>}
      {c.email && <a href={`mailto:${c.email}`} className="icon-btn" aria-label={t("tracker.f.email")}><Mail className="h-4 w-4" strokeWidth={1.5} aria-hidden /></a>}
      {c.phone && <a href={`tel:${c.phone.replace(/[^\d+]/g, "")}`} className="icon-btn" aria-label={t("tracker.f.phone")}><Phone className="h-4 w-4" strokeWidth={1.5} aria-hidden /></a>}
    </>
  );
}

function NotesPanel({ note, setNote, addNote, log }: { note: string; setNote: (v: string) => void; addNote: () => void; log: { at: number; text: string }[] }) {
  const { t } = useContent();
  return (
    <div className="mt-3 border-t border-jh-line pt-3">
      <div className="flex gap-2">
        <input className="field py-2 text-sm" placeholder={t("tracker.notePlaceholder")} value={note} aria-label={t("tracker.notes")}
          onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addNote(); } }} />
        <button type="button" onClick={addNote} className="btn-secondary btn-sm shrink-0">{t("tracker.addNote")}</button>
      </div>
      <ul className="mt-2 space-y-1.5">
        {log.map((n, i) => (
          <li key={i} className="text-xs text-jh-ink"><span className="text-jh-mute">{fmt(n.at)} · </span>{n.text}</li>
        ))}
        {log.length === 0 && <li className="text-xs text-jh-mute">{t("tracker.noNotes")}</li>}
      </ul>
    </div>
  );
}

/* ---------------- Editors ----------------
   ONE contact editor and ONE job editor. Each renders its form into the sheet body
   and hands its footer + dirty flag to the enclosing Sheet through the slot, so the
   same component works as a stand-alone sheet body or as a view inside the job
   detail sheet (no nested dialogs). */
function ContactEditor({ uid, contact, submitLabel, onCancel, onDone }: {
  uid: string; contact?: Contact; submitLabel: string; onCancel: () => void; onDone: (id: string) => void;
}) {
  const { t } = useContent();
  const { f, set, dirty } = useForm(contactFields(contact));
  const [busy, setBusy] = useState(false);
  const formId = useId();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const c = cleanContact(f);
    if (!c.fullName) return;
    setBusy(true);
    try {
      if (contact) {
        await updateRecord(uid, "contacts", contact.id, { ...c });
        track(TAGS.UPDATE_CONTACT, { props: { type: c.type } });
        setBusy(false); onDone(contact.id);
      } else {
        const ref = await createDoc(paths.contacts(uid), { ...c });
        track(TAGS.ADD_CONTACT, { props: { type: c.type } });
        setBusy(false); onDone((ref as any).id);
      }
    } catch (err) { setBusy(false); throw err; }
  }

  const busyLabel = contact ? t("tracker.saving") : t("tracker.adding");
  const footer = useMemo(() => (
    <SheetFooter primary={{ label: submitLabel, form: formId, busy, busyLabel }} secondary={{ label: t("tracker.cancel"), onClick: onCancel }} />
  ), [submitLabel, formId, busy, busyLabel, t, onCancel]);
  useSheetSlot(footer, dirty);

  return <ContactForm id={formId} f={f} set={set} onSubmit={save} />;
}

function OpportunityEditor({ uid, opp, submitLabel, onCancel, onDone }: {
  uid: string; opp?: Opportunity; submitLabel: string; onCancel: () => void; onDone: () => void;
}) {
  const { t, stages } = useContent();
  const { f, set, dirty } = useForm(opportunityFields(opp));
  const [busy, setBusy] = useState(false);
  const formId = useId();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const o = cleanOpportunity(f);
    if (!o.company) return;
    setBusy(true);
    try {
      if (opp) {
        await updateRecord(uid, "opportunities", opp.id, { ...o });
        track(TAGS.UPDATE_OPPORTUNITY, { props: { market: o.market } });
      } else {
        // New jobs start in the first column of the admin-defined pipeline.
        await createDoc(paths.opportunities(uid), { ...o, stage: stages[0].id, contactIds: [], log: [] });
        track(TAGS.ADD_OPPORTUNITY, { props: { market: o.market } });
      }
      setBusy(false); onDone();
    } catch (err) { setBusy(false); throw err; }
  }

  const busyLabel = opp ? t("tracker.saving") : t("tracker.adding");
  const footer = useMemo(() => (
    <SheetFooter primary={{ label: submitLabel, form: formId, busy, busyLabel }} secondary={{ label: t("tracker.cancel"), onClick: onCancel }} />
  ), [submitLabel, formId, busy, busyLabel, t, onCancel]);
  useSheetSlot(footer, dirty);

  return <OpportunityForm id={formId} f={f} set={set} onSubmit={save} />;
}

function AddContactStandalone({ uid, onClose }: { uid: string; onClose: () => void }) {
  const { t } = useContent();
  return (
    <Sheet title={t("contacts.addTitle")} onClose={onClose}>
      <ContactEditor uid={uid} submitLabel={t("contacts.addSubmit")} onCancel={onClose} onDone={onClose} />
    </Sheet>
  );
}

function AddOpportunity({ uid, onClose }: { uid: string; onClose: () => void }) {
  const { t } = useContent();
  return (
    <Sheet title={t("tracker.addTitle")} onClose={onClose}>
      <OpportunityEditor uid={uid} submitLabel={t("tracker.addSubmit")} onCancel={onClose} onDone={onClose} />
    </Sheet>
  );
}

/* ---------------- Job detail ----------------
   One sheet, four views: detail · edit job · new contact · edit contact. Sub-views
   render in place with a ← Back in the header; the header shows the company as the
   eyebrow and the role as the title; the stage is a pill-select so it can be changed
   here (the only way on mobile besides the card's select). Delete asks first. */
type DetailView = { kind: "detail" } | { kind: "edit" } | { kind: "newContact" } | { kind: "editContact"; id: string };

function StagePill({ value, stages, onChange, label }: { value: OpportunityStage; stages: Stage[]; onChange: (s: OpportunityStage) => void; label: string }) {
  const current = stages.find((s) => s.id === value) ?? stages[0];
  return (
    <span className="relative inline-flex items-center gap-1.5 rounded-pill border border-jh-line bg-white py-1 pl-3 pr-7 text-xs font-semibold text-jh-ink transition-colors hover:border-jh-line-2 focus-within:border-jh-red focus-within:ring-2 focus-within:ring-jh-red/15">
      <span className={`h-2 w-2 shrink-0 rounded-full ${stageDotClass(current?.color)}`} aria-hidden />
      <span className="truncate">{current?.label}</span>
      <svg className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-jh-mute" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m6 9 6 6 6-6" /></svg>
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className="absolute inset-0 w-full cursor-pointer opacity-0">
        {stages.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
      </select>
    </span>
  );
}

function DetailModal({ uid, opp, contacts, reminders, stages, onMove, onClose }: {
  uid: string; opp: Opportunity; contacts: Contact[]; reminders: Reminder[]; stages: Stage[]; onMove: (s: OpportunityStage) => void; onClose: () => void;
}) {
  const { t } = useContent();
  const [view, setView] = useState<DetailView>({ kind: "detail" });
  const [pickId, setPickId] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [composing, setComposing] = useState(false);
  const [rTitle, setRTitle] = useState("");
  const [rDue, setRDue] = useState("");
  const today = todayStr();
  const labels: ReminderRowLabels = { overdue: t("reminders.overdue"), noDue: t("reminders.noDue"), delete: t("tracker.delete") };
  const back = useCallback(() => setView({ kind: "detail" }), []);

  const attachedIds = opp.contactIds ?? [];
  const attached = contacts.filter((c) => attachedIds.includes(c.id));
  const available = contacts.filter((c) => !attachedIds.includes(c.id));
  const roleLabel = opp.role || t("tracker.roleFallback");

  // Reminders linked to this job — open first (by due date), completed last.
  const jobReminders = useMemo(() => {
    const list = reminders.filter((r) => r.opportunityId === opp.id);
    list.sort((a, b) => {
      if (!!a.done !== !!b.done) return a.done ? 1 : -1;
      return (a.dueOn ?? "9999").localeCompare(b.dueOn ?? "9999");
    });
    return list;
  }, [reminders, opp.id]);

  async function attach(cid: string) {
    if (!cid) return;
    await updateRecord(uid, "opportunities", opp.id, { contactIds: [...attachedIds, cid] });
    setPickId("");
  }
  async function detach(cid: string) {
    await updateRecord(uid, "opportunities", opp.id, { contactIds: attachedIds.filter((id) => id !== cid) });
  }
  async function removeOpp() {
    await deleteRecord(uid, "opportunities", opp.id);
    onClose();
  }
  async function addReminder() {
    const title = rTitle.trim();
    if (!title) return;
    await createDoc(paths.reminders(uid), { title, done: false, opportunityId: opp.id, ...(rDue ? { dueOn: rDue } : {}) });
    track(TAGS.ADD_REMINDER, { props: { linked: true, from: "job" } });
    setRTitle(""); setRDue("");
  }
  async function toggleReminder(r: Reminder) {
    await updateRecord(uid, "reminders", r.id, { done: !r.done });
    if (!r.done) track(TAGS.REMINDER_DONE, { props: { id: r.id } });
  }
  async function removeReminder(r: Reminder) {
    await deleteRecord(uid, "reminders", r.id);
  }

  // ---- sub-views: same sheet, ← Back in the header ----
  if (view.kind === "edit") {
    return (
      <Sheet size="lg" eyebrow={opp.company} title={t("tracker.editJobTitle")} onClose={onClose} onBack={back} viewKey="edit">
        <OpportunityEditor uid={uid} opp={opp} submitLabel={t("tracker.save")} onCancel={back} onDone={back} />
      </Sheet>
    );
  }
  if (view.kind === "newContact") {
    return (
      <Sheet size="lg" eyebrow={`${roleLabel} · ${opp.company}`} title={t("tracker.newContactTitle")} onClose={onClose} onBack={back} viewKey="newContact">
        <ContactEditor uid={uid} submitLabel={t("tracker.createAttach")} onCancel={back} onDone={(cid) => { attach(cid); back(); }} />
      </Sheet>
    );
  }
  if (view.kind === "editContact") {
    const c = contacts.find((x) => x.id === view.id);
    if (c) {
      return (
        <Sheet size="lg" eyebrow={`${roleLabel} · ${opp.company}`} title={t("tracker.editContactTitle")} onClose={onClose} onBack={back} viewKey={`editContact-${c.id}`}>
          <ContactEditor key={c.id} uid={uid} contact={c} submitLabel={t("tracker.save")} onCancel={back} onDone={back} />
        </Sheet>
      );
    }
  }

  // ---- detail ----
  return (
    <Sheet size="lg" eyebrow={opp.company} title={roleLabel} onClose={onClose} viewKey="detail"
      headerActions={
        <ActionMenu label={t("tracker.moreActions")} items={[
          { label: t("tracker.editJob"), icon: Pencil, onSelect: () => setView({ kind: "edit" }) },
          { label: t("tracker.deleteJob"), icon: Trash2, onSelect: () => setConfirming(true), danger: true },
        ]} />
      }>
      <div className="space-y-6">
        {confirming && (
          <ConfirmBand text={t("tracker.deleteJobConfirm")} confirmLabel={t("tracker.delete")} cancelLabel={t("tracker.keep")}
            onConfirm={removeOpp} onCancel={() => setConfirming(false)} />
        )}

        {/* Status row: stage (editable) · market · link */}
        <div className="flex flex-wrap items-center gap-2">
          <StagePill value={resolveStage(opp.stage, stages)} stages={stages} onChange={onMove} label={t("tracker.stage")} />
          <span className={opp.market === "hidden" ? "pill-hidden" : "pill-visible"}>{t(opp.market === "hidden" ? "tracker.f.hidden" : "tracker.f.visible")}</span>
          {opp.url && <a href={opp.url} target="_blank" rel="noreferrer" className="link ml-auto inline-flex items-center gap-1 text-sm">{t("tracker.jobLink")} <ExternalLink className="h-3.5 w-3.5" aria-hidden /></a>}
        </div>

        {(opp.source || opp.notes) && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            {opp.source && <><dt className="text-jh-mute">{t("tracker.f.source")}</dt><dd className="text-jh-ink">{opp.source}</dd></>}
            {opp.notes && <><dt className="text-jh-mute">{t("tracker.f.notes")}</dt><dd className="whitespace-pre-wrap text-jh-body">{opp.notes}</dd></>}
          </dl>
        )}

        {/* Attached contacts */}
        <section>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="section-label">{t("tracker.contacts")}{attached.length > 0 && <span className="ml-1.5 text-jh-mute-2">{attached.length}</span>}</p>
            <button type="button" onClick={() => setView({ kind: "newContact" })} className="btn-ghost btn-sm -mr-2"><Plus className="h-4 w-4" aria-hidden /> {t("tracker.newContact")}</button>
          </div>
          <div className="space-y-2">
            {attached.map((c) => (
              <ContactRow key={c.id} uid={uid} c={c} onEdit={() => setView({ kind: "editContact", id: c.id })} onDetach={() => detach(c.id)} />
            ))}
            {attached.length === 0 && <p className="text-sm text-jh-mute">{t("tracker.contactsEmpty")}</p>}
          </div>
          {available.length > 0 && (
            <select value={pickId} onChange={(e) => attach(e.target.value)} aria-label={t("tracker.attachContact")} className="field mt-3 sm:max-w-xs">
              <option value="">{t("tracker.attachContact")}</option>
              {available.map((c) => <option key={c.id} value={c.id}>{c.fullName}{c.company ? ` · ${c.company}` : ""}</option>)}
            </select>
          )}
        </section>

        {/* Reminders — follow-ups linked to this job. Composer is collapsed so the list leads. */}
        <section>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="section-label">{t("reminders.title")}</p>
            {!composing && <button type="button" onClick={() => setComposing(true)} className="btn-ghost btn-sm -mr-2"><Plus className="h-4 w-4" aria-hidden /> {t("reminders.add")}</button>}
          </div>
          {composing && (
            <div className="mb-3 flex flex-col gap-2 rounded-sm border border-jh-line bg-jh-mist/50 p-3 sm:flex-row">
              <input className="field" placeholder={t("tracker.reminderPlaceholder")} aria-label={t("reminders.f.title")} value={rTitle} autoFocus
                onChange={(e) => setRTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addReminder(); } if (e.key === "Escape" && !rTitle) { e.stopPropagation(); setComposing(false); } }} />
              <DateField value={rDue} onChange={setRDue} className="sm:w-44" ariaLabel={t("reminders.f.due")} />
              <button type="button" onClick={addReminder} disabled={!rTitle.trim()} className="btn-secondary shrink-0">{t("tracker.addReminderShort")}</button>
            </div>
          )}
          <ul className="space-y-2">
            {jobReminders.map((r) => (
              <ReminderRow key={r.id} reminder={r} today={today} onToggle={() => toggleReminder(r)} onRemove={() => removeReminder(r)} labels={labels} />
            ))}
            {jobReminders.length === 0 && <li className="text-sm text-jh-mute">{t("tracker.noReminders")}</li>}
          </ul>
        </section>
      </div>
    </Sheet>
  );
}

function ContactRow({ uid, c, onEdit, onDetach }: { uid: string; c: Contact; onEdit: () => void; onDetach: () => void }) {
  const { t } = useContent();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const log = [...(c.log ?? [])].sort((a, b) => b.at - a.at);

  async function addNote() {
    const text = note.trim();
    if (!text) return;
    await updateRecord(uid, "contacts", c.id, { log: [...(c.log ?? []), { at: Date.now(), text }] });
    setNote("");
  }

  return (
    <div className="rounded-sm border border-jh-line p-3">
      <div className="flex items-center gap-1">
        <div className="min-w-0 flex-1 pr-2">
          <p className="truncate font-display text-sm font-semibold text-jh-ink">{c.fullName}</p>
          <p className="truncate text-xs text-jh-mute">{[c.role, c.company].filter(Boolean).join(" · ")}</p>
        </div>
        <ContactLinks c={c} />
        <ActionMenu label={t("tracker.moreActions")} items={[
          { label: t("tracker.notes"), icon: MessageSquare, onSelect: () => setOpen((o) => !o), badge: log.length || undefined },
          { label: t("tracker.edit"), icon: Pencil, onSelect: onEdit },
          { label: t("tracker.removeFromJob"), icon: Unlink, onSelect: onDetach, danger: true },
        ]} />
      </div>
      {open && <NotesPanel note={note} setNote={setNote} addNote={addNote} log={log} />}
    </div>
  );
}

function fmt(at: number) {
  return new Date(at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
