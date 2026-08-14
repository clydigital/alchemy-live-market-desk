import "server-only";

import { intelligenceRest } from "./supabase.ts";
export {
  annotateRunKeySchemaDrift,
  defaultIntelligenceRunKey,
  type EngineRunRow,
  type StartIntelligenceEngineRunResult,
  startIntelligenceEngineRunWithClient,
} from "./engine-run-contract.ts";
import { startIntelligenceEngineRunWithClient } from "./engine-run-contract.ts";

export async function startIntelligenceEngineRun(input: {
  researchRunId?: string | null;
  triggerKind: string;
  runKey?: string;
  dryRun?: boolean;
}) {
  return startIntelligenceEngineRunWithClient(intelligenceRest, input);
}
