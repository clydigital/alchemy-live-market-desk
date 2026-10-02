import { createHash } from "node:crypto";

import {
  GAP_RESEARCH_SOURCE_CLASSES,
  buildResearchGapPlan,
  evaluateResearchGapEvidence,
  type GapEvidenceDirection,
  type GapEvidenceDirectness,
  type GapResearchSourceClass,
  type ResearchGapEvidenceAssessment,
  type ResearchGapPlan,
  type ResearchGapVerdict,
} from "@/lib/research-gap-plan";
import {
  claimResearchGapCases,
  completeResearchGapCase,
  releaseResearchGapCase,
  startResearchGapCase,
  type ClaimedResearchGapCase,
  type ResearchGapCaseRow,
} from "@/lib/research-gap-lifecycle";
import { loadResearchGapPlanContext } from "@/lib/research-gap-context";
import { normaliseDiscoveryUrl } from "@/lib/research-discovery-providers";
import type { CompletedResearchGapResult } from "@/lib/research-gap-auto-handoff";
import { parseStructuredProviderResponse, responsesCompatibleJsonSchema } from "@/lib/intelligence/openai-core";

const API_URL = "https://api.openai.com/v1/responses";
const WEB_EXECUTOR_VERSION = "research-gap-web-executor/1" as const;
const BLOCKED_SEARCH_DOMAINS = ["reddit.com", "quora.com", "wikipedia.org", "chatgpt.com"];

export type WebEvidenceCandidate = {
  sourceUrl: string;
  sourceTitle: string;
  publishedAt: string;
  summary: string;
  sourceClass: GapResearchSourceClass;
  requirementIds: string[];
  direction: GapEvidenceDirection;
  directness: GapEvidenceDirectness;
  claim: string;
};

type WebResearchOutput = {
  evidence: WebEvidenceCandidate[];
};

export type ConsultedSource = {
  url: string;
  title: string | null;
};

