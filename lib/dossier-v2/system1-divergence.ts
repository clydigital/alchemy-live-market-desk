import type { DossierV2InputPacket, ObservedEvidence } from "./input-packet.ts";

type Direction = "UP" | "DOWN";
type PolicyImpulse = "HAWKISH" | "DOVISH";

type Rule = {
  id: string;
  pattern: RegExp;
  opposite?: string;
  policyImpulse?: PolicyImpulse;
  expectations: Array<[monitorId: string, instrument: string, direction: Direction]>;
};

export type System1PolicyExpectationCheck = {
  check_id: string;
  rule_id: string;
  trigger_evidence_id: string;
  policy_impulse: PolicyImpulse;
  next_meeting_rate_outlook: "MORE_HAWKISH" | "MORE_DOVISH";
  fedwatch_expectation: "HIKE_ODDS_UP" | "HIKE_ODDS_DOWN";
  expected_market_reactions: Array<{
    instrument: string;
    expected_direction: Direction;
  }>;
};

export type System1DivergenceCandidate = {
  check_id: string;
  rule_id: string;
  trigger_evidence_id: string;
  market_evidence_id: string;
  instrument: string;
  expected_direction: Direction;
  observed_direction: Direction;
  observed_change_pct: number;
  severity: "MEDIUM" | "HIGH";
};

const MIN_MATERIAL_MOVE_PCT = 0.25;
const MAX_CANDIDATES = 5;
const MAX_POLICY_CHECKS = 3;

