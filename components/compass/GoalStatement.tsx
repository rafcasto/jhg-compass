import type { Goal } from "@/lib/goal";

// The fixed goal-statement sentence. Every member value is italic + white; blanks
// render a dimmed placeholder so the shape of the sentence is always visible.
// Pure component — no hooks, no data access — so it is trivially testable and
// re-renders live while the edit form is being typed into.

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
      In 60 days from now, I&apos;m working as <V name="role" value={goal.role} placeholder="[job title]" />, making $
      <V name="salary" value={goal.salary} placeholder="[salary]" /> yearly before tax.
      <br />
      I&apos;m based in <V name="city" value={goal.city} placeholder="[city]" /> and specialise in thriving industry{" "}
      <V name="subsector" value={goal.subsector} placeholder="[subsector]" />.
      <br />
      I enjoy working for <V name="companyType" value={goal.companyType} placeholder="[company type]" />, with flexible
      working arrangements.
    </p>
  );
}
