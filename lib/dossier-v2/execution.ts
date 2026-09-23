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

function mergeResearchGaps(
  packetGaps: ResearchGap[],
  analyticalOutput: ResearchBrainOutputV1,
): unknown[] {
  const merged = new Map<string, unknown>();
  let fallbackIndex = 0;

  for (const gap of [...packetGaps, ...analyticalOutput.research_gaps]) {
    const clonedGap = cloneJson(gap);
    const key = gapKey(clonedGap, fallbackIndex++);
    if (!merged.has(key)) {
      merged.set(key, clonedGap);
    }
  }

  if (
    analyticalOutput.diagnostics.degraded &&
    analyticalOutput.diagnostics.degradation_reasons.length > 0
  ) {
    const hasDegradedGap = Array.from(merged.values()).some((gap) => {
      if (!gap || typeof gap !== "object" || Array.isArray(gap)) return false;
      return (gap as { category?: unknown }).category === "RESEARCH_BRAIN_DEGRADED";
    });

    if (!hasDegradedGap) {
      for (const reason of analyticalOutput.diagnostics.degradation_reasons) {
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

  return {
    contract_version: MARKET_DOSSIER_V2_CONTRACT_VERSION,
    previous_dossier_id: packet.previous_dossier_id,
    as_of: packet.as_of,
    freshness: {
      as_of: packet.as_of,
      warnings: cloneJson(packet.freshness_warnings),
      input_diagnostics: cloneJson(packet.diagnostics),
    },
    research_gaps: mergeResearchGaps(packet.research_gaps, analyticalOutput),
    payload: {
      contract_version: analyticalOutput.contract_version,
      packet_id: packet.packet_id,
      system1_policy_outlook: cloneJson(policyOutlook),
      system1_rate_regime: cloneJson(rateRegime),
      analytical_output: cloneJson(analyticalOutput),
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
