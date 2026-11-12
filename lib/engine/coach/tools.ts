// The one tool a coach has: update_profile (docs/UX_COACH.md §4). Its input schema is
// the coach's own keys, closed, so the model sees exactly what it may write. It is NOT
// strict: strict mode compiles the schema to a grammar and caps the optional fields at 24
// across the tools (400 "too many optional parameters") — Narrative alone has 27, True
// North and Target companies far more — and we need none of it: the server enforces the
// shape (validateProfileFile) and the ownership (foreignPaths) on every write and hands
// any error back as a tool result the coach fixes with the member. Pure — tested.
//
// Field names and nesting follow profile-schema.md §2–§5c exactly. Every parameter carries its
// meaning and its limit in the description — the schema is the contract the model fills in, and
// the API's tool schemas take no minItems / maxItems / maxLength. The prompts' key tables say
// what each key means in the conversation; the rule itself lives here, once.

import type { CoachKey } from "./keys";

export const UPDATE_PROFILE = "update_profile";

// JSON Schema fragments, closed.
const str = (description: string) => ({ type: "string", description });
const int = (description: string) => ({ type: "integer", description });
const list = (description: string) => ({ type: "array", items: { type: "string" }, description });
const en = (values: readonly string[], description: string) => ({ type: "string", enum: [...values], description });
const obj = (properties: Record<string, unknown>, description?: string) => ({ type: "object", properties, additionalProperties: false, ...(description ? { description } : {}) });
const rows = (item: Record<string, unknown>, description: string) => ({ type: "array", items: item, description });

const YN = ["Y", "N"] as const;
const SCORES = obj({ growth: int("🚀 Growth signals 1–5"), interest: int("💚 Interest 1–5"), access: int("🔑 Access 1–5"), proof: int("🧾 Proof 1–5"), total: int("growth + interest + access + proof") }, "The member's four numbers and their sum");
const RANKED = obj({
  rank: int("1–40 by total; ties: interest, then proof. The Top 3 keep their Top-10 ranks"), name: str("As the company writes it"),
  industry: str("The industry it sells into, named as in the member's True North"), subSector: str("Its sub-sector — one from True North, or from extraSubSectors with its own sourced number"),
  companyType: en(["startup", "scaleup", "established", "public_sector"], "public_sector for government and its agencies"),
  careersUrl: str("The page that LISTS its jobs; left out when status is none"), careersUrlStatus: en(["opened_by_coach", "confirmed", "corrected", "none"], "Top 10: from top10 (the member opened it); others: from companies"), scores: SCORES,
}, "One ranked company");
const SPLIT = obj({ sunrise: rows(RANKED, "growing sub-sector, rank order"), sunset: rows(RANKED, "flat or shrinking, rank order"), unclassified: rows(RANKED, "only when a sub-sector has no sourced number") }, "A list split by outlook");

