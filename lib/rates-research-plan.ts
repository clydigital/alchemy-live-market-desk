import type { IntakeItemInput } from "./research-update.ts";

export const RATES_CONTEXT_PREFIX = "rates-context:";
export const MAG7 = ["NVDA", "MSFT", "AAPL", "AMZN", "GOOGL", "META", "TSLA"];
const COMPANIES: Record<string, string> = {
  NVDA: "Nvidia", MSFT: "Microsoft", AAPL: "Apple", AMZN: "Amazon", GOOGL: "Alphabet Google",
  META: "Meta Platforms", TSLA: "Tesla", MU: "Micron", SPACEX: "SpaceX", AMD: "AMD",
  AVGO: "Broadcom", ORCL: "Oracle", MSTR: "MicroStrategy Strategy Inc",
};
const MACRO = /\b(FOMC|Fed|Federal Reserve|rate decision|interest rates?|Treasury yields?|credit spreads?|real yields?|NFP|nonfarm|non-farm|payrolls|JOLTS|Bessent|Jackson Hole|Warsh|Powell)\b/i;
const COMPANY_EVENT = /\b(earnings|guidance|revenue|debt|financing|refinanc\w*|capex|capital expenditure|demand|valuation|funding|IPO|maturit\w*|preferred|convertible|dividend)\b/i;
const SECURITIES = /\b(STRC|STRK|STRF|STRD|STRE)\b/g;
export type RatesResearchTarget = {
  key: string; subject: string; query: string; triggerItemKeys: string[];
  assets: string[]; depth: "macro" | "company" | "mstr_light" | "mstr_deep" | "instrument";
  instrument?: string;
};
function mentions(text: string, symbol: string) {
  const names = [symbol, ...(COMPANIES[symbol] || "").split(" ").filter((v) => !["Strategy", "Inc", "Platforms"].includes(v))];
  return names.some((name) => new RegExp(`\\b${name}\\b`, "i").test(text));
}

/** Bounded lead planning, not a materiality verdict. The semantic recruiter still owns Stories. */
export function buildRatesResearchPlan(items: IntakeItemInput[], now = new Date()): RatesResearchTarget[] {
  const targets = new Map<string, RatesResearchTarget>();
  const add = (target: RatesResearchTarget) => {
    const old = targets.get(target.key);
    if (old) old.triggerItemKeys = [...new Set([...old.triggerItemKeys, ...target.triggerItemKeys])];
    else targets.set(target.key, target);
  };
  for (const item of items) {
    const age = now.getTime() - Date.parse(item.publishedAt);
    if (item.itemKey.startsWith(RATES_CONTEXT_PREFIX) || item.recommendedAction === "ignore"
      || !Number.isFinite(age) || age > 5 * 86400000 || age < -8 * 86400000
      || (item.itemType === "video" && item.transcriptStatus !== "ready")) continue;
    const text = `${item.title} ${item.summary} ${item.transcriptText || ""}`;
    const macro = MACRO.test(text);
    const bitcoin = /\b(Bitcoin|BTC|BTCUSD)\b/i.test(text);
    const instruments = [...new Set(text.match(SECURITIES) || [])];
    const central = Object.keys(COMPANIES).filter((symbol) => mentions(item.title, symbol)
      || (new RegExp(`^(?:${symbol}|${COMPANIES[symbol].split(" ")[0]})\\b`, "i").test(item.summary) && COMPANY_EVENT.test(item.summary))
      || (mentions(text, symbol) && (text.match(new RegExp(`\\b(?:${symbol}|${COMPANIES[symbol].split(" ")[0]})\\b`, "gi")) || []).length >= 2));
    // Explicit transcript tickers extend the universe without interpreting every uppercase word as a stock.
    for (const match of text.matchAll(/\$([A-Z]{1,5})\b/g)) {
      if (!central.includes(match[1])) central.push(match[1]);
    }
    const mstrCentral = central.includes("MSTR") || instruments.length > 0
      || /\bStrategy\b/.test(item.title) && /\b(bitcoin|preferred|capital|dividend|debt)\b/i.test(text);
    const relevant = macro || bitcoin || instruments.length > 0 || (central.length > 0 && COMPANY_EVENT.test(text));
    if (!relevant) continue;
    const base = { triggerItemKeys: [item.itemKey] };
    add({ ...base, key: "macro", subject: "US rates backdrop", assets: [], depth: "macro",
      query: `Federal Reserve Treasury policy rate nominal real yields credit spreads latest dated observations ${now.getUTCFullYear()}` });
    if (macro) add({ ...base, key: "catalyst", subject: "Macro catalyst", assets: [], depth: "macro",
      query: `${item.title.slice(0, 220)} official release statement actual prior consensus date` });
    const selected = [...new Set([...central.filter((v) => v !== "MSTR"), ...(macro ? MAG7 : [])])];
    for (const symbol of selected) {
      const name = COMPANIES[symbol] || symbol;
      add({ ...base, key: `company:${symbol}`, subject: name, assets: [symbol], depth: "company",
        query: `${name} latest quarterly earnings guidance debt cash maturities interest expense customer demand capex valuation investor relations ${now.getUTCFullYear()}` });
    }
    if (bitcoin || mstrCentral) {
      add({ ...base, key: mstrCentral ? "mstr:deep" : "mstr:light", subject: "Strategy MSTR", assets: ["MSTR"], depth: mstrCentral ? "mstr_deep" : "mstr_light",
        query: mstrCentral
          ? "Strategy MSTR latest capital stack debt convertible maturities ATM dilution preferred dividend coverage redemption seniority prospectus site:strategy.com"
          : "Strategy MSTR latest Bitcoin holdings financing disclosure site:strategy.com" });
    }
    for (const instrument of instruments) add({ ...base, key: `instrument:${instrument}`, subject: `Strategy ${instrument}`, assets: ["MSTR", instrument], depth: "instrument", instrument,
      query: `Strategy ${instrument} exact security name prospectus currency dividend cumulative noncumulative floating fixed reset conversion redemption seniority site:strategy.com` });
    if (mstrCentral && /\bSTR\b/.test(text)) add({ ...base, key: "instrument:unresolved", subject: "Unresolved Strategy STR reference", assets: ["MSTR"], depth: "instrument",
      query: "Strategy preferred securities STR exact ticker prospectus STRC STRK STRF STRD STRE" });
  }
  if (targets.has("mstr:deep")) targets.delete("mstr:light");
  // Exact securities and central companies precede the broader macro comparison.
  const priority = (target: RatesResearchTarget) => target.depth === "instrument" ? 0 : target.depth === "mstr_deep" ? 1 : 2;
  return [...targets.values()].sort((a, b) => priority(a) - priority(b));
}

export type RatesContext = { triggerItemKeys: string[]; assets: string[]; depth: string; retrievedAt: string; instrument?: string };
export function parseRatesContext(note: string | null | undefined): RatesContext | null {
  if (!note?.startsWith(RATES_CONTEXT_PREFIX)) return null;
  try {
    const value = JSON.parse(note.slice(RATES_CONTEXT_PREFIX.length));
    if (!Array.isArray(value.triggerItemKeys) || !value.triggerItemKeys.every((v: unknown) => typeof v === "string")
      || !Array.isArray(value.assets) || !value.assets.every((v: unknown) => typeof v === "string")
      || !Number.isFinite(Date.parse(value.retrievedAt))) return null;
    return value;
  } catch { return null; }
}