const RULES: Rule[] = [
  {
    id: "HAWKISH_MONETARY_POLICY",
    pattern: /\b(?:hawkish|rate hike|hiked (?:the )?(?:policy )?rate|raised (?:the )?(?:policy )?rate|higher for longer|tightening bias)\b/i,
    opposite: "DOVISH_MONETARY_POLICY",
    policyImpulse: "HAWKISH",
    expectations: [
      ["us2y", "US02Y", "UP"],
      ["dxy", "DXY", "UP"],
      ["gold", "XAUUSD", "DOWN"],
      ["smh", "SMH", "DOWN"],
    ],
  },
  {
    id: "DOVISH_MONETARY_POLICY",
    pattern: /\b(?:dovish|rate cut|cut (?:the )?(?:policy )?rate|easing bias|lower rates)\b/i,
    opposite: "HAWKISH_MONETARY_POLICY",
    policyImpulse: "DOVISH",
    expectations: [
      ["us2y", "US02Y", "DOWN"],
      ["dxy", "DXY", "DOWN"],
      ["gold", "XAUUSD", "UP"],
      ["smh", "SMH", "UP"],
    ],
  },
  {
    id: "HOT_INFLATION_SURPRISE",
    pattern: /\b(?:hotter than expected|inflation (?:re-)?accelerat(?:ed|es|ing)|(?:cpi|ppi|inflation).{0,80}(?:above|higher than) (?:consensus|forecast|expected|expectations))\b/i,
    opposite: "SOFT_INFLATION_SURPRISE",
    policyImpulse: "HAWKISH",
    expectations: [
      ["us2y", "US02Y", "UP"],
      ["dxy", "DXY", "UP"],
      ["gold", "XAUUSD", "DOWN"],
      ["smh", "SMH", "DOWN"],
    ],
  },
  {
    id: "SOFT_INFLATION_SURPRISE",
    pattern: /\b(?:cooler than expected|disinflation|inflation (?:eased|cooled|decelerated)|(?:cpi|ppi|inflation).{0,80}(?:below|lower than) (?:consensus|forecast|expected|expectations))\b/i,
    opposite: "HOT_INFLATION_SURPRISE",
    policyImpulse: "DOVISH",
    expectations: [
      ["us2y", "US02Y", "DOWN"],
      ["dxy", "DXY", "DOWN"],
      ["gold", "XAUUSD", "UP"],
      ["smh", "SMH", "UP"],
    ],
  },
  {
    id: "STRONG_ACTIVITY_SURPRISE",
    pattern: /\b(?:(?:flash\s+)?(?:manufacturing|services|composite)\s+pmi|pmi|ism|gdp|retail sales)\b.{0,100}\b(?:above|higher than|stronger than|beat(?:s|ing)?)\b.{0,40}\b(?:consensus|forecast|expected|expectations)\b/i,
    opposite: "WEAK_ACTIVITY_SURPRISE",
    policyImpulse: "HAWKISH",
    expectations: [
      ["us2y", "US02Y", "UP"],
      ["dxy", "DXY", "UP"],
      ["gold", "XAUUSD", "DOWN"],
      ["smh", "SMH", "DOWN"],
    ],
  },
  {
    id: "WEAK_ACTIVITY_SURPRISE",
    pattern: /\b(?:(?:flash\s+)?(?:manufacturing|services|composite)\s+pmi|pmi|ism|gdp|retail sales)\b.{0,100}\b(?:below|lower than|weaker than|miss(?:es|ed|ing)?)\b.{0,40}\b(?:consensus|forecast|expected|expectations)\b/i,
    opposite: "STRONG_ACTIVITY_SURPRISE",
    policyImpulse: "DOVISH",
    expectations: [
      ["us2y", "US02Y", "DOWN"],
      ["dxy", "DXY", "DOWN"],
      ["gold", "XAUUSD", "UP"],
      ["smh", "SMH", "UP"],
    ],
  },
  {
    id: "STRONG_LABOUR_SURPRISE",
    pattern: /\b(?:(?:nonfarm\s+)?payrolls?|employment|average hourly earnings|wage growth)\b.{0,100}\b(?:above|higher than|stronger than|beat(?:s|ing)?)\b.{0,40}\b(?:consensus|forecast|expected|expectations)\b|\bunemployment\b.{0,100}\b(?:below|lower than)\b.{0,40}\b(?:consensus|forecast|expected|expectations)\b/i,
    opposite: "WEAK_LABOUR_SURPRISE",
    policyImpulse: "HAWKISH",
    expectations: [
      ["us2y", "US02Y", "UP"],
      ["dxy", "DXY", "UP"],
      ["gold", "XAUUSD", "DOWN"],
      ["smh", "SMH", "DOWN"],
    ],
  },
  {
    id: "WEAK_LABOUR_SURPRISE",
    pattern: /\b(?:(?:nonfarm\s+)?payrolls?|employment|average hourly earnings|wage growth)\b.{0,100}\b(?:below|lower than|weaker than|miss(?:es|ed|ing)?)\b.{0,40}\b(?:consensus|forecast|expected|expectations)\b|\bunemployment\b.{0,100}\b(?:above|higher than)\b.{0,40}\b(?:consensus|forecast|expected|expectations)\b/i,
    opposite: "STRONG_LABOUR_SURPRISE",
    policyImpulse: "DOVISH",
    expectations: [
      ["us2y", "US02Y", "DOWN"],
      ["dxy", "DXY", "DOWN"],
      ["gold", "XAUUSD", "UP"],
      ["smh", "SMH", "UP"],
    ],
  },
  {
    id: "ENERGY_SUPPLY_STRESS",
    pattern: /\b(?:oil supply disruption|shipping disruption|refinery outage|strait of hormuz|red sea.{0,80}(?:shipping|tanker|oil|energy)|(?:oil|energy).{0,80}geopolitical escalation)\b/i,
    expectations: [
      ["wti", "WTI", "UP"],
      ["distillate", "ULSD", "UP"],
      ["crack-distillate", "ULSD_CRACK", "UP"],
    ],
  },
];

