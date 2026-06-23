"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { useFunnel } from "@/lib/firestore/funnel";
import type { CountdownConfig } from "@/lib/funnel";

// Public marketing landing — the first page visitors hit. Logged-in users are
// bounced straight to their Compass. All copy is admin-editable (config/funnel).
export default function Home() {
  const { user, loading } = useAuth();
  const { funnel } = useFunnel();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace("/compass");
  }, [user, loading, router]);

  if (loading || user) {
    return <div className="min-h-screen grid place-items-center text-jh-mute"><span className="animate-pulse">Loading…</span></div>;
  }

  const L = funnel.landing;

  return (
    <main className="cl-root">
      <style>{CSS}</style>
      <div className="cl-topbar" />

      <div className="cl-container">
        <div className="cl-head">
          <div className="cl-head__tag"><span className="cl-dot" />{L.headTag}</div>
          <div className="cl-head__logo"><span className="cl-m">🧭</span>{L.brandName} <span>{L.brandAccent}</span></div>
        </div>
      </div>

      {/* HERO */}
      <div className="cl-container">
        <div className="cl-hero">
          <h1 className="cl-hero__h1">{L.heroH1} <span className="cl-accent">{L.heroH1Accent}</span></h1>
          <p className="cl-hero__sub">{L.heroSub}</p>
          <Link className="cl-cta" href="/quiz">{L.ctaLabel}</Link>
          <Countdown config={funnel.countdown} label={L.countdownLabel} />
          <div className="cl-proofrow">{L.proofrow}</div>
        </div>
      </div>

      {/* PRODUCT PEEK */}
      <div className="cl-section">
        <div className="cl-container">
          <div className="cl-peek">
            <div className="cl-phone" aria-hidden="true">
              <div className="cl-phone__screen">
                <div className="cl-scr-eyebrow">Success Predictors</div>
                <div className="cl-scr-title">Performance</div>
                <div className="cl-mbanner cl-mbanner--hidden">
                  <span>👀</span>
                  <div><div className="cl-mbanner__t">Hidden Job Market</div><div className="cl-mbanner__s">~80% of your success</div></div>
                </div>
                <div className="cl-amrow">
                  <div className="cl-amrow__t">Research target companies</div>
                  <div className="cl-amrow__r"><div className="cl-amrow__nums"><b>0</b><span>&nbsp;/&nbsp;1</span></div><div className="cl-pm"><i className="cl-minus">−</i><i className="cl-plus">+</i></div></div>
                </div>
                <div className="cl-amrow">
                  <div className="cl-amrow__t">Contact prospects — referrals</div>
                  <div className="cl-amrow__r"><div className="cl-amrow__nums"><b>0</b><span>&nbsp;/&nbsp;1</span></div><div className="cl-pm"><i className="cl-minus">−</i><i className="cl-plus">+</i></div></div>
                </div>
                <div className="cl-mbanner cl-mbanner--visible">
                  <span>✅</span>
                  <div><div className="cl-mbanner__t">Visible Job Market</div><div className="cl-mbanner__s">~20% of your success</div></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* WHAT YOU GET */}
      <div className="cl-section cl-section--tint">
        <div className="cl-container">
          <span className="cl-eyebrow">{L.getEyebrow}</span>
          <h2 className="cl-sec-title">{L.getTitlePre} <span className="cl-accent">{L.getTitleAccent}</span> {L.getTitlePost}</h2>
          <div className="cl-learn">
            {L.cards.map((c, i) => (
              <div className="cl-lcard" key={i}>
                <div className="cl-lcard__part">{c.part}</div>
                <div className="cl-lcard__t">{c.title}</div>
                <div className="cl-lcard__d">{c.body}</div>
              </div>
            ))}
          </div>
          <div className="cl-cta-block"><Link className="cl-cta" href="/quiz">{L.ctaLabel}</Link></div>
        </div>
      </div>

      {/* MENTORS */}
      <div className="cl-section">
        <div className="cl-container">
          <span className="cl-eyebrow">{L.mentorsEyebrow}</span>
          <h2 className="cl-sec-title">{L.mentorsTitle} <span className="cl-accent">{L.mentorsTitleAccent}</span></h2>
          <div className="cl-mentors">
            {L.mentors.map((m, i) => (
              <div className="cl-mentor" key={i}>
                <MentorAvatar m={m} />
                <div className="cl-mentor__name">{m.name}</div>
                <div className="cl-mentor__role">{m.role}</div>
                <div className="cl-mentor__bio">{m.bio}</div>
              </div>
            ))}
          </div>
          <div className="cl-seen">{L.seen}</div>
        </div>
      </div>

      {/* CLOSING */}
      <div className="cl-section cl-section--tint">
        <div className="cl-container">
          <div className="cl-closing">
            <h2 className="cl-closing__h">{L.closingTitle}</h2>
            <p className="cl-closing__sub">{L.closingSub}</p>
            <Countdown config={funnel.countdown} label={L.countdownLabel} />
            <Link className="cl-cta" href="/quiz">{L.ctaLabel}</Link>
            <p className="cl-note">{L.closingNote}</p>
          </div>
        </div>
      </div>

      <div className="cl-foot">
        {L.footer}<br />{L.tagline}
      </div>
    </main>
  );
}

