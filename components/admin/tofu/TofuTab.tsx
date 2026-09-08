"use client";

import { useEffect, useState } from "react";
import { Megaphone } from "lucide-react";
import { DEFAULT_FUNNEL, type FunnelConfig } from "@/lib/funnel";
import { authed, postJson, Loading, SaveBar, SubTabs, TabHeader, type Notice } from "@/components/admin/shared";
import { TOFU_SUBTABS, type TofuSub } from "@/components/admin/nav";
import LandingEditor from "./LandingEditor";
import QuizEditor from "./QuizEditor";
import OnboardingEditor from "./OnboardingEditor";
import RegistrationAccess from "./RegistrationAccess";

// Top Of the FUnnel — everything a prospect meets BEFORE they are a member:
// landing page → details → quiz → thank-you → registration link → sign-in →
// onboarding. The landing + quiz editors share one funnel document (config/funnel),
// so their state lives here and one Save bar publishes both.
export default function TofuTab({ sub, onSub }: { sub: TofuSub; onSub: (s: TofuSub) => void }) {
  const [funnel, setFunnel] = useState<FunnelConfig | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    authed("/api/admin/funnel").then((r) => r.json())
      .then((d) => (d.ok ? setFunnel(d.funnel) : setLoadError(true)))
      .catch(() => setLoadError(true));
  }, []);

  function patch(fn: (f: FunnelConfig) => FunnelConfig) {
    setFunnel((f) => (f ? fn(f) : f)); setDirty(true); setNotice(null);
  }

  async function save(next?: FunnelConfig) {
    const body = next ?? funnel;
    if (!body) return;
    setBusy(true); setNotice(null);
    try {
      const r = await postJson("/api/admin/funnel", { funnel: body });
      const d = await r.json();
      if (d.ok) { setFunnel(d.funnel); setDirty(false); setNotice({ kind: "ok", text: "Saved — live on the public pages now." }); }
      else setNotice({ kind: "err", text: "Save failed." });
    } catch { setNotice({ kind: "err", text: "Save failed." }); }
    finally { setBusy(false); }
  }

  function resetDefaults() {
    if (confirm("Reset the whole funnel (landing, details, quiz, thank-you, expired) to the built-in defaults? Applied when you Save.")) {
      patch(() => structuredClone(DEFAULT_FUNNEL));
    }
  }

  const funnelSub = sub === "landing" || sub === "quiz";

  return (
    <div className="space-y-6">
      <TabHeader icon={Megaphone} title="Top of the funnel"
        intro="Everything a prospect meets before they&apos;re a member. Landing page and quiz share one document — save once, both go live."
        actions={funnelSub ? <button type="button" onClick={resetDefaults} className="btn-secondary text-xs px-3 py-2 whitespace-nowrap">Reset funnel to defaults</button> : undefined} />
      <SubTabs items={TOFU_SUBTABS} value={sub} onChange={onSub} ariaLabel="Top-of-funnel sections" />

      {funnelSub && (
        loadError ? <p className="text-jh-red">Couldn&apos;t load the funnel.</p>
        : !funnel ? <Loading>Loading funnel…</Loading>
        : (
          <>
            {sub === "landing" && <LandingEditor funnel={funnel} patch={patch} />}
            {sub === "quiz" && <QuizEditor funnel={funnel} patch={patch} />}
            <SaveBar onSave={() => save()} busy={busy} dirty={dirty} notice={notice} label="Save funnel"
              audit={<>Stored at <code className="font-mono">config/funnel</code> · read by the landing, details, quiz and thank-you pages</>} />
          </>
        )
      )}

      {sub === "registration" && (
        <RegistrationAccess
          inviteUrl={funnel?.inviteUrl ?? ""}
          onUseAsInvite={funnel ? async (url) => { const next = { ...funnel, inviteUrl: url }; setFunnel(next); await save(next); } : undefined}
        />
      )}
      {sub === "onboarding" && <OnboardingEditor />}
    </div>
  );
}
