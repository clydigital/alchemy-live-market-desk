export type MacroMarketInstrument = {
  key: string;
  instrument: string;
  label: string;
  category: "equities" | "fx" | "rates" | "credit" | "commodities" | "semis";
  aliases: readonly string[];
};

export type FinraMacroProxy = {
  symbol: string;
  tracks: string;
  relationship: "direct_proxy" | "inverse_proxy" | "sector_proxy" | "risk_proxy";
  note: string;
};

export const PRIMARY_MACRO_MARKET_INSTRUMENTS: readonly MacroMarketInstrument[] = [
  { key: "usdjpy", instrument: "USDJPY", label: "USD/JPY", category: "fx", aliases: ["USDJPY", "USD/JPY"] },
  { key: "nikkei", instrument: "NIKKEI", label: "Nikkei 225", category: "equities", aliases: ["NIKKEI", "NI225", "JP225"] },
  { key: "kospi", instrument: "KOSPI", label: "KOSPI", category: "equities", aliases: ["KOSPI"] },
  { key: "hang-seng", instrument: "HSI", label: "Hang Seng Index", category: "equities", aliases: ["HSI", "HANG SENG"] },
  { key: "gold", instrument: "XAUUSD", label: "Gold", category: "commodities", aliases: ["XAUUSD", "XAU/USD", "GOLD"] },
  { key: "wti", instrument: "WTI", label: "WTI crude", category: "commodities", aliases: ["WTI", "CL1!", "USOIL"] },
  { key: "ulsd", instrument: "ULSD", label: "ULSD / distillate", category: "commodities", aliases: ["ULSD", "HO1!", "HEATING OIL", "DIESEL"] },
  { key: "smh", instrument: "SMH", label: "Semiconductors", category: "semis", aliases: ["SMH", "SEMICONDUCTORS", "SEMIS"] },
] as const;

/**
 * FINRA publishes short-sale volume for U.S.-listed securities, not spot FX,
 * overseas cash indexes or commodity futures. These securities are therefore
 * positioning/anomaly proxies for the primary macro instruments above.
 */
export const FINRA_MACRO_PROXY_BASKET: readonly FinraMacroProxy[] = [
  { symbol: "SPY", tracks: "SPX / US equity risk", relationship: "direct_proxy", note: "Broad U.S. equity risk." },
  { symbol: "QQQ", tracks: "NDX / growth duration", relationship: "direct_proxy", note: "Nasdaq/growth positioning." },
  { symbol: "IWM", tracks: "US small-cap risk", relationship: "direct_proxy", note: "Domestic cyclicality and funding sensitivity." },
  { symbol: "TLT", tracks: "US long-duration Treasuries", relationship: "direct_proxy", note: "Long-end duration proxy." },
  { symbol: "IEF", tracks: "US intermediate Treasuries", relationship: "direct_proxy", note: "Intermediate-duration rates proxy." },
  { symbol: "HYG", tracks: "US high-yield credit", relationship: "risk_proxy", note: "Credit risk appetite." },
  { symbol: "LQD", tracks: "US investment-grade credit", relationship: "risk_proxy", note: "Investment-grade credit conditions." },
  { symbol: "UUP", tracks: "DXY / US dollar", relationship: "direct_proxy", note: "Dollar basket proxy." },
  { symbol: "FXY", tracks: "USDJPY / Japanese yen", relationship: "inverse_proxy", note: "FXY rises with yen strength, broadly opposite USDJPY." },
  { symbol: "EWJ", tracks: "NIKKEI / Japan equities", relationship: "sector_proxy", note: "U.S.-listed Japan-equity positioning proxy." },
  { symbol: "EWY", tracks: "KOSPI / Korea equities", relationship: "sector_proxy", note: "U.S.-listed Korea-equity positioning proxy." },
  { symbol: "EWH", tracks: "HSI / Hong Kong equities", relationship: "sector_proxy", note: "U.S.-listed Hong Kong-equity positioning proxy." },
  { symbol: "GLD", tracks: "XAUUSD / gold", relationship: "direct_proxy", note: "FINRA-only gold positioning proxy; primary gold chart remains XAUUSD." },
  { symbol: "SMH", tracks: "SMH / semiconductors", relationship: "direct_proxy", note: "AI/semiconductor beta." },
  { symbol: "USL", tracks: "WTI crude", relationship: "direct_proxy", note: "12-month WTI futures proxy; primary oil chart remains WTI." },
  { symbol: "CRAK", tracks: "ULSD / refined-product margins", relationship: "sector_proxy", note: "Oil-refiner proxy for diesel/refined-product stress and crack-spread sensitivity." },
  { symbol: "XLE", tracks: "Energy equities", relationship: "sector_proxy", note: "Energy-equity transmission from crude/refined-product moves." },
  { symbol: "KRE", tracks: "Regional banks / rate sensitivity", relationship: "sector_proxy", note: "Funding and curve sensitivity." },
  { symbol: "XLF", tracks: "Financials / rate sensitivity", relationship: "sector_proxy", note: "Broad financial-sector response." },
  { symbol: "EEM", tracks: "Emerging-market risk", relationship: "risk_proxy", note: "Cross-EM risk appetite." },
] as const;

export const DEFAULT_FINRA_MACRO_SYMBOLS = FINRA_MACRO_PROXY_BASKET.map((item) => item.symbol);

export const PRIMARY_MACRO_INSTRUMENT_GUIDANCE = PRIMARY_MACRO_MARKET_INSTRUMENTS
  .map((item) => `${item.label}=${item.instrument}`)
  .join(", ");
