import { createHash } from "node:crypto";
import type { DossierV2InputPacket, ThesisLedger } from "./input-packet.ts";
import type {
  ContradictionDetected,
  Investigation,
  MarketLens,
  ResearchBrainInputV1,
  ResearchBrainOutputV1,
  ThesisLedgerEntryV2,
  ThesisLedgerV2,
} from "./research-brain-contracts.ts";
import {
  RESEARCH_BRAIN_CONTRACT_VERSION,
  THESIS_LEDGER_V2_CONTRACT_VERSION,
} from "./research-brain-contracts.ts";
import {
  buildResearchBrainPrompt,
  buildResearchBrainRepairPrompt,
  getResearchBrainJsonSchema,
} from "./research-brain-prompt.ts";
import {
  validateResearchBrainInput,
  validateResearchBrainOutput,
} from "./research-brain-validation.ts";
import {
  executeProviderWithRetry,
  intelligenceModel,
  OpenAIStageError,
  responsesCompatibleJsonSchema,
} from "../intelligence/openai-core.ts";

export type ModelRunner = (input: {
  stageKey: string;
  instructions: string;
  boundedInput: Record<string, unknown>;
  schema: Record<string, unknown>;
}) => Promise<{ data: unknown }>;

export interface ResearchBrainOptions {
  modelRunner?: ModelRunner;
  allowRepair?: boolean;
  requestTimeoutMs?: number;
}


type ResearchBrainReasoningEffort = "none" | "low" | "medium" | "high";

const RESEARCH_BRAIN_PRIMARY_OUTPUT_TOKENS = 26_000;
const RESEARCH_BRAIN_REPAIR_OUTPUT_TOKENS = 16_000;
const RESEARCH_BRAIN_REQUEST_TIMEOUT_MS = 240_000;
const VALID_RESEARCH_BRAIN_EFFORT = new Set<ResearchBrainReasoningEffort>(["none", "low", "medium", "high"]);

function boundedEnvInteger(
  raw: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const parsed = raw ? Number(raw) : Number.NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(minimum, Math.min(maximum, Math.floor(parsed)));
}

export function researchBrainStageRuntime(
  stageKey: string,
  requestTimeoutMs?: number,
  env: NodeJS.ProcessEnv = process.env,
) {
  const repair = stageKey === "research_brain_repair";
  const maxOutputTokens = boundedEnvInteger(
    repair
      ? env.OPENAI_RESEARCH_BRAIN_REPAIR_MAX_OUTPUT_TOKENS
      : env.OPENAI_RESEARCH_BRAIN_MAX_OUTPUT_TOKENS,
    repair ? RESEARCH_BRAIN_REPAIR_OUTPUT_TOKENS : RESEARCH_BRAIN_PRIMARY_OUTPUT_TOKENS,
    4_000,
    32_000,
  );
  const configuredEffort = (repair
    ? env.OPENAI_RESEARCH_BRAIN_REPAIR_REASONING_EFFORT
    : env.OPENAI_RESEARCH_BRAIN_REASONING_EFFORT)?.trim() as ResearchBrainReasoningEffort | undefined;
  const reasoningEffort = configuredEffort && VALID_RESEARCH_BRAIN_EFFORT.has(configuredEffort)
    ? configuredEffort
    : repair
      ? "low"
      : "medium";
  const timeoutMs = requestTimeoutMs === undefined
    ? RESEARCH_BRAIN_REQUEST_TIMEOUT_MS
    : Math.max(1_000, Math.min(RESEARCH_BRAIN_REQUEST_TIMEOUT_MS, Math.floor(requestTimeoutMs)));

  return { maxOutputTokens, reasoningEffort, timeoutMs };
}

function hashString(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex").slice(0, 16);
}

export function openAIResearchBrainEnabled(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim()) && process.env.OPENAI_INTELLIGENCE_ENABLED !== "false";
}

