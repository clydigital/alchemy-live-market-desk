export type ScorecardStoryInput = {
  confidence: number;
  sourceQuality: number;
  novelty: number;
  persistence: number;
  traderRelevance: number;
  status: string;
  nextCatalyst: string | null;
};

export type StoryScorecard = {
  materiality: number;
  verification: number;
  momentum: number;
  urgency: number;
  evidenceHealth: number;
  priority: number;
  probability: null;
};

function score(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function lifecycleMomentum(status: string) {
  if (/invalid|archiv/i.test(status)) return 10;
  if (/weaken/i.test(status)) return 30;
  if (/confirm|publish/i.test(status)) return 75;
  if (/develop|monitor/i.test(status)) return 60;
  return 45;
}

/**
 * A transparent P3 dashboard projection. It deliberately does not convert
 * confidence into a probability: only an explicitly modelled scenario may do
 * that. Inputs are existing canonical Story fields, so it cannot create a
 * second research or scoring path.
 */
export function deriveStoryScorecard(input: ScorecardStoryInput): StoryScorecard {
  const materiality = score((input.persistence * 0.4) + (input.traderRelevance * 0.4) + (input.novelty * 0.2));
  const verification = score(input.sourceQuality);
  const momentum = lifecycleMomentum(input.status);
  const urgency = input.nextCatalyst?.trim() ? 75 : 30;
  const evidenceHealth = score((input.confidence * 0.45) + (verification * 0.4) + (input.persistence * 0.15));
  const priority = score((materiality * 0.35) + (evidenceHealth * 0.3) + (momentum * 0.2) + (urgency * 0.15));
  return { materiality, verification, momentum, urgency, evidenceHealth, priority, probability: null };
}
