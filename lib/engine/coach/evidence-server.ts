import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import type { JhgCompany } from "@/lib/careerops/types";
import type { ProfileFile } from "@/lib/careerops/profile-file";
import { companyKey, slug } from "../sourcing/keys";
import { CONNECTIONS_CHUNK, chunkConnections, companyMatches, matchConnections, type Connection } from "./connections";
import { archetypeTitlesOf, daysBetween, evidenceFor, suggestedValues, targetIndustriesOf, trueNorthPostingsAt, type CompanyEvidence, type PostingFact } from "./evidence";
import type { SkillScore } from "./skills";

// The server half of the assisted matrix (docs/UX_COACH_COMPANY_SCORING.md §2–§3): the member's connections under their
// account in chunks, the shared postings at each company, the evidence built per row and kept on
// users/{uid}/coachEvidence/companies — derived facts, regenerated, never part of the profile.

const connectionsRef = (uid: string) => adminDb().collection(`users/${uid}/connections`);
const evidenceRef = (uid: string) => adminDb().doc(`users/${uid}/coachEvidence/companies`);

/** Replace the stored connections with this export: CONNECTIONS_CHUNK rows a document. */
export async function saveConnections(uid: string, rows: readonly Connection[], fileName: string): Promise<void> {
  const db = adminDb();
  const col = connectionsRef(uid);
  const old = await col.listDocuments();
  let batch = db.batch(); let n = 0;
  const flush = async () => { if (n) { await batch.commit(); batch = db.batch(); n = 0; } };
  for (const d of old) { batch.delete(d); if (++n >= 400) await flush(); }
  const chunks = chunkConnections(rows, CONNECTIONS_CHUNK);
  const now = Date.now();
  chunks.forEach((rows, i) => { batch.set(col.doc(String(i).padStart(4, "0")), { i, rows, total: chunks.length, count: rows.length, fileName, uploadedAt: now }); n++; });
  if (!chunks.length) batch.set(col.doc("0000"), { i: 0, rows: [], total: 1, count: 0, fileName, uploadedAt: now });
  await flush();
}

export async function loadConnections(uid: string): Promise<{ rows: Connection[]; uploadedAt: number | null }> {
  const snap = await connectionsRef(uid).orderBy("i").get();
  const rows: Connection[] = [];
  let uploadedAt: number | null = null;
  for (const d of snap.docs) { const data = d.data() as { rows?: Connection[]; uploadedAt?: number }; rows.push(...(data.rows ?? [])); uploadedAt = data.uploadedAt ?? uploadedAt; }
  return { rows, uploadedAt };
}

interface StoredPosting { title?: string; postedAt?: string; source?: string; companyKey?: string; company?: string; phrases?: string[] }

/** The shared postings at the named companies — by companyKey, 30 keys a query (Firestore's `in`), the last 60 days only. */
export async function postingsAt(companies: readonly JhgCompany[], today: string): Promise<Map<string, PostingFact[]>> {
  const db = adminDb();
  const keys = [...new Set(companies.map((c) => companyKey(c.name, c.website)).concat(companies.map((c) => slug(c.name))))];
  const out = new Map<string, PostingFact[]>();
  for (let i = 0; i < keys.length; i += 30) {
    const snap = await db.collection("jobPostings").where("companyKey", "in", keys.slice(i, i + 30)).get();
    for (const d of snap.docs) {
      const p = d.data() as StoredPosting;
      if (!p.title) continue;
      if (p.postedAt && daysBetween(p.postedAt, today) > 60) continue;
      const fact: PostingFact = { title: p.title, postedAt: p.postedAt ?? "", source: labelOf(p.source), phrases: p.phrases };
      const company = companies.find((c) => companyKey(c.name, c.website) === p.companyKey || slug(c.name) === p.companyKey || (p.company && companyMatches(p.company, c.name)));
      if (!company) continue;
      out.set(company.name, [...(out.get(company.name) ?? []), fact]);
    }
  }
  return out;
}

const labelOf = (s?: string) => (s === "adzuna" ? "Adzuna" : s === "careerjet" ? "Careerjet" : s === "serp" ? "Google for Jobs" : s ?? "");

export interface CompaniesEvidence { byName: Record<string, CompanyEvidence>; suggested: Record<string, (number | null)[]>; connections: { total: number; matched: number } | null; builtAt: number }

/** Evidence for every stored company: the connections matched, the postings read, the rules applied. Kept on coachEvidence/companies. */
export async function buildCompaniesEvidence(uid: string, companies: readonly JhgCompany[], profile: ProfileFile, today: string): Promise<CompaniesEvidence> {
  const tn = profile.jhg?.trueNorth;
  const [{ rows: connections, uploadedAt }, shared] = await Promise.all([loadConnections(uid), postingsAt(companies, today)]);
  const names = companies.map((c) => c.name);
  const matched = matchConnections(connections, names);
  const archetypeTitles = archetypeTitlesOf(tn);
  const competencies = profile.narrative?.superpowers ?? [];
  const wantedType = profile.goal?.companyType?.trim() || tn?.companyType?.trim() || "";
  const skills = ((profile.jhg?.narrative?.skillScores ?? []) as Partial<SkillScore>[]).filter((x): x is SkillScore => typeof x.skill === "string" && typeof x.good === "number");
  const targetIndustries = targetIndustriesOf(tn);
  const byName: Record<string, CompanyEvidence> = {};
  const suggested: Record<string, (number | null)[]> = {};
  for (const c of companies) {
    const postings = [...(shared.get(c.name) ?? []), ...trueNorthPostingsAt(tn?.postings, c.name, companyMatches)];
    const e = evidenceFor({ company: c, postings, contacts: matched.get(c.name) ?? [], archetypeTitles, competencies, skills, targetIndustries, boundaries: tn?.boundaries, wantedType, today });
    byName[c.name] = e; suggested[c.name] = suggestedValues(e);
  }
  const out: CompaniesEvidence = { byName, suggested, connections: uploadedAt ? { total: connections.length, matched: matched.size } : null, builtAt: Date.now() };
  await evidenceRef(uid).set(out, { merge: true });
  return out;
}

/** The member's final numbers beside what the portal suggested — for the admin and the coach's next challenge. */
export async function saveFinalScores(uid: string, rows: readonly { item: string; values: number[]; overrides?: { axis: string; from: number }[] }[]): Promise<void> {
  const final: Record<string, { values: number[]; overrides: { axis: string; from: number }[] }> = {};
  for (const r of rows) final[r.item] = { values: r.values, overrides: r.overrides ?? [] };
  await evidenceRef(uid).set({ final, scoredAt: Date.now() }, { merge: true });
}