export function normalizeResearchBrainOutputReferences(
  output: unknown,
  system1Candidates: unknown[] = [],
): unknown {
  if (!output || typeof output !== "object" || Array.isArray(output)) return output;

  const root = output as Record<string, unknown>;
  const mainThread = root.main_thread && typeof root.main_thread === "object" && !Array.isArray(root.main_thread)
    ? root.main_thread as Record<string, unknown>
    : null;
  const mainThreadId = typeof mainThread?.thread_id === "string" ? mainThread.thread_id : null;

  const majorStoryIds = new Set<string>();
  if (Array.isArray(root.major_stories)) {
    for (const story of root.major_stories) {
      if (story && typeof story === "object" && !Array.isArray(story)) {
        const storyId = (story as Record<string, unknown>).story_id;
        if (typeof storyId === "string" && storyId) majorStoryIds.add(storyId);
      }
    }
  }

  const system1EvidencePairs = system1Candidates.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return [];
    const item = candidate as Record<string, unknown>;
    const triggerId = typeof item.trigger_evidence_id === "string" ? item.trigger_evidence_id : null;
    const marketId = typeof item.market_evidence_id === "string" ? item.market_evidence_id : null;
    return triggerId && marketId ? [{ triggerId, marketId }] : [];
  });

  let normalizedCount = 0;
  if (Array.isArray(root.investigations)) {
    for (const item of root.investigations) {
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      const investigation = item as Record<string, unknown>;
      const divergence = investigation.divergence;
      if (divergence === "UNRESOLVED" || typeof divergence !== "string") continue;
      if (!["NONE", "PARTIAL", "MATERIAL"].includes(divergence)) continue;

      const observedIds = new Set(
        Array.isArray(investigation.observed_evidence)
          ? investigation.observed_evidence.filter((id): id is string => typeof id === "string")
          : [],
      );
      const hasDeterministicMismatch = system1EvidencePairs.some(
        ({ triggerId, marketId }) => observedIds.has(triggerId) && observedIds.has(marketId),
      );
      const isSupportedMismatch = (divergence === "PARTIAL" || divergence === "MATERIAL") &&
        hasDeterministicMismatch;

      // V1 is deliberately conservative: System 1 only emits mismatches, so it
      // can support PARTIAL/MATERIAL but can never prove alignment (NONE).
      // General research questions, missing confirmation, level comparisons,
      // and model-authored NONE labels all stay unresolved.
      if (!isSupportedMismatch) {
        investigation.divergence = "UNRESOLVED";
        normalizedCount++;
      }
    }
  }

  if (Array.isArray(root.stock_radar)) {
    for (const item of root.stock_radar) {
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      const radar = item as Record<string, unknown>;
      const linkedId = typeof radar.linked_main_thread_or_story_id === "string"
        ? radar.linked_main_thread_or_story_id
        : null;
      if (!linkedId) continue;

      if (mainThreadId && linkedId === mainThreadId && radar.linkage_type !== "LINKED_MAIN_THREAD") {
        radar.linkage_type = "LINKED_MAIN_THREAD";
        normalizedCount++;
      } else if (majorStoryIds.has(linkedId) && radar.linkage_type !== "LINKED_MAJOR_STORY") {
        radar.linkage_type = "LINKED_MAJOR_STORY";
        normalizedCount++;
      }
    }
  }

  if (normalizedCount > 0) {
    console.info(JSON.stringify({
      event: "research_brain_structural_normalization",
      kind: "bounded_reference_and_divergence_normalization",
      normalizedCount,
    }));
  }

  return output;
}

