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
// Uses Firebase Admin to mint a secure action link. Reply-to matches the sender so
// recipients can reply if needed.
export async function sendPasswordEmail(email: string, mode: "set" | "reset" = "reset") {
  const cfg = await getAdminConfig();
  const link = await adminAuth().generatePasswordResetLink(email);

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
  const link = await adminAuth().generateEmailVerificationLink(email);

  return resend().emails.send({
    from: FROM,
    replyTo: addressOf(FROM),
    to: email,
    subject: cfg.emailVerifySubject,
    html: emailShell(cfg.emailVerifyBody, link, "Verify my email"),
  });
}
