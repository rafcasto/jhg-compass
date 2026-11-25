# The research library — industries researched once, read by every member

**Date:** 2026-11-25. **Status:** design, for approval — nothing built. Taken from Rafael's Job Hackers Global brief (its *Research
library* and *Where AI is allowed* sections); the rest of that brief (Supabase, the Career-Ops overlay, its phases) is another stack
and is not adopted — this repo's decisions stand (`docs/AGENTIC_PIPELINE_PLAN.md §2`: Firestore only, fork career-ops, six coaches).
Companion to `docs/DECISION_PROFILE_INTERFACE_2026-11-25.md` (decision C) and `docs/UX_SCRIPTED_COACH.md`.

**The principle adopted:** *research once, reuse many times. Never research live per member. Read from the library; research only
what is missing.* It is the pipeline plan's principle 5 (*shared company data, personal scores*) extended from companies to
**industries** — and it changes what the planned `industries` job is: not a per-member research step, but a **library fill**.

---

## 1. What changes

| Today / planned | With the library |
|---|---|
| Coach 2 Part C: *research ten industries growing in their geography* — a per-member job (planned) or the model's search (today), 1–3 min, tokens per member | Part C is a **pick over library rows** for the member's region (code, instant). A job runs only for an industry × region the library lacks |
| Coach 1's *Market pays* axis — the member guesses 1–5 | **Pre-filled from the library's *skills and pay* section**, the way Coach 3's Growth and Access are pre-filled by `evidence.ts`; the member may change it and the change rides as an `override` |
| Coach 3's industry-led proposal — the model proposes companies when the boards' pass is short (`proposal: "auto"`) | The library's **top employers** fill the gap first; the model proposal becomes the last resort (`COMPANIES_PROPOSAL=off` is then the default) |
| The postings planner's queries — titles × locations × keepers | The library's **search keywords** join the plan for the member's industries |
| Sub-sector outlook — a number and a source the coach must find per member (T5) | The library row carries `growthSignal · source · outlook · asOf` once; T5 reads it |

Cost: the per-member research line on Coach 2 goes to **zero** for a region the library already covers; the library's own refresh is
one job per industry × region per month, shared by every member in that region. Quality: every member in Auckland sees the same ten
industries with the same numbers and the same opened sources — comparable, auditable, and never improvised.

---

## 2. The file — one template, every entry

Stored as one document per industry × region (Firestore, top level, server-written, readable by any signed-in member — the
same rules as `companies/{domain}` and `jobPostings/{id}`): `industryResearch/{region}_{industrySlug}`.

