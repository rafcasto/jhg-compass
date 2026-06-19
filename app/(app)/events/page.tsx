"use client";

import { useMemo, useState } from "react";
import { Plus, X, MapPin, CalendarDays, ExternalLink, Trash2, Globe } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useLiveCollection, paths, createDoc, deleteShared } from "@/lib/firestore/db";
import type { EventItem } from "@/lib/types";
import { ymd } from "@/lib/period";
import { track } from "@/lib/track-client";
import { TAGS } from "@/lib/tags";

export default function EventsPage() {
  const { user, isAdmin } = useAuth();
  const uid = user?.uid;
  const { data: events } = useLiveCollection<EventItem>(uid, () => paths.events(), "date");
  const [open, setOpen] = useState(false);
  const [country, setCountry] = useState("all");
  const [when, setWhen] = useState<"upcoming" | "past" | "all">("upcoming");
  const [search, setSearch] = useState("");

  const today = ymd(new Date());
  const countries = useMemo(
    () => Array.from(new Set(events.map((e) => e.country).filter(Boolean))).sort() as string[],
    [events]
  );

  const filtered = useMemo(() => {
    return events
      .filter((e) => (country === "all" ? true : e.country === country))
      .filter((e) => (when === "all" ? true : when === "upcoming" ? e.date >= today : e.date < today))
      .filter((e) => (search ? `${e.name} ${e.city} ${e.location}`.toLowerCase().includes(search.toLowerCase()) : true))
      .sort((a, b) => (when === "past" ? (a.date < b.date ? 1 : -1) : a.date > b.date ? 1 : -1));
  }, [events, country, when, search, today]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><span className="eyebrow">Community</span><h1 className="mt-1">Events &amp; meetups</h1></div>
        <button onClick={() => setOpen(true)} className="btn-primary"><Plus className="h-4 w-4" /> Post</button>
      </div>
      <p className="text-jh-mute text-sm -mt-2">Networking events shared by the JobHackers community. Showing up is hidden-market gold.</p>

      {/* filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="inline-flex rounded-pill bg-jh-mist p-1">
          {(["upcoming", "past", "all"] as const).map((w) => (
            <button key={w} onClick={() => setWhen(w)}
              className={`rounded-pill px-3 py-1 text-xs font-display font-semibold capitalize transition ${when === w ? "bg-white text-jh-ink shadow-jh-1" : "text-jh-mute"}`}>{w}</button>
          ))}
        </div>
        <select value={country} onChange={(e) => setCountry(e.target.value)} className="field py-2 w-auto text-sm">
          <option value="all">All countries</option>
          {countries.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="field py-2 w-auto text-sm flex-1 min-w-32" />
      </div>

      {filtered.length === 0 && (
        <div className="card p-8 text-center text-jh-mute">No events here yet. Post the next meetup so others can join.</div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {filtered.map((e) => (
          <div key={e.id} className="card p-4">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-base leading-snug">{e.name}</h3>
              {(e.createdBy === uid || isAdmin) && (
                <button onClick={() => deleteShared("events", e.id)} className="text-jh-mute hover:text-jh-red shrink-0"><Trash2 className="h-4 w-4" /></button>
              )}
            </div>
            <div className="mt-2 space-y-1 text-sm text-jh-mute">
              <p className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4" /> {fmtDate(e.date)}{e.time ? ` · ${e.time}` : ""}</p>
              {(e.city || e.location) && <p className="flex items-center gap-1.5"><MapPin className="h-4 w-4" /> {[e.location, e.city].filter(Boolean).join(", ")}</p>}
              {e.country && <p className="flex items-center gap-1.5"><Globe className="h-4 w-4" /> {e.country}</p>}
            </div>
            <div className="mt-2 flex items-center justify-between">
              {e.url ? <a href={e.url} target="_blank" rel="noreferrer" className="link inline-flex items-center gap-1 text-sm">Details <ExternalLink className="h-3.5 w-3.5" /></a> : <span />}
              {e.createdByName && <span className="text-xs text-jh-mute-2">by {e.createdByName}</span>}
            </div>
          </div>
        ))}
      </div>

      {open && <AddEvent uid={uid!} authorName={user?.displayName || user?.email?.split("@")[0] || "A JobHacker"} onClose={() => setOpen(false)} />}
    </div>
  );
}

function AddEvent({ uid, authorName, onClose }: { uid: string; authorName: string; onClose: () => void }) {
  const [f, setF] = useState({ name: "", date: "", time: "", location: "", city: "", country: "", url: "", notes: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!f.name || !f.date) return;
    setBusy(true);
    await createDoc(paths.events(), { ...f, createdBy: uid, createdByName: authorName });
    track(TAGS.ADD_EVENT, { props: { country: f.country } });
    setBusy(false); onClose();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-end sm:place-items-center bg-jh-ink/60 sm:p-4" onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={save}
        className="card w-full sm:max-w-md p-6 space-y-3 rounded-b-none sm:rounded-lg max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between"><h3 className="text-lg">Post an event</h3>
          <button type="button" onClick={onClose}><X className="h-5 w-5 text-jh-mute" /></button></div>
        <div><label className="label">Event name</label><input className="field" value={f.name} onChange={(e) => set("name", e.target.value)} required /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Date</label><input type="date" className="field" value={f.date} onChange={(e) => set("date", e.target.value)} required /></div>
          <div><label className="label">Time</label><input type="time" className="field" value={f.time} onChange={(e) => set("time", e.target.value)} /></div>
        </div>
        <div><label className="label">Venue / location</label><input className="field" value={f.location} onChange={(e) => set("location", e.target.value)} placeholder="e.g. WeWork Aldgate" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">City</label><input className="field" value={f.city} onChange={(e) => set("city", e.target.value)} /></div>
          <div><label className="label">Country</label><input className="field" value={f.country} onChange={(e) => set("country", e.target.value)} /></div>
        </div>
        <div><label className="label">Link (optional)</label><input className="field" value={f.url} onChange={(e) => set("url", e.target.value)} /></div>
        <button type="submit" disabled={busy} className="btn-primary w-full disabled:opacity-60">{busy ? "Posting…" : "Post event"}</button>
      </form>
    </div>
  );
}

function fmtDate(d: string) {
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}
