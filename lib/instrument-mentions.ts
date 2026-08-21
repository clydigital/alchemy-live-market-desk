type InstrumentSpec = { instrument: string; aliases: readonly string[] };

export const EXPLICIT_INSTRUMENTS: readonly InstrumentSpec[] = [
  { instrument: "GOOGL", aliases: ["GOOGL", "ALPHABET", "GOOGLE"] },
  { instrument: "MSFT", aliases: ["MSFT", "MICROSOFT"] },
  { instrument: "META", aliases: ["META", "META PLATFORMS"] },
  { instrument: "AMZN", aliases: ["AMZN", "AMAZON"] },
  { instrument: "AAPL", aliases: ["AAPL", "APPLE"] },
  { instrument: "AMD", aliases: ["AMD", "ADVANCED MICRO DEVICES"] },
  { instrument: "NVDA", aliases: ["NVDA", "NVIDIA"] },
  { instrument: "TSLA", aliases: ["TSLA", "TESLA"] },
  { instrument: "XLK", aliases: ["XLK", "TECHNOLOGY SELECT SECTOR"] },
  { instrument: "SOXX", aliases: ["SOXX", "SEMICONDUCTOR ETF", "SEMICONDUCTORS", "SEMIS"] },
  { instrument: "SPX", aliases: ["S&P 500", "S&P500", "SPX", "US500"] },
  { instrument: "NASDAQ", aliases: ["NASDAQ", "NAS100", "NDX", "US100"] },
  { instrument: "KOSPI", aliases: ["KOSPI"] },
  { instrument: "NIKKEI", aliases: ["NIKKEI", "JAPAN STOCKS", "JAPANESE STOCKS"] },
  { instrument: "FTSE100", aliases: ["FTSE 100", "FTSE100", "UK100"] },
  { instrument: "XAUUSD", aliases: ["XAUUSD", "XAU/USD", "GOLD"] },
  { instrument: "XAGUSD", aliases: ["XAGUSD", "XAG/USD", "SILVER"] },
  { instrument: "WTI", aliases: ["WTI", "USOIL", "US OIL", "WEST TEXAS INTERMEDIATE"] },
  { instrument: "BRENT", aliases: ["BRENT", "UKOIL", "UK OIL"] },
  { instrument: "DXY", aliases: ["DXY", "DOLLAR INDEX", "US DOLLAR INDEX"] },
  { instrument: "USDJPY", aliases: ["USDJPY", "USD/JPY"] },
  { instrument: "GBPJPY", aliases: ["GBPJPY", "GBP/JPY"] },
  { instrument: "AUDJPY", aliases: ["AUDJPY", "AUD/JPY"] },
  { instrument: "EURUSD", aliases: ["EURUSD", "EUR/USD"] },
  { instrument: "GBPUSD", aliases: ["GBPUSD", "GBP/USD"] },
  { instrument: "USDCHF", aliases: ["USDCHF", "USD/CHF"] },
  { instrument: "USDCAD", aliases: ["USDCAD", "USD/CAD"] },
  { instrument: "US10Y", aliases: ["US10Y", "US 10-YEAR", "10-YEAR YIELD", "10 YEAR YIELD"] },
  { instrument: "US30Y", aliases: ["US30Y", "US 30-YEAR", "30-YEAR YIELD", "30 YEAR YIELD"] },
  { instrument: "BTCUSD", aliases: ["BTCUSD", "BTC/USD", "BITCOIN"] },
];

export function normaliseInstrument(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function containsInstrumentAlias(text: string, alias: string) {
  const haystack = " " + text.toUpperCase().replace(/[^A-Z0-9]+/g, " ") + " ";
  const needle = alias.toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
  return needle.length >= 2 && haystack.includes(" " + needle + " ");
}

function specForAsset(asset: string) {
  const candidate = normaliseInstrument(asset);
  return EXPLICIT_INSTRUMENTS.find((spec) => (
    normaliseInstrument(spec.instrument) === candidate
    || spec.aliases.some((alias) => normaliseInstrument(alias) === candidate)
  ));
}

/** Returns only candidate assets explicitly named in the supplied evidence text. */
export function explicitlyMentionedAssets(text: string, candidateAssets: readonly string[]) {
  return [...new Set(candidateAssets.filter((asset) => {
    const spec = specForAsset(asset);
    if (spec) return spec.aliases.some((alias) => containsInstrumentAlias(text, alias));
    return containsInstrumentAlias(text, asset);
  }))];
}

export function explicitlyMentionedInstrumentSpecs(text: string) {
  return EXPLICIT_INSTRUMENTS.filter((spec) => spec.aliases.some((alias) => containsInstrumentAlias(text, alias)));
}
