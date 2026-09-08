"use client";

import { useEffect, useState } from "react";
import { BarChart3 } from "lucide-react";
import { authed, Loading, SubTabs, TabHeader } from "@/components/admin/shared";
import { ANALYTICS_SUBTABS, type AnalyticsSub } from "@/components/admin/nav";
import QuizResults, { type Analytics } from "./QuizResults";
import Segments from "./Segments";
import PirateMetrics from "./PirateMetrics";
import UsageTab from "./UsageTab";

export default function AnalyticsTab({ sub, onSub }: { sub: AnalyticsSub; onSub: (s: AnalyticsSub) => void }) {
  const [data, setData] = useState<Analytics | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    authed("/api/admin/analytics").then((r) => r.json()).then((d) => (d.ok ? setData(d) : setErr(true))).catch(() => setErr(true));
  }, []);

  const needsQuiz = sub === "quiz" || sub === "segments";
  return (
    <div className="space-y-6">
      <TabHeader icon={BarChart3} title="Analytics"
        intro="From quiz answers to segments to the AAARRR funnel — one place to see how the funnel performs." />
      <SubTabs items={ANALYTICS_SUBTABS} value={sub} onChange={onSub} ariaLabel="Analytics sections" />
      {needsQuiz && err && <p className="text-jh-red">Couldn’t load quiz analytics. Try again.</p>}
      {needsQuiz && !err && !data && <Loading>Loading analytics…</Loading>}
      {data && sub === "quiz" && <QuizResults data={data} />}
      {data && sub === "segments" && <Segments data={data} />}
      {sub === "pirate" && <PirateMetrics />}
      {sub === "usage" && <UsageTab />}
    </div>
  );
}
