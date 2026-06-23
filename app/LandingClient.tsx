"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { useFunnel } from "@/lib/firestore/funnel";
import type { CountdownConfig, FunnelConfig } from "@/lib/funnel";

// Public marketing landing — a single-viewport split hero: everything the visitor
// needs (value prop, what-you-get, CTA, countdown, proof + the product) sits above
// the fold, no scrolling required. Logged-in users are bounced to /compass.
export default function LandingClient({ funnel: initial }: { funnel: FunnelConfig }) {
  const { user, loading } = useAuth();
  const { funnel } = useFunnel(initial);
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace("/compass");
  }, [user, loading, router]);

  // SSR already painted the correct content; only blank out once we know the
  // visitor is signed in (the effect above redirects them to /compass).
  if (!loading && user) return null;

  const L = funnel.landing;

  return (
    <main className="cl-root">
      <style>{CSS}</style>
      <div className="cl-topbar" />

      <div className="cl-stage">
        <header className="cl-head">
          <div className="cl-head__tag"><span className="cl-dot" />{L.headTag}</div>
          <div className="cl-head__logo"><span className="cl-m">🧭</span>{L.brandName} <span>{L.brandAccent}</span></div>
        </header>

        <div className="cl-hero2">
          {/* ---- Left: persuasion + CTA ---- */}
          <div className="cl-copy">
            <h1 className="cl-h1">{L.heroH1} <span className="cl-accent">{L.heroH1Accent}</span></h1>
            <p className="cl-sub">{L.heroSub}</p>

            <div className="cl-getlabel">{L.getEyebrow}</div>
            <ul className="cl-bullets">
              {L.cards.map((c, i) => (
                <li className="cl-bullet" key={i}>
                  <span className="cl-bullet__i">✓</span>
                  <span><b>{c.title}</b></span>
                </li>
              ))}
            </ul>

            <div className="cl-actions">
              <Link className="cl-cta" href="/quiz">{L.ctaLabel}</Link>
              <Countdown config={funnel.countdown} label={L.countdownLabel} />
            </div>
            <div className="cl-proofrow">{L.proofrow}</div>
          </div>

          {/* ---- Right: product (iPhone — Performance screen) ---- */}
          <div className="cl-visual">
            <div className="cl-phone" aria-hidden="true">
              <div className="cl-phone__screen">
                <div className="cl-phone__island" />
                <div className="cl-ps-head">
                  <div>
                    <div className="cl-ps-eyebrow">Performance</div>
                    <div className="cl-ps-title">Success Predictors</div>
                  </div>
                  <div className="cl-ps-edit">Edit targets</div>
                </div>
                <div className="cl-ps-seg">
                  <span className="cl-ps-seg__on">Day</span><span>Week</span><span>Month</span>
                </div>
                <div className="cl-ps-date">‹&nbsp;&nbsp;Tue 23 Jun&nbsp;&nbsp;›</div>
                <div className="cl-ps-banner">
                  <span className="cl-ps-banner__e">👀</span>
                  <div><div className="cl-ps-banner__t">Hidden Job Market</div><div className="cl-ps-banner__s">Contributes to ~80% of your success</div></div>
                </div>
                {PHONE_ROWS.map((r, i) => (
                  <div className="cl-ps-row" key={i}>
                    <div className="cl-ps-row__l">
                      <div className="cl-ps-row__t">{r.label}</div>
                      <div className="cl-ps-bar"><i style={{ left: r.pct }} /></div>
                    </div>
                    <div className="cl-ps-row__r">
                      <div className="cl-ps-metrics">
                        <div className="cl-ps-metric"><span>Actual</span><b className="cl-ps-red">0</b></div>
                        <div className="cl-ps-slash">/</div>
                        <div className="cl-ps-metric"><span>Target</span><b>{r.target}</b></div>
                      </div>
                      <div className="cl-ps-step"><i className="cl-ps-minus">−</i><i className="cl-ps-plus">+</i></div>
                    </div>
                  </div>
                ))}
                <div className="cl-phone__home" />
              </div>
            </div>
          </div>
        </div>

        <footer className="cl-foot2"><b>{L.footer}</b> · {L.tagline}</footer>
      </div>
    </main>
  );
}