export type ResearchGapWebExecutionResult = {
  contractVersion: typeof WEB_EXECUTOR_VERSION;
  status: "completed" | "blocked";
  case: ResearchGapCaseRow;
  plan: ResearchGapPlan;
  verdict: ResearchGapVerdict | null;
  rounds: number;
  evidence: ResearchGapEvidenceAssessment[];
  handoff: CompletedResearchGapResult | null;
  message: string;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function stableId(...parts: string[]) {
  return createHash("sha256")
    .update(parts.map((part) => clean(part).toLowerCase()).filter(Boolean).join("\n"))
    .digest("hex")
    .slice(0, 24);
}

function host(url: string) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

const OFFICIAL_DOMAINS = [
  "treasury.gov",
  "federalreserve.gov",
  "bls.gov",
  "bea.gov",
  "eia.gov",
  "sec.gov",
  "ecb.europa.eu",
  "bankofengland.co.uk",
  "boj.or.jp",
  "bis.org",
  "imf.org",
  "worldbank.org",
];

const MARKET_DATA_DOMAINS = [
  "cmegroup.com",
  "theice.com",
  "ice.com",
  "cboe.com",
  "finra.org",
  "fred.stlouisfed.org",
];

function matchesDomain(hostname: string, domain: string) {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

function admittedSourceClass(url: string, suggested: GapResearchSourceClass): GapResearchSourceClass {
  const hostname = host(url);
  if (matchesDomain(hostname, "sec.gov")) return "filing";
  if (OFFICIAL_DOMAINS.some((domain) => matchesDomain(hostname, domain)) || hostname.endsWith(".gov")) return "official";
  if (MARKET_DATA_DOMAINS.some((domain) => matchesDomain(hostname, domain))) return "market_data";
  if (["youtube.com", "youtu.be"].some((domain) => matchesDomain(hostname, domain))) return "creator";
  if (suggested === "company") return "company";
  return "reporting";
}

function qualityFor(sourceClass: GapResearchSourceClass, directness: GapEvidenceDirectness) {
  const base: Record<GapResearchSourceClass, number> = {
    official: 95,
    filing: 95,
    market_data: 92,
    company: 88,
    reporting: 82,
    creator: 68,
  };
  return Math.max(0, base[sourceClass] - (directness === "INDIRECT" ? 12 : 0));
}

function canonicalUrl(value: string) {
  try {
    return normaliseDiscoveryUrl(value);
  } catch {
    return null;
  }
}

export function collectConsultedSources(payload: unknown) {
  const result = new Map<string, ConsultedSource>();
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return result;
  const output = (payload as { output?: unknown }).output;
  if (!Array.isArray(output)) return result;

  const add = (urlValue: unknown, titleValue?: unknown) => {
    const url = typeof urlValue === "string" ? canonicalUrl(urlValue) : null;
    if (!url) return;
    const title = typeof titleValue === "string" && titleValue.trim() ? titleValue.trim() : null;
    const prior = result.get(url);
    result.set(url, { url, title: prior?.title || title });
  };

  for (const item of output) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    if (row.type === "web_search_call") {
      const action = row.action;
      if (action && typeof action === "object" && !Array.isArray(action)) {
        const sources = (action as Record<string, unknown>).sources;
        if (Array.isArray(sources)) {
          for (const source of sources) {
            if (!source || typeof source !== "object" || Array.isArray(source)) continue;
            const record = source as Record<string, unknown>;
            add(record.url, record.title);
          }
        }
      }
    }
    if (row.type === "message" && Array.isArray(row.content)) {
      for (const part of row.content) {
        if (!part || typeof part !== "object" || Array.isArray(part)) continue;
        const annotations = (part as Record<string, unknown>).annotations;
        if (!Array.isArray(annotations)) continue;
        for (const annotation of annotations) {
          if (!annotation || typeof annotation !== "object" || Array.isArray(annotation)) continue;
          const record = annotation as Record<string, unknown>;
          if (record.type === "url_citation") add(record.url, record.title);
        }
      }
    }
  }
  return result;
}

function webResearchSchema(plan: ResearchGapPlan, maxEvidence: number) {
  const requirementIds = plan.requirements.map((item) => item.id);
  return {
    type: "object",
    additionalProperties: false,
    required: ["evidence"],
    properties: {
      evidence: {
        type: "array",
        maxItems: Math.max(1, maxEvidence),
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "sourceUrl",
            "sourceTitle",
            "publishedAt",
            "summary",
            "sourceClass",
            "requirementIds",
            "direction",
            "directness",
            "claim",
          ],
          properties: {
            sourceUrl: { type: "string" },
            sourceTitle: { type: "string" },
            publishedAt: { type: "string" },
            summary: { type: "string" },
            sourceClass: { type: "string", enum: GAP_RESEARCH_SOURCE_CLASSES },
            requirementIds: {
              type: "array",
              minItems: 1,
              maxItems: Math.max(1, requirementIds.length),
              items: { type: "string", enum: requirementIds },
            },
            direction: {
              type: "string",
              enum: ["CONFIRMING", "CONTRADICTING", "UNRESOLVED", "NO_CHANGE", "NEUTRAL"],
            },
            directness: { type: "string", enum: ["DIRECT", "INDIRECT"] },
            claim: { type: "string" },
          },
        },
      },
    },
  };
}

