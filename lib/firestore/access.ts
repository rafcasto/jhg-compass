"use client";

import { useEffect, useState } from "react";
import { onSnapshot } from "firebase/firestore";
import { paths } from "./db";
import type { AccessGrant, AdminConfig } from "@/lib/types";

export interface AccessState {
  loading: boolean;
  grant: AccessGrant | null;
  hasAccess: boolean;
  daysLeft: number | null;
}

function computeHasAccess(g: AccessGrant | null): { ok: boolean; daysLeft: number | null } {
  if (!g) return { ok: false, daysLeft: null };
  const now = Date.now();
  if (g.status !== "active") return { ok: false, daysLeft: null };
  if (g.startsAt && g.startsAt > now) return { ok: false, daysLeft: null };
  if (g.expiresAt && g.expiresAt <= now) return { ok: false, daysLeft: 0 };
  const daysLeft = g.expiresAt ? Math.ceil((g.expiresAt - now) / 86_400_000) : null;
  return { ok: true, daysLeft };
}

export function useAccess(uid: string | undefined): AccessState {
  const [grant, setGrant] = useState<AccessGrant | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(
      paths.grant(uid),
      (snap) => {
        setGrant(snap.exists() ? (snap.data() as AccessGrant) : null);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, [uid]);

  const { ok, daysLeft } = computeHasAccess(grant);
  return { loading, grant, hasAccess: ok, daysLeft };
}

export const DEFAULT_ADMIN_CONFIG: AdminConfig = {
  paywallTitle: "Your access has ended",
  paywallBody:
    "Your JobHacker Compass access period is over. Renew to keep tracking your job-search momentum.",
  paywallCtaLabel: "Renew access",
  paywallCtaUrl: "https://jobhackers.global",
  pwResetSubject: "Set your JobHacker Compass password",
  pwResetBody: "Click the button below to set your password and start tracking.",
  emailVerifySubject: "Verify your email — JobHacker Compass",
  emailVerifyBody:
    "Welcome aboard! Confirm your email address to unlock your JobHacker Compass and start your job search the smart way.",
};

export function useAdminConfig(): AdminConfig {
  const [cfg, setCfg] = useState<AdminConfig>(DEFAULT_ADMIN_CONFIG);
  useEffect(() => {
    const unsub = onSnapshot(paths.adminConfig(), (snap) => {
      if (snap.exists()) setCfg({ ...DEFAULT_ADMIN_CONFIG, ...(snap.data() as AdminConfig) });
    });
    return () => unsub();
  }, []);
  return cfg;
}
