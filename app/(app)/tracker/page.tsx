"use client";

import { useMemo, useState } from "react";
import {
  Plus, X, ExternalLink, Trash2, Users, MessageSquare, Linkedin, Mail, GripVertical,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import {
  useLiveCollection, paths, createDoc, updateRecord, deleteRecord,
} from "@/lib/firestore/db";
import type { Contact, NoteEntry, Opportunity, OpportunityStage } from "@/lib/types";
import type { Market } from "@/lib/categories";
import { track } from "@/lib/track-client";
import { TAGS } from "@/lib/tags";

const STAGES: { key: OpportunityStage; label: string; dot: string }[] = [
  { key: "wishlist",  label: "Wishlist",  dot: "bg-jh-mute" },
  { key: "applied",   label: "Applied",   dot: "bg-rb-blue" },
  { key: "interview", label: "Interview", dot: "bg-rb-orange" },
  { key: "offer",     label: "Offer",     dot: "bg-rb-green-dark" },
  { key: "rejected",  label: "Rejected",  dot: "bg-jh-red" },
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

export default function TrackerPage() {
  const { user } = useAuth();
  const uid = user?.uid;
  const { data: opps } = useLiveCollection<Opportunity>(uid, paths.opportunities);
  const { data: contacts } = useLiveCollection<Contact>(uid, paths.contacts);
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<OpportunityStage | null>(null);

  const byStage = useMemo(() => {
    const m: Record<OpportunityStage, Opportunity[]> = { wishlist: [], applied: [], interview: [], offer: [], rejected: [] };
    for (const o of opps) m[normalizeStage(o.stage)].push(o);
    return m;
  }, [opps]);

  const openOpp = opps.find((o) => o.id === openId) ?? null;

  async function move(id: string, stage: OpportunityStage) {
    const o = opps.find((x) => x.id === id);
    if (!uid || !o || normalizeStage(o.stage) === stage) return;
    await updateRecord(uid, "opportunities", id, { stage });
    track(TAGS.STAGE_CHANGE, { props: { id, stage } });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><span className="eyebrow">Pipeline</span><h1 className="mt-1">Progress</h1></div>
        <button onClick={() => setAdding(true)} className="btn-primary"><Plus className="h-4 w-4" /> Add job</button>
      </div>
      <p className="text-jh-mute text-sm -mt-2">
        Every role you&apos;re chasing, in one board. Drag cards across stages — or use the menu on mobile.
      </p>

      {/* Board: horizontal scroll on mobile, 5 columns on desktop */}
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
                  <span className={`h-2 w-2 rounded-full ${s.dot}`} /> {s.label}
                </span>
                <span className="text-xs text-jh-mute font-semibold">{cards.length}</span>
              </div>
              <div className="p-2 space-y-2 min-h-16">
                {cards.map((o) => (
                  <Card key={o.id} o={o} contacts={contacts}
                    onOpen={() => setOpenId(o.id)} onMove={(st) => move(o.id, st)} />
                ))}
                {cards.length === 0 && <p className="text-center text-xs text-jh-mute-2 py-4">Drop jobs here</p>}
              </div>
            </div>
          );
        })}
      </div>

      {adding && <AddOpportunity uid={uid!} onClose={() => setAdding(false)} />}
      {openOpp && <DetailModal uid={uid!} opp={openOpp} contacts={contacts} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function Card({ o, contacts, onOpen, onMove }: {
  o: Opportunity; contacts: Contact[]; onOpen: () => void; onMove: (s: OpportunityStage) => void;
}) {
  const attached = (o.contactIds ?? []).length;
  const notes = (o.log ?? []).length;
  return (
    <div draggable
      onDragStart={(e) => e.dataTransfer.setData("text/plain", o.id)}
      className="group rounded-[10px] bg-white border border-jh-line p-3 shadow-jh-1 cursor-pointer hover:border-jh-red/40">
      <div className="flex items-start gap-2" onClick={onOpen}>
        <GripVertical className="h-4 w-4 text-jh-mute-2 mt-0.5 shrink-0 hidden md:block" />
        <div className="min-w-0 flex-1">
          <p className="font-display font-semibold text-jh-ink text-sm leading-snug truncate">{o.role || "Role"}</p>
          <p className="text-xs text-jh-mute truncate">{o.company}</p>
        </div>
        <span className={o.market === "hidden" ? "pill-hidden shrink-0" : "pill-visible shrink-0"}>{o.market}</span>
      </div>
      <div className="mt-2 flex items-center gap-3 text-xs text-jh-mute" onClick={onOpen}>
        {attached > 0 && <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {attached}</span>}
        {notes > 0 && <span className="inline-flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" /> {notes}</span>}
      </div>
      {/* Mobile-friendly move control */}
      <select value={normalizeStage(o.stage)} onChange={(e) => onMove(e.target.value as OpportunityStage)}
        onClick={(e) => e.stopPropagation()}
        className="mt-2 w-full rounded-[8px] border border-jh-line bg-jh-mist/60 px-2 py-1 text-xs text-jh-ink md:hidden">
        {STAGES.map((s) => <option key={s.key} value={s.key}>Move to: {s.label}</option>)}
      </select>
    </div>
  );
}

/* ---------------- Add opportunity ---------------- */
function AddOpportunity({ uid, onClose }: { uid: string; onClose: () => void }) {
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
    <Sheet title="Add job opportunity" onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Company</label><input className="field" value={f.company} onChange={(e) => set("company", e.target.value)} required /></div>
          <div><label className="label">Role</label><input className="field" value={f.role} onChange={(e) => set("role", e.target.value)} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Market</label>
            <select className="field" value={f.market} onChange={(e) => set("market", e.target.value)}>
              <option value="hidden">Hidden</option><option value="visible">Visible</option>
            </select></div>
          <div><label className="label">Source</label><input className="field" value={f.source} onChange={(e) => set("source", e.target.value)} /></div>
        </div>
        <div><label className="label">Link</label><input className="field" value={f.url} onChange={(e) => set("url", e.target.value)} /></div>
        <button type="submit" disabled={busy} className="btn-primary w-full disabled:opacity-60">{busy ? "Adding…" : "Add to Wishlist"}</button>
      </form>
    </Sheet>
  );
}

