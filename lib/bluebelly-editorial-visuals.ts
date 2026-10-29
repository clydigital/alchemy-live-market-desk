/** Deterministic editorial artwork routing only; never market data or evidence. */
export const MOTIFS = ["fed","bonds","credit","ai","china","energy","lng","yen","gold","equities","other"] as const;
export type EditorialMotif = (typeof MOTIFS)[number];

export function editorialMotif(headline: string, summary = ""): EditorialMotif {
  const s = (headline + " " + summary).toLowerCase();
  if (/\b(lng|liquefied natural gas|gas export|gas terminal)\b/.test(s)) return "lng";
  if (/\b(china|chinese|beijing|deepseek|export controls|tariff|trade war)\b/.test(s) && /\b(chip|ai|semiconductor|export|tariff|trade|technology|model)\b/.test(s)) return "china";
  if (/\b(ai|artificial intelligence|chip|semiconductor|gpu|model|hyperscaler|data centre|data center|inference|robotics|nvidia)\b/.test(s)) return "ai";
  if (/\b(federal reserve|fed |fomc|powell|rate decision|inflation|cpi|pce|monetary policy|central bank|ecb)\b/.test(s)) return "fed";
  if (/\b(credit|default|refinancing|loan|lending|liquidity squeeze|spreads)\b/.test(s)) return "credit";
  if (/\b(treasur|government bond|sovereign|auction|yield|gilts|oat.bund|bunds|bonds)\b/.test(s)) return "bonds";
  if (/\b(hormuz|crude|brent|wti|oil|tanker|opec|iran|saudi|strait|refiner)\b/.test(s)) return "energy";
  if (/\b(japan|japanese|yen|jpy|boj|carry trade|nikkei)\b/.test(s)) return "yen";
  if (/\b(gold|bullion|central.bank reserve|xau|precious metal)\b/.test(s)) return "gold";
  if (/\b(equities|earnings|stocks|share price|s.p 500|nasdaq|stock market|ipo|margins|dividend)\b/.test(s)) return "equities";
  return "other";
}

/** Explicit identifiers only: a story about an auction cannot silently become an OAT spread chart. */
export const TV_INSTRUMENTS = {
  us2y: {label:"US 2Y Treasury yield", symbol:"TVC:US02Y"},
  us10y: {label:"US 10Y Treasury yield", symbol:"TVC:US10Y"},
  us30y: {label:"US 30Y Treasury yield", symbol:"TVC:US30Y"},
  dxy: {label:"US Dollar Index", symbol:"TVC:DXY"},
  spx: {label:"S&P 500 index", symbol:"TVC:SPX"},
  qqq: {label:"Nasdaq 100 ETF", symbol:"NASDAQ:QQQ"},
  nvda: {label:"Nvidia", symbol:"NASDAQ:NVDA"},
  mu: {label:"Micron", symbol:"NASDAQ:MU"},
  msft: {label:"Microsoft", symbol:"NASDAQ:MSFT"},
  brent: {label:"Brent crude proxy", symbol:"TVC:UKOIL"},
  wti: {label:"WTI crude proxy", symbol:"TVC:USOIL"},
  usdjpy: {label:"USD/JPY", symbol:"FX:USDJPY"},
  gold: {label:"Spot gold proxy", symbol:"OANDA:XAUUSD"},
} as const;
export type TvInstrument = keyof typeof TV_INSTRUMENTS;
export const TV_MARKET_GROUP_DEFAULTS: Record<string,TvInstrument> = {
  all:"us10y",rates:"us10y",ai:"nvda",energy:"brent",fx:"usdjpy",
  credit:"us10y",equities:"spx",metals:"gold",
};
/** No exact ticker, no chart: a broad claim is not a measurable asset. */
export function storyTvInstrument(headline: string): TvInstrument | null {
  const s=headline.toLowerCase();
  if (/\b(usdjpy|usd\/jpy|dollar.yen)\b/.test(s)) return "usdjpy";
  if (/\b(dxy|dollar index)\b/.test(s)) return "dxy";
  if (/\b(brent)\b/.test(s)) return "brent";
  if (/\b(wti|west texas intermediate)\b/.test(s)) return "wti";
  if (/\b(us 2y|2.year treasury)\b/.test(s)) return "us2y";
  if (/\b(us 30y|30.year treasury)\b/.test(s)) return "us30y";
  if (/\b(us 10y|10.year treasury)\b/.test(s)) return "us10y";
  if (/\b(s&p 500|spx|us500)\b/.test(s)) return "spx";
  if (/\b(qqq)\b/.test(s)) return "qqq";
  if (/\b(nvidia|nvda)\b/.test(s)) return "nvda";
  if (/\b(micron|mu stock)\b/.test(s)) return "mu";
  if (/\b(microsoft|msft)\b/.test(s)) return "msft";
  if (/\b(spot gold|xauusd|gold price|gold futures)\b/.test(s)) return "gold";
  return null;
}
