import type { EconomicCalendarEvent } from "@/lib/calendar";
import type { IntakeItemInput } from "@/lib/research-update";

const PRIORITY_RELEASE = /nonfarm|payroll|employment situation|unemployment|average hourly|consumer price|\bcpi\b|producer price|\bppi\b|personal consumption|\bpce\b|fomc|rate decision|monetary.policy|gross domestic|\bgdp\b|retail sales|\bism\b|\bpmi\b|jolts|adp|jobless claims/i;
const TOP_TIER_RELEASE = /nonfarm|payroll|employment situation|consumer price|\bcpi\b|fomc|rate decision|monetary.policy/i;

function dayDistance(date: string, anchor: Date) {
  const anchorDay = Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate());
  const eventDay = Date.parse(`${date}T00:00:00Z`);
  return Math.round((eventDay - anchorDay) / 86_400_000);
}

function numericValue(value: string | null) {
  if (!value) return null;
  const match = value.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function surpriseText(event: EconomicCalendarEvent) {
  const actual = numericValue(event.actual);
  const consensus = numericValue(event.consensus);
  if (actual === null || consensus === null) return undefined;
  const difference = actual - consensus;
  if (difference === 0) return "Actual matched consensus.";
  return `Actual was ${Math.abs(difference).toLocaleString("en-GB")} ${difference > 0 ? "above" : "below"} consensus on the reported scale.`;
}

function releaseSummary(event: EconomicCalendarEvent) {
  const values = [
    `Actual: ${event.actual || "awaiting release"}`,
    `Consensus: ${event.consensus || "not loaded"}`,
    `Alchemy expectation: ${event.alchemyExpectation || "not recorded"}`,
    `Previous: ${event.previous || "not loaded"}`,
  ].join(" · ");
  return `${event.status} high-impact ${event.category.toLowerCase()} event scheduled for ${event.date} at ${event.timeLabel}. ${values}. Desk question: ${event.decidingQuestion}`;
}

function eventMateriality(event: EconomicCalendarEvent) {
  if (TOP_TIER_RELEASE.test(event.event)) return 100;
  if (PRIORITY_RELEASE.test(event.event)) return 94;
  if (event.category === "Central bank") return 98;
  return 88;
}

function scheduledRelevance(event: EconomicCalendarEvent) {
  if (TOP_TIER_RELEASE.test(event.event)) return 82;
  if (event.category === "Central bank") return 78;
  return 72;
}

function scheduledMateriality(event: EconomicCalendarEvent) {
  if (TOP_TIER_RELEASE.test(event.event)) return 84;
  if (event.category === "Central bank") return 80;
  return 74;
}

export function buildHighImpactCalendarIntake(
  events: EconomicCalendarEvent[],
  anchor = new Date(),
): IntakeItemInput[] {
  return events
    .filter((event) => event.impact === "High")
    .filter((event) => {
      const distance = dayDistance(event.date, anchor);
      return distance >= -2 && distance <= 8;
    })
    .filter((event) => PRIORITY_RELEASE.test(event.event) || event.category === "Central bank")
    .map((event) => {
      const surprise = surpriseText(event);
      const released = event.status === "Released";
      return {
        itemKey: `calendar:${event.id}`,
        itemType: "news" as const,
        publisher: event.sourceName,
        externalId: event.id,
        title: `${event.event} · ${event.status}`,
        url: event.sourceUrl,
        publishedAt: `${event.date}T12:00:00.000Z`,
        summary: releaseSummary(event),
        affectedStorySlugs: [],
        sourceQuality: event.sourceKind === "desk-record" ? 92 : 100,
        relevance: released ? (TOP_TIER_RELEASE.test(event.event) ? 100 : 94) : scheduledRelevance(event),
        novelty: released ? 94 : 20,
        materiality: released ? eventMateriality(event) : scheduledMateriality(event),
        // Unreleased calendar entries belong to Event Horizon/Ahead. Marking them
        // ignore here prevents a known schedule from masquerading as fresh
        // canonical evidence or becoming a current Story before anything happened.
        recommendedAction: released ? "collect_evidence" as const : "ignore" as const,
        statsSignal: [
          `${event.event}: ${event.status}`,
          `Actual ${event.actual || "awaiting"}`,
          `Consensus ${event.consensus || "not loaded"}`,
          `Alchemy expectation ${event.alchemyExpectation || "not recorded"}`,
          `Previous ${event.previous || "not loaded"}`,
          surprise,
        ].filter(Boolean).join(" · "),
        newsSignal: `${event.country} · ${event.category} · ${event.timeLabel} · ${event.affectedAssets.join(", ")}`,
        divergenceKind: surprise ? "stats_lead" as const : "none" as const,
        divergenceNote: surprise,
        evidence: [{
          title: event.event,
          url: event.sourceUrl,
          publisher: event.sourceName,
          publishedAt: `${event.date}T12:00:00.000Z`,
          claim: event.status === "Released"
            ? `Official release record for ${event.event}, including the latest actual, consensus, separate Alchemy expectation and previous values available to the desk.`
            : `Official schedule for the upcoming high-impact ${event.event} release.`,
        }],
        reviewReason: released
          ? "Check the headline, revisions, components and cross-asset reaction before updating an existing Story or opening a new one."
          : "Ahead only: prepare the pre-release decision tree and affected assets, but do not create current canonical evidence until the release or a material pre-event repricing occurs.",
      };
    });
}