/* ---------------- Detail modal ---------------- */
function DetailModal({ uid, opp, contacts, onClose }: {
  uid: string; opp: Opportunity; contacts: Contact[]; onClose: () => void;
}) {
  const [note, setNote] = useState("");
  const [pickId, setPickId] = useState("");
  const [creating, setCreating] = useState(false);

  const attachedIds = opp.contactIds ?? [];
  const attached = contacts.filter((c) => attachedIds.includes(c.id));
  const available = contacts.filter((c) => !attachedIds.includes(c.id));
  const log = [...(opp.log ?? [])].sort((a, b) => b.at - a.at);

  async function addNote() {
    const text = note.trim();
    if (!text) return;
    const next: NoteEntry[] = [...(opp.log ?? []), { at: Date.now(), text }];
    await updateRecord(uid, "opportunities", opp.id, { log: next });
    setNote("");
  }
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

  return (
    <Sheet title={`${opp.role || "Role"} · ${opp.company}`} onClose={onClose} wide>
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <span className={opp.market === "hidden" ? "pill-hidden" : "pill-visible"}>{opp.market}</span>
          {opp.url && <a href={opp.url} target="_blank" rel="noreferrer" className="link inline-flex items-center gap-1 text-sm">Job link <ExternalLink className="h-3.5 w-3.5" /></a>}
          <button onClick={removeOpp} className="ml-auto text-jh-mute hover:text-jh-red inline-flex items-center gap-1 text-sm"><Trash2 className="h-4 w-4" /> Delete</button>
        </div>

        {/* Attached contacts */}
        <section>
          <h3 className="text-sm font-display font-semibold text-jh-ink mb-2">Contacts</h3>
          <div className="space-y-2">
            {attached.map((c) => (
              <ContactRow key={c.id} uid={uid} c={c} onDetach={() => detach(c.id)} />
            ))}
            {attached.length === 0 && <p className="text-xs text-jh-mute">No contacts attached yet. Add the people who can open doors here.</p>}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {available.length > 0 && (
              <select value={pickId} onChange={(e) => attach(e.target.value)} className="field py-2 w-auto text-sm flex-1 min-w-40">
                <option value="">Attach existing contact…</option>
                {available.map((c) => <option key={c.id} value={c.id}>{c.fullName}{c.company ? ` · ${c.company}` : ""}</option>)}
              </select>
            )}
            <button onClick={() => setCreating(true)} className="btn-secondary text-sm"><Plus className="h-4 w-4" /> New contact</button>
          </div>
        </section>

        {/* Conversation log */}
        <section>
          <h3 className="text-sm font-display font-semibold text-jh-ink mb-2">Conversation notes</h3>
          <div className="flex gap-2">
            <input className="field" placeholder="Log a call, email, update…" value={note}
              onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addNote(); } }} />
            <button onClick={addNote} className="btn-primary shrink-0">Add</button>
          </div>
          <ul className="mt-3 space-y-2">
            {log.map((n, i) => (
              <li key={i} className="rounded-[10px] bg-jh-mist px-3 py-2">
                <p className="text-sm text-jh-ink whitespace-pre-wrap">{n.text}</p>
                <p className="text-[11px] text-jh-mute-2 mt-1">{fmt(n.at)}</p>
              </li>
            ))}
            {log.length === 0 && <li className="text-xs text-jh-mute">No notes yet.</li>}
          </ul>
        </section>
      </div>

      {creating && <CreateContact uid={uid} onClose={() => setCreating(false)}
        onCreated={(cid) => attach(cid)} />}
    </Sheet>
  );
}

