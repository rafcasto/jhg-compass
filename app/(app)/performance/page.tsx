"use client";

import { useAuth } from "@/components/AuthProvider";
import {
  paths, createDoc, updateRecord, deleteRecord, setDoc, useLiveCollection, useLiveDoc,
} from "@/lib/firestore/db";
import { useContent } from "@/lib/firestore/content";
import type { ActivityLog } from "@/lib/types";
import { withTargetEdits } from "@/lib/targets";
import { track } from "@/lib/track-client";
import { TAGS } from "@/lib/tags";
import PerformanceScreen from "@/components/performance/PerformanceScreen";

// Data plumbing only — the screen itself lives in components/performance so the
// admin CMS can preview it with draft copy.
export default function PerformancePage() {
  const { user } = useAuth();
  const uid = user?.uid;
  const { t, hidden, visible, weeklyTargets, effortSplit } = useContent();

  const { data: logs } = useLiveCollection<ActivityLog>(uid, paths.activityLogs, "createdAt");
  const { data: targetDoc } = useLiveDoc<{ targets: Record<string, number> }>(uid ? paths.settingsTargets(uid) : null);
  const userTargets = targetDoc?.targets ?? {};

  return (
    <PerformanceScreen
      t={t} hidden={hidden} visible={visible} effortSplit={effortSplit}
      weeklyTargets={weeklyTargets} userTargets={userTargets} logs={logs}
      onLog={async (categoryId, loggedOn, period) => {
        if (!uid) return;
        await createDoc(paths.activityLogs(uid), { categoryId, loggedOn, count: 1 });
        track(TAGS.LOG_ACTIVITY, { props: { categoryId, period } });
      }}
      onUnlog={async (latest, period) => {
        if (!uid) return;
        if ((latest.count ?? 1) > 1) await updateRecord(uid, "activityLogs", latest.id, { count: (latest.count ?? 1) - 1 });
        else await deleteRecord(uid, "activityLogs", latest.id);
        track(TAGS.UNLOG_ACTIVITY, { props: { categoryId: latest.categoryId, period } });
      }}
      onSetWeeklyTarget={async (categoryId, weekly, { period, value }) => {
        if (!uid) return;
        await setDoc(paths.settingsTargets(uid), { targets: withTargetEdits(userTargets, { [categoryId]: weekly }) }, { merge: true });
        track(TAGS.SET_TARGET, { props: { categoryId, period, value } });
      }}
    />
  );
}
