import { createHash } from "node:crypto";
import { verifyGitHubActionsManualLiveTrigger } from "../manual-live-trigger-auth.ts";
import { createSupabaseAdminClient } from "../supabase/admin.ts";

/** Operator-attested metrics from the actual issuer release, not market commentary. */
const ISSUERS = {
  GS: { name: "Goldman Sachs", hosts: ["goldmansachs.com"] },
  C: { name: "Citigroup", hosts: ["citigroup.com"] },
} as const;
const METRICS = {
  diluted_eps: "USD_per_share",
  net_revenue: "USD_billion",
} as const;
const MAX_RESULTS = 6;
const MAX_BODY_BYTES = 24_000;
const METHOD = "verified-issuer-result-v1";
const PROVIDER = "verified_issuer_result";

export type VerifiedIssuerResult = {
  issuer: keyof typeof ISSUERS;
  fiscalQuarter: string;
  reportDate: string;
  sourceUrl: string;
  metric: keyof typeof METRICS;
  value: number;
};
type Authorized = Awaited<ReturnType<typeof verifyGitHubActionsManualLiveTrigger>>;
type Dependencies = {
  authorize?: (request: Request) => Promise<Authorized>;
  persist?: (item: VerifiedIssuerResult, availableAt: string) => Promise<{ evidenceId: string; observationId: string }>;
  now?: () => Date;
};

function validIssuerHost(issuer: VerifiedIssuerResult["issuer"], raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && ISSUERS[issuer].hosts.some(
      (host) => url.hostname === host || url.hostname.endsWith(`.${host}`),
    );
  } catch { return false; }
}

export function validateIssuerResult(raw: unknown, now = new Date()): VerifiedIssuerResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Issuer result must be an object.");
  const item = raw as Record<string, unknown>;
  const issuer = item.issuer;
  const metric = item.metric;
  const reportDate = item.reportDate;
  const fiscalQuarter = item.fiscalQuarter;
  const sourceUrl = item.sourceUrl;
  const value = item.value;
  if (typeof issuer !== "string" || !(issuer in ISSUERS)) throw new Error("Issuer is not on the approved primary-source list.");
  if (typeof metric !== "string" || !(metric in METRICS)) throw new Error("Unsupported issuer metric.");
  if (typeof fiscalQuarter !== "string" || !/^20\d{2}Q[1-4]$/.test(fiscalQuarter)) throw new Error("Quarter must use YYYYQn.");
  if (typeof reportDate !== "string" || !/^20\d{2}-\d{2}-\d{2}$/.test(reportDate)) throw new Error("Report date must use YYYY-MM-DD.");
  const at = Date.parse(`${reportDate}T00:00:00Z`);
  if (!Number.isFinite(at) || new Date(at).toISOString().slice(0, 10) !== reportDate
      || at > now.getTime() || now.getTime() - at > 30 * 86_400_000) {
    throw new Error("Report date must be a valid, recent, non-future calendar date.");
  }
  if (typeof sourceUrl !== "string" || !validIssuerHost(issuer as VerifiedIssuerResult["issuer"], sourceUrl)) {
    throw new Error("Issuer results require a matching, HTTPS issuer-owned release URL.");
  }
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value >= 100_000) {
    throw new Error("Issuer result must contain a finite positive reported value.");
  }
  return {
    issuer: issuer as VerifiedIssuerResult["issuer"],
    metric: metric as VerifiedIssuerResult["metric"],
    reportDate, fiscalQuarter, sourceUrl, value,
  };
}

export function issuerResultIdentity(item: VerifiedIssuerResult) {
  return {
    evidenceId: `verified-issuer:${item.issuer.toLowerCase()}:${item.fiscalQuarter.toLowerCase()}:${item.metric}`,
    contentHash: createHash("sha256").update(JSON.stringify(item)).digest("hex"),
  };
}

