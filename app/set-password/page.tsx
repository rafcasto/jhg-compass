"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import { CheckCircle2 } from "lucide-react";
import { confirmPasswordReset, applyActionCode } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { useContent } from "@/lib/firestore/content";

// Shared brand shell so these auth screens match /login (req 12: design system).
function AuthShell({ children }: { children: React.ReactNode }) {
  const { t } = useContent();
  return (
    <div className="min-h-screen grid place-items-center bg-jh-paper px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-7">
          <Image src="/assets/logo-jobhackers.png" alt="JobHackers" width={150} height={40} className="mb-4" />
          <h1 className="text-2xl">{t("auth.login.brand")} <span className="text-jh-red">{t("auth.login.brandAccent")}</span></h1>
          <p className="text-jh-mute text-sm mt-1">{t("auth.login.tagline")}</p>
        </div>
        {children}
      </div>
    </div>
  );
}

// A success panel matching the login "reset sent" style.
function SuccessCard({ title, body, cta, onContinue }: {
  title: string; body: string; cta: string; onContinue: () => void;
}) {
  return (
    <div className="card p-6 space-y-4 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-rb-green-dark/10">
        <CheckCircle2 className="h-6 w-6 text-rb-green-dark" />
      </div>
      <div>
        <h2 className="text-xl">{title}</h2>
        <p className="text-sm text-jh-mute mt-1">{body}</p>
      </div>
      <button onClick={onContinue} className="btn-primary w-full">{cta}</button>
    </div>
  );
}

// Landing page for the Firebase action link emailed via Resend (?oobCode=...).
// Handles both password actions (resetPassword/recoverEmail) and email verification
// (mode=verifyEmail) since the Firebase console action URL is shared across modes.
function ActionHandlerInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { t } = useContent();
  const oobCode = params.get("oobCode");
  const mode = params.get("mode");

  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [verifying, setVerifying] = useState(mode === "verifyEmail");

  const goLogin = () => router.replace("/login");

  // Email verification: apply the code automatically on load.
  useEffect(() => {
    if (mode !== "verifyEmail") return;
    if (!oobCode) { setErr("Invalid or expired link."); setVerifying(false); return; }
    applyActionCode(auth, oobCode)
      .then(async () => {
        // refresh the local session so emailVerified flips to true
        if (auth.currentUser) await auth.currentUser.reload().catch(() => {});
        setDone(true);
        setTimeout(() => router.replace("/login"), 1600);
      })
      .catch((e: any) => setErr(e?.message?.replace("Firebase:", "").trim() ?? "Could not verify email."))
      .finally(() => setVerifying(false));
  }, [mode, oobCode, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!oobCode) return setErr("Invalid or expired link.");
    setBusy(true); setErr(null);
    try {
      await confirmPasswordReset(auth, oobCode, password);
      setDone(true);
      // Redirect to the login page once the password is set (auto + manual button).
      setTimeout(() => router.replace("/login"), 1500);
    } catch (e: any) {
      setErr(e?.message?.replace("Firebase:", "").trim() ?? "Could not set password.");
    } finally { setBusy(false); }
  }

  // ---- Email verification view ----
  if (mode === "verifyEmail") {
    return (
      <AuthShell>
        {done ? (
          <SuccessCard
            title={t("auth.verifyLink.title")}
            body={t("auth.verifyLink.done")}
            cta={t("auth.setpw.continue")}
            onContinue={goLogin}
          />
        ) : (
          <div className="card p-6 text-center space-y-3">
            <h2 className="text-xl">{t("auth.verifyLink.title")}</h2>
            {verifying && <p className="text-jh-mute text-sm animate-pulse">{t("auth.verifyLink.verifying")}</p>}
            {err && <p className="text-sm text-jh-red">{err}</p>}
          </div>
        )}
      </AuthShell>
    );
  }

  // ---- Password set / reset view ----
  return (
    <AuthShell>
      {done ? (
        <SuccessCard
          title={t("auth.setpw.doneTitle")}
          body={t("auth.setpw.done")}
          cta={t("auth.setpw.continue")}
          onContinue={goLogin}
        />
      ) : (
        <form onSubmit={submit} className="card p-6 space-y-4">
          <div>
            <h2 className="text-xl">{t("auth.setpw.title")}</h2>
            <p className="text-sm text-jh-mute mt-1">{t("auth.setpw.body")}</p>
          </div>
          <div>
            <label className="label">{t("auth.setpw.label")}</label>
            <input type="password" minLength={6} required autoFocus className="field"
              value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {err && <p className="text-sm text-jh-red">{err}</p>}
          <button disabled={busy} className="btn-primary w-full disabled:opacity-60">
            {busy ? t("auth.login.busy") : t("auth.setpw.submit")}
          </button>
        </form>
      )}
    </AuthShell>
  );
}

export default function SetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen grid place-items-center bg-jh-paper text-jh-mute">Loading…</div>}>
      <ActionHandlerInner />
    </Suspense>
  );
}
