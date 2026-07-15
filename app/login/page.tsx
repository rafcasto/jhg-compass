"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Mail } from "lucide-react";
import {
  signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import { useAuth } from "@/components/AuthProvider";
import { useContent } from "@/lib/firestore/content";
import { track } from "@/lib/track-client";
import { TAGS } from "@/lib/tags";

type Mode = "signin" | "signup" | "reset";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { t } = useContent();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  // As soon as a session exists, leave the login screen.
  useEffect(() => {
    if (!loading && user) router.replace("/compass");
  }, [user, loading, router]);

  // While auth is resolving or a session already exists, show a redirect state
  // instead of the form — prevents the "button looks available" flash after login.
  if (loading || user) {
    return (
      <div className="min-h-screen grid place-items-center bg-jh-paper text-jh-mute">
        <span className="animate-pulse font-display font-semibold">{t("auth.login.redirecting")}</span>
      </div>
    );
  }

  function switchMode(next: Mode) {
    setMode(next); setErr(null); setMsg(null); setResetSent(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null); setMsg(null);
    try {
      if (mode === "signin") {
        await signInWithEmailAndPassword(auth, email, password);
        track(TAGS.LOGIN, { stage: "retention" });
      } else {
        // Self-serve sign-up (req 2): email + password only. The user is then
        // blocked by the email-verification gate, and completes their name during
        // onboarding (req 3). No access is granted here — that's separate.
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, "users", cred.user.uid), {
          email, createdAt: serverTimestamp(),
        });
        track(TAGS.REGISTRATION, { stage: "activation" });
      }
      // Keep the button disabled — the auth-state effect above handles the redirect.
      router.replace("/compass");
    } catch (e: any) {
      setErr(e?.message?.replace("Firebase:", "").trim() ?? "Something went wrong.");
      setBusy(false); // only re-enable on failure
    }
  }

  // Sends the reset link. Kept generic (no account enumeration) — the confirmation
  // is shown whether or not the address has an account.
  async function sendReset(e?: React.FormEvent) {
    e?.preventDefault();
    if (!email) return setErr(t("auth.login.enterEmailFirst"));
    setBusy(true); setErr(null); setMsg(null);
    try {
      const res = await fetch("/api/auth/request-reset", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      // If the branded (Resend) email failed, fall back to Firebase's built-in one.
      if (!res.ok) await sendPasswordResetEmail(auth, email);
      track(TAGS.PASSWORD_RESET, { stage: "retention" });
      setResetSent(true);
      setMsg(null);
    } catch (e: any) {
      setErr(e?.message ?? "Could not send reset email.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-jh-paper px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-7">
          <Image src="/assets/logo-jobhackers.png" alt="JobHackers" width={150} height={40} className="mb-4" />
          <h1 className="text-2xl">{t("auth.login.brand")} <span className="text-jh-red">{t("auth.login.brandAccent")}</span></h1>
          <p className="text-jh-mute text-sm mt-1">{t("auth.login.tagline")}</p>
        </div>

        {/* ---- Reset link sent: confirmation panel ---- */}
        {resetSent ? (
          <div className="card p-6 space-y-4 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-rb-green-dark/10">
              <Mail className="h-6 w-6 text-rb-green-dark" />
            </div>
            <div>
              <h2 className="text-xl">{t("auth.reset.sentTitle")}</h2>
              <p className="text-sm text-jh-mute mt-1">{t("auth.reset.sentBody")}</p>
            </div>
            <div className="rounded-[10px] bg-jh-mist px-4 py-3 text-left text-sm">
              <p className="font-display font-semibold text-jh-ink break-all">{email}</p>
              <p className="text-xs text-jh-mute-2 mt-1">{t("auth.reset.fromLabel")} {t("auth.reset.fromAddress")}</p>
            </div>
            <p className="text-xs text-jh-mute">{t("auth.reset.spamNote")}</p>
            {err && <p className="text-sm text-jh-red">{err}</p>}
            <div className="flex items-center justify-center gap-4 text-sm pt-1">
              <button type="button" className="link disabled:opacity-60" disabled={busy} onClick={() => sendReset()}>
                {busy ? t("auth.login.busy") : t("auth.reset.resend")}
              </button>
              <span className="text-jh-line-2">·</span>
              <button type="button" className="link" onClick={() => switchMode("signin")}>{t("auth.reset.back")}</button>
            </div>
          </div>

        /* ---- Forgot password: request a reset link ---- */
        ) : mode === "reset" ? (
          <form onSubmit={sendReset} className="card p-6 space-y-4">
            <div>
              <h2 className="text-xl">{t("auth.reset.title")}</h2>
              <p className="text-sm text-jh-mute mt-1">{t("auth.reset.body")}</p>
            </div>
            <div>
              <label className="label">{t("auth.shared.email")}</label>
              <input type="email" required autoFocus className="field" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            {err && <p className="text-sm text-jh-red">{err}</p>}
            <button type="submit" disabled={busy} className="btn-primary w-full disabled:opacity-60">
              {busy ? t("auth.login.busy") : t("auth.reset.send")}
            </button>
            <div className="text-center text-sm pt-1">
              <button type="button" className="link" onClick={() => switchMode("signin")}>{t("auth.reset.back")}</button>
            </div>
          </form>

        /* ---- Sign in / sign up ---- */
        ) : (
          <form onSubmit={submit} className="card p-6 space-y-4">
            <div>
              <label className="label">{t("auth.shared.email")}</label>
              <input type="email" required className="field" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="label">{t("auth.login.password")}</label>
              <input type="password" required minLength={6} className="field" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>

            {mode === "signup" && (
              <p className="text-xs text-jh-mute">{t("auth.login.signupNote")}</p>
            )}

            {err && <p className="text-sm text-jh-red">{err}</p>}
            {msg && <p className="text-sm text-rb-green-dark">{msg}</p>}

            <button type="submit" disabled={busy} className="btn-primary w-full disabled:opacity-60">
              {busy ? t("auth.login.busy") : mode === "signin" ? t("auth.login.signIn") : t("auth.login.createAccount")}
            </button>

            <div className="flex items-center justify-between text-sm pt-1">
              <button type="button" className="link" onClick={() => switchMode(mode === "signin" ? "signup" : "signin")}>
                {mode === "signin" ? t("auth.login.toSignup") : t("auth.login.toSignin")}
              </button>
              {mode === "signin" && (
                <button type="button" className="link" onClick={() => switchMode("reset")}>{t("auth.login.forgot")}</button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
