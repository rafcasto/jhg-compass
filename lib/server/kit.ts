import "server-only";

// Kit (formerly ConvertKit) marketing-email integration.
//
// Purpose: when someone registers into the app, enroll them into the Compass
// onboarding email sequence automatically. Registration must NEVER fail because
// Kit is unreachable, so every function here is non-throwing and returns a
// result object instead. Callers log the outcome and move on.

const KIT_API = "https://api.kit.com/v4";

// The "JHG Compass Onboarding — Get Your Bearings (5-day + bonus)" sequence.
// Override per environment via KIT_COMPASS_SEQUENCE_ID.
const COMPASS_SEQUENCE_ID = process.env.KIT_COMPASS_SEQUENCE_ID ?? "2830637";

export interface KitResult {
  ok: boolean;
  skipped?: boolean;         // no API key configured — feature disabled
  subscriberId?: number;
  error?: string;
}

function apiKey(): string | null {
  return process.env.KIT_API_KEY?.trim() || null;
}

async function kitFetch(
  path: string,
  body: Record<string, unknown>,
  key: string
): Promise<{ ok: boolean; status: number; json: any }> {
  const res = await fetch(`${KIT_API}${path}`, {
    method: "POST",
    headers: {
      "X-Kit-Api-Key": key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    // Never let a slow Kit response hang a signup.
    signal: AbortSignal.timeout(10_000),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
}

/**
 * Enroll a person into the Compass onboarding sequence.
 *
 * Two steps, mirroring the confirmed Kit v4 flow:
 *  1. Upsert the subscriber (creates them, or returns the existing record).
 *  2. Add that subscriber to the sequence, which starts the drip immediately.
 *
 * Idempotent: re-running for the same email is a no-op on Kit's side.
 * Returns { ok:false, skipped:true } when KIT_API_KEY isn't set so local/dev
 * environments silently no-op instead of erroring.
 */
export async function enrollInCompassSequence(
  email: string,
  firstName?: string | null
): Promise<KitResult> {
  const key = apiKey();
  if (!key) return { ok: false, skipped: true };

  try {
    // 1. Upsert the subscriber.
    const create = await kitFetch(
      "/subscribers",
      { email_address: email, first_name: firstName ?? undefined },
      key
    );
    if (!create.ok) {
      return { ok: false, error: `subscriber_upsert_${create.status}` };
    }
    const subscriberId: number | undefined = create.json?.subscriber?.id;

    // 2. Add the subscriber to the Compass sequence (starts the emails).
    const enroll = await kitFetch(
      `/sequences/${COMPASS_SEQUENCE_ID}/subscribers`,
      { email_address: email },
      key
    );
    if (!enroll.ok) {
      return { ok: false, subscriberId, error: `sequence_add_${enroll.status}` };
    }

    return { ok: true, subscriberId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "kit_request_failed" };
  }
}
