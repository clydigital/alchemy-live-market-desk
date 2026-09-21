import type { DossierV2InputPacket, ObservedEvidence } from "./input-packet.ts";

export type System1Direction = "UP" | "DOWN";
export type System1CheckStatus =
  | "CONFIRMED"
  | "DIVERGED"
  | "INSUFFICIENT_DATA";

export type System1Severity = "LOW" | "MEDIUM" | "HIGH";

export interface System1RelationshipCheck {
  check_id: string;
  rule_id: string;
  rule_label: string;
  trigger_evidence_id: string;
  trigger_summary: string;
  instrument: string;
  expected_direction: System1Direction;
  observed_direction: System1Direction | null;
  observed_change_pct: number | null;
  market_evidence_id: string | null;
  status: System1CheckStatus;
  severity: System1Severity;
}

export interface System1DivergenceCandidate {
  check_id: string;
  rule_id: string;
  trigger_evidence_id: string;
  market_evidence_id: string;
  instrument: string;
  expected_direction: System1Direction;
  observed_direction: System1Direction;
  observed_change_pct: number;
  severity: Exclude<System1Severity, "LOW">;
}

type RelationshipExpectation = {
  monitorId: string;
  instrument: string;
  direction: System1Direction;
};

type RelationshipRule = {
  id: string;
  label: string;
  patterns: RegExp[];
  expectations: RelationshipExpectation[];
  oppositeRuleId?: string;
};

const MIN_ABS_MOVE_PCT = 0.05;
const MAX_DIVERGENCE_CANDIDATES = 5;

const RELATIONSHIP_RULES: RelationshipRule[] = [
  {
    id: "HAWKISH_MONETARY_POLICY",
    label: "Hawkish monetary-policy signal",
    patterns: [
      /\bhawkish\b/i,
      /\brate hike\b/i,
      /\bhiked (?:the )?(?:policy )?rate/i,
      /\braised (?:the )?(?:policy )?rate/i,
      /\bhigher for longer\b/i,
      /\btightening bias\b/i,
    ],
    expectations: [
      { monitorId: "us2y", instrument: "US02Y", direction: "UP" },
      { monitorId: "dxy", instrument: "DXY", direction: "UP" },
      { monitorId: "gold", instrument: "XAUUSD", direction: "DOWN" },
      { monitorId: "smh", instrument: "SMH", direction: "DOWN" },
    ],
    oppositeRuleId: "DOVISH_MONETARY_POLICY",
  },
  {
    id: "DOVISH_MONETARY_POLICY",
    label: "Dovish monetary-policy signal",
    patterns: [
      /\bdovish\b/i,
      /\brate cut\b/i,
      /\bcut (?:the )?(?:policy )?rate/i,
      /\beasing bias\b/i,
      /\blower rates\b/i,
    ],
    expectations: [
      { monitorId: "us2y", instrument: "US02Y", direction: "DOWN" },
      { monitorId: "dxy", instrument: "DXY", direction: "DOWN" },
      { monitorId: "gold", instrument: "XAUUSD", direction: "UP" },
      { monitorId: "smh", instrument: "SMH", direction: "UP" },
    ],
    oppositeRuleId: "HAWKISH_MONETARY_POLICY",
  },
  {
    id: "HOT_INFLATION_SURPRISE",
    label: "Hot inflation signal",
    patterns: [
      /\b(?:cpi|ppi|inflation)\b.{0,80}\b(?:above|hotter than|higher than) (?:consensus|forecast|expected|expectations)\b/i,
      /\bhotter than expected\b/i,
      /\binflation (?:re-)?accelerat(?:ed|es|ing)\b/i,
    ],
    expectations: [
      { monitorId: "us2y", instrument: "US02Y", direction: "UP" },
      { monitorId: "dxy", instrument: "DXY", direction: "UP" },
      { monitorId: "gold", instrument: "XAUUSD", direction: "DOWN" },
      { monitorId: "smh", instrument: "SMH", direction: "DOWN" },
    ],
    oppositeRuleId: "SOFT_INFLATION_SURPRISE",
  },
  {
    id: "SOFT_INFLATION_SURPRISE",
    label: "Soft inflation signal",
    patterns: [
      /\b(?:cpi|ppi|inflation)\b.{0,80}\b(?:below|cooler than|lower than) (?:consensus|forecast|expected|expectations)\b/i,
      /\bcooler than expected\b/i,
      /\bdisinflation\b/i,
      /\binflation (?:eased|cooled|decelerated)\b/i,
    ],
    expectations: [
      { monitorId: "us2y", instrument: "US02Y", direction: "DOWN" },
      { monitorId: "dxy", instrument: "DXY", direction: "DOWN" },
      { monitorId: "gold", instrument: "XAUUSD", direction: "UP" },
      { monitorId: "smh", instrument: "SMH", direction: "UP" },
    ],
    oppositeRuleId: "HOT_INFLATION_SURPRISE",
  },
  {
    id: "ENERGY_SUPPLY_STRESS",
    label: "Energy supply-stress signal",
    patterns: [
      /\boil supply disruption\b/i,
      /\bshipping disruption\b/i,
      /\brefinery outage\b/i,
      /\bstrait of hormuz\b/i,
      /\bred sea\b.{0,80}\b(?:shipping|tanker|oil|energy)\b/i,
      /\b(?:oil|energy)\b.{0,80}\bgeopolitical escalation\b/i,
    ],
    expectations: [
      { monitorId: "wti", instrument: "WTI", direction: "UP" },
      { monitorId: "distillate", instrument: "ULSD", direction: "UP" },
      { monitorId: "crack-distillate", instrument: "ULSD_CRACK", direction: "UP" },
    ],
  },
];

