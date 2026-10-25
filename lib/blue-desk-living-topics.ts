import type { NewsBriefV1 } from "./market-brief-news.ts";

/**
 * Rolling, source-dated research topics built only from already verified public
 * news briefs. No canonical Story IDs, Dossier version, LLM opinion, thesis or
 * causality. Classifications are editorial navigation, not verified conclusions.
 */
export type LivingMarketTopic = {
  id: string;
  title: string;
  guidingQuestion: string;
  latestObservedAt: string;
  updates: NewsBriefV1[];
};

type TopicRule = { id: string; title: string; question: string; pattern: RegExp };
const TOPICS: readonly TopicRule[] = [
  {
    id: "oil-gulf-energy", title: "Oil, Gulf supply and energy",
    question: "Are physical supply and transport conditions changing, and where could those costs reach other markets?",
    pattern: /\b(?:oil|brent|wti|crude|hormuz|iran|saudi|opec|lng|diesel|refiner|refinery|tanker|shipping|strait|petroleum|gasoline)\b/i,
  },
  {
    id: "rates-bonds-credit", title: "US yields, bonds and credit",
    question: "Are yields, financing costs or credit conditions changing enough to affect asset pricing?",
    pattern: /\b(?:treasury|bond|yields?|federal reserve|fomc|fed funds|inflation|cpi|ppi|credit|auction|borrowing|debt|mortgage|powell|rate cut|rate hike)\b/i,
  },
  {
    id: "ai-technology", title: "AI spending and technology",
    question: "Are AI demand, cash flows and infrastructure spending developing in the same direction?",
    pattern: /\b(?:artificial intelligence|ai|chip|chips|semiconductor|nvidia|nvda|amd|hyperscal|datacent(?:re|er)|capex|compute|tsmc|oracle|meta platforms|microsoft)\b/i,
  },
  {
    id: "equities-earnings", title: "Equities and earnings",
    question: "What do confirmed results and guidance show, and which earnings assumptions matter next?",
    pattern: /\b(?:earnings?|stocks?|equities|s&p|nasdaq|dow jones|share price|profit|revenue|results|guidance|quarterly)\b/i,
  },
  {
    id: "fx-global", title: "Currencies and global policy",
    question: "How might shifts in interest-rate expectations, growth or capital flows affect major currencies?",
    pattern: /\b(?:dxy|usd|jpy|yen|dollar|euro|eur|gbp|sterling|forex|currency|boj|ecb|bank of england|china|yuan|renminbi|tariff)\b/i,
  },
];

export function projectLivingMarketTopics(
  news: readonly NewsBriefV1[], limit = 8,
): LivingMarketTopic[] {
  if (!Number.isInteger(limit) || limit < 1) return [];
  const groups = new Map<string, LivingMarketTopic>();
  // Every record belongs to one topic, avoiding inflated or duplicated news counts.
  for (const item of [...news].sort((a,b)=>Date.parse(b.occurredAt)-Date.parse(a.occurredAt))) {
    const text = item.headline + "\n" + item.summary;
    const group = TOPICS.find(rule => rule.pattern.test(text));
    const id = group?.id || "other-catalysts";
    let current = groups.get(id);
    if (!current) {
      current = {
        id, title: group?.title || "Other market developments",
        guidingQuestion: group?.question ||
          "What changed, which assets might be exposed, and what evidence is still missing?",
        latestObservedAt: item.occurredAt,
        updates: [],
      };
      groups.set(id, current);
    }
    if (!current.updates.some(x => x.id === item.id)) current.updates.push(item);
  }
  return [...groups.values()].sort((a,b)=>
    Date.parse(b.latestObservedAt)-Date.parse(a.latestObservedAt)
  ).slice(0, Math.min(limit, 8));
}
