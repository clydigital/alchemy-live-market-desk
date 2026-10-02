import "server-only";

import { createHash } from "node:crypto";

import {
  executeProviderWithRetry,
  extractOutputText,
  intelligenceModel,
  responsesCompatibleJsonSchema,
  type ResponsesApiPayload,
} from "./intelligence/openai-core.ts";
import {
  GAP_RESEARCH_SOURCE_CLASSES,
  validateResearchGapEvidenceAssessments,
  type ResearchGapEvidenceAssessment,
  type ResearchGapPlan,
} from "./research-gap-plan.ts";

const RESPONSES_API = "https://api.openai.com/v1/responses";
const SEARCH_TIMEOUT_MS = 75_000;
const ASSESS_TIMEOUT_MS = 90_000;
const MAX_CITED_SOURCES = 24;
const MAX_BRANCH_TEXT = 10_000;

type WebSource = {
  url: string;
  title: string | null;
};

type BranchResearch = {
  query: string;
  text: string;
  sources: WebSource[];
};

type AssessmentRow = {
  sourceClass: ResearchGapEvidenceAssessment["sourceClass"];
  sourceUrl: string;
  sourceTitle: string | null;
  publisher: string | null;
  publishedAt: string | null;
  summary: string | null;
  requirementIds: string[];
  direction: ResearchGapEvidenceAssessment["direction"];
  directness: ResearchGapEvidenceAssessment["directness"];
  quality: number;
  traceable: true;
  claim: string;
};

type AssessmentOutput = {
  evidence: AssessmentRow[];
};

export type ResearchGapWebExecutionResult = {
  evidence: ResearchGapEvidenceAssessment[];
  branchCount: number;
  sourceCount: number;
  branchQueries: string[];
  model: string;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function stableId(parts: string[]) {
  return createHash("sha256")
    .update(parts.map((value) => clean(value).toLowerCase()).filter(Boolean).join("\n"))
    .digest("hex")
    .slice(0, 24);
}

function httpsUrl(value: unknown) {
  const text = clean(value);
  try {
    const url = new URL(text);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function hostKey(url: string) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return url.toLowerCase();
  }
}

function collectSources(value: unknown, sources = new Map<string, WebSource>()) {
  if (Array.isArray(value)) {
    for (const item of value) collectSources(item, sources);
    return sources;
  }
  if (!value || typeof value !== "object") return sources;

  const record = value as Record<string, unknown>;
  const url = httpsUrl(record.url);
  if (url && !sources.has(url)) {
    const title = clean(record.title) || clean(record.name) || null;
    sources.set(url, { url, title });
  }
  for (const child of Object.values(record)) collectSources(child, sources);
  return sources;
}

export function researchGapSearchBranches(plan: ResearchGapPlan) {
  const requirementText = plan.requirements.map((item) => item.description).join(" | ");
  const preferredClasses = [...new Set(
    plan.requirements.flatMap((item) => item.preferredSourceClasses),
  )].join(", ");
  const candidates = [
    [
      plan.researchQuestion,
      "Find the strongest direct primary/authoritative evidence.",
      requirementText,
      `Preferred source classes: ${preferredClasses}.`,
    ].join("\n"),
    [
      plan.researchQuestion,
      "Find independent market-data or high-quality reporting corroboration for the required evidence.",
      requirementText,
      "Prefer evidence independent from the first-party source and quantify current conditions where possible.",
    ].join("\n"),
    [
      plan.researchQuestion,
      "Actively search for contradictory, neutral, or no-change evidence and alternative explanations.",
      requirementText,
      "Do not force the thesis; identify evidence that would weaken or invalidate a directional conclusion.",
    ].join("\n"),
  ];

  return candidates.slice(0, Math.max(1, Math.min(plan.budget.maxBranches, 3)));
}

export function researchGapEvidenceSchema(plan: ResearchGapPlan, allowedUrls: string[]) {
  const requirementIds = plan.requirements.map((item) => item.id);
  return {
    type: "object",
    additionalProperties: false,
    required: ["evidence"],
    properties: {
      evidence: {
        type: "array",
        minItems: 1,
        maxItems: plan.budget.maxSources,
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "sourceClass",
            "sourceUrl",
            "sourceTitle",
            "publisher",
            "publishedAt",
            "summary",
            "requirementIds",
            "direction",
            "directness",
            "quality",
            "traceable",
            "claim",
          ],
          properties: {
            sourceClass: { type: "string", enum: [...GAP_RESEARCH_SOURCE_CLASSES] },
            sourceUrl: { type: "string", enum: allowedUrls },
            sourceTitle: { type: ["string", "null"] },
            publisher: { type: ["string", "null"] },
            publishedAt: { type: ["string", "null"] },
            summary: { type: ["string", "null"] },
            requirementIds: {
              type: "array",
              minItems: 1,
              maxItems: requirementIds.length,
              items: { type: "string", enum: requirementIds },
            },
            direction: {
              type: "string",
              enum: ["CONFIRMING", "CONTRADICTING", "UNRESOLVED", "NO_CHANGE", "NEUTRAL"],
            },
            directness: { type: "string", enum: ["DIRECT", "INDIRECT"] },
            quality: { type: "integer", minimum: 0, maximum: 100 },
            traceable: { type: "boolean", enum: [true] },
            claim: { type: "string", minLength: 1 },
          },
        },
      },
    },
  };
}

