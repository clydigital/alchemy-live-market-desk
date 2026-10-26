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
  marketMechanism: string;
  humanStake: string;
  latestObservedAt: string;
  updates: NewsBriefV1[];
};

type TopicRule = { id: string; title: string; question: string; mechanism: string; humanStake: string; pattern: RegExp };
const TOPICS: readonly TopicRule[] = [
  {
    id: "oil-gulf-energy", title: "Oil, Gulf supply and energy",
    humanStake: "Think of a delivery firm, an airline or anyone paying to move goods. A disrupted oil route can raise the cost of doing business even before it shows up on a household bill. The next question is whether the disruption is measurable or only being feared.",
    question: "Are physical supply and transport conditions changing, and where could those costs reach other markets?",
    mechanism: "A disruption to shipping or refining can make fuel more expensive to deliver. That can feed inflation and transport costs, potentially affecting Brent, diesel, bonds and company margins. Whether those assets actually moved on the news needs a matched price observation.",
    pattern: /\b(?:oil|brent|wti|crude|hormuz|iran|saudi|opec|lng|diesel|refiner|refinery|tanker|shipping|strait|petroleum|gasoline)\b/i,
  },
  {
    id: "rates-bonds-credit", title: "US yields, bonds and credit",
    humanStake: "Someone renewing a mortgage, a business refinancing debt and a saver buying bonds all feel a change in borrowing costs differently. Investors care because the price of money also changes how much they will pay for future company profits.",
    question: "Are yields, financing costs or credit conditions changing enough to affect asset pricing?",
    mechanism: "When yields rise, mortgages and business borrowing can become more expensive and future profits are discounted more heavily. That can pressure shares while affecting the dollar and gold. The link needs a dated yield and asset comparison, not just a headline.",
    pattern: /\b(?:treasury|bond|yields?|federal reserve|fomc|fed funds|inflation|cpi|ppi|credit|auction|borrowing|debt|mortgage|powell|rate cut|rate hike)\b/i,
  },
  {
    id: "ai-technology", title: "AI spending and technology",
    humanStake: "For a technology shareholder, the tension is simple: companies are spending heavily today on chips, power and data centres, while investors want to know when that spending brings cash back. Revenue and free cash flow, not an AI slogan, are the deciding receipts.",
    question: "Are AI demand, cash flows and infrastructure spending developing in the same direction?",
    mechanism: "AI orders only become durable shareholder value if spending turns into cash profit. Power, chips and borrowing come first, so higher project costs or delays may affect technology shares before demand itself slows. Compare cash flow, capex guidance and financing costs.",
    pattern: /\b(?:artificial intelligence|ai|chip|chips|semiconductor|nvidia|nvda|amd|hyperscal|datacent(?:re|er)|capex|compute|tsmc|oracle|meta platforms|microsoft)\b/i,
  },
  {
    id: "equities-earnings", title: "Equities and earnings",
    humanStake: "A shareholder does not just want a company to report bigger sales. They want to know how much is left after costs, whether management expects more growth and whether those results justify the price already paid for the shares.",
    question: "What do confirmed results and guidance show, and which earnings assumptions matter next?",
    mechanism: "A result matters when it changes what investors expect a company to earn. Slower sales, shrinking margins or better guidance can alter valuations, but prices can still move the opposite way if the outcome was already expected. Compare actual results with consensus and the same-session share reaction.",
    pattern: /\b(?:earnings?|stocks?|equities|s&p|nasdaq|dow jones|share price|profit|revenue|results|guidance|quarterly)\b/i,
  },
  {
    id: "fx-global", title: "Currencies and global policy",
    humanStake: "A stronger or weaker currency can change an importer's bill, an exporter's earnings and a traveller's spending power. Currency traders also care about the gap between two countries' interest-rate paths, not simply which central bank makes the louder announcement.",
    question: "How might shifts in interest-rate expectations, growth or capital flows affect major currencies?",
    mechanism: "Interest-rate differences and growth expectations influence where investors park their money. That can shift the dollar, yen, sterling or euro, and spill into imported costs and equities. Check the actual rate differential and dated FX movement before assigning a cause.",
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
        humanStake: group?.humanStake ||
          "The people exposed depend on which companies, households or assets face a change in costs, demand or borrowing. Look for evidence of that change before claiming anyone has already been affected.",
        marketMechanism: group?.mechanism ||
          "A market event matters when it changes cash flow, the cost of capital or risk expectations. Compare the relevant assets and timing before describing that pathway as an observed price reaction.",
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