function MentorAvatar({ m }: { m: { initials: string; name: string; photo?: string } }) {
  const [err, setErr] = useState(false);
  if (m.photo && !err) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="cl-mentor__photo" src={m.photo} alt={m.name} onError={() => setErr(true)} />;
  }
  return <div className="cl-mentor__av">{m.initials}</div>;
}

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
.cl-root{font-family:"Roboto","Helvetica Neue",Arial,sans-serif;color:#3a3f4d;background:#fff;-webkit-font-smoothing:antialiased;}
.cl-root h1,.cl-root h2{font-family:"Poppins","Helvetica Neue",Arial,sans-serif;color:#191c27;margin:0;letter-spacing:-.02em;text-wrap:balance;}
.cl-root p{margin:0;line-height:1.6;color:#3a3f4d;}
.cl-accent{color:#c2001f;}
.cl-topbar{height:5px;background:#c2001f;}
.cl-container{max-width:760px;margin:0 auto;padding:0 24px;}
.cl-section{padding:60px 0;}
.cl-section--tint{background:#f5f6fa;}
.cl-head{display:flex;align-items:center;justify-content:space-between;padding:18px 0;}
.cl-head__tag{font-family:"Poppins",Arial,sans-serif;font-size:12px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:#c2001f;display:flex;align-items:center;gap:8px;}
.cl-dot{width:8px;height:8px;border-radius:99px;background:#c2001f;}
.cl-head__logo{display:flex;align-items:center;gap:9px;font-family:"Poppins",Arial,sans-serif;font-weight:700;font-size:14px;color:#191c27;}
.cl-head__logo .cl-m{width:30px;height:30px;border-radius:9px;background:#c2001f;color:#fff;display:grid;place-items:center;font-size:16px;}
.cl-head__logo span{color:#c2001f;}
.cl-hero{max-width:640px;margin:0 auto;text-align:center;padding:34px 0 8px;}
.cl-hero__h1{font-family:"Poppins",Arial,sans-serif;font-size:44px;font-weight:700;line-height:1.1;letter-spacing:-.03em;color:#191c27;margin:0 0 20px;}
.cl-hero__sub{font-size:17px;line-height:1.62;color:#6b7280;margin:0 auto 30px;max-width:30em;text-wrap:balance;}
.cl-cta{display:inline-flex;align-items:center;justify-content:center;gap:10px;font-family:"Poppins",Arial,sans-serif;font-weight:600;font-size:15px;letter-spacing:.02em;color:#fff;background:#c2001f;border:0;border-radius:99px;padding:17px 34px;text-decoration:none;cursor:pointer;box-shadow:0 10px 26px rgba(194,0,31,.3);transition:all .22s cubic-bezier(.2,.7,.2,1);text-transform:uppercase;}
.cl-cta:hover{background:#8a0016;transform:translateY(-2px);box-shadow:0 14px 32px rgba(194,0,31,.36);}
.cl-cd-wrap{margin:36px 0 26px;}
.cl-cd-label{font-family:"Poppins",Arial,sans-serif;font-size:11px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:#9aa0ad;margin-bottom:14px;}
.cl-countdown{display:flex;gap:10px;justify-content:center;align-items:center;}
.cl-cd{position:relative;background:#fff;border:1px solid #e9ebf1;border-radius:13px;width:72px;padding:14px 0 11px;text-align:center;box-shadow:0 6px 18px rgba(25,28,39,.08);overflow:hidden;}
.cl-cd::after{content:"";position:absolute;left:0;right:0;top:50%;height:1px;background:#e9ebf1;opacity:.7;}
.cl-cd b{font-family:"Poppins",Arial,sans-serif;font-size:30px;font-weight:700;color:#191c27;display:block;line-height:1;font-variant-numeric:tabular-nums;position:relative;z-index:1;}
.cl-cd span{font-size:9px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:#9aa0ad;margin-top:8px;display:block;}
.cl-cd-sep{font-family:"Poppins",Arial,sans-serif;font-weight:700;font-size:22px;color:#d4d8e2;}
.cl-proofrow{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;font-size:13px;color:#6b7280;}
.cl-peek{display:flex;justify-content:center;margin-top:8px;}
.cl-phone{width:248px;border-radius:36px;background:#191c27;padding:12px;box-shadow:0 28px 60px rgba(25,28,39,.28);position:relative;}
.cl-phone::before{content:"";position:absolute;top:15px;left:50%;transform:translateX(-50%);width:74px;height:6px;border-radius:99px;background:rgba(255,255,255,.18);}
.cl-phone__screen{background:#fff;border-radius:26px;padding:26px 16px 16px;overflow:hidden;text-align:left;}
.cl-scr-eyebrow{font-family:"Poppins",Arial,sans-serif;font-size:8px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:#c2001f;}
.cl-scr-title{font-family:"Poppins",Arial,sans-serif;font-weight:700;font-size:18px;color:#191c27;margin-bottom:13px;}
.cl-mbanner{display:flex;align-items:center;gap:8px;border-radius:11px;padding:9px 11px;}
.cl-mbanner--hidden{background:#f6e0e3;}
.cl-mbanner--visible{background:#e2ebfb;margin-top:11px;}
.cl-mbanner__t{font-family:"Poppins",Arial,sans-serif;font-weight:700;font-size:11px;color:#191c27;line-height:1.1;}
.cl-mbanner__s{font-size:8.5px;color:#6b7280;}
.cl-amrow{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:11px 2px;border-bottom:1px solid #e9ebf1;}
.cl-amrow__t{font-family:"Poppins",Arial,sans-serif;font-weight:600;font-size:10.5px;color:#191c27;line-height:1.25;max-width:118px;}
.cl-amrow__r{display:flex;align-items:center;gap:9px;}
.cl-amrow__nums{font-family:"Poppins",Arial,sans-serif;font-size:13px;font-weight:700;color:#191c27;white-space:nowrap;}
.cl-amrow__nums b{color:#c2001f;}.cl-amrow__nums span{color:#9aa0ad;font-weight:600;}
.cl-pm{display:flex;gap:6px;}
.cl-pm i{width:20px;height:20px;border-radius:99px;display:grid;place-items:center;font-size:12px;font-weight:700;line-height:1;font-style:normal;}
.cl-pm .cl-minus{border:1.5px solid #d4d8e2;color:#9aa0ad;background:#fff;}
.cl-pm .cl-plus{background:#c2001f;color:#fff;box-shadow:0 3px 9px rgba(194,0,31,.36);}
.cl-eyebrow{font-family:"Poppins",Arial,sans-serif;font-size:12px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:#c2001f;display:block;text-align:center;margin-bottom:14px;}
.cl-sec-title{font-family:"Poppins",Arial,sans-serif;font-size:32px;font-weight:700;line-height:1.15;letter-spacing:-.025em;text-align:center;margin:0 auto 40px;max-width:18em;}
.cl-learn{max-width:640px;margin:0 auto;display:grid;gap:18px;}
.cl-lcard{background:#fff;border:1px solid #e9ebf1;border-radius:18px;padding:26px 28px;box-shadow:0 6px 20px rgba(25,28,39,.05);}
.cl-lcard__part{font-family:"Poppins",Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#c2001f;margin-bottom:10px;}
.cl-lcard__t{font-family:"Poppins",Arial,sans-serif;font-size:19px;font-weight:600;color:#191c27;margin:0 0 8px;}
.cl-lcard__d{font-size:15px;line-height:1.55;color:#6b7280;}
.cl-cta-block{text-align:center;margin-top:40px;}
.cl-mentors{max-width:640px;margin:0 auto;display:grid;grid-template-columns:1fr 1fr;gap:18px;}
.cl-mentor{background:#fff;border:1px solid #e9ebf1;border-radius:18px;padding:26px 24px;box-shadow:0 6px 20px rgba(25,28,39,.05);}
.cl-mentor__av{width:60px;height:60px;border-radius:99px;background:#f6e0e3;color:#c2001f;font-family:"Poppins",Arial,sans-serif;font-weight:700;font-size:20px;display:grid;place-items:center;margin-bottom:16px;}
.cl-mentor__photo{width:60px;height:60px;border-radius:99px;object-fit:cover;display:block;margin-bottom:16px;background:#f6e0e3;}
.cl-mentor__name{font-family:"Poppins",Arial,sans-serif;font-size:17px;font-weight:600;color:#191c27;}
.cl-mentor__role{font-family:"Poppins",Arial,sans-serif;font-size:13px;font-weight:500;color:#c2001f;margin-bottom:12px;}
.cl-mentor__bio{font-size:13.5px;line-height:1.55;color:#6b7280;}
.cl-seen{text-align:center;margin-top:30px;font-size:12px;color:#9aa0ad;font-family:"Poppins",Arial,sans-serif;letter-spacing:.04em;}
.cl-closing{text-align:center;max-width:540px;margin:0 auto;}
.cl-closing__h{font-family:"Poppins",Arial,sans-serif;font-size:30px;font-weight:700;letter-spacing:-.025em;margin:0 0 12px;}
.cl-closing__sub{font-style:italic;font-size:16px;color:#6b7280;margin:0 0 28px;}
.cl-note{margin-top:18px;font-size:13px;color:#9aa0ad;}
.cl-foot{background:#191c27;color:rgba(255,255,255,.55);text-align:center;padding:34px 24px;font-size:12.5px;line-height:1.9;}
@media (max-width:680px){
  .cl-hero__h1{font-size:33px;}
  .cl-sec-title{font-size:25px;}
  .cl-closing__h{font-size:24px;}
  .cl-cd{width:64px;}
  .cl-cd b{font-size:25px;}
  .cl-mentors{grid-template-columns:1fr;}
}
`;
