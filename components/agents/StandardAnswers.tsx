"use client";

import { useEffect, useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { paths, useLiveCollection } from "@/lib/firestore/db";
import { STANDARD_ANSWERS, standardId, type CareerOpsAnswer } from "@/lib/careerops/answers";

// Setup → Standard answers: the facts every form asks and the model must never guess. Answered once,
// reused on every application (the Apply screen fills them in and marks them "from your standard answers").
export default function StandardAnswers({ uid }: { uid: string }) {
  const { data: bank } = useLiveCollection<CareerOpsAnswer>(uid, paths.careerOpsAnswers);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<string | null>(null);
  useEffect(() => { setDraft((d) => { const n = { ...d }; for (const s of STANDARD_ANSWERS) { const v = bank.find((a) => a.id === standardId(s.key))?.answer; if (v != null && n[s.key] === undefined) n[s.key] = v; } return n; }); }, [bank]);

  async function save(key: string, label: string) {
    const answer = (draft[key] ?? "").trim();
    const cur = bank.find((a) => a.id === standardId(key))?.answer ?? "";
    if (answer === cur) return;
    await setDoc(doc(paths.careerOpsAnswers(uid), standardId(key)), { question: label, key: label.toLowerCase(), answer, source: "standard", standardKey: key, updatedAt: Date.now() }, { merge: true });
    setSaved(key); setTimeout(() => setSaved((k) => (k === key ? null : k)), 1500);
  }
  const filled = STANDARD_ANSWERS.filter((s) => (bank.find((a) => a.id === standardId(s.key))?.answer ?? "").trim()).length;

  return (
    <div className="space-y-2">
      <p className="text-xs text-jh-mute">{filled}/{STANDARD_ANSWERS.length} answered · saved as you leave each field</p>
      <div className="grid sm:grid-cols-2 gap-2">
        {STANDARD_ANSWERS.map((s) => (
          <label key={s.key} className="block">
            <span className="text-xs text-jh-mute">{s.label}{saved === s.key && <span className="text-rb-green-dark"> · saved</span>}</span>
            <input aria-label={s.label} className="field text-sm" placeholder={s.placeholder} value={draft[s.key] ?? ""} onChange={(e) => setDraft((d) => ({ ...d, [s.key]: e.target.value }))} onBlur={() => save(s.key, s.label)} maxLength={600} />
          </label>
        ))}
      </div>
    </div>
  );
}
