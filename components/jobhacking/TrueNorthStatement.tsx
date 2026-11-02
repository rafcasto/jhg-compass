import Link from "next/link";
import { Navigation } from "lucide-react";
import { TRUE_NORTH_PLACEHOLDERS, TRUE_NORTH_SECTION, jhSectionHref, trueNorthBlanks, type TrueNorthBlanks } from "@/lib/jobhacking/sections";
import type { Goal } from "@/lib/goal";

// The True North statement — the lead of /jobhacking/true-north. Same dark card
// and `.goal-statement` type as the Compass goal card, so a member who has both
// portals reads one voice. Every value is a link to the section that fills it;
// blanks render the template's own bracketed label, dimmed, so the shape of the
// sentence is always visible. Pure: no hooks, no data access.
//
//   In 60 days, I'm working as [Target Role + Target Seniority], in [Target Industry].
//   I'm based in [Target Location] and I'm making [Target Salary] yearly before tax.
//   I enjoy working for [Target Company Type].

function V({ blanks, name }: { blanks: TrueNorthBlanks; name: keyof TrueNorthBlanks }) {
  const v = blanks[name];
  return (
    <Link
      href={jhSectionHref(TRUE_NORTH_SECTION[name])}
      data-field={name}
      data-empty={v ? undefined : "true"}
      className={`italic underline-offset-4 decoration-white/30 hover:underline ${v ? "text-white" : "text-white/55"}`}
    >
      {v || TRUE_NORTH_PLACEHOLDERS[name]}
    </Link>
  );
}

export default function TrueNorthStatement({ goal, eyebrow = "Your True North" }: { goal: Goal | null | undefined; eyebrow?: string }) {
  const blanks = trueNorthBlanks(goal);
  return (
    <section aria-labelledby="true-north-eyebrow" className="relative overflow-hidden rounded-xl bg-jh-ink text-white px-6 py-6 md:px-8 md:py-7">
      <Navigation aria-hidden strokeWidth={1} className="pointer-events-none absolute -right-14 top-1/2 h-[240px] w-[240px] -translate-y-1/2 text-white/5" />
      <div className="relative">
        <span id="true-north-eyebrow" className="eyebrow text-jh-mute-2">{eyebrow}</span>
        <p className="goal-statement mt-3" data-testid="true-north-statement">
          In 60 days, I&apos;m working as <V blanks={blanks} name="role" />, in <V blanks={blanks} name="industry" />.
          <br />
          I&apos;m based in <V blanks={blanks} name="location" /> and I&apos;m making <V blanks={blanks} name="salary" /> yearly before tax.
          <br />
          I enjoy working for <V blanks={blanks} name="companyType" />.
        </p>
      </div>
    </section>
  );
}
