"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { useContent } from "@/lib/firestore/content";
import { useFunnel } from "@/lib/firestore/funnel";

export default function RegisterPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const { t } = useContent();
  const { funnel } = useFunnel();
  const [state, setState] = useState<"checking" | "ok" | "invalid">("checking");
  const [reason, setReason] = useState<string>();
  const [lockedEmail, setLockedEmail] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Prefill name/email from the thank-you redirect query string (firstName/lastName/email).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const qEmail = sp.get("email");
    if (qEmail && !email) setEmail(qEmail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetch(`/api/register/validate?token=${token}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.valid) { setState("ok"); setLockedEmail(d.email ?? null); if (d.email) setEmail(d.email); }
        else { setState("invalid"); setReason(d.reason); }
      })
      .catch(() => { setState("invalid"); setReason("not_found"); });
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/register/complete", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, email, password }),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) {
        // An expired link mid-flow drops the user into the expired experience.
        if (d.error === "expired") { setState("invalid"); setReason("expired"); return; }
        const map: Record<string, string> = {
          used: "This link has already been used.",
          email_mismatch: "This link is for a different email address.",
          weak_password: "Password must be at least 6 characters.",
        };
        throw new Error(map[d.error] ?? "Could not complete registration.");
      }
      await signInWithEmailAndPassword(auth, email, password);
      router.replace("/compass");
    } catch (e: any) {
      setErr(e?.message ?? "Something went wrong.");
      setBusy(false);
    }
  }

  if (state === "checking")
    return <div className="min-h-screen grid place-items-center text-jh-mute animate-pulse">{t("auth.register.checking")}</div>;

  if (state === "invalid") {
    // Expired registration link → the dedicated "expired link experience": the
    // window has closed, so invite them to the next meetup for a fresh invite.
    if (reason === "expired") {
      const E = funnel.expired;
      return (
        <div className="min-h-screen grid place-items-center px-4 text-center bg-jh-paper">
          <div className="card p-8 max-w-md">
            <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full bg-jh-red-soft text-jh-red text-2xl">⏰</div>
            <span className="eyebrow block mb-2">{E.eyebrow}</span>
            <h1 className="text-2xl mb-3">{E.title}</h1>
            <p className="text-jh-mute mb-6">{E.body}</p>
            <a href={E.meetupUrl} target="_blank" rel="noreferrer" className="btn-primary w-full">{E.ctaLabel}</a>
          </div>
        </div>
      );
    }

    // Used / not-found links keep the generic message, with the meetup as a fallback.
    const msg = reason === "used" ? t("auth.register.invalidUsed") : t("auth.register.invalidDefault");
    return (
      <div className="min-h-screen grid place-items-center px-4 text-center bg-jh-paper">
        <div className="card p-8 max-w-sm">
          <h1 className="text-2xl mb-2">{t("auth.register.invalidTitle")}</h1>
          <p className="text-jh-mute mb-5">{msg} {t("auth.register.invalidHelp")}</p>
          <a href={funnel.expired.meetupUrl} target="_blank" rel="noreferrer" className="btn-secondary w-full">{funnel.expired.ctaLabel}</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid place-items-center bg-jh-paper px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <Image src="/assets/logo-jobhackers.png" alt="JobHackers" width={150} height={40} className="mb-3" />
          <h1 className="text-2xl">{t("auth.register.brand")} <span className="text-jh-red">{t("auth.register.brandAccent")}</span></h1>
          <p className="text-jh-mute text-sm mt-1">{t("auth.register.subtitle")}</p>
        </div>
        <form onSubmit={submit} className="card p-6 space-y-4">
          <div><label className="label">{t("auth.shared.email")}</label>
            <input type="email" required className="field" value={email} disabled={!!lockedEmail}
              onChange={(e) => setEmail(e.target.value)} /></div>
          <div><label className="label">{t("auth.register.passwordLabel")}</label>
            <input type="password" required minLength={6} className="field" value={password}
              onChange={(e) => setPassword(e.target.value)} /></div>
          {err && <p className="text-sm text-jh-red">{err}</p>}
          <button disabled={busy} className="btn-primary w-full disabled:opacity-60">{busy ? t("auth.register.busy") : t("auth.register.submit")}</button>
        </form>
      </div>
    </div>
  );
}
