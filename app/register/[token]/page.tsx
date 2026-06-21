"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase/client";

export default function RegisterPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [state, setState] = useState<"checking" | "ok" | "invalid">("checking");
  const [reason, setReason] = useState<string>();
  const [lockedEmail, setLockedEmail] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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
        const map: Record<string, string> = {
          expired: "This link has expired.", used: "This link has already been used.",
          email_mismatch: "This link is for a different email address.",
          weak_password: "Password must be at least 6 characters.",
        };
        throw new Error(map[d.error] ?? "Could not complete registration.");
      }
      await signInWithEmailAndPassword(auth, email, password);
      // keep the button disabled while we navigate — avoids a re-enable flash
      router.replace("/compass");
    } catch (e: any) {
      setErr(e?.message ?? "Something went wrong.");
      setBusy(false); // only re-enable on failure
    }
  }

  if (state === "checking")
    return <div className="min-h-screen grid place-items-center text-jh-mute animate-pulse">Checking your invite…</div>;

  if (state === "invalid") {
    const msg = reason === "expired" ? "This registration link has expired."
      : reason === "used" ? "This registration link has already been used."
      : "This registration link is invalid.";
    return (
      <div className="min-h-screen grid place-items-center px-4 text-center">
        <div className="card p-8 max-w-sm">
          <h1 className="text-2xl mb-2">Link unavailable</h1>
          <p className="text-jh-mute">{msg} Ask your JobHackers admin for a fresh invite.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid place-items-center bg-jh-paper px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <Image src="/assets/logo-jobhackers.png" alt="JobHackers" width={150} height={40} className="mb-3" />
          <h1 className="text-2xl">Create your <span className="text-jh-red">Compass</span></h1>
          <p className="text-jh-mute text-sm mt-1">You've been invited — 90 days of access await.</p>
        </div>
        <form onSubmit={submit} className="card p-6 space-y-4">
          <div><label className="label">Email</label>
            <input type="email" required className="field" value={email} disabled={!!lockedEmail}
              onChange={(e) => setEmail(e.target.value)} /></div>
          <div><label className="label">Choose a password</label>
            <input type="password" required minLength={6} className="field" value={password}
              onChange={(e) => setPassword(e.target.value)} /></div>
          {err && <p className="text-sm text-jh-red">{err}</p>}
          <button disabled={busy} className="btn-primary w-full disabled:opacity-60">{busy ? "Creating account…" : "Create Account"}</button>
        </form>
      </div>
    </div>
  );
}
