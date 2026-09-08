"use client";

import { useEffect, useState } from "react";
import { authed, Empty, Loading, Section, StatCard } from "@/components/admin/shared";

interface Stats {
  users: number; eventsTotal: number; activeGrants: number; activeLinks: number;
  recent: { first_name?: string; email: string; stage: string; tag: string; source: string; score: number; created_at: string | null }[];
}

// JHCompass usage — who is in the app and what they did last. Replaces the old
// Dashboard tab; the aggregate funnel view is the Pirate metrics sub-tab.
export default function UsageTab() {
  const [s, setS] = useState<Stats | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    authed("/api/admin/stats").then((r) => r.json()).then((d) => (d.ok ? setS(d) : setErr(true))).catch(() => setErr(true));
  }, []);

  if (err) return <p className="text-jh-red">Couldn’t load usage. Try again.</p>;
  if (!s) return <Loading>Loading usage…</Loading>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard value={s.users} label="Members" hint="Firebase Auth accounts" />
        <StatCard value={s.activeGrants} label="Active access" hint="Grants not expired" />
        <StatCard value={s.activeLinks} label="Active invite links" hint="Registration links still valid" />
        <StatCard value={s.eventsTotal} label="Events tracked" hint="Compass rows in Supabase" />
      </div>

      <Section title="Recent activity" help="The latest Compass events, newest first. Each row is one (person, event) pair; “Score” counts repeats.">
        {(!s.recent || s.recent.length === 0) ? <Empty>No events yet.</Empty> : (
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-jh-mute border-b border-jh-line">
                  {["Name", "Email", "Stage", "Event tag", "Source", "Score", "Date"].map((h) => <th key={h} className="font-semibold px-3 py-2 whitespace-nowrap">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {s.recent.map((r, i) => (
                  <tr key={i} className="border-b border-jh-line last:border-0">
                    <td className="px-3 py-2.5">{r.first_name ?? "—"}</td>
                    <td className="px-3 py-2.5 text-jh-mute">{r.email}</td>
                    <td className="px-3 py-2.5"><span className="pill bg-jh-mist text-jh-ink capitalize">{r.stage}</span></td>
                    <td className="px-3 py-2.5 font-mono text-xs text-jh-ink">{r.tag}</td>
                    <td className="px-3 py-2.5 text-jh-mute">{r.source}</td>
                    <td className="px-3 py-2.5 font-semibold tabular-nums">{r.score}</td>
                    <td className="px-3 py-2.5 text-jh-mute whitespace-nowrap">{r.created_at ? new Date(r.created_at).toLocaleDateString() : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
