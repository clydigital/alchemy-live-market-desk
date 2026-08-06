export const STORY_TAG_TAXONOMY = [
  "Forex",
  "War",
  "AI",
  "Crypto",
  "Gold",
  "Commodities",
  "Metals",
  "IPO",
  "Earnings",
  "Stocks",
  "Technology",
  "Semiconductors",
  "Energy",
  "Financials",
  "Industrials",
  "Consumer",
  "Healthcare",
  "Real Estate",
  "Central Banks",
  "Inflation",
  "Labour",
  "Growth",
  "Rates",
  "US",
  "Europe",
  "UK",
  "Japan",
  "China",
  "Emerging Markets",
] as const;

export type StoryTag = (typeof STORY_TAG_TAXONOMY)[number];

export type StoryTagInput = {
  title?: string | null;
  thesis?: string | null;
  assets?: string[] | null;
  dominant_narrative?: string | null;
  best_explanation?: string | null;
  strongest_support?: string | null;
  strongest_contradiction?: string | null;
  next_catalyst?: string | null;
  article_angle?: string | null;
  provisional_title?: string | null;
  tags?: string[] | null;
};

type TagRule = {
  tag: StoryTag;
  text?: RegExp;
  assets?: RegExp;
};

const TAG_RULES: TagRule[] = [
  { tag: "Forex", text: /\b(forex|fx|currency|currencies|dollar|yen|euro|sterling|carry trade|intervention)\b/i, assets: /^(DXY|JXY|EXY|BXY|USD[A-Z]{3}|[A-Z]{3}USD|EUR[A-Z]{3}|GBP[A-Z]{3}|JPY[A-Z]{3}|[A-Z]{3}JPY)$/i },
  { tag: "War", text: /\b(war|conflict|military|strike|missile|iran|israel|gaza|ukraine|russia|hormuz|sanction|geopolitical|retaliation|ceasefire)\b/i },
  { tag: "AI", text: /\b(ai|artificial intelligence|model|models|llm|inference|agent|agents|data centre|data center|hyperscaler|capex)\b/i, assets: /^(NVDA|AMD|MSFT|GOOGL|META|AMZN|BABA|ORCL|CRM|NOW|ANET|VRT)$/i },
  { tag: "Crypto", text: /\b(crypto|bitcoin|ethereum|stablecoin|blockchain|token)\b/i, assets: /^(BTC|BTCUSD|ETH|ETHUSD|SOL|SOLUSD|COIN|MSTR)$/i },
  { tag: "Gold", text: /\b(gold|bullion)\b/i, assets: /^(XAU|XAUUSD|GC|GC=F|GLD)$/i },
  { tag: "Commodities", text: /\b(commodity|commodities|crude|oil|gas|lng|copper|silver|gold|grain|wheat|corn|soy|opec|refining|crack spread)\b/i, assets: /^(WTI|BRENT|CL|CL=F|HO|HO=F|ULSD|NG|NG=F|XAU|XAUUSD|XAG|XAGUSD|HG|HG=F|GC|GC=F|SI|SI=F)$/i },
  { tag: "Metals", text: /\b(metal|metals|gold|silver|copper|platinum|palladium|iron ore)\b/i, assets: /^(XAU|XAUUSD|XAG|XAGUSD|HG|HG=F|GC|GC=F|SI|SI=F|GLD|SLV)$/i },
  { tag: "IPO", text: /\b(ipo|initial public offering|listing|debut|new issue)\b/i },
  { tag: "Earnings", text: /\b(earnings|results|quarter|guidance|revenue|margin|free cash flow|eps|profit)\b/i },
  { tag: "Stocks", text: /\b(stock|stocks|equity|equities|shares|index|indices|nasdaq|s&p|dow|kospi|nikkei|mag7|megacap)\b/i, assets: /^(SPX|\^GSPC|NDX|NASDAQ|QQQ|RSP|SOXX|KOSPI|NIKKEI|AAPL|MSFT|AMZN|GOOGL|META|NVDA|AMD|TSLA|BABA|MU|ANET|VRT|GEV|CEG)$/i },
  { tag: "Technology", text: /\b(technology|tech|software|cloud|digital|platform|hyperscaler|data centre|data center)\b/i, assets: /^(AAPL|MSFT|AMZN|GOOGL|META|NVDA|AMD|BABA|ORCL|CRM|NOW|SOXX|QQQ)$/i },
  { tag: "Semiconductors", text: /\b(semiconductor|semiconductors|chip|chips|gpu|memory|foundry|accelerator)\b/i, assets: /^(NVDA|AMD|MU|TSM|ASML|SOXX|SMH|INTC|AVGO)$/i },
  { tag: "Energy", text: /\b(energy|oil|crude|gas|lng|opec|refining|tanker|barrel|power)\b/i, assets: /^(WTI|BRENT|CL|CL=F|HO|HO=F|ULSD|NG|NG=F|XLE|OIH|CEG|GEV)$/i },
  { tag: "Financials", text: /\b(bank|banks|banking|financials|credit|lender|insurance)\b/i, assets: /^(XLF|JPM|BAC|GS|MS|C|WFC)$/i },
  { tag: "Industrials", text: /\b(industrial|industrials|manufacturing|factory|freight|shipping|aerospace|defence|defense)\b/i, assets: /^(XLI|CAT|DE|BA|GE|HON|UPS|FDX)$/i },
  { tag: "Consumer", text: /\b(consumer|retail|spending|sales|discretionary|staples)\b/i, assets: /^(XLY|XLP|WMT|COST|TGT|NKE|SBUX)$/i },
  { tag: "Healthcare", text: /\b(healthcare|health care|pharma|biotech|drug|medical)\b/i, assets: /^(XLV|LLY|UNH|JNJ|PFE|MRK|ABBV)$/i },
  { tag: "Real Estate", text: /\b(real estate|property|housing|homebuilder|reit|mortgage)\b/i, assets: /^(XLRE|IYR|VNQ|XHB)$/i },
  { tag: "Central Banks", text: /\b(fed|federal reserve|boj|bank of japan|ecb|bank of england|boe|central bank|rate decision|intervention)\b/i },
  { tag: "Inflation", text: /\b(inflation|cpi|ppi|prices|price pressure|disinflation)\b/i },
  { tag: "Labour", text: /\b(labour|labor|jobs|payroll|employment|unemployment|wages|jolts)\b/i },
  { tag: "Growth", text: /\b(growth|gdp|activity|ism|pmi|production|recession|expansion)\b/i },
  { tag: "Rates", text: /\b(rate|rates|yield|yields|treasury|bond|bonds|duration|curve|tightening|easing|hike|cut)\b/i, assets: /^(US02Y|US05Y|US10Y|US30Y|TLT|IEF|SHY)$/i },
  { tag: "US", text: /\b(us|u\.s\.|united states|wall street|federal reserve|fed|s&p|nasdaq|dow)\b/i, assets: /^(SPX|\^GSPC|NDX|NASDAQ|QQQ|RSP|SOXX|US02Y|US10Y|US30Y|DXY)$/i },
  { tag: "Europe", text: /\b(europe|european|eurozone|ecb|dax|stoxx)\b/i, assets: /^(EUR[A-Z]{3}|EXY|DAX|STOXX|SX5E)$/i },
  { tag: "UK", text: /\b(uk|u\.k\.|britain|british|bank of england|boe|sterling|ftse)\b/i, assets: /^(GBP[A-Z]{3}|BXY|FTSE)$/i },
  { tag: "Japan", text: /\b(japan|japanese|yen|boj|bank of japan|nikkei|topix)\b/i, assets: /^(USDJPY|EURJPY|GBPJPY|AUDJPY|CADJPY|CHFJPY|NZDJPY|JXY|NIKKEI|TOPIX)$/i },
  { tag: "China", text: /\b(china|chinese|beijing|pboc|yuan|renminbi|hang seng|csi|shanghai)\b/i, assets: /^(USDCNH|USDCNY|CNY|CNH|BABA|HSI|CSI300)$/i },
  { tag: "Emerging Markets", text: /\b(emerging market|emerging markets|em\b|developing economy|global south)\b/i, assets: /^(EEM|VWO|MXEF)$/i },
];

