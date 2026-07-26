"use client";

import { useMemo, useState } from "react";
import { MessageSquareHeart } from "lucide-react";
import { addDoc, paths } from "@/lib/firestore/db";
import { useAuth } from "@/components/AuthProvider";
import type { FeedbackConfig, FeedbackResponse } from "@/lib/types";
import type { Profile } from "@/lib/types";

// Blocking feedback survey — mirrors the Paywall pattern (same overlay + card),
// but it only disappears once the user SUBMITS. The expired-access Paywall is
// rendered ahead of this, so expiry always takes precedence.
export default function FeedbackModal({
  cfg, uid, profile, source, onDone,
}: {
  cfg: FeedbackConfig;
  uid: string;
  profile: Profile | null;
  source: "global" | "link";
  onDone: () => void;
}) {
  const { user, signOut } = useAuth();
  const [answers, setAnswers] = useState<Record<string, string | number>>({});
  const [busy, setBusy] = useState(false);
  const [thanks, setThanks] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const firstRatingId = useMemo(
    () => cfg.questions.find((q) => q.kind === "rating")?.id,
    [cfg.questions]
  );

  function setAnswer(id: string, value: string | number) {
    setAnswers((a) => ({ ...a, [id]: value }));
    setError(null);
  }

  function missingRequired(): string | null {
    for (const q of cfg.questions) {
      if (!q.required) continue;
      const v = answers[q.id];
      if (v === undefined || v === null || (typeof v === "string" && !v.trim())) {
        return q.kind === "rating" ? "Please pick a rating." : `Please answer: “${q.prompt}”`;
      }
    }
    return null;
  }

  async function submit() {
    const miss = missingRequired();
    if (miss) { setError(miss); return; }
    setBusy(true); setError(null);
    const rating = firstRatingId ? Number(answers[firstRatingId]) : null;
    const payload: FeedbackResponse = {
      uid,
      email: user?.email ?? profile?.email ?? undefined,
      firstName: profile?.firstName ?? undefined,
      rating: Number.isFinite(rating as number) ? (rating as number) : null,
      answers,
      source,
      createdAt: Date.now(),
    };
    try {
      await addDoc(paths.feedbackResponses(uid), payload as unknown as Record<string, unknown>);
      setThanks(true);
    } catch {
      setError("Couldn’t send your feedback. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-jh-ink/70 backdrop-blur-sm p-4">
      <div className="card max-w-lg w-full p-8 text-center max-h-[92vh] overflow-y-auto">
        <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full bg-jh-red-soft">
          <MessageSquareHeart className="h-7 w-7 text-jh-red" />
        </div>

        {thanks ? (
          <>
            <h2 className="mb-3">{cfg.thanksTitle}</h2>
            <p className="text-jh-mute mb-7">{cfg.thanksBody}</p>
            <button onClick={onDone} className="btn-primary w-full">Done</button>
          </>
        ) : (
          <>
            <h2 className="mb-2">🎙️ {cfg.title}</h2>
            <p className="text-jh-mute mb-6">{cfg.intro}</p>

            <div className="space-y-6 text-left">
              {cfg.questions.map((q) => (
                <div key={q.id}>
                  <label className="label !text-jh-ink !text-sm mb-2 block">
                    {q.prompt}{q.required && <span className="text-jh-red"> *</span>}
                  </label>

                  {q.kind === "rating" ? (
                    <div className="flex flex-wrap gap-2">
                      {(q.emojis?.length ? q.emojis : ["1", "2", "3", "4"]).map((emoji, i) => {
                        const val = i + 1;
                        const active = answers[q.id] === val;
                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setAnswer(q.id, val)}
                            className={`flex-1 min-w-16 rounded-[12px] border px-2 py-3 transition ${
                              active
                                ? "border-jh-red bg-jh-red-soft"
                                : "border-jh-line hover:border-jh-red/50 hover:bg-jh-mist"
                            }`}
                            aria-pressed={active}
                          >
                            <span className="block text-2xl leading-none">{emoji}</span>
                            <span className="block text-[11px] text-jh-mute mt-1">
                              {q.scaleLabels?.[i] ?? val}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <textarea
                      className="field min-h-20"
                      value={(answers[q.id] as string) ?? ""}
                      onChange={(e) => setAnswer(q.id, e.target.value)}
                      placeholder={q.placeholder}
                    />
                  )}
                </div>
              ))}
            </div>

            {error && <p className="text-jh-red text-sm mt-4 text-left">{error}</p>}

            <button onClick={submit} disabled={busy} className="btn-primary w-full mt-7 disabled:opacity-60">
              {busy ? "Sending…" : cfg.submitLabel}
            </button>
            <button onClick={() => signOut()} className="btn-ghost mt-3 w-full text-sm">
              Sign out
            </button>
          </>
        )}
      </div>
    </div>
  );
}
