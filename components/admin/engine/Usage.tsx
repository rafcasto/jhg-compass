"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { authed, Empty, Loading, Section, StatCard } from "@/components/admin/shared";
import { fmtUsd } from "@/lib/engine/pricing";
import { monthKey } from "@/lib/engine/keys";
import type { ClaudeUsageMonth } from "@/lib/engine/usage";

interface Row extends ClaudeUsageMonth { uid: string; email: string; name: string; coach: boolean }
interface Payload { month: string; rows: Row[]; total: { turns: number; estimatedUsd: number; input: number; cacheRead: number; output: number; searches: number }; members: number; enabled: number }

const shiftMonth = (m: string, by: number) => { const [y, mo] = m.split("-").map(Number); const d = new Date(Date.UTC(y, mo - 1 + by, 1)); return d.toISOString().slice(0, 7); };
const monthLabel = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
const k = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));
const hitRate = (cacheRead: number, input: number) => (cacheRead + input > 0 ? `${Math.round((cacheRead / (cacheRead + input)) * 100)}%` : "—");

// Admin → Claude → Usage: every member's meter for one month, most expensive first.
// The cost is an estimate from the price table on the Settings sub-tab.
export default function Usage() {
  const [month, setMonth] = useState(monthKey());
  const [data, setData] = useState<Payload | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async (m: string) => {
    setData(null); setErr(null);
    try { const d = await (await authed(`/api/admin/engine/usage?month=${m}`)).json(); if (d.ok) setData(d); else setErr(d.error ?? "Couldn't load usage."); }
    catch { setErr("Couldn't load usage."); }
  }, []);
  useEffect(() => { load(month); }, [month, load]);

  const active = data?.rows.length ?? 0;
  const perMember = active ? (data!.total.estimatedUsd / active) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="icon-btn" aria-label="Previous month" onClick={() => setMonth((m) => shiftMonth(m, -1))}><ChevronLeft className="h-4 w-4" /></button>
        <span className="font-display font-semibold text-jh-ink min-w-36 text-center">{monthLabel(month)}</span>
        <button type="button" className="icon-btn" aria-label="Next month" onClick={() => setMonth((m) => shiftMonth(m, 1))} disabled={month >= monthKey()}><ChevronRight className="h-4 w-4" /></button>
        <button type="button" onClick={() => load(month)} className="btn-secondary text-xs px-3 py-2 ml-auto" aria-label="Refresh"><RefreshCw className="h-4 w-4" /></button>
      </div>

      {err ? <p className="text-jh-red">{err}</p> : !data ? <Loading /> : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard value={active} label="Members who used Claude" hint={`${data.enabled} with the coach switched on · ${data.members} members`} />
            <StatCard value={data.total.turns} label="Calls" hint={`${k(data.total.output)} tokens out · ${data.total.searches} web searches`} />
            <StatCard value={fmtUsd(data.total.estimatedUsd)} label="Estimated cost" hint="from the price table — an estimate" />
            <StatCard value={fmtUsd(perMember)} label="Per active member" hint={`cache hit rate ${hitRate(data.total.cacheRead, data.total.input)}`} />
          </div>

          <Section title="By member" help="Most expensive first. A row's share by coach or job is under its name.">
            {data.rows.length === 0 ? <Empty>No Claude calls in {monthLabel(month)}.</Empty> : (
              <div className="overflow-x-auto -mx-5 px-5">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-jh-mute border-b border-jh-line">
                      {["Member", "Calls", "In · cached · out", "Searches", "Cache hits", "Est. cost", "Last call"].map((h) => <th key={h} className="font-semibold px-3 py-2 whitespace-nowrap">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((r) => (
                      <tr key={r.uid} className="border-b border-jh-line last:border-0 align-top">
                        <td className="px-3 py-2.5">
                          <p className="font-semibold text-jh-ink">{r.name || "—"}{!r.coach && <span className="ml-2 text-xs font-normal text-jh-mute">coach off</span>}</p>
                          <p className="text-xs text-jh-mute">{r.email}</p>
                          <p className="text-xs text-jh-mute-2 mt-0.5">{Object.entries(r.by).sort((a, b) => b[1].estimatedUsd - a[1].estimatedUsd).slice(0, 4).map(([key, l]) => `${key} ${fmtUsd(l.estimatedUsd)}`).join(" · ")}</p>
                        </td>
                        <td className="px-3 py-2.5 tabular-nums">{r.turns}</td>
                        <td className="px-3 py-2.5 tabular-nums text-jh-mute whitespace-nowrap">{k(r.input)} · {k(r.cacheRead)} · {k(r.output)}</td>
                        <td className="px-3 py-2.5 tabular-nums">{r.searches}</td>
                        <td className="px-3 py-2.5 tabular-nums">{hitRate(r.cacheRead, r.input)}</td>
                        <td className="px-3 py-2.5 tabular-nums font-semibold text-jh-ink">{fmtUsd(r.estimatedUsd)}</td>
                        <td className="px-3 py-2.5 text-jh-mute whitespace-nowrap">{r.updatedAt ? new Date(r.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </>
      )}
    </div>
  );
}
