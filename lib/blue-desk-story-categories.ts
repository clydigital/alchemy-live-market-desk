import type { PublicThesis } from "./blue-desk-thesis-ledger.ts";

/** Navigation labels inferred from an existing Story title/slug, NOT source
 * verification, a fresh catalyst, a market reaction or a canonical verdict. */
export const PUBLIC_STORY_CATEGORIES = [
  "Rates & Fed",
  "AI & Technology",
  "Energy & Geopolitics",
  "Equities & Credit",
  "FX & Japan",
  "Other Markets",
] as const;

export type PublicStoryCategory = (typeof PUBLIC_STORY_CATEGORIES)[number];

export function classifyPublicStory(
  story: Pick<PublicThesis, "title" | "slug">,
): PublicStoryCategory {
  const text = (story.title + " " + story.slug).toLowerCase();
  if (/\b(?:brent|wti|crude|oil|opec|hormuz|refin(?:ed|ing|ery)|distillate|diesel|gas|lng|tanker|energy|middle.east|iran|gulf)\b/.test(text))
    return "Energy & Geopolitics";
  if (/\b(?:ai|artificial.intelligence|nvidia|hyperscaler|semiconductor|chip|gpu|data.cent(?:re|er)|compute|technology|capex)\b/.test(text))
    return "AI & Technology";
  if (/\b(?:japan|boj|yen|jpy|jgb|carry|usd.?jpy|dxy|dollar|forex|fx|currency)\b/.test(text))
    return "FX & Japan";
  if (/\b(?:fed|fomc|treasury|bond|yield|rates?|inflation|cpi|pce|mortgage|policy)\b/.test(text))
    return "Rates & Fed";
  if (/\b(?:equities|equity|stocks?|shares?|credit|earnings?|financ(?:e|ing)|cash.flow|growth|spx|nasdaq|valuation)\b/.test(text))
    return "Equities & Credit";
  return "Other Markets";
}
