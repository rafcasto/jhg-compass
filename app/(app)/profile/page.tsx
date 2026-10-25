"use client";

import { useAuth } from "@/components/AuthProvider";
import { useLiveDoc, paths } from "@/lib/firestore/db";
import type { Profile } from "@/lib/types";
import PageHeader from "@/components/shell/PageHeader";

// Account page reached from the Profile link in the shell (sidebar on desktop,
// header icon on mobile). Read-only for now: who you are, as the app knows it.
export default function ProfilePage() {
  const { user } = useAuth();
  const { data: profile } = useLiveDoc<Profile>(user ? paths.profile(user.uid) : null);

  const fullName = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ");
  const initials = (fullName || profile?.email || user?.email || "?")
    .split(/[\s@]+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");

  const rows: { label: string; value?: string }[] = [
    { label: "Name", value: fullName || undefined },
    { label: "Email", value: profile?.email ?? user?.email ?? undefined },
    { label: "Country", value: profile?.country },
    { label: "Archetype", value: profile?.archetype },
  ];

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Account" title="Profile" />

      <section className="card max-w-lg p-6">
        <div className="flex items-center gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-jh-red-soft font-display font-bold text-jh-red" aria-hidden>
            {initials}
          </div>
          <div className="min-w-0">
            <p className="truncate font-display font-semibold text-jh-ink">{fullName || "Your profile"}</p>
            {rows[1].value && <p className="truncate text-sm text-jh-mute">{rows[1].value}</p>}
          </div>
        </div>

        <dl className="mt-6 divide-y divide-jh-line border-t border-jh-line">
          {rows.map((r) => (
            <div key={r.label} className="flex items-baseline justify-between gap-4 py-3">
              <dt className="eyebrow">{r.label}</dt>
              <dd className={`text-right text-sm ${r.value ? "text-jh-ink" : "text-jh-mute"}`}>{r.value ?? "—"}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
