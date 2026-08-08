import { STORY_FALLBACK_IMAGE_1 } from "./story-fallback-image-1";
import { STORY_FALLBACK_IMAGE_2 } from "./story-fallback-image-2";
import { STORY_FALLBACK_IMAGE_3 } from "./story-fallback-image-3";
import { STORY_FALLBACK_IMAGE_4 } from "./story-fallback-image-4";

export type StoryFallbackImage = {
  key: string;
  dataUri: string;
  label: string;
};

export const STORY_FALLBACK_IMAGES: StoryFallbackImage[] = [
  { key: "market-pet-01", dataUri: STORY_FALLBACK_IMAGE_1, label: "Alchemy Markets fallback artwork" },
  { key: "market-pet-02", dataUri: STORY_FALLBACK_IMAGE_2, label: "Alchemy Markets fallback artwork" },
  { key: "market-pet-03", dataUri: STORY_FALLBACK_IMAGE_3, label: "Alchemy Markets fallback artwork" },
  { key: "market-pet-04", dataUri: STORY_FALLBACK_IMAGE_4, label: "Alchemy Markets fallback artwork" },
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
  const image = STORY_FALLBACK_IMAGES[stableHash(storyId) % STORY_FALLBACK_IMAGES.length];

  // Serve the bundled ZIP artwork as a normal same-origin image response. This
  // avoids handing multi-megabyte data URIs to client components while keeping
  // each Story's assignment deterministic and stable.
  return {
    ...image,
    dataUri: `/api/story-fallback/${image.key}`,
  };
}
