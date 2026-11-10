"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Mic, MicOff } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { Sheet } from "@/components/tracker/Sheet";
import { paths, useLiveDoc } from "@/lib/firestore/db";
import { auth } from "@/lib/firebase/client";
import { COACH_TOTAL, coachForPage, coachStates, findCoach, missingBefore, pageOfPath } from "@/lib/engine/coach/keys";
import { applyEvent, emptyPending, parseEvent, type PendingTurn, type TranscriptTurn } from "@/lib/engine/coach/transcript";
import type { CoachSession } from "@/lib/engine/coach/session";
import type { CareerOpsSetupV2 } from "@/lib/careerops/types";
import type { ProfilePortal } from "@/lib/jobhacking/sections";
import Composer from "./Composer";
import Transcript from "./Transcript";
import VoiceStrip from "./VoiceStrip";
import { useVoice } from "./useVoice";
import { closeCoach, openCoach, useCoachUi } from "./store";

// The docked panel (docs/UX_COACH.md §3): the tracker's Sheet, docked right on desktop —
// no scrim, no scroll lock, the page stays live beside it — a full-height sheet on a
// phone. Mounted once in AppShell so it stays open across pages, and it FOLLOWS the page
// (decision 2026-11-10): on a page another coach writes, the panel switches to that coach
// (each has its own conversation, nothing is lost) and says so in one mute line; off the
// pages a coach writes, it closes. The transcript is the session document, live; the turn
// being written streams in from /api/coach/turn. Voice (§4) is a switch in the header.
export default function CoachPanel({ portal }: { portal: ProfilePortal }) {
  const ui = useCoachUi();
  const { user } = useAuth();
  const pathname = usePathname();
  const uid = user?.uid;
  const coach = findCoach(ui.coach);
  const { data: setup } = useLiveDoc<CareerOpsSetupV2>(uid ? paths.careerOpsSetup(uid) : null);
  const { data: session, loading: sessionLoading } = useLiveDoc<CoachSession>(uid && coach ? paths.coachSession(uid, coach.key) : null);

  const [pending, setPending] = useState<PendingTurn | null>(null);
  const [localTurns, setLocalTurns] = useState<TranscriptTurn[]>([]); // the member's words until the server echoes them
  const [error, setError] = useState<string | null>(null);
  const [quota, setQuota] = useState<string | null>(null);
  const [handoff, setHandoff] = useState<string | null>(null);
  const busy = useRef(false);
  const started = useRef<string | null>(null);
  const voiceRef = useRef<ReturnType<typeof useVoice> | null>(null);

  const send = useCallback(async (text: string | null) => {
    if (!coach || busy.current) return;
    busy.current = true;
    setError(null); setHandoff(null);
    setPending(emptyPending());
    voiceRef.current?.resetSpeech();
    if (text) setLocalTurns((t) => [...t, { role: "member", text, at: Date.now() }]);
    try {
      const token = await auth.currentUser!.getIdToken();
      const page = pageOfPath(pathname);
      // Read at send time rather than through useSearchParams: this component is mounted in a layout, where that hook would need its own Suspense boundary.
      const section = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("section") : null;
      const res = await fetch("/api/coach/turn", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ coach: coach.key, portal, ...(text ? { text } : { start: true }), context: { page, section, voice: voiceRef.current?.on ?? false } }),
      });
      if (!res.ok || !res.body) {
        const d = await res.json().catch(() => ({}));
        if (res.status === 429) setQuota(d.error ?? null); else setError(d.error ?? "The coach couldn't answer — try again.");
        setPending(null);
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let text_ = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i: number;
        while ((i = buf.indexOf("\n\n")) >= 0) {
          const frame = buf.slice(0, i); buf = buf.slice(i + 2);
          const line = frame.split("\n").find((l) => l.startsWith("data: "));
          const ev = line ? parseEvent(line.slice(6)) : null;
          if (!ev) continue;
          if (ev.type === "error") setError(ev.message);
          else if (ev.type === "done") { setPending(null); setLocalTurns([]); voiceRef.current?.speakStream(ev.turn.text, true); }
          else { if (ev.type === "text") { text_ += ev.text; voiceRef.current?.speakStream(text_, false); } setPending((p) => applyEvent(p ?? emptyPending(), ev)); }
        }
      }
    } catch {
      setError("Lost the connection — try again.");
    } finally {
      setPending((p) => (p && !p.text && !p.writes.length ? null : p));
      busy.current = false;
    }
  }, [coach, pathname, portal]);

  const voice = useVoice({ onSend: (t) => void send(t) });
  voiceRef.current = voice;

  // Follow the page: another coach's page → that coach; no coach's page → close. Never mid-turn.
  useEffect(() => {
    if (!ui.open) return;
    const pageCoach = coachForPage(pageOfPath(pathname));
    if (!pageCoach) { closeCoach(); return; }
    if (coach && pageCoach.key !== coach.key && !busy.current) {
      openCoach(pageCoach.key);
      setHandoff(`Now with ${pageCoach.label} — ${coach.label} is saved where you left it.`);
      setPending(null); setLocalTurns([]); setError(null);
      started.current = null;
    }
  }, [pathname, ui.open, coach]);

  // A conversation that has not started yet starts itself: the coach opens (docs/UX_COACH.md §3).
  const states = coachStates(setup?.jhg?.progress);
  const missing = coach ? missingBefore(coach, states) : [];
  useEffect(() => {
    if (!ui.open || !coach || !coach.ready || sessionLoading || missing.length) return;
    if ((session?.turns?.length ?? 0) > 0 || started.current === coach.key) return;
    started.current = coach.key;
    void send(null);
  }, [ui.open, coach, sessionLoading, session?.turns?.length, missing.length, send]);

  if (!ui.open || !coach) return null;
  const turns: TranscriptTurn[] = [...(session?.turns ?? []), ...localTurns];
  const complete = states[coach.key] === "complete";
  const canTalk = coach.ready && !missing.length && !quota;

  const footer = !canTalk ? undefined : voice.on
    ? <VoiceStrip listening={voice.listening} speaking={voice.speaking} thinking={!!pending && !pending.text} interim={voice.interim} error={voice.error} onInterrupt={voice.interrupt} onTypeInstead={voice.toggle} />
    : <Composer onSend={(t) => void send(t)} disabled={!!pending} placeholder={complete ? "Anything to change?" : "Type your answer…"} />;

  return (
    <Sheet
      dock="right"
      eyebrow={`Coach ${coach.n} of ${COACH_TOTAL}`}
      title={coach.label}
      onClose={closeCoach}
      bodyClassName="bg-white"
      headerActions={voice.supported && canTalk ? (
        <button type="button" onClick={voice.toggle} aria-pressed={voice.on} aria-label={voice.on ? "Stop the voice conversation" : "Talk instead of typing"} title={voice.on ? "Voice on" : "Voice"}
          className={`icon-btn icon-btn-tight ${voice.on ? "bg-jh-ink text-white hover:bg-jh-ink hover:text-white" : ""}`}>
          {voice.on ? <Mic className="h-5 w-5" strokeWidth={1.75} aria-hidden /> : <MicOff className="h-5 w-5" strokeWidth={1.5} aria-hidden />}
        </button>
      ) : undefined}
      footer={footer}
    >
      {handoff && <p role="status" className="mb-4 text-sm text-jh-mute">{handoff}</p>}
      {!coach.ready ? (
        <p className="text-sm text-jh-mute">{coach.label} is on its way — Coach {coach.n} is being built. {coach.outcome}</p>
      ) : missing.length ? (
        <p className="text-sm text-jh-mute">{coach.label} starts after {missing.map((c) => c.label).join(" and ")} — your coach needs what they write first.</p>
      ) : (
        <Transcript turns={turns} pending={pending} error={error} quota={quota} />
      )}
    </Sheet>
  );
}
