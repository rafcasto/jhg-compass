"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { confirmPasswordReset, applyActionCode } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { useContent } from "@/lib/firestore/content";

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
      setTimeout(() => router.replace("/login"), 1500);
    } catch (e: any) {
      setErr(e?.message?.replace("Firebase:", "").trim() ?? "Could not set password.");
    } finally { setBusy(false); }
  }

  // ---- Email verification view ----
  if (mode === "verifyEmail") {
    return (
      <div className="min-h-screen grid place-items-center px-4">
        <div className="card p-8 w-full max-w-sm text-center space-y-3">
          <h1 className="text-2xl">{t("auth.verifyLink.title")}</h1>
          {verifying && <p className="text-jh-mute animate-pulse">{t("auth.verifyLink.verifying")}</p>}
          {done && <p className="text-rb-green-dark text-sm">{t("auth.verifyLink.done")}</p>}
          {err && <p className="text-sm text-jh-red">{err}</p>}
        </div>
      </div>
    );
  }

  // ---- Password set / reset view ----
  return (
    <div className="min-h-screen grid place-items-center px-4">
      <form onSubmit={submit} className="card p-6 w-full max-w-sm space-y-4">
        <h1 className="text-2xl">{t("auth.setpw.title")}</h1>
        {done ? (
          <p className="text-rb-green-dark text-sm">{t("auth.setpw.done")}</p>
        ) : (
          <>
            <div>
              <label className="label">{t("auth.setpw.label")}</label>
              <input type="password" minLength={6} required className="field" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {err && <p className="text-sm text-jh-red">{err}</p>}
            <button disabled={busy} className="btn-primary w-full disabled:opacity-60">{busy ? "…" : t("auth.setpw.submit")}</button>
          </>
        )}
      </form>
    </div>
  );
}

export default function SetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen grid place-items-center text-jh-mute">Loading…</div>}>
      <ActionHandlerInner />
    </Suspense>
  );
}
