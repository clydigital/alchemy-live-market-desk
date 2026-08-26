import type { MarketEventType } from "./market-events";

export type EventHorizonUpcomingLane = "economicCalendar" | "earnings" | "geopoliticalClock" | null;

export function eventHorizonUpcomingLane(eventType: MarketEventType): EventHorizonUpcomingLane {
  switch (eventType) {
    case "central_bank_speech":
    case "conference_or_symposium":
    case "treasury_or_fiscal_event":
      return "economicCalendar";
    case "earnings":
      return "earnings";
    case "geopolitical_meeting":
    case "sanctions_or_policy_deadline":
    case "energy_policy_meeting":
    case "regulatory_or_legal_event":
      return "geopoliticalClock";
    case "economic_release":
    case "central_bank_decision":
    case "other_verified_market_event":
    default:
      return null;
  }
}