async function searchBranch(input: {
  apiKey: string;
  model: string;
  plan: ResearchGapPlan;
  query: string;
  branchIndex: number;
}): Promise<BranchResearch> {
  const body = {
    model: input.model,
    instructions: [
      "You are doing one bounded research branch for a financial-market Research Gap.",
      "Use the web_search tool exactly as needed within the single allowed tool call.",
      "Prefer underlying official releases, filings, exchanges, market-data publishers, and direct reporting.",
      "Do not use ChatGPT, Notion, the Live Desk, or a Research Gap carrier page as evidence.",
      "Separate event date from publication date when material.",
      "Report what the cited sources actually support; preserve contradictions and uncertainty.",
      "Return a concise research memo with citations. Do not invent URLs.",
    ].join(" "),
    input: JSON.stringify({
      contractVersion: "research-gap-web-branch/1",
      branchIndex: input.branchIndex,
      generatedAt: input.plan.generatedAt,
      researchQuestion: input.plan.researchQuestion,
      priorExpectation: input.plan.priorExpectation,
      requirements: input.plan.requirements,
      query: input.query,
    }),
    tools: [{ type: "web_search" }],
    tool_choice: "required",
    max_tool_calls: 1,
    reasoning: { effort: "low" },
    max_output_tokens: 3_500,
    store: false,
  };

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(RESPONSES_API, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${input.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        cache: "no-store",
        signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
      });
      const requestId = response.headers.get("x-request-id");
      const raw = await response.text();
      let payload: ResponsesApiPayload & Record<string, unknown>;
      try {
        payload = raw ? JSON.parse(raw) : {};
      } catch {
        throw new Error(`Web research branch returned malformed JSON (HTTP ${response.status}).`);
      }
      if (!response.ok || payload.error) {
        const detail = payload.error && typeof payload.error === "object"
          ? clean((payload.error as { message?: unknown }).message)
          : "";
        throw new Error(detail || `Web research branch returned HTTP ${response.status}.`);
      }

      const text = extractOutputText(payload).slice(0, MAX_BRANCH_TEXT);
      const sources = [...collectSources(payload).values()].slice(0, MAX_CITED_SOURCES);
      if (!text) throw new Error("Web research branch returned no research text.");
      if (!sources.length) {
        throw new Error(`Web research branch returned no traceable HTTPS sources (request ${requestId ?? "unknown"}).`);
      }
      return { query: input.query, text, sources };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 750));
    }
  }
  throw lastError || new Error("Web research branch failed.");
}

