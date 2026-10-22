// @ts-nocheck
// Hybrid source parity; projection only, no new canonical reasoning writes.
export const RESEARCH_DESK_URL = "https://alchemy-live-market-desk-rogue-magazine.vercel.app/";

export function clamp(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value ?? 0));
}

export function shortTitle(title) {
  return title
    .replace(/^Can\s+/i, "")
    .replace(/^Is\s+/i, "")
    .replace(/\?$/, "")
    .split(/[,.:]/)[0]
    .trim();
}

export function journeyQuestion(story, maxLength = 74) {
  const question = story?.market_question
    || story?.marketQuestion
    || story?.title
    || "Question unavailable";

  if (question.length <= maxLength) return question;

  const clipped = question
    .slice(0, maxLength - 1)
    .replace(/\s+\S*$/, "")
    .replace(/[,:;.-]+$/, "")
    .trim();

  return `${clipped}\u2026`;
}

export function storyIcon(slug) {
  if (/oil|hormuz/.test(slug)) return "water_drop";
  if (/fed|rate|yield/.test(slug)) return "account_balance";
  if (/ai|capex|mag7|china/.test(slug)) return "memory";
  if (/yen|carry/.test(slug)) return "currency_yen";
  if (/breadth|earnings/.test(slug)) return "monitoring";
  return "radar";
}

export function storyTone(story) {
  return story?.uiTone || story?.tone || "neutral";
}

export function regimeLabel(_stories, canonicalRegime = null) {
  return canonicalRegime || "CANONICAL STORY DESK";
}

export function formatDate(value, withTime = false) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(date);
}
