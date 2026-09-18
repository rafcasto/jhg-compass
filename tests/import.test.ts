import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  parseContactsCsv, parseOpportunitiesCsv, contactsCsvTemplate, opportunitiesCsvTemplate, templateFile,
  parseStage, parseContactType, parseMarket, resolveContactRefs, normalizeUrl,
  CONTACT_COLUMNS, OPPORTUNITY_COLUMNS, MAX_IMPORT_ROWS,
} from "@/lib/import";
import { DEFAULT_STAGES } from "@/lib/stages";
import { DEFAULT_TEXT, TEXT_FIELDS } from "@/lib/content";
import { EVENT_DEFAULTS } from "@/lib/tags";

describe("contacts import", () => {
  it("maps forgiving headers onto the contact document", () => {
    const csv = "FULL-NAME,company,Job Title,Contact type,E-mail,Mobile,LinkedIn,Comments\nJane Doe,Acme,CTO,Peer,jane@acme.com,+1 555,linkedin.com/in/jane,Met at meetup\n";
    const r = parseContactsCsv(csv, { now: 123 });
    expect(r.missingColumns).toEqual([]);
    expect(r.unknownColumns).toEqual([]);
    expect(r.errors).toEqual([]);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({ line: 2, duplicate: false, warnings: [] });
    expect(r.rows[0].data).toEqual({
      fullName: "Jane Doe", company: "Acme", role: "CTO", type: "peer", email: "jane@acme.com", phone: "+1 555",
      linkedinUrl: "https://linkedin.com/in/jane", log: [{ at: 123, text: "Met at meetup" }],
    });
  });

  it("requires the full-name column and skips rows without a name", () => {
    expect(parseContactsCsv("company,email\nAcme,x@y.z\n").missingColumns).toEqual(["Full name"]);
    const r = parseContactsCsv("Full name,Company\n,Acme\nBob,Globex\n");
    expect(r.errors).toEqual([{ line: 2, message: "Missing full name" }]);
    expect(r.rows.map((x) => x.data.fullName)).toEqual(["Bob"]);
    expect(r.totalRows).toBe(2);
  });

  it("accepts type ids, labels, admin-renamed labels and legacy values; warns on garbage", () => {
    expect(parseContactType("")).toBe("hiring_manager");
    expect(parseContactType("Hiring manager")).toBe("hiring_manager");
    expect(parseContactType("REFERRER")).toBe("referrer");
    expect(parseContactType("recruiter")).toBe("referrer");
    expect(parseContactType("Décideur", { hiring_manager: "Décideur" })).toBe("hiring_manager");
    expect(parseContactType("wizard")).toBeNull();
    const r = parseContactsCsv("Full name,Type\nA,wizard\n");
    expect(r.rows[0].data.type).toBe("hiring_manager");
    expect(r.rows[0].warnings[0]).toMatch(/Unknown type "wizard"/);
  });

  it("flags duplicates against existing contacts (email, or name + company) and within the file", () => {
    const existing = [{ id: "c1", fullName: "Jane Doe", company: "Acme", email: "jane@acme.com" }];
    const csv = "Full name,Company,Email\nJANE DOE,acme,\nSomeone Else,,Jane@Acme.com\nNew Person,Globex,\nNew Person,Globex,\n";
    const r = parseContactsCsv(csv, { existing });
    expect(r.rows.map((x) => x.duplicate)).toEqual([true, true, false, true]);
  });

  it("warns on malformed emails and reports unknown columns", () => {
    const r = parseContactsCsv("Full name,Email,Favourite colour\nA,not-an-email,blue\n");
    expect(r.unknownColumns).toEqual(["Favourite colour"]);
    expect(r.rows[0].warnings[0]).toMatch(/doesn't look like an email/);
  });

  it("caps the number of rows", () => {
    const csv = "Full name\n" + Array.from({ length: MAX_IMPORT_ROWS + 5 }, (_, i) => `P${i}`).join("\n");
    const r = parseContactsCsv(csv);
    expect(r.tooMany).toBe(true);
    expect(r.rows).toHaveLength(MAX_IMPORT_ROWS);
    expect(r.totalRows).toBe(MAX_IMPORT_ROWS + 5);
  });

  it("points errors at the physical line in the file", () => {
    const r = parseContactsCsv('Full name,Notes\n\nA,"two\nlines"\n,missing\n');
    expect(r.rows[0].line).toBe(3);
    expect(r.errors).toEqual([{ line: 5, message: "Missing full name" }]);
  });

  it("returns an empty result for an empty file", () => {
    const r = parseContactsCsv("");
    expect(r.totalRows).toBe(0);
    expect(r.rows).toEqual([]);
    expect(r.missingColumns).toEqual([]);
  });
});

describe("opportunities import", () => {
  const stages = DEFAULT_STAGES;
  const contacts = [{ id: "c1", fullName: "Jane Doe", email: "jane@acme.com" }, { id: "c2", fullName: "John Smith", email: "" }];

  it("maps a row, resolves the stage by label and links contacts by email or name", () => {
    const csv = "Company,Role,Market,Stage,Source,Link,Contacts,Notes\nAcme,PM,Visible,Job interview,Referral,acme.com/jobs/1,jane@acme.com; john smith; Nobody,Hi\n";
    const r = parseOpportunitiesCsv(csv, { stages, contacts });
    expect(r.errors).toEqual([]);
    expect(r.rows[0].data).toEqual({
      company: "Acme", role: "PM", market: "visible", stage: "job_interview", source: "Referral",
      url: "https://acme.com/jobs/1", notes: "Hi", contactIds: ["c1", "c2"], log: [],
    });
    expect(r.rows[0].warnings).toEqual(['Contact not found: "Nobody"']);
  });

  it("defaults market to hidden and stage to the first column; warns on unknown values", () => {
    const r = parseOpportunitiesCsv("Company,Market,Stage\nAcme,,\nGlobex,sideways,Moon\n", { stages });
    expect(r.rows[0].data).toMatchObject({ market: "hidden", stage: "wishlist" });
    expect(r.rows[0].warnings).toEqual([]);
    expect(r.rows[1].data).toMatchObject({ market: "hidden", stage: "wishlist" });
    expect(r.rows[1].warnings).toEqual(['Unknown market "sideways" — set to hidden', 'Unknown stage "Moon" — placed in Wishlist']);
  });

  it("matches stages by id or label, ignoring case, punctuation and emoji", () => {
    expect(parseStage("info_interview", stages)).toBe("info_interview");
    expect(parseStage("Information Interview", stages)).toBe("info_interview");
    expect(parseStage("accepted", stages)).toBe("accepted"); // label is "✅ Accepted"
    expect(parseStage("REJECTED", stages)).toBe("rejected");
    expect(parseStage("", stages)).toBe("wishlist");
    expect(parseStage("nope", stages)).toBeNull();
  });

  it("requires company and flags duplicates by company + role", () => {
    expect(parseOpportunitiesCsv("Role\nPM\n", { stages }).missingColumns).toEqual(["Company"]);
    const r = parseOpportunitiesCsv("Company,Role\n,PM\nAcme,PM\nacme,pm\nAcme,Designer\n",
      { stages, existing: [{ id: "o1", company: "Acme", role: "Designer" }] });
    expect(r.errors).toEqual([{ line: 2, message: "Missing company" }]);
    expect(r.rows.map((x) => [x.line, x.duplicate])).toEqual([[3, false], [4, true], [5, true]]);
  });
});

describe("helpers", () => {
  it("parseMarket / normalizeUrl / resolveContactRefs", () => {
    expect(parseMarket("")).toBe("hidden");
    expect(parseMarket("V")).toBe("visible");
    expect(parseMarket("x")).toBeNull();
    expect(normalizeUrl("")).toBe("");
    expect(normalizeUrl("http://a.b")).toBe("http://a.b");
    expect(normalizeUrl("www.a.b/c")).toBe("https://www.a.b/c");
    const { ids, unmatched } = resolveContactRefs("a@b.c | A@B.C; Zed", [{ id: "1", email: "a@b.c", fullName: "Ann" }]);
    expect(ids).toEqual(["1"]);
    expect(unmatched).toEqual(["Zed"]);
  });
});

describe("templates", () => {
  const read = (f: string) => fs.readFileSync(path.join(process.cwd(), "public/templates", f), "utf8");

  it("committed template files match the generators (default stages)", () => {
    expect(read("contacts-template.csv")).toBe(templateFile(contactsCsvTemplate()));
    expect(read("opportunities-template.csv")).toBe(templateFile(opportunitiesCsvTemplate(DEFAULT_STAGES)));
  });

  it("templates import cleanly with no errors or warnings", () => {
    const c = parseContactsCsv(contactsCsvTemplate());
    expect(c.missingColumns).toEqual([]);
    expect(c.errors).toEqual([]);
    expect(c.rows.flatMap((r) => r.warnings)).toEqual([]);
    expect(c.rows).toHaveLength(3);
    const contacts = c.rows.map((r, i) => ({ id: `c${i}`, fullName: r.data.fullName, email: r.data.email }));
    const o = parseOpportunitiesCsv(opportunitiesCsvTemplate(DEFAULT_STAGES), { stages: DEFAULT_STAGES, contacts });
    expect(o.missingColumns).toEqual([]);
    expect(o.errors).toEqual([]);
    expect(o.rows.flatMap((r) => r.warnings)).toEqual([]);
    expect(o.rows[0].data.contactIds).toEqual(["c0", "c1"]);
    expect(o.rows[0].data.stage).toBe("outreach");
  });

  it("header rows cover every column spec in order", () => {
    expect(contactsCsvTemplate().split("\r\n")[0]).toBe(CONTACT_COLUMNS.map((c) => c.header).join(","));
    expect(opportunitiesCsvTemplate(DEFAULT_STAGES).split("\r\n")[0]).toBe(OPPORTUNITY_COLUMNS.map((c) => c.header).join(","));
  });
});

describe("wiring", () => {
  it("has admin-editable copy for the import sheet and tracked events", () => {
    for (const k of ["tracker.import", "import.contacts.title", "import.opportunities.title", "import.template", "import.submit"]) {
      expect(DEFAULT_TEXT[k]).toBeTruthy();
      expect(TEXT_FIELDS.some((f) => f.key === k)).toBe(true);
    }
    expect(EVENT_DEFAULTS.IMPORT_CONTACTS.stage).toBe("retention");
    expect(EVENT_DEFAULTS.IMPORT_OPPORTUNITIES.stage).toBe("retention");
  });
});
