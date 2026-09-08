"use client";

import type { ReactNode } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, LineChart, Line,
} from "recharts";

export type Row = { label: string; count: number };

// Brand-aligned palette for charts.
export const CHART_COLORS = ["#c2001f", "#191c27", "#0033cc", "#0EA5E9", "#2f7a3a", "#f5d000", "#7a1ec2", "#f08a1c"];

export function ChartCard({ title, subtitle, children, aside }: { title: string; subtitle?: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display font-semibold text-jh-ink">{title}</p>
          {subtitle && <p className="text-xs text-jh-mute">{subtitle}</p>}
        </div>
        {aside}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

export function HBar({ rows, color = CHART_COLORS[0] }: { rows: Row[]; color?: string }) {
  if (!rows.length) return <p className="text-sm text-jh-mute">No data.</p>;
  const height = Math.max(120, rows.length * 42);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
        <CartesianGrid horizontal={false} stroke="#EEE" />
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
        <YAxis type="category" dataKey="label" width={180} tick={{ fontSize: 12 }} />
        <Tooltip cursor={{ fill: "rgba(0,0,0,.04)" }} />
        <Bar dataKey="count" fill={color} radius={[0, 4, 4, 0]} barSize={20} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function Donut({ rows }: { rows: Row[] }) {
  if (!rows.length) return <p className="text-sm text-jh-mute">No data.</p>;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={rows} dataKey="count" nameKey="label" cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2}>
          {rows.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function Legend({ rows }: { rows: Row[] }) {
  const total = rows.reduce((s, r) => s + r.count, 0) || 1;
  return (
    <ul className="mt-3 space-y-1.5">
      {rows.map((r, i) => (
        <li key={r.label} className="flex items-center gap-2 text-sm">
          <span className="h-3 w-3 rounded-sm shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
          <span className="text-jh-ink flex-1 truncate">{r.label}</span>
          <span className="text-jh-mute tabular-nums">{r.count} · {Math.round((r.count / total) * 100)}%</span>
        </li>
      ))}
    </ul>
  );
}

export function TimeLine({ data, keys, height = 300 }: { data: Record<string, string | number>[]; keys: { key: string; label?: string }[]; height?: number }) {
  if (!data.length) return <p className="text-sm text-jh-mute">No dated events.</p>;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ left: 8, right: 24, top: 8, bottom: 4 }}>
        <CartesianGrid stroke="#EEE" />
        <XAxis dataKey="day" tick={{ fontSize: 11 }} tickFormatter={(d: string) => d.slice(5)} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
        <Tooltip />
        {keys.map((k, i) => (
          <Line key={k.key} type="monotone" dataKey={k.key} name={k.label ?? k.key} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} dot={{ r: 3 }} connectNulls />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
