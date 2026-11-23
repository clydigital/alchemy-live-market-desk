/** An independent equity analyst's public RSS is a research lead, never issuer evidence. */
export const REBOUND_CAPITAL_FEED_URL = "https://reboundcapital.substack.com/feed";
export const REBOUND_CAPITAL_OPINION_NOTICE = "Rebound Capital is independent investment opinion, not verified issuer or market data. Retain only the dated public RSS lead and link; independently confirm valuation, earnings, holdings and catalysts against filings and dated market evidence before using its thesis in Power Stack or Bluebelly. Never fetch or reproduce subscriber-only content.";

/** Narrow canonical article-domain boundary: reject off-publisher RSS links and redirects. */
export function isReboundCapitalArticleUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && url.hostname === "reboundcapital.substack.com"
      && !url.username && !url.password && !url.port
      && /^\\/p\\/[a-z0-9][a-z0-9-]*\\/?$/i.test(url.pathname);
  } catch {
    return false;
  }
}