| Section | Holds | Who reads it |
|---|---|---|
| **Overview** | what the industry is; growing or shrinking, with a number, a date and the source opened | Coach 2 Part C (the pick's hint line; the outlook) |
| **Roles in demand** | titles as posted, most-posted first | Coach 2 Part B (title buckets gain a hint *in demand here*), the planner |
| **Skills and pay** | skills the industry pays for, each with a pay band and a source | Coach 1's *Market pays* pre-fill; Coach 2's keepers hint |
| **Top employers** | 10–20 companies with domain and careers URL status | Coach 3's gap fill (`fromLibrary` before `proposal`) |
| **Search keywords** | titles and terms for sourcing | the postings planner |
| **Sub-sectors** | name · growthSignal · source · outlook (`sunrise · sunset · ""`) | Coach 2 Part C's second pick; T5 |
| **Tags · asOf · sources[]** | region, industry, every URL the job opened, the refresh date | the refresh queue; the admin view |

**Industry-level content is global; pay, employers and keywords are regional.** A region file carries the regional sections and
points at the global industry file for the rest (`industries/{industrySlug}` for overview · roles · sub-sector definitions;
`industryResearch/{region}_{slug}` for pay · employers · keywords · regional outlook). One read per member pick, two documents.

---

## 3. Regions

The pipeline's country enum (`lib/engine/sourcing/keys.ts`: NZ · AU · US · CA) is the region key. Launch order **NZ → AU → CA → US**.
NZ and AU: one region file per country. CA and US: a country file plus **hub** files (New York, San Francisco, Toronto, Vancouver to
start) — a hub file overrides the country file's pay · employers · keywords where it has them; add a hub only when a member's
`goal.city` asks for it. `countryOf(region)` already maps a member's city to the country; a `hubOf(city)` joins it.

---

## 4. How an entry is made — the job

A `library` engine job (`ENGINE_JOB_TYPES` grows by one; handler in `lib/engine/handlers/library.ts`, pure half in
`lib/engine/research/library.ts`, prompt `job:library`), the shape of `postings` and `companies`:

1. **Trigger** — scheduled (monthly, the refresh window; a cron on the engine's run route) or **on demand** when a member's pick needs an
   industry × region the library lacks (Coach 2 Part C's step shows the ten it has and offers *Another industry ›* → the job).
2. **Check the library** — a fresh entry (`asOf` within the window) ends the job: zero tokens.
3. **Research** — one structured call with search for the region's sections, every URL opened by code (`urlWasFound` or a GET);
   the boards' data the sourcing adapters already hold fill *roles in demand* and *search keywords* without a model.
4. **Fill the template** — the schema is the template; a section the model leaves empty stays empty, never invented.
5. **Validate** — code: every outlook has a number and an opened source, every employer has a domain, `asOf` set.
6. **Save** — the two documents; the admin's Library tab lists entries by region with `asOf`.
7. **Refresh** — an entry older than the window re-enters the queue; a member never waits on a refresh (the stale entry is read with its
   `asOf` shown mute: *as of October*).

The member never sees the job unless the library is missing their industry — then the familiar `JobStatus` line, *Reading the
industry · 3 of 6 sources*, and the pick fills in when it lands.

---

## 5. Where AI is allowed — the brief's table, against this repo

| Step | The brief | Here |
|---|---|---|
| Narrative questions | no AI — scripted | **the same** (decision C; Coach 1's script is the next-but-one PR). Drafts (headline, bridge story) stay one call each, member-edited — the brief's *skill inventory: one call* is the same shape |
| Skill inventory | one call → 15–20 skills, member edits | the member lists skills; a word-list flags traits; **one call** turns the top three into market phrases (`competencies` draft). Keep ours: the member's own list first is cheaper and more honest |
| Ranking and priority table | no AI — UI and maths; *Market pays* pre-filled from the library; Proof yes/no + example; head-to-head ties on the top ~8 | **the same engine** (`rubrics.ts`, `rankRows`, the matrix); adopt the **library pre-fill for Pays** (§1); keep the 1–5 Proof anchors over yes/no (the anchor *a result with a number* is what Story Bank needs); the playoff already pairs the top six |
| Research library | AI — scheduled or on-demand job only | **adopt** (§4) |
| North Star synthesis | one call | **zero calls** — `goal.*` is derived by rule from the primary cluster (`true-north.ts` script); cheaper than the brief |
| Company scoring | agent; results saved and reused | `evidence.ts` suggests Growth and Access from stored facts; the member scores; shared `companies/{domain}` is the reuse. The same |
| LinkedIn connection matching | no AI — CSV matching | **the same** (`connections.ts`); the brief's *ask early, it takes LinkedIn a day* is already Coach 1's CLOSE line |

Nothing in the brief loosens a rule here; the library tightens one (Part C becomes code).

---

## 6. Persona tests

Adopted from the brief: a set of member personas in `tests/personas/` run through the scripted coaches after each coach's PR — the
answers a persona gives per step, the profile that must result, the checks that must pass, and the token count of every draft and
job. Start with the brief's four, mapped to our regions: a senior tester moving into fintech (NZ) · a mid-level developer wanting health
tech (AU) · a QA lead aiming for a product role (Toronto) · a career changer from outside IT (US). Report after each run: what broke,
where the flow felt repetitive, the token count. Ana (the journey map's persona) is the fifth.

---

## 7. What this changes in the build order

Decision C's order stands (Coach 2 → 3 → 1 → 5 → 6). Within it:

- **Coach 2's next PR** builds the `library` job and Part C as a pick over it — instead of the per-member `industries` job the pipeline plan
  named. The `clusters` draft job stays as planned.
- **Coach 1's PR** adds the *Market pays* pre-fill from the library (an `evidence`-style suggestion, overridable).
- **Coach 3's PR** reads the library's top employers before the model's proposal.
- The admin gets a **Library** tab (entries by region, `asOf`, refresh now) beside Usage.

Open: the refresh window (monthly proposed); whether a member may see the library entry itself (proposed: yes, read-only, as the
hint under the pick — it is public research, not a profile field); the hub list for CA and US beyond the first four.
