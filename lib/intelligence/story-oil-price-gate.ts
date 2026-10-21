import type { OilBenchmark } from "../research-gap-exact-oil-proof.ts";

/**
 * One deterministic guard used before existing Story maintenance and Story
 * synthesis mutations. A canonical UUID alone cannot establish a priced F1/F2
 * curve: the server must independently verify its original FINAL source chain.
 */
export type VerifiedOilEvidence = ReadonlyMap<string, ReadonlySet<OilBenchmark>>;

const UUID = /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i;
const DIRECTION = /\b(?:backwardat(?:ion|ed)|contango|front[- /]?(?:next|month)\s+(?:premium|discount|spread)|front\s*\/\s*next\s+premium|F1\s*[-–/]\s*F2|positive\s+roll\s+(?:yield|return)|forward[- ]curve\s+print)\b/i;
const OBSERVED = /\b(?:observed|measured|printed|prints|show(?:s|ing)?|demonstrat(?:es|ing)|indicat(?:es|ing)|trades?|traded|is|are|was|were|has|had|reflects?|proved|confirmed)\b/i;
const UNCERTAIN = /\b(?:if|could|might|may|would|potential|hypothes(?:is|ised)|scenario|unverified|unconfirmed|unresolved|not\s+(?:yet\s+)?verified|cannot\s+confirm|not\s+established|awaiting|reported|reportedly|claims?|alleged|possible)\b/i;
const NEGATED = /\b(?:no|not|without|lacks?|missing)\b.{0,45}\b(?:verified|measured|confirmed|original|settlement|F1|premium|backwardation)\b/i;

export function oilPriceAssertionSentences(parts: readonly (string | null | undefined)[]): string[] {
  return parts.flatMap(part => (part ?? "").split(/(?<=[.!?])\s+/))
    .map(part => part.trim()).filter(sentence =>
      DIRECTION.test(sentence)
      && OBSERVED.test(sentence)
      && !NEGATED.test(sentence)
      && !UNCERTAIN.test(sentence));
}

function namedBenchmarks(text: string, storyDescription: string): OilBenchmark[] {
  const named: OilBenchmark[] = [];
  if (/\b(?:WTI|West Texas Intermediate|NYMEX\s+CL)\b/i.test(text)) named.push("WTI");
  if (/\b(?:Brent|ICE\s+(?:Brent|B))\b/i.test(text)) named.push("BRENT");
  if (named.length) return named;
  if (!/\b(?:oil|crude|WTI|Brent|futures|refined)\b/i.test(storyDescription)) return [];
  const fallback: OilBenchmark[] = [];
  if (/\bWTI\b/i.test(storyDescription)) fallback.push("WTI");
  if (/\bBrent\b/i.test(storyDescription)) fallback.push("BRENT");
  // If no benchmark is named, proof of at least one underlying market is
  // still required; a generic "observed crude backwardation" cannot pass
  // based only on context/exchange-methodology pages.
  return fallback.length ? fallback : ["WTI", "BRENT"];
}

export function oilPriceAssertionErrors(input: {
  storyDescription: string;
  textParts: readonly (string | null | undefined)[];
  citedEvidenceIds: readonly string[];
  verifiedEvidence: VerifiedOilEvidence;
}): string[] {
  const cited = new Set(input.citedEvidenceIds.filter(id => UUID.test(id)));
  const failures: string[] = [];
  for (const sentence of oilPriceAssertionSentences(input.textParts)) {
    const benchmarks = namedBenchmarks(sentence, input.storyDescription);
    if (!benchmarks.length) continue;
    const proven = (benchmark: OilBenchmark) =>
      [...cited].some(id => input.verifiedEvidence.get(id)?.has(benchmark));
    // An explicitly named market needs its own exact original exchange
    // proof. An unnamed crude-curve claim needs at least one qualifying pair.
    const explicitName = /\b(?:WTI|West Texas Intermediate|NYMEX\s+CL|Brent|ICE\s+(?:Brent|B))\b/i.test(sentence);
    if (explicitName ? !benchmarks.every(proven) : !benchmarks.some(proven)) {
      failures.push("Unsupported observed crude futures F1/F2 price assertion: " +
        sentence.slice(0, 210) + ". Context-only evidence, an exchange methodology " +
        "page or a third-party forward-curve print cannot prove a measured " +
        "front/next premium. Obtain the exact original FINAL exchange pair, " +
        "with dated contracts, units and canonical source-chain proof.");
    }
  }
  return failures;
}
