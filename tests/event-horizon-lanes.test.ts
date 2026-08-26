import assert from "node:assert/strict";
import test from "node:test";

import { eventHorizonUpcomingLane } from "../lib/event-horizon-lanes.ts";

test("routes policy and conference events to the economic calendar", () => {
  assert.equal(eventHorizonUpcomingLane("central_bank_speech"), "economicCalendar");
  assert.equal(eventHorizonUpcomingLane("conference_or_symposium"), "economicCalendar");
  assert.equal(eventHorizonUpcomingLane("treasury_or_fiscal_event"), "economicCalendar");
});

test("keeps actual geopolitical, sanctions, energy-policy and legal events in the geopolitical clock", () => {
  assert.equal(eventHorizonUpcomingLane("geopolitical_meeting"), "geopoliticalClock");
  assert.equal(eventHorizonUpcomingLane("sanctions_or_policy_deadline"), "geopoliticalClock");
  assert.equal(eventHorizonUpcomingLane("energy_policy_meeting"), "geopoliticalClock");
  assert.equal(eventHorizonUpcomingLane("regulatory_or_legal_event"), "geopoliticalClock");
});

test("does not duplicate event families already owned by existing recap lanes", () => {
  assert.equal(eventHorizonUpcomingLane("economic_release"), null);
  assert.equal(eventHorizonUpcomingLane("central_bank_decision"), null);
  assert.equal(eventHorizonUpcomingLane("earnings"), "earnings");
  assert.equal(eventHorizonUpcomingLane("other_verified_market_event"), null);
});
