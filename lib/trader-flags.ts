export type TraderFlagTone = "rates" | "macro" | "risk" | "purple" | "warn" | "urgent";

export type TraderFlag = {
  key: string;
  label: string;
  tone: TraderFlagTone;
  pattern: RegExp;
};

export type TraderFlagInput = {
  title?: string | null;
  detail?: string | null;
  storyTitle?: string | null;
  kind?: string | null;
  topic?: string | null;
};

export const TRADER_FLAGS: TraderFlag[] = [
  { key: "fed-hike", label: "FED HIKE RISK", tone: "rates", pattern: /\b(?:fed(?:eral reserve)?.{0,28}(?:hike|hiking|tighten|tightening|hawk|hawkish)|rate hike|hike odds?|tightening risk)\b/i },
  { key: "fed-cut", label: "FED CUT RISK", tone: "rates", pattern: /\b(?:fed(?:eral reserve)?.{0,28}(?:cut|cutting|ease|easing|dove|dovish)|rate cut|cut odds?|easing risk)\b/i },
  { key: "fed-rates", label: "FED / RATES", tone: "rates", pattern: /\b(?:fed|federal reserve|fomc|rate decision|policy rate|front-end yields?|treasury yields?|yield curve|rate path|rates? repricing|hawkish hold|dovish hold)\b/i },
  { key: "inflation", label: "INFLATION", tone: "macro", pattern: /\b(?:inflation|disinflation|cpi|ppi|pce|price pressure|breakevens?)\b/i },
  { key: "war-risk", label: "WAR RISK", tone: "risk", pattern: /\b(?:war risk|war premium|war|conflict|attack|attacked|strike|missile|tanker|hormuz|interdiction|retaliation|iran)\b/i },
  { key: "intervention", label: "INTERVENTION", tone: "risk", pattern: /\b(?:intervention|fima|reserve-backed|reserve use|repatriation|ministry of finance)\b/i },
  { key: "capex", label: "CAPEX RISK", tone: "purple", pattern: /\b(?:capex|capital expenditure|cash burn|cash conversion|free cash flow|financing burden|capital intensity)\b/i },
  { key: "bubble", label: "BUBBLE / VALUATION", tone: "warn", pattern: /\b(?:stock bubble|bubble|valuation|multiple|stretched|expensive|overvalued|expectations? reset|return threshold|concentration)\b/i },
  { key: "liquidity", label: "LIQUIDITY / SQUEEZE", tone: "warn", pattern: /\b(?:liquidity|funding stress|carry unwind|deleverag(?:e|ing)|short squeeze|squeeze|positioning reset)\b/i },
  { key: "labour", label: "LABOUR", tone: "macro", pattern: /\b(?:payrolls?|jobs?|employment|unemployment|wages?|participation|labour|labor)\b/i },
  { key: "urgent", label: "URGENT", tone: "urgent", pattern: /\b(?:imminent|breaking|attack|attacked|strike|shock|squeeze|breakdown|reversal|plunge|surge|crash|halt|emergency)\b/i },
];

function corpus(input: TraderFlagInput) {
  return [input.title, input.detail, input.storyTitle, input.kind, input.topic].filter(Boolean).join(" ");
}

export function deriveTraderFlags(input: TraderFlagInput, limit = 4) {
  const text = corpus(input);
  return TRADER_FLAGS.filter((flag) => flag.pattern.test(text)).slice(0, Math.max(1, limit));
}

export type TraderTextSegment = {
  text: string;
  flag: TraderFlag | null;
};

export function splitTraderText(value: string | null | undefined): TraderTextSegment[] {
  const text = String(value || "");
  if (!text) return [];

  const matches: Array<{ start: number; end: number; text: string; flag: TraderFlag }> = [];
  for (const flag of TRADER_FLAGS) {
    const regex = new RegExp(flag.pattern.source, flag.pattern.flags.includes("g") ? flag.pattern.flags : `${flag.pattern.flags}g`);
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text))) {
      matches.push({ start: match.index, end: match.index + match[0].length, text: match[0], flag });
      if (!match[0].length) regex.lastIndex += 1;
    }
  }

  matches.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
  const accepted: typeof matches = [];
  let occupiedUntil = -1;
  for (const match of matches) {
    if (match.start < occupiedUntil) continue;
    accepted.push(match);
    occupiedUntil = match.end;
  }
  if (!accepted.length) return [{ text, flag: null }];

  const segments: TraderTextSegment[] = [];
  let cursor = 0;
  for (const match of accepted) {
    if (match.start > cursor) segments.push({ text: text.slice(cursor, match.start), flag: null });
    segments.push({ text: match.text, flag: match.flag });
    cursor = match.end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), flag: null });
  return segments;
}
