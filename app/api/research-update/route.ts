import { timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { runAccuracyCheck } from "@/lib/accuracy";
import { getEconomicCalendar } from "@/lib/calendar";
import { getDeskData } from "@/lib/data";
import { buildHighImpactCalendarIntake } from "@/lib/high-impact-calendar-intake";
import { openAIIntelligenceEnabled } from "@/lib/intelligence/openai";
import { runIntelligenceEngine, type IntelligenceRunResult } from "@/lib/intelligence/runtime";
import { getMarketData } from "@/lib/market";
import {
  researchScheduleHealth,
  validateResearchRun,
  type ResearchRunInput,
} from "@/lib/research-update";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const updateToken = process.env.RESEARCH_UPDATE_TOKEN;

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
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!updateToken || supplied.length !== updateToken.length) return false;
  return timingSafeEqual(Buffer.from(supplied), Buffer.from(updateToken));
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
  if (result.status === 204) return undefined as T;
  return result.json() as Promise<T>;
}

function sourceCount(input: ResearchRunInput, keys: string[]) {
  return input.sourceChecks
    .filter((check) => keys.includes(check.source))
    .reduce((sum, check) => sum + check.itemCount, 0);
}

function intakeStatus(
  item: ReturnType<typeof validateResearchRun>["scoredItems"][number],
  publishGateOpen: boolean,
) {
  if (item.recommendedAction === "ignore") return "rejected";
  if (item.itemType === "video" && item.transcriptStatus !== "ready") return "blocked";
  if (item.recommendedAction === "recalibrate_story" && !publishGateOpen) return "blocked";
  if (item.recommendedAction === "recalibrate_story") return "published";
  return "accepted";
}

export async function GET() {
  const data = await getDeskData();
  const calendarItems = buildHighImpactCalendarIntake(await getEconomicCalendar());
  return response({
    generatedAt: new Date().toISOString(),
    timezone: "Asia/Kuala_Lumpur",
    schedule: ["08:30", "22:00"],
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
  const publishGateOpen = accuracy.updateGate === "open"
    && validation.requiredSourcesComplete
    && validation.evidenceGatePassed;
  const warnings = [...validation.warnings];
  if (intelligenceEnabled && callerRecalibrationCount) {
    warnings.push(`${callerRecalibrationCount} caller-supplied Story recalibration(s) were ignored because the OpenAI intelligence engine owns Story reasoning.`);
  }
  if (!calendarItems.length) warnings.push("No verified high-impact economic releases were found in the two-day lookback and eight-day forward window.");
  if (accuracy.updateGate !== "open") warnings.push(`Accuracy gate is ${accuracy.updateGate}; intelligence may reason about the evidence but cannot publish a Story in this run.`);
  if (!validation.requiredSourcesComplete) warnings.push("At least one required source check was blocked.");
  if (input.dryRun) {
    return response({
      accepted: true,
      dryRun: true,
      publishGate: publishGateOpen ? "open" : "blocked",
      intelligenceEnabled,
      intelligenceWillPublish: false,
      accuracy,
      warnings,
      calendarCandidates: calendarItems.length,
      scoredItems: validation.scoredItems.map(({ transcriptText: _transcriptText, ...item }) => item),
    });
  }

  let runId: string | null = null;
  try {
    const runStatus = accuracy.updateGate === "open"
      && validation.requiredSourcesComplete
      && validation.evidenceGatePassed
      ? "completed"
      : "blocked";
    const runRows = await rest<Array<{ id: string }>>("research_runs?on_conflict=run_key", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({
        run_key: input.runKey,
        schedule_slot: input.scheduleSlot,
        scheduled_for: input.scheduledFor,
        started_at: new Date().toISOString(),
        status: "running",
        accuracy_gate: accuracy.updateGate,
        required_sources_complete: validation.requiredSourcesComplete,
        evidence_gate_passed: validation.evidenceGatePassed,
        source_checks: input.sourceChecks,
        videos_found: sourceCount(input, ["stockedup", "wall-street-truth-bombs", "traders-reality"]),
        transcripts_ready: validation.scoredItems.filter((item) => item.itemType === "video" && item.transcriptStatus === "ready").length,
        news_scanned: sourceCount(input, ["zerohedge", "axios", "investing-com", "fxstreet"]) + calendarItems.length,
        candidates_kept: validation.scoredItems.filter((item) => item.recommendedAction !== "ignore").length,
        articles_scanned: Math.min(30, sourceCount(input, ["alchemy-market-insights"])),
        articles_flagged: validation.scoredItems.filter((item) => item.itemType === "alchemy_article" && item.recommendedAction === "review_article").length,
        evidence_added: new Set(validation.scoredItems.flatMap((item) => item.evidence.map((link) => link.url))).size,
        updates_published: 0,
        warnings,
        summary: input.summary || null,
        updated_at: new Date().toISOString(),
      }),
    });
    runId = runRows[0]?.id || null;
    if (!runId) throw new Error("The research run did not return an id.");

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
          status: intakeStatus(item, publishGateOpen),
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

    let legacyUpdatesPublished = 0;
    let intelligence: IntelligenceRunResult | null = null;
    if (intelligenceEnabled) {
      intelligence = await runIntelligenceEngine({
        researchRunId: runId,
        triggerKind: "new_evidence",
        runKey: `research:${input.runKey}`,
        dryRun: !publishGateOpen,
      });
      warnings.push(...intelligence.warnings.filter((warning) => !warnings.includes(warning)));
    } else if (publishGateOpen && validation.recalibrations.length) {
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

    const updatesPublished = legacyUpdatesPublished + (intelligence?.storiesPublished || 0);
    await rest(`research_runs?id=eq.${encodeURIComponent(runId)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        completed_at: new Date().toISOString(),
        status: runStatus,
        updates_published: updatesPublished,
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
      status: runStatus,
      publishGate: publishGateOpen ? "open" : "blocked",
      updatesPublished,
      legacyUpdatesPublished,
      intelligence,
      calendarCandidates: calendarItems.length,
      warnings,
      accuracy: { status: accuracy.status, score: accuracy.score, updateGate: accuracy.updateGate },
    }, runStatus === "completed" ? 200 : 202);
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