function normalizeAssessmentRows(
  plan: ResearchGapPlan,
  rows: AssessmentRow[],
  allowedUrls: Set<string>,
): ResearchGapEvidenceAssessment[] {
  const output = rows.map((row) => {
    const sourceUrl = httpsUrl(row.sourceUrl);
    if (!sourceUrl || !allowedUrls.has(sourceUrl)) {
      throw new Error("Research Gap assessment referenced a URL that was not cited by the web research branches.");
    }
    const claim = clean(row.claim);
    const sourceTitle = clean(row.sourceTitle);
    const publisher = clean(row.publisher);
    const publishedAt = clean(row.publishedAt);
    const summary = clean(row.summary);
    const requirementIds = [...new Set(row.requirementIds.map(clean).filter(Boolean))];

    return {
      evidenceId: `gap-web:${stableId([sourceUrl, claim])}`,
      independenceKey: hostKey(sourceUrl),
      sourceClass: row.sourceClass,
      sourceUrl,
      ...(sourceTitle ? { sourceTitle } : {}),
      ...(publisher ? { publisher } : {}),
      ...(publishedAt && Number.isFinite(Date.parse(publishedAt))
        ? { publishedAt: new Date(publishedAt).toISOString() }
        : {}),
      ...(summary ? { summary } : {}),
      requirementIds,
      direction: row.direction,
      directness: row.directness,
      quality: Math.round(row.quality),
      traceable: row.traceable === true,
      claim,
    } satisfies ResearchGapEvidenceAssessment;
  });

  const errors = validateResearchGapEvidenceAssessments(plan, output);
  if (errors.length) throw new Error(`Research Gap web assessment failed validation: ${errors.join(" ")}`);
  return output;
}

async function assessResearch(input: {
  apiKey: string;
  model: string;
  plan: ResearchGapPlan;
  branches: BranchResearch[];
}): Promise<ResearchGapEvidenceAssessment[]> {
  const sourceMap = new Map<string, WebSource>();
  for (const branch of input.branches) {
    for (const source of branch.sources) {
      if (!sourceMap.has(source.url)) sourceMap.set(source.url, source);
    }
  }
  const allowedSources = [...sourceMap.values()].slice(0, MAX_CITED_SOURCES);
  if (!allowedSources.length) throw new Error("Research Gap web research produced no traceable source set.");

  const schema = researchGapEvidenceSchema(input.plan, allowedSources.map((item) => item.url));
  const maxOutputTokens = 6_000;
  const body = {
    model: input.model,
    instructions: [
      "Assess a bounded financial-market Research Gap using only the supplied web-research memos and allowed cited URLs.",
      "Return evidence, not a narrative conclusion.",
      "Every row must map to at least one required requirement ID.",
      "Use DIRECT only when the cited source directly establishes the claim.",
      "Quality is source/evidence quality, not confidence in the preferred thesis.",
      "Include contradictory or neutral evidence when present.",
      "Never invent a URL, requirement ID, date, publisher, or claim.",
    ].join(" "),
    input: JSON.stringify({
      contractVersion: "research-gap-web-assessment/1",
      plan: input.plan,
      branches: input.branches.map((branch, index) => ({
        index,
        query: branch.query,
        memo: branch.text,
      })),
      allowedSources,
    }),
    reasoning: { effort: "medium" },
    text: {
      verbosity: "low",
      format: {
        type: "json_schema",
        name: "alchemy_research_gap_web_assessment",
        strict: true,
        schema: responsesCompatibleJsonSchema(schema),
      },
    },
    max_output_tokens: maxOutputTokens,
    store: false,
  };

  const fetcher = async () => {
    const response = await fetch(RESPONSES_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(ASSESS_TIMEOUT_MS),
    });
    return {
      status: response.status,
      ok: response.ok,
      requestId: response.headers.get("x-request-id"),
      responseText: await response.text(),
      retryAfter: response.headers.get("retry-after"),
    };
  };

  const result = await executeProviderWithRetry<AssessmentOutput>({
    fetcher,
    fallbackModel: input.model,
    maxOutputTokens,
    maxAttempts: 2,
    sleepFn: async () => {
      await new Promise((resolve) => setTimeout(resolve, 750));
    },
  });

  return normalizeAssessmentRows(
    input.plan,
    result.data.evidence,
    new Set(allowedSources.map((item) => item.url)),
  );
}

export async function executeResearchGapWebPlan(
  plan: ResearchGapPlan,
): Promise<ResearchGapWebExecutionResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");
  const model = process.env.OPENAI_RESEARCH_GAP_MODEL?.trim() || intelligenceModel("complex");
  const branchQueries = researchGapSearchBranches(plan);

  const branches: BranchResearch[] = [];
  for (let index = 0; index < branchQueries.length; index += 1) {
    branches.push(await searchBranch({
      apiKey,
      model,
      plan,
      query: branchQueries[index]!,
      branchIndex: index,
    }));
  }

  const evidence = await assessResearch({ apiKey, model, plan, branches });
  const sourceCount = new Set(branches.flatMap((branch) => branch.sources.map((source) => source.url))).size;

  return {
    evidence,
    branchCount: branches.length,
    sourceCount,
    branchQueries,
    model,
  };
}
