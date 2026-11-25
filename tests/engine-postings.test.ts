import { describe, it, expect } from "vitest";
import { ENGINE_JOB_AGENT, ENGINE_JOB_LABELS, ENGINE_JOB_TYPES, isEngineJobType } from "@/lib/engine/keys";
import { POSTINGS_TARGET, PostingsSchema, dedupePostings, postingsPayload, postingsPayloadEmpty, postingsSummary, postingsTask, toProfilePostings, urlWasFound } from "@/lib/engine/research/postings";
import { COACH_RESEARCH, RUN_RESEARCH, coachTools, isResearchKind, runResearchTool } from "@/lib/engine/coach/tools";
import { applyEvent, emptyPending } from "@/lib/engine/coach/transcript";
import { contextNote, landedSince } from "@/lib/engine/coach/turn";
import { COACH_PROMPTS } from "@/lib/engine/coach/prompts";
import { POSTINGS_PROMPT } from "@/lib/engine/prompts/postings";

// Research as a job (docs/COACH_ASSESSMENT_2026-11-16.md §1.2, docs/AGENTIC_PIPELINE_PLAN.md §4): the postings
// job — the engine's first CareerOps module — its brief, its answer, what counts, and how the coach hears of it.

describe("the postings job", () => {
  it("is a job type on the researcher agent", () => {
    expect(ENGINE_JOB_TYPES).toContain("postings");
    expect(isEngineJobType("postings")).toBe(true);
    expect(ENGINE_JOB_AGENT.postings).toBe("researcher");
    expect(ENGINE_JOB_LABELS.postings).toBe("Reading postings");
  });

  it("searches from the Narrative's competencies and the goal's city, the coach's hints over them", () => {
    const p = postingsPayload({ version: 1, goal: { city: "Auckland, New Zealand" }, narrative: { superpowers: ["Product discovery", "Stakeholder alignment", "Roadmaps"] } });
    expect(p).toEqual({ competencies: ["Product discovery", "Stakeholder alignment", "Roadmaps"], titles: [], region: "Auckland, New Zealand", portal: "jobhacking", boards: [] });
    const h = postingsPayload({ version: 1, jhg: { identity: { city: "Wellington", country: "NZ" }, trueNorth: { titles: { target: ["Product Manager"] } } } }, { boards: ["Seek", "LinkedIn"], portal: "compass", region: " Sydney " });
    expect(h.region).toBe("Sydney");
    expect(h.titles).toEqual(["Product Manager"]);
    expect(h.boards).toEqual(["Seek", "LinkedIn"]);
    expect(h.portal).toBe("compass");
    expect(postingsPayloadEmpty(h)).toBe(false);
    expect(postingsPayloadEmpty(postingsPayload({ version: 1 }))).toBe(true);
    expect(postingsPayload({ version: 1, jhg: { identity: { city: "Wellington", country: "NZ" } } }).region).toBe("Wellington, NZ");
    const task = postingsTask(p, "2026-11-16");
    expect(task).toContain("Region: Auckland, New Zealand.");
    expect(task).toContain(`Return ${POSTINGS_TARGET.min}–${POSTINGS_TARGET.max} postings.`);
  });

  it("counts a posting once, only with an absolute URL, and only when search returned it or it opened", () => {
    const rows = dedupePostings([
      { title: "Product Manager", company: "Acme", location: "Auckland", url: "https://acme.example/jobs/1", phrases: ["ship", " outcomes ", "x", "y"] },
      { title: "product manager", company: "ACME", location: "Auckland ", url: "https://acme.example/jobs/1-copy", phrases: [] },
      { title: "PM", company: "Beta", location: "Remote", url: "acme.example/jobs/2", phrases: [] },
      { title: "", company: "Gamma", location: "", url: "https://g.example/1", phrases: [] },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].phrases).toEqual(["ship", "outcomes", "x"]);
    const sources = [{ url: "https://acme.example/jobs/1/" }, { url: "https://seek.example/job/9?ref=search" }];
    expect(urlWasFound("https://acme.example/jobs/1", sources)).toBe(true);
    expect(urlWasFound("https://seek.example/job/9", sources)).toBe(true);
    expect(urlWasFound("https://acme.example/jobs/2", sources)).toBe(false);
    const stored = toProfilePostings(rows, "2026-11-16");
    expect(stored[0]).toEqual({ title: "Product Manager", company: "Acme", location: "Auckland", url: "https://acme.example/jobs/1", phrases: ["ship", "outcomes", "x"], verified: "2026-11-16" });
    expect(PostingsSchema.safeParse({ postings: [], note: "" }).success).toBe(true);
  });

  it("hands the coach a table, never the pages", () => {
    const s = postingsSummary([{ title: "PM", company: "Acme", location: "Auckland", url: "https://a.example/1", phrases: ["a", "b"], verified: "2026-11-16" }], 2, "Seek was thin.");
    expect(s.split("\n")[0]).toBe("1 postings opened and written to jhg.trueNorth.postings (2 dropped: dead or duplicate links). Seek was thin.");
    expect(s).toContain("| 1 | PM | Acme | Auckland | https://a.example/1 | a; b |");
    expect(POSTINGS_PROMPT).toContain("Never construct, shorten or guess a URL");
  });
});