function researchInstructions(plan: ResearchGapPlan, round: number, nextResearch: string[], usedUrls: string[]) {
  return [
    "You are collecting traceable market-research evidence for one bounded Research Gap.",
    "Use the web_search tool. Search the live web before returning evidence.",
    "Prioritise the plan's preferred source classes: official releases, direct market data, filings/company sources, then high-quality reporting.",
    "Do not use Reddit, Wikipedia, Quora, ChatGPT pages, SEO aggregators, or unsourced reposts.",
    "Return only sources you actually consulted through web_search in this response.",
    "sourceUrl must be the exact publisher/source page consulted, not a search-engine URL.",
    "Only return a source when its publication/update date is visible enough to provide publishedAt. Never invent a date.",
    "Map each source only to requirementIds it actually addresses.",
    "CONFIRMING means evidence supports the mechanism/prior expectation being tested; CONTRADICTING means it weakens it; NEUTRAL/NO_CHANGE means valid evidence without directional change; UNRESOLVED means the source itself is ambiguous.",
    "DIRECT means the source directly observes the requested variable or event. Use INDIRECT for interpretation/proxy evidence.",
    "sourceClass is advisory; the server will downgrade it when the domain does not support that class.",
    "Do not manufacture a directional conclusion merely to finish the task.",
    `This is bounded research round ${round} of at most ${plan.budget.maxBranches}.`,
    nextResearch.length ? `Focus especially on: ${nextResearch.join(" | ")}` : "Cover every still-relevant requirement.",
    usedUrls.length ? `Do not reuse these already-admitted URLs: ${usedUrls.join(" | ")}` : "",
  ].filter(Boolean).join("\n");
}

function researchInput(plan: ResearchGapPlan) {
  return {
    researchQuestion: plan.researchQuestion,
    priorExpectation: plan.priorExpectation,
    objective: plan.objective,
    requirements: plan.requirements,
    linkedInvestigationIds: plan.linkedInvestigationIds,
    linkedStoryIds: plan.linkedStoryIds,
    stopPolicy: plan.stopPolicy,
  };
}

async function callWebResearch(input: {
  plan: ResearchGapPlan;
  round: number;
  nextResearch: string[];
  usedUrls: string[];
  remainingSources: number;
  fetchImpl?: typeof fetch;
  env?: NodeJS.ProcessEnv;
}) {
  const env = input.env ?? process.env;
  const apiKey = env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");
  const model = env.OPENAI_RESEARCH_GAP_MODEL?.trim()
    || env.OPENAI_INTELLIGENCE_MODEL?.trim()
    || env.OPENAI_INTELLIGENCE_FAST_MODEL?.trim()
    || "gpt-5-mini";
  const fetchImpl = input.fetchImpl ?? fetch;
  const schema = webResearchSchema(input.plan, input.remainingSources);

  const response = await fetchImpl(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      reasoning: { effort: "medium" },
      tools: [{
        type: "web_search",
        search_context_size: "high",
        filters: { blocked_domains: BLOCKED_SEARCH_DOMAINS },
      }],
      tool_choice: "required",
      include: ["web_search_call.action.sources"],
      instructions: researchInstructions(input.plan, input.round, input.nextResearch, input.usedUrls),
      input: JSON.stringify(researchInput(input.plan)),
      text: {
        format: {
          type: "json_schema",
          name: "research_gap_web_evidence",
          strict: true,
          schema: responsesCompatibleJsonSchema(schema),
        },
      },
      max_output_tokens: 5_000,
      store: false,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(240_000),
  });

  const responseText = await response.text();
  const parsed = parseStructuredProviderResponse<WebResearchOutput>({
    status: response.status,
    ok: response.ok,
    requestId: response.headers.get("x-request-id"),
    responseText,
    fallbackModel: model,
    maxOutputTokens: 5_000,
  });
  const rawPayload = JSON.parse(responseText) as unknown;
  return {
    output: parsed.data,
    consulted: collectConsultedSources(rawPayload),
    model: parsed.model,
    inputTokens: parsed.inputTokens,
    outputTokens: parsed.outputTokens,
  };
}

