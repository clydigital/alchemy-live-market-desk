import { getDeskData } from "./data.ts";
import { buildD7CrossLayerDivergence } from "./dossier-v2/cross-layer-divergence.ts";
import { getDossierV2PresentationSelection } from "./dossier-v2/presentation-reader.ts";
import { buildHybridReasoningProjection } from "./hybrid-reasoning-projection.ts";
import { getStoryRecordLayer } from "./persistence/read.ts";
import { buildRegimeProjection } from "./regimes.ts";
import { getD7StoryReviewClocks } from "./d7-story-review-clock.ts";

export async function loadCurrentD7RuntimeSnapshot() {
  const [selection, data, recordLayer] = await Promise.all([
    getDossierV2PresentationSelection(),
    getDeskData(),
    getStoryRecordLayer(),
  ]);
  const dossier = selection.presentation;
  if (!dossier || !selection.selectedDossierId) return null;

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
  );

  return {
    dossierId: selection.selectedDossierId,
    dossierAsOf: dossier.asOf,
    snapshot: buildD7CrossLayerDivergence({
      dossier,
      hybrid,
      regimes,
      storyReviewClocks,
    }),
  };
}