function numberMetric(
  evidence: ObservedEvidence | undefined,
  key: string,
): number | null {
  const raw = evidence?.metrics?.[key];
  return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
}

function severityForMove(absMovePct: number): System1Severity {
  if (absMovePct >= 1) return "HIGH";
  if (absMovePct >= 0.25) return "MEDIUM";
  return "LOW";
}

function directionForMove(changePct: number | null): System1Direction | null {
  if (changePct === null || Math.abs(changePct) < MIN_ABS_MOVE_PCT) return null;
  return changePct > 0 ? "UP" : "DOWN";
}

function triggerEvidenceForRule(
  packet: DossierV2InputPacket,
  rule: RelationshipRule,
): ObservedEvidence | null {
  const matches = packet.observed_evidence
    .filter((evidence) => evidence.source_type !== "MARKET_DATA")
    .filter((evidence) =>
      rule.patterns.some((pattern) => pattern.test(evidence.claim_or_fact)),
    )
    .sort(
      (a, b) =>
        b.available_at.localeCompare(a.available_at) ||
        a.evidence_id.localeCompare(b.evidence_id),
    );

  return matches[0] ?? null;
}

function marketEvidenceForMonitor(
  packet: DossierV2InputPacket,
  monitorId: string,
): ObservedEvidence | null {
  const cluster = packet.development_clusters.find(
    (item) => item.grouping_key === `market-monitor:${monitorId}`,
  );
  if (!cluster) return null;

  const candidates = cluster.evidence
    .filter((evidence) => evidence.source_type === "MARKET_DATA")
    .filter((evidence) => numberMetric(evidence, "day_change_pct") !== null)
    .sort(
      (a, b) =>
        b.available_at.localeCompare(a.available_at) ||
        a.evidence_id.localeCompare(b.evidence_id),
    );

  return candidates[0] ?? null;
}

function activeRuleTriggers(packet: DossierV2InputPacket) {
  return new Map(
    RELATIONSHIP_RULES.flatMap((rule) => {
      const evidence = triggerEvidenceForRule(packet, rule);
      return evidence ? [[rule.id, evidence] as const] : [];
    }),
  );
}

export function runSystem1RelationshipChecks(
  packet: DossierV2InputPacket,
): System1RelationshipCheck[] {
  const triggers = activeRuleTriggers(packet);
  const checks: System1RelationshipCheck[] = [];

  for (const rule of RELATIONSHIP_RULES) {
    const trigger = triggers.get(rule.id);
    if (!trigger) continue;

    // If the same packet contains an explicit opposing policy/surprise signal,
    // System 1 does not force a directional baseline. System 2 can interpret it.
    if (rule.oppositeRuleId && triggers.has(rule.oppositeRuleId)) {
      continue;
    }

    for (const expectation of rule.expectations) {
      const marketEvidence = marketEvidenceForMonitor(packet, expectation.monitorId);
      const observedChangePct = numberMetric(marketEvidence ?? undefined, "day_change_pct");
      const observedDirection = directionForMove(observedChangePct);
      const status: System1CheckStatus =
        observedDirection === null
          ? "INSUFFICIENT_DATA"
          : observedDirection === expectation.direction
            ? "CONFIRMED"
            : "DIVERGED";
      const severity =
        observedChangePct === null
          ? "LOW"
          : severityForMove(Math.abs(observedChangePct));

      checks.push({
        check_id: `system1:${rule.id.toLowerCase()}:${expectation.monitorId}`,
        rule_id: rule.id,
        rule_label: rule.label,
        trigger_evidence_id: trigger.evidence_id,
        trigger_summary: trigger.claim_or_fact.slice(0, 240),
        instrument: expectation.instrument,
        expected_direction: expectation.direction,
        observed_direction: observedDirection,
        observed_change_pct: observedChangePct,
        market_evidence_id: marketEvidence?.evidence_id ?? null,
        status,
        severity,
      });
    }
  }

  return checks.sort(
    (a, b) =>
      a.rule_id.localeCompare(b.rule_id) ||
      a.instrument.localeCompare(b.instrument),
  );
}

export function buildSystem1DivergenceCandidates(
  packet: DossierV2InputPacket,
): System1DivergenceCandidate[] {
  return runSystem1RelationshipChecks(packet)
    .filter(
      (check): check is System1RelationshipCheck & {
        observed_direction: System1Direction;
        observed_change_pct: number;
        market_evidence_id: string;
        severity: Exclude<System1Severity, "LOW">;
      } =>
        check.status === "DIVERGED" &&
        check.observed_direction !== null &&
        check.observed_change_pct !== null &&
        check.market_evidence_id !== null &&
        check.severity !== "LOW",
    )
    .sort(
      (a, b) =>
        Math.abs(b.observed_change_pct) - Math.abs(a.observed_change_pct) ||
        a.check_id.localeCompare(b.check_id),
    )
    .slice(0, MAX_DIVERGENCE_CANDIDATES)
    .map((check) => ({
      check_id: check.check_id,
      rule_id: check.rule_id,
      trigger_evidence_id: check.trigger_evidence_id,
      market_evidence_id: check.market_evidence_id,
      instrument: check.instrument,
      expected_direction: check.expected_direction,
      observed_direction: check.observed_direction,
      observed_change_pct: check.observed_change_pct,
      severity: check.severity,
    }));
}
