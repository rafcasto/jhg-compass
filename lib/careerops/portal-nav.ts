// CareerOps portal information architecture — four sections, each a group of
// career-ops tools. Pure module (no React) so the URL ↔ tool parsing is testable
// and every screen imports its tool list from here.
//
//   /careerops/sourcing?tool=scan      /careerops/scoring?tool=oferta
//   /careerops/tailoring?tool=pdf      /careerops/tracking?tool=tracker

export interface PortalTool { key: string; label: string; title: string; blurb: string }
export interface PortalSection { key: string; label: string; href: string; tagline: string; tools: readonly PortalTool[] }

export const PORTAL_SECTIONS = [
  {
    key: "sourcing", label: "Sourcing", href: "/careerops/sourcing", tagline: "Find roles at your target companies.",
    tools: [
      { key: "scan", label: "scan", title: "Scan target companies", blurb: "Searches the careers pages and job boards of the companies on your watchlist for postings that match your North Star goal — role keywords, archetypes, exclusions. Zero tokens: it reads the public boards directly." },
      { key: "pipeline", label: "pipeline", title: "Process a batch of postings", blurb: "Paste a list of posting URLs — from your inbox, a job alert, anywhere. Each one goes through the auto-pipeline: scored, written up as a report, tailored CV drafted when it clears 4.0, and logged on your Progress board as pending." },
      { key: "deep", label: "deep", title: "Company deep-dive", blurb: "Actionable intelligence on one company: funding, recent hires and leadership changes, AI strategy and tech stack, partnerships, acquisitions, launches or pivots. Feeds your apply/skip decision and your interview prep." },
    ],
  },
  {
    key: "scoring", label: "Scoring", href: "/careerops/scoring", tagline: "Decide if a role is worth your time.",
    tools: [
      { key: "oferta", label: "oferta", title: "Score one posting", blurb: "One job description scored 1–5 on five criteria — North Star alignment, CV vs requirements, compensation, cultural signals, red flags — with the full report: executive summary, CV match, seniority, compensation, personalisation hook, interview probability." },
      { key: "ofertas", label: "ofertas", title: "Score a handful of related roles", blurb: "Two to nine postings at once, ranked when they land. Same report per posting." },
      { key: "batch", label: "batch", title: "Score 10+ postings and rank them", blurb: "Ten or more postings queued together and ranked by score. Mind your daily quota — the admin can raise it." },
      { key: "training", label: "training", title: "Is this course or cert worth it?", blurb: "Judge a course or certification on North Star alignment, recruiter signal, time and effort, opportunity cost, risks and portfolio deliverable. Verdict: DO · DON'T · DO WITH TIMEBOX." },
      { key: "project", label: "project", title: "Is this portfolio project worth building?", blurb: "Scores a project idea on signal for your target roles, uniqueness, demo-ability, metrics potential, time to MVP and STAR story potential. Verdict: BUILD · SKIP · PIVOT." },
    ],
  },
  {
    key: "tailoring", label: "Tailoring", href: "/careerops/tailoring", tagline: "Get in front of humans and apply effortlessly.",
    tools: [
      { key: "contacto", label: "contacto", title: "Find the right person and draft the DM", blurb: "Picks the one person worth contacting for a scored role — hiring manager, recruiter, team peer or interviewer — and drafts a targeted message under 300 characters in the three-sentence framework for that persona." },
      { key: "pdf", label: "pdf", title: "ATS-ready CV for a posting", blurb: "Tailors your CV to a scored posting and renders the ATS-safe PDF. Nothing is claimed that isn't in your CV — the keywords it couldn't honestly use are listed." },
      { key: "apply", label: "apply", title: "Application form assistant", blurb: "Assemble the package for a posting — tailored CV, cover letter — then paste the form's questions and get a drafted answer for each, grounded in your CV, that you review and edit inline before you paste it back. Knock-out questions are flagged. You submit; the agent never does." },
    ],
  },
  {
    key: "tracking", label: "Tracking", href: "/careerops/tracking", tagline: "Prepare, follow up, learn from the pattern, close the deal.",
    tools: [
      { key: "tracker", label: "tracker", title: "Every evaluation, application and reply", blurb: "One table across your reports, generated documents and Progress-board stage — what was scored, what was sent, what came back." },
      { key: "interview-prep", label: "interview-prep", title: "Interview intelligence for a role", blurb: "A company- and role-specific prep document for whoever is in the room — recruiter, hiring manager, peer/technical or panel — with likely questions, talking points and STAR+R stories drawn from your CV." },
      { key: "followup", label: "followup", title: "Overdue follow-ups, drafted", blurb: "Applies your cadence rules to the Progress board, flags what's gone quiet, and drafts the polite nudge that gets a reply." },
      { key: "patterns", label: "patterns", title: "What is and isn't working", blurb: "Reads every report and every rejected or discarded card, looks for common features — industry, size, seniority, keywords, archetype — and tells you where to point your targeting." },
    ],
  },
] as const satisfies readonly PortalSection[];

export type SectionKey = (typeof PORTAL_SECTIONS)[number]["key"];
export type ToolKey = (typeof PORTAL_SECTIONS)[number]["tools"][number]["key"];

export const PORTAL_HOME = "/careerops/sourcing";
export const SETUP_HREF = "/careerops/setup";

export const findSection = (key: string): PortalSection | undefined => (PORTAL_SECTIONS as readonly PortalSection[]).find((s) => s.key === key);

// "?tool=deep" → "deep"; unknown → the section's first tool.
export function parseTool(section: SectionKey, raw: string | null | undefined): string {
  const s = findSection(section)!;
  return s.tools.some((t) => t.key === raw) ? (raw as string) : s.tools[0].key;
}

// Which section/tool a job type belongs to (for "open in portal" links).
export const toolHref = (section: SectionKey, tool: string) => `${findSection(section)!.href}?tool=${tool}`;
