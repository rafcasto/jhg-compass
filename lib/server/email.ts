import "server-only";
import { Resend } from "resend";
import { adminAuth } from "@/lib/firebase/admin";
import { getAdminConfig } from "./grants";

function resend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY not set");
  return new Resend(key);
}

// Single sender for all transactional mail (set via RESEND_FROM), e.g.
// "JobHacker Compass Support <support@noreplay.jobhackers.global>".
const FROM = process.env.RESEND_FROM ?? "JobHacker Compass <onboarding@resend.dev>";

// Pull the bare address out of a "Name <email>" string (for reply-to).
function addressOf(from: string) {
  const m = from.match(/<([^>]+)>/);
  return (m ? m[1] : from).trim();
}

// Base URL of the deployed app, where our /set-password handler lives.
// APP_URL overrides (custom domains); otherwise Vercel provides the production
// domain automatically. Returns null when neither is set (e.g. local dev).
function appBaseUrl(): string | null {
  const explicit = process.env.APP_URL;
  if (explicit) return explicit.replace(/\/+$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;
  return null;
}

// Firebase mints action links that point at its default handler
// (…firebaseapp.com/__/auth/action). Rewrite them to our own /set-password page
// so users get the branded, design-system screen. The oobCode is all our page
// needs — confirmPasswordReset/applyActionCode work from any authorized domain.
function toAppActionLink(rawLink: string): string {
  const base = appBaseUrl();
  if (!base) return rawLink; // fall back to Firebase-hosted handler
  try {
    const src = new URL(rawLink);
    const dest = new URL("/set-password", base);
    for (const k of ["mode", "oobCode", "apiKey", "continueUrl", "lang"]) {
      const v = src.searchParams.get(k);
      if (v) dest.searchParams.set(k, v);
    }
    return dest.toString();
  } catch {
    return rawLink;
  }
}

// Shared branded shell for transactional emails.
function emailShell(intro: string, link: string, cta: string) {
  return `
    <div style="font-family:Roboto,Arial,sans-serif;color:#191c27;max-width:520px;margin:0 auto">
      <h1 style="font-family:Poppins,Arial;color:#191c27;font-size:24px">JobHacker <span style="color:#c2001f">Compass</span></h1>
      <p style="font-size:15px;line-height:1.6">${intro}</p>
      <p style="margin:28px 0">
        <a href="${link}" style="background:#c2001f;color:#fff;text-decoration:none;font-family:Poppins,Arial;font-weight:600;padding:14px 26px;border-radius:10px;display:inline-block">${cta}</a>
      </p>
      <p style="font-size:13px;color:#6b7280;line-height:1.6">This link expires after a short while for your security. If the button doesn't work, copy and paste this URL into your browser:<br><a href="${link}" style="color:#c2001f;word-break:break-all">${link}</a></p>
      <p style="font-size:13px;color:#6b7280">If you didn't request this, you can safely ignore this email.</p>
    </div>`;
}

// Sends a "set / reset your password" email via Resend using admin-editable copy (req 10.1).
// Uses Firebase Admin to mint a secure action link, rewritten to our /set-password page.
export async function sendPasswordEmail(email: string, mode: "set" | "reset" = "reset") {
  const cfg = await getAdminConfig();
  const link = toAppActionLink(await adminAuth().generatePasswordResetLink(email));

  const cta = mode === "set" ? "Set my password" : "Reset my password";

  return resend().emails.send({
    from: FROM,
    replyTo: addressOf(FROM),
    to: email,
    subject: cfg.pwResetSubject,
    html: emailShell(cfg.pwResetBody, link, cta),
  });
}

// Sends an email-verification email via Resend using admin-editable copy (req 2).
// Firebase Admin mints the secure verifyEmail action link; the same action handler
// page (/set-password) applies the code (mode=verifyEmail).
export async function sendVerificationEmail(email: string) {
  const cfg = await getAdminConfig();
  const link = toAppActionLink(await adminAuth().generateEmailVerificationLink(email));

  return resend().emails.send({
    from: FROM,
    replyTo: addressOf(FROM),
    to: email,
    subject: cfg.emailVerifySubject,
    html: emailShell(cfg.emailVerifyBody, link, "Verify my email"),
  });
}