export function admitWebResearchEvidence(input: {
  plan: ResearchGapPlan;
  candidates: WebEvidenceCandidate[];
  consulted: Map<string, ConsultedSource>;
  usedUrls?: Set<string>;
  now?: Date;
  limit?: number;
}) {
  const requirementIds = new Set(input.plan.requirements.map((item) => item.id));
  const used = input.usedUrls ?? new Set<string>();
  const now = input.now ?? new Date();
  const admitted: ResearchGapEvidenceAssessment[] = [];

  for (const candidate of input.candidates) {
    if (admitted.length >= (input.limit ?? input.plan.budget.maxSources)) break;
    const url = canonicalUrl(candidate.sourceUrl);
    if (!url || used.has(url) || !input.consulted.has(url)) continue;
    const publishedAtMs = Date.parse(clean(candidate.publishedAt));
    if (!Number.isFinite(publishedAtMs) || publishedAtMs > now.getTime() + 5 * 60_000) continue;
    const mappedRequirements = [...new Set(candidate.requirementIds.map(clean).filter((id) => requirementIds.has(id)))];
    if (!mappedRequirements.length) continue;
    const claim = clean(candidate.claim);
    const summary = clean(candidate.summary);
    const sourceTitle = clean(input.consulted.get(url)?.title) || clean(candidate.sourceTitle);
    if (!claim || !summary || !sourceTitle) continue;
    const sourceClass = admittedSourceClass(url, candidate.sourceClass);
    const publisher = host(url);
    if (!publisher) continue;
    const directness = candidate.directness;
    const direction = candidate.direction;
    const quality = qualityFor(sourceClass, directness);

    admitted.push({
      evidenceId: `web:${stableId(url, claim)}`,
      independenceKey: publisher,
      sourceClass,
      sourceUrl: url,
      sourceTitle,
      publisher,
      publishedAt: new Date(publishedAtMs).toISOString(),
      summary,
      requirementIds: mappedRequirements,
      direction,
      directness,
      quality,
      traceable: true,
      claim,
    });
    used.add(url);
  }

  return admitted;
}

function handoffEvidence(item: ResearchGapEvidenceAssessment) {
  if (!item.sourceTitle || !item.publisher || !item.publishedAt) {
    throw new Error(`Research Gap evidence ${item.evidenceId} is missing durable handoff provenance.`);
  }
  return {
    sourceId: item.evidenceId,
    itemType: "news" as const,
    publisher: item.publisher,
    title: item.sourceTitle,
    url: item.sourceUrl,
    publishedAt: item.publishedAt,
    claim: item.claim,
    ...(item.summary ? { summary: item.summary } : {}),
    sourceQuality: item.quality,
    relevance: item.directness === "DIRECT" ? 90 : 75,
    novelty: ["CONFIRMING", "CONTRADICTING"].includes(item.direction) ? 75 : 60,
    materiality: item.directness === "DIRECT" ? 85 : 70,
  };
}

export function buildCompletedResearchGapHandoff(input: {
  gap: ResearchGapCaseRow;
  plan: ResearchGapPlan;
  verdict: ResearchGapVerdict;
}): CompletedResearchGapResult {
  if (!input.verdict.shouldStop) throw new Error("Cannot hand off a Research Gap verdict that has not reached a stop condition.");
  if (!input.verdict.evidenceSnapshot.length) throw new Error("Cannot hand off a Research Gap without traceable evidence.");
  return {
    caseId: input.gap.id,
    gateRunId: `gap-web:${input.gap.id}:${input.plan.planId}`,
    gapId: input.gap.gap_key,
    ...(input.plan.linkedInvestigationIds[0] ? { investigationId: input.plan.linkedInvestigationIds[0] } : {}),
    researchQuestion: input.plan.researchQuestion,
    ...(input.plan.priorExpectation ? { priorExpectation: input.plan.priorExpectation } : {}),
    finding: `${input.verdict.outcome}: ${input.verdict.rationale.join(" ")}`,
    confidence: input.verdict.confidence,
    outcome: input.verdict.outcome,
    ...(input.verdict.nextResearch.length ? { remainsUnknown: input.verdict.nextResearch } : {}),
    ...(input.verdict.nextResearch[0] ? { nextTest: input.verdict.nextResearch[0] } : {}),
    completedAt: input.verdict.evaluatedAt,
    evidence: input.verdict.evidenceSnapshot.map(handoffEvidence),
  };
}