async function defaultModelRunner(
  input: {
    stageKey: string;
    instructions: string;
    boundedInput: Record<string, unknown>;
    schema: Record<string, unknown>;
  },
  requestTimeoutMs?: number,
): Promise<{ data: unknown }> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey || process.env.OPENAI_INTELLIGENCE_ENABLED === "false") {
    throw new OpenAIStageError("OPENAI_API_KEY is not configured or intelligence is disabled.", {
      code: "configuration_required",
    });
  }

  const model = intelligenceModel("complex");
  const { maxOutputTokens, reasoningEffort, timeoutMs } =
    researchBrainStageRuntime(input.stageKey, requestTimeoutMs);
  const serializedInput = JSON.stringify(input.boundedInput);
  const serializedSchema = JSON.stringify(input.schema);

  console.info(JSON.stringify({
    event: "research_brain_provider_start",
    stageKey: input.stageKey,
    model,
    reasoningEffort,
    maxOutputTokens,
    timeoutMs,
    inputBytes: Buffer.byteLength(serializedInput, "utf8"),
    schemaBytes: Buffer.byteLength(serializedSchema, "utf8"),
  }));

  const body = {
    model,
    instructions: input.instructions,
    input: serializedInput,
    reasoning: { effort: reasoningEffort },
    text: {
      verbosity: "low",
      format: {
        type: "json_schema",
        name: `alchemy_${input.stageKey.slice(0, 48)}`,
        strict: true,
        schema: responsesCompatibleJsonSchema(input.schema),
      },
    },
    max_output_tokens: maxOutputTokens,
    store: false,
  };

  const fetcher = async () => {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
    const requestId = response.headers.get("x-request-id");
    const responseText = await response.text();
    const retryAfter = response.headers.get("retry-after");
    return {
      status: response.status,
      ok: response.ok,
      requestId,
      responseText,
      retryAfter,
    };
  };

  // One provider attempt per pass: primary and structural repair remain explicit stages.
  try {
    const result = await executeProviderWithRetry<unknown>({
      fetcher,
      fallbackModel: model,
      maxOutputTokens,
      maxAttempts: 1,
    });

    console.info(JSON.stringify({
      event: "research_brain_provider_success",
      stageKey: input.stageKey,
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      totalTokens: result.totalTokens,
      maxOutputTokens,
    }));

    return { data: result.data };
  } catch (error) {
    const stageError = error instanceof OpenAIStageError ? error : null;
    console.warn(JSON.stringify({
      event: "research_brain_provider_failure",
      stageKey: input.stageKey,
      model,
      code: stageError?.code ?? "unknown",
      providerStatus: stageError?.providerStatus ?? null,
      incompleteReason: stageError?.incompleteReason ?? null,
      inputTokens: stageError?.inputTokens ?? null,
      outputTokens: stageError?.outputTokens ?? null,
      totalTokens: stageError?.totalTokens ?? null,
      maxOutputTokens,
      requestId: stageError?.requestId ?? null,
      responseId: stageError?.responseId ?? null,
      message: error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500),
    }));
    throw error;
  }
}

