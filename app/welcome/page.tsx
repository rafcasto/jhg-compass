"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFunnel } from "@/lib/firestore/funnel";
import { buildInviteUrl } from "@/lib/funnel";

interface Lead { firstName: string; lastName: string; email: string; inviteUrl: string; }

export default function WelcomePage() {
  const { funnel } = useFunnel();
  const router = useRouter();
  const L = funnel.lead;
  const [lead, setLead] = useState<Lead | null>(null);

  // The lead is captured at the end of the quiz; if someone lands here cold,
  // send them back to start.
  useEffect(() => {
    let parsed: Lead | null = null;
    try {
      const raw = sessionStorage.getItem("compass_lead");
      if (raw) parsed = JSON.parse(raw);
    } catch {}
    if (!parsed || !parsed.email) { router.replace("/quiz"); return; }
    setLead(parsed);
  }, [router]);

  function toRegistration() {
    if (!lead) return;
    const base = lead.inviteUrl || funnel.inviteUrl;
    window.location.href = buildInviteUrl(base, lead);
  }

  if (!lead) return <main className="ct-root"><div className="ct-topbar" /></main>;

  const headline = lead.firstName
    ? L.title.replace(/^You're almost in\./, `You're almost in, ${lead.firstName}.`)
    : L.title;

  return (
    <main className="ct-root">
      <style>{CSS}</style>
      <div className="ct-topbar" />
      <div className="ct-shell">
        <div className="ct-card">
          <div className="ct-brand"><div className="ct-brand__mark">🧭</div><div className="ct-brand__name">{funnel.landing.brandName} <span>{funnel.landing.brandAccent}</span></div></div>
          <div className="ct-check">🧭</div>
          <span className="ct-eyebrow">{L.eyebrow}</span>
          <h1 className="ct-h1">{headline}</h1>
          <p className="ct-lede">{L.body}</p>
          <button className="ct-cta" onClick={toRegistration}>{L.ctaLabel}</button>
          <p className="ct-fine">{L.fine}</p>
        </div>
      </div>
    </main>
  );
}

const CSS = `
.ct-root{font-family:"Roboto","Helvetica Neue",Arial,sans-serif;color:#3a3f4d;background:#f5f6fa;min-height:100vh;-webkit-font-smoothing:antialiased;}
.ct-root h1{font-family:"Poppins",Arial,sans-serif;color:#191c27;margin:0;letter-spacing:-.025em;}
.ct-topbar{height:5px;background:#c2001f;}
.ct-shell{display:flex;align-items:center;justify-content:center;padding:48px 24px 56px;min-height:calc(100vh - 5px);}
.ct-card{background:#fff;border:1px solid #e9ebf1;border-radius:24px;box-shadow:0 18px 50px rgba(25,28,39,.10);width:100%;max-width:540px;padding:46px 46px 42px;text-align:center;}
.ct-brand{display:inline-flex;align-items:center;gap:10px;margin-bottom:26px;}
.ct-brand__mark{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:#c2001f;color:#fff;font-size:18px;}
.ct-brand__name{font-family:"Poppins",Arial,sans-serif;font-weight:700;font-size:14px;color:#191c27;}
.ct-brand__name span{color:#c2001f;}
.ct-check{width:58px;height:58px;border-radius:99px;background:#f6e0e3;color:#c2001f;display:grid;place-items:center;font-size:27px;margin:0 auto 22px;}
.ct-eyebrow{font-family:"Poppins",Arial,sans-serif;font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:#c2001f;display:block;margin-bottom:12px;}
.ct-h1{font-size:30px;font-weight:700;line-height:1.16;margin-bottom:14px;}
.ct-lede{font-size:16.5px;line-height:1.6;color:#3a3f4d;margin:0 auto 30px;max-width:30em;}
.ct-cta{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;font-family:"Poppins",Arial,sans-serif;font-weight:600;font-size:15px;letter-spacing:.02em;text-transform:uppercase;color:#fff;background:#c2001f;border:0;border-radius:99px;padding:18px;text-decoration:none;cursor:pointer;box-shadow:0 10px 26px rgba(194,0,31,.3);transition:all .22s cubic-bezier(.2,.7,.2,1);}
.ct-cta:hover{background:#8a0016;transform:translateY(-2px);box-shadow:0 14px 32px rgba(194,0,31,.36);}
.ct-fine{margin-top:16px;font-size:13px;color:#9aa0ad;}
`;
