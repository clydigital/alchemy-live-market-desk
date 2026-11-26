import type { SupabaseClient } from "@supabase/supabase-js";
import { getDeskData } from "./data.ts";
import { buildD7CrossLayerDivergence } from "./dossier-v2/cross-layer-divergence.ts";
import { getDossierV2PresentationSelection } from "./dossier-v2/presentation-reader.ts";
import { buildHybridReasoningProjection } from "./hybrid-reasoning-projection.ts";
import { getStoryRecordLayer } from "./persistence/read.ts";
import { buildRegimeProjection } from "./regimes.ts";
import { getD7StoryReviewClocks } from "./d7-story-review-clock.ts";

/** Internal worker only: callers supply their existing authorized database client. */
export async function loadCurrentD7RuntimeSnapshot(workerClient: SupabaseClient) {
  const [selection, data, recordLayer] = await Promise.all([
    getDossierV2PresentationSelection(),
    getDeskData(),
    getStoryRecordLayer(workerClient),
  ]);
  const dossier = selection.presentation;
  if (!dossier || !selection.selectedDossierId || !recordLayer.available) return null;

  const regimes = buildRegimeProjection({
    stories: data.stories,
    events: recordLayer.events,
    versions: recordLayer.thesisVersions,
    newsThreads: data.newsThreads,
    statements: data.statements,
    dossier,
  });
  const hybrid = buildHybridReasoningProjection({
    dossier,
    stories: data.stories,
    events: recordLayer.events,
    versions: recordLayer.thesisVersions,
  });
  const storyReviewClocks = await getD7StoryReviewClocks(
    (dossier.evidenceSufficiency?.stories ?? [])
      .map((item) => item.persistentStoryId)
      .filter((item): item is string => Boolean(item)),
    workerClient,
  );

  return {
    dossierId: selection.selectedDossierId,
    dossierAsOf: dossier.asOf,
    storyReviewClocks,
    snapshot: buildD7CrossLayerDivergence({
      dossier,
      hybrid,
      regimes,
      storyReviewClocks,
    }),
  };
}
