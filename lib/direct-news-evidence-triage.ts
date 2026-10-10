/**
 * Conservative direct-feed triage. These scores are attention hints, NOT proof
 * of market causality, issuer guidance, or independent source verification.
 * Retain all dated valid feed items for audit; downstream canonical reasoning
 * still owns admission and factual adjudication.
 */
export type DirectNewsTriage = {
  relevance: number;
  materiality: number;
  reason: "market_observable" | "business_transmission_candidate" | "relevance_unresolved";
};

const DIRECT_MARKET = /\b(?:stocks?|equities|shares?|markets?|semiconductors?|chips?|gpu|hbm|data.cent(?:re|er)s?|capex|capital expenditure|earnings|operating (?:profit|margin)|profits?|revenues?|cash flow|free cash flow|guidance|outlook|valuations?|ipo|offerings?|buybacks?|bond(?:s| market)?|treasur(?:y|ies)|yields?|interest rates?|funding|refinanc(?:e|ing)|credit|spreads?|default|(?:sovereign|corporate|public|government|national) debt|debt (?:market|offering|issuance|refinancing)|financial conditions|inflation|consumer prices?|cpi|ppi|pce|gdp|employment|unemployment|payrolls?|wages?|federal reserve|fed minutes|central bank|ecb|boj|interest.rate|dollar index|dxy|forex|currenc(?:y|ies)|yen|gold|silver|copper|oil|crude|diesel|gasoline|refiner(?:y|ies)|refined products|lng|natural gas|tankers?|freight|shipping costs?|supply (?:shock|chain)|tariffs?|exports?|imports?|sanctions?|mergers?|acquisitions?|antitrust|recession|manufacturing|orders?|inventor(?:y|ies)|housing|mortgages?|power grid|electricity prices?|trade war|trade deficit)\b/i;

const RELATED = /\b(?:ai|artificial intelligence|cloud|inference|datacentre|hyperscaler|compute|nvidia|amd|tsmc|micron|samsung|hynix|broadcom|oracle|coreweave|microsoft|alphabet|google|amazon|meta|anthropic|openai|spacex|starlink|tesla|apple|iran|hormuz|russia|ukraine|china|taiwan|japan|opec|eia|ofac|sec|bank(?:s|ing)?|airlines?|utilities|industrial|regulator|regulation|government subsidies|energy|businesses|econom(?:y|ic)|invest(?:or|ment)|companies|company|lenders?|borrowers?|cash|customers?|suppliers?)\b/i;

export function scoreDirectFeedHeadline(title: string, summary = ""): DirectNewsTriage {
  // The headline is a reliable boundary. RSS descriptions frequently embed
  // related-links, ads and site navigation, which cannot prove importance.
  if (DIRECT_MARKET.test(title)) {
    return { relevance: 82, materiality: 70, reason: "market_observable" };
  }
  if (RELATED.test(title)) {
    return { relevance: 66, materiality: 54, reason: "business_transmission_candidate" };
  }
  // Only give a small research opportunity to genuinely explanatory summaries.
  // Never let a generic article jump to top priority from boilerplate keywords.
  if (DIRECT_MARKET.test(summary.slice(0, 400))) {
    return { relevance: 52, materiality: 43, reason: "business_transmission_candidate" };
  }
  return { relevance: 28, materiality: 24, reason: "relevance_unresolved" };
}

export function normaliseDirectFeedText(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1")
    // Decode angle brackets BEFORE stripping tags: RSS often entity-escapes HTML.
    .replace(/&amp;lt;|&lt;|&#0*60;|&#x0*3c;/gi, "<")
    .replace(/&amp;gt;|&gt;|&#0*62;|&#x0*3e;/gi, ">")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#0*160;/gi, " ")
    .replace(/&quot;|&#0*34;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}
