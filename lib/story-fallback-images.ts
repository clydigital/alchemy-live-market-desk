import { STORY_FALLBACK_IMAGE_1 } from "./story-fallback-image-1";
import { STORY_FALLBACK_IMAGE_3 } from "./story-fallback-image-3";
import { STORY_FALLBACK_IMAGE_4 } from "./story-fallback-image-4";

export type StoryFallbackImage = {
  key: string;
  dataUri: string;
  label: string;
};

const MARKET_PET_01: StoryFallbackImage = { key: "market-pet-01", dataUri: STORY_FALLBACK_IMAGE_1, label: "Alchemy Markets fallback artwork" };
const MARKET_PET_03: StoryFallbackImage = { key: "market-pet-03", dataUri: STORY_FALLBACK_IMAGE_3, label: "Alchemy Markets fallback artwork" };
const MARKET_PET_04: StoryFallbackImage = { key: "market-pet-04", dataUri: STORY_FALLBACK_IMAGE_4, label: "Alchemy Markets fallback artwork" };

// market-pet-02 has been retired. Keep its old hash slot empty so Stories that
// were already mapped to 01, 03 or 04 do not get reshuffled. A Story landing on
// the retired slot walks forward to the next active image instead.
const STORY_FALLBACK_SLOTS: Array<StoryFallbackImage | null> = [
  MARKET_PET_01,
  null,
  MARKET_PET_03,
  MARKET_PET_04,
];

export const STORY_FALLBACK_IMAGES: StoryFallbackImage[] = [
  MARKET_PET_01,
  MARKET_PET_03,
  MARKET_PET_04,
];

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function getStableStoryFallbackImage(storyId: string) {
  const start = stableHash(storyId) % STORY_FALLBACK_SLOTS.length;
  let image: StoryFallbackImage | null = null;

  for (let offset = 0; offset < STORY_FALLBACK_SLOTS.length; offset += 1) {
    image = STORY_FALLBACK_SLOTS[(start + offset) % STORY_FALLBACK_SLOTS.length];
    if (image) break;
  }

  if (!image) image = MARKET_PET_01;

  return {
    ...image,
    dataUri: `/api/story-fallback/${image.key}`,
  };
}
