import { createSupabaseAdminClient } from "../lib/supabase/admin.ts";
import { runManualDossierV2 } from "../lib/dossier-v2/manual-run.ts";

function valueArg(name: string): string | null {
  const prefix = `--${name}=`;
  const match = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
}

function numberArg(name: string, fallback: number): number {
  const raw = valueArg(name);
  if (raw === null) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid --${name} value: "${raw}".`);
  }
  return parsed;
}

function hasFlag(name: string): boolean {
  return process.argv.slice(2).includes(`--${name}`);
}

const asOf = valueArg("as-of") ?? new Date().toISOString();
const persist = hasFlag("persist");
const includePacket = hasFlag("include-packet");
const lookbackHours = numberArg("lookback-hours", 168);
const evidenceLimit = numberArg("evidence-limit", 180);

const client = createSupabaseAdminClient();

const result = await runManualDossierV2({
  asOf,
  persist,
  lookbackHours,
  evidenceLimit,
  client,
});

const response: Record<string, unknown> = {
  task: "dossier-v2-manual-run",
  mode: result.mode,
  as_of: result.packet.as_of,
  packet_id: result.packet.packet_id,
  persistence_available: result.persistence_available,
  previous_dossier_id: result.previous_dossier_id,
  snapshot_diagnostics: result.snapshot_diagnostics,
  packet_summary: {
    observed_evidence: result.packet.observed_evidence.length,
    research_leads: result.packet.research_leads.length,
    development_clusters: result.packet.development_clusters.length,
    catalysts: result.packet.catalysts.length,
    creator_themes: result.packet.creator_themes.length,
    research_gaps: result.packet.research_gaps,
    freshness_warnings: result.packet.freshness_warnings,
    omission_diagnostics: result.packet.diagnostics,
  },
  analytical_output: result.analytical_output,
};

if (includePacket) {
  response.packet = result.packet;
}

if (result.dossier) {
  response.persisted_dossier = {
    id: result.dossier.id,
    previous_dossier_id: result.dossier.previous_dossier_id,
    as_of: result.dossier.as_of,
    created_at: result.dossier.created_at,
  };
}

process.stdout.write(`${JSON.stringify(response, null, 2)}\n`);
