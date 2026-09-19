import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseAdminClient } from "../supabase/admin.ts";
import type { MarketDossierV2 } from "./contracts.ts";
import {
  type CanonicalSnapshotResult,
  loadCanonicalCandidateSnapshot,
} from "./canonical-snapshot.ts";
import {
  assembleDossierV2InputPacket,
  THESIS_LEDGER_CONTRACT_VERSION,
  type DossierV2InputPacket,
  type DossierV2InputRequest,
  type PriorAnalyticalClaim,
  type ThesisLedger,
} from "./input-packet.ts";
import {
  executeAndPersistDossierV2,
  type DossierV2ExecutionResult,
} from "./execution.ts";
import {
  RESEARCH_BRAIN_INPUT_CONTRACT_VERSION,
  type EpistemicLabel,
  type ResearchBrainOutputV1,
} from "./research-brain-contracts.ts";
import {
  executeResearchBrain,
  type ResearchBrainOptions,
} from "./research-brain.ts";
import { validateMarketDossierV2Record } from "./validation.ts";

export interface ManualDossierV2RunOptions {
  asOf: string;
  persist?: boolean;
  lookbackHours?: number;
  evidenceLimit?: number;
  client?: SupabaseClient;
  researchBrainOptions?: ResearchBrainOptions;
  snapshotResult?: CanonicalSnapshotResult;
}

export interface ManualDossierV2RunResult {
  mode: "dry_run" | "persisted";
  persistence_available: boolean;
  previous_dossier_id: string | null;
  snapshot_diagnostics: CanonicalSnapshotResult["diagnostics"];
  packet: DossierV2InputPacket;
  analytical_output: ResearchBrainOutputV1;
  dossier?: MarketDossierV2;
}

interface PreviousDossierResolution {
  persistenceAvailable: boolean;
  dossier: MarketDossierV2 | null;
}

function isMissingDossierTableError(error: { code?: string | null; message?: string | null } | null): boolean {
  if (!error) return false;
  const code = String(error.code ?? "");
  const message = String(error.message ?? "").toLowerCase();
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    (message.includes("market_dossiers_v2") &&
      (message.includes("does not exist") || message.includes("schema cache")))
  );
}

async function resolveLatestDossier(
  client: SupabaseClient,
): Promise<PreviousDossierResolution> {
  const { data, error } = await client
    .from("market_dossiers_v2")
    .select(
      "id, contract_version, previous_dossier_id, as_of, freshness, research_gaps, payload, created_at",
    )
    .order("as_of", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isMissingDossierTableError(error)) {
      return {
        persistenceAvailable: false,
        dossier: null,
      };
    }
    throw new Error(`Failed to resolve latest MarketDossierV2: ${error.message}`);
  }

  if (!data) {
    return {
      persistenceAvailable: true,
      dossier: null,
    };
  }

  return {
    persistenceAvailable: true,
    dossier: validateMarketDossierV2Record(data),
  };
}

function validEpistemicLabel(value: unknown): EpistemicLabel {
  if (
    value === "OBSERVED" ||
    value === "SUPPORTED" ||
    value === "INFERRED" ||
    value === "SPECULATIVE"
  ) {
    return value;
  }
  return "INFERRED";
}

function buildPriorClaims(dossier: MarketDossierV2): PriorAnalyticalClaim[] {
  const payload = dossier.payload;
  const analytical =
    payload.analytical_output &&
    typeof payload.analytical_output === "object" &&
    !Array.isArray(payload.analytical_output)
      ? (payload.analytical_output as Record<string, unknown>)
      : null;

  if (!analytical) return [];

  const result: PriorAnalyticalClaim[] = [];
  const provenance = [
    {
      source_type: "MARKET_DOSSIER_V2",
      source_id: dossier.id,
    },
  ];

  const mainThread =
    analytical.main_thread &&
    typeof analytical.main_thread === "object" &&
    !Array.isArray(analytical.main_thread)
      ? (analytical.main_thread as Record<string, unknown>)
      : null;

  if (mainThread) {
    const answer = typeof mainThread.answer === "string" ? mainThread.answer.trim() : "";
    if (answer) {
      result.push({
        claim_id: `prior:${dossier.id}:main_thread`,
        epistemic_label: validEpistemicLabel(mainThread.epistemic_label),
        claim_text: answer,
        dossier_id: dossier.id,
        as_of: dossier.as_of,
        provenance,
      });
    }
  }

  const stories = Array.isArray(analytical.major_stories)
    ? analytical.major_stories
    : [];

  for (let index = 0; index < stories.length && result.length < 12; index++) {
    const story = stories[index];
    if (!story || typeof story !== "object" || Array.isArray(story)) continue;
    const value = story as Record<string, unknown>;
    const conclusion =
      typeof value.conclusion === "string" ? value.conclusion.trim() : "";
    if (!conclusion) continue;

    const storyId =
      typeof value.story_id === "string" && value.story_id.trim()
        ? value.story_id.trim()
        : String(index + 1);

    result.push({
      claim_id: `prior:${dossier.id}:story:${storyId}`,
      epistemic_label: validEpistemicLabel(value.epistemic_label),
      claim_text: conclusion,
      dossier_id: dossier.id,
      as_of: dossier.as_of,
      provenance,
    });
  }

  return result;
}

