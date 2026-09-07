export const DAILY_INVESTMENT_BRIEF_SOURCE = {
  key: "daily_investment_brief",
  name: "Daily Investment Brief Macroeconomic Dashboard",
  url: "https://dailyinvestmentbrief.com/macroeconomic-dashboard/",
  role: "primary",
} as const;

export const MACROMICRO_SOURCE = {
  key: "macromicro_supplemental",
  name: "MacroMicro",
  url: "https://en.macromicro.me/",
  role: "supplemental",
} as const;

export const LEGACY_MACRO_INDICATORS_SOURCE = {
  key: "macro_indicators_legacy",
  name: "Retired Macro Indicators dashboard",
  url: "https://macro-indicators-a3d.pages.dev/",
  role: "retired",
} as const;

export type MacroContextSource = typeof DAILY_INVESTMENT_BRIEF_SOURCE | typeof MACROMICRO_SOURCE;

function visibleText(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export function macroContextText(value: string) {
  return /<html|<body|<main|<div/i.test(value) ? visibleText(value) : value.replace(/\s+/g, " ").trim();
}

function datedMacroSignals(text: string) {
  const hasDate = /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+20\d{2}|20\d{2}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/20\d{2}/i.test(text);
  const signals = [
    /Growth[^0-9+\-]{0,80}[+\-]?\d+(?:\.\d+)?/i,
    /Inflation[^0-9+\-]{0,80}[+\-]?\d+(?:\.\d+)?/i,
    /Labou?r[^0-9+\-]{0,80}[+\-]?\d+(?:\.\d+)?/i,
    /Liquidity[^0-9+\-]{0,100}[+\-]?\d+(?:\.\d+)?/i,
    /Treasury[^0-9+\-]{0,80}[+\-]?\d+(?:\.\d+)?%?/i,
    /CPI[^0-9+\-]{0,80}[+\-]?\d+(?:\.\d+)?%?/i,
    /unemployment[^0-9+\-]{0,80}[+\-]?\d+(?:\.\d+)?%?/i,
    /yield[^0-9+\-]{0,80}[+\-]?\d+(?:\.\d+)?%?/i,
    /PMI[^0-9+\-]{0,80}[+\-]?\d+(?:\.\d+)?/i,
  ].filter((pattern) => pattern.test(text)).length;
  return { hasDate, signals };
}

export function macroContextBlockReason(source: MacroContextSource, value: string) {
  const text = macroContextText(value);
  if (!text) return "empty_response";
  if (/security verification|verify (?:that )?you are human|checking your browser|just a moment|cf-chl-/i.test(text)) {
    return "security_verification";
  }
  const { hasDate, signals } = datedMacroSignals(text);
  if (source.key === DAILY_INVESTMENT_BRIEF_SOURCE.key) {
    const placeholders = (text.match(/Analyzing\.\.\.|(?:^|\s)--(?:\s|$)/gi) || []).length;
    if (placeholders >= 2 && signals < 2) return "client_placeholders";
    if (signals < 2) return "insufficient_dated_readings";
    return null;
  }
  if (source.key === MACROMICRO_SOURCE.key) {
    if (!hasDate || signals < 1) return "insufficient_dated_readings";
  }
  return null;
}

export function macroContextFingerprint(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