describe("run_research — the coach starts a job, not a search", () => {
  it("is True North's tool, for postings, beside update_profile — fixed for the conversation", () => {
    expect(COACH_RESEARCH.trueNorth).toEqual(["postings"]);
    expect(runResearchTool("narrative")).toBeNull();
    const t = runResearchTool("trueNorth")!;
    expect(t.name).toBe(RUN_RESEARCH);
    expect((t.input_schema.properties.kind as { enum: string[] }).enum).toEqual(["postings"]);
    expect(coachTools("trueNorth").map((x) => x.name)).toEqual(["update_profile", "run_research"]);
    expect(coachTools("linkedin").map((x) => x.name)).toEqual(["update_profile"]);
    expect(isResearchKind("postings")).toBe(true);
    expect(isResearchKind("companies")).toBe(true);
    expect(COACH_RESEARCH.targetCompanies).toEqual(["companies"]);
    expect(COACH_PROMPTS.trueNorth.text).toContain('run_research with kind "postings"');
    expect(COACH_PROMPTS.trueNorth.text).not.toContain("You do the research, in this conversation");
    expect(COACH_PROMPTS.trueNorth.version).toBe(6);
  });

  it("rides the stream as a job event and lands on the coach's turn", () => {
    const p = applyEvent(emptyPending(), { type: "job", job: { id: "j1", type: "postings", label: "Reading postings" } });
    expect(p.jobs).toEqual([{ id: "j1", type: "postings", label: "Reading postings" }]);
    expect(p.writes).toEqual([]);
  });

  it("reaches the coach on its next turn through the operator note — done with its table, failed with its reason, nothing older", () => {
    const jobs = [
      { type: "postings", status: "done", endedAt: 2000, result: { count: 18, summary: "18 postings…\n| # | Title |" } },
      { type: "postings", status: "failed", endedAt: 1500, error: "No posting could be opened" },
      { type: "postings", status: "done", endedAt: 500, result: { summary: "old" } },
      { type: "ping", status: "running" },
    ];
    const ctx = landedSince(jobs, 1000, (t) => (t === "postings" ? "Reading postings" : t));
    expect(ctx.landed).toEqual([{ label: "Reading postings", summary: "18 postings…\n| # | Title |" }]);
    expect(ctx.failed).toEqual([{ label: "Reading postings", error: "No posting could be opened" }]);
    const note = contextNote({ page: "true-north", ...ctx })!;
    expect(note).toContain("The member is looking at True North.");
    expect(note).toContain("Research landed since your last turn — Reading postings.");
    expect(note).toContain("do not write it again");
    expect(note).toContain("Research failed since your last turn — Reading postings: No posting could be opened.");
    expect(landedSince(jobs, 3000, (t) => t)).toEqual({});
  });
});