function ContactRow({ uid, c, onDetach }: { uid: string; c: Contact; onDetach: () => void }) {
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
    <div className="rounded-[10px] border border-jh-line p-3">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-display font-semibold text-jh-ink text-sm truncate">{c.fullName}</p>
          <p className="text-xs text-jh-mute truncate">{[c.role, c.company].filter(Boolean).join(" · ")}</p>
        </div>
        {c.linkedinUrl && <a href={c.linkedinUrl} target="_blank" rel="noreferrer" className="text-jh-mute"><Linkedin className="h-4 w-4" /></a>}
        {c.email && <a href={`mailto:${c.email}`} className="text-jh-mute"><Mail className="h-4 w-4" /></a>}
        <button onClick={() => setOpen((o) => !o)} className="text-jh-mute hover:text-jh-ink"><MessageSquare className="h-4 w-4" /></button>
        <button onClick={onDetach} className="text-jh-mute hover:text-jh-red"><X className="h-4 w-4" /></button>
      </div>
      {open && (
        <div className="mt-2 border-t border-jh-line pt-2">
          <div className="flex gap-2">
            <input className="field py-1.5 text-sm" placeholder="Note about this person…" value={note}
              onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addNote(); } }} />
            <button onClick={addNote} className="btn-secondary text-sm shrink-0">Add</button>
          </div>
          <ul className="mt-2 space-y-1.5">
            {log.map((n, i) => (
              <li key={i} className="text-xs text-jh-ink"><span className="text-jh-mute-2">{fmt(n.at)} · </span>{n.text}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function CreateContact({ uid, onClose, onCreated }: {
  uid: string; onClose: () => void; onCreated: (id: string) => void;
}) {
  const [f, setF] = useState({ fullName: "", company: "", role: "", market: "hidden" as Market, email: "", linkedinUrl: "" });
  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!f.fullName) return;
    setBusy(true);
    const ref = await createDoc(paths.contacts(uid), { ...f, type: "prospect" });
    track(TAGS.ADD_CONTACT, { props: { market: f.market } });
    setBusy(false);
    onCreated((ref as any).id);
    onClose();
  }

  return (
    <Sheet title="New contact" onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <div><label className="label">Full name</label><input className="field" value={f.fullName} onChange={(e) => set("fullName", e.target.value)} required /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Company</label><input className="field" value={f.company} onChange={(e) => set("company", e.target.value)} /></div>
          <div><label className="label">Role</label><input className="field" value={f.role} onChange={(e) => set("role", e.target.value)} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Market</label>
            <select className="field" value={f.market} onChange={(e) => set("market", e.target.value)}>
              <option value="hidden">Hidden</option><option value="visible">Visible</option>
            </select></div>
          <div><label className="label">Email</label><input className="field" value={f.email} onChange={(e) => set("email", e.target.value)} /></div>
        </div>
        <div><label className="label">LinkedIn URL</label><input className="field" value={f.linkedinUrl} onChange={(e) => set("linkedinUrl", e.target.value)} /></div>
        <button type="submit" disabled={busy} className="btn-primary w-full disabled:opacity-60">{busy ? "Saving…" : "Create & attach"}</button>
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
