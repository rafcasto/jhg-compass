"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFunnel } from "@/lib/firestore/funnel";
import { buildInviteUrl } from "@/lib/funnel";
import type { QuizDraft } from "../quiz/page";

export default function WelcomePage() {
  const { funnel } = useFunnel();
  const router = useRouter();
  const L = funnel.lead;

  const [draft, setDraft] = useState<QuizDraft | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Quiz answers are required — if someone lands here cold, send them to the quiz.
  useEffect(() => {
    let parsed: QuizDraft | null = null;
    try {
      const raw = sessionStorage.getItem("compass_quiz");
      if (raw) parsed = JSON.parse(raw);
    } catch {}
    if (!parsed || !parsed.answers || Object.keys(parsed.answers).length === 0) {
      router.replace("/quiz");
      return;
    }
    setDraft(parsed);
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/quiz/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          answers: draft.answers,
          otherText: draft.otherText,
          q6Text: draft.q6Text,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError("Something went wrong. Please check your details and try again.");
        setBusy(false);
        return;
      }
      try { sessionStorage.removeItem("compass_quiz"); } catch {}
      const base = data.inviteUrl || funnel.inviteUrl;
      window.location.href = buildInviteUrl(base, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
      });
    } catch {
      setError("Network error. Please try again.");
      setBusy(false);
    }
  }

  if (!draft) {
    return <main className="ct-root"><span style={{ color: "rgba(255,255,255,.6)" }}>Loading…</span></main>;
  }

  return (
    <main className="ct-root">
      <style>{CSS}</style>
      <div>
        <div className="ct-card">
          <div className="ct-check">🧭</div>
          <span className="ct-eyebrow">{L.eyebrow}</span>
          <h1 className="ct-title">{L.title}</h1>
          <p className="ct-lede">{L.body}</p>

          <form className="ct-form" onSubmit={submit}>
            <div className="ct-row">
              <div className="ct-field">
                <label className="ct-label">{L.firstNameLabel}</label>
                <input className="ct-input" value={firstName} onChange={(e) => setFirstName(e.target.value)} required autoComplete="given-name" />
              </div>
              <div className="ct-field">
                <label className="ct-label">{L.lastNameLabel}</label>
                <input className="ct-input" value={lastName} onChange={(e) => setLastName(e.target.value)} required autoComplete="family-name" />
              </div>
            </div>
            <div className="ct-field">
              <label className="ct-label">{L.emailLabel}</label>
              <input className="ct-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </div>
            {error && <p className="ct-error">{error}</p>}
            <button className="ct-cta" type="submit" disabled={busy}>{busy ? "Setting up…" : L.ctaLabel}</button>
          </form>

          <p className="ct-fine">{L.fine}</p>
        </div>
        <p className="ct-tagline">{L.tagline}</p>
      </div>
    </main>
  );
}

const CSS = `
.ct-root{
  font-family:"Roboto","Helvetica Neue",Arial,sans-serif;color:#3a3f4d;min-height:100vh;
  background:#0e1019;
  background-image:
    radial-gradient(1px 1px at 16% 20%, rgba(255,255,255,.5) 50%, transparent),
    radial-gradient(1.4px 1.4px at 70% 14%, rgba(255,255,255,.45) 50%, transparent),
    radial-gradient(1px 1px at 40% 60%, rgba(255,255,255,.4) 50%, transparent),
    radial-gradient(1.5px 1.5px at 85% 70%, rgba(255,255,255,.4) 50%, transparent),
    radial-gradient(1px 1px at 22% 85%, rgba(255,255,255,.35) 50%, transparent),
    radial-gradient(1000px 640px at 50% -10%, #1c2030 0%, #0e1019 60%);
  display:flex;align-items:center;justify-content:center;padding:56px 24px;
}
.ct-root h1{font-family:"Poppins",Arial,sans-serif;color:#191c27;margin:0;letter-spacing:-.025em;}
.ct-card{background:#fff;border-radius:28px;box-shadow:0 24px 70px rgba(0,0,0,.45);width:100%;max-width:560px;padding:48px 44px 40px;text-align:center;}
.ct-check{width:74px;height:74px;border-radius:99px;background:#f6e0e3;color:#c2001f;display:grid;place-items:center;font-size:36px;margin:0 auto 24px;}
.ct-eyebrow{font-family:"Poppins",Arial,sans-serif;font-size:12px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:#c2001f;display:block;margin-bottom:12px;}
.ct-title{font-size:32px;font-weight:700;line-height:1.12;margin-bottom:12px;}
.ct-lede{font-size:16px;line-height:1.55;color:#3a3f4d;margin:0 0 26px;}
.ct-form{display:grid;gap:16px;text-align:left;}
.ct-row{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
.ct-label{display:block;font-family:"Poppins",Arial,sans-serif;font-weight:600;font-size:13px;color:#191c27;margin-bottom:6px;}
.ct-input{width:100%;border:1.5px solid #d4d8e2;border-radius:12px;padding:14px 16px;font-family:"Roboto",Arial,sans-serif;font-size:16px;color:#191c27;outline:none;transition:border .18s;}
.ct-input:focus{border-color:#c2001f;box-shadow:0 0 0 3px rgba(194,0,31,.12);}
.ct-error{color:#c2001f;font-size:14px;margin:0;}
.ct-cta{margin-top:6px;display:inline-flex;align-items:center;justify-content:center;gap:10px;font-family:"Poppins",Arial,sans-serif;font-weight:600;font-size:18px;color:#fff;background:#c2001f;border:0;border-radius:14px;padding:18px 28px;cursor:pointer;box-shadow:0 6px 18px rgba(194,0,31,.35);transition:all .22s cubic-bezier(.2,.7,.2,1);}
.ct-cta:hover{background:#8a0016;transform:translateY(-2px);box-shadow:0 10px 26px rgba(194,0,31,.4);}
.ct-cta:disabled{opacity:.6;cursor:default;transform:none;}
.ct-fine{margin-top:18px;font-size:13px;font-style:italic;color:#6b7280;text-align:center;}
.ct-tagline{text-align:center;color:rgba(255,255,255,.45);font-size:12.5px;margin-top:22px;}
@media (max-width:560px){ .ct-row{grid-template-columns:1fr;} .ct-card{padding:40px 26px;} }
`;
