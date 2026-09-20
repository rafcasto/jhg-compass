// Answer bank (users/{uid}/careerOpsAnswers) — what the member already said on other forms.
// Mirrors careerops-worker lib/answers.js: same normalisation, same standard-answer keys.
export interface CareerOpsAnswer {
  id: string;
  question: string;
  key: string;                       // normalised question
  answer: string;
  source: "you" | "standard" | "drafted";
  standardKey?: string | null;       // one of STANDARD_ANSWERS keys when it is a standard answer
  company?: string | null;
  reportJobId?: string | null;
  usedAt?: number[];
  lastUsedAt?: number;
  updatedAt: number;
}

export function normalizeQuestion(q: string): string {
  return String(q ?? "").toLowerCase()
    .replace(/^\s*(\d+[.)]|[-*•])\s*/, "")
    .replace(/\s*(\*|\(required\)|\(optional\)|required|optional)\s*$/i, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}
// Same id for the same question wherever it is asked (sha1 of the normalised text, 20 hex chars).
export async function questionId(q: string): Promise<string> {
  const data = new TextEncoder().encode(normalizeQuestion(q));
  const buf = await crypto.subtle.digest("SHA-1", data);
  return "q_" + Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 20);
}
export const standardId = (key: string) => `standard_${key}`;

// Keep keys and order in step with the worker.
export const STANDARD_ANSWERS: { key: string; label: string; placeholder: string }[] = [
  { key: "right_to_work",    label: "Right to work",                    placeholder: "NZ citizen — no restrictions" },
  { key: "sponsorship",      label: "Visa sponsorship",                 placeholder: "Not required" },
  { key: "salary",           label: "Salary expectation",               placeholder: "$150–170k base, flexible for the right role" },
  { key: "notice_period",    label: "Notice period",                    placeholder: "4 weeks" },
  { key: "start_date",       label: "Earliest start date",              placeholder: "4 weeks from offer" },
  { key: "location",         label: "Where you are based",              placeholder: "Auckland" },
  { key: "work_arrangement", label: "Remote / hybrid / on-site preference", placeholder: "Hybrid, 2–3 days in the office" },
  { key: "relocation",       label: "Willing to relocate",              placeholder: "Within NZ, yes" },
  { key: "drivers_licence",  label: "Driver's licence",                 placeholder: "Full NZ licence" },
  { key: "background_check", label: "Background / police check",        placeholder: "Happy to undergo one" },
  { key: "how_heard",        label: "How you heard about the role",     placeholder: "Company careers page" },
];
export const standardLabel = (key: string) => STANDARD_ANSWERS.find((s) => s.key === key)?.label ?? key;
