"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useFunnel } from "@/lib/firestore/funnel";

const KEYS = ["A", "B", "C", "D", "E", "F"];

// Persisted between /quiz and /welcome.
export interface QuizDraft {
  answers: Record<string, string>;
  otherText: Record<string, string>;
  q6Text: string;
}

export default function QuizPage() {
  const { funnel } = useFunnel();
  const router = useRouter();
  const questions = funnel.quiz.questions;

  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [otherText, setOtherText] = useState<Record<string, string>>({});
  const [q6Text, setQ6Text] = useState("");
  // When the "Something else" option is picked, hold the question open for free text.
  const [otherOpen, setOtherOpen] = useState(false);

  const q = questions[i];
  const total = questions.length;
  const progress = useMemo(() => ((i + 1) / total) * 100, [i, total]);

  function finish(draft: QuizDraft) {
    try { sessionStorage.setItem("compass_quiz", JSON.stringify(draft)); } catch {}
    router.push("/welcome");
  }

  function advance(nextAnswers = answers, nextOther = otherText, nextQ6 = q6Text) {
    if (i < total - 1) {
      setOtherOpen(false);
      setI(i + 1);
    } else {
      finish({ answers: nextAnswers, otherText: nextOther, q6Text: nextQ6 });
    }
  }

  function pick(optId: string) {
    const opt = q.options?.find((o) => o.id === optId);
    const next = { ...answers, [q.id]: optId };
    setAnswers(next);
    if (opt?.isOther && q.allowOther) {
      setOtherOpen(true); // require free text before advancing
    } else {
      advance(next);
    }
  }

  function back() {
    if (otherOpen) { setOtherOpen(false); return; }
    if (i > 0) setI(i - 1);
  }

  const otherValue = otherText[q.id] ?? "";

  return (
    <main className="cq-root">
      <style>{CSS}</style>
      <div>
        <div className="cq-card">
          <div className="cq-brand"><div className="cq-brand__mark">🧭</div><div className="cq-brand__name">{funnel.landing.brandName} <span>{funnel.landing.brandAccent}</span></div></div>
          <div className="cq-progress"><i style={{ width: `${progress}%` }} /></div>
          <span className="cq-eyebrow">Question {i + 1} of {total}</span>
          <h1 className="cq-q">{q.prompt}</h1>
          {q.sub && <p className="cq-qsub">{q.sub}</p>}

          {/* ---- choice question ---- */}
          {q.kind === "choice" && !otherOpen && (
            <div className="cq-opts">
              {q.options?.map((o, idx) => (
                <button key={o.id} className="cq-opt" onClick={() => pick(o.id)}>
                  <span className="cq-k">{KEYS[idx]}</span><span>{o.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* ---- "Something else" free text ---- */}
          {q.kind === "choice" && otherOpen && (
            <div className="cq-other">
              <textarea
                className="cq-textarea"
                autoFocus
                placeholder="Tell us more — what's going on?"
                value={otherValue}
                onChange={(e) => setOtherText({ ...otherText, [q.id]: e.target.value })}
              />
              <button
                className="cq-continue"
                disabled={!otherValue.trim()}
                onClick={() => advance(answers, otherText)}
              >
                Continue →
              </button>
            </div>
          )}

          {/* ---- open-ended text question (Q6) ---- */}
          {q.kind === "text" && (
            <div className="cq-other">
              <textarea
                className="cq-textarea"
                autoFocus
                placeholder={q.placeholder ?? "Type your answer…"}
                value={q6Text}
                onChange={(e) => setQ6Text(e.target.value)}
              />
              <button className="cq-continue" onClick={() => advance(answers, otherText, q6Text)}>
                {q6Text.trim() ? "Continue →" : (q.required ? "Continue →" : "Skip →")}
              </button>
            </div>
          )}

          <div className="cq-foot">
            <button className="cq-back" onClick={back} disabled={i === 0 && !otherOpen}>← Back</button>
            <span>{funnel.quiz.footerNote}</span>
          </div>
        </div>
        <p className="cq-tagline">{funnel.landing.h1} {funnel.landing.h1accent}</p>
      </div>
    </main>
  );
}

const CSS = `
.cq-root{
  font-family:"Roboto","Helvetica Neue",Arial,sans-serif;color:#3a3f4d;min-height:100vh;
  background:#0e1019;
  background-image:
    radial-gradient(1px 1px at 16% 20%, rgba(255,255,255,.5) 50%, transparent),
    radial-gradient(1.4px 1.4px at 70% 14%, rgba(255,255,255,.45) 50%, transparent),
    radial-gradient(1px 1px at 40% 60%, rgba(255,255,255,.4) 50%, transparent),
    radial-gradient(1.5px 1.5px at 85% 70%, rgba(255,255,255,.4) 50%, transparent),
    radial-gradient(1px 1px at 22% 85%, rgba(255,255,255,.35) 50%, transparent),
    radial-gradient(1000px 640px at 50% -10%, #1c2030 0%, #0e1019 60%);
  display:flex;align-items:flex-start;justify-content:center;padding:56px 24px;
}
.cq-root h1{font-family:"Poppins",Arial,sans-serif;color:#191c27;margin:0;letter-spacing:-.02em;}
.cq-card{background:#fff;border-radius:28px;box-shadow:0 24px 70px rgba(0,0,0,.45);width:100%;max-width:620px;padding:44px 44px 40px;}
.cq-brand{display:flex;align-items:center;gap:10px;margin-bottom:22px;}
.cq-brand__mark{width:38px;height:38px;border-radius:11px;display:grid;place-items:center;background:#c2001f;color:#fff;font-size:20px;box-shadow:0 6px 18px rgba(194,0,31,.35);}
.cq-brand__name{font-family:"Poppins",Arial,sans-serif;font-weight:700;font-size:15px;color:#191c27;}
.cq-brand__name span{color:#c2001f;}
.cq-progress{height:7px;border-radius:99px;background:#e6e8ef;overflow:hidden;margin-bottom:26px;}
.cq-progress > i{display:block;height:100%;background:#c2001f;border-radius:99px;transition:width .35s cubic-bezier(.2,.7,.2,1);}
.cq-eyebrow{font-family:"Poppins",Arial,sans-serif;font-size:12px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:#c2001f;display:block;margin-bottom:10px;}
.cq-q{font-family:"Poppins",Arial,sans-serif;font-size:25px;font-weight:700;line-height:1.18;color:#191c27;margin:0 0 6px;}
.cq-qsub{font-size:14.5px;color:#6b7280;margin:0 0 22px;}
.cq-opts{display:grid;gap:12px;}
.cq-opt{display:flex;align-items:center;gap:14px;width:100%;text-align:left;background:#f3f5fa;border:1.5px solid #e6e8ef;border-radius:14px;padding:16px 18px;font-family:"Roboto",Arial,sans-serif;font-size:16px;color:#3a3f4d;cursor:pointer;transition:all .18s cubic-bezier(.2,.7,.2,1);}
.cq-opt:hover{border-color:#c2001f;background:#fff;transform:translateX(2px);box-shadow:0 8px 20px rgba(25,28,39,.08);}
.cq-k{flex:0 0 auto;width:28px;height:28px;border-radius:8px;background:#fff;border:1.5px solid #d4d8e2;display:grid;place-items:center;font-family:"Poppins",Arial,sans-serif;font-weight:700;font-size:13px;color:#c2001f;}
.cq-opt:hover .cq-k{background:#c2001f;color:#fff;border-color:#c2001f;}
.cq-other{display:grid;gap:14px;}
.cq-textarea{width:100%;min-height:120px;resize:vertical;border:1.5px solid #d4d8e2;border-radius:14px;padding:16px 18px;font-family:"Roboto",Arial,sans-serif;font-size:16px;color:#191c27;outline:none;transition:border .18s;}
.cq-textarea:focus{border-color:#c2001f;box-shadow:0 0 0 3px rgba(194,0,31,.12);}
.cq-continue{justify-self:start;font-family:"Poppins",Arial,sans-serif;font-weight:600;font-size:16px;color:#fff;background:#c2001f;border:0;border-radius:12px;padding:15px 30px;cursor:pointer;box-shadow:0 6px 18px rgba(194,0,31,.3);transition:all .2s cubic-bezier(.2,.7,.2,1);}
.cq-continue:hover{background:#8a0016;transform:translateY(-1px);}
.cq-continue:disabled{opacity:.4;cursor:default;transform:none;}
.cq-foot{margin-top:24px;display:flex;justify-content:space-between;align-items:center;font-size:13px;color:#9aa0ad;}
.cq-back{background:none;border:0;color:#6b7280;font-family:"Roboto",Arial,sans-serif;font-size:14px;cursor:pointer;padding:6px 4px;}
.cq-back:hover{color:#c2001f;}
.cq-back:disabled{opacity:.35;cursor:default;}
.cq-tagline{text-align:center;color:rgba(255,255,255,.45);font-size:12.5px;margin-top:22px;}
`;
