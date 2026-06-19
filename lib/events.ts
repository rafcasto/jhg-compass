import "server-only";
import { pgSelect, pgInsert, pgUpdate } from "./supabaseServer";
import { TAGS } from "./tags";

export { TAGS };

// Lifecycle stage — matches the public.lead_stage enum on jobhackers_leads.
export type EventStage = "acquisition" | "activation" | "retention";

export interface CompassEvent {
  firebaseUid?: string | null;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  archetype?: string | null;
  stage?: EventStage;
  /** EVENT->ACTION->TRACKER, e.g. EVENT->REGISTRATION->TRACKER */
  tag: string;
  source?: string;
  props?: Record<string, unknown>;
  userAgent?: string | null;
}

// Events are tracked in the existing public.jobhackers_leads table.
// Unique key is (email, tag, stage) — upsert + bump `score` to count repeats.
export async function logEvent(e: CompassEvent): Promise<void> {
  if (!e.email) return; // jobhackers_leads.email is NOT NULL — skip anonymous
  const email = e.email;
  const tag = e.tag;
  const stage = e.stage ?? "activation";
  const firstName = e.firstName || (e.props?.firstName as string) || email.split("@")[0];
  const source = e.source ?? "compass";

  try {
    const existing = await pgSelect<{ id: string; score: number }>(
      "jobhackers_leads",
      { email: `eq.${email}`, tag: `eq.${tag}`, stage: `eq.${stage}` },
      "id,score"
    );

    if (existing.length) {
      await pgUpdate(
        "jobhackers_leads",
        { id: `eq.${existing[0].id}` },
        {
          score: (existing[0].score ?? 0) + 1,
          source,
          ...(e.archetype ? { archetype: e.archetype } : {}),
          ...(e.lastName ? { last_name: e.lastName } : {}),
        }
      );
    } else {
      await pgInsert("jobhackers_leads", {
        first_name: firstName,
        last_name: e.lastName ?? null,
        email,
        stage,
        tag,
        source,
        archetype: e.archetype ?? null,
        score: 1,
      });
    }
  } catch (err) {
    console.error("[jobhackers_leads] event upsert failed:", err);
  }
}