const CANONICAL_TAGS = new Map(STORY_TAG_TAXONOMY.map((tag) => [tag.toLowerCase(), tag]));

function addTag(target: StoryTag[], tag: StoryTag) {
  if (!target.includes(tag)) target.push(tag);
}

export function deriveStoryTags(input: StoryTagInput, limit = 6): StoryTag[] {
  const tags: StoryTag[] = [];

  for (const explicit of input.tags || []) {
    const canonical = CANONICAL_TAGS.get(explicit.trim().toLowerCase());
    if (canonical) addTag(tags, canonical);
  }

  const text = [
    input.title,
    input.thesis,
    input.dominant_narrative,
    input.best_explanation,
    input.strongest_support,
    input.strongest_contradiction,
    input.next_catalyst,
    input.article_angle,
    input.provisional_title,
  ].filter(Boolean).join(" ");
  const assets = (input.assets || []).map((asset) => asset.trim()).filter(Boolean);

  for (const rule of TAG_RULES) {
    const textMatch = rule.text?.test(text) ?? false;
    const assetMatch = rule.assets ? assets.some((asset) => rule.assets?.test(asset)) : false;
    if (textMatch || assetMatch) addTag(tags, rule.tag);
  }

  return tags.slice(0, Math.max(1, limit));
}

export function storyTagTone(tag: StoryTag) {
  if (["War", "Inflation"].includes(tag)) return "risk";
  if (["AI", "Technology", "Semiconductors", "Crypto"].includes(tag)) return "purple";
  if (["Gold", "Commodities", "Metals", "Energy"].includes(tag)) return "amber";
  if (["Forex", "Rates", "Central Banks"].includes(tag)) return "blue";
  if (["Stocks", "IPO", "Earnings", "Financials", "Industrials", "Consumer", "Healthcare", "Real Estate"].includes(tag)) return "green";
  return "neutral";
}
