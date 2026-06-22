"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { useFunnel } from "@/lib/firestore/funnel";

// Public marketing landing — the first page visitors hit. Logged-in users are
// bounced straight to their Compass. All copy is admin-editable (config/funnel).
export default function Home() {
  const { user, loading } = useAuth();
  const { funnel } = useFunnel();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace("/compass");
  }, [user, loading, router]);

  // Hold the screen while we decide whether to redirect a signed-in user.
  if (loading || user) {
    return (
      <div className="min-h-screen grid place-items-center text-jh-mute">
        <span className="animate-pulse">Loading…</span>
      </div>
    );
  }

  const L = funnel.landing;

  return (
    <main className="cl-root">
      <style>{CSS}</style>

      {/* ============ SECTION 1 · HERO ============ */}
      <div className="cl-wrap">
        <div className="cl-card">
          <div className="cl-brand">
            <div className="cl-brand__mark">🧭</div>
            <div className="cl-brand__name">{L.brandName} <span>{L.brandAccent}</span></div>
          </div>
          <div className="cl-hero">
            <div>
              <span className="cl-eyebrow">{L.eyebrow}</span>
              <h1 className="cl-h1">{L.h1} <span className="cl-accent">{L.h1accent}</span></h1>
              <p className="cl-lede">{L.lede}</p>
              <Link className="cl-cta" href="/quiz">{L.ctaLabel}</Link>
              <p className="cl-cta-fine">{L.ctaFine}</p>
              <p className="cl-proof">{L.proof}</p>
            </div>
            <div className="cl-phone" aria-hidden="true">
              <div className="cl-phone__screen">
                <div className="cl-scr-eyebrow">Success Predictors</div>
                <div className="cl-scr-title">Performance</div>
                <div className="cl-scr-date">‹&nbsp;&nbsp;Mon, 22 Jun&nbsp;&nbsp;›</div>
                <div className="cl-mbanner cl-mbanner--hidden">
                  <span>👀</span>
                  <div><div className="cl-mbanner__t">Hidden Job Market</div><div className="cl-mbanner__s">~80% of your success</div></div>
                </div>
                <div className="cl-amrow">
                  <div className="cl-amrow__t">Research target companies</div>
                  <div className="cl-amrow__r">
                    <div className="cl-amrow__nums"><b>0</b><span>&nbsp;/&nbsp;1</span></div>
                    <div className="cl-pm"><i className="cl-minus">−</i><i className="cl-plus">+</i></div>
                  </div>
                </div>
                <div className="cl-amrow">
                  <div className="cl-amrow__t">Contact prospects — referrals</div>
                  <div className="cl-amrow__r">
                    <div className="cl-amrow__nums"><b>0</b><span>&nbsp;/&nbsp;1</span></div>
                    <div className="cl-pm"><i className="cl-minus">−</i><i className="cl-plus">+</i></div>
                  </div>
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

      {/* ============ SECTION 2 · THE SYSTEM ============ */}
      <div className="cl-wrap cl-wrap--tight">
        <div className="cl-card">
          <span className="cl-eyebrow">{L.s2eyebrow}</span>
          <h2 className="cl-h2">{L.s2title} <span className="cl-accent">{L.s2accent}</span></h2>
          <p className="cl-bigline">{L.s2bigline}</p>

          <div className="cl-caps">
            {L.capabilities.map((c, i) => (
              <div className="cl-cap" key={i}>
                <div className="cl-cap__i">{c.emoji}</div>
                <div><div className="cl-cap__t">{c.title}</div><div className="cl-cap__d">{c.body}</div></div>
              </div>
            ))}
          </div>

          <div className="cl-board">
            <div className="cl-board__cap">Pipeline — every role you're chasing, in one board</div>
            <div className="cl-kanban">
              <div className="cl-kcol"><div className="cl-kcol__h"><span className="cl-kdot" style={{ background: "#9aa0ad" }} />Wishlist<span className="cl-kcol__n">0</span></div><div className="cl-kempty">Drop here</div></div>
              <div className="cl-kcol"><div className="cl-kcol__h"><span className="cl-kdot" style={{ background: "#2563eb" }} />Applied<span className="cl-kcol__n">1</span></div><div className="cl-kcard"><div className="cl-kcard__t">Project Manager</div><div className="cl-kcard__c">Acme</div><span className="cl-ktag">hidden</span></div></div>
              <div className="cl-kcol"><div className="cl-kcol__h"><span className="cl-kdot" style={{ background: "#f59e0b" }} />Interview<span className="cl-kcol__n">0</span></div><div className="cl-kempty">Drop here</div></div>
              <div className="cl-kcol"><div className="cl-kcol__h"><span className="cl-kdot" style={{ background: "#16a34a" }} />Offer<span className="cl-kcol__n">0</span></div><div className="cl-kempty">Drop here</div></div>
              <div className="cl-kcol"><div className="cl-kcol__h"><span className="cl-kdot" style={{ background: "#c2001f" }} />Rejected<span className="cl-kcol__n">0</span></div><div className="cl-kempty">Drop here</div></div>
            </div>
          </div>

          <div className="cl-section-cta">
            <Link className="cl-cta" href="/quiz">Take the 2-Minute Quiz →</Link>
          </div>
        </div>
      </div>

      {/* ============ SECTION 3 · HOW IT WORKS + FINAL CTA ============ */}
      <div className="cl-wrap cl-wrap--tight">
        <div className="cl-card">
          <span className="cl-eyebrow">{L.s3eyebrow}</span>
          <h2 className="cl-h2">{L.s3title} <span className="cl-accent">{L.s3accent}</span></h2>
          <div className="cl-steps">
            {L.steps.map((s, i) => (
              <div className="cl-step" key={i}><div className="cl-step__n">{s.n}</div><div className="cl-step__t">{s.text}</div></div>
            ))}
          </div>
          <div className="cl-section-cta">
            <Link className="cl-cta" href="/quiz">{L.s3ctaLabel}</Link>
            <p className="cl-note">{L.s3note}</p>
          </div>
        </div>
      </div>

      <div className="cl-foot">
        {L.footer}<br />
        {L.tagline}
      </div>
    </main>
  );
}