export function produceDegradedOutput(
  packet: DossierV2InputPacket,
  errorInfo?: string | string[] | Error,
  modelRepairUsed = false,
): ResearchBrainOutputV1 {
  let reasonText = "Model pass failed or produced invalid analysis.";
  if (typeof errorInfo === "string") {
    reasonText = errorInfo;
  } else if (Array.isArray(errorInfo)) {
    reasonText = `Validation failures: ${errorInfo.join("; ")}`;
  } else if (errorInfo instanceof Error) {
    reasonText = errorInfo.message;
  }

  // Preserve prior Thesis Ledger safely if present
  const priorLedger: ThesisLedger | null =
    packet.thesis_ledger || packet.prior_analytical_state?.thesis_ledger || null;

  const degradedEntries: ThesisLedgerEntryV2[] = [];
  if (priorLedger && Array.isArray(priorLedger.entries)) {
    for (const e of priorLedger.entries) {
      if (!e || typeof e.thesis_id !== "string") continue;
      const tId = e.thesis_id;
      degradedEntries.push({
        thesis_id: tId,
        contract_version: THESIS_LEDGER_V2_CONTRACT_VERSION,
        root_thesis_id: (e as { root_thesis_id?: string }).root_thesis_id ?? tId,
        parent_thesis_id: (e as { parent_thesis_id?: string | null }).parent_thesis_id ?? null,
        successor_thesis_id: (e as { successor_thesis_id?: string | null }).successor_thesis_id ?? null,
        title: e.title ?? "Prior Thesis",
        statement: e.statement ?? "",
        state: (e.state as "confirmed" | "weakened" | "invalidated" | "unresolved" | "evolved") ?? "unresolved",
        version: e.version ?? 1,
        created_at: e.created_at ?? packet.as_of,
        updated_at: packet.as_of,
        lineage: Array.isArray(e.lineage) ? e.lineage.filter((l) => l !== tId) : [],
        state_reason: "Preserved prior thesis state during degraded execution.",
        current_evidence_refs: [],
        observed_market_reaction: null,
        next_catalyst_or_tripwire: "Re-assess on next cycle.",
        arguments: Array.isArray(e.arguments) ? e.arguments : [],
      });
    }
  }

  const thesisLedgerV2: ThesisLedgerV2 = {
    contract_version: THESIS_LEDGER_V2_CONTRACT_VERSION,
    entries: degradedEntries,
  };

  // Preserve unresolved research leads as investigations (max 2)
  const degradedInvestigations: Investigation[] = [];
  if (Array.isArray(packet.research_leads)) {
    for (let idx = 0; idx < Math.min(packet.research_leads.length, 2); idx++) {
      const lead = packet.research_leads[idx];
      if (!lead || !lead.lead_id) continue;
      degradedInvestigations.push({
        investigation_id: `inv:degraded:${lead.lead_id}`,
        question: lead.claim_or_question,
        why_it_matters: "Preserved research lead during degraded run.",
        current_explanation: "Unresolved lead carried forward.",
        expected_reaction: null,
        observed_reaction: null,
        divergence: "UNRESOLVED",
        competing_explanations: [],
        observed_evidence: [],
        missing_evidence: [lead.claim_or_question],
        research_next: "Avert fabrication and await primary model pass.",
        chart_task_links: [],
        confirmation_condition: "Corroborating primary market evidence.",
        invalidation_condition: "Contradictory primary market evidence.",
        status: "open",
        linked_story_ids: [],
        linked_thesis_ids: [],
        leads_referenced: [lead.lead_id],
      });
    }
  }

  // Preserve conflict groups directly from packet
  const conflictMap = new Map<string, string[]>();
  if (Array.isArray(packet.observed_evidence)) {
    for (const ev of packet.observed_evidence) {
      if (ev && ev.conflict_group_id && ev.evidence_id) {
        const list = conflictMap.get(ev.conflict_group_id) ?? [];
        list.push(ev.evidence_id);
        conflictMap.set(ev.conflict_group_id, list);
      }
    }
  }

  const contradictionsDetected: ContradictionDetected[] = [];
  for (const [cgId, evIds] of conflictMap.entries()) {
    contradictionsDetected.push({
      conflict_group_id: cgId,
      summary: `Preserved conflict group ${cgId} with ${evIds.length} conflicting evidence items.`,
      conflicting_evidence_ids: Array.from(new Set(evIds)),
    });
  }

  // Preserve research gaps
  const degradedGaps = Array.isArray(packet.research_gaps) ? [...packet.research_gaps] : [];
  degradedGaps.push({
    gap_id: `gap:research_brain_degraded:${hashString(packet.as_of)}`,
    category: "RESEARCH_BRAIN_DEGRADED",
    description: `Research Brain operated in degraded mode: ${reasonText.slice(0, 300)}`,
    severity: "MATERIAL",
  });

  const defaultLenses: Record<string, MarketLens> = {};
  const lensNames = [
    "US_RATES",
    "BONDS",
    "TECH_AI",
    "OIL_WAR_INFLATION",
    "USD",
    "GOLD",
    "CREDIT",
    "BREADTH",
  ];
  for (const lName of lensNames) {
    defaultLenses[lName] = {
      lens_name: lName,
      observed_reaction: null,
      observed_reaction_evidence_refs: [],
      interpretation: "Unobserved / degraded mode.",
      contradiction_references: [],
      unresolved_signals: [],
    };
  }

  return {
    contract_version: RESEARCH_BRAIN_CONTRACT_VERSION,
    packet_id: packet.packet_id,
    as_of: packet.as_of,
    main_thread: {
      thread_id: "thread:degraded_fallback",
      headline: "Research Brain Operating in Degraded Fallback Mode",
      answer: "Primary reasoning pass was unavailable or failed validation.",
      regime_implication: "UNRESOLVED",
      regime_family: "UNRESOLVED",
      epistemic_label: "SPECULATIVE",
      evidence_references: [],
      supporting_story_ids: [],
      contradiction_references: [],
      what_would_change_mind: "Successful execution of next Research Brain reasoning pass.",
    },
    major_stories: [],
    chart_investigation_queue: {
      core: [],
      optional: [],
    },
    investigations: degradedInvestigations,
    market_verdict: {
      verdict_id: `verdict:degraded:${hashString(packet.as_of)}`,
      lenses: defaultLenses,
      cross_asset_readthrough: "Market verdict degraded due to model pass failure or invalid output.",
      epistemic_label: "SPECULATIVE",
      dominant_confirmation: "None",
      dominant_contradiction: "None",
    },
    research_now: [],
    stock_radar: [],
    developing_themes: [],
    creator_theme_expansions: [],
    thesis_ledger: thesisLedgerV2,
    contradictions_detected: contradictionsDetected,
    research_gaps: degradedGaps,
    diagnostics: {
      degraded: true,
      degradation_reasons: [reasonText],
      omitted_or_demoted_items: ["Major Stories ungenerated due to model pass degradation."],
      missing_input_categories: [],
      model_repair_used: modelRepairUsed,
      notes: ["Operating in safe degraded fallback mode."],
    },
  };
}

