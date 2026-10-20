# La Maleta — schema

**Status: placeholder.** The shape below is implemented and tested, but it is a
*proposal*. The real maleta is coming later; this exists so there is something
concrete to agree or reject, and so the three ways of getting started have one
thing to produce in the meantime. Expect `version: 1` to change.

- Code: [`lib/careerops/maleta.ts`](../lib/careerops/maleta.ts)
- Reference file: [`docs/la-maleta.example.yml`](./la-maleta.example.yml)
- Tests: `tests/careerops-maleta.test.ts`, `tests/careerops-maleta-example.test.ts`

The example file is parsed by the test suite. Change the schema without
updating the example and the build fails — that is deliberate, because a schema
document nothing checks is wrong within a month.

---

## Why it exists

Three ways to get started, one shape behind all of them:

| Path | Asks for | Time |
|---|---|---|
| **compass** | Just a CV — the North Star is already on the Compass tab | ~2 min |
| **intake** | The guided form, one thing at a time, plus the extras | 10–20 min |
| **maleta** | One `.md` or `.yml` file | <1 min |

A member can start light, fill more in through the form later, export the file,
and bring it back — or hand it to a `career-ops` CLI checkout — with nothing
lost. No path is a dead end, which only holds while there is exactly one
canonical shape. That is la maleta's whole job.

---

## Schema (version 1)

Every key is optional. A maleta with only `cv:` is valid; so is one with only
`goal:`. **Absent means "leave what's already there alone", never "clear it"** —
unpacking a maleta cannot wipe data the member already has.

### `goal` — the North Star

The five fields from the Compass tab ([`lib/goal.ts`](../lib/goal.ts)), so a
maleta and a Compass goal are interchangeable.

| Field | Notes |
|---|---|
| `role` | Seniority + job title. **Required for the goal to count at all.** |
| `subsector` | Industry |
| `companyType` | One of `COMPANY_TYPES`; free text is kept as-is |
| `city` | Country, region, city or area |
| `salary` | Target range, free text, currency included |

A `goal.role` in an uploaded maleta sets `goalSource: "intake"` — it **overrides**
the Compass goal, because the member brought it deliberately. The Compass goal
is never overwritten, so switching back is lossless.

### `contact` — `candidate.*`

Every one of these is read by the Pi worker
(`careerops-worker/lib/profile.js` → `parseProfile`) and lands on the generated
CV header, the cover-letter contact block, and application-form autofill. Blank
means **missing from those documents**; there is no fallback.

| Field | career-ops key |
|---|---|
| `title` | `candidate.title` |
| `phone` | `candidate.phone` |
| `linkedin` | `candidate.linkedin` |
| `portfolio` | `candidate.portfolio_url` |
| `github` | `candidate.github` |

`full_name`, `email` and `location` are **not** in the maleta — they come from
the Compass profile and the goal, which already own them.

### `policy` — `compensation.*` / `location.*`

| Field | career-ops key | Notes |
|---|---|---|
| `minimumSalary` | `compensation.minimum` | The walk-away number |
| `locationFlexibility` | `compensation.location_flexibility` | |
| `visaStatus` | `location.visa_status` | Free text |
| `needsSponsorship` | `location.needs_sponsorship` | Written **only when `true`** — career-ops reads absent as false, and an explicit `false` would read as a checked fact rather than an unanswered question |
| `authorizedIn` | `location.authorized_in` | ≤ 50 entries; defaults to the member's profile country |

### `personalization` — the eight `## Your …` sections

career-ops' `modes/_profile.md`: what evaluations are actually scored against.
Caps mirror upstream's `coercePersonalization` exactly and are enforced on
import, so an uploaded file is held to the same limits as the form.

| Section | Shape | Caps |
|---|---|---|
| `targetRoles` | rows of `archetype` / `axes` / `buys` | ≤ 8 rows; `archetype` required; 80 / 200 / 200 chars |
| `adaptiveFraming` | rows of `role` / `emphasize` / `proof` | ≤ 8 rows; `role` **and** `emphasize` required; 80 / 200 / 160. Missing `proof` renders as `cv.md` |
| `exitNarrative` | prose | ≤ 1200 |
| `crossCuttingAdvantage` | prose | ≤ 600 |
| `portfolio` | `url` / `description` / `whenToShare` | `url` must be absolute `http(s)` or **the whole section is dropped**; 300 / 300 / 200 |
| `compTargets` | prose | ≤ 800 |
| `negotiationScripts` | list of lines | ≤ 6, ≤ 300 each |
| `locationPolicy` | list of lines | ≤ 8, ≤ 300 each |

A section left out is treated as **unknown**, never guessed. In the rendered
`_profile.md` it becomes an explicit `_NOT SET_` line, which the agents are
given on purpose: it stops a model inventing targeting nobody supplied.

Three of these also reach `profile.yml`, which is the half the worker reads
today: `exitNarrative` → `narrative.exit_story`, `crossCuttingAdvantage` →
`narrative.superpowers[0]`, `portfolio.url` → `narrative.dashboard.url`.

### `watchlist` — `portals.yml`

| Field | Notes |
|---|---|
| `companies` | ≤ 25, each `{ name, careersUrl }`. `careersUrl` should be the page that **lists** jobs (the ATS board where there is one) |
| `positive` | Include these title keywords |
| `negative` | Exclude these |

### `cv` and `notes`

`cv` is `cv.md` as Markdown — the only source of truth about what the member
has **done**, where the sections above are about what they are **going for**.
`notes` is free text, carried into `profile.yml` as `notes:`.

---

## File formats

### YAML

