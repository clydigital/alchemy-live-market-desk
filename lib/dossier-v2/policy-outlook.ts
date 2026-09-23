import type { DossierV2InputPacket, ObservedEvidence } from "./input-packet.ts";
import { buildSystem1PolicyExpectationChecks } from "./system1-divergence.ts";

export type DossierPolicyOutlookItem = {
  id: string;
  ruleId: string;
  trigger: string;
  triggerEvidenceRef: string;
  triggerMetrics: {
    observed: number | null;
    expected: number | null;
    previous: number | null;
    unit: string | null;
  };
  policyImpulse: "HAWKISH" | "DOVISH";
  nextMeetingRateOutlook: "MORE_HAWKISH" | "MORE_DOVISH";
  fedWatchExpectedDirection: "HIKE_ODDS_UP" | "HIKE_ODDS_DOWN";
  observedRatePricing: string | null;
  observedRatePricingEvidenceRef: string | null;
  expectedMarketReactions: Array<{ instrument: string; direction: "UP" | "DOWN" }>;
  observedConfirmation: string | null;
  observedConfirmationEvidenceRef: string | null;
  gaps: string[];
};

function metricString(item: ObservedEvidence | undefined, key: string) {
  const value = item?.metrics?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function metricNumber(item: ObservedEvidence | undefined, key: string) {
  const value = item?.metrics?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function policyEvidence(packet: DossierV2InputPacket): ObservedEvidence[] {
  const merged = [
    ...(packet.rate_context?.evidence ?? []),
    ...packet.observed_evidence,
  ];
  return [...new Map(merged.map((item) => [item.evidence_id, item])).values()];
}

function matchingEvidence(
  packet: DossierV2InputPacket,
  kind: "rate_expectation" | "market_reaction",
  context: string,
  trigger: ObservedEvidence,
) {
  return policyEvidence(packet)
    .filter((item) =>
      item.evidence_id !== trigger.evidence_id &&
      metricString(item, "signal_kind") === kind &&
      metricString(item, "signal_context") === context &&
      item.available_at >= trigger.available_at)
    .sort((a, b) => b.available_at.localeCompare(a.available_at))[0] ?? null;
}

export function buildDossierPolicyOutlook(packet: DossierV2InputPacket): DossierPolicyOutlookItem[] {
  const evidence = new Map(policyEvidence(packet).map((item) => [item.evidence_id, item]));

  return buildSystem1PolicyExpectationChecks(packet).flatMap((check) => {
    const trigger = evidence.get(check.trigger_evidence_id);
    if (!trigger) return [];

    const ratePricing = matchingEvidence(packet, "rate_expectation", check.rule_id, trigger);
    const marketReaction = matchingEvidence(packet, "market_reaction", check.rule_id, trigger);
    const rateObserved = metricNumber(ratePricing, "observed_value");
    const rateUnit = metricString(ratePricing, "measurement_unit");
    const gaps: string[] = [];
    if (!ratePricing) gaps.push("Post-trigger FedWatch/fed-funds probability is not yet present in canonical evidence.");
    if (!marketReaction) gaps.push("Post-trigger cross-asset reaction confirmation is not yet present in canonical evidence.");

    return [{
      id: check.check_id,
      ruleId: check.rule_id,
      trigger: trigger.claim_or_fact,
      triggerEvidenceRef: trigger.evidence_id,
      triggerMetrics: {
        observed: metricNumber(trigger, "observed_value"),
        expected: metricNumber(trigger, "expected_value"),
        previous: metricNumber(trigger, "previous_value"),
        unit: metricString(trigger, "measurement_unit"),
      },
      policyImpulse: check.policy_impulse,
      nextMeetingRateOutlook: check.next_meeting_rate_outlook,
      fedWatchExpectedDirection: check.fedwatch_expectation,
      observedRatePricing: ratePricing
        ? rateObserved !== null
          ? `${rateObserved}${rateUnit === "percent" ? "%" : rateUnit ? ` ${rateUnit}` : ""} — ${ratePricing.claim_or_fact}`
          : ratePricing.claim_or_fact
        : null,
      observedRatePricingEvidenceRef: ratePricing?.evidence_id ?? null,
      expectedMarketReactions: check.expected_market_reactions.map((item) => ({
        instrument: item.instrument,
        direction: item.expected_direction,
      })),
      observedConfirmation: marketReaction?.claim_or_fact ?? null,
      observedConfirmationEvidenceRef: marketReaction?.evidence_id ?? null,
      gaps,
    }];
  });
}
