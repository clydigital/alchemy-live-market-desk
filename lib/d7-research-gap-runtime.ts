import type { SupabaseClient } from "@supabase/supabase-js";

import {
  appendD7ResearchGapCandidates,
  buildD7ResearchGapCandidates,
} from "./d7-research-gap-routing.ts";
import { loadCurrentD7RuntimeSnapshot } from "./d7-runtime.ts";
import { syncResearchGapPriorityQueue } from "./research-gap-lifecycle.ts";
import { prioritiseResearchGapWork } from "./research-gap-prioritizer.ts";
import { loadLatestResearchGapWorkQueue } from "./research-gap-worker.ts";
import { createSupabaseAdminClient } from "./supabase/admin.ts";

type D7Loader = typeof loadCurrentD7RuntimeSnapshot;

export async function syncLatestPrioritisedResearchGapCasesWithD7(
  client: SupabaseClient = createSupabaseAdminClient(),
  now = new Date(),
  dependencies: { loadD7?: D7Loader } = {},
) {
  const baseQueue = await loadLatestResearchGapWorkQueue(client, now);
  if (!baseQueue) return null;

  let queue = baseQueue;
  try {
    const runtime = await (dependencies.loadD7 ?? loadCurrentD7RuntimeSnapshot)();
    if (
      runtime
      && runtime.dossierId === baseQueue.dossierId
      && runtime.dossierAsOf === baseQueue.dossierAsOf
    ) {
      queue = appendD7ResearchGapCandidates(
        baseQueue,
        buildD7ResearchGapCandidates({
          dossierId: baseQueue.dossierId,
          dossierAsOf: baseQueue.dossierAsOf,
          snapshot: runtime.snapshot,
        }),
      );
    } else if (runtime) {
      console.warn(JSON.stringify({
        event: "d7_research_gap_runtime_mismatch",
        queueDossierId: baseQueue.dossierId,
        queueDossierAsOf: baseQueue.dossierAsOf,
        d7DossierId: runtime.dossierId,
        d7DossierAsOf: runtime.dossierAsOf,
      }));
    }
  } catch (error) {
    console.warn(JSON.stringify({
      event: "d7_research_gap_runtime_unavailable",
      dossierId: baseQueue.dossierId,
      error: error instanceof Error ? error.message : String(error),
    }));
  }

  return syncResearchGapPriorityQueue(
    prioritiseResearchGapWork(queue),
    client,
    now,
  );
}