export async function executeOneResearchGapWebCase(input: {
  workerId?: string;
  fetchImpl?: typeof fetch;
  env?: NodeJS.ProcessEnv;
}): Promise<ResearchGapWebExecutionResult> {
  const workerId = clean(input.workerId) || `manual-gap-web-${Date.now()}`;
  const claimed = await claimResearchGapCases({ workerId, batchSize: 1, leaseSeconds: 1800 });
  const gap = claimed[0] as ClaimedResearchGapCase | undefined;
  if (!gap) throw new Error("No QUEUED Research Gap case is available to claim.");

  const claimToken = gap.claim_token;
  let completed = false;
  try {
    const context = await loadResearchGapPlanContext(gap);
    const plan = buildResearchGapPlan(gap, new Date(), context);
    const started = await startResearchGapCase({
      caseId: gap.id,
      claimToken,
      planVersion: plan.contractVersion,
      plan,
    });
    if (!started) throw new Error("Research Gap start lost claim ownership or the lease expired.");

    const evidence: ResearchGapEvidenceAssessment[] = [];
    const usedUrls = new Set<string>();
    let verdict: ResearchGapVerdict | null = null;
    let rounds = 0;
    let nextResearch = plan.requirements.map((item) => item.description);

    for (let round = 1; round <= plan.budget.maxBranches; round += 1) {
      rounds = round;
      const remainingSources = Math.max(1, plan.budget.maxSources - evidence.length);
      const research = await callWebResearch({
        plan,
        round,
        nextResearch,
        usedUrls: [...usedUrls],
        remainingSources,
        fetchImpl: input.fetchImpl,
        env: input.env,
      });
      const admitted = admitWebResearchEvidence({
        plan,
        candidates: research.output.evidence,
        consulted: research.consulted,
        usedUrls,
        limit: remainingSources,
      });
      evidence.push(...admitted);
      console.info(JSON.stringify({
        event: "research_gap_web_round",
        caseId: gap.id,
        planId: plan.planId,
        round,
        model: research.model,
        inputTokens: research.inputTokens,
        outputTokens: research.outputTokens,
        consultedSources: research.consulted.size,
        admittedEvidence: admitted.length,
        totalEvidence: evidence.length,
      }));

      verdict = evaluateResearchGapEvidence({ plan, evidence, branchCount: round });
      nextResearch = verdict.nextResearch;
      if (verdict.shouldStop) break;
    }

    if (!verdict || !evidence.length) {
      await releaseResearchGapCase({ caseId: gap.id, claimToken });
      return {
        contractVersion: WEB_EXECUTOR_VERSION,
        status: "blocked",
        case: started,
        plan,
        verdict,
        rounds,
        evidence,
        handoff: null,
        message: "No traceable web evidence was admitted; the case was released back to QUEUED.",
      };
    }
    if (!verdict.shouldStop) {
      await releaseResearchGapCase({ caseId: gap.id, claimToken });
      return {
        contractVersion: WEB_EXECUTOR_VERSION,
        status: "blocked",
        case: started,
        plan,
        verdict,
        rounds,
        evidence,
        handoff: null,
        message: "The bounded web executor did not reach a stop condition; the case was released back to QUEUED.",
      };
    }

    const completedCase = await completeResearchGapCase({
      caseId: gap.id,
      claimToken,
      outcome: verdict.outcome,
      verdictVersion: verdict.contractVersion,
      verdict,
      completedAt: verdict.evaluatedAt,
    });
    if (!completedCase) throw new Error("Research Gap completion lost claim ownership or the lease expired.");
    completed = true;

    return {
      contractVersion: WEB_EXECUTOR_VERSION,
      status: "completed",
      case: completedCase,
      plan,
      verdict,
      rounds,
      evidence,
      handoff: buildCompletedResearchGapHandoff({ gap: completedCase, plan, verdict }),
      message: "Research Gap web research reached a deterministic stop condition.",
    };
  } catch (error) {
    if (!completed) {
      await releaseResearchGapCase({ caseId: gap.id, claimToken }).catch(() => false);
    }
    throw error;
  }
}
