import { createHash } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  MARKET_DOSSIER_V2_CONTRACT_VERSION,
  type MarketDossierV2,
  type MarketDossierV2Input,
} from "./contracts.ts";
import type { DossierV2InputPacket, ResearchGap } from "./input-packet.ts";
import { persistMarketDossierV2 } from "./persistence.ts";
import { buildDossierPolicyOutlook } from "./policy-outlook.ts";
import { buildDossierRateRegime } from "./rate-regime.ts";
import {
  MAX_RESEARCH_NOW_ACTIONS,
  RESEARCH_BRAIN_INPUT_CONTRACT_VERSION,
  type ResearchBrainOutputV1,
} from "./research-brain-contracts.ts";
import {
  executeResearchBrain,
  type ResearchBrainOptions,
} from "./research-brain.ts";
import {
  enqueueDossierStoryRefreshAgenda,
  type DossierStoryRefreshAgendaResult,
} from "./story-refresh-agenda.ts";

export interface DossierV2ExecutionOptions {
  client?: SupabaseClient;
  researchBrainOptions?: ResearchBrainOptions;
}

export interface DossierV2ExecutionResult {
  packet_id: string;
  analytical_output: ResearchBrainOutputV1;
  dossier_input: MarketDossierV2Input;
  dossier: MarketDossierV2;
  story_refresh_agenda: DossierStoryRefreshAgendaResult;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function hashText(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex").slice(0, 16);
}

function gapKey(gap: unknown, index: number): string {
  if (gap && typeof gap === "object" && !Array.isArray(gap)) {
    const maybeGapId = (gap as { gap_id?: unknown }).gap_id;
    if (typeof maybeGapId === "string" && maybeGapId.trim()) {
      return `id:${maybeGapId}`;
    }
  }
  return `json:${index}:${JSON.stringify(gap)}`;
}

function validCanonicalBlockerRefs(
  analyticalOutput: ResearchBrainOutputV1,
): Set<string> {
  return new Set([
    "MAIN_THREAD",
    "REGIME:CURRENT",
    ...analyticalOutput.major_stories.map((story) => `STORY:${story.story_id}`),
  ]);
}

const RATES_LED_RESEARCH_BUNDLES = [
  {
    action:
      "Decompose 2Y, 10Y and 30Y moves into policy-path, real-yield, inflation-compensation and term-premium drivers; confirm any global-duration label with Bund, gilt and JGB long ends and cross-check gold, real-yield and USD behavior.",
    reason:
      "Separates the Fed path from persistent long-end pressure and tests whether the rates/USD channel is dominating safe-haven demand.",
  },
  {
    action:
      "Test rates-shock transmission through HY/IG credit, market breadth and MOVE/VIX volatility, while tracking whether narrow AI/semiconductor leadership survives.",
    reason:
      "Distinguishes rates-led tightening with incomplete transmission from classic growth-scare risk-off.",
  },
  {
    action:
      "Test the energy-inflation channel with the crude curve, backwardation, refined-product cracks, inventories, utilisation and physical flows; use only verified Trump–Xi outcomes and implementation evidence.",
    reason:
      "Determines whether energy structure is sustaining the inflation impulse without hard-coding an unverified market or political claim.",
  },
] as const;

function appendResearchDetail(current: string, detail: string): string {
  return current.toLowerCase().includes(detail.toLowerCase())
    ? current
    : `${current.trim().replace(/[.\s]+$/, "")}. ${detail}`;
}

function applyRatesLedResearchAgenda(analyticalOutput: ResearchBrainOutputV1): void {
  if (
    analyticalOutput.main_thread.regime_family !== "RATES_LED_TIGHTENING"
    && analyticalOutput.main_thread.regime_family !== "MIXED_TRANSITION"
  ) {
    return;
  }

  analyticalOutput.research_now = RATES_LED_RESEARCH_BUNDLES.map((bundle, index) => {
    const existing = analyticalOutput.research_now[index];
    return {
      rank: index + 1,
      action: bundle.action,
      reason: bundle.reason,
      expected_information_gain: existing?.expected_information_gain ?? "High",
      linked_investigations: cloneJson(existing?.linked_investigations ?? []),
      linked_stories: cloneJson(existing?.linked_stories ?? []),
      blocking_evidence: cloneJson(existing?.blocking_evidence ?? []),
    };
  });

  const durationInvestigation = analyticalOutput.investigations.find((item) =>
    /duration|yield|credit|breadth|volatility|transmission/i.test(
      `${item.investigation_id} ${item.question}`,
    )
  );
  if (durationInvestigation) {
    durationInvestigation.missing_evidence = [
      ...durationInvestigation.missing_evidence,
      "Bund, gilt and JGB long-end confirmation for any global-duration label",
      "gold versus real-yield and USD cross-check",
      "HY/IG credit, breadth and MOVE/VIX transmission confirmation",
    ].filter((item, index, items) => items.indexOf(item) === index);
    durationInvestigation.research_next = appendResearchDetail(
      durationInvestigation.research_next,
      "Confirm global duration with Bund, gilt and JGB long ends; cross-check gold versus real yields and USD; compare HY/IG, breadth and MOVE/VIX",
    );
  }

  const energyInvestigation = analyticalOutput.investigations.find((item) =>
    /energy|oil|crude|refin|distillate|inflation/i.test(
      `${item.investigation_id} ${item.question}`,
    )
  );
  if (energyInvestigation) {
    energyInvestigation.missing_evidence = [
      ...energyInvestigation.missing_evidence,
      "crude curve, backwardation and refined-product cracks",
      "verified Trump–Xi outcome and implementation evidence before any political claim",
    ].filter((item, index, items) => items.indexOf(item) === index);
    energyInvestigation.research_next = appendResearchDetail(
      energyInvestigation.research_next,
      "Check the crude curve, backwardation and refined-product cracks; verify Trump–Xi outcomes and implementation before using them as facts",
    );
  }
}

function researchNowRouteIndex(
  analyticalOutput: ResearchBrainOutputV1,
  gap: ResearchGap,
): number {
  if (analyticalOutput.research_now.length === 0) return -1;
  const subject = `${gap.category} ${gap.description}`.toLowerCase();
  const routeTerms = /energy|oil|crack|refiner|padd|inventory|summit|tariff|trade|event/
    .test(subject)
    ? /energy|oil|crack|physical|event|summit|implementation/
    : /credit|breadth|move|vix|volatility|gold|usd|transmission/.test(subject)
      ? /credit|breadth|volatility|move|vix|transmission|cross-asset/
      : /policy|yield|curve|duration|real-yield|term-premium|decomposition|global/;

  const matched = analyticalOutput.research_now.findIndex((item) =>
    routeTerms.test(`${item.action} ${item.reason}`.toLowerCase())
  );
  return matched >= 0 ? matched : analyticalOutput.research_now.length - 1;
}

function routeDemotedGap(
  analyticalOutput: ResearchBrainOutputV1,
  gap: ResearchGap,
): void {
  const description = gap.description.trim();
  if (!description) return;

  if (analyticalOutput.research_now.length < MAX_RESEARCH_NOW_ACTIONS) {
    analyticalOutput.research_now.push({
      rank: analyticalOutput.research_now.length + 1,
      action: `Investigate refinement: ${description}`,
      reason: "Useful mechanism or durability evidence that does not block the canonical conclusion.",
      expected_information_gain: "Medium",
      linked_investigations: [],
      linked_stories: [],
      blocking_evidence: [description],
    });
  } else {
    const routeIndex = researchNowRouteIndex(analyticalOutput, gap);
    if (routeIndex >= 0) {
      const target = analyticalOutput.research_now[routeIndex];
      if (!target.blocking_evidence.includes(description)) {
        target.blocking_evidence.push(description);
      }
    }
  }

  const auditEntry = `${gap.gap_id} demoted to Research Now: ${description}`;
  if (!analyticalOutput.diagnostics.omitted_or_demoted_items.includes(auditEntry)) {
    analyticalOutput.diagnostics.omitted_or_demoted_items.push(auditEntry);
  }
}

function applyAnalyticalGapPolicy(
  analyticalOutput: ResearchBrainOutputV1,
): { analyticalOutput: ResearchBrainOutputV1; topLevelGaps: ResearchGap[] } {
  const normalized = cloneJson(analyticalOutput);
  applyRatesLedResearchAgenda(normalized);
  const validRefs = validCanonicalBlockerRefs(normalized);
  const topLevelGaps: ResearchGap[] = [];

  for (const gap of normalized.research_gaps) {
    const blockingRefs = Array.isArray(gap.blocking_refs) ? gap.blocking_refs : [];
    const hasValidCanonicalRef = blockingRefs.some((ref) => validRefs.has(ref));
    const admitted = gap.severity === "MATERIAL"
      && gap.gap_class === "BLOCKER"
      && hasValidCanonicalRef;

    if (admitted) {
      topLevelGaps.push(gap);
    } else {
      routeDemotedGap(normalized, gap);
    }
  }

  normalized.research_gaps = cloneJson(topLevelGaps);
  return { analyticalOutput: normalized, topLevelGaps };
}

function mergeResearchGaps(
  packetGaps: ResearchGap[],
  analyticalGaps: ResearchGap[],
  diagnostics: ResearchBrainOutputV1["diagnostics"],
): unknown[] {
  const merged = new Map<string, unknown>();
  let fallbackIndex = 0;

  // Packet gaps represent deterministic source/health coverage and must be
  // preserved even when informational. Analytical gaps are stricter: only a
  // MATERIAL blocker belongs in the top-level Dossier health surface. Refining
  // questions belong in investigations.missing_evidence or research_now.
  for (const gap of packetGaps) {
    const clonedGap = cloneJson(gap);
    const key = gapKey(clonedGap, fallbackIndex++);
    if (!merged.has(key)) {
      merged.set(key, clonedGap);
    }
  }

  for (const gap of analyticalGaps) {
    const clonedGap = cloneJson(gap);
    const key = gapKey(clonedGap, fallbackIndex++);
    if (!merged.has(key)) {
      merged.set(key, clonedGap);
    }
  }

  if (
    diagnostics.degraded &&
    diagnostics.degradation_reasons.length > 0
  ) {
    const hasDegradedGap = Array.from(merged.values()).some((gap) => {
      if (!gap || typeof gap !== "object" || Array.isArray(gap)) return false;
      return (gap as { category?: unknown }).category === "RESEARCH_BRAIN_DEGRADED";
    });

    if (!hasDegradedGap) {
      for (const reason of diagnostics.degradation_reasons) {
        const description = String(reason).slice(0, 500);
        const syntheticGap = {
          gap_id: `gap:research_brain_degraded:${hashText(description)}`,
          category: "RESEARCH_BRAIN_DEGRADED",
          description,
          severity: "MATERIAL",
        };
        merged.set(`id:${syntheticGap.gap_id}`, syntheticGap);
      }
    }
  }

  return Array.from(merged.values());
}

export function buildMarketDossierV2InputFromResearchBrain(
  packet: DossierV2InputPacket,
  analyticalOutput: ResearchBrainOutputV1,
): MarketDossierV2Input {
  if (analyticalOutput.packet_id !== packet.packet_id) {
    throw new Error(
      `Research Brain packet_id mismatch: expected "${packet.packet_id}", got "${analyticalOutput.packet_id}".`,
    );
  }

  if (analyticalOutput.as_of !== packet.as_of) {
    throw new Error(
      `Research Brain as_of mismatch: expected "${packet.as_of}", got "${analyticalOutput.as_of}".`,
    );
  }

  const policyOutlook = buildDossierPolicyOutlook(packet);
  const rateRegime = buildDossierRateRegime(packet, policyOutlook);
  const normalized = applyAnalyticalGapPolicy(analyticalOutput);

  return {
    contract_version: MARKET_DOSSIER_V2_CONTRACT_VERSION,
    previous_dossier_id: packet.previous_dossier_id,
    as_of: packet.as_of,
    freshness: {
      as_of: packet.as_of,
      warnings: cloneJson(packet.freshness_warnings),
      input_diagnostics: cloneJson(packet.diagnostics),
    },
    research_gaps: mergeResearchGaps(
      packet.research_gaps,
      normalized.topLevelGaps,
      normalized.analyticalOutput.diagnostics,
    ),
    payload: {
      contract_version: normalized.analyticalOutput.contract_version,
      packet_id: packet.packet_id,
      system1_policy_outlook: cloneJson(policyOutlook),
      system1_rate_regime: cloneJson(rateRegime),
      analytical_output: cloneJson(normalized.analyticalOutput),
    },
  };
}

export async function executeAndPersistDossierV2(
  packet: DossierV2InputPacket,
  options: DossierV2ExecutionOptions = {},
): Promise<DossierV2ExecutionResult> {
  const analyticalOutput = await executeResearchBrain(
    {
      contract_version: RESEARCH_BRAIN_INPUT_CONTRACT_VERSION,
      as_of: packet.as_of,
      packet,
    },
    options.researchBrainOptions,
  );

  const dossierInput = buildMarketDossierV2InputFromResearchBrain(
    packet,
    analyticalOutput,
  );

  const dossier = await persistMarketDossierV2(dossierInput, options.client);
  const storyRefreshAgenda = options.client
    ? await enqueueDossierStoryRefreshAgenda({
        client: options.client,
        dossier,
        packet,
        analyticalOutput,
      })
    : {
        dossier_id: dossier.id,
        status: "empty" as const,
        candidates: 0,
        enqueued: 0,
        skipped_existing: 0,
        items: [],
      };

  return {
    packet_id: packet.packet_id,
    analytical_output: analyticalOutput,
    dossier_input: dossierInput,
    dossier,
    story_refresh_agenda: storyRefreshAgenda,
  };
}
