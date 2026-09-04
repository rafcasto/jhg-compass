// Shared defaults for the in-app feedback survey. Imported by both the client
// hook (lib/firestore/feedback.ts) and the server helper (lib/server/feedback.ts),
// so it must stay free of "use client" / "server-only" directives.
import type { FeedbackConfig } from "./types";

export const DEFAULT_FEEDBACK_CONFIG: FeedbackConfig = {
  // OFF by default — an admin flips this on to request feedback from everyone.
  enabled: false,
  title: "We really value your feedback",
  intro:
    "Could you please take a few minutes to answer 4 important questions? It helps us make JobHacker Compass better for you.",
  submitLabel: "Send feedback",
  thanksTitle: "Thank you! 🙏",
  thanksBody: "Your feedback goes straight to the team and shapes what we build next.",
  questions: [
    {
      id: "rating",
      kind: "rating",
      prompt: "How would you rate this app?",
      required: true,
      emojis: ["😡", "😬", "😊", "😍"],
      scaleLabels: ["Poor", "Average", "Good", "Excellent"],
    },
    {
      id: "why",
      kind: "text",
      prompt: "And what made you choose this score? 🤔",
      placeholder:
        "1–3 lines max — don’t overthink this. Done is better than perfect ;-) Be as specific as you can…",
      required: true,
    },
    {
      id: "enjoyed",
      kind: "text",
      prompt: "What’s the #1 thing you enjoyed? 👍",
      placeholder:
        "1–3 lines max — don’t overthink this. Done is better than perfect ;-) Be as specific as you can…",
    },
    {
      id: "improve",
      kind: "text",
      prompt: "What’s the #1 thing you would improve? 👎 + 💡",
      placeholder:
        "1–3 lines max — don’t overthink this. Done is better than perfect ;-) Be as specific as you can…",
    },
  ],
};

// A stable, collision-resistant id for a newly added feedback question.
export function newFeedbackQuestionId(): string {
  return `q_${Math.random().toString(36).slice(2, 8)}`;
}
