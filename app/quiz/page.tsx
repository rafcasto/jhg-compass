"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useFunnel } from "@/lib/firestore/funnel";
import { useAuth } from "@/components/AuthProvider";

const KEYS = ["A", "B", "C", "D", "E", "F"];
type Phase = "loading" | "details" | "starting" | "questions" | "blocked";

export default function QuizPage() {
  const { funnel } = useFunnel();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const questions = funnel.quiz.questions;
  const D = funnel.details;

  const [phase, setPhase] = useState<Phase>("loading");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");

  // phase 2 — the quiz
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [otherText, setOtherText] = useState<Record<string, string>>({});
  const [q6Text, setQ6Text] = useState("");
  const [otherOpen, setOtherOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startedRef = useRef(false);

  const q = questions[i];
  const total = questions.length;
  const progress = useMemo(() => ((i + 1) / total) * 100, [i, total]);

  // Decide the entry point once auth resolves: registered users are bounced to
  // their Compass; details passed via query string skip the form automatically.
  useEffect(() => {
    if (authLoading || startedRef.current) return;
    startedRef.current = true;

    if (user) { router.replace("/compass"); return; } // already registered

    let qp = { firstName: "", lastName: "", email: "" };
    try {
      const sp = new URLSearchParams(window.location.search);
      qp = {
        firstName: sp.get("firstName") || "",
        lastName: sp.get("lastName") || "",
        email: sp.get("email") || "",
      };
    } catch {}
    if (qp.firstName) setFirstName(qp.firstName);
    if (qp.lastName) setLastName(qp.lastName);
    if (qp.email) setEmail(qp.email);

    if (qp.firstName && qp.lastName && qp.email) {
      void doStart(qp.firstName, qp.lastName, qp.email); // no form needed
    } else {
      setPhase("details");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  // Records the QUIZ_START event + runs the already-done / registered gate.
  async function doStart(fn: string, ln: string, em: string) {
    setPhase("starting"); setError(null);
    try {
      const res = await fetch("/api/quiz/start", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName: fn.trim(), lastName: ln.trim(), email: em.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (data?.blocked) { setPhase("blocked"); return; }
      if (!res.ok || !data.ok) { setError("Something went wrong. Please try again."); setPhase("details"); return; }
      setPhase("questions");
    } catch {
      setError("Network error. Please try again."); setPhase("details");
    }
  }

  function startQuiz(e: React.FormEvent) {
    e.preventDefault();
    void doStart(firstName, lastName, email);
  }

  async function finish(nextAnswers: Record<string, string>, nextOther: Record<string, string>, nextQ6: string) {
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/quiz/submit", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(),
          answers: nextAnswers, otherText: nextOther, q6Text: nextQ6,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) { setError("Something went wrong. Please try again."); setBusy(false); return; }
      try {
        sessionStorage.setItem("compass_lead", JSON.stringify({
          firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(),
          inviteUrl: data.inviteUrl || funnel.inviteUrl,
        }));
      } catch {}
      router.push("/welcome");
    } catch {
      setError("Network error. Please try again."); setBusy(false);
    }
  }

  function advance(nextAnswers = answers, nextOther = otherText, nextQ6 = q6Text) {
    if (i < total - 1) { setOtherOpen(false); setI(i + 1); }
    else finish(nextAnswers, nextOther, nextQ6);
  }

  function pick(optId: string) {
    const opt = q.options?.find((o) => o.id === optId);
    const next = { ...answers, [q.id]: optId };
    setAnswers(next);
    if (opt?.isOther && q.allowOther) setOtherOpen(true);
    else advance(next);
  }

  function back() {
    if (otherOpen) { setOtherOpen(false); return; }
    if (i > 0) setI(i - 1);
    else setPhase("details");
  }

  const otherValue = otherText[q?.id] ?? "";

  return (
    <main className="cq-root">
      <style>{CSS}</style>
      <div className="cq-topbar" />
      <div className="cq-shell">

        {(phase === "loading" || phase === "starting") && (
          <div className="cq-card cq-center"><span className="cq-muted">Loading…</span></div>
        )}

        {/* ---------- ALREADY DONE / REGISTERED ---------- */}
        {phase === "blocked" && (
          <div className="cq-card cq-center">
            <div className="cq-brand"><div className="cq-brand__mark">🧭</div><div className="cq-brand__name">{funnel.landing.brandName} <span>{funnel.landing.brandAccent}</span></div></div>
            <div className="cq-check">✓</div>
            <h1 className="cq-h1">{funnel.blocked.title}</h1>
            <p className="cq-lede">{funnel.blocked.body}</p>
            <a className="cq-submit cq-inline" href={funnel.blocked.ctaHref}>{funnel.blocked.ctaLabel}</a>
          </div>
        )}

        {/* ---------- PHASE 1 · PERSONAL DETAILS ---------- */}
        {phase === "details" && (
          <div className="cq-card">
            <div className="cq-brand"><div className="cq-brand__mark">🧭</div><div className="cq-brand__name">{funnel.landing.brandName} <span>{funnel.landing.brandAccent}</span></div></div>
            <span className="cq-eyebrow">{D.eyebrow}</span>
            <h1 className="cq-h1">{D.title}</h1>
            <p className="cq-lede">{D.lede}</p>
            <form onSubmit={startQuiz}>
              <div className="cq-field-row">
                <div className="cq-field"><label>{D.firstNameLabel}</label><input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Alex" required autoComplete="given-name" /></div>
                <div className="cq-field"><label>{D.lastNameLabel}</label><input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Rivera" required autoComplete="family-name" /></div>
              </div>
              <div className="cq-field"><label>{D.emailLabel}</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" required autoComplete="email" /></div>
              {error && <p className="cq-error">{error}</p>}
              <button className="cq-submit" type="submit">{D.submitLabel}</button>
              <p className="cq-consent">{D.consent}</p>
            </form>
          </div>
        )}

        {/* ---------- PHASE 2 · QUIZ ---------- */}
        {phase === "questions" && q && (
          <div className="cq-card">
            <div className="cq-brand"><div className="cq-brand__mark">🧭</div><div className="cq-brand__name">{funnel.landing.brandName} <span>{funnel.landing.brandAccent}</span></div></div>
            <div className="cq-progress"><i style={{ width: `${progress}%` }} /></div>
            <span className="cq-eyebrow">Question {i + 1} of {total}</span>
            <h1 className="cq-q">{q.prompt}</h1>

            {q.kind === "choice" && !otherOpen && (
              <div className="cq-opts">
                {q.options?.map((o, idx) => (
                  <button key={o.id} className="cq-opt" disabled={busy} onClick={() => pick(o.id)}>
                    <span className="cq-k">{KEYS[idx]}</span><span>{o.label}</span>
                  </button>
                ))}
              </div>
            )}

            {q.kind === "choice" && otherOpen && (
              <div className="cq-other">
                <textarea className="cq-textarea" autoFocus placeholder="Tell us more — what's going on?"
                  value={otherValue} onChange={(e) => setOtherText({ ...otherText, [q.id]: e.target.value })} />
                <button className="cq-continue" disabled={!otherValue.trim() || busy} onClick={() => advance(answers, otherText)}>Continue →</button>
              </div>
            )}

            {q.kind === "text" && (
              <div className="cq-other">
                <textarea className="cq-textarea" autoFocus placeholder={q.placeholder ?? "Type your answer…"}
                  value={q6Text} onChange={(e) => setQ6Text(e.target.value)} />
                <button className="cq-continue" disabled={busy} onClick={() => advance(answers, otherText, q6Text)}>
                  {busy ? "Finishing…" : (q6Text.trim() || q.required ? "Continue →" : "Skip →")}
                </button>
              </div>
            )}

            {error && <p className="cq-error">{error}</p>}

            <div className="cq-foot">
              <button className="cq-back" onClick={back} disabled={busy}>← Back</button>
              <span>{funnel.quiz.footerNote}</span>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

const CSS = `
.cq-root{font-family:"Roboto","Helvetica Neue",Arial,sans-serif;color:#3a3f4d;background:#f5f6fa;min-height:100vh;-webkit-font-smoothing:antialiased;}
.cq-root h1{font-family:"Poppins",Arial,sans-serif;color:#191c27;margin:0;letter-spacing:-.025em;}
.cq-topbar{height:5px;background:#c2001f;}
.cq-shell{display:flex;align-items:flex-start;justify-content:center;padding:48px 24px 56px;min-height:calc(100vh - 5px);}
.cq-card{background:#fff;border:1px solid #e9ebf1;border-radius:24px;box-shadow:0 18px 50px rgba(25,28,39,.10);width:100%;max-width:560px;padding:46px 46px 40px;}
.cq-center{text-align:center;}
.cq-muted{color:#9aa0ad;}
.cq-check{width:58px;height:58px;border-radius:99px;background:#f6e0e3;color:#c2001f;display:grid;place-items:center;font-size:27px;margin:6px auto 20px;}
.cq-brand{display:inline-flex;align-items:center;gap:10px;margin-bottom:24px;}
.cq-brand__mark{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:#c2001f;color:#fff;font-size:18px;}
.cq-brand__name{font-family:"Poppins",Arial,sans-serif;font-weight:700;font-size:14px;color:#191c27;}
.cq-brand__name span{color:#c2001f;}
.cq-eyebrow{font-family:"Poppins",Arial,sans-serif;font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:#c2001f;display:block;margin-bottom:12px;}
.cq-h1{font-size:30px;font-weight:700;line-height:1.16;margin-bottom:12px;}
.cq-lede{font-size:16px;line-height:1.6;color:#6b7280;margin:0 0 28px;}
.cq-field{margin-bottom:15px;}
.cq-field-row{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
.cq-field label{display:block;font-family:"Poppins",Arial,sans-serif;font-size:12.5px;font-weight:600;color:#191c27;margin-bottom:7px;}
.cq-field input{width:100%;font-family:"Roboto",Arial,sans-serif;font-size:16px;padding:14px 16px;border:1.5px solid #d4d8e2;border-radius:11px;background:#fff;outline:none;transition:border .17s,box-shadow .17s;}
.cq-field input:focus{border-color:#c2001f;box-shadow:0 0 0 4px rgba(194,0,31,.12);}
.cq-submit{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;font-family:"Poppins",Arial,sans-serif;font-weight:600;font-size:15px;letter-spacing:.02em;text-transform:uppercase;color:#fff;background:#c2001f;border:0;border-radius:99px;padding:18px;cursor:pointer;box-shadow:0 10px 26px rgba(194,0,31,.3);transition:all .22s cubic-bezier(.2,.7,.2,1);margin-top:6px;text-decoration:none;}
.cq-submit:hover{background:#8a0016;transform:translateY(-2px);}
.cq-inline{max-width:280px;margin-left:auto;margin-right:auto;}
.cq-consent{font-size:12.5px;color:#9aa0ad;margin-top:14px;text-align:center;}
.cq-progress{height:7px;border-radius:99px;background:#e9ebf1;overflow:hidden;margin-bottom:22px;}
.cq-progress > i{display:block;height:100%;background:#c2001f;border-radius:99px;transition:width .35s cubic-bezier(.2,.7,.2,1);}
.cq-q{font-size:26px;font-weight:700;line-height:1.18;color:#191c27;margin:0 0 22px;}
.cq-opts{display:grid;gap:12px;}
.cq-opt{display:flex;align-items:center;gap:14px;width:100%;text-align:left;background:#f5f6fa;border:1.5px solid #e9ebf1;border-radius:14px;padding:16px 18px;font-family:"Roboto",Arial,sans-serif;font-size:16px;color:#3a3f4d;cursor:pointer;transition:all .18s cubic-bezier(.2,.7,.2,1);}
.cq-opt:hover{border-color:#c2001f;background:#fff;transform:translateX(2px);box-shadow:0 8px 20px rgba(25,28,39,.08);}
.cq-opt:disabled{opacity:.6;cursor:default;}
.cq-k{flex:0 0 auto;width:28px;height:28px;border-radius:8px;background:#fff;border:1.5px solid #d4d8e2;display:grid;place-items:center;font-family:"Poppins",Arial,sans-serif;font-weight:700;font-size:13px;color:#c2001f;}
.cq-opt:hover .cq-k{background:#c2001f;color:#fff;border-color:#c2001f;}
.cq-other{display:grid;gap:14px;}
.cq-textarea{width:100%;min-height:120px;resize:vertical;border:1.5px solid #d4d8e2;border-radius:14px;padding:16px 18px;font-family:"Roboto",Arial,sans-serif;font-size:16px;color:#191c27;outline:none;transition:border .18s;}
.cq-textarea:focus{border-color:#c2001f;box-shadow:0 0 0 4px rgba(194,0,31,.12);}
.cq-continue{justify-self:start;font-family:"Poppins",Arial,sans-serif;font-weight:600;font-size:15px;text-transform:uppercase;letter-spacing:.02em;color:#fff;background:#c2001f;border:0;border-radius:99px;padding:15px 32px;cursor:pointer;box-shadow:0 10px 26px rgba(194,0,31,.3);transition:all .2s cubic-bezier(.2,.7,.2,1);}
.cq-continue:hover{background:#8a0016;transform:translateY(-2px);}
.cq-continue:disabled{opacity:.4;cursor:default;transform:none;}
.cq-error{color:#c2001f;font-size:14px;margin:16px 0 0;}
.cq-foot{margin-top:24px;display:flex;justify-content:space-between;align-items:center;font-size:13px;color:#9aa0ad;}
.cq-back{background:none;border:0;color:#6b7280;font-family:"Roboto",Arial,sans-serif;font-size:14px;cursor:pointer;padding:6px 4px;}
.cq-back:hover{color:#c2001f;}
.cq-back:disabled{opacity:.35;cursor:default;}
@media (max-width:480px){ .cq-field-row{grid-template-columns:1fr;} .cq-card{padding:38px 26px;} }
`;
