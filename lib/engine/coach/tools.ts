// The one tool a coach has: update_profile (docs/UX_COACH.md §4). Its input schema is
// the coach's own keys, closed, so the model sees exactly what it may write. It is NOT
// strict: strict mode compiles the schema to a grammar and caps the optional fields at 24
// across the tools (400 "too many optional parameters") — Narrative alone has 27, True
// North and Target companies far more — and we need none of it: the server enforces the
// shape (validateProfileFile) and the ownership (foreignPaths) on every write and hands
// any error back as a tool result the coach fixes with the member. Pure — tested.
//
// Field names and nesting follow profile-schema.md §2–§5c exactly; the limits live in the
// descriptions (the API's tool schemas take no minItems / maxItems / maxLength).

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
const SCORES = obj({ growth: int("🚀 Growth signals 1–5"), interest: int("💚 Interest 1–5"), access: int("🔑 Access 1–5"), proof: int("🧾 Proof 1–5"), total: int("the sum") }, "The member's four numbers and their sum");
const RANKED = obj({
  rank: int("1–40"), name: str("As the company writes it"), industry: str(""), subSector: str(""), companyType: en(["startup", "scaleup", "established", "public_sector"], ""),
  careersUrl: str("Left out when status is none"), careersUrlStatus: en(["opened_by_coach", "confirmed", "corrected", "none"], ""), scores: SCORES,
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
          currency: en(["NZD", "AUD", "USD", "CAD", "JPY", "GBP", "EUR", "SGD"], ""), salaryLower: str("the member's own formatting"), salaryUpper: str(""), salaryFloor: str("floor ≤ lower"),
          authorizedIn: list(""), needsSponsorship: en(YN, ""), visaStatus: str(""),
          willWorkIn: str("≤ 300"), exclude: str("≤ 300"), remote: str("≤ 300"), localHybrid: str("≤ 300"), relocate: str("≤ 300"), remoteTravel: str("≤ 300"),
          hardNos: list(""), softDislikes: list(""), excludeLevels: list(""), neverApply: list(""),
          cultureMustHaves: list("empty when 'I don't know yet'"), deprioritizeIfAbsent: en(["Y", "N", ""], ""),
          noticePeriodDays: int(""), negotiationLines: list("≤ 6, ≤ 300 each; empty when 'I don't know yet'"),
        }, "Part A, as one table the member confirmed"),
        postings: rows(obj({ title: str(""), company: str(""), location: str(""), url: str("A URL you opened in this conversation"), phrases: list("2–3 phrases quoted from the JD"), verified: str("YYYY-MM-DD") }), "15–20 postings you read"),
        keepers: list("3–5 recurring employer phrases, each traceable to a posting"),
        titles: obj({ target: list(""), analog: list("same work, different name"), exclude: list("") }, "Titles as posted, bucketed by the member"),
        clusters: rows(obj({ name: str("Named by the business problem, not a title"), titles: list("most-posted first"), axes: list("the keepers that belong"), buys: str("what the employer buys, one sentence"), level: str("as posted: Senior, Lead…"), fit: en(["primary", "secondary", "adjacent"], "exactly one primary") }), "2–3 clusters (1–8)"),
        industries: rows(obj({ name: str(""), subSectors: rows(obj({ name: str(""), growthSignal: str("a number with its date"), source: str("the URL you opened"), outlook: en(["sunrise", "sunset", ""], "only with a number and a source"), confirmed: en(["Y", ""], "") }), "") }), "2–3 target industries, first = North Star industry"),
        companyType: str("one phrase"),
      }, "The working material behind True North"),
    }),
  }),

  targetCompanies: obj({
    watchlist: obj({ companies: rows(obj({ name: str(""), careersUrl: str("only when confirmed or corrected") }), "The Top 10 in rank order") }, "What the Scout watches"),
    companyLists: obj({ all: SPLIT, top10: SPLIT, top3: SPLIT }, "The 40 / Top 10 / Top 3, each split sunrise · sunset · unclassified, rank order; written at hand-over"),
    notes: str("The §6 notes block, complete, now with 'Top 3 right now: …'"),
    jhg: obj({
      targetCompanies: obj({
        companies: rows(obj({
          rank: int(""), name: str("as the company writes it"), companyType: en(["startup", "scaleup", "established", "public_sector"], ""),
          inspiredBy: en(["industry_growth", "competitor", "customer_or_supplier", "network_or_alumni", "press_or_funding", "job_posting", "event_or_community", "other"], ""),
          industry: str(""), subSector: str(""), outlook: en(["sunrise", "sunset", ""], "from the sub-sector's row"), location: str(""), website: str(""),
          growthSignal: str("a number or a dated event"), growthSource: str("the URL you opened — never the company's own site"), knownContact: str("from the member's memory, or ''"),
          careersUrl: str("the page that LISTS its jobs"), careersUrlStatus: en(["opened_by_coach", "none"], ""), scores: SCORES,
        }), "Exactly 40 at hand-over; the batches as they stand at a save point"),
        extraSubSectors: rows(obj({ name: str(""), growthSignal: str(""), source: str(""), outlook: en(["sunrise", "sunset", ""], ""), confirmed: en(["Y", ""], "") }), "Sub-sectors True North did not cover"),
        challenges: rows(obj({ company: str(""), challenge: str(""), resolution: str("") }), "Each score you challenged and what the member decided"),
        top10: rows(obj({ rank: int(""), name: str(""), careersUrl: str(""), careersUrlStatus: en(["confirmed", "corrected", "none"], "the member opened it"), careersUrlNote: str(""), hiringAuthorityTitle: str("a title, never a person unless known"), knownPerson: str(""), thesis: str("one line in the company's language"), businessProblem: str("or 'needs a signal'"), sayItLoud: en(YN, "") }), "Ranks 1–10"),
        top3: rows(obj({ name: str(""), whyNow: str("dated signal + its source"), firstMove: str("concrete, not 'research more'"), byDate: str("YYYY-MM-DD within 7 days") }), "Three of the Top 10"),
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
    stories: rows(obj({ id: str("S1…"), title: str("3–6 words"), situation: str(""), task: str(""), action: str("their own action"), result: str("with the numbers; estimates say 'about'"), reflection: str(""), provenance: en(["verified", "estimate"], "") }), "Every story whose status is verified or estimate — never user_cannot_confirm"),
    snapshots: rows(obj({ company: str(""), storyId: str(""), title: str(""), context: str(""), challenge: str(""), role: str(""), activities: list(""), results: list("figures from numbers[]"), relevance: str(""), keyDecisions: list("") }), "Optional: one-page proof for up to three Top-3 companies"),
    jhg: obj({
      artefacts: obj({
        storyFacts: rows(obj({ id: str("S1…"), title: str("3–6 words, identical to stories[].title"), role: str("'Company · Title'"), leadSkill: str(""), numbers: list("every figure as written"), sourceStatus: en(["verified", "estimate", "user_cannot_confirm"], ""), sourceNote: str("where the proof lives") }), "Every story, including those never claimed (8–10)"),
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
        languageLearning: rows(obj({ language: str(""), currentLevel: str(""), targetLevel: str(""), targetDate: str(""), sentence: str("one sentence they write in it"), countries: list("") }), "Optional"),
        linkedinPublicUrl: str("Their claimed custom public LinkedIn URL, absolute; left out otherwise"),
      }),
    }),
  }),

  linkedin: obj({
    linkedin: obj({
      headline: str("≤ 220"),
      about: str("≤ 2,600"),
      experience: rows(obj({ title: str(""), company: str(""), location: str(""), start: str("YYYY-MM"), end: str("YYYY-MM, or '' for Present"), description: str("≤ 2,000"), skills: list("≤ 5, each in the Skills list") }), "One per CV role, same titles, companies, locations and dates"),
      featured: rows(obj({ kind: en(["link", "post", "article", "document"], ""), title: str(""), url: str("public") }), "2–3; the first is the proof asset when there is one"),
      skills: list("20–25 the stories prove, as the profile should show them; the first three are pinned; never more than 50"),
      education: rows(obj({ school: str(""), degree: str(""), field: str(""), start: str("year"), end: str("year") }), ""),
      certifications: rows(obj({ name: str(""), issuer: str(""), issued: str("YYYY-MM"), url: str("") }), ""),
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
