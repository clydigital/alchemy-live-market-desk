import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { runAccuracyCheck } from "@/lib/accuracy";
import { evaluateIntakeStatus } from "@/lib/intelligence/research-state";
import { getEconomicCalendar } from "@/lib/calendar";
import { getDeskData } from "@/lib/data";
import { buildHighImpactCalendarIntake } from "@/lib/high-impact-calendar-intake";
import { persistMacroReleaseLifecycle } from "@/lib/macro-release-persistence";
import { openAIIntelligenceEnabled } from "@/lib/intelligence/openai";
import { persistCanonicalEditionForResearchRun, runIntelligenceEngine, type IntelligenceRunResult } from "@/lib/intelligence/runtime";
import { getMarketData } from "@/lib/market";
import { type ResearchRunLedgerStartFields, writeResearchRunLedgerStart } from "@/lib/research-run-ledger";
import { CANONICAL_RESEARCH_SLOTS } from "@/lib/research-schedule-health";
import { acceptsResearchAuthorization } from "@/lib/research-auth";
import {
  researchScheduleHealth,
  validateResearchRun,
  type ResearchRunInput,
} from "@/lib/research-update";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const updateToken = process.env.RESEARCH_UPDATE_TOKEN;
const cronSecret = process.env.CRON_SECRET;

function response(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    },
  });
}

function authenticated(request: Request) {
  return acceptsResearchAuthorization(request.headers.get("authorization"), [updateToken, cronSecret]);
}

async function rest<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!supabaseUrl || !serviceKey) throw new Error("Research publisher database credentials are not configured.");
  const result = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
    cache: "no-store",
  });
  if (!result.ok) {
    const detail = await result.text();
    throw new Error(`Database request failed (${result.status}): ${detail.slice(0, 500)}`);
  }
  // PostgREST may acknowledge `Prefer: return=minimal` with an empty 2xx
  // response other than 204. Treat that as a successful write instead of
  // attempting to parse an empty JSON body and incorrectly failing the run.
  const text = await result.text();
  return (text.trim() ? JSON.parse(text) : undefined) as T;
}

function sourceCount(input: ResearchRunInput, keys: string[]) {
  return input.sourceChecks
    .filter((check) => keys.includes(check.source))
    .reduce((sum, check) => sum + check.itemCount, 0);
}

export function buildResearchRunLedgerStartFields(input: {
  researchRun: ResearchRunInput;
  validation: ReturnType<typeof validateResearchRun>;
  accuracyGate: ReturnType<typeof runAccuracyCheck>["updateGate"];
  calendarItemCount: number;
  warnings: string[];
  now?: string;
}): ResearchRunLedgerStartFields {
  const { researchRun, validation, accuracyGate, calendarItemCount, warnings } = input;
  const now = input.now ?? new Date().toISOString();
  return {
    schedule_slot: researchRun.scheduleSlot,
    scheduled_for: researchRun.scheduledFor,
    status: "running",
    accuracy_gate: accuracyGate,
    required_sources_complete: validation.sourceCoverageAvailable,
    evidence_gate_passed: validation.recalibrationEvidenceUsable,
    source_checks: researchRun.sourceChecks,
    videos_found: sourceCount(researchRun, ["stockedup", "wall-street-truth-bombs", "traders-reality"]),
    transcripts_ready: validation.scoredItems.filter((item) => item.itemType === "video" && item.transcriptStatus === "ready").length,
    news_scanned: sourceCount(researchRun, ["zerohedge", "axios", "investing-com", "fxstreet"]) + calendarItemCount,
    candidates_kept: validation.scoredItems.filter((item) => item.recommendedAction !== "ignore").length,
    articles_scanned: Math.min(30, sourceCount(researchRun, ["alchemy-market-insights"])),
    articles_flagged: validation.scoredItems.filter((item) => item.itemType === "alchemy_article" && item.recommendedAction === "review_article").length,
    evidence_added: new Set(validation.scoredItems.flatMap((item) => item.evidence.map((link) => link.url))).size,
    updates_published: 0,
    warnings,
    summary: researchRun.summary || null,
    updated_at: now,
  };
}

