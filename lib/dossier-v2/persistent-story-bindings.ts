import type { SupabaseClient } from "@supabase/supabase-js";

import type { PersistentStoryBinding } from "./input-packet.ts";

export const GOVERNED_DOSSIER_PERSISTENT_STORY_ALIASES = [
  {
    analytical_story_id: "story:rates-duration-stress",
    persistent_story_slug: "fed-long-end-stress",
  },
  {
    analytical_story_id: "story:duration-stress-real-led",
    persistent_story_slug: "fed-long-end-stress",
  },
  {
    analytical_story_id: "story-duration-broadening",
    persistent_story_slug: "fed-long-end-stress",
  },
  {
    analytical_story_id: "story:energy-product-stress",
    persistent_story_slug: "iran-oil-inflation-rates",
  },
  {
    analytical_story_id: "story:ai-leadership-counterweight",
    persistent_story_slug: "market-breadth-health",
  },
  {
    analytical_story_id: "story:incomplete-transmission-ai-counterweight",
    persistent_story_slug: "market-breadth-health",
  },
  {
    analytical_story_id: "story:tech-narrow-relief",
    persistent_story_slug: "market-breadth-health",
  },
  {
    analytical_story_id: "story:tech-narrow-riskon",
    persistent_story_slug: "market-breadth-health",
  },
] as const;

type GovernedPersistentStoryRow = {
  id: string;
  slug: string;
  status: string | null;
};

export function resolveGovernedPersistentStoryBindings(
  rows: GovernedPersistentStoryRow[],
): PersistentStoryBinding[] {
  const rowsBySlug = new Map<string, GovernedPersistentStoryRow[]>();

  for (const row of rows) {
    const slug = row.slug.trim();
    if (!slug) continue;
    const grouped = rowsBySlug.get(slug) ?? [];
    grouped.push(row);
    rowsBySlug.set(slug, grouped);
  }

  return GOVERNED_DOSSIER_PERSISTENT_STORY_ALIASES.flatMap((alias) => {
    const matches = rowsBySlug.get(alias.persistent_story_slug) ?? [];
    if (matches.length !== 1) return [];

    const story = matches[0];
    if (story.status === "discarded") return [];

    return [{
      analytical_story_id: alias.analytical_story_id,
      persistent_story_id: story.id,
    }];
  }).sort((left, right) =>
    left.analytical_story_id.localeCompare(right.analytical_story_id));
}

export async function loadGovernedPersistentStoryBindings(
  client: SupabaseClient,
): Promise<PersistentStoryBinding[]> {
  const slugs = [...new Set(
    GOVERNED_DOSSIER_PERSISTENT_STORY_ALIASES.map(
      (alias) => alias.persistent_story_slug,
    ),
  )];

  const { data, error } = await client
    .from("stories")
    .select("id,slug,status")
    .in("slug", slugs);

  if (error) {
    throw new Error(
      `Failed to load governed Dossier persistent Story bindings: ${error.message}`,
    );
  }

  return resolveGovernedPersistentStoryBindings(
    (data ?? []) as GovernedPersistentStoryRow[],
  );
}
