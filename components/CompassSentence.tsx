import type { CompassFormula } from "@/lib/types";

// Renders the Compass formula with the user's variable inputs in bold italic.
// Used on the Compass tab and in onboarding so the wording stays in one place.
function V({ value }: { value?: string }) {
  return <strong className="font-bold italic">{value?.trim() || "________"}</strong>;
}

export default function CompassSentence({ c }: { c: CompassFormula }) {
  return (
    <>
      In 60 days from now, I&apos;m an outstanding <V value={c.jobTitle} /> who adds value for my
      employer ABC Corp, in the <V value={c.industry} /> industry.<br />
      I&apos;m making $ <V value={c.targetSalary} /> yearly.<br />
      I&apos;m located in <V value={c.geography} /> and enjoy flexible working arrangements.
    </>
  );
}
