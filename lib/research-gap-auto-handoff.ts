import { createHash } from "node:crypto";

import { acceptsResearchAuthorization } from "./research-auth.ts";
import {
  gapHandoffSourceIsCarrier,
  researchGapHandoffRunKey,
  validateResearchGapHandoff,
  type ResearchGapHandoffInput,
  type ResearchGapHandoffOutcome,
} from "./research-gap-handoff.ts";
import {
  validateResearchRun,
  type IntakeItemInput,
  type ResearchRunInput,
} from "./research-update.ts";

export type AutomaticGapEvidence = {
  sourceId?: string;
  itemType?: "news" | "video";
  publisher: string;
  title: string;
  url: string;
  publishedAt: string;
  claim: string;
  summary?: string;
  transcriptText?: string;
  sourceQuality: number;
  relevance: number;
  novelty: number;
  materiality: number;
};

export type CompletedResearchGapResult = {
  gateRunId: string;
  gapId: string;
  investigationId?: string;
  pulseRefs?: string[];
  affectedStorySlugs?: string[];
  researchQuestion: string;
  priorExpectation?: string;
  finding: string;
  confidence: number;
  outcome: ResearchGapHandoffOutcome;
  remainsUnknown?: string[];
  liveImplication?: string;
  nextTest?: string;
  completedAt: string;
  evidence: AutomaticGapEvidence[];
};

export type AutomaticGapHandoffSubmission = {
  automaticHandoff: true;
  canonicalStatus: number;
  canonicalBody: unknown;
};

export class AutomaticGapHandoffError extends Error {
  readonly errors: string[];

  constructor(errors: string[]) {
    super(errors.join(" "));
    this.name = "AutomaticGapHandoffError";
    this.errors = errors;
  }
}

type AutomaticGapHandoffDependencies = {
  authorize?: (request: Request) => boolean;
  publishCanonical?: (request: Request, run: ResearchRunInput) => Promise<Response>;
};

const MAX_BODY_BYTES = 256_000;

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function validDate(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 && Number.isFinite(Date.parse(value));
}

function score(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 100;
}

function stableEvidenceKey(source: AutomaticGapEvidence) {
  // Provider/source IDs are audit metadata, not evidence identity. Two tools
  // discovering the same URL + claim must converge on one canonical intake key.
  const basis = [
    clean(source.url).toLowerCase(),
    clean(source.claim),
  ].join("\n");
  return createHash("sha256").update(basis).digest("hex").slice(0, 24);
}

function automaticHandoffAuthorization(request: Request) {
  return acceptsResearchAuthorization(
    request.headers.get("authorization"),
    [process.env.RESEARCH_UPDATE_TOKEN, process.env.CRON_SECRET],
  );
}

async function publishToCanonicalResearch(request: Request, run: ResearchRunInput) {
  const authorization = request.headers.get("authorization");
  const target = new URL("/api/research-update", request.url);

  return fetch(target, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authorization ? { Authorization: authorization } : {}),
      "x-alchemy-gap-auto-handoff": "1",
    },
    body: JSON.stringify(run),
    cache: "no-store",
  });
}

function handoffFromResult(result: CompletedResearchGapResult): ResearchGapHandoffInput {
  return {
    kind: "research_gap_gate",
    gateRunId: clean(result.gateRunId),
    gapId: clean(result.gapId),
    ...(clean(result.investigationId) ? { investigationId: clean(result.investigationId) } : {}),
    ...(Array.isArray(result.pulseRefs) ? { pulseRefs: result.pulseRefs } : {}),
    ...(Array.isArray(result.affectedStorySlugs) ? { affectedStorySlugs: result.affectedStorySlugs } : {}),
    researchQuestion: clean(result.researchQuestion),
    ...(clean(result.priorExpectation) ? { priorExpectation: clean(result.priorExpectation) } : {}),
    finding: clean(result.finding),
    confidence: result.confidence,
    outcome: result.outcome,
    ...(Array.isArray(result.remainsUnknown) ? { remainsUnknown: result.remainsUnknown } : {}),
    ...(clean(result.liveImplication) ? { liveImplication: clean(result.liveImplication) } : {}),
    ...(clean(result.nextTest) ? { nextTest: clean(result.nextTest) } : {}),
  };
}

function evidenceToIntake(source: AutomaticGapEvidence): IntakeItemInput {
  const itemType = source.itemType ?? "news";
  const claim = clean(source.claim);
  const summary = clean(source.summary) || claim;
  const publisher = clean(source.publisher);
  const title = clean(source.title);
  const url = clean(source.url);
  const publishedAt = clean(source.publishedAt);
  const transcriptText = clean(source.transcriptText);

  return {
    itemKey: `gap-source:${stableEvidenceKey(source)}`,
    itemType,
    publisher,
    ...(clean(source.sourceId) ? { externalId: clean(source.sourceId) } : {}),
    title,
    url,
    publishedAt,
    transcriptStatus: itemType === "video" ? "ready" : "not_applicable",
    ...(itemType === "video" ? { transcriptText } : {}),
    summary,
    sourceQuality: source.sourceQuality,
    relevance: source.relevance,
    novelty: source.novelty,
    materiality: source.materiality,
    // The handoff layer never forces a Story mutation. Canonical Live decides
    // what the admitted evidence does to the Story/Regime state.
    recommendedAction: "collect_evidence",
    evidence: [{
      title,
      url,
      publisher,
      publishedAt,
      claim,
    }],
    reviewReason: "Automatically admitted from a completed Research Gap investigation.",
  };
}

