// The ATS registry (docs/AGENTIC_PIPELINE_PLAN.md §5, "ATS public APIs"): which applicant-tracking system a careers URL
// belongs to, and the public board endpoint that lists its jobs — a careers URL is `confirmed` by code when the board
// answers (plan §5 verification rule). Pure: detection and the API URL. The GET is in ./fetch.ts. Tested.
// The upstream career-ops `_registry.mjs` names 55+ providers; these six have public, keyless JSON boards.

export const ATS_PROVIDERS = ["greenhouse", "lever", "ashby", "workable", "smartrecruiters", "teamtailor"] as const;
export type AtsProvider = (typeof ATS_PROVIDERS)[number];

export interface AtsBoard { provider: AtsProvider; boardId: string }

const RULES: readonly { provider: AtsProvider; host: RegExp; id: (u: URL) => string | null }[] = [
  { provider: "greenhouse", host: /^(boards|job-boards)\.greenhouse\.io$/, id: (u) => first(u) },
  { provider: "greenhouse", host: /^boards\.eu\.greenhouse\.io$/, id: (u) => first(u) },
  { provider: "lever", host: /^jobs(\.eu)?\.lever\.co$/, id: (u) => first(u) },
  { provider: "ashby", host: /^jobs\.ashbyhq\.com$/, id: (u) => first(u) },
  { provider: "workable", host: /^apply\.workable\.com$/, id: (u) => first(u) },
  { provider: "smartrecruiters", host: /^(careers|jobs)\.smartrecruiters\.com$/, id: (u) => first(u) },
  { provider: "teamtailor", host: /^[a-z0-9-]+\.teamtailor\.com$/, id: (u) => u.hostname.split(".")[0] },
];

const first = (u: URL): string | null => { const s = u.pathname.split("/").filter(Boolean)[0]; return s && !/^(jobs?|careers?|embed|api)$/i.test(s) ? s : null; };

/** The board a careers URL belongs to — null for a company's own page, Workday, SuccessFactors and the rest. */
export function atsOf(url: string | null | undefined): AtsBoard | null {
  if (!url?.trim()) return null;
  let u: URL;
  try { u = new URL(url.trim()); } catch { return null; }
  const host = u.hostname.toLowerCase();
  for (const r of RULES) {
    if (!r.host.test(host)) continue;
    const boardId = r.id(u);
    return boardId ? { provider: r.provider, boardId } : null;
  }
  return null;
}

/** The public JSON endpoint that lists a board's jobs — the GET that confirms a careers URL. */
export function atsBoardApi(b: AtsBoard): string {
  switch (b.provider) {
    case "greenhouse": return `https://boards-api.greenhouse.io/v1/boards/${b.boardId}/jobs`;
    case "lever": return `https://api.lever.co/v0/postings/${b.boardId}?mode=json`;
    case "ashby": return `https://api.ashbyhq.com/posting-api/job-board/${b.boardId}`;
    case "workable": return `https://apply.workable.com/api/v1/widget/accounts/${b.boardId}`;
    case "smartrecruiters": return `https://api.smartrecruiters.com/v1/companies/${b.boardId}/postings`;
    case "teamtailor": return `https://${b.boardId}.teamtailor.com/jobs.json`;
  }
}

/** The board's own page that lists its jobs — the careers URL a member opens. */
export function atsBoardPage(b: AtsBoard): string {
  switch (b.provider) {
    case "greenhouse": return `https://boards.greenhouse.io/${b.boardId}`;
    case "lever": return `https://jobs.lever.co/${b.boardId}`;
    case "ashby": return `https://jobs.ashbyhq.com/${b.boardId}`;
    case "workable": return `https://apply.workable.com/${b.boardId}/`;
    case "smartrecruiters": return `https://careers.smartrecruiters.com/${b.boardId}`;
    case "teamtailor": return `https://${b.boardId}.teamtailor.com/jobs`;
  }
}

/** The number of jobs a board's answer lists — the registry's one parse, per provider; null when the shape is unknown. */
export function atsJobCount(provider: AtsProvider, json: unknown): number | null {
  const j = json as Record<string, unknown> | unknown[] | null;
  if (!j) return null;
  if (provider === "lever") return Array.isArray(j) ? j.length : null;
  const o = j as Record<string, unknown>;
  const list = provider === "greenhouse" ? o.jobs : provider === "ashby" ? o.jobs : provider === "workable" ? o.jobs : provider === "smartrecruiters" ? o.content : o.jobs;
  return Array.isArray(list) ? list.length : null;
}
