"use client";

import { usePathname } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { paths, useLiveDoc } from "@/lib/firestore/db";
import { coachForPage, coachShowsOn, coachStates, launcherLabel, nextCoach, pageOfPath } from "@/lib/engine/coach/keys";
import type { CareerOpsSetupV2 } from "@/lib/careerops/types";
import type { CoachSession } from "@/lib/engine/coach/session";
import type { ProfilePortal } from "@/lib/jobhacking/sections";
import { openCoach, useCoachUi } from "./store";

// The floating coach (docs/UX_COACH.md §3): a 56 px ink disc, bottom-right of every
// JobHacking / Settings page, that opens the panel on the coach for the page you are on.
// Ink, not red — red is the page's primary action; the one red here is a 6 px dot when the
// coach has asked something and is waiting. shadow-jh-3: the one floating element. Hidden
// while the panel is open (the panel's × brings it back) and off the pages it has nothing to say on.
export default function CoachLauncher({ portal }: { portal: ProfilePortal }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const ui = useCoachUi();
  const uid = user?.uid;
  const { data: setup } = useLiveDoc<CareerOpsSetupV2>(uid ? paths.careerOpsSetup(uid) : null);
  const states = coachStates(setup?.jhg?.progress);
  const coach = coachForPage(pageOfPath(pathname)) ?? nextCoach(states);
  const { data: session } = useLiveDoc<CoachSession>(uid ? paths.coachSession(uid, coach.key) : null);

  if (!coachShowsOn(pathname) || ui.open) return null;
  const state = states[coach.key];
  const label = launcherLabel(coach, states);
  const showTail = !ui.tailSeen && state !== "complete";
  // Your turn: the last thing in the transcript is the coach asking.
  const waiting = (session?.turns?.length ?? 0) > 0 && session!.turns[session!.turns.length - 1].role === "coach" && state !== "complete";

  // Sits above the mobile tab bar (MOBILE_TABBAR_HEIGHT = 58) and the home bar; 24 px in from the corner on desktop.
  return (
    <button
      type="button"
      onClick={() => openCoach(coach.key)}
      aria-label={label}
      className={`fixed right-4 z-40 flex h-14 items-center gap-3 rounded-pill bg-jh-ink text-white shadow-jh-3 transition-[box-shadow,transform] duration-200 ease-out hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jh-ink bottom-[calc(58px+env(safe-area-inset-bottom,0px)+1rem)] md:bottom-6 md:right-6 ${showTail ? "pl-4 pr-5" : "w-14 justify-center"}`}
      data-coach={coach.key}
    >
      <span className="relative grid h-6 w-6 place-items-center">
        <MessageSquare className="h-6 w-6" strokeWidth={1.75} aria-hidden />
        {waiting && <span className="absolute -right-1 -top-1 h-1.5 w-1.5 rounded-full bg-jh-red" aria-hidden />}
      </span>
      {showTail && <span className="font-display text-[15px] font-semibold">{label}</span>}
    </button>
  );
}
