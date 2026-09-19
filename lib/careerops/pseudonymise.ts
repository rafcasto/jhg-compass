// Strip direct identifiers before a live member's text enters a training set.
// Mirrors careerops-worker/lib/training.js pseudonymise(). Pure — tested.
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function pseudonymise(text: string, { name = "", email = "" }: { name?: string; email?: string } = {}): string {
  let t = String(text ?? "");
  const n = name.trim();
  const parts = n.split(/\s+/).filter((p) => p.length > 1);
  if (n) t = t.replace(new RegExp(esc(n), "gi"), "Alex Candidate");
  parts.forEach((p, i) => { t = t.replace(new RegExp(`\\b${esc(p)}\\b`, "g"), i === 0 ? "Alex" : "Candidate"); });
  if (email) t = t.split(email).join("candidate@example.com");
  t = t.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "candidate@example.com");
  t = t.replace(/\+?\d[\d\s().-]{7,}\d/g, "+64 21 000 0000");
  t = t.replace(/https?:\/\/\S+|(?:www\.|linkedin\.com\/|github\.com\/)\S+/gi, "https://example.com/profile");
  return t;
}