function metric(evidence: ObservedEvidence | undefined, key: string): number | null {
  const value = evidence?.metrics?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function policyEvidence(packet: DossierV2InputPacket): ObservedEvidence[] {
  const merged = [
    ...(packet.rate_context?.evidence ?? []),
    ...packet.observed_evidence,
  ];
  return [...new Map(merged.map((item) => [item.evidence_id, item])).values()];
}

function triggerFor(packet: DossierV2InputPacket, rule: Rule): ObservedEvidence | null {
  const monetaryPolicyRule =
    rule.id === "HAWKISH_MONETARY_POLICY" || rule.id === "DOVISH_MONETARY_POLICY";

  return policyEvidence(packet)
    .filter((item) => {
      if (item.source_type === "MARKET_DATA" || !rule.pattern.test(item.claim_or_fact)) return false;

      // A probability repricing or post-event market reaction is evidence about
      // the policy outlook, not a new monetary-policy event. Without this gate,
      // phrases such as "probability of a rate hike" can recursively trigger a
      // second policy expectation check.
      const signalKind = typeof item.metrics?.signal_kind === "string"
        ? item.metrics.signal_kind
        : null;
      if (
        monetaryPolicyRule &&
        (signalKind === "rate_expectation" || signalKind === "market_reaction")
      ) return false;

      return true;
    })
    .sort((a, b) => b.available_at.localeCompare(a.available_at))[0] ?? null;
}

function activeTriggers(packet: DossierV2InputPacket) {
  return new Map(
    RULES.flatMap((rule) => {
      const trigger = triggerFor(packet, rule);
      return trigger ? [[rule.id, trigger] as const] : [];
    }),
  );
}

function marketMove(
  packet: DossierV2InputPacket,
  monitorId: string,
): { evidence: ObservedEvidence; change: number } | null {
  const cluster = packet.development_clusters.find(
    (item) => item.grouping_key === `market-monitor:${monitorId}`,
  );
  const evidence = cluster?.evidence.find(
    (item) => item.source_type === "MARKET_DATA" && metric(item, "day_change_pct") !== null,
  );
  const change = metric(evidence, "day_change_pct");
  return evidence && change !== null ? { evidence, change } : null;
}

export function buildSystem1PolicyExpectationChecks(
  packet: DossierV2InputPacket,
): System1PolicyExpectationCheck[] {
  const active = activeTriggers(packet);
  const checks: System1PolicyExpectationCheck[] = [];

  for (const rule of RULES) {
    const trigger = active.get(rule.id);
    if (!trigger || !rule.policyImpulse || (rule.opposite && active.has(rule.opposite))) continue;

    const hawkish = rule.policyImpulse === "HAWKISH";
    checks.push({
      check_id: `system1:policy:${rule.id.toLowerCase()}`,
      rule_id: rule.id,
      trigger_evidence_id: trigger.evidence_id,
      policy_impulse: rule.policyImpulse,
      next_meeting_rate_outlook: hawkish ? "MORE_HAWKISH" : "MORE_DOVISH",
      fedwatch_expectation: hawkish ? "HIKE_ODDS_UP" : "HIKE_ODDS_DOWN",
      expected_market_reactions: rule.expectations.map(([, instrument, expectedDirection]) => ({
        instrument,
        expected_direction: expectedDirection,
      })),
    });
  }

  return checks.slice(0, MAX_POLICY_CHECKS);
}

export function buildSystem1DivergenceCandidates(
  packet: DossierV2InputPacket,
): System1DivergenceCandidate[] {
  const active = activeTriggers(packet);

  const candidates: System1DivergenceCandidate[] = [];

  for (const rule of RULES) {
    const trigger = active.get(rule.id);
    if (!trigger || (rule.opposite && active.has(rule.opposite))) continue;

    for (const [monitorId, instrument, expected] of rule.expectations) {
      const move = marketMove(packet, monitorId);
      if (!move || Math.abs(move.change) < MIN_MATERIAL_MOVE_PCT) continue;

      const observed: Direction = move.change > 0 ? "UP" : "DOWN";
      if (observed === expected) continue;

      candidates.push({
        check_id: `system1:${rule.id.toLowerCase()}:${monitorId}`,
        rule_id: rule.id,
        trigger_evidence_id: trigger.evidence_id,
        market_evidence_id: move.evidence.evidence_id,
        instrument,
        expected_direction: expected,
        observed_direction: observed,
        observed_change_pct: move.change,
        severity: Math.abs(move.change) >= 1 ? "HIGH" : "MEDIUM",
      });
    }
  }

  return candidates
    .sort(
      (a, b) =>
        Math.abs(b.observed_change_pct) - Math.abs(a.observed_change_pct) ||
        a.check_id.localeCompare(b.check_id),
    )
    .slice(0, MAX_CANDIDATES);
}