export async function persistVerifiedIssuerResult(item: VerifiedIssuerResult, availableAt: string) {
  const client = createSupabaseAdminClient();
  const identity = issuerResultIdentity(item);
  // Replay exactly: never move the original first-seen timestamp forwards.
  // A different value/source on the same issuer-quarter-metric is a proposed
  // revision, not an idempotent ingest; it must receive separate review.
  const { data: previous, error: previousError } = await client
    .from("intelligence_evidence")
    .select("id,content_hash,normalised_observation_id")
    .eq("external_evidence_id", identity.evidenceId)
    .limit(3);
  if (previousError) throw new Error(`Issuer identity lookup failed: ${previousError.message}`);
  if ((previous?.length ?? 0) > 1) throw new Error("Conflicting duplicate canonical issuer identities.");
  if (previous?.[0]) {
    const original = previous[0];
    if (original.content_hash !== identity.contentHash || !original.normalised_observation_id) {
      throw new Error("Existing issuer metric differs or lacks a normalised observation; review required.");
    }
    return { evidenceId: original.id as string, observationId: original.normalised_observation_id as string };
  }
  const sourceName = ISSUERS[item.issuer].name;
  const sourceHost = new URL(item.sourceUrl).hostname.toLowerCase();
  const externalSourceId = `${sourceHost}|${item.issuer.toLowerCase()}-official-results`;
  const { data: sourceRow, error: sourceError } = await client
    .from("intelligence_evidence_sources")
    .upsert({
      provider_key: PROVIDER,
      external_source_id: externalSourceId,
      source_name: sourceName,
      source_type: "issuer_release",
      source_url: item.sourceUrl,
      source_tier: 1,
      reliability_score: 95,
      methodology_notes: "Operator-verified, issuer-owned quarterly results via authenticated manual workflow.",
      metadata: { verificationRole: "canonical", sourcePublishTime: "DAY_ONLY", ingestionKind: PROVIDER },
      last_seen_at: availableAt,
      updated_at: availableAt,
    }, { onConflict: "provider_key,external_source_id" })
    .select("id").single<{ id: string }>();
  if (sourceError || !sourceRow?.id) throw new Error(`Issuer source write failed: ${sourceError?.message || "no source ID"}`);

  const evidenceId = identity.evidenceId;
  const metricName = item.metric === "diluted_eps" ? "diluted earnings per share" : "net revenues";
  const claim = `${sourceName} reported ${item.fiscalQuarter} ${metricName} of ${item.value} ${METRICS[item.metric]} in its issuer release dated ${item.reportDate}.`;
  const { persistSensorMemory } = await import("../providers/sensor-memory-supabase.ts");
  const memory = await persistSensorMemory({
    provider: PROVIDER,
    sourceUrl: item.sourceUrl,
    sourceType: "issuer_release",
    contentType: "application/json",
    rawPayload: item,
    contentText: claim,
    // The issuer page establishes only a publication DAY. Do not invent
    // a market-open release hour or backdate the record's availability.
    publishedAt: availableAt,
    observedAt: availableAt,
    sourceId: null,
    ingestionKey: evidenceId,
    observations: [{
      observationType: "company_earnings",
      subjectType: "public_company",
      subjectKey: `${item.issuer}:${item.fiscalQuarter}:${item.metric}`,
      observedAt: availableAt,
      effectiveAt: `${item.reportDate}T00:00:00Z`,
      value: item.value,
      unit: METRICS[item.metric],
      confidence: 95,
      methodologyVersion: METHOD,
    }],
  });
  const { data: observation, error: observationError } = await client
    .from("normalised_observations")
    .select("id")
    .eq("raw_record_id", memory.rawRecordId)
    .eq("observation_type", "company_earnings")
    .eq("subject_type", "public_company")
    .eq("subject_key", `${item.issuer}:${item.fiscalQuarter}:${item.metric}`)
    .eq("observed_at", availableAt)
    .eq("methodology_version", METHOD)
    .order("created_at", { ascending: false })
    .limit(1).single<{ id: string }>();
  if (observationError || !observation?.id) throw new Error(`Issuer observation lookup failed: ${observationError?.message || "no observation ID"}`);

  const hash = identity.contentHash;
  const { data: evidence, error: evidenceError } = await client
    .from("intelligence_evidence")
    .upsert({
      source_id: sourceRow.id,
      external_evidence_id: evidenceId,
      evidence_class: "company_primary",
      support_direction: "neutral",
      claim_text: claim,
      summary: null,
      event_at: null,
      published_at: availableAt,
      available_at: availableAt,
      geography: "US",
      affected_assets: [item.issuer],
      affected_topics: ["bank-earnings"],
      measurement_unit: METRICS[item.metric],
      observed_value: item.value,
      expected_value: null,
      previous_value: null,
      confidence: 95,
      freshness_status: "current",
      content_hash: hash,
      provenance_urls: [item.sourceUrl],
      structured_payload: {
        evidenceNature: "verified_issuer_result",
        fiscalQuarter: item.fiscalQuarter,
        reportDate: item.reportDate,
        sourcePublishTime: "DAY_ONLY",
        issuer: item.issuer,
        metric: item.metric,
      },
      raw_payload: {},
      normalizer_version: METHOD,
      normalised_observation_id: observation.id,
      updated_at: availableAt,
    }, { onConflict: "source_id,content_hash" })
    .select("id").single<{ id: string }>();
  if (evidenceError || !evidence?.id) throw new Error(`Issuer Evidence write failed: ${evidenceError?.message || "no evidence ID"}`);
  return { evidenceId: evidence.id, observationId: observation.id };
}

export async function handleVerifiedIssuerResults(request: Request, dependencies: Dependencies = {}) {
  const auth = await (dependencies.authorize ?? verifyGitHubActionsManualLiveTrigger)(request);
  if (!auth.authorized) return Response.json({ error: "Unauthorized issuer results action." }, { status: 401 });
  const size = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(size) && size > MAX_BODY_BYTES) return Response.json({ error: "Payload too large." }, { status: 413 });
  let body: unknown;
  try { body = await request.json(); }
  catch { return Response.json({ error: "JSON body required." }, { status: 400 }); }
  const items = body && typeof body === "object" && !Array.isArray(body)
    ? (body as Record<string, unknown>).results : null;
  if (!Array.isArray(items) || items.length === 0 || items.length > MAX_RESULTS) {
    return Response.json({ error: "results requires 1-6 issuer measurements." }, { status: 400 });
  }
  const now = dependencies.now?.() ?? new Date();
  try {
    // Validate the entire batch before any write; repeated inputs in a batch
    // cannot create conflicting values for one issuer-quarter-metric identity.
    const results = items.map((item) => validateIssuerResult(item, now));
    const keys = results.map((item) => `${item.issuer}:${item.fiscalQuarter}:${item.metric}`);
    if (new Set(keys).size !== keys.length) throw new Error("Duplicate issuer-quarter-metric identity in batch.");
    const persist = dependencies.persist ?? persistVerifiedIssuerResult;
    const availableAt = now.toISOString();
    const written = [];
    for (const result of results) {
      written.push({
        issuer: result.issuer, quarter: result.fiscalQuarter, metric: result.metric,
        ...await persist(result, availableAt),
      });
    }
    return Response.json({
      status: "completed", githubRunId: auth.githubRunId,
      availableAt, results: written,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ status: "failed", error: error instanceof Error ? error.message : String(error) },
      { status: 400, headers: { "Cache-Control": "no-store" } });
  }
}