function buildPriorThesisLedger(dossier: MarketDossierV2): ThesisLedger | undefined {
  const payload = dossier.payload;
  const analytical =
    payload.analytical_output &&
    typeof payload.analytical_output === "object" &&
    !Array.isArray(payload.analytical_output)
      ? (payload.analytical_output as Record<string, unknown>)
      : null;

  if (!analytical) return undefined;

  const ledger =
    analytical.thesis_ledger &&
    typeof analytical.thesis_ledger === "object" &&
    !Array.isArray(analytical.thesis_ledger)
      ? (analytical.thesis_ledger as Record<string, unknown>)
      : null;

  const entries = Array.isArray(ledger?.entries) ? ledger.entries : [];
  if (entries.length === 0) return undefined;

  return {
    contract_version: THESIS_LEDGER_CONTRACT_VERSION,
    entries: entries.flatMap((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
      const value = entry as Record<string, unknown>;
      const thesisId =
        typeof value.thesis_id === "string" ? value.thesis_id.trim() : "";
      const title = typeof value.title === "string" ? value.title.trim() : "";
      const statement =
        typeof value.statement === "string" ? value.statement.trim() : "";
      const createdAt =
        typeof value.created_at === "string" ? value.created_at : dossier.as_of;
      const updatedAt =
        typeof value.updated_at === "string" ? value.updated_at : dossier.as_of;
      const version =
        typeof value.version === "number" && Number.isFinite(value.version)
          ? Math.max(1, Math.round(value.version))
          : 1;
      const state =
        value.state === "confirmed" ||
        value.state === "weakened" ||
        value.state === "invalidated" ||
        value.state === "unresolved" ||
        value.state === "evolved"
          ? value.state
          : "unresolved";

      if (!thesisId || !title || !statement) return [];

      return [
        {
          thesis_id: thesisId,
          contract_version: THESIS_LEDGER_CONTRACT_VERSION,
          title,
          statement,
          state,
          version,
          created_at: createdAt,
          updated_at: updatedAt,
          lineage: Array.isArray(value.lineage)
            ? value.lineage.filter((item): item is string => typeof item === "string")
            : [],
          arguments: Array.isArray(value.arguments)
            ? value.arguments.flatMap((argument) => {
                if (
                  !argument ||
                  typeof argument !== "object" ||
                  Array.isArray(argument)
                ) {
                  return [];
                }
                const arg = argument as Record<string, unknown>;
                if (
                  typeof arg.arg_id !== "string" ||
                  (arg.type !== "supporting" && arg.type !== "counter") ||
                  typeof arg.text !== "string"
                ) {
                  return [];
                }
                return [
                  {
                    arg_id: arg.arg_id,
                    type: arg.type,
                    text: arg.text,
                  },
                ];
              })
            : undefined,
        },
      ];
    }),
  };
}

function buildInputRequest(
  asOf: string,
  previousDossier: MarketDossierV2 | null,
): DossierV2InputRequest {
  if (!previousDossier) {
    return {
      as_of: asOf,
      previous_dossier_id: null,
      previous_dossier: null,
    };
  }

  return {
    as_of: asOf,
    previous_dossier_id: previousDossier.id,
    previous_dossier: {
      id: previousDossier.id,
      as_of: previousDossier.as_of,
      prior_claims: buildPriorClaims(previousDossier),
      thesis_ledger: buildPriorThesisLedger(previousDossier),
    },
  };
}

export async function runManualDossierV2(
  options: ManualDossierV2RunOptions,
): Promise<ManualDossierV2RunResult> {
  const client = options.client ?? createSupabaseAdminClient();

  const snapshotResult =
    options.snapshotResult ??
    (await loadCanonicalCandidateSnapshot(client, {
      asOf: options.asOf,
      lookbackHours: options.lookbackHours,
      limit: options.evidenceLimit,
    }));

  const previousResolution = await resolveLatestDossier(client);
  const request = buildInputRequest(options.asOf, previousResolution.dossier);
  const packet = assembleDossierV2InputPacket(request, snapshotResult.snapshot);

  if (options.persist) {
    if (!previousResolution.persistenceAvailable) {
      throw new Error(
        "Cannot persist Dossier V2: public.market_dossiers_v2 is not deployed in this environment. Run dry-run mode or apply the existing Dossier V2 migration first.",
      );
    }

    const result: DossierV2ExecutionResult = await executeAndPersistDossierV2(
      packet,
      {
        client,
        researchBrainOptions: options.researchBrainOptions,
      },
    );

    return {
      mode: "persisted",
      persistence_available: true,
      previous_dossier_id: packet.previous_dossier_id,
      snapshot_diagnostics: snapshotResult.diagnostics,
      packet,
      analytical_output: result.analytical_output,
      dossier: result.dossier,
    };
  }

  const analyticalOutput = await executeResearchBrain(
    {
      contract_version: RESEARCH_BRAIN_INPUT_CONTRACT_VERSION,
      as_of: packet.as_of,
      packet,
    },
    options.researchBrainOptions,
  );

  return {
    mode: "dry_run",
    persistence_available: previousResolution.persistenceAvailable,
    previous_dossier_id: packet.previous_dossier_id,
    snapshot_diagnostics: snapshotResult.diagnostics,
    packet,
    analytical_output: analyticalOutput,
  };
}