/** What each coach may write — profile.yml paths, in the schema's own shape. */
export const COACH_PATCH_SCHEMAS: Record<CoachKey, Record<string, unknown>> = {
  narrative: obj({
    contact: obj({
      phone: str("The phone recruiters should use, as typed"),
      linkedin: str("Their LinkedIn URL exactly as it is today"),
      portfolio: str("Portfolio or GitHub Pages — absolute http(s) URL, or leave out"),
      github: str("GitHub profile URL, or leave out"),
    }, "Contact details"),
    personalization: obj({
      exitNarrative: str("The bridge story: 3–4 sentences from where they come from to where they go next, in their words. ≤ 1,200 characters."),
    }),
    narrative: obj({
      headline: str("One sentence a recruiter understands in 10 seconds: 'I help [who] achieve [outcome] through [competency 1], [2] and [3]'. ≤ 220 characters, no final full stop."),
      superpowers: list("Core competencies: 3–5 short noun phrases in the market's own words, strongest first (3 to 5 items)"),
    }),
    jhg: obj({
      identity: obj({
        fullName: str("Full name as the member types it"), email: str("The email recruiters should use"),
        city: str("City"), country: str("Country"), location: str("'{city}, {country}'"),
        timezone: str("IANA time zone the member confirmed, e.g. Pacific/Auckland"),
        outputLanguage: str("ISO code of the language their documents are written in, default en"),
        alternateEmails: list("Other emails that are also them"), twitter: str("X/Twitter handle or URL, only if used professionally"),
        preferredChannel: en(["email", "phone", "either"], "How recruiters should reach them"), contactNote: str("One line recruiters should know before contacting them"),
      }),
      narrative: obj({
        leadSkills: list("The three skills behind the competencies, in the member's own words, rank order (exactly 3 items)"),
        bridgeStoryOneLine: str("The bridge story in one sentence: 'I was X, I did Y, now I do Z because W'"),
      }),
    }),
  }),

  trueNorth: obj({
    goal: obj({
      role: str("'{level of the primary cluster} {first title of the primary cluster}'"), seniority: str("The primary cluster's level, as posted"),
      subsector: str("First sub-sector of the first industry"), companyType: str("jhg.trueNorth.companyType"), city: str("jhg.identity.location"),
      salary: str("'{currency} {salaryLower}–{salaryUpper}'"),
    }, "The North Star — derived from the clusters and boundaries, written at hand-over"),
    policy: obj({
      minimumSalary: str("'{currency} {salaryFloor}'"),
      locationFlexibility: str("'Remote: …; Local hybrid: …; Relocate: …', empty parts left out"),
      visaStatus: str("One line"), authorizedIn: list("Countries with work rights"), needsSponsorship: { type: "boolean", description: "true only when the member said Y" },
    }),
    personalization: obj({
      targetRoles: rows(obj({ archetype: str("First title of the cluster, ≤ 80"), axes: str("The cluster's axes joined ', ' + '; ' + the cluster name, ≤ 200"), buys: str("≤ 200") }), "One per cluster, ≤ 8"),
      compTargets: str("'Target {currency} {lower}–{upper}; floor {currency} {floor}.' ≤ 800"),
      negotiationScripts: list("The member's negotiation lines, their words; left out when empty (≤ 6)"),
      locationPolicy: list("'Will work in: …', 'Exclude: …', 'Remote: …', 'Local hybrid: …', 'Relocate: …', 'Travel for a remote role elsewhere: …' — empty ones left out (≤ 8)"),
    }),
    watchlist: obj({ positive: list("titles.target"), negative: list("titles.exclude + excludeLevels") }, "Title keywords for the Scout"),
    notes: str("The §6 notes block, complete: hard no's; culture must-haves (+ deprioritise when absent); soft dislikes; notice period; never apply"),
    jhg: obj({
      trueNorth: obj({
        boundaries: obj({
          currency: en(["NZD", "AUD", "USD", "CAD", "JPY", "GBP", "EUR", "SGD"], "ISO code of the currency the pay is in"),
          salaryLower: str("Target pay per year, lower end, in the member's own number formatting"), salaryUpper: str("Target pay per year, upper end, same formatting"), salaryFloor: str("The yearly pay below which they say no; floor ≤ lower"),
          authorizedIn: list("Countries where they can work without sponsorship"), needsSponsorship: en(YN, "Y only when they need sponsorship elsewhere"), visaStatus: str("Their work-rights status in one line"),
          willWorkIn: str("Cities they will work in, one line ≤ 300"), exclude: str("Places to exclude, one line ≤ 300"), remote: str("Remote: yes/no and any condition, one line ≤ 300"), localHybrid: str("Hybrid days on site and whether that changes the floor, one line ≤ 300"), relocate: str("Relocation: where and on what terms, one line ≤ 300"), remoteTravel: str("On-site travel they'd accept for a remote role based elsewhere, one line ≤ 300"),
          hardNos: list("Things they will not do — a posting with one is out"), softDislikes: list("Things that lower a posting without ruling it out"), excludeLevels: list("Seniority levels to exclude, as posted"), neverApply: list("Companies they'd never join"),
          cultureMustHaves: list("Two or three, including anything about the hiring process; empty when 'I don't know yet'"), deprioritizeIfAbsent: en(["Y", "N", ""], "Whether a posting without the must-haves drops down the list; '' when unknown"),
          noticePeriodDays: int("Notice period in days"), negotiationLines: list("Up to 3 lines they'd actually say in a negotiation (≤ 6, ≤ 300 each); empty when 'I don't know yet'"),
        }, "Part A, as one table the member confirmed"),
        postings: rows(obj({ title: str("The title as posted"), company: str("The employer as the posting names it"), location: str("As posted"), url: str("The posting's URL — one you opened in this conversation"), phrases: list("2–3 phrases quoted from the job description"), verified: str("The day you read it, YYYY-MM-DD") }), "15–20 postings you read — a posting counts only when you opened it"),
        keepers: list("3–5 recurring employer phrases, each traceable to a posting"),
        titles: obj({ target: list("Titles they want, as posted (≥ 1)"), analog: list("Same work under a different name"), exclude: list("Titles they rule out (≥ 1)") }, "Every repeating title, bucketed by the member"),
        clusters: rows(obj({ name: str("Named by the business problem, not a title"), titles: list("most-posted first"), axes: list("the keepers that belong"), buys: str("what the employer buys, one sentence"), level: str("as posted: Senior, Lead…"), fit: en(["primary", "secondary", "adjacent"], "exactly one primary") }), "2–3 clusters (1–8)"),
        industries: rows(obj({ name: str("The industry's name"), subSectors: rows(obj({ name: str("The sub-sector's name"), growthSignal: str("A growth number with its date"), source: str("The URL you opened for the number — a growth source, never the company's own site"), outlook: en(["sunrise", "sunset", ""], "sunrise = growing, sunset = flat or shrinking; '' until there is a number and a source"), confirmed: en(["Y", ""], "Y once the member confirmed the sub-sector") }), "Its sub-sectors, each with a sourced number") }), "2–3 target industries in order; the first is the North Star industry"),
        companyType: str("one phrase"),
      }, "The working material behind True North"),
    }),
  }),

  targetCompanies: obj({
    watchlist: obj({ companies: rows(obj({ name: str("As the company writes it"), careersUrl: str("The careers page — only when the member confirmed or corrected it") }), "The Top 10 in rank order") }, "What the Scout watches"),
    companyLists: obj({ all: SPLIT, top10: SPLIT, top3: SPLIT }, "The 40 / Top 10 / Top 3, each split sunrise · sunset · unclassified, rank order; written at hand-over"),
    notes: str("The §6 notes block, complete, now with 'Top 3 right now: …'"),
    jhg: obj({
      targetCompanies: obj({
        companies: rows(obj({
          rank: int("1–40 by total; ties: interest, then proof"), name: str("As the company writes it"), companyType: en(["startup", "scaleup", "established", "public_sector"], "public_sector for government and its agencies"),
          inspiredBy: en(["industry_growth", "competitor", "customer_or_supplier", "network_or_alumni", "press_or_funding", "job_posting", "event_or_community", "other"], "Where the idea came from"),
          industry: str("The industry it sells into, named as in True North"), subSector: str("Its sub-sector — from True North, or from extraSubSectors"), outlook: en(["sunrise", "sunset", ""], "Copied from the sub-sector's row; '' when it has no sourced number"), location: str("Where it is, as the member would say it"), website: str("Its own site, absolute URL"),
          growthSignal: str("A number or a dated event"), growthSource: str("The URL you opened for the signal — never the company's own site"), knownContact: str("Someone the member knows there, from memory only; '' when nobody"),
          careersUrl: str("The page that LISTS its jobs — its ATS board where one exists; left out when status is none"), careersUrlStatus: en(["opened_by_coach", "none"], "opened_by_coach when you opened it; none after two searches found nothing"), scores: SCORES,
        }), "Exactly 40 at hand-over; the batches as they stand at a save point"),
        extraSubSectors: rows(obj({ name: str("The sub-sector's name"), growthSignal: str("A growth number with its date"), source: str("The URL you opened for the number"), outlook: en(["sunrise", "sunset", ""], "'' until there is a number and a source"), confirmed: en(["Y", ""], "Y once the member confirmed it") }), "Sub-sectors True North did not cover, sourced the same way"),
        challenges: rows(obj({ company: str("The company"), challenge: str("The score you challenged and why"), resolution: str("What the member decided") }), "Each score you challenged"),
        top10: rows(obj({ rank: int("1–10"), name: str("As the company writes it"), careersUrl: str("The careers page as the member confirmed or corrected it"), careersUrlStatus: en(["confirmed", "corrected", "none"], "What the member found when they opened it"), careersUrlNote: str("What they noticed about the page, if anything"), hiringAuthorityTitle: str("The title that would hire them — a title, never a person unless known"), knownPerson: str("A person they know there, or ''"), thesis: str("Why this company, one line in the company's own language"), businessProblem: str("The problem they would solve there, or 'needs a signal'"), sayItLoud: en(YN, "Y when the member would say the thesis out loud to someone there") }), "Ranks 1–10 of the 40"),
        top3: rows(obj({ name: str("As the company writes it"), whyNow: str("A dated signal and its source"), firstMove: str("A concrete first move, not 'research more'"), byDate: str("YYYY-MM-DD within 7 days") }), "Three of the Top 10"),
      }),
    }),
  }),

  storyBank: obj({
    contact: obj({ portfolio: str("The proof asset's URL — only when the Narrative has no portfolio") }),
    personalization: obj({
      adaptiveFraming: rows(obj({ role: str("the cluster name"), emphasize: str("≤ 200"), proof: str("'cv.md — ' + story titles joined ', ' (≤ 160)") }), "One per cluster"),
      crossCuttingAdvantage: str("What every cluster buys, 1–3 sentences, ≤ 600"),
      portfolio: obj({ url: str("public"), description: str("its title"), whenToShare: str("≤ 200") }, "The proof asset, once published"),
    }),
    narrative: obj({ proofPoints: rows(obj({ name: str("= story title"), url: str("a public link proving it, else left out"), heroMetric: str("≤ 60, figures only from that story's numbers") }), "Same stories as `stories`, id order") }),
    stories: rows(obj({ id: str("S1…, same as storyFacts"), title: str("3–6 words"), situation: str("The setting, in their words"), task: str("What they were asked or chose to do"), action: str("Their own action, not the team's"), result: str("The outcome with its numbers; estimates say 'about'"), reflection: str("What they learned or would do again"), provenance: en(["verified", "estimate"], "= the story's sourceStatus") }), "Every story whose status is verified or estimate — never user_cannot_confirm"),
    snapshots: rows(obj({ company: str("One of the Top 3"), storyId: str("The story it draws on, S1…"), title: str("The snapshot's title"), context: str("The company's situation as it relates to the story"), challenge: str("The problem the story answers"), role: str("The member's role in the story"), activities: list("What they did, one line each"), results: list("Figures from the story's numbers[]"), relevance: str("Why it matters to this company"), keyDecisions: list("The decisions that made the difference") }), "Optional: one-page proof for up to three Top-3 companies"),
    jhg: obj({
      artefacts: obj({
        storyFacts: rows(obj({ id: str("S1…"), title: str("3–6 words, identical to stories[].title"), role: str("'Company · Title' at the time"), leadSkill: str("The Narrative lead skill the story proves"), numbers: list("Every figure as the member wrote it"), sourceStatus: en(["verified", "estimate", "user_cannot_confirm"], "verified = they can show it; estimate = their best figure; user_cannot_confirm = no proof, never claimed"), sourceNote: str("Where the proof lives") }), "Every story, including those never claimed (8–10)"),
      }),
    }),
  }),

  masterCv: obj({
    contact: obj({ title: str("The CV Headline text before the first ' | ', ≤ 120"), linkedin: str("The custom public LinkedIn URL — only when it differs from the Narrative's") }),
    notes: str("The §6 notes block, complete, now with 'CV house rules: …'"),
    cv: str("The master CV in Markdown: '# CV -- {fullName}', header lines (**Headline:**, **Location:**, **Email:**, **Phone:**, **LinkedIn:**, optional **Portfolio:**, **GitHub:**), ## Professional Summary, ## Work Experience (### Company -- Location, **Title**, Month YYYY – Month YYYY or Present, a context sentence, 3–5 XYZ bullets), ## Projects, ## Education, optional ## Certifications, ## Awards, ## Skills"),
    jhg: obj({
      artefacts: obj({
        currentDomain: str("The field they work in today, plain English"),
        cvHouseRules: list("Standing rules for tailored CVs"),
        lockedSections: list("CV sections the AI must never cut — each a ## heading of cv"),
        languageLearning: rows(obj({ language: str("The language"), currentLevel: str("Their level today, e.g. B1"), targetLevel: str("The level they aim for"), targetDate: str("When, YYYY-MM"), sentence: str("One sentence they write in it"), countries: list("Countries it opens for them") }), "Optional: a language they are learning for the move"),
        linkedinPublicUrl: str("Their claimed custom public LinkedIn URL, absolute; left out otherwise"),
      }),
    }),
  }),

  linkedin: obj({
    linkedin: obj({
      headline: str("The LinkedIn headline, ≤ 220 characters"),
      about: str("The About section, ≤ 2,600 characters"),
      experience: rows(obj({ title: str("The title as on the Master CV"), company: str("As on the Master CV"), location: str("As on the Master CV"), start: str("YYYY-MM"), end: str("YYYY-MM, or '' for Present"), description: str("The role's description, ≤ 2,000 characters"), skills: list("≤ 5, each one in the Skills list") }), "One per CV role, same titles, companies, locations and dates"),
      featured: rows(obj({ kind: en(["link", "post", "article", "document"], "LinkedIn's Featured item kinds"), title: str("The item's title"), url: str("A public URL") }), "2–3; the first is the proof asset when there is one"),
      skills: list("20–25 the stories prove, as the profile should show them; the first three are pinned; never more than 50"),
      education: rows(obj({ school: str("The school"), degree: str("The degree"), field: str("The field of study"), start: str("Year"), end: str("Year") }), "As on the Master CV"),
      certifications: rows(obj({ name: str("The certification"), issuer: str("Who issued it"), issued: str("YYYY-MM"), url: str("The credential's URL, or ''") }), "As on the Master CV"),
    }, "LinkedIn's own sections; every entry keeps all its keys, '' when unanswered"),
  }),
};

