import { createHash } from "node:crypto";

import { verifyGitHubActionsManualLiveTrigger } from "../manual-live-trigger-auth.ts";
import { persistSensorMemory } from "../providers/sensor-memory-supabase.ts";
import { createSupabaseAdminClient } from "../supabase/admin.ts";

const MAX_SIGNALS = 6;
const MAX_BODY_BYTES = 48_000;
const METHODOLOGY_VERSION = "verified-macro-signal-v1";
const PROVIDER_KEY = "verified_macro_signal";

export type VerifiedMacroSignal = {
  key: string;
  kind: "economic_release" | "rate_expectation" | "market_reaction";
  signalContext?: string | null;
  sourceName: string;
  sourceUrl: string;
  sourceRole: "primary_data" | "wire" | "market_report";
  claim: string;
  eventAt: string;
  availableAt?: string | null;
  value: unknown;
  unit?: string | null;
  observedValue?: number | null;
  expectedValue?: number | null;
  previousValue?: number | null;
  affectedAssets?: string[];
  affectedTopics?: string[];
  confidence?: number;
};

type Dependencies = {
  authorize?: typeof verifyGitHubActionsManualLiveTrigger;
  persistSignal?: (signal: VerifiedMacroSignal, availableAt: string) => Promise<{ evidenceId: string; observationId: string }>;
  now?: () => Date;
};

function cleanText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function validIso(value: string) {
  return Boolean(value && Number.isFinite(Date.parse(value)));
}

function httpsUrl(value: string) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function boundedStringArray(value: unknown, maxItems = 12) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.flatMap((item) => {
    const text = cleanText(item, 80);
    return text ? [text] : [];
  }))].slice(0, maxItems);
}

function sourceDefaults(role: VerifiedMacroSignal["sourceRole"]) {
  if (role === "primary_data") return { sourceType: "data_provider", tier: 1, reliability: 95 };
  if (role === "wire") return { sourceType: "wire", tier: 2, reliability: 90 };
  return { sourceType: "market_report", tier: 3, reliability: 80 };
}

function sourceExternalId(signal: VerifiedMacroSignal) {
  const host = new URL(signal.sourceUrl).hostname.toLowerCase().replace(/^www\./, "");
  return `${host}|${signal.sourceName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 72)}`;
}

function signalHash(signal: VerifiedMacroSignal) {
  return createHash("sha256")
    .update(JSON.stringify({
      key: signal.key,
      sourceUrl: signal.sourceUrl,
      claim: signal.claim,
      eventAt: signal.eventAt,
      value: signal.value,
      observedValue: signal.observedValue ?? null,
      expectedValue: signal.expectedValue ?? null,
      previousValue: signal.previousValue ?? null,
    }))
    .digest("hex");
}

function validateSignal(raw: unknown): VerifiedMacroSignal {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Each signal must be an object.");
  const item = raw as Record<string, unknown>;
  const key = cleanText(item.key, 120);
  const kind = item.kind;
  const sourceName = cleanText(item.sourceName, 160);
  const sourceUrl = cleanText(item.sourceUrl, 600);
  const sourceRole = item.sourceRole;
  const claim = cleanText(item.claim, 900);
  const eventAt = cleanText(item.eventAt, 80);
  const availableAt = cleanText(item.availableAt, 80) || null;
  const signalContext = cleanText(item.signalContext, 100) || null;

  if (!/^[a-z0-9][a-z0-9:_-]{2,119}$/.test(key)) throw new Error("Signal key must be a stable lowercase identifier.");
  if (!["economic_release", "rate_expectation", "market_reaction"].includes(String(kind))) throw new Error(`Unsupported signal kind for ${key}.`);
  if (!["primary_data", "wire", "market_report"].includes(String(sourceRole))) throw new Error(`Unsupported sourceRole for ${key}.`);
  if (!sourceName || !httpsUrl(sourceUrl) || !claim || !validIso(eventAt) || (availableAt && !validIso(availableAt))) {
    throw new Error(`Signal ${key} is missing valid source, claim, or timestamps.`);
  }

  const numberOrNull = (value: unknown) => value === null || value === undefined
    ? null
    : typeof value === "number" && Number.isFinite(value) ? value : Number.NaN;
  const observedValue = numberOrNull(item.observedValue);
  const expectedValue = numberOrNull(item.expectedValue);
  const previousValue = numberOrNull(item.previousValue);
  if ([observedValue, expectedValue, previousValue].some((value) => typeof value === "number" && Number.isNaN(value))) {
    throw new Error(`Signal ${key} has invalid numeric values.`);
  }

  const confidenceRaw = item.confidence === undefined ? 90 : Number(item.confidence);
  if (!Number.isFinite(confidenceRaw) || confidenceRaw < 0 || confidenceRaw > 100) throw new Error(`Signal ${key} confidence must be 0-100.`);

  return {
    key,
    kind: kind as VerifiedMacroSignal["kind"],
    signalContext,
    sourceName,
    sourceUrl,
    sourceRole: sourceRole as VerifiedMacroSignal["sourceRole"],
    claim,
    eventAt: new Date(eventAt).toISOString(),
    availableAt: availableAt ? new Date(availableAt).toISOString() : null,
    value: item.value ?? null,
    unit: cleanText(item.unit, 80) || null,
    observedValue,
    expectedValue,
    previousValue,
    affectedAssets: boundedStringArray(item.affectedAssets),
    affectedTopics: boundedStringArray(item.affectedTopics),
    confidence: Math.round(confidenceRaw),
  };
}

