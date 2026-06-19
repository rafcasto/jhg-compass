"use client";

import { useState } from "react";
import { Plus, Linkedin, Mail, Phone, Coffee, MessageSquare, Briefcase, X } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useLiveCollection, paths, createDoc, deleteRecord } from "@/lib/firestore/db";
import type { Contact, ContactType, Interaction, InteractionType } from "@/lib/types";
import type { Market } from "@/lib/categories";
import { track } from "@/lib/track-client";
import { TAGS } from "@/lib/tags";

const TYPES: ContactType[] = ["prospect", "coach", "recruiter", "referral", "peer", "hiring_manager", "other"];

export default function ContactsPage() {
  const { user } = useAuth();
  const uid = user?.uid;
  const { data: contacts } = useLiveCollection<Contact>(uid, paths.contacts);
  const { data: interactions } = useLiveCollection<Interaction>(uid, paths.interactions);
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <span className="eyebrow">CRM</span>
          <h1 className="mt-1">Contacts</h1>
        </div>
        <button onClick={() => setOpen(true)} className="btn-primary"><Plus className="h-4 w-4" /> Add</button>
      </div>

      {contacts.length === 0 && (
        <div className="card p-8 text-center text-jh-mute">
          No contacts yet. Add the people you meet through coffee chats, info interviews and referrals.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {contacts.map((c) => (
          <ContactCard key={c.id} uid={uid!} c={c}
            count={interactions.filter((i) => i.contactId === c.id).length} />
        ))}
      </div>

      {open && <AddContact uid={uid!} onClose={() => setOpen(false)} />}
    </div>
  );
}

function ContactCard({ uid, c, count }: { uid: string; c: Contact; count: number }) {
  async function logInteraction(type: InteractionType) {
    await createDoc(paths.interactions(uid), {
      contactId: c.id, type, occurredAt: Date.now(),
    });
    track(TAGS.LOG_INTERACTION, { props: { type, contactId: c.id } });
  }
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-display font-semibold text-jh-ink">{c.fullName}</p>
          <p className="text-sm text-jh-mute">{[c.role, c.company].filter(Boolean).join(" · ")}</p>
        </div>
        <span className={c.market === "hidden" ? "pill-hidden" : "pill-visible"}>{c.market}</span>
      </div>
      <div className="flex gap-3 mt-2 text-jh-mute">
        {c.linkedinUrl && <a href={c.linkedinUrl} target="_blank" rel="noreferrer"><Linkedin className="h-4 w-4" /></a>}
        {c.email && <a href={`mailto:${c.email}`}><Mail className="h-4 w-4" /></a>}
        {c.phone && <a href={`tel:${c.phone}`}><Phone className="h-4 w-4" /></a>}
        <span className="ml-auto text-xs">{count} interaction{count === 1 ? "" : "s"}</span>
      </div>
      <div className="flex gap-2 mt-3 border-t border-jh-line pt-3">
        <Quick onClick={() => logInteraction("pleasure_interview")} icon={Coffee} label="Coffee" />
        <Quick onClick={() => logInteraction("information_interview")} icon={MessageSquare} label="Info" />
        <Quick onClick={() => logInteraction("job_interview")} icon={Briefcase} label="Interview" />
      </div>
    </div>
  );
}

function Quick({ onClick, icon: Icon, label }: { onClick: () => void; icon: any; label: string }) {
  return (
    <button onClick={onClick} className="flex-1 flex items-center justify-center gap-1.5 rounded-[8px] bg-jh-mist py-2 text-xs font-semibold text-jh-ink hover:bg-jh-blue-grey">
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}

function AddContact({ uid, onClose }: { uid: string; onClose: () => void }) {
  const [f, setF] = useState({ fullName: "", company: "", role: "", type: "prospect" as ContactType, market: "hidden" as Market, linkedinUrl: "", email: "", phone: "", hasReferral: false });
  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!f.fullName) return;
    await createDoc(paths.contacts(uid), f);
    track(TAGS.ADD_CONTACT, { props: { market: f.market, type: f.type } });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-end sm:place-items-center bg-jh-ink/60 p-0 sm:p-4" onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={save}
        className="card w-full sm:max-w-md p-6 space-y-3 rounded-b-none sm:rounded-lg max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between"><h3 className="text-lg">Add contact</h3>
          <button type="button" onClick={onClose}><X className="h-5 w-5 text-jh-mute" /></button></div>
        <div><label className="label">Full name</label><input className="field" value={f.fullName} onChange={(e) => set("fullName", e.target.value)} required /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Company</label><input className="field" value={f.company} onChange={(e) => set("company", e.target.value)} /></div>
          <div><label className="label">Role</label><input className="field" value={f.role} onChange={(e) => set("role", e.target.value)} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Type</label>
            <select className="field" value={f.type} onChange={(e) => set("type", e.target.value)}>
              {TYPES.map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
            </select></div>
          <div><label className="label">Market</label>
            <select className="field" value={f.market} onChange={(e) => set("market", e.target.value)}>
              <option value="hidden">Hidden</option><option value="visible">Visible</option>
            </select></div>
        </div>
        <div><label className="label">LinkedIn URL</label><input className="field" value={f.linkedinUrl} onChange={(e) => set("linkedinUrl", e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Email</label><input className="field" value={f.email} onChange={(e) => set("email", e.target.value)} /></div>
          <div><label className="label">Phone</label><input className="field" value={f.phone} onChange={(e) => set("phone", e.target.value)} /></div>
        </div>
        <label className="flex items-center gap-2 text-sm text-jh-ink">
          <input type="checkbox" checked={f.hasReferral} onChange={(e) => set("hasReferral", e.target.checked)} /> Reached via a referral
        </label>
        <button type="submit" className="btn-primary w-full">Save contact</button>
      </form>
    </div>
  );
}