export function intakeStatus(
  item: ReturnType<typeof validateResearchRun>["scoredItems"][number],
) {
  return evaluateIntakeStatus(item);
}

export async function GET() {
  const data = await getDeskData();
  const calendarItems = buildHighImpactCalendarIntake(await getEconomicCalendar());
  return response({
    generatedAt: new Date().toISOString(),
    timezone: "Asia/Kuala_Lumpur",
    schedule: CANONICAL_RESEARCH_SLOTS.map((slot) => `${String(slot.hour).padStart(2, "0")}:${String(slot.minute).padStart(2, "0")}`),
    health: researchScheduleHealth(data.researchRuns),
    runs: data.researchRuns.slice(0, 10),
    queue: data.researchIntake.slice(0, 50),
    intelligence: {
      enabled: openAIIntelligenceEnabled(),
      owner: "Live Desk",
      mode: "evidence_to_hypothesis_to_challenger_to_story",
    },
    highImpactCalendar: calendarItems.map(({ evidence, ...item }) => ({ ...item, evidenceCount: evidence?.length || 0 })),
  });
}

export async function POST(request: Request) {
  if (!authenticated(request)) return response({ error: "Unauthorized research publisher." }, 401);
  if (!supabaseUrl || !serviceKey) return response({ error: "Research publisher database credentials are not configured." }, 503);

  // PART A: Distinguish scheduled vs non-scheduled paths.
  // ONLY trusted after passing authorization (line 72 above).
  const isScheduledInternalRequest = request.headers.get("x-alchemy-scheduled-research") === "1";
  const deferScheduledIntelligence = isScheduledInternalRequest && request.headers.get("x-alchemy-defer-intelligence") === "1";
  const scheduledExecutionStartedAt = request.headers.get("x-alchemy-scheduled-research-started-at");
  const scheduledExecutionStartedAtMs = scheduledExecutionStartedAt ? Date.parse(scheduledExecutionStartedAt) : Number.NaN;

  let input: ResearchRunInput;
  try {
    const body = await request.json();
    if (!body || typeof body !== "object") return response({ error: "A JSON research run is required." }, 400);
    input = body as ResearchRunInput;
  } catch {
    return response({ error: "The request body is not valid JSON." }, 400);
  }

  const anchor = Number.isFinite(Date.parse(input.scheduledFor)) ? new Date(input.scheduledFor) : new Date();
  const calendarItems = buildHighImpactCalendarIntake(await getEconomicCalendar(), anchor);
  const suppliedItems = Array.isArray(input.items) ? input.items : [];
  const suppliedKeys = new Set(suppliedItems.map((item) => item.itemKey));
  input = {
    ...input,
    items: [...suppliedItems, ...calendarItems.filter((item) => !suppliedKeys.has(item.itemKey))],
  };

  const intelligenceEnabled = openAIIntelligenceEnabled();
  const callerRecalibrationCount = Array.isArray(input.recalibrations) ? input.recalibrations.length : 0;
  const validationInput: ResearchRunInput = intelligenceEnabled
    ? { ...input, recalibrations: [] }
    : input;
  const validation = validateResearchRun(validationInput);
  if (validation.errors.length) {
    return response({
      error: "Research run validation failed.",
      errors: validation.errors,
      warnings: validation.warnings,
      calendarCandidates: calendarItems.length,
      intelligenceEnabled,
    }, 422);
  }

  const accuracy = runAccuracyCheck(await getMarketData());
  const macroLifecycle = await persistMacroReleaseLifecycle();
  // Only a structurally blocked canonical market-data check prevents writes.
  // Provider coverage and research completeness remain descriptive diagnostics.
  const runtimePublicationReady = accuracy.updateGate !== "blocked";
  const warnings = [...validation.warnings];
  if (!macroLifecycle.available) warnings.push(`Macro release lifecycle persistence is unavailable: ${macroLifecycle.reason}`);
  if (intelligenceEnabled && callerRecalibrationCount) {
    warnings.push(`${callerRecalibrationCount} caller-supplied Story recalibration(s) were ignored because the OpenAI intelligence engine owns Story reasoning.`);
  }
  if (!calendarItems.length) warnings.push("No verified high-impact economic releases were found in the two-day lookback and eight-day forward window.");
  if (accuracy.updateGate === "blocked") warnings.push("Canonical market data failed structural accuracy checks; intelligence may reason but writes are disabled for this run.");
  else if (accuracy.updateGate === "review") warnings.push("Canonical market data has review diagnostics; legitimate traceable Stories may still publish.");
  if (!validation.sourceCoverageAvailable) warnings.push("Direct-provider coverage is degraded; available canonical evidence and unrelated Stories continue independently.");
  if (input.dryRun) {
    return response({
      accepted: true,
      dryRun: true,
      publicationReadiness: runtimePublicationReady ? "ready" : "structurally_blocked",
      intelligenceEnabled,
      intelligenceWillPublish: false,
      accuracy,
      warnings,
      calendarCandidates: calendarItems.length,
      macroLifecycle: macroLifecycle.summary,
      scoredItems: validation.scoredItems.map(({ transcriptText: _transcriptText, ...item }) => item),
    });
  }

  let runId: string | null = null;
  try {
    const runStatus = runtimePublicationReady ? "completed" : "blocked";
    const now = new Date().toISOString();
    const ledgerFields = buildResearchRunLedgerStartFields({
      researchRun: input,
      validation,
      accuracyGate: accuracy.updateGate,
      calendarItemCount: calendarItems.length,
      warnings,
      now,
    });
    runId = await writeResearchRunLedgerStart({
      rest,
      runKey: input.runKey,
      isScheduledInternalRequest,
      fields: ledgerFields,
      now,
    });

    if (validation.scoredItems.length) {
      await rest("research_intake_items?on_conflict=item_key", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(validation.scoredItems.map((item) => ({
          run_id: runId,
          item_key: item.itemKey,
          item_type: item.itemType,
          publisher: item.publisher,
          external_id: item.externalId || null,
          title: item.title,
          url: item.url,
          published_at: item.publishedAt,
          article_position: item.articlePosition || null,
          transcript_status: item.itemType === "video" ? item.transcriptStatus : "not_applicable",
          transcript_text: item.itemType === "video" ? item.transcriptText || null : null,
          summary: item.summary,
          affected_story_slugs: item.affectedStorySlugs || [],
          source_quality: item.sourceQuality,
          relevance: item.relevance,
          novelty: item.novelty,
          materiality: item.materiality,
          candidate_score: item.candidateScore,
          recommended_action: item.recommendedAction,
          status: intakeStatus(item),
          stats_signal: item.statsSignal || null,
          news_signal: item.newsSignal || null,
          divergence_kind: item.divergenceKind || "none",
          divergence_note: item.divergenceNote || null,
          evidence_links: item.evidence,
          review_reason: item.reviewReason || null,
          updated_at: new Date().toISOString(),
        }))),
      });
    }

    if (deferScheduledIntelligence && intelligenceEnabled) {
      const deferredWarning = "Scheduled acquisition persisted; canonical intelligence is pending a dedicated continuation invocation.";
      if (!warnings.includes(deferredWarning)) warnings.push(deferredWarning);
      await rest(`research_runs?id=eq.${encodeURIComponent(runId)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          completed_at: null,
          status: "running",
          updates_published: 0,
          warnings,
          updated_at: new Date().toISOString(),
        }),
      });
      return response({
        accepted: true,
        runId,
        status: "intelligence_pending",
        publicationReadiness: runtimePublicationReady ? "ready" : "structurally_blocked",
        updatesPublished: 0,
        legacyRecalibrationsPublished: 0,
        legacyUpdatesPublished: 0,
        intelligence: null,
        calendarCandidates: calendarItems.length,
        macroLifecycle: macroLifecycle.summary,
        warnings,
        accuracy: { status: accuracy.status, score: accuracy.score, updateGate: accuracy.updateGate },
      }, 202);
    }

    let intelligence: IntelligenceRunResult | null = null;
    if (intelligenceEnabled) {
      intelligence = await runIntelligenceEngine({
        researchRunId: runId,
        triggerKind: "new_evidence",
        runKey: `research:${input.runKey}`,
        dryRun: !runtimePublicationReady,
        scheduledExecutionStartedAtMs: isScheduledInternalRequest
          ? (Number.isFinite(scheduledExecutionStartedAtMs) ? scheduledExecutionStartedAtMs : Date.now())
          : undefined,
        stageMaxAttempts: isScheduledInternalRequest ? 1 : undefined,
      });
      warnings.push(...intelligence.warnings.filter((warning) => !warnings.includes(warning)));
    }

    let legacyUpdatesPublished = 0;
    if (!intelligenceEnabled && runtimePublicationReady && validation.recalibrations.length) {
      const stories = await rest<Array<{ id: string; slug: string; confidence: number }>>(
        "stories?select=id,slug,confidence&status=neq.archived",
      );
      const storyBySlug = new Map(stories.map((story) => [story.slug, story]));
      for (const update of validation.recalibrations) {
        const story = storyBySlug.get(update.storySlug);
        if (!story) {
          warnings.push(`Story ${update.storySlug} was not found; its recalibration was skipped.`);
          continue;
        }
        const evidenceCount = new Set(
          update.evidenceItemKeys.flatMap((key) =>
            validation.scoredItems.find((item) => item.itemKey === key)?.evidence.map((link) => link.url) || [],
          ),
        ).size;
        await rest("story_updates", {
          method: "POST",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({
            story_id: story.id,
            update_type: "recalibration",
            headline: update.headline,
            detail: `${update.detail}\n\nEvidence room: ${evidenceCount} dated links. Unresolved test: ${update.unresolvedTest}`,
            observed_at: update.observedAt,
          }),
        });
        const confidence = Math.max(0, Math.min(100, story.confidence + update.confidenceDelta));
        await rest(`stories?id=eq.${encodeURIComponent(story.id)}`, {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({
            confidence,
            strongest_support: update.strongestSupport,
            strongest_contradiction: update.strongestContradiction,
            next_catalyst: update.unresolvedTest,
            updated_at: new Date().toISOString(),
          }),
        });
        legacyUpdatesPublished += 1;
      }
    }

    let finalStatus: "completed" | "blocked" | "failed" = runStatus;
    if (intelligenceEnabled && intelligence?.status !== "completed") {
      finalStatus = intelligence?.status === "failed" ? "failed" : "blocked";
      warnings.push(`The OpenAI intelligence runtime ended ${intelligence?.status || "without a result"}; this research run is not recorded as completed.`);
    }

    const totalUpdatesPublished = legacyUpdatesPublished + (intelligence?.storiesPublished || 0);
    if (finalStatus === "completed") {
      await persistCanonicalEditionForResearchRun({
        researchRunId: runId,
        runKey: input.runKey,
        publicSummary: input.summary || null,
      });
    }
    await rest(`research_runs?id=eq.${encodeURIComponent(runId)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        completed_at: new Date().toISOString(),
        status: finalStatus,
        updates_published: totalUpdatesPublished,
        warnings,
        updated_at: new Date().toISOString(),
      }),
    });

    revalidatePath("/");
    revalidatePath("/stories");
    revalidatePath("/data/macro");
    revalidatePath("/api/hybrid-feed");
    revalidatePath("/api/hybrid-feed-v2");
    return response({
      accepted: true,
      runId,
      status: finalStatus,
      publicationReadiness: runtimePublicationReady ? "ready" : "structurally_blocked",
      updatesPublished: totalUpdatesPublished,
      legacyRecalibrationsPublished: legacyUpdatesPublished,
      legacyUpdatesPublished,
      intelligence,
      calendarCandidates: calendarItems.length,
      macroLifecycle: macroLifecycle.summary,
      warnings,
      accuracy: { status: accuracy.status, score: accuracy.score, updateGate: accuracy.updateGate },
    }, finalStatus === "completed" ? 200 : finalStatus === "failed" ? 500 : 202);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown research publisher failure.";
    if (runId) {
      try {
        await rest(`research_runs?id=eq.${encodeURIComponent(runId)}`, {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({
            completed_at: new Date().toISOString(),
            status: "failed",
            warnings: [...warnings, message],
            updated_at: new Date().toISOString(),
          }),
        });
      } catch {
        // Preserve the original error response when the failure ledger is also unavailable.
      }
    }
    return response({ error: message, runId }, 500);
  }
}