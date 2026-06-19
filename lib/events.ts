import "server-only";
import { pgSelect, pgInsert, pgUpdate } from "./supabaseServer";
import { TAGS, type EventKey, type EventStage } from "./tags";
import { getEventConfig } from "./server/eventConfig";

export { TAGS };
export type { EventStage };

export interface LogInput {
  key: EventKey;                 // stable event key (from TAGS)
  firebaseUid?: string | null;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  archetype?: string | null;
  stage?: EventStage;            // optional override; otherwise config default
  source?: string;
  props?: Record<string, unknown>;
  userAgent?: string | null;
}

// Tracked in the existing public.jobhackers_leads table.
// Unique key is (email, tag, stage) — upsert + bump `score` to count repeats.
// Honours the admin event config: disabled events are skipped, tag can be renamed.
export async function logEvent(e: LogInput): Promise<void> {
  if (!e.email) return; // jobhackers_leads.email is NOT NULL — skip anonymous

  let setting;
  try {
    const cfg = await getEventConfig();
    setting = cfg[e.key];
  } catch { return; }
  if (!setting || !setting.enabled) return; // admin switched this event off

  const email = e.email;
  const tag = setting.tag;                       // admin-renamable
  const stage = e.stage ?? setting.stage;
  const firstName = e.firstName || (e.props?.firstName as string) || email.split("@")[0];
  const source = e.source ?? "compass";

  try {
    const existing = await pgSelect<{ id: string; score: number }>(
      "jobhackers_leads",
      { email: `eq.${email}`, tag: `eq.${tag}`, stage: `eq.${stage}` },
      "id,score"
    );
    if (existing.length) {
      await pgUpdate("jobhackers_leads", { id: `eq.${existing[0].id}` }, {
        score: (existing[0].score ?? 0) + 1,
        source,
        ...(e.archetype ? { archetype: e.archetype } : {}),
        ...(e.lastName ? { last_name: e.lastName } : {}),
      });
    } else {
      await pgInsert("jobhackers_leads", {
        first_name: firstName,
        last_name: e.lastName ?? null,
        email, stage, tag, source,
        archetype: e.archetype ?? null,
        score: 1,
      });
    }
  } catch (err) {
    console.error("[jobhackers_leads] event upsert failed:", err);
  }
}
