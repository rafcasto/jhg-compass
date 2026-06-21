"use client";

import { useEffect, useState } from "react";
import { MailCheck, RefreshCw } from "lucide-react";
import { updateEmail } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { useAuth } from "@/components/AuthProvider";
import { paths, setDoc } from "@/lib/firestore/db";

// Full-screen gate shown after sign-up until the user verifies their email (req 2).
// Lets them resend the verification email and fix a wrong email address.
export default function VerifyEmail() {
  const { user, reloadUser, signOut } = useAuth();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [checking, setChecking] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [newEmail, setNewEmail] = useState("");

  // Send a verification email on first mount.
  useEffect(() => {
    void resend(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function resend(silent = false) {
    if (!user) return;
    setSending(true); setErr(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/auth/send-verification", {
        method: "POST", headers: { authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      if (!silent) setSent(true);
    } catch {
      if (!silent) setErr("Could not send the email. Try again in a moment.");
    } finally {
      setSending(false);
    }
  }

  async function checkVerified() {
    setChecking(true); setErr(null);
    await reloadUser();
    setChecking(false);
    if (auth.currentUser && !auth.currentUser.emailVerified) {
      setErr("Not verified yet — click the link in your email, then try again.");
    }
  }

  async function saveEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !newEmail) return;
    setErr(null);
    try {
      await updateEmail(auth.currentUser!, newEmail.trim());
      await setDoc(paths.profile(user.uid), { email: newEmail.trim() }, { merge: true });
      await reloadUser();
      setEditing(false);
      setNewEmail("");
      await resend();
      setSent(true);
    } catch (e: any) {
      const code = e?.code as string | undefined;
      setErr(
        code === "auth/requires-recent-login"
          ? "For security, please sign out and sign back in, then change your email."
          : code === "auth/email-already-in-use"
          ? "That email is already in use."
          : code === "auth/invalid-email"
          ? "That doesn't look like a valid email."
          : "Could not update your email. Try again."
      );
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-jh-ink/70 backdrop-blur-sm p-4">
      <div className="card max-w-md w-full p-8 text-center">
        <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full bg-jh-red-soft">
          <MailCheck className="h-7 w-7 text-jh-red" />
        </div>
        <h2 className="mb-2">Verify your email</h2>
        <p className="text-jh-mute mb-1">We sent a verification link to</p>
        <p className="font-display font-semibold text-jh-ink mb-6 break-all">{user?.email}</p>

        {sent && <p className="text-sm text-rb-green-dark mb-4">Verification email sent ✓</p>}
        {err && <p className="text-sm text-jh-red mb-4">{err}</p>}

        <button onClick={checkVerified} disabled={checking} className="btn-primary w-full disabled:opacity-60">
          <RefreshCw className={`h-4 w-4 ${checking ? "animate-spin" : ""}`} /> I&apos;ve verified — continue
        </button>

        <button onClick={() => resend()} disabled={sending} className="btn-secondary mt-3 w-full text-sm disabled:opacity-60">
          {sending ? "Sending…" : "Resend verification email"}
        </button>

        {!editing ? (
          <button onClick={() => { setEditing(true); setNewEmail(user?.email ?? ""); }} className="link mt-4 text-sm">
            Wrong email? Change it
          </button>
        ) : (
          <form onSubmit={saveEmail} className="mt-4 space-y-2 text-left">
            <label className="label">New email address</label>
            <input type="email" required className="field" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
            <div className="flex gap-2">
              <button type="submit" className="btn-primary flex-1 text-sm">Update &amp; resend</button>
              <button type="button" onClick={() => setEditing(false)} className="btn-ghost flex-1 text-sm">Cancel</button>
            </div>
          </form>
        )}

        <button onClick={() => signOut()} className="btn-ghost mt-4 w-full text-sm">Sign out</button>
      </div>
    </div>
  );
}