export async function executeResearchBrain(
  rawInput: unknown,
  options: ResearchBrainOptions = {},
): Promise<ResearchBrainOutputV1> {
  let validatedInput: ResearchBrainInputV1;
  try {
    validatedInput = validateResearchBrainInput(rawInput);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    if (rawInput && typeof rawInput === "object" && (rawInput as { packet?: DossierV2InputPacket }).packet) {
      return produceDegradedOutput((rawInput as { packet: DossierV2InputPacket }).packet, `Input validation error: ${errorMsg}`);
    }
    throw new Error(`Invalid ResearchBrainInput: ${errorMsg}`);
  }

  const { packet } = validatedInput;
  const allowRepair = options.allowRepair !== false;

  const prompt = buildResearchBrainPrompt(validatedInput);
  const jsonSchema = getResearchBrainJsonSchema();

  const system1Candidates = Array.isArray(prompt.boundedInput.system1_divergence_candidates)
    ? prompt.boundedInput.system1_divergence_candidates
    : [];
  console.info(JSON.stringify({
    event: "research_brain_system1_screen",
    packetId: packet.packet_id,
    candidateCount: system1Candidates.length,
    candidates: system1Candidates,
  }));

  const runner: ModelRunner =
    options.modelRunner ??
    ((inp) => defaultModelRunner(inp, options.requestTimeoutMs));

  // Step 3: Perform ONE primary model pass (maxAttempts = 1 enforced in defaultModelRunner)
  let firstPassData: unknown = null;
  try {
    const res = await runner({
      stageKey: "research_brain_primary",
      instructions: prompt.instructions,
      boundedInput: prompt.boundedInput,
      schema: jsonSchema,
    });
    firstPassData = res.data;
  } catch (err) {
    console.warn("Research Brain primary model pass failed:", err);
    return produceDegradedOutput(packet, err instanceof Error ? err : String(err), false);
  }

  // Step 5: Apply safe clerical normalization, then run deterministic validation.
  // This never changes analytical content or referenced IDs.
  firstPassData = normalizeResearchBrainOutputReferences(firstPassData, system1Candidates);
  const firstVal = validateResearchBrainOutput(firstPassData, packet);
  if (firstVal.isValid && firstVal.output) {
    return firstVal.output;
  }

  // Step 7: At most ONE repair retry if invalid
  if (allowRepair) {
    console.info(JSON.stringify({
      event: "research_brain_primary_validation_failed",
      packetId: packet.packet_id,
      errorCount: firstVal.errors.length,
      errors: firstVal.errors.slice(0, 12),
    }));
    console.info(`Research Brain primary output failed validation (${firstVal.errors.length} errors). Attempting single repair pass.`);
    const repairPrompt = buildResearchBrainRepairPrompt(firstPassData, firstVal.errors, packet);

    try {
      const repairRes = await runner({
        stageKey: "research_brain_repair",
        instructions: repairPrompt.instructions,
        boundedInput: repairPrompt.boundedInput,
        schema: jsonSchema,
      });

      const normalizedRepairData = normalizeResearchBrainOutputReferences(repairRes.data, system1Candidates);
      const repairVal = validateResearchBrainOutput(normalizedRepairData, packet);
      if (repairVal.isValid && repairVal.output) {
        // Flag in diagnostics that repair was used
        repairVal.output.diagnostics = {
          ...repairVal.output.diagnostics,
          model_repair_used: true,
        };
        return repairVal.output;
      }

      console.warn(JSON.stringify({
        event: "research_brain_repair_validation_failed",
        packetId: packet.packet_id,
        errorCount: repairVal.errors.length,
        errors: repairVal.errors.slice(0, 12),
      }));
      console.warn(`Research Brain repair pass failed validation (${repairVal.errors.length} errors).`);
      return produceDegradedOutput(packet, repairVal.errors, true);
    } catch (repairErr) {
      console.warn("Research Brain repair model pass threw error:", repairErr);
      return produceDegradedOutput(packet, repairErr instanceof Error ? repairErr : String(repairErr), true);
    }
  }

  return produceDegradedOutput(packet, firstVal.errors, false);
}
