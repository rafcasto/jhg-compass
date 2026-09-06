import { companyTypePhrase, type Goal } from "@/lib/goal";

// The fixed goal-statement sentence. Every member value is italic + white; blanks
// render a dimmed placeholder so the shape of the sentence is always visible.
// Pure component — no hooks, no data access — so it is trivially testable and
// re-renders live while the edit form is being typed into. Shared by the
// Compass tab and onboarding step 2.
//
// Template:
//   In 60 days from now, I'm working as [Seniority Level + Job title], making $____ yearly before tax.
//   I'm based in [City] and specialise in thriving industry [Specific Subsector].
//   I enjoy working for [Company Type], with flexible working arrangements.

function V({ value, placeholder, name }: { value?: string; placeholder: string; name: string }) {
  const v = value?.trim();
  return (
    <em
      data-field={name}
      data-empty={v ? undefined : "true"}
      className={v ? "italic text-white" : "italic text-white/45"}
    >
      {v || placeholder}
    </em>
  );
}

export default function GoalStatement({ goal }: { goal: Goal }) {
  return (
    <p className="goal-statement" data-testid="goal-statement">
      In 60 days from now, I&apos;m working as <V name="role" value={goal.role} placeholder="[Seniority Level + Job title]" />, making $
      <V name="salary" value={goal.salary} placeholder="____" /> yearly before tax.
      <br />
      I&apos;m based in <V name="city" value={goal.city} placeholder="[City]" /> and specialise in thriving industry{" "}
      <V name="subsector" value={goal.subsector} placeholder="[Specific Subsector]" />.
      <br />
      I enjoy working for <V name="companyType" value={companyTypePhrase(goal.companyType)} placeholder="[Company Type]" />, with flexible
      working arrangements.
    </p>
  );
}
