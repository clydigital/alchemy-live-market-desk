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
  { key: "fed-hike", label: "FED HIKE", tone: "rates", pattern: /\b(?:fed(?:eral reserve)?\s+(?:rate\s+)?hike|fomc\s+(?:rate\s+)?hike|rate\s+hike|hike\s+odds?|hike\s+probabilit(?:y|ies)|tightening\s+risk)\b/i },
  { key: "fed-cut", label: "FED CUT", tone: "rates", pattern: /\b(?:fed(?:eral reserve)?\s+(?:rate\s+)?cut|fomc\s+(?:rate\s+)?cut|rate\s+cut|cut\s+odds?|cut\s+probabilit(?:y|ies)|easing\s+risk)\b/i },
  { key: "payrolls", label: "PAYROLLS / NFP", tone: "macro", pattern: /\b(?:non[- ]?farm\s+payrolls?|payrolls?|nfp|jobs\s+report|employment\s+report)\b/i },
  { key: "earnings-beat", label: "EARNINGS BEAT", tone: "macro", pattern: /\b(?:(?:earnings|eps|revenue|sales|profit|guidance)\s+(?:beat|beats|beating)(?:\s+(?:estimates?|expectations?|consensus))?|(?:beat|beats|beating)\s+(?:earnings|eps|revenue|sales|profit|guidance)\s+(?:estimates?|expectations?|consensus)|better[- ]than[- ]expected\s+(?:earnings|eps|revenue|sales|profit))\b/i },
  { key: "earnings-miss", label: "EARNINGS MISS", tone: "risk", pattern: /\b(?:(?:earnings|eps|revenue|sales|profit|guidance)\s+(?:miss|misses|missed|disappoints?|disappointed)(?:\s+(?:estimates?|expectations?|consensus))?|(?:miss|misses|missed)\s+(?:earnings|eps|revenue|sales|profit|guidance)\s+(?:estimates?|expectations?|consensus)|worse[- ]than[- ]expected\s+(?:earnings|eps|revenue|sales|profit)|guidance\s+(?:cut|lowered|reduced))\b/i },
  { key: "inflation", label: "INFLATION", tone: "macro", pattern: /\b(?:headline\s+cpi|core\s+cpi|cpi|ppi|pce|core\s+pce|inflation(?:\s+(?:print|report|data|surprise))?|hotter[- ]than[- ]expected\s+inflation|cooler[- ]than[- ]expected\s+inflation)\b/i },
  { key: "intervention", label: "FX INTERVENTION", tone: "risk", pattern: /\b(?:(?:yen|fx|currency|japan(?:ese)?|usdjpy)\s+intervention|intervention\s+(?:in|on|to support|to weaken|to strengthen)\s+(?:the\s+)?(?:yen|currency|jpy)|joint\s+(?:us[- ]japan\s+)?intervention|coordinated\s+(?:fx|currency|yen)?\s*intervention)\b/i },
  { key: "war-escalation", label: "WAR ESCALATION", tone: "risk", pattern: /\b(?:war\s+escalation|escalat(?:e|es|ed|ing|ion)\s+(?:the\s+)?(?:war|conflict|hostilities)|military\s+strike|airstrike|missile\s+strike|retaliatory\s+strike|retaliation|tanker\s+attack|ship\s+attack|attacked\s+(?:a\s+)?tanker|renewed\s+hostilities|interdiction)\b/i },
  { key: "war-risk", label: "WAR RISK", tone: "risk", pattern: /\b(?:war\s+risk|war\s+premium|conflict\s+risk|strike\s+risk|military\s+risk)\b/i },
  { key: "deescalation", label: "DE-ESCALATION", tone: "macro", pattern: /\b(?:de[- ]?escalat(?:e|es|ed|ing|ion)|ceasefire|truce|pause(?:d)?\s+(?:military\s+)?strikes?|halt(?:ed)?\s+(?:military\s+)?strikes?)\b/i },
  { key: "peace-deal", label: "PEACE DEAL", tone: "macro", pattern: /\b(?:peace\s+(?:deal|agreement|accord)|ceasefire\s+(?:deal|agreement)|truce\s+(?:deal|agreement)|hormuz\s+(?:deal|agreement)|iran[- ](?:oman|us)\s+(?:deal|agreement)|oman\s+(?:deal|agreement))\b/i },
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
