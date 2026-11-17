import { NextRequest, NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { requireEngineMember } from "@/lib/server/auth";
import { adminDb } from "@/lib/firebase/admin";
import { ClaudeRefusal, call as claudeCall, isClaudeConfigured, stream as claudeStream, textOf } from "@/lib/engine/claude";
import { getEngineConfig, getPromptOverride } from "@/lib/engine/config-server";
import { quotaCheck, quotaLine, resolvePrompt } from "@/lib/engine/config";
import { getUsageMonth, recordUsage } from "@/lib/engine/usage-server";
import { COACH_PROMPTS, coachPromptKey } from "@/lib/engine/coach/prompts";
import { findCoach, isCoachKey, missingBefore, coachStates } from "@/lib/engine/coach/keys";
import { RUN_RESEARCH, SCORE_MATRIX, UPDATE_PROFILE, coachTools, isResearchKind } from "@/lib/engine/coach/tools";
import { cleanItems, coachRubrics, isRubricKind, parseRows, rubricOf } from "@/lib/engine/coach/rubrics";
import { scoreSkills, scoresMessage, skillRow } from "@/lib/engine/coach/skills";
import { applyCompanyScores, companyFlags, companyMeta, companyRows, companyScoresMessage, matrixCompanies, overrideFlags, withOverrides } from "@/lib/engine/coach/companies";
import { isConnectionsCsv, isConnectionsFileName, matchConnections, parseConnections } from "@/lib/engine/coach/connections";
import { buildCompaniesEvidence, saveConnections, saveFinalScores } from "@/lib/engine/coach/evidence-server";
import { researchDue } from "@/lib/engine/coach/research-due";
import { resetCoach } from "@/lib/engine/coach/reset-server";
import { steerNote } from "@/lib/engine/coach/parts";
import { createJob, listUserJobs, patchJob } from "@/lib/engine/jobs-server";
import { ENGINE_JOB_LABELS, type EngineJobType } from "@/lib/engine/keys";
import { isQueueConfigured, publishRun } from "@/lib/engine/queue";
import { runUnit } from "@/lib/engine/run";
import { applyCoachPatch, CoachWriteError } from "@/lib/engine/coach/write";
import { getSession, messagesOf, saveSession, type CoachSession } from "@/lib/engine/coach/session";
import { MAX_DOCUMENT_CHARS, MAX_PDF_BYTES, PDF_TRANSCRIBE_PROMPT, START_CUE, START_WITH_CV_CUE, buildMessages, isCoachDocumentName, isPdfName, landedSince, recapOf, searchErrorNote, searchErrorsOf, systemFor, toolResultOf, transcriptFits, withoutOperatorNotes, type CoachDocument, type TurnContext, type TurnMessage } from "@/lib/engine/coach/turn";
import { STREAM_FRAME, applyEvent, emptyPending, pendingMatrixOf, type JobNote, type MatrixNote, type ScoredNote, type TranscriptTurn, type TurnEvent, type WriteNote } from "@/lib/engine/coach/transcript";
import { profileFromSetup, profileToYaml } from "@/lib/careerops/profile-file";
import type { CareerOpsSetupV2 } from "@/lib/careerops/types";
import type { Profile } from "@/lib/types";
import { BASE_OF, jhSectionHref, parseJhSection, type JhPageKey, type ProfilePortal } from "@/lib/jobhacking/sections";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// A turn is ≤ 250 words, but a save point writes whole lists in one tool call (Coach 3: forty
// companies) and the research coaches run several web searches — Pro's plain limit, no Fluid.
export const maxDuration = 300;

const MAX_TEXT = 8000;
const MAX_TOOL_ROUNDS = 6;

// Body: { coach: CoachKey, text?: string, start?: true, portal: "jobhacking" | "compass", context?: { page?, section? },
//         scores?: [{ item, values: [n, n, n, n] }] — the member's answers to the pending scoring matrix (docs/UX_COACH_AGENTIC.md §9–§10);
//                 the portal totals, ranks, flags and stores them, and the coach reads the table as the member's words
//         document?: { name, text } — the member's CV as .md / .txt, read in the browser (docs/UX_COACH_AGENTIC.md §3)
//                 or { name, pdfBase64 } — a PDF, transcribed here once through the SDK's document block
//         connections?: { name, text } — LinkedIn's Connections.csv (docs/UX_COACH_COMPANY_SCORING.md §3): parsed and matched here,
//                 stored under the account, never shown to the model — the coach hears counts }
// Streams SSE: text deltas as they are written, a `write` for each update_profile the coach
// made, then `done` with the finished turn (docs/UX_COACH.md §3–4). The member's words and
// the coach's turn land on users/{uid}/coachSessions/{coach}; the writes land on the profile.
export async function POST(req: NextRequest) {
  const m = await requireEngineMember(req);
  if (!m) return NextResponse.json({ ok: false }, { status: 403 });
  if (!isClaudeConfigured()) return NextResponse.json({ ok: false, error: "The coach is not configured yet (ANTHROPIC_API_KEY)." }, { status: 503 });
  const body = await req.json().catch(() => ({}));
  const coachKey: unknown = body?.coach;
  if (!isCoachKey(coachKey)) return NextResponse.json({ ok: false, error: "unknown coach" }, { status: 400 });
  const coach = findCoach(coachKey)!;
  const start = body?.start === true;
  const text = typeof body?.text === "string" ? body.text.trim().slice(0, MAX_TEXT) : "";
  let document: CoachDocument | null = null;
  let pdf: { name: string; data: string } | null = null;
  if (body?.document && typeof body.document === "object") {
    const name = typeof body.document.name === "string" ? body.document.name.trim().slice(0, 200) : "";
    const docText = typeof body.document.text === "string" ? body.document.text.trim() : "";
    if (!isCoachDocumentName(name)) return NextResponse.json({ ok: false, error: "A document comes in as a PDF, Markdown or plain text — a .pdf, .md or .txt file." }, { status: 400 });
    if (isPdfName(name)) {
      const data = typeof body.document.pdfBase64 === "string" ? body.document.pdfBase64.replace(/\s+/g, "") : "";
      if (!data || !/^[A-Za-z0-9+/=]+$/.test(data)) return NextResponse.json({ ok: false, error: "That PDF could not be read." }, { status: 400 });
      if (data.length * 0.75 > MAX_PDF_BYTES) return NextResponse.json({ ok: false, error: `That PDF is too large — ${Math.round(MAX_PDF_BYTES / 1024 / 1024)} MB at most.` }, { status: 400 });
      pdf = { name, data };
    } else {
    if (!docText) return NextResponse.json({ ok: false, error: "That file looks empty." }, { status: 400 });
    if (docText.length > MAX_DOCUMENT_CHARS) return NextResponse.json({ ok: false, error: `That file is too long — ${MAX_DOCUMENT_CHARS.toLocaleString()} characters at most.` }, { status: 400 });
    document = { name, text: docText };
    }
  }
  let connectionsIn: { name: string; text: string } | null = null;
  if (body?.connections && typeof body.connections === "object") {
    const name = typeof body.connections.name === "string" ? body.connections.name.trim().slice(0, 200) : "";
    const csv = typeof body.connections.text === "string" ? body.connections.text : "";
    if (!isConnectionsFileName(name) || !isConnectionsCsv(csv)) return NextResponse.json({ ok: false, error: "That isn't LinkedIn's Connections.csv — export it from LinkedIn → Settings → Data privacy → Get a copy of your data → Connections." }, { status: 400 });
    connectionsIn = { name, text: csv };
  }
  const scoresIn: unknown = body?.scores;
  if (!start && !text && !document && !pdf && !scoresIn && !connectionsIn) return NextResponse.json({ ok: false, error: "say something" }, { status: 400 });
  const portal: ProfilePortal = body?.portal === "compass" ? "compass" : "jobhacking";
  const rawCtx = body?.context && typeof body.context === "object" ? body.context : {};
  const ctx: TurnContext = {
    page: typeof rawCtx.page === "string" ? (rawCtx.page as JhPageKey) : null,
    section: typeof rawCtx.section === "string" ? parseJhSection(rawCtx.section) : null,
  };
  const uid = m.user.uid;
  const isAdmin = m.user.admin === true;

  const prompt = COACH_PROMPTS[coach.key];
  const tools = coachTools(coach.key);

  const db = adminDb();
  const [config, usage, session, profileSnap, setupSnap, override] = await Promise.all([
    getEngineConfig(), getUsageMonth(uid), getSession(uid, coach.key),
    db.doc(`users/${uid}`).get(), db.doc(`users/${uid}/careerOps/setup`).get(), getPromptOverride(coachPromptKey(coach.key)),
  ]);
  if (!config.agents.coach.enabled) return NextResponse.json({ ok: false, error: "The coach is switched off by the admin." }, { status: 503 });
  if (!isAdmin) {
    const q = quotaCheck(usage, config);
    if (q.over) return NextResponse.json({ ok: false, error: quotaLine(q), quota: q.reason }, { status: 429 });
  }
  const profile = profileSnap.exists ? (profileSnap.data() as Profile) : null;
  const setup = setupSnap.exists ? (setupSnap.data() as CareerOpsSetupV2) : null;
  const missing = missingBefore(coach, coachStates(setup?.jhg?.progress));
  if (missing.length) return NextResponse.json({ ok: false, error: `${coach.label} starts after ${missing.map((c) => c.label).join(" and ")}.` }, { status: 409 });

  // No transcript to replay — a new conversation, or one whose transcript outgrew its budget: the
  // first turn carries the profile and, after a restart, a recap of what the member can read.
  const history = messagesOf(session);
  const isFirst = history.length === 0;
  const first = isFirst
    ? { profileYaml: profileToYaml(profileFromSetup({ profile, setup })), account: { name: [profile?.firstName, profile?.lastName].filter(Boolean).join(" "), email: profile?.email ?? m.user.email ?? "" }, recap: recapOf(session.turns) }
    : null;
  const resolved = resolvePrompt(prompt.text, prompt.version, override);
  const cfg = config.agents.coach;
  const today = new Date().toISOString().slice(0, 10);
  // The connections export: parsed by code, stored under the account, matched to the stored companies — the coach hears the counts only.
  let connectionsLine: string | null = null;
  if (connectionsIn) {
    const rows = parseConnections(connectionsIn.text);
    await saveConnections(uid, rows, connectionsIn.name);
    const stored = (setup?.jhg?.targetCompanies?.companies ?? []).filter((c) => c?.name?.trim());
    const matched = matchConnections(rows, stored.map((c) => c.name));
    connectionsLine = `I uploaded my LinkedIn connections — ${rows.length} connections; ${matched.size} of my ${stored.length} companies have at least one. The portal matched them by company name and keeps the names in my account; you see counts. Suggest Access from them in the matrix.`;
  }
  // A PDF becomes text once, here, through the SDK's document block — so the stored transcript carries words, not
  // a megabyte of base64 replayed every turn. Metered on this coach like any other call.
  let pdfUsd = 0;
  if (pdf) {
    try {
      const r = await claudeCall({
        model: cfg.model, effort: "low", maxTokens: Math.min(cfg.maxTokens, 16000), system: PDF_TRANSCRIBE_PROMPT,
        messages: [{ role: "user", content: [{ type: "document", source: { type: "base64", media_type: "application/pdf", data: pdf.data }, title: pdf.name }, { type: "text", text: "Transcribe it." }] }],
      });
      pdfUsd = (await recordUsage(uid, { kind: "coach", key: coach.key, model: r.model, usage: r.usage }, config)).estimatedUsd;
      const transcribed = r.text.trim().slice(0, MAX_DOCUMENT_CHARS);
      if (!transcribed) return NextResponse.json({ ok: false, error: "That PDF had no readable text — a scanned image? Export it as text, or paste your CV." }, { status: 400 });
      document = { name: pdf.name, text: transcribed };
    } catch (e: unknown) {
      return NextResponse.json({ ok: false, error: e instanceof ClaudeRefusal ? e.message : "Couldn't read that PDF — try a .md or .txt export." }, { status: 400 });
    }
  }
  // The matrix, answered: scored against the rows the coach showed — totals, ranks and flags are the portal's; each
  // rubric stores its own shape (skills: jhg.narrative.skillScores; companies: companies[].scores, ranked by rankCompanies).
  let scored: { note: ScoredNote; patch: Record<string, unknown>; label: string; message: string } | null = null;
  if (scoresIn) {
    const matrix = pendingMatrixOf(session.turns);
    if (!matrix) return NextResponse.json({ ok: false, error: "There is no matrix waiting for your scores." }, { status: 409 });
    const rubric = rubricOf(matrix.kind);
    const parsed = parseRows(scoresIn, matrix.items, rubric);
    if (!parsed.ok) return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
    if (matrix.kind === "skills") {
      const rows = scoreSkills(parsed.rows);
      scored = { note: { kind: "skills", rows: rows.map(skillRow) }, patch: { jhg: { narrative: { skillScores: rows } } }, label: "competencies", message: scoresMessage(rows) };
    } else {
      const companies = applyCompanyScores(setup?.jhg?.targetCompanies?.companies ?? [], parsed.rows);
      // The overrides — a suggested number the member changed — ride the rows and the flags (docs/UX_COACH_COMPANY_SCORING.md §4).
      const flags = [...companyFlags(companies), ...overrideFlags(parsed.rows)];
      await saveFinalScores(uid, parsed.rows);
      scored = { note: { kind: "companies", rows: withOverrides(companyRows(companies), parsed.rows) }, patch: { jhg: { targetCompanies: { companies } } }, label: "top40", message: companyScoresMessage(companies, flags) };
    }
  }
  const memberText = scored ? scored.message : start ? (document ? START_WITH_CV_CUE : START_CUE) : connectionsLine ? [text, connectionsLine].filter(Boolean).join("\n\n") : text || `Here is ${document!.name}.`;
  // Research that finished since the coach last spoke rides on this turn's operator note (docs/COACH_ASSESSMENT_2026-11-16.md §1.2).
  const recentJobs = await listUserJobs(uid, 10);
  if (!isFirst || session.turns.length) Object.assign(ctx, landedSince(recentJobs, session.lastTurnAt, (t) => ENGINE_JOB_LABELS[t as EngineJobType] ?? t));
  // The step's job, named every turn until it has run — an older conversation shows the coach searching for itself (lib/engine/coach/research-due.ts).
  ctx.researchDue = researchDue(coach.key, setup?.jhg, recentJobs, session.startedAt)?.line ?? null;
  // Opened from an empty Top 3? The conversation keeps the work's order (the 40 first) — the page's order is for reading (lib/engine/coach/parts.ts steerNote).
  ctx.steer = steerNote(coach.key, ctx.section, profileFromSetup({ profile, setup }));
  // A search that failed on the last turn is said, not improvised around (docs/SEARCH_TO_API_ASSESSMENT_2026-11-17.md §4 PR 0).
  if (session.lastSearchErrors?.length) ctx.searchErrors = session.lastSearchErrors;
  let messages: TurnMessage[] = buildMessages(history, memberText, first, ctx, document);
  const now = Date.now();

  const enc = new TextEncoder();
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: TurnEvent) => controller.enqueue(enc.encode(STREAM_FRAME(e)));
      let pending = emptyPending();
      let usd = pdfUsd;
      let completed = false;
      const searchErrors: string[] = [];
      try {
        if (scored) {
          // Code writes the scores (decision 2026-11-16: code checks, the model converses) — before the coach speaks, as the page's own write line.
          const r = await applyCoachPatch({ uid, coach: coach.key, patch: scored.patch, portal });
          const label = scored.label === "top40" ? "Top 40" : "Core competencies";
          const note: WriteNote = r.note.labels.length ? r.note : { ...r.note, labels: [label], links: [{ label, href: jhSectionHref(scored.label as "top40" | "competencies", BASE_OF[portal]) }] };
          pending = applyEvent(pending, { type: "write", note }); send({ type: "write", note });
        }
        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          const s = claudeStream({
            model: cfg.model, effort: cfg.effort, maxTokens: cfg.maxTokens,
            system: systemFor(resolved.text, prompt.knowledge),
            messages: messages as Anthropic.Beta.BetaMessageParam[],
            tools,
            maxSearches: coach.search,
            // A person pauses between turns (docs/UX_COACH.md §6, Long sessions): 1h, like the system blocks.
            cacheConversation: "1h",
          });
          let sawTextThisRound = false;
          for await (const ev of s) {
            if (ev.type === "content_block_start" && ev.content_block.type === "text" && pending.text && !sawTextThisRound) { pending = applyEvent(pending, { type: "text", text: "\n\n" }); send({ type: "text", text: "\n\n" }); }
            if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") { sawTextThisRound = true; pending = applyEvent(pending, { type: "text", text: ev.delta.text }); send({ type: "text", text: ev.delta.text }); }
          }
          const msg = await s.finalMessage();
          const { estimatedUsd } = await recordUsage(uid, { kind: "coach", key: coach.key, model: msg.model, usage: { input: msg.usage.input_tokens, output: msg.usage.output_tokens, cacheRead: msg.usage.cache_read_input_tokens ?? 0, cacheWrite: msg.usage.cache_creation_input_tokens ?? 0, searches: msg.usage.server_tool_use?.web_search_requests ?? 0 } }, config);
          usd += estimatedUsd;
          if (msg.stop_reason === "refusal") throw new ClaudeRefusal(msg.stop_details?.category ?? null, msg.stop_details?.explanation ?? null);
          messages = [...messages, { role: "assistant", content: msg.content }];
          // The web search answered an error block: recorded on the turn; the operator says so to the model (this round when it goes on, else next turn).
          const roundErrors = searchErrorsOf(msg.content);
          if (roundErrors.length) { searchErrors.push(...roundErrors); console.warn(`[coach:${coach.key}] web search failed: ${roundErrors.join(", ")} (uid ${uid})`); }
          if (msg.stop_reason !== "tool_use") break;

          const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
          for (const b of msg.content) {
            if (b.type !== "tool_use") continue;
            if (b.name === RUN_RESEARCH) {
              // A research step as a job: created and queued here, run beside the conversation, read live by the panel.
              const input = (b.input ?? {}) as Record<string, unknown>;
              if (!isResearchKind(input.kind)) { results.push({ type: "tool_result", tool_use_id: b.id, content: JSON.stringify({ ok: false, error: "unknown research kind" }), is_error: true }); continue; }
              try {
                const type: EngineJobType = input.kind;
                const { kind: _k, ...hints } = input;
                const job = await createJob({ uid, type, payload: { ...hints, portal, coach: coach.key }, createdBy: `coach:${coach.key}` });
                if (isQueueConfigured()) await publishRun({ uid, jobId: job.id, type });
                else void runUnit({ uid, jobId: job.id, type }).catch(() => patchJob(uid, job.id, { status: "failed", error: "inline run failed", endedAt: Date.now() }));
                const note: JobNote = { id: job.id, type, label: ENGINE_JOB_LABELS[type] };
                pending = applyEvent(pending, { type: "job", job: note }); send({ type: "job", job: note });
                results.push({ type: "tool_result", tool_use_id: b.id, content: JSON.stringify({ ok: true, jobId: job.id, status: "queued", note: "Running beside the conversation — a minute or two. Tell the member, ask them something meanwhile, and end your turn; the result reaches the page and your next turn." }) });
              } catch (e: unknown) {
                results.push({ type: "tool_result", tool_use_id: b.id, content: JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "could not start the research" }), is_error: true });
              }
              continue;
            }
            if (b.name === SCORE_MATRIX) {
              // The matrix: the portal shows it, the member scores all at once, the turn ends (docs/UX_COACH_AGENTIC.md §9–§10).
              const input = (b.input ?? {}) as { kind?: unknown; items?: unknown };
              const rubric = isRubricKind(input.kind) ? coachRubrics(coach.key).find((r) => r.kind === input.kind) : undefined;
              if (!rubric) { results.push({ type: "tool_result", tool_use_id: b.id, content: JSON.stringify({ ok: false, error: `unknown kind — this coach has ${coachRubrics(coach.key).map((r) => r.kind).join(", ")}` }), is_error: true }); continue; }
              let matrix: MatrixNote;
              let evidenceNote = "";
              if (rubric.kind === "companies") {
                // The rows are the stored 40: the member cannot score a company that is not on the page.
                const found = matrixCompanies(setup?.jhg?.targetCompanies?.companies ?? [], Array.isArray(input.items) ? (input.items as unknown[]).filter((x): x is string => typeof x === "string") : null);
                if (!found.ok) { results.push({ type: "tool_result", tool_use_id: b.id, content: JSON.stringify({ ok: false, error: found.error }), is_error: true }); continue; }
                const cleaned = cleanItems(found.companies.map((c) => c.name), rubric);
                if (!cleaned.ok) { results.push({ type: "tool_result", tool_use_id: b.id, content: JSON.stringify({ ok: false, error: cleaned.error }), is_error: true }); continue; }
                // The portal's evidence under each row — Growth and Access suggested, Interest and Proof given context (docs/UX_COACH_COMPANY_SCORING.md §2).
                const ev = await buildCompaniesEvidence(uid, found.companies, profileFromSetup({ profile, setup }), today);
                matrix = { kind: "companies", items: cleaned.items, meta: found.companies.map(companyMeta), evidence: cleaned.items.map((n) => ev.byName[n]), suggested: cleaned.items.map((n) => ev.suggested[n]), connections: ev.connections };
                evidenceNote = ev.connections ? `Growth and Access are pre-filled from the postings, the growth sources and ${ev.connections.total} connections (${ev.connections.matched} companies have one); the member sets Interest and Proof and may change any suggestion.` : "Growth is pre-filled from the postings and growth sources; Access from postings only — no Connections.csv on file, so ask for it if they have not sent it. The member sets Interest and Proof and may change any suggestion.";
              } else {
                const cleaned = cleanItems(input.items, rubric);
                if (!cleaned.ok) { results.push({ type: "tool_result", tool_use_id: b.id, content: JSON.stringify({ ok: false, error: cleaned.error }), is_error: true }); continue; }
                matrix = { kind: rubric.kind, items: cleaned.items };
              }
              pending = applyEvent(pending, { type: "matrix", matrix }); send({ type: "matrix", matrix });
              results.push({ type: "tool_result", tool_use_id: b.id, content: JSON.stringify({ ok: true, shown: matrix.items.length, note: `The matrix is in front of the member; they are scoring every ${rubric.item} now. ${evidenceNote}End your turn with one short line and no question — their next message is the ranked table with the portal's totals, ranks and flags.`.replace("  ", " ") }) });
              continue;
            }
            if (b.name !== UPDATE_PROFILE) { results.push({ type: "tool_result", tool_use_id: b.id, content: JSON.stringify({ ok: false, error: `unknown tool ${b.name}` }), is_error: true }); continue; }
            const input = (b.input ?? {}) as { patch?: Record<string, unknown>; progress?: "in_progress" | "complete" };
            try {
              const r = await applyCoachPatch({ uid, coach: coach.key, patch: input.patch ?? {}, progress: input.progress, portal });
              if (r.note.progress === "complete") completed = true;
              pending = applyEvent(pending, { type: "write", note: r.note }); send({ type: "write", note: r.note });
              results.push({ type: "tool_result", tool_use_id: b.id, content: JSON.stringify(toolResultOf(r.note.labels, r.stored, r.warnings, { failedChecks: r.checks.filter((c) => !c.pass), progress: r.progress, readiness: r.readiness })) });
            } catch (e: unknown) {
              const err = e instanceof CoachWriteError ? { error: e.message, details: e.details } : { error: e instanceof Error ? e.message : "write failed" };
              results.push({ type: "tool_result", tool_use_id: b.id, content: JSON.stringify({ ok: false, ...err }), is_error: true });
            }
          }
          messages = [...messages, { role: "user", content: roundErrors.length ? [...results, { type: "text", text: searchErrorNote(roundErrors) }] : results }];
        }

        const coachTurn: TranscriptTurn = { role: "coach", text: pending.text.trim() || textOf([]), at: Date.now(), ...(pending.writes.length ? { writes: pending.writes } : {}), ...(pending.jobs.length ? { jobs: pending.jobs } : {}), ...(pending.matrix ? { matrix: pending.matrix } : {}), ...(searchErrors.length ? { searchErrors } : {}) };
        // A start from a CV shows as the member's turn — the file they handed over — so the transcript says where the drafts came from.
        // Scores from the matrix show as the member's turn too: the scored table, not the generated prose the coach read.
        const attachment = document?.name ?? connectionsIn?.name;
        const memberTurn: TranscriptTurn | null = start && !document ? null : scored ? { role: "member", text: "", at: now, scored: scored.note } : { role: "member", text: start ? "" : text, at: now, ...(attachment ? { attachment } : {}) };
        const turns: TranscriptTurn[] = [...session.turns, ...(memberTurn ? [memberTurn] : []), coachTurn];
        // Past the budget (Firestore's 1 MiB document): drop the transcript; the next turn restarts from the profile and a recap of `turns`.
        const transcript = JSON.stringify(withoutOperatorNotes(messages));
        const next: CoachSession = {
          ...session,
          status: completed || session.status === "complete" ? "complete" : "in_progress",
          turns,
          messagesJson: transcriptFits(transcript) ? transcript : "[]",
          turnCount: session.turnCount + 1,
          startedAt: session.turnCount === 0 ? now : session.startedAt,
          lastTurnAt: Date.now(),
          openedOn: session.openedOn ?? ctx.page ?? null,
          lastSearchErrors: searchErrors,
          searchErrors: searchErrors.reduce((acc, c) => ({ ...acc, [c]: (acc[c] ?? 0) + 1 }), { ...(session.searchErrors ?? {}) }),
        };
        await saveSession(uid, coach.key, next);
        send({ type: "done", turn: coachTurn, usdThisTurn: usd });
      } catch (e: unknown) {
        const message = e instanceof ClaudeRefusal ? e.message : e instanceof Error ? e.message : "The coach couldn't answer — try again.";
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, { headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache, no-transform", connection: "keep-alive", "x-accel-buffering": "no" } });
}

// Start over (docs/UX_COACH.md §7): the transcript goes, the profile stays — unless `data=1`, which also removes what that
// coach wrote (its owned paths and stamp; lib/engine/coach/reset-data.ts) so the page is clean for a new run.
export async function DELETE(req: NextRequest) {
  const m = await requireEngineMember(req);
  if (!m) return NextResponse.json({ ok: false }, { status: 403 });
  const coachKey = req.nextUrl.searchParams.get("coach");
  if (!isCoachKey(coachKey)) return NextResponse.json({ ok: false, error: "unknown coach" }, { status: 400 });
  const data = req.nextUrl.searchParams.get("data") === "1";
  try {
    const r = await resetCoach(m.user.uid, coachKey, data);
    return NextResponse.json({ ok: true, ...r });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "reset failed" }, { status: 500 });
  }
}

