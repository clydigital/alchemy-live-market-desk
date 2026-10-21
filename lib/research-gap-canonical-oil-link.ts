import type { ResearchGapEvidenceAssessment, ResearchGapPlan } from "./research-gap-plan.ts";
import { requiresExactOilPairProof, type OilBenchmark } from "./research-gap-exact-oil-proof.ts";

const MONTHS = ["january","february","march","april","may","june","july","august","september","october","november","december"];
const DATE = /\b(20\d{2})-(\d{2})-(\d{2})\b/g;
const WRITTEN = /\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})\b/gi;

function isoDay(year: number, month: number, day: number): string | null {
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() + 1 === month
    && d.getUTCDate() === day ? d.toISOString().slice(0, 10) : null;
}

/** Undated or conflicting-date cases cannot automatically match historical data. */
export function explicitOilResearchTradeDate(plan: ResearchGapPlan): string | null {
  const sources = [
    plan.researchQuestion, plan.objective,
    ...plan.requirements.map(r => r.description),
  ].join(" ");
  const dates = new Set<string>();
  for (const match of sources.matchAll(DATE)) {
    const date = isoDay(Number(match[1]), Number(match[2]), Number(match[3]));
    if (date) dates.add(date);
  }
  for (const match of sources.matchAll(WRITTEN)) {
    const month = MONTHS.indexOf(match[2]!.toLowerCase()) + 1;
    const date = isoDay(Number(match[3]), month, Number(match[1]));
    if (date) dates.add(date);
  }
  return dates.size === 1 ? [...dates][0]! : null;
}

export type VerifiedOilPairReceipt = {
  evidenceId: string;
  benchmark: OilBenchmark;
  tradeDate: string;
  sourceUrl: string;
  frontContract: string;
  nextContract: string;
  frontSettle: number;
  nextSettle: number;
};

const oilNumerical = /\b(?:F1[\s/–-]*F2|front[- ](?:month|next)|calendar spread|two[- ]contract|backwardat(?:ion|ed)|dated settl(?:e|ement)|futures curve|forward curve)\b/i;

function idsForBenchmark(plan: ResearchGapPlan, benchmark: OilBenchmark): string[] {
  const all = requiresExactOilPairProof(plan.researchQuestion, plan.requirements.map(r => r.description));
  const out: string[] = [];
  for (const item of plan.requirements) {
    if (!oilNumerical.test(item.description)) continue;
    const named = requiresExactOilPairProof(item.description, []);
    if (named.includes(benchmark) || (named.length === 0 && all.length === 1)) out.push(item.id);
    if (named.length === 2 && !out.includes(item.id)) out.push(item.id);
  }
  return out;
}

/** A source-verified database receipt is required; web IDs cannot enter here. */
export function canonicalOilPairAssessments(
  plan: ResearchGapPlan, receipts: readonly VerifiedOilPairReceipt[],
): ResearchGapEvidenceAssessment[] {
  const date = explicitOilResearchTradeDate(plan);
  if (!date) return [];
  const required = requiresExactOilPairProof(plan.researchQuestion, plan.requirements.map(r => r.description));
  const testsBackwardation = /\bbackwardat(?:ion|ed)\b/i.test([plan.researchQuestion,plan.objective].join(" "));
  const results: ResearchGapEvidenceAssessment[] = [];
  const used = new Set<string>();
  for (const benchmark of required) {
    const candidates = receipts.filter(item => item.benchmark === benchmark && item.tradeDate === date)
      .sort((a,b)=>a.evidenceId.localeCompare(b.evidenceId));
    for (const item of candidates) {
      if (used.has(item.evidenceId)) continue;
      const requirementIds = idsForBenchmark(plan, benchmark);
      if (!requirementIds.length || !item.frontContract || !item.nextContract
        || !Number.isFinite(item.frontSettle) || !Number.isFinite(item.nextSettle)) continue;
      used.add(item.evidenceId);
      const spread = Math.round((item.frontSettle - item.nextSettle)*1_000_000)/1_000_000;
      const direction = testsBackwardation
        ? (spread > 0 ? "CONFIRMING" : "CONTRADICTING")
        : "CONFIRMING"; // Confirms the requested original dataset was retrieved.
      results.push({
        evidenceId: item.evidenceId,
        independenceKey: "EXCHANGE:" + (benchmark === "WTI" ? "NYMEX" : "ICE"),
        sourceClass: "market_data",
        sourceUrl: item.sourceUrl,
        sourceTitle: benchmark + " original FINAL F1/F2 exchange settlements " + date,
        publisher: benchmark === "WTI" ? "CME Group / NYMEX" : "ICE Futures",
        requirementIds,
        direction,
        directness: "DIRECT",
        quality: 99,
        traceable: true,
        claim: benchmark + " FINAL " + date + " " + item.frontContract + " $" + item.frontSettle +
          "/bbl; " + item.nextContract + " $" + item.nextSettle + "/bbl; F1-F2 $" + spread +
          "/bbl. " + (spread > 0 ? "Backwardation." : spread < 0 ? "Contango." : "Flat spread."),
      });
    }
  }
  return results.slice(0, 8);
}