const PHONE_ROWS = [
  { label: "Research & read target industry / top-10 companies", target: 1, pct: "16%" },
  { label: "Research interesting profiles at target companies", target: 1, pct: "10%" },
  { label: "Contact prospects — with referrals", target: 1, pct: "20%" },
];

function pad(n: number) { return String(n).padStart(2, "0"); }

function Countdown({ config, label }: { config: CountdownConfig; label: string }) {
  const [ms, setMs] = useState<number | null>(null);

  useEffect(() => {
    function end() {
      if (config.mode === "fixed") return new Date(config.deadline).getTime();
      let start = 0;
      try { start = parseInt(localStorage.getItem("compass_cd_start") || "", 10); } catch {}
      if (!start || Number.isNaN(start)) { start = Date.now(); try { localStorage.setItem("compass_cd_start", String(start)); } catch {} }
      return start + (config.hours || 48) * 3600 * 1000;
    }
    const target = end();
    const tick = () => setMs(Math.max(0, target - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [config.mode, config.deadline, config.hours]);

  const d = ms == null ? 0 : Math.floor(ms / 86400000);
  const h = ms == null ? 0 : Math.floor((ms % 86400000) / 3600000);
  const m = ms == null ? 0 : Math.floor((ms % 3600000) / 60000);
  const s = ms == null ? 0 : Math.floor((ms % 60000) / 1000);

  return (
    <div className="cl-cd-wrap">
      <div className="cl-cd-label">{label}</div>
      <div className="cl-countdown" aria-live="polite">
        <div className="cl-cd"><b>{pad(d)}</b><span>Days</span></div>
        <div className="cl-cd-sep">:</div>
        <div className="cl-cd"><b>{pad(h)}</b><span>Hrs</span></div>
        <div className="cl-cd-sep">:</div>
        <div className="cl-cd"><b>{pad(m)}</b><span>Min</span></div>
        <div className="cl-cd-sep">:</div>
        <div className="cl-cd"><b>{pad(s)}</b><span>Sec</span></div>
      </div>
    </div>
  );
}

const CSS = `
.cl-root{font-family:"Roboto","Helvetica Neue",Arial,sans-serif;color:#3a3f4d;background:#fff;-webkit-font-smoothing:antialiased;overflow-x:hidden;}
.cl-root h1{font-family:"Poppins","Helvetica Neue",Arial,sans-serif;color:#191c27;margin:0;letter-spacing:-.02em;text-wrap:balance;}
.cl-accent{color:#c2001f;}
.cl-topbar{height:5px;background:#c2001f;}

.cl-stage{min-height:calc(100vh - 5px);max-width:1140px;margin:0 auto;padding:0 32px;display:flex;flex-direction:column;}
.cl-head{display:flex;align-items:center;justify-content:space-between;padding:16px 0;}
.cl-head__tag{font-family:"Poppins",Arial,sans-serif;font-size:12px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:#c2001f;display:flex;align-items:center;gap:8px;}
.cl-dot{width:8px;height:8px;border-radius:99px;background:#c2001f;}
.cl-head__logo{display:flex;align-items:center;gap:9px;font-family:"Poppins",Arial,sans-serif;font-weight:700;font-size:14px;color:#191c27;}
.cl-head__logo .cl-m{width:30px;height:30px;border-radius:9px;background:#c2001f;color:#fff;display:grid;place-items:center;font-size:16px;}
.cl-head__logo span{color:#c2001f;}

.cl-hero2{flex:1;display:grid;grid-template-columns:1.05fr .95fr;gap:56px;align-items:center;padding:18px 0;}

.cl-copy{max-width:30em;}
.cl-h1{font-family:"Poppins",Arial,sans-serif;font-size:40px;font-weight:700;line-height:1.16;letter-spacing:-.03em;color:#191c27;margin:0 0 16px;}
.cl-sub{font-size:16px;line-height:1.6;color:#6b7280;margin:0 0 22px;}
.cl-getlabel{font-family:"Poppins",Arial,sans-serif;font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:#c2001f;margin-bottom:12px;}
.cl-bullets{list-style:none;margin:0 0 26px;padding:0;display:grid;gap:11px;}
.cl-bullet{display:flex;align-items:flex-start;gap:11px;font-size:15.5px;line-height:1.35;color:#3a3f4d;}
.cl-bullet b{color:#191c27;font-weight:600;}
.cl-bullet__i{flex:0 0 auto;width:22px;height:22px;border-radius:99px;background:#f6e0e3;color:#c2001f;display:grid;place-items:center;font-size:11px;font-weight:700;margin-top:1px;}

.cl-actions{display:flex;align-items:center;gap:22px;flex-wrap:wrap;}
.cl-cta{display:inline-flex;align-items:center;justify-content:center;gap:10px;font-family:"Poppins",Arial,sans-serif;font-weight:600;font-size:15px;letter-spacing:.02em;color:#fff;background:#c2001f;border:0;border-radius:99px;padding:17px 32px;text-decoration:none;cursor:pointer;box-shadow:0 10px 26px rgba(194,0,31,.3);transition:all .22s cubic-bezier(.2,.7,.2,1);text-transform:uppercase;white-space:nowrap;}
.cl-cta:hover{background:#8a0016;transform:translateY(-2px);box-shadow:0 14px 32px rgba(194,0,31,.36);}

.cl-cd-label{font-family:"Poppins",Arial,sans-serif;font-size:9px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:#9aa0ad;margin-bottom:7px;}
.cl-countdown{display:flex;gap:7px;align-items:center;}
.cl-cd{position:relative;background:#fff;border:1px solid #e9ebf1;border-radius:10px;width:46px;padding:8px 0 6px;text-align:center;box-shadow:0 5px 14px rgba(25,28,39,.07);}
.cl-cd b{font-family:"Poppins",Arial,sans-serif;font-size:20px;font-weight:700;color:#191c27;display:block;line-height:1;font-variant-numeric:tabular-nums;}
.cl-cd span{font-size:7px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#9aa0ad;margin-top:5px;display:block;}
.cl-cd-sep{font-family:"Poppins",Arial,sans-serif;font-weight:700;font-size:15px;color:#d4d8e2;}
.cl-proofrow{margin-top:20px;font-size:12.5px;color:#6b7280;}

.cl-foot2{padding:14px 0;border-top:1px solid #eef0f5;text-align:center;font-size:12px;color:#9aa0ad;}
.cl-foot2 b{color:#6b7280;font-weight:600;}

/* ---- iPhone ---- */
.cl-visual{display:flex;justify-content:center;align-items:center;}
.cl-phone{width:268px;border-radius:50px;background:#191c27;padding:13px;box-shadow:0 34px 72px rgba(25,28,39,.34);position:relative;}
.cl-phone__screen{position:relative;background:#fafafa;border-radius:38px;padding:44px 15px 22px;overflow:hidden;text-align:left;min-height:530px;}
.cl-phone__island{position:absolute;top:14px;left:50%;transform:translateX(-50%);width:88px;height:26px;border-radius:99px;background:#191c27;z-index:3;}
.cl-phone__home{position:absolute;left:50%;bottom:9px;transform:translateX(-50%);width:110px;height:5px;border-radius:99px;background:#191c27;opacity:.22;}

.cl-ps-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:12px;}
.cl-ps-eyebrow{font-family:"Poppins",Arial,sans-serif;font-size:7px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#c2001f;}
.cl-ps-title{font-family:"Poppins",Arial,sans-serif;font-weight:700;font-size:16px;color:#191c27;letter-spacing:-.02em;line-height:1.05;margin-top:3px;}
.cl-ps-edit{flex:0 0 auto;font-family:"Poppins",Arial,sans-serif;font-weight:600;font-size:8px;color:#191c27;border:1px solid #d4d8e2;border-radius:99px;padding:6px 9px;background:#fff;}
.cl-ps-seg{display:flex;background:#eef0f5;border-radius:10px;padding:3px;margin-bottom:11px;}
.cl-ps-seg span{flex:1;text-align:center;font-family:"Poppins",Arial,sans-serif;font-weight:600;font-size:9px;color:#9aa0ad;padding:6px 0;border-radius:8px;}
.cl-ps-seg__on{background:#fff;color:#191c27 !important;box-shadow:0 1px 3px rgba(25,28,39,.14);}
.cl-ps-date{text-align:center;font-family:"Poppins",Arial,sans-serif;font-weight:700;font-size:10px;color:#191c27;margin-bottom:11px;}
.cl-ps-banner{display:flex;align-items:center;gap:7px;background:#fbe3e6;border-radius:12px;padding:9px 11px;margin-bottom:2px;}
.cl-ps-banner__e{font-size:13px;}
.cl-ps-banner__t{font-family:"Poppins",Arial,sans-serif;font-weight:700;font-size:10.5px;color:#191c27;line-height:1.1;}
.cl-ps-banner__s{font-size:7.5px;color:#6b7280;margin-top:1px;}
.cl-ps-row{display:flex;gap:10px;align-items:center;padding:11px 1px;border-bottom:1px solid #eef0f5;}
.cl-ps-row__l{flex:1;min-width:0;}
.cl-ps-row__t{font-family:"Poppins",Arial,sans-serif;font-weight:600;font-size:10px;line-height:1.25;color:#191c27;}
.cl-ps-bar{margin-top:9px;height:6px;border-radius:99px;background:#e7ebf3;position:relative;}
.cl-ps-bar i{position:absolute;top:50%;transform:translate(-50%,-50%);width:3px;height:13px;border-radius:2px;background:#191c27;}
.cl-ps-row__r{flex:0 0 auto;width:88px;}
.cl-ps-metrics{display:flex;justify-content:center;align-items:flex-end;gap:7px;}
.cl-ps-metric{display:flex;flex-direction:column;align-items:center;}
.cl-ps-metric span{font-family:"Poppins",Arial,sans-serif;font-size:6.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:#9aa0ad;margin-bottom:1px;}
.cl-ps-metric b{font-family:"Poppins",Arial,sans-serif;font-size:15px;font-weight:700;color:#191c27;line-height:1;}
.cl-ps-red{color:#c2001f !important;}
.cl-ps-slash{color:#c5c9d2;font-size:13px;font-weight:600;}
.cl-ps-step{display:flex;justify-content:center;gap:9px;margin-top:7px;}
.cl-ps-step i{width:19px;height:19px;border-radius:99px;display:grid;place-items:center;font-style:normal;font-size:12px;font-weight:700;line-height:1;}
.cl-ps-minus{border:1.5px solid #e6e8ef;color:#9aa0ad;background:#fff;}
.cl-ps-plus{background:#c2001f;color:#fff;box-shadow:0 2px 7px rgba(194,0,31,.36);}

/* ---- responsive: stack on tablet/mobile (scroll is fine here) ---- */
@media (max-width:900px){
  .cl-hero2{grid-template-columns:1fr;gap:36px;justify-items:center;text-align:center;padding:28px 0;}
  .cl-copy{max-width:34em;}
  .cl-h1{font-size:34px;}
  .cl-getlabel,.cl-bullets{text-align:left;}
  .cl-bullets{display:inline-grid;}
  .cl-actions{justify-content:center;}
  .cl-cd-label{text-align:center;}
  .cl-visual{order:-1;}
}
@media (max-width:480px){
  .cl-stage{padding:0 20px;}
  .cl-h1{font-size:29px;}
  .cl-head__tag{font-size:10px;}
}
`;
