import type { Story } from "@/lib/data";

export type ReleaseLike = {
  event: string;
  decidingQuestion: string;
  affectedAssets: string[];
};

export type ReleaseStoryLink = {
  slug: string;
  title: string;
  reason: string;
};

type Theme = {
  release: RegExp;
  terms: RegExp;
  label: string;
};

const THEMES: Theme[] = [
  {
    release: /nonfarm|payroll|employment situation|unemployment|average hourly|adp|jobless|jolts/i,
    terms: /payroll|employment|labour|labor|unemployment|wage|earnings|hours worked|participation|jobs|fed|rate/i,
    label: "Labour and Fed transmission",
  },
  {
    release: /consumer price|\bcpi\b|producer price|\bppi\b|personal consumption|\bpce\b/i,
    terms: /inflation|price|cpi|ppi|pce|fed|rate|yield|real yield|margin/i,
    label: "Inflation and rates transmission",
  },
  {
    release: /fomc|rate decision|monetary.policy/i,
    terms: /fed|fomc|central bank|rate|yield|dollar|dxy|duration|liquidity/i,
    label: "Policy and rates transmission",
  },
  {
    release: /retail sales|consumer confidence|consumer sentiment/i,
    terms: /consumer|retail|demand|spending|earnings|margin/i,
    label: "Consumer-demand transmission",
  },
  {
    release: /\bism\b|\bpmi\b|gross domestic|\bgdp\b/i,
    terms: /ism|pmi|growth|activity|manufactur|services|gdp|orders|production/i,
    label: "Growth and activity transmission",
  },
];

function normaliseAsset(asset: string) {
  return asset.toUpperCase().replace(/^\^/, "").replace(/[^A-Z0-9]/g, "");
}

function storyText(story: Story) {
  return [
    story.title,
    story.thesis,
    story.market_question,
    story.dominant_narrative,
    story.best_explanation,
    story.strongest_support,
    story.strongest_contradiction,
    story.priced_assessment,
    story.confirmation_trigger,
    story.invalidation_trigger,
    story.next_catalyst,
    story.article_angle,
  ].filter(Boolean).join(" ");
}

export function getRelatedStoriesForRelease(
  release: ReleaseLike | null,
  stories: Story[],
  limit = 3,
): ReleaseStoryLink[] {
  if (!release) return [];

  const theme = THEMES.find((item) => item.release.test(release.event));
  const releaseAssets = new Set(release.affectedAssets.map(normaliseAsset));

  return stories
    .filter((story) => story.status !== "archived")
    .map((story) => {
      const text = storyText(story);
      const catalystText = [story.next_catalyst, story.market_question, story.confirmation_trigger, story.invalidation_trigger]
        .filter(Boolean)
        .join(" ");
      const directCatalyst = theme ? theme.terms.test(catalystText) : false;
      const thematicMatch = theme ? theme.terms.test(text) : false;
      const overlap = (story.assets || [])
        .filter((asset) => releaseAssets.has(normaliseAsset(asset)))
        .slice(0, 3);

      let score = 0;
      if (directCatalyst) score += 8;
      else if (thematicMatch) score += 5;
      score += overlap.length * 2;
      if (/develop/i.test(story.status)) score += 1;

      const reason = directCatalyst
        ? `Direct catalyst match · ${theme?.label || "release transmission"}`
        : thematicMatch && overlap.length
          ? `${theme?.label || "Release transmission"} · ${overlap.join(", ")}`
          : thematicMatch
            ? theme?.label || "Release transmission"
            : overlap.length
              ? `Affected assets overlap · ${overlap.join(", ")}`
              : "";

      return { story, score, reason };
    })
    .filter((item) => item.score >= 4 && item.reason)
    .sort((a, b) => b.score - a.score || b.story.confidence - a.story.confidence)
    .slice(0, limit)
    .map(({ story, reason }) => ({ slug: story.slug, title: story.title, reason }));
}