export function validateCompletedResearchGapResult(result: CompletedResearchGapResult): string[] {
  const errors: string[] = [];
  if (!result || typeof result !== "object") return ["A completed Research Gap result is required."];

  const handoff = handoffFromResult(result);
  errors.push(...validateResearchGapHandoff(handoff));

  if (!validDate(result.completedAt)) {
    errors.push("completedAt is required and must be a valid date.");
  }

  if (!Array.isArray(result.evidence) || result.evidence.length < 1) {
    errors.push("At least one underlying evidence source is required.");
    return errors;
  }
  if (result.evidence.length > 24) {
    errors.push("A Research Gap handoff may contain at most 24 evidence sources.");
  }

  const keys = new Set<string>();
  result.evidence.forEach((source, index) => {
    const prefix = `evidence[${index}]`;
    const publisher = clean(source.publisher);
    const title = clean(source.title);
    const url = clean(source.url);
    const claim = clean(source.claim);
    const itemType = source.itemType ?? "news";

    if (!publisher) errors.push(`${prefix}.publisher is required.`);
    if (!title) errors.push(`${prefix}.title is required.`);
    if (!claim) errors.push(`${prefix}.claim is required.`);
    if (!validDate(source.publishedAt)) errors.push(`${prefix}.publishedAt must be a valid date.`);
    try {
      if (new URL(url).protocol !== "https:") errors.push(`${prefix}.url must be HTTPS.`);
    } catch {
      errors.push(`${prefix}.url must be HTTPS.`);
    }
    if (publisher && url && gapHandoffSourceIsCarrier(publisher, url)) {
      errors.push(`${prefix} must cite an underlying source, not Research Gap, MacroPulse, Notion, or ChatGPT.`);
    }
    if (itemType !== "news" && itemType !== "video") {
      errors.push(`${prefix}.itemType must be news or video.`);
    }
    if (itemType === "video" && !clean(source.transcriptText)) {
      errors.push(`${prefix}.transcriptText is required for video evidence.`);
    }
    for (const field of ["sourceQuality", "relevance", "novelty", "materiality"] as const) {
      if (!score(source[field])) errors.push(`${prefix}.${field} must be an integer from 0 to 100.`);
    }

    const key = stableEvidenceKey(source);
    if (keys.has(key)) errors.push(`${prefix} duplicates another evidence source.`);
    keys.add(key);
  });

  return errors;
}

export function buildAutomaticResearchGapRun(result: CompletedResearchGapResult): ResearchRunInput {
  const resultErrors = validateCompletedResearchGapResult(result);
  if (resultErrors.length) throw new AutomaticGapHandoffError(resultErrors);

  const handoff = handoffFromResult(result);
  const run: ResearchRunInput = {
    runKey: researchGapHandoffRunKey(handoff),
    scheduleSlot: "manual",
    scheduledFor: new Date(result.completedAt).toISOString(),
    sourceChecks: [],
    handoff,
    items: result.evidence.map(evidenceToIntake),
    summary: `Automatic Research Gap handoff ${handoff.outcome.toLowerCase().replaceAll("_", " ")}: ${handoff.finding}`,
  };

  const validation = validateResearchRun(run);
  if (validation.errors.length) throw new AutomaticGapHandoffError(validation.errors);
  return run;
}

async function readCompletedResult(request: Request): Promise<CompletedResearchGapResult> {
  const contentLength = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    throw new AutomaticGapHandoffError([`Request body exceeds the ${MAX_BODY_BYTES}-byte handoff limit.`]);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new AutomaticGapHandoffError(["Request body must be valid JSON."]);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new AutomaticGapHandoffError(["A completed Research Gap result object is required."]);
  }
  return body as CompletedResearchGapResult;
}

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function handleAutomaticResearchGapHandoff(
  request: Request,
  dependencies: AutomaticGapHandoffDependencies = {},
): Promise<Response> {
  const authorize = dependencies.authorize ?? automaticHandoffAuthorization;
  if (!authorize(request)) return json({ error: "Unauthorized Research Gap handoff." }, 401);

  let result: CompletedResearchGapResult;
  let run: ResearchRunInput;
  try {
    result = await readCompletedResult(request);
    run = buildAutomaticResearchGapRun(result);
  } catch (error) {
    if (error instanceof AutomaticGapHandoffError) {
      return json({
        error: "Automatic Research Gap handoff validation failed.",
        errors: error.errors,
      }, 422);
    }
    return json({ error: "Automatic Research Gap handoff could not be constructed." }, 500);
  }

  let canonical: Response;
  try {
    canonical = await (dependencies.publishCanonical ?? publishToCanonicalResearch)(request, run);
  } catch (error) {
    return json({
      error: "Canonical Live research handoff failed before acknowledgement.",
      detail: error instanceof Error ? error.message.slice(0, 500) : "Unknown handoff failure.",
      runKey: run.runKey,
    }, 502);
  }

  const responseText = await canonical.text();
  let canonicalBody: unknown = null;
  try {
    canonicalBody = responseText.trim() ? JSON.parse(responseText) : null;
  } catch {
    canonicalBody = {
      error: "Canonical Live research returned a non-JSON response.",
      detail: responseText.slice(0, 500),
    };
  }

  return json({
    automaticHandoff: true,
    runKey: run.runKey,
    gapId: result.gapId,
    outcome: result.outcome,
    canonicalStatus: canonical.status,
    canonicalBody,
  } satisfies AutomaticGapHandoffSubmission & {
    runKey: string;
    gapId: string;
    outcome: ResearchGapHandoffOutcome;
  }, canonical.status);
}