/** The paths each coach owns (profile-schema.md §1). A key outside them is refused. */
export const COACH_OWNED_PATHS: Record<CoachKey, readonly string[]> = {
  narrative: ["contact.phone", "contact.linkedin", "contact.portfolio", "contact.github", "personalization.exitNarrative", "narrative.headline", "narrative.superpowers", "jhg.identity", "jhg.narrative"],
  trueNorth: ["goal", "policy", "personalization.targetRoles", "personalization.compTargets", "personalization.negotiationScripts", "personalization.locationPolicy", "watchlist.positive", "watchlist.negative", "notes", "jhg.trueNorth"],
  targetCompanies: ["watchlist.companies", "companyLists", "notes", "jhg.targetCompanies"],
  storyBank: ["contact.portfolio", "personalization.adaptiveFraming", "personalization.crossCuttingAdvantage", "personalization.portfolio", "narrative.proofPoints", "stories", "snapshots", "jhg.artefacts.storyFacts"],
  masterCv: ["contact.title", "contact.linkedin", "notes", "cv", "jhg.artefacts.currentDomain", "jhg.artefacts.cvHouseRules", "jhg.artefacts.lockedSections", "jhg.artefacts.languageLearning", "jhg.artefacts.linkedinPublicUrl"],
  linkedin: ["linkedin"],
};

