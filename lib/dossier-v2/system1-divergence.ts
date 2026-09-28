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

export type System1ReactionAssessment = {
  check_id: string;
  rule_id: string;
  trigger_evidence_id: string;
  market_evidence_id: string;
  instrument: string;
  expected_direction: Direction;
  observed_direction: Direction;
  observed_change_pct: number;
  timing_precision: "INTRADAY" | "DAILY_POST_EVENT";
  relation: "ALIGNED" | "DIVERGENT";
  severity: "MEDIUM" | "HIGH";
};

export type System1DivergenceCandidate = Omit<System1ReactionAssessment, "relation">;

const MIN_MATERIAL_MOVE_PCT = 0.25;
const MAX_CANDIDATES = 5;
const MAX_REACTION_ASSESSMENTS = 8;
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

function timestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function utcDate(value: string | null | undefined): string | null {
  const parsed = timestamp(value);
  return parsed === null ? null : new Date(parsed).toISOString().slice(0, 10);
}

function marketReactionTiming(
  evidence: ObservedEvidence,
  trigger: ObservedEvidence,
): "INTRADAY" | "DAILY_POST_EVENT" | null {
  const triggerTime = timestamp(trigger.occurrence_time ?? trigger.available_at);
  const marketTime = timestamp(evidence.occurrence_time);
  if (triggerTime === null || marketTime === null) return null;

  const frequency = typeof evidence.metrics?.frequency === "string"
    ? evidence.metrics.frequency.trim().toLowerCase()
    : "";

  // Daily observations do not establish an event reaction when the catalyst
  // occurred on the same calendar date: the daily move contains pre-event
  // trading and cannot prove the direction of the post-event tape. A later
  // daily session is valid only as a coarse post-event persistence check.
  if (frequency === "daily" || frequency.includes("daily")) {
    const triggerDate = utcDate(trigger.occurrence_time ?? trigger.available_at);
    const marketDate = utcDate(evidence.occurrence_time);
    return triggerDate && marketDate && marketDate > triggerDate
      ? "DAILY_POST_EVENT"
      : null;
  }

  // Weekly/monthly observations are too coarse for deterministic event
  // divergence. They remain context for System 2, not reaction evidence.
  if (
    frequency.includes("weekly")
    || frequency.includes("monthly")
    || frequency.includes("quarter")
    || frequency.includes("annual")
  ) return null;

  // Exact timestamped market observations can establish sequencing.
  return marketTime >= triggerTime ? "INTRADAY" : null;
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
  trigger: ObservedEvidence,
): {
  evidence: ObservedEvidence;
  change: number;
  timingPrecision: "INTRADAY" | "DAILY_POST_EVENT";
} | null {
  const cluster = packet.development_clusters.find(
    (item) => item.grouping_key === `market-monitor:${monitorId}`,
  );
  const match = cluster?.evidence
    .flatMap((item) => {
      if (item.source_type !== "MARKET_DATA" || metric(item, "day_change_pct") === null) {
        return [];
      }
      const timingPrecision = marketReactionTiming(item, trigger);
      return timingPrecision ? [{ evidence: item, timingPrecision }] : [];
    })
    .sort((left, right) =>
      (timestamp(right.evidence.occurrence_time) ?? 0)
      - (timestamp(left.evidence.occurrence_time) ?? 0)
    )[0] ?? null;

  const change = metric(match?.evidence, "day_change_pct");
  return match && change !== null
    ? { evidence: match.evidence, change, timingPrecision: match.timingPrecision }
    : null;
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

export function buildSystem1ReactionAssessments(
  packet: DossierV2InputPacket,
): System1ReactionAssessment[] {
  const active = activeTriggers(packet);
  const assessments: System1ReactionAssessment[] = [];

  for (const rule of RULES) {
    const trigger = active.get(rule.id);
    if (!trigger || (rule.opposite && active.has(rule.opposite))) continue;

    for (const [monitorId, instrument, expected] of rule.expectations) {
      const move = marketMove(packet, monitorId, trigger);
      if (!move || Math.abs(move.change) < MIN_MATERIAL_MOVE_PCT) continue;

      const observed: Direction = move.change > 0 ? "UP" : "DOWN";
      assessments.push({
        check_id: `system1:${rule.id.toLowerCase()}:${monitorId}`,
        rule_id: rule.id,
        trigger_evidence_id: trigger.evidence_id,
        market_evidence_id: move.evidence.evidence_id,
        instrument,
        expected_direction: expected,
        observed_direction: observed,
        observed_change_pct: move.change,
        timing_precision: move.timingPrecision,
        relation: observed === expected ? "ALIGNED" : "DIVERGENT",
        severity: Math.abs(move.change) >= 1 ? "HIGH" : "MEDIUM",
      });
    }
  }

  return assessments
    .sort(
      (a, b) =>
        Math.abs(b.observed_change_pct) - Math.abs(a.observed_change_pct) ||
        a.check_id.localeCompare(b.check_id),
    )
    .slice(0, MAX_REACTION_ASSESSMENTS);
}

export function buildSystem1DivergenceCandidates(
  packet: DossierV2InputPacket,
): System1DivergenceCandidate[] {
  return buildSystem1ReactionAssessments(packet)
    .filter((assessment) => assessment.relation === "DIVERGENT")
    .slice(0, MAX_CANDIDATES)
    .map(({ relation: _relation, ...candidate }) => candidate);
}
