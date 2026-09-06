"use client";

import { useMemo, useState } from "react";
import {
  Plus, X, ExternalLink, Trash2, Users, MessageSquare, Linkedin, Mail, GripVertical,
  Pencil, Columns3, Bell, Calendar, AlertCircle, Phone,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import {
  useLiveCollection, paths, createDoc, updateRecord, deleteRecord,
} from "@/lib/firestore/db";
import { useContent } from "@/lib/firestore/content";
import type { Contact, Opportunity, OpportunityStage, Reminder } from "@/lib/types";
import type { Market } from "@/lib/categories";
import { CONTACT_TYPES, CONTACT_TYPE_TKEY, DEFAULT_CONTACT_TYPE, normalizeContactType, type ContactType } from "@/lib/contacts";
import { track } from "@/lib/track-client";
import { TAGS } from "@/lib/tags";

// Stage columns — labels are admin-editable via content (tracker.stage.*).
const STAGES: { key: OpportunityStage; tkey: string; dot: string }[] = [
  { key: "wishlist",  tkey: "tracker.stage.wishlist",  dot: "bg-jh-mute" },
  { key: "applied",   tkey: "tracker.stage.applied",   dot: "bg-rb-blue" },
  { key: "interview", tkey: "tracker.stage.interview", dot: "bg-rb-orange" },
  { key: "offer",     tkey: "tracker.stage.offer",     dot: "bg-rb-green-dark" },
  { key: "rejected",  tkey: "tracker.stage.rejected",  dot: "bg-jh-red" },
];

// Map any legacy stage to the new kanban columns.
function normalizeStage(s: string | undefined): OpportunityStage {
  switch (s) {
    case "wishlist": case "applied": case "interview": case "offer": case "rejected": return s;
    case "researching": return "wishlist";
    case "contacted": return "applied";
    case "interviewing": return "interview";
    case "accepted": return "offer";
    case "closed": return "rejected";
    default: return "wishlist";
  }
}

type View = "board" | "reminders" | "contacts";

const HEAD: Record<View, { eyebrow: string; title: string; intro: string }> = {
  board:     { eyebrow: "tracker.eyebrow",   title: "tracker.title",   intro: "tracker.intro" },
  reminders: { eyebrow: "reminders.eyebrow", title: "reminders.title", intro: "reminders.intro" },
  contacts:  { eyebrow: "contacts.eyebrow",  title: "contacts.title",  intro: "contacts.intro" },
};

export default function TrackerPage() {
  const { user } = useAuth();
  const uid = user?.uid;
  const { t } = useContent();
  const { data: opps } = useLiveCollection<Opportunity>(uid, paths.opportunities);
  const { data: contacts } = useLiveCollection<Contact>(uid, paths.contacts);
  const { data: reminders } = useLiveCollection<Reminder>(uid, paths.reminders);
  const [view, setView] = useState<View>("board");
  const [adding, setAdding] = useState(false);
  const [addingReminder, setAddingReminder] = useState(false);
  const [addingContact, setAddingContact] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<OpportunityStage | null>(null);

  const byStage = useMemo(() => {
    const m: Record<OpportunityStage, Opportunity[]> = { wishlist: [], applied: [], interview: [], offer: [], rejected: [] };
    for (const o of opps) m[normalizeStage(o.stage)].push(o);
    return m;
  }, [opps]);

  const openOpp = opps.find((o) => o.id === openId) ?? null;
  const openReminders = reminders.filter((r) => !r.done).length;

  async function move(id: string, stage: OpportunityStage) {
    const o = opps.find((x) => x.id === id);
    if (!uid || !o || normalizeStage(o.stage) === stage) return;
    await updateRecord(uid, "opportunities", id, { stage });
    track(TAGS.STAGE_CHANGE, { props: { id, stage } });
  }

  const toggleItems: { key: View; tkey: string; Icon: typeof Columns3; badge?: { n: number; red?: boolean } }[] = [
    { key: "board", tkey: "tracker.view.board", Icon: Columns3 },
    { key: "reminders", tkey: "tracker.view.reminders", Icon: Bell, badge: openReminders > 0 ? { n: openReminders, red: true } : undefined },
    { key: "contacts", tkey: "tracker.view.contacts", Icon: Users, badge: contacts.length > 0 ? { n: contacts.length } : undefined },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <span className="eyebrow">{t(HEAD[view].eyebrow)}</span>
          <h1 className="mt-1">{t(HEAD[view].title)}</h1>
        </div>
        {view === "board" && <button onClick={() => setAdding(true)} className="btn-primary"><Plus className="h-4 w-4" /> {t("tracker.addJob")}</button>}
        {view === "reminders" && <button onClick={() => setAddingReminder(true)} className="btn-primary"><Plus className="h-4 w-4" /> {t("reminders.add")}</button>}
        {view === "contacts" && <button onClick={() => setAddingContact(true)} className="btn-primary"><Plus className="h-4 w-4" /> {t("contacts.add")}</button>}
      </div>

      {/* View switch: Board (kanban) · Reminders (list) · Contacts (list) */}
      <div className="inline-flex rounded-[10px] border border-jh-line bg-jh-mist/50 p-1">
        {toggleItems.map(({ key, tkey, Icon, badge }) => {
          const active = view === key;
          return (
            <button key={key} onClick={() => setView(key)}
              className={`inline-flex items-center gap-1.5 rounded-[8px] px-3 py-1.5 font-display font-semibold text-sm transition
                ${active ? "bg-white text-jh-ink shadow-jh-1" : "text-jh-mute hover:text-jh-ink"}`}>
              <Icon className="h-4 w-4" /> {t(tkey)}
              {badge && (
                <span className={`ml-0.5 min-w-4 rounded-full px-1 text-[10px] leading-4 text-center
                  ${badge.red ? "bg-jh-red text-white" : "bg-jh-line text-jh-mute"}`}>
                  {badge.n}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <p className="text-jh-mute text-sm -mt-2">{t(HEAD[view].intro)}</p>

      {view === "board" && (
        /* Board: horizontal scroll on mobile, 5 columns on desktop */
        <div className="flex gap-3 overflow-x-auto md:overflow-visible pb-2 -mx-4 px-4 md:mx-0 md:px-0 snap-x">
          {STAGES.map((s) => {
            const cards = byStage[s.key];
            return (
              <div key={s.key}
                onDragOver={(e) => { e.preventDefault(); setDragOver(s.key); }}
                onDragLeave={() => setDragOver((d) => (d === s.key ? null : d))}
                onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData("text/plain"); setDragOver(null); if (id) move(id, s.key); }}
                className={`w-[80vw] max-w-[18rem] shrink-0 md:w-auto md:flex-1 md:max-w-none snap-start rounded-lg border transition
                  ${dragOver === s.key ? "border-jh-red bg-jh-red-soft/40" : "border-jh-line bg-jh-mist/50"}`}>
                <div className="flex items-center justify-between px-3 py-2.5 border-b border-jh-line">
                  <span className="flex items-center gap-2 font-display font-semibold text-sm text-jh-ink">
                    <span className={`h-2 w-2 rounded-full ${s.dot}`} /> {t(s.tkey)}
                  </span>
                  <span className="text-xs text-jh-mute font-semibold">{cards.length}</span>
                </div>
                <div className="p-2 space-y-2 min-h-16">
                  {cards.map((o) => (
                    <Card key={o.id} o={o} contacts={contacts} reminders={reminders}
                      onOpen={() => setOpenId(o.id)} onMove={(st) => move(o.id, st)} />
                  ))}
                  {cards.length === 0 && <p className="text-center text-xs text-jh-mute-2 py-4">{t("tracker.dropHere")}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view === "reminders" && <RemindersView uid={uid!} reminders={reminders} opps={opps} />}
      {view === "contacts" && <ContactsView uid={uid!} contacts={contacts} />}

      {adding && <AddOpportunity uid={uid!} onClose={() => setAdding(false)} />}
      {addingReminder && <AddReminder uid={uid!} opps={opps} onClose={() => setAddingReminder(false)} />}
      {addingContact && <AddContactStandalone uid={uid!} onClose={() => setAddingContact(false)} />}
      {openOpp && <DetailModal uid={uid!} opp={openOpp} contacts={contacts} reminders={reminders} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function Card({ o, contacts, reminders, onOpen, onMove }: {
  o: Opportunity; contacts: Contact[]; reminders: Reminder[]; onOpen: () => void; onMove: (s: OpportunityStage) => void;
}) {
  const { t } = useContent();
  const attached = (o.contactIds ?? []).length;
  const openReminders = reminders.filter((r) => r.opportunityId === o.id && !r.done).length;
  return (
    <div draggable
      onDragStart={(e) => e.dataTransfer.setData("text/plain", o.id)}
      className="group rounded-[10px] bg-white border border-jh-line p-3 shadow-jh-1 cursor-pointer hover:border-jh-red/40">
      <div className="flex items-start gap-2" onClick={onOpen}>
        <GripVertical className="h-4 w-4 text-jh-mute-2 mt-0.5 shrink-0 hidden md:block" />
        <div className="min-w-0 flex-1">
          <p className="font-display font-semibold text-jh-ink text-sm leading-snug truncate">{o.role || t("tracker.roleFallback")}</p>
          <p className="text-xs text-jh-mute truncate">{o.company}</p>
        </div>
        <span className={o.market === "hidden" ? "pill-hidden shrink-0" : "pill-visible shrink-0"}>{o.market}</span>
      </div>
      <div className="mt-2 flex items-center gap-3 text-xs text-jh-mute" onClick={onOpen}>
        {attached > 0 && <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {attached}</span>}
        {openReminders > 0 && <span className="inline-flex items-center gap-1"><Bell className="h-3.5 w-3.5" /> {openReminders}</span>}
      </div>
      {/* Mobile-friendly move control */}
      <select value={normalizeStage(o.stage)} onChange={(e) => onMove(e.target.value as OpportunityStage)}
        onClick={(e) => e.stopPropagation()}
        className="mt-2 w-full rounded-[8px] border border-jh-line bg-jh-mist/60 px-2 py-1 text-xs text-jh-ink md:hidden">
        {STAGES.map((s) => <option key={s.key} value={s.key}>{t("tracker.moveTo")} {t(s.tkey)}</option>)}
      </select>
    </div>
  );
}

/* ---------------- Reminders helpers ---------------- */
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fmtDue(dueOn?: string) {
  if (!dueOn) return null;
  const d = new Date(`${dueOn}T00:00:00`);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/* A date input that shows placeholder text when empty. Native date inputs render
   blank on mobile; this overlays a click-through placeholder and hides the native
   empty format text (via .date-empty) so taps still open the native picker. */
function DateField({ value, onChange, className = "" }: { value: string; onChange: (v: string) => void; className?: string }) {
  const { t } = useContent();
  return (
    <div className={`relative ${className}`}>
      <input type="date" value={value} onChange={(e) => onChange(e.target.value)}
        className={`field w-full ${value ? "" : "date-empty"}`} />
      {!value && (
        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center px-4 text-[15px] text-jh-mute-2">
          {t("tracker.datePlaceholder")}
        </span>
      )}
    </div>
  );
}

function RemindersView({ uid, reminders, opps }: { uid: string; reminders: Reminder[]; opps: Opportunity[] }) {
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

  async function toggle(r: Reminder) {
    await updateRecord(uid, "reminders", r.id, { done: !r.done });
    if (!r.done) track(TAGS.REMINDER_DONE, { props: { id: r.id } });
  }
  async function remove(r: Reminder) {
    await deleteRecord(uid, "reminders", r.id);
  }

  if (reminders.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-jh-line bg-jh-mist/40 p-8 text-center">
        <Bell className="mx-auto h-6 w-6 text-jh-mute-2" />
        <p className="mt-2 text-sm text-jh-mute whitespace-pre-wrap">{t("reminders.empty")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {open.map((r) => {
          const overdue = !!r.dueOn && r.dueOn < today;
          return (
            <li key={r.id} className="flex items-start gap-3 rounded-[10px] border border-jh-line bg-white p-3 shadow-jh-1">
              <button onClick={() => toggle(r)} aria-label="Mark done"
                className="mt-0.5 h-5 w-5 shrink-0 rounded-[6px] border-2 border-jh-line hover:border-jh-red transition" />
              <div className="min-w-0 flex-1">
                <p className="font-display font-semibold text-jh-ink text-sm leading-snug">{r.title}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  <span className={`inline-flex items-center gap-1 ${overdue ? "text-jh-red font-semibold" : "text-jh-mute"}`}>
                    {overdue ? <AlertCircle className="h-3.5 w-3.5" /> : <Calendar className="h-3.5 w-3.5" />}
                    {r.dueOn ? (overdue ? `${t("reminders.overdue")} · ${fmtDue(r.dueOn)}` : fmtDue(r.dueOn)) : t("reminders.noDue")}
                  </span>
                  {oppLabel(r.opportunityId) && (
                    <span className="inline-flex items-center gap-1 text-jh-mute truncate">
                      <Users className="h-3.5 w-3.5 shrink-0" /> {oppLabel(r.opportunityId)}
                    </span>
                  )}
                </div>
              </div>
              <button onClick={() => remove(r)} className="text-jh-mute hover:text-jh-red shrink-0"><Trash2 className="h-4 w-4" /></button>
            </li>
          );
        })}
      </ul>

      {done.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-display font-semibold uppercase tracking-wide text-jh-mute-2">{t("reminders.done")} · {done.length}</p>
          <ul className="space-y-2">
            {done.map((r) => (
              <li key={r.id} className="flex items-start gap-3 rounded-[10px] border border-jh-line bg-jh-mist/40 p-3">
                <button onClick={() => toggle(r)} aria-label="Mark not done"
                  className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-[6px] bg-rb-green-dark text-white">
                  <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3"><path d="M4 10l4 4 8-8" /></svg>
                </button>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-sm text-jh-mute line-through">{r.title}</p>
                </div>
                <button onClick={() => remove(r)} className="text-jh-mute hover:text-jh-red shrink-0"><Trash2 className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function AddReminder({ uid, opps, onClose }: { uid: string; opps: Opportunity[]; onClose: () => void }) {
  const { t } = useContent();
  const [f, setF] = useState({ title: "", dueOn: "", opportunityId: "" });
  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));
  const [busy, setBusy] = useState(false);

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
    <Sheet title={t("reminders.addTitle")} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <div><label className="label">{t("reminders.f.title")}</label>
          <input className="field" value={f.title} onChange={(e) => set("title", e.target.value)} autoFocus required /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">{t("reminders.f.due")}</label>
            <DateField value={f.dueOn} onChange={(v) => set("dueOn", v)} /></div>
          <div><label className="label">{t("reminders.f.link")}</label>
            <select className="field" value={f.opportunityId} onChange={(e) => set("opportunityId", e.target.value)}>
              <option value="">{t("reminders.f.none")}</option>
              {opps.map((o) => <option key={o.id} value={o.id}>{[o.role || t("tracker.roleFallback"), o.company].filter(Boolean).join(" · ")}</option>)}
            </select></div>
        </div>
        <button type="submit" disabled={busy} className="btn-primary w-full disabled:opacity-60">{busy ? "Adding…" : t("reminders.add")}</button>
      </form>
    </Sheet>
  );
}

/* ---------------- Contacts view ---------------- */
function ContactsView({ uid, contacts }: { uid: string; contacts: Contact[] }) {
  const { t } = useContent();
  if (contacts.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-jh-line bg-jh-mist/40 p-8 text-center">
        <Users className="mx-auto h-6 w-6 text-jh-mute-2" />
        <p className="mt-2 text-sm text-jh-mute whitespace-pre-wrap">{t("contacts.empty")}</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {contacts.map((c) => <ContactCard key={c.id} uid={uid} c={c} />)}
    </div>
  );
}

function ContactCard({ uid, c }: { uid: string; c: Contact }) {
  const { t } = useContent();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
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
    <div className="rounded-[10px] border border-jh-line bg-white p-3 shadow-jh-1">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-display font-semibold text-jh-ink text-sm truncate">{c.fullName}</p>
          <p className="text-xs text-jh-mute truncate">{[c.role, c.company].filter(Boolean).join(" · ")}</p>
        </div>
        <span className="pill-visible shrink-0 hidden sm:inline-flex">{t(CONTACT_TYPE_TKEY[normalizeContactType(c.type)])}</span>
        {c.linkedinUrl && <a href={c.linkedinUrl} target="_blank" rel="noreferrer" className="text-jh-mute hover:text-jh-ink"><Linkedin className="h-4 w-4" /></a>}
        {c.email && <a href={`mailto:${c.email}`} className="text-jh-mute hover:text-jh-ink"><Mail className="h-4 w-4" /></a>}
        {c.phone && <a href={`tel:${c.phone.replace(/[^\d+]/g, "")}`} className="text-jh-mute hover:text-jh-ink" aria-label={t("tracker.f.phone")}><Phone className="h-4 w-4" /></a>}
        <button onClick={() => setOpen((o) => !o)} className="relative text-jh-mute hover:text-jh-ink" aria-label={t("tracker.notes")}>
          <MessageSquare className="h-4 w-4" />
          {log.length > 0 && <span className="absolute -top-1.5 -right-1.5 min-w-3.5 rounded-full bg-jh-line px-0.5 text-[9px] leading-[14px] text-jh-mute text-center">{log.length}</span>}
        </button>
        <button onClick={() => setEditing(true)} className="text-jh-mute hover:text-jh-ink" aria-label={t("tracker.edit")}><Pencil className="h-4 w-4" /></button>
        <button onClick={remove} className="text-jh-mute hover:text-jh-red" aria-label={t("tracker.delete")}><Trash2 className="h-4 w-4" /></button>
      </div>
      {open && (
        <div className="mt-2 border-t border-jh-line pt-2">
          <div className="flex gap-2">
            <input className="field py-1.5 text-sm" placeholder={t("tracker.notePlaceholder")} value={note}
              onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addNote(); } }} />
            <button onClick={addNote} className="btn-secondary text-sm shrink-0">{t("tracker.addNote")}</button>
          </div>
          <ul className="mt-2 space-y-1.5">
            {log.map((n, i) => (
              <li key={i} className="text-xs text-jh-ink"><span className="text-jh-mute-2">{fmt(n.at)} · </span>{n.text}</li>
            ))}
            {log.length === 0 && <li className="text-xs text-jh-mute">{t("tracker.noNotes")}</li>}
          </ul>
        </div>
      )}
      {editing && <EditContact uid={uid} c={c} onClose={() => setEditing(false)} />}
    </div>
  );
}

function AddContactStandalone({ uid, onClose }: { uid: string; onClose: () => void }) {
  const { t } = useContent();
  const idp = "add-contact";
  const [f, setF] = useState({ fullName: "", company: "", role: "", type: DEFAULT_CONTACT_TYPE as ContactType, email: "", phone: "", linkedinUrl: "" });
  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!f.fullName.trim()) return;
    setBusy(true);
    await createDoc(paths.contacts(uid), { ...f, fullName: f.fullName.trim(), phone: f.phone.trim() });
    track(TAGS.ADD_CONTACT, { props: { type: f.type } });
    setBusy(false); onClose();
  }

  return (
    <Sheet title={t("contacts.addTitle")} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <div><label className="label">{t("tracker.f.fullName")}</label><input className="field" value={f.fullName} onChange={(e) => set("fullName", e.target.value)} autoFocus required /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">{t("tracker.f.company")}</label><input className="field" value={f.company} onChange={(e) => set("company", e.target.value)} /></div>
          <div><label className="label">{t("tracker.f.role")}</label><input className="field" value={f.role} onChange={(e) => set("role", e.target.value)} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label" htmlFor={`${idp}-type`}>{t("tracker.f.contactType")}</label>
            <select id={`${idp}-type`} className="field" value={f.type} onChange={(e) => set("type", e.target.value as ContactType)}>
              {CONTACT_TYPES.map((ct) => <option key={ct} value={ct}>{t(CONTACT_TYPE_TKEY[ct])}</option>)}
            </select></div>
          <div><label className="label">{t("tracker.f.email")}</label><input className="field" type="email" value={f.email} onChange={(e) => set("email", e.target.value)} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label" htmlFor={`${idp}-phone`}>{t("tracker.f.phone")} <span className="font-normal text-jh-mute">{t("tracker.f.optional")}</span></label><input id={`${idp}-phone`} className="field" type="tel" inputMode="tel" autoComplete="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} /></div>
          <div><label className="label">{t("tracker.f.linkedin")}</label><input className="field" value={f.linkedinUrl} onChange={(e) => set("linkedinUrl", e.target.value)} /></div>
        </div>
        <button type="submit" disabled={busy} className="btn-primary w-full disabled:opacity-60">{busy ? "Adding…" : t("contacts.addSubmit")}</button>
      </form>
    </Sheet>
  );
}

/* ---------------- Add opportunity ---------------- */
function AddOpportunity({ uid, onClose }: { uid: string; onClose: () => void }) {
  const { t } = useContent();
  const [f, setF] = useState({ company: "", role: "", market: "hidden" as Market, source: "", url: "" });
  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!f.company) return;
    setBusy(true);
    await createDoc(paths.opportunities(uid), { ...f, stage: "wishlist", contactIds: [], log: [] });
    track(TAGS.ADD_OPPORTUNITY, { props: { market: f.market } });
    setBusy(false); onClose();
  }

  return (
    <Sheet title={t("tracker.addTitle")} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">{t("tracker.f.company")}</label><input className="field" value={f.company} onChange={(e) => set("company", e.target.value)} required /></div>
          <div><label className="label">{t("tracker.f.role")}</label><input className="field" value={f.role} onChange={(e) => set("role", e.target.value)} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">{t("tracker.f.market")}</label>
            <select className="field" value={f.market} onChange={(e) => set("market", e.target.value)}>
              <option value="hidden">{t("tracker.f.hidden")}</option><option value="visible">{t("tracker.f.visible")}</option>
            </select></div>
          <div><label className="label">{t("tracker.f.source")}</label><input className="field" value={f.source} onChange={(e) => set("source", e.target.value)} /></div>
        </div>
        <div><label className="label">{t("tracker.f.link")}</label><input className="field" value={f.url} onChange={(e) => set("url", e.target.value)} /></div>
        <button type="submit" disabled={busy} className="btn-primary w-full disabled:opacity-60">{busy ? "Adding…" : t("tracker.addSubmit")}</button>
      </form>
    </Sheet>
  );
}

/* ---------------- Edit opportunity (update a job) ---------------- */
function EditOpportunity({ uid, opp, onClose }: { uid: string; opp: Opportunity; onClose: () => void }) {
  const { t } = useContent();
  const [f, setF] = useState({
    company: opp.company ?? "", role: opp.role ?? "",
    market: (opp.market ?? "hidden") as Market, source: opp.source ?? "", url: opp.url ?? "",
  });
  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!f.company.trim()) return;
    setBusy(true);
    await updateRecord(uid, "opportunities", opp.id, {
      company: f.company.trim(), role: f.role, market: f.market, source: f.source, url: f.url,
    });
    track(TAGS.UPDATE_OPPORTUNITY, { props: { market: f.market } });
    setBusy(false); onClose();
  }

  return (
    <Sheet title={t("tracker.editJobTitle")} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">{t("tracker.f.company")}</label><input className="field" value={f.company} onChange={(e) => set("company", e.target.value)} required /></div>
          <div><label className="label">{t("tracker.f.role")}</label><input className="field" value={f.role} onChange={(e) => set("role", e.target.value)} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">{t("tracker.f.market")}</label>
            <select className="field" value={f.market} onChange={(e) => set("market", e.target.value)}>
              <option value="hidden">{t("tracker.f.hidden")}</option><option value="visible">{t("tracker.f.visible")}</option>
            </select></div>
          <div><label className="label">{t("tracker.f.source")}</label><input className="field" value={f.source} onChange={(e) => set("source", e.target.value)} /></div>
        </div>
        <div><label className="label">{t("tracker.f.link")}</label><input className="field" value={f.url} onChange={(e) => set("url", e.target.value)} /></div>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">{t("tracker.cancel")}</button>
          <button type="submit" disabled={busy} className="btn-primary flex-1 disabled:opacity-60">{busy ? "Saving…" : t("tracker.save")}</button>
        </div>
      </form>
    </Sheet>
  );
}

/* ---------------- Detail modal ---------------- */
function DetailModal({ uid, opp, contacts, reminders, onClose }: {
  uid: string; opp: Opportunity; contacts: Contact[]; reminders: Reminder[]; onClose: () => void;
}) {
  const { t } = useContent();
  const [pickId, setPickId] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [rTitle, setRTitle] = useState("");
  const [rDue, setRDue] = useState("");
  const today = todayStr();

  const attachedIds = opp.contactIds ?? [];
  const attached = contacts.filter((c) => attachedIds.includes(c.id));
  const available = contacts.filter((c) => !attachedIds.includes(c.id));

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
    await createDoc(paths.reminders(uid), {
      title, done: false, opportunityId: opp.id, ...(rDue ? { dueOn: rDue } : {}),
    });
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

  return (
    <Sheet title={`${opp.role || t("tracker.roleFallback")} · ${opp.company}`} onClose={onClose} wide>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className={opp.market === "hidden" ? "pill-hidden" : "pill-visible"}>{opp.market}</span>
          {opp.url && <a href={opp.url} target="_blank" rel="noreferrer" className="link inline-flex items-center gap-1 text-sm">{t("tracker.jobLink")} <ExternalLink className="h-3.5 w-3.5" /></a>}
          <button onClick={() => setEditing(true)} className="ml-auto text-jh-mute hover:text-jh-ink inline-flex items-center gap-1 text-sm"><Pencil className="h-4 w-4" /> {t("tracker.edit")}</button>
          <button onClick={removeOpp} className="text-jh-mute hover:text-jh-red inline-flex items-center gap-1 text-sm"><Trash2 className="h-4 w-4" /> {t("tracker.delete")}</button>
        </div>

        {opp.source && <p className="text-xs text-jh-mute -mt-2">{t("tracker.f.source")}: <span className="text-jh-ink">{opp.source}</span></p>}

        {/* Attached contacts */}
        <section>
          <h3 className="text-sm font-display font-semibold text-jh-ink mb-2">{t("tracker.contacts")}</h3>
          <div className="space-y-2">
            {attached.map((c) => (
              <ContactRow key={c.id} uid={uid} c={c} onDetach={() => detach(c.id)} />
            ))}
            {attached.length === 0 && <p className="text-xs text-jh-mute">{t("tracker.contactsEmpty")}</p>}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {available.length > 0 && (
              <select value={pickId} onChange={(e) => attach(e.target.value)} className="field py-2 w-auto text-sm flex-1 min-w-40">
                <option value="">{t("tracker.attachContact")}</option>
                {available.map((c) => <option key={c.id} value={c.id}>{c.fullName}{c.company ? ` · ${c.company}` : ""}</option>)}
              </select>
            )}
            <button onClick={() => setCreating(true)} className="btn-secondary text-sm"><Plus className="h-4 w-4" /> {t("tracker.newContact")}</button>
          </div>
        </section>

        {/* Reminders — add follow-ups linked to this job (replaces conversation notes) */}
        <section>
          <h3 className="text-sm font-display font-semibold text-jh-ink mb-2">{t("reminders.title")}</h3>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input className="field" placeholder={t("tracker.reminderPlaceholder")} value={rTitle}
              onChange={(e) => setRTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addReminder(); } }} />
            <DateField value={rDue} onChange={setRDue} className="sm:w-44" />
            <button onClick={addReminder} className="btn-primary shrink-0">{t("tracker.addReminderShort")}</button>
          </div>
          <ul className="mt-3 space-y-2">
            {jobReminders.map((r) => {
              const overdue = !r.done && !!r.dueOn && r.dueOn < today;
              return (
                <li key={r.id} className="flex items-start gap-3 rounded-[10px] bg-jh-mist px-3 py-2">
                  <button onClick={() => toggleReminder(r)} aria-label="Toggle reminder"
                    className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-[6px] border-2 transition
                      ${r.done ? "border-rb-green-dark bg-rb-green-dark text-white" : "border-jh-line hover:border-jh-red"}`}>
                    {r.done && <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3"><path d="M4 10l4 4 8-8" /></svg>}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className={`font-display text-sm ${r.done ? "text-jh-mute line-through" : "text-jh-ink"}`}>{r.title}</p>
                    {r.dueOn && (
                      <p className={`mt-0.5 inline-flex items-center gap-1 text-[11px] ${overdue ? "text-jh-red font-semibold" : "text-jh-mute-2"}`}>
                        {overdue ? <AlertCircle className="h-3 w-3" /> : <Calendar className="h-3 w-3" />}
                        {overdue ? `${t("reminders.overdue")} · ${fmtDue(r.dueOn)}` : fmtDue(r.dueOn)}
                      </p>
                    )}
                  </div>
                  <button onClick={() => removeReminder(r)} className="text-jh-mute hover:text-jh-red shrink-0"><Trash2 className="h-4 w-4" /></button>
                </li>
              );
            })}
            {jobReminders.length === 0 && <li className="text-xs text-jh-mute">{t("tracker.noReminders")}</li>}
          </ul>
        </section>
      </div>

      {editing && <EditOpportunity uid={uid} opp={opp} onClose={() => setEditing(false)} />}
      {creating && <CreateContact uid={uid} onClose={() => setCreating(false)}
        onCreated={(cid) => attach(cid)} />}
    </Sheet>
  );
}

function ContactRow({ uid, c, onDetach }: { uid: string; c: Contact; onDetach: () => void }) {
  const { t } = useContent();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState("");
  const log = [...(c.log ?? [])].sort((a, b) => b.at - a.at);

  async function addNote() {
    const text = note.trim();
    if (!text) return;
    await updateRecord(uid, "contacts", c.id, { log: [...(c.log ?? []), { at: Date.now(), text }] });
    setNote("");
  }

  return (
    <div className="rounded-[10px] border border-jh-line p-3">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-display font-semibold text-jh-ink text-sm truncate">{c.fullName}</p>
          <p className="text-xs text-jh-mute truncate">{[c.role, c.company].filter(Boolean).join(" · ")}</p>
        </div>
        {c.linkedinUrl && <a href={c.linkedinUrl} target="_blank" rel="noreferrer" className="text-jh-mute"><Linkedin className="h-4 w-4" /></a>}
        {c.email && <a href={`mailto:${c.email}`} className="text-jh-mute"><Mail className="h-4 w-4" /></a>}
        <button onClick={() => setEditing(true)} className="text-jh-mute hover:text-jh-ink" aria-label={t("tracker.edit")}><Pencil className="h-4 w-4" /></button>
        <button onClick={() => setOpen((o) => !o)} className="text-jh-mute hover:text-jh-ink"><MessageSquare className="h-4 w-4" /></button>
        <button onClick={onDetach} className="text-jh-mute hover:text-jh-red"><X className="h-4 w-4" /></button>
      </div>
      {open && (
        <div className="mt-2 border-t border-jh-line pt-2">
          <div className="flex gap-2">
            <input className="field py-1.5 text-sm" placeholder={t("tracker.notePlaceholder")} value={note}
              onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addNote(); } }} />
            <button onClick={addNote} className="btn-secondary text-sm shrink-0">{t("tracker.addNote")}</button>
          </div>
          <ul className="mt-2 space-y-1.5">
            {log.map((n, i) => (
              <li key={i} className="text-xs text-jh-ink"><span className="text-jh-mute-2">{fmt(n.at)} · </span>{n.text}</li>
            ))}
          </ul>
        </div>
      )}
      {editing && <EditContact uid={uid} c={c} onClose={() => setEditing(false)} />}
    </div>
  );
}

/* ---------------- Edit contact (update a contact) ---------------- */
function EditContact({ uid, c, onClose }: { uid: string; c: Contact; onClose: () => void }) {
  const { t } = useContent();
  const idp = `edit-contact-${c.id}`;
  const [f, setF] = useState({
    fullName: c.fullName ?? "", company: c.company ?? "", role: c.role ?? "",
    type: normalizeContactType(c.type), email: c.email ?? "", phone: c.phone ?? "", linkedinUrl: c.linkedinUrl ?? "",
  });
  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!f.fullName.trim()) return;
    setBusy(true);
    await updateRecord(uid, "contacts", c.id, {
      fullName: f.fullName.trim(), company: f.company, role: f.role,
      type: f.type, email: f.email, phone: f.phone.trim(), linkedinUrl: f.linkedinUrl,
    });
    track(TAGS.UPDATE_CONTACT, { props: { type: f.type } });
    setBusy(false); onClose();
  }

  return (
    <Sheet title={t("tracker.editContactTitle")} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <div><label className="label">{t("tracker.f.fullName")}</label><input className="field" value={f.fullName} onChange={(e) => set("fullName", e.target.value)} required /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">{t("tracker.f.company")}</label><input className="field" value={f.company} onChange={(e) => set("company", e.target.value)} /></div>
          <div><label className="label">{t("tracker.f.role")}</label><input className="field" value={f.role} onChange={(e) => set("role", e.target.value)} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label" htmlFor={`${idp}-type`}>{t("tracker.f.contactType")}</label>
            <select id={`${idp}-type`} className="field" value={f.type} onChange={(e) => set("type", e.target.value as ContactType)}>
              {CONTACT_TYPES.map((ct) => <option key={ct} value={ct}>{t(CONTACT_TYPE_TKEY[ct])}</option>)}
            </select></div>
          <div><label className="label">{t("tracker.f.email")}</label><input className="field" type="email" value={f.email} onChange={(e) => set("email", e.target.value)} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label" htmlFor={`${idp}-phone`}>{t("tracker.f.phone")} <span className="font-normal text-jh-mute">{t("tracker.f.optional")}</span></label><input id={`${idp}-phone`} className="field" type="tel" inputMode="tel" autoComplete="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} /></div>
          <div><label className="label">{t("tracker.f.linkedin")}</label><input className="field" value={f.linkedinUrl} onChange={(e) => set("linkedinUrl", e.target.value)} /></div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">{t("tracker.cancel")}</button>
          <button type="submit" disabled={busy} className="btn-primary flex-1 disabled:opacity-60">{busy ? "Saving…" : t("tracker.save")}</button>
        </div>
      </form>
    </Sheet>
  );
}

function CreateContact({ uid, onClose, onCreated }: {
  uid: string; onClose: () => void; onCreated: (id: string) => void;
}) {
  const { t } = useContent();
  const idp = "create-contact";
  const [f, setF] = useState({ fullName: "", company: "", role: "", type: DEFAULT_CONTACT_TYPE as ContactType, email: "", phone: "", linkedinUrl: "" });
  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!f.fullName.trim()) return;
    setBusy(true);
    const ref = await createDoc(paths.contacts(uid), { ...f, fullName: f.fullName.trim(), phone: f.phone.trim() });
    track(TAGS.ADD_CONTACT, { props: { type: f.type } });
    setBusy(false);
    onCreated((ref as any).id);
    onClose();
  }

  return (
    <Sheet title={t("tracker.newContactTitle")} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <div><label className="label">{t("tracker.f.fullName")}</label><input className="field" value={f.fullName} onChange={(e) => set("fullName", e.target.value)} required /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">{t("tracker.f.company")}</label><input className="field" value={f.company} onChange={(e) => set("company", e.target.value)} /></div>
          <div><label className="label">{t("tracker.f.role")}</label><input className="field" value={f.role} onChange={(e) => set("role", e.target.value)} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label" htmlFor={`${idp}-type`}>{t("tracker.f.contactType")}</label>
            <select id={`${idp}-type`} className="field" value={f.type} onChange={(e) => set("type", e.target.value as ContactType)}>
              {CONTACT_TYPES.map((ct) => <option key={ct} value={ct}>{t(CONTACT_TYPE_TKEY[ct])}</option>)}
            </select></div>
          <div><label className="label">{t("tracker.f.email")}</label><input className="field" type="email" value={f.email} onChange={(e) => set("email", e.target.value)} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label" htmlFor={`${idp}-phone`}>{t("tracker.f.phone")} <span className="font-normal text-jh-mute">{t("tracker.f.optional")}</span></label><input id={`${idp}-phone`} className="field" type="tel" inputMode="tel" autoComplete="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} /></div>
          <div><label className="label">{t("tracker.f.linkedin")}</label><input className="field" value={f.linkedinUrl} onChange={(e) => set("linkedinUrl", e.target.value)} /></div>
        </div>
        <button type="submit" disabled={busy} className="btn-primary w-full disabled:opacity-60">{busy ? "Saving…" : t("tracker.createAttach")}</button>
      </form>
    </Sheet>
  );
}

/* ---------------- Shared bottom-sheet / modal ---------------- */
function Sheet({ title, onClose, children, wide }: {
  title: string; onClose: () => void; children: React.ReactNode; wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-end sm:place-items-center bg-jh-ink/60 sm:p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className={`card w-full ${wide ? "sm:max-w-lg" : "sm:max-w-md"} p-6 space-y-3 rounded-b-none sm:rounded-lg max-h-[90vh] overflow-auto`}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg leading-snug pr-4">{title}</h3>
          <button type="button" onClick={onClose}><X className="h-5 w-5 text-jh-mute" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function fmt(at: number) {
  return new Date(at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
