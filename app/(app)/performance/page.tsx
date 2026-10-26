"use client";

import { deleteField } from "firebase/firestore";
import { useAuth } from "@/components/AuthProvider";
import {
  paths, createDoc, updateRecord, deleteRecord, setDoc, useLiveCollection, useLiveDoc,
} from "@/lib/firestore/db";
import { useContent } from "@/lib/firestore/content";
import type { ActivityLog } from "@/lib/types";
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
      onSaveTargets={async ({ set, unset }) => {
        if (!uid) return;
        // Overrides are a WEEKLY number per row. A row put back on the admin default
        // loses its override (deleteField) so later admin changes reach it again.
        const targets: Record<string, unknown> = { ...set };
        for (const id of unset) targets[id] = deleteField();
        await setDoc(paths.settingsTargets(uid), { targets }, { merge: true });
        for (const [categoryId, value] of Object.entries(set)) track(TAGS.SET_TARGET, { props: { categoryId, period: "week", value } });
        for (const categoryId of unset) track(TAGS.SET_TARGET, { props: { categoryId, period: "week", value: weeklyTargets[categoryId] ?? 0 } });
      }}
    />
  );
}
