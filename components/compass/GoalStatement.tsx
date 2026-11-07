import { TRUE_NORTH_PLACEHOLDERS, trueNorthBlanks, type Goal, type TrueNorthBlanks } from "@/lib/goal";

// The fixed goal-statement sentence — the True North statement (decision
// 2026-11-07: one sentence on the Compass tab, onboarding step 2 and True
// North). Every member value is italic + white; blanks render the template's
// own bracketed label, dimmed, so the shape of the sentence is always visible.
// Pure component — no hooks, no data access — so it is trivially testable and
// re-renders live while the edit form is being typed into.
//
//   In 60 days, I'm working as [Target Role + Target Seniority], in [Target Industry].
//   I'm based in [Target Location] and I'm making [Target Salary] yearly before tax.
//   I enjoy working for [Target Company Type].

function V({ blanks, name }: { blanks: TrueNorthBlanks; name: keyof TrueNorthBlanks }) {
  const v = blanks[name];
  return (
    <em data-field={name} data-empty={v ? undefined : "true"} className={v ? "italic text-white" : "italic text-white/55"}>
      {v || TRUE_NORTH_PLACEHOLDERS[name]}
    </em>
  );
}

export default function GoalStatement({ goal }: { goal: Goal }) {
  const blanks = trueNorthBlanks(goal);
  return (
    <p className="goal-statement" data-testid="goal-statement">
      In 60 days, I&apos;m working as <V blanks={blanks} name="role" />, in <V blanks={blanks} name="industry" />.
      <br />
      I&apos;m based in <V blanks={blanks} name="location" /> and I&apos;m making <V blanks={blanks} name="salary" /> yearly before tax.
      <br />
      I enjoy working for <V blanks={blanks} name="companyType" />.
    </p>
  );
}