/** The tool definition for a coach. */
export function updateProfileTool(coach: CoachKey) {
  return {
    name: UPDATE_PROFILE,
    description: "Write what the member has just confirmed into their profile. Call it right after each yes — a confirmed table or an approved draft — with the keys that changed; the portal merges key by key and never drops a field you leave out. A list or a nested table is taken whole, so send a list complete as it stands. Set progress to 'in_progress' at a save point and 'complete' at hand-over, once your checks pass. The result shows what is stored now.",
    strict: false as const,
    input_schema: {
      type: "object" as const,
      properties: {
        patch: COACH_PATCH_SCHEMAS[coach],
        progress: { type: "string", enum: ["in_progress", "complete"], description: "Only at a save point or the hand-over" },
      },
      required: ["patch"],
      additionalProperties: false,
    },
  };
}

/** The paths in a patch that this coach does not own — a non-empty list refuses the write. */
export function foreignPaths(coach: CoachKey, patch: unknown, prefix = ""): string[] {
  const owned = COACH_OWNED_PATHS[coach] ?? [];
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return [];
  const out: string[] = [];
  for (const [k, v] of Object.entries(patch as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${k}` : k;
    const isOwned = owned.some((o) => o === path || path.startsWith(`${o}.`));
    if (isOwned) continue;
    const isParent = owned.some((o) => o.startsWith(`${path}.`));
    if (isParent) { out.push(...foreignPaths(coach, v, path)); continue; }
    out.push(path);
  }
  return out;
}

/** Every leaf path the schema offers — for the test that keeps the schema and the owned paths in step. */
export function schemaPaths(schema: Record<string, unknown>, prefix = ""): string[] {
  const props = (schema.properties ?? {}) as Record<string, Record<string, unknown>>;
  const out: string[] = [];
  for (const [k, v] of Object.entries(props)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v.type === "object" && v.properties) out.push(...schemaPaths(v, path));
    else out.push(path);
  }
  return out;
}