const CSS = `
.cl-root{
  font-family:"Roboto","Helvetica Neue",Arial,sans-serif;color:#3a3f4d;min-height:100vh;
  background:#0e1019;
  background-image:
    radial-gradient(1px 1px at 14% 16%, rgba(255,255,255,.5) 50%, transparent),
    radial-gradient(1px 1px at 80% 10%, rgba(255,255,255,.4) 50%, transparent),
    radial-gradient(1.4px 1.4px at 35% 44%, rgba(255,255,255,.45) 50%, transparent),
    radial-gradient(1.5px 1.5px at 88% 56%, rgba(255,255,255,.4) 50%, transparent),
    radial-gradient(1px 1px at 9% 68%, rgba(255,255,255,.35) 50%, transparent),
    radial-gradient(1.2px 1.2px at 48% 82%, rgba(255,255,255,.4) 50%, transparent),
    radial-gradient(1px 1px at 74% 88%, rgba(255,255,255,.3) 50%, transparent),
    radial-gradient(1200px 760px at 50% -12%, #1c2030 0%, #0e1019 62%);
}
.cl-root h1,.cl-root h2{font-family:"Poppins","Helvetica Neue",Arial,sans-serif;color:#191c27;margin:0;letter-spacing:-.02em;}
.cl-root p{margin:0;line-height:1.6;}
.cl-accent{color:#c2001f;}
.cl-wrap{max-width:840px;margin:0 auto;padding:64px 24px 36px;}
.cl-wrap--tight{padding-top:32px;}
.cl-card{background:#fff;border-radius:30px;box-shadow:0 30px 80px rgba(0,0,0,.46);padding:72px;position:relative;}
.cl-brand{display:flex;align-items:center;gap:11px;margin-bottom:40px;}
.cl-brand__mark{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:#c2001f;color:#fff;font-size:21px;box-shadow:0 8px 22px rgba(194,0,31,.34);}
.cl-brand__name{font-family:"Poppins",Arial,sans-serif;font-weight:700;font-size:16px;color:#191c27;}
.cl-brand__name span{color:#c2001f;}
.cl-eyebrow{font-family:"Poppins",Arial,sans-serif;font-size:12px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:#9aa0ad;display:inline-block;margin-bottom:18px;}
.cl-h1{font-family:"Poppins",Arial,sans-serif;font-size:52px;font-weight:700;line-height:1.04;letter-spacing:-.035em;color:#191c27;margin:0 0 22px;}
.cl-h2{font-family:"Poppins",Arial,sans-serif;font-size:38px;font-weight:700;line-height:1.1;letter-spacing:-.03em;margin:0 0 22px;}
.cl-lede{font-size:18px;line-height:1.62;color:#6b7280;margin:0;max-width:30em;}
.cl-cta{display:inline-flex;align-items:center;justify-content:center;gap:10px;font-family:"Poppins",Arial,sans-serif;font-weight:600;font-size:18px;color:#fff;background:#c2001f;border:0;border-radius:14px;padding:19px 36px;text-decoration:none;cursor:pointer;box-shadow:0 8px 22px rgba(194,0,31,.34);transition:all .22s cubic-bezier(.2,.7,.2,1);margin-top:34px;}
.cl-cta:hover{background:#8a0016;transform:translateY(-2px);box-shadow:0 12px 28px rgba(194,0,31,.4);}
.cl-cta-fine{font-size:13px;color:#9aa0ad;margin-top:14px;}
.cl-hero{display:grid;grid-template-columns:1.02fr .98fr;gap:52px;align-items:center;}
.cl-proof{margin-top:40px;font-size:13.5px;color:#6b7280;}
.cl-phone{width:252px;margin:0 auto;border-radius:38px;background:#191c27;padding:12px;box-shadow:0 36px 70px rgba(25,28,39,.42);position:relative;}
.cl-phone::before{content:"";position:absolute;top:15px;left:50%;transform:translateX(-50%);width:76px;height:6px;border-radius:99px;background:rgba(255,255,255,.18);}
.cl-phone__screen{background:#fff;border-radius:28px;padding:26px 16px 18px;overflow:hidden;}
.cl-scr-eyebrow{font-family:"Poppins",Arial,sans-serif;font-size:8px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:#c2001f;}
.cl-scr-title{font-family:"Poppins",Arial,sans-serif;font-weight:700;font-size:19px;color:#191c27;letter-spacing:-.02em;margin-bottom:14px;}
.cl-scr-date{text-align:center;font-family:"Poppins",Arial,sans-serif;font-weight:700;font-size:11px;color:#191c27;margin-bottom:12px;}
.cl-mbanner{display:flex;align-items:center;gap:8px;border-radius:11px;padding:9px 11px;margin-bottom:4px;}
.cl-mbanner--hidden{background:#f6e0e3;}
.cl-mbanner--visible{background:#e2ebfb;margin-top:12px;}
.cl-mbanner__t{font-family:"Poppins",Arial,sans-serif;font-weight:700;font-size:11.5px;color:#191c27;line-height:1.1;}
.cl-mbanner__s{font-size:8.5px;color:#6b7280;}
.cl-amrow{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:12px 2px;border-bottom:1px solid #e9ebf1;}
.cl-amrow__t{font-family:"Poppins",Arial,sans-serif;font-weight:600;font-size:10.5px;color:#191c27;line-height:1.25;max-width:120px;}
.cl-amrow__r{display:flex;align-items:center;gap:9px;}
.cl-amrow__nums{font-family:"Poppins",Arial,sans-serif;font-size:13px;font-weight:700;color:#191c27;white-space:nowrap;}
.cl-amrow__nums b{color:#c2001f;}
.cl-amrow__nums span{color:#9aa0ad;font-weight:600;}
.cl-pm{display:flex;gap:6px;}
.cl-pm i{width:21px;height:21px;border-radius:99px;display:grid;place-items:center;font-size:12px;font-weight:700;line-height:1;font-style:normal;}
.cl-pm .cl-minus{border:1.5px solid #d4d8e2;color:#9aa0ad;background:#fff;}
.cl-pm .cl-plus{background:#c2001f;color:#fff;box-shadow:0 3px 9px rgba(194,0,31,.36);}
.cl-bigline{font-size:21px;line-height:1.5;color:#3a3f4d;margin:0 0 14px;max-width:34em;}
.cl-caps{display:grid;gap:0;margin:40px 0 8px;}
.cl-cap{display:flex;gap:18px;align-items:baseline;padding:22px 0;border-top:1px solid #e9ebf1;}
.cl-cap:last-child{border-bottom:1px solid #e9ebf1;}
.cl-cap__i{font-size:22px;line-height:1;flex:0 0 auto;width:30px;}
.cl-cap__t{font-family:"Poppins",Arial,sans-serif;font-size:18px;font-weight:600;color:#191c27;margin:0 0 4px;}
.cl-cap__d{font-size:15px;color:#6b7280;line-height:1.5;}
.cl-board{margin:44px 0 8px;}
.cl-board__cap{font-family:"Poppins",Arial,sans-serif;font-size:11.5px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#9aa0ad;margin-bottom:16px;}
.cl-kanban{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;}
.cl-kcol{background:#f5f6fa;border-radius:14px;padding:13px 11px;min-height:104px;}
.cl-kcol__h{display:flex;align-items:center;gap:6px;font-family:"Poppins",Arial,sans-serif;font-size:11.5px;font-weight:600;color:#191c27;margin-bottom:11px;}
.cl-kdot{width:8px;height:8px;border-radius:99px;flex:0 0 auto;}
.cl-kcol__n{margin-left:auto;color:#9aa0ad;font-size:11px;font-weight:600;}
.cl-kcard{background:#fff;border:1px solid #e9ebf1;border-radius:10px;padding:10px;box-shadow:0 4px 12px rgba(25,28,39,.07);}
.cl-kcard__t{font-family:"Poppins",Arial,sans-serif;font-weight:600;font-size:12px;color:#191c27;}
.cl-kcard__c{font-size:10px;color:#6b7280;}
.cl-ktag{display:inline-block;margin-top:7px;background:#f6e0e3;color:#c2001f;font-size:9px;font-weight:700;border-radius:99px;padding:2px 8px;}
.cl-kempty{font-size:10px;color:#9aa0ad;text-align:center;padding-top:16px;}
.cl-steps{display:grid;gap:24px;margin:40px 0 0;}
.cl-step{display:flex;gap:20px;align-items:flex-start;}
.cl-step__n{flex:0 0 auto;width:38px;height:38px;border-radius:99px;background:#f5f6fa;color:#c2001f;font-family:"Poppins",Arial,sans-serif;font-weight:700;font-size:16px;display:grid;place-items:center;}
.cl-step__t{font-size:17px;color:#3a3f4d;padding-top:6px;line-height:1.5;}
.cl-section-cta{margin-top:44px;text-align:center;}
.cl-section-cta .cl-cta{padding-left:48px;padding-right:48px;}
.cl-note{margin-top:18px;font-size:13.5px;color:#9aa0ad;text-align:center;}
.cl-foot{max-width:840px;margin:0 auto;padding:6px 24px 56px;text-align:center;color:rgba(255,255,255,.4);font-size:12.5px;line-height:1.8;}
@media (max-width:760px){
  .cl-card{padding:44px 28px;}
  .cl-hero{grid-template-columns:1fr;gap:40px;}
  .cl-phone{order:-1;}
  .cl-h1{font-size:38px;}
  .cl-h2{font-size:29px;}
  .cl-bigline{font-size:18px;}
  .cl-kanban{grid-template-columns:repeat(5,148px);overflow-x:auto;padding-bottom:8px;}
  .cl-section-cta .cl-cta{width:100%;}
}
`;
