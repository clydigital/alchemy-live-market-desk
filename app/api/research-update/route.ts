import { timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { runAccuracyCheck } from "@/lib/accuracy";
import { getDeskData } from "@/lib/data";
import { getMarketData } from "@/lib/market";
import {
  DESK_RESEARCH_SOURCES,
  RESEARCH_SLOTS,
  RESEARCH_TIME_ZONE,
  VIDEO_RESEARCH_SOURCES,
  isDeskPublicationSlot,
  referencedEvidenceItemKeys,
  researchScheduleHealth,
  validateResearchRun,
  type ClaimCheckInput,
  type EvidenceItemRecord,
  type EvidenceLinkInput,
  type ResearchRunInput,
} from "@/lib/research-update";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const updateToken = process.env.RESEARCH_UPDATE_TOKEN;

type PersistedItemRow = {
  run_id: string;
  run_status?: EvidenceItemRecord["runStatus"];
  item_key: string;
  item_type: EvidenceItemRecord["itemType"];
  status: EvidenceItemRecord["intakeStatus"];
  transcript_status: EvidenceItemRecord["transcriptStatus"];
  video_review_status: EvidenceItemRecord["videoReviewStatus"];
  claim_checks: ClaimCheckInput[] | null;
  evidence_links: EvidenceLinkInput[] | null;
};

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

function sourceCount(input: ResearchRunInput, keys: readonly string[]) {
  return input.sourceChecks
    .filter((check) => keys.includes(check.source))
    .reduce((sum, check) => sum + check.itemCount, 0);
}

function intakeStatus(
  item: ReturnType<typeof validateResearchRun>["scoredItems"][number],
  publishGateOpen: boolean,
) {
  if (item.recommendedAction === "ignore") return "rejected";
  if (item.itemType === "video" && (item.transcriptStatus !== "ready" || !["reviewed", "listened"].includes(item.videoReviewStatus || ""))) return "blocked";
  if (item.recommendedAction === "recalibrate_story" && !publishGateOpen) return "blocked";
  if (item.recommendedAction === "recalibrate_story") return "published";
  return "accepted";
}

function persistedRecord(item: PersistedItemRow): EvidenceItemRecord {
  return {
    runId: item.run_id,
    runStatus: item.run_status,
    itemKey: item.item_key,
    itemType: item.item_type,
    intakeStatus: item.status,
    transcriptStatus: item.transcript_status,
    videoReviewStatus: item.video_review_status,
    claimChecks: Array.isArray(item.claim_checks) ? item.claim_checks : [],
    evidence: Array.isArray(item.evidence_links) ? item.evidence_links : [],
  };
}

async function loadPersistedItems(input: ResearchRunInput) {
  const keys = referencedEvidenceItemKeys(input);
  if (!keys.length) return [];
  const encodedKeys = keys.map((key) => encodeURIComponent(key)).join(",");
  const items = await rest<PersistedItemRow[]>(
    `research_intake_items?select=run_id,item_key,item_type,status,transcript_status,video_review_status,claim_checks,evidence_links&item_key=in.(${encodedKeys})`,
  );
  const runIds = [...new Set(items.map((item) => item.run_id))];
  if (!runIds.length) return items;
  const encodedRunIds = runIds.map((id) => encodeURIComponent(id)).join(",");
  const runs = await rest<Array<{ id: string; status: EvidenceItemRecord["runStatus"] }>>(
    `research_runs?select=id,status&id=in.(${encodedRunIds})`,
  );
  const runStatus = new Map(runs.map((run) => [run.id, run.status]));
  return items.map((item) => ({ ...item, run_status: runStatus.get(item.run_id) }));
}

async function loadExistingRunId(input: ResearchRunInput) {
  if (typeof input.runKey !== "string" || !input.runKey || input.runKey.length > 120) return null;
  const rows = await rest<Array<{ id: string }>>(
    `research_runs?select=id&run_key=eq.${encodeURIComponent(input.runKey)}&limit=1`,
  );
  return rows[0]?.id || null;
}

export async function GET() {
  const data = await getDeskData();
  return response({
    generatedAt: new Date().toISOString(),
    timezone: RESEARCH_TIME_ZONE,
    schedule: RESEARCH_SLOTS,
    policy: {
      desk1: "canonical",
      desk2: "validated_desk1_adaptation_only",
      freshnessHours: 72,
      catalystWindowDays: 7,
      comparisonDeskDays: 2,
    },
    health: researchScheduleHealth(data.researchRuns),
    runs: data.researchRuns.slice(0, 12),
    focus: data.researchFocus.slice(0, 50),
    queue: data.researchIntake.slice(0, 50),
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

  let persistedRows: PersistedItemRow[];
  let existingRunId: string | null;
  try {
    existingRunId = await loadExistingRunId(input);
    persistedRows = await loadPersistedItems(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load the evidence ledger.";
    return response({ error: message }, 503);
  }

  let validation: ReturnType<typeof validateResearchRun>;
  try {
    validation = validateResearchRun(
      input,
      persistedRows.filter((item) => item.run_id !== existingRunId).map(persistedRecord),
    );
  } catch {
    return response({ error: "Research run validation failed.", errors: ["The payload contains a malformed nested research record."] }, 422);
  }
  if (validation.errors.length) {
    return response({ error: "Research run validation failed.", errors: validation.errors, warnings: validation.warnings }, 422);
  }

  const publicationSlot = isDeskPublicationSlot(input.scheduleSlot);
  const accuracy = runAccuracyCheck(await getMarketData());
  const workflowGateOpen = validation.requiredSourcesComplete
    && validation.processGatePassed
    && validation.calendarGatePassed
    && validation.videoGatePassed
    && validation.freshnessGatePassed
    && validation.evidenceGatePassed;
  const runGateOpen = workflowGateOpen && (!publicationSlot || accuracy.updateGate === "open");
  const publishGateOpen = publicationSlot && runGateOpen;
  const warnings = [...validation.warnings];
  if (publicationSlot && accuracy.updateGate !== "open") warnings.push(`Accuracy gate is ${accuracy.updateGate}; Desk 1 publication was blocked.`);
  if (!validation.requiredSourcesComplete) warnings.push("At least one source assigned to this slot was blocked.");
  if (!validation.processGatePassed) warnings.push("At least one required research process step was not completed.");
  if (!validation.calendarGatePassed) warnings.push("The seven-day economic and earnings calendar gate was not completed.");
  if (!validation.videoGatePassed) warnings.push("At least one retained video lacks an approved transcript or independent review/listen.");
  if (!validation.freshnessGatePassed) warnings.push("A lead or top-three decision did not pass the freshness policy.");
  if (!validation.evidenceGatePassed) warnings.push("At least one proposed story recalibration did not pass the evidence gate.");

  const gates = {
    sources: validation.requiredSourcesComplete,
    process: validation.processGatePassed,
    calendars: validation.calendarGatePassed,
    video: validation.videoGatePassed,
    freshness: validation.freshnessGatePassed,
    evidence: validation.evidenceGatePassed,
    accuracy: publicationSlot ? accuracy.updateGate : "not_applicable",
    publication: publishGateOpen ? "open" : "blocked",
  };

  if (input.dryRun) {
    return response({
      accepted: true,
      dryRun: true,
      runStatus: runGateOpen ? "completed" : "blocked",
      gates,
      accuracy,
      warnings,
      storyFocus: validation.storyFocus,
      scoredItems: validation.scoredItems.map(({ transcriptText: _transcriptText, ...item }) => item),
    });
  }

  let runId: string | null = null;
  try {
    const runStatus = runGateOpen ? "completed" : "blocked";
    const jargonTermsResearched = new Set(
      validation.scoredItems.flatMap((item) => item.jargonResearch.map((entry) => entry.term.trim().toLocaleLowerCase("en"))),
    ).size;
    const expertNotesAdded = validation.scoredItems.reduce((sum, item) => sum + item.expertNotes.length, 0)
      + validation.storyFocus.reduce((sum, focus) => sum + (focus.expertNotes?.length || 0), 0);
    const storiesDemoted = validation.storyFocus.filter((focus) =>
      ["lead", "top_three"].includes(focus.proposedDecision) && ["background", "rejected"].includes(focus.decision),
    ).length;
    const runRows = await rest<Array<{ id: string }>>("research_runs?on_conflict=run_key", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({
        run_key: input.runKey,
        schedule_slot: input.scheduleSlot,
        scheduled_for: input.scheduledFor,
        started_at: new Date().toISOString(),
        completed_at: null,
        status: "running",
        accuracy_gate: publicationSlot ? accuracy.updateGate : "open",
        required_sources_complete: validation.requiredSourcesComplete,
        evidence_gate_passed: validation.evidenceGatePassed,
        freshness_gate_passed: validation.freshnessGatePassed,
        source_checks: input.sourceChecks,
        process_log: input.processLog,
        calendar_checks: input.calendarChecks || [],
        videos_found: sourceCount(input, VIDEO_RESEARCH_SOURCES),
        transcripts_ready: validation.scoredItems.filter((item) => item.itemType === "video" && item.transcriptStatus === "ready").length,
        news_scanned: sourceCount(input, DESK_RESEARCH_SOURCES.slice(0, 4)),
        candidates_kept: validation.scoredItems.filter((item) => item.recommendedAction !== "ignore").length,
        articles_scanned: Math.min(30, sourceCount(input, ["alchemy-market-insights"])),
        articles_flagged: validation.scoredItems.filter((item) => item.itemType === "alchemy_article" && item.recommendedAction === "review_article").length,
        evidence_added: new Set(validation.scoredItems.flatMap((item) => item.evidence.map((link) => link.url))).size,
        jargon_terms_researched: jargonTermsResearched,
        expert_notes_added: expertNotesAdded,
        stories_demoted: storiesDemoted,
        focus_decisions_count: validation.storyFocus.length,
        focus_changes_published: 0,
        updates_published: 0,
        warnings,
        summary: input.summary || null,
        updated_at: new Date().toISOString(),
      }),
    });
    runId = runRows[0]?.id || null;
    if (!runId) throw new Error("The research run did not return an id.");

    const existingByKey = new Map(persistedRows.map((item) => [item.item_key, item]));
    const writableItems = validation.scoredItems.filter((item) => {
      const existing = existingByKey.get(item.itemKey);
      if (!existing || existing.run_id === runId) return true;
      warnings.push(`${item.itemKey} already belongs to an earlier intake run and was referenced without reassigning ownership.`);
      return false;
    });
    if (writableItems.length) {
      await rest("research_intake_items?on_conflict=item_key", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(writableItems.map((item) => ({
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
          transcript_provider: item.itemType === "video" ? item.transcriptProvider || null : null,
          transcript_text: item.itemType === "video" ? item.transcriptText || null : null,
          video_review_status: item.itemType === "video" ? item.videoReviewStatus || "unavailable" : "unavailable",
          creator_logic: item.creatorLogic || null,
          recontextualized_summary: item.recontextualizedSummary || null,
          terms_detected: item.termsDetected || [],
          jargon_research: item.jargonResearch,
          claim_checks: item.claimChecks,
          expert_notes: item.expertNotes,
          freshness_score: item.freshnessScore,
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

    if (validation.storyFocus.length) {
      await rest("research_story_focus?on_conflict=run_id,story_slug", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(validation.storyFocus.map((focus) => ({
          run_id: runId,
          story_slug: focus.storySlug,
          headline: focus.headline,
          angle_key: focus.angleKey,
          priority: focus.priority,
          proposed_decision: focus.proposedDecision,
          decision: focus.decision,
          event_at: focus.eventAt || null,
          next_catalyst_at: focus.nextCatalystAt || null,
          material_change: focus.materialChange,
          material_change_reason: focus.materialChangeReason || null,
          freshness_status: focus.freshnessStatus,
          freshness_reason: focus.freshnessReason,
          demotion_reason: focus.demotionReason,
          evidence_item_keys: focus.evidenceItemKeys,
          expert_notes: focus.expertNotes || [],
        }))),
      });
    }

    const evidenceByKey = new Map(persistedRows.map((item) => [item.item_key, persistedRecord(item)]));
    validation.scoredItems.forEach((item) => evidenceByKey.set(item.itemKey, {
      itemKey: item.itemKey,
      itemType: item.itemType,
      transcriptStatus: item.transcriptStatus,
      videoReviewStatus: item.videoReviewStatus,
      claimChecks: item.claimChecks,
      evidence: item.evidence,
    }));

    let updatesPublished = 0;
    if (publishGateOpen && validation.recalibrations.length) {
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
        const existingUpdates = await rest<Array<{ id: string }>>(
          `story_updates?select=id&story_id=eq.${encodeURIComponent(story.id)}&observed_at=eq.${encodeURIComponent(update.observedAt)}&headline=eq.${encodeURIComponent(update.headline)}&limit=1`,
        );
        if (existingUpdates.length) {
          updatesPublished += 1;
          continue;
        }
        const evidenceCount = new Set(
          update.evidenceItemKeys.flatMap((key) => evidenceByKey.get(key)?.evidence.map((link) => link.url) || []),
        ).size;
        await rest("story_updates", {
          method: "POST",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({
            story_id: story.id,
            update_type: update.confidenceDelta > 0 ? "confirmation" : update.confidenceDelta < 0 ? "contradiction" : "status",
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
        updatesPublished += 1;
      }
    }

    await rest(`research_runs?id=eq.${encodeURIComponent(runId)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        completed_at: new Date().toISOString(),
        status: runStatus,
        updates_published: updatesPublished,
        focus_changes_published: updatesPublished,
        warnings,
        updated_at: new Date().toISOString(),
      }),
    });

    revalidatePath("/");
    revalidatePath("/api/hybrid-feed");
    revalidatePath("/api/research-update");
    return response({
      accepted: true,
      runId,
      status: runStatus,
      gates,
      updatesPublished,
      warnings,
      storyFocus: validation.storyFocus,
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
        // Preserve the original publisher error when the failure ledger is unavailable.
      }
    }
    return response({ error: message, runId }, 500);
  }
}
