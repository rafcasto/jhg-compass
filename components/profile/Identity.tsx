import type { Profile } from "@/lib/types";

// Who this is — initials, name, email, country. Rail top on desktop, a card on
// the mobile overview; shared by the Profile page and JobHacking · Profile.
// One fact per line: in the 232px desktop rail a joined "email · country"
// always lost the country to the ellipsis.

export const initialsOf = (fullName: string, email: string): string =>
  (fullName || email || "?").split(/[\s@]+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");

export default function Identity({ profile, email, fallback = "Your profile" }: { profile: Profile | null | undefined; email: string; fallback?: string }) {
  const fullName = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ");
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-jh-red-soft font-display font-bold text-sm text-jh-red" aria-hidden>{initialsOf(fullName, email)}</div>
      <div className="min-w-0">
        <p className="truncate font-display font-semibold text-jh-ink">{fullName || fallback}</p>
        {email && <p className="truncate text-sm text-jh-mute" title={email}>{email}</p>}
        {profile?.country && <p className="truncate text-sm text-jh-mute">{profile.country}</p>}
      </div>
    </div>
  );
}