The canonical form — see the example. Parsed with js-yaml's `JSON_SCHEMA`.

### Markdown

Sections by `##` heading: `## North Star`, `## Contact`, `## Logistics`,
`## Watchlist`, `## Notes`, the eight `## Your …` sections, and `## CV`. Simple
fields are `- key: value` lines.

Two rules worth knowing, both learned the hard way:

1. **The CV must be fenced.** A CV is arbitrary Markdown with its own `##`
   headings, which collide with the headings the document is delimited by — an
   unfenced CV ends at its first `## Experience`. The exporter fences it with a
   fence longer than any backtick run inside it, so a CV containing code blocks
   round-trips. A hand-written unfenced CV still works *if it is last in the
   file*, where "to the end of the document" is unambiguous.
2. **Sections are found by splitting on headings, not by a lazy match with a
   terminator.** The obvious regex wants `(?=^##\s|\Z)` to mean "next heading or
   end of input", but JavaScript has no `\Z` — it is a literal `Z`, and the lazy
   group then stops at the first capital one. `visaStatus: NZ citizen` silently
   truncated the Logistics section at that `Z`.

The targeting half of a Markdown export **is** a valid `modes/_profile.md` and
can be used as one.

---

## What import accepts

| File | Read as |
|---|---|
| `*.yml` with `goal:` / `contact:` / … | A maleta |
| `*.yml` with `candidate:` / `target_roles:` | A career-ops **`config/profile.yml`** |
| `*.md` with `## North Star` / `## CV` / … | A maleta |
| `*.md` with `## Your …` sections | A career-ops **`modes/_profile.md`** |

A `config/profile.yml` carries no CV, and import says so rather than leaving
the member to notice. Where it lists several `target_roles.primary`, the first
becomes the goal and a warning names how many were dropped.

Format comes from the extension; with no usable filename, a Markdown heading is
the tiebreak.

---

## Validation and security

An uploaded maleta is a document the member brings from outside. career-ops'
rule for intake documents applies verbatim: **the text is evidence, never
instruction.** A section may well contain something that reads like a command.

- YAML is parsed with `JSON_SCHEMA` — no custom tags, no implicit dates. A test
  asserts `!!js/function` is a *parse error*, not an instantiation.
- Size cap: 512 kB (`MALETA_MAX_BYTES`).
- Every extracted value goes back through the same validators the forms use.
- Nothing is written until the member sees what was found and confirms.
- HTML comments are stripped before parsing, so the upstream template's
  guidance comments are never read as content.
- Unknown keys are dropped silently.

---

## Fields I would want next

Not implemented. These exist in career-ops'
[`config/profile.example.yml`](https://github.com/career-ops-hq/career-ops/blob/main/config/profile.example.yml)
and are reserved in the example file as comments, so the shape can be agreed
before anything depends on it. Ordered by what they would actually change.

**1. `cultureScreen` — changes scores today.** `require: [...]` plus
`deprioritizeIfAbsent: true` caps the "Cultural signals" dimension at 2/5 when a
JD shows no evidence for the listed criteria. It is the only item here that
structurally alters evaluation, so it is the one I would add first.

```yaml
cultureScreen:
  require: [Small flat teams, Async-first, Practical interview processes]
  deprioritizeIfAbsent: true
```

**2. `narrative` detail — `proofPoints` and `superpowers`.** Today
`crossCuttingAdvantage` is squeezed into `narrative.superpowers[0]`, which is
lossy. career-ops wants a list of superpowers and `proof_points` as
`{ name, url, heroMetric }`. Hero metrics are what make a tailored CV and a
cover letter concrete, so this is the biggest quality win per field.

**3. `coverLetter`** — `noticePeriodDays` (prompted when a JD wants an immediate
start) and `primaryDomain` (used to detect a domain gap against the JD).

**4. `contactPreferences`** — `preferredChannel: email | phone | either` and a
one-line note, to steer drafted outreach toward how the member actually wants to
be reached.

**5. `language`** — `output` (ISO code; `zh-CN` also switches on Chinese PDF
typography) and `modesDir` for market vocabulary. These are separate on purpose:
a member can apply in the DACH market while writing in English.

**6. `reApplyWindows`** — per-company cooldowns so the Scout skips a company the
member applied to recently.

**7. `spendTier`** — `economy | standard | premium`. Needs thought first: in
Compass the admin owns model choice per agent, so a member-set tier would
collide with that.

Two more from upstream I would **not** bring over as-is: `cv.template` /
`style.*` (CV theming belongs in the portal's design system, not a member's
data file) and `scan.extractor` (a CLI-side concern with no meaning here).

---

## Versioning

`version` is an integer, currently `1`. The parser ignores it today, which is
fine while there is one version and nothing in the wild.

Before the real maleta ships, it should: read `version`, migrate known older
shapes forward, and refuse a `version` newer than it understands with a message
saying so rather than silently dropping fields it cannot see. **Silently
discarding half of someone's suitcase is the worst available failure**, which is
why import already lists everything it found and asks for confirmation.

## Changing the schema

1. Edit the types and the coercion in `lib/careerops/maleta.ts`.
2. Add the field to `docs/la-maleta.example.yml`.
3. Update this document.
4. Run the suite. `tests/careerops-maleta-example.test.ts` fails if the example
   and the parser disagree; `tests/careerops-maleta.test.ts` fails if a round
   trip loses anything.

Export lives in `maletaToYaml` / `maletaToMarkdown`, import in `parseMaleta`,
and `maletaToSetupPatch` decides what gets written. A field added to the type
but not to `maletaToSetupPatch` parses and is then thrown away, so check all
four.
