"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { confirmPasswordReset } from "firebase/auth";
import { auth } from "@/lib/firebase/client";

// Landing page for the Firebase action link emailed via Resend (?oobCode=...).
function SetPasswordInner() {
  const params = useSearchParams();
  const router = useRouter();
  const oobCode = params.get("oobCode");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

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

  return (
    <div className="min-h-screen grid place-items-center px-4">
      <form onSubmit={submit} className="card p-6 w-full max-w-sm space-y-4">
        <h1 className="text-2xl">Set your password</h1>
        {done ? (
          <p className="text-rb-green-dark text-sm">Password set! Redirecting to sign in…</p>
        ) : (
          <>
            <div>
              <label className="label">New password</label>
              <input type="password" minLength={6} required className="field" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {err && <p className="text-sm text-jh-red">{err}</p>}
            <button disabled={busy} className="btn-primary w-full disabled:opacity-60">{busy ? "…" : "Set password"}</button>
          </>
        )}
      </form>
    </div>
  );
}

export default function SetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen grid place-items-center text-jh-mute">Loading…</div>}>
      <SetPasswordInner />
    </Suspense>
  );
}
