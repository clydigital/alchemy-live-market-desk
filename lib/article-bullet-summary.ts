import type { AlchemyArticle } from "./alchemy";

const FALLBACK_SUMMARY = /open the original alchemy markets article/i;
const BOILERPLATE = /^(?:share|related articles|risk warning|disclaimer|subscribe|written by|table of contents|read more|all rights reserved|trading involves risk)/i;
const STOP_WORDS = new Set(["the", "a", "an", "and", "or", "in", "on", "of", "for", "to", "at", "by", "with", "as", "from", "is", "are", "was", "were", "this", "that", "it", "its", "be", "has", "have", "had", "but", "will", "can", "may", "could", "would", "should", "their", "our", "we", "they"]);

function words(text: string): Set<string> {
  return new Set(text.toLowerCase().match(/[a-z0-9]+/g)?.filter((word) => word.length > 2 && !STOP_WORDS.has(word)) || []);
}

function overlap(a: string, b: string): number {
  const left = words(a);
  const right = words(b);
  if (!left.size || !right.size) return 0;
  const shared = [...left].filter((word) => right.has(word)).length;
  return shared / Math.min(left.size, right.size);
}

function isUsable(text: string): boolean {
  return text.length >= 45
    && text.length <= 340
    && !BOILERPLATE.test(text)
    && !/cookie policy|privacy policy|past performance|not financial advice|accept all cookies|click here|sign up now/i.test(text)
    && !/^[\W\d]+$/.test(text);
}

/**
 * Source-only, extractive highlights for the Articles page.
 * Do not infer trade scenarios or invent facts when the article body is unavailable.
 */
export function articleSummaryBullets(article: Pick<AlchemyArticle, "title" | "summary" | "bodyText">): string[] {
  const intro = article.summary.replace(/\s+/g, " ").trim();
  const bullets: string[] = [];
  if (intro && !FALLBACK_SUMMARY.test(intro)) bullets.push(intro);

  const sourceLines = article.bodyText.split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const candidateSentences = sourceLines.flatMap((line) =>
    line.split(/(?<=[.!?])\s+(?=[“"'(]?[A-Z0-9])/).map((sentence) => sentence.trim()),
  );

  const focus = words(article.title + " " + article.summary);
  const candidates = candidateSentences
    .map((text, index) => {
      const matches = [...words(text)].filter((word) => focus.has(word)).length;
      const signal = /\b(?:if|unless|until|should|however|but|yet|despite|while|watch|risk|support|resistance|target|outlook|expect|guidance|demand|supply|earnings|inflation|yields)\b/i.test(text) ? 2 : 0;
      const numerical = /\d/.test(text) ? 1 : 0;
      return { text, index, score: Math.min(matches, 6) + signal + numerical + Math.max(0, 3 - index / 5) };
    })
    .filter(({ text }) => isUsable(text) && !bullets.some((bullet) => overlap(text, bullet) >= 0.72))
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const selected: typeof candidates = [];
  for (const candidate of candidates) {
    if (bullets.length + selected.length >= 4) break;
    if (selected.some((other) => overlap(other.text, candidate.text) >= 0.65)) continue;
    selected.push(candidate);
  }
  selected.sort((a, b) => a.index - b.index);
  bullets.push(...selected.map(({ text }) => text));

  return bullets;
}