export async function persistVerifiedMacroSignal(signal: VerifiedMacroSignal, availableAt: string) {
  const client = createSupabaseAdminClient();
  const source = sourceDefaults(signal.sourceRole);
  const externalSourceId = sourceExternalId(signal);

  const { data: sourceRow, error: sourceError } = await client
    .from("intelligence_evidence_sources")
    .upsert({
      provider_key: PROVIDER_KEY,
      external_source_id: externalSourceId,
      source_name: signal.sourceName,
      source_type: source.sourceType,
      source_url: signal.sourceUrl,
      source_tier: source.tier,
      reliability_score: source.reliability,
      methodology_notes: "Operator-verified macro signal captured through the audited GitHub Actions production path.",
      metadata: { verificationRole: "canonical", ingestionKind: "verified_macro_signal" },
      last_seen_at: availableAt,
      updated_at: availableAt,
    }, { onConflict: "provider_key,external_source_id" })
    .select("id")
    .single<{ id: string }>();
  if (sourceError || !sourceRow?.id) throw new Error(`Could not persist verified macro source: ${sourceError?.message || "missing source"}`);

  const memory = await persistSensorMemory({
    provider: PROVIDER_KEY,
    sourceUrl: signal.sourceUrl,
    sourceType: source.sourceType,
    contentType: "application/json",
    rawPayload: signal,
    contentText: signal.claim,
    publishedAt: signal.availableAt ?? availableAt,
    observedAt: availableAt,
    sourceId: sourceRow.id,
    ingestionKey: `verified-macro:${signal.key}:${signal.eventAt}`,
    observations: [{
      observationType: signal.kind,
      subjectType: "macro_signal",
      subjectKey: signal.key,
      observedAt: signal.eventAt,
      effectiveAt: signal.eventAt,
      value: signal.value,
      unit: signal.unit ?? null,
      confidence: signal.confidence ?? 90,
      methodologyVersion: METHODOLOGY_VERSION,
    }],
  });

  const { data: observation, error: observationError } = await client
    .from("normalised_observations")
    .select("id")
    .eq("raw_record_id", memory.rawRecordId)
    .eq("observation_type", signal.kind)
    .eq("subject_type", "macro_signal")
    .eq("subject_key", signal.key)
    .eq("observed_at", signal.eventAt)
    .eq("methodology_version", METHODOLOGY_VERSION)
    .order("created_at", { ascending: false })
    .limit(1)
    .single<{ id: string }>();
  if (observationError || !observation?.id) throw new Error(`Could not resolve verified macro observation: ${observationError?.message || "missing observation"}`);

  const hash = signalHash(signal);
  const { data: evidence, error: evidenceError } = await client
    .from("intelligence_evidence")
    .upsert({
      source_id: sourceRow.id,
      external_evidence_id: `verified-macro:${signal.key}`,
      evidence_class: "other",
      support_direction: "neutral",
      claim_text: signal.claim,
      summary: null,
      event_at: signal.eventAt,
      published_at: signal.availableAt ?? availableAt,
      available_at: availableAt,
      geography: "US",
      affected_assets: signal.affectedAssets ?? [],
      affected_topics: signal.affectedTopics ?? [],
      measurement_unit: signal.unit ?? null,
      observed_value: signal.observedValue ?? null,
      expected_value: signal.expectedValue ?? null,
      previous_value: signal.previousValue ?? null,
      confidence: signal.confidence ?? 90,
      freshness_status: "current",
      content_hash: hash,
      provenance_urls: [signal.sourceUrl],
      structured_payload: {
        evidenceNature: "verified_macro_data",
        signalKind: signal.kind,
        signalContext: signal.signalContext,
        title: signal.claim.slice(0, 180),
      },
      raw_payload: {},
      normalizer_version: METHODOLOGY_VERSION,
      normalised_observation_id: observation.id,
      updated_at: availableAt,
    }, { onConflict: "source_id,content_hash" })
    .select("id")
    .single<{ id: string }>();
  if (evidenceError || !evidence?.id) throw new Error(`Could not persist verified macro Evidence: ${evidenceError?.message || "missing evidence"}`);

  return { evidenceId: evidence.id, observationId: observation.id };
}

export async function handleVerifiedMacroSignalsWithDependencies(request: Request, dependencies: Dependencies = {}) {
  const authorization = await (dependencies.authorize ?? verifyGitHubActionsManualLiveTrigger)(request);
  if (!authorization.authorized) return Response.json({ error: "Unauthorized verified macro signal trigger." }, { status: 401 });

  const size = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(size) && size > MAX_BODY_BYTES) return Response.json({ error: "Payload too large." }, { status: 413 });

  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "JSON body required." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return Response.json({ error: "Object body required." }, { status: 400 });

  const signalsRaw = (body as Record<string, unknown>).signals;
  if (!Array.isArray(signalsRaw) || signalsRaw.length < 1 || signalsRaw.length > MAX_SIGNALS) {
    return Response.json({ error: `signals must contain 1-${MAX_SIGNALS} items.` }, { status: 400 });
  }

  try {
    const signals = signalsRaw.map(validateSignal);
    const now = dependencies.now?.() ?? new Date();
    const persist = dependencies.persistSignal ?? persistVerifiedMacroSignal;
    const results = [];
    for (const signal of signals) {
      const availableAt = signal.availableAt ?? now.toISOString();
      if (Date.parse(signal.eventAt) > now.getTime() + 5 * 60_000) throw new Error(`Signal ${signal.key} eventAt cannot be in the future.`);
      results.push({ key: signal.key, ...(await persist(signal, availableAt)) });
    }
    return Response.json({
      status: "completed",
      actor: authorization.actor,
      githubRunId: authorization.githubRunId,
      signals: results,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
    }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
}
