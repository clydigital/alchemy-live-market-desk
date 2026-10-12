import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { projectPublishedHorizon } from "../lib/presenter-published-horizon.ts";

const NOW = "2026-10-12T10:00:00.000Z";
const CPI = {
  id: "mev_cpi", eventId: "mev_cpi", lane: "economic_calendar",
  title: "Consumer Price Index for September 2026",
  timing: { value: "2026-10-14", label: "08:30 ET", precision: "date" },
  evidenceRefs: ["calendar:us-bls-2026-10-14-cpi-september-2026"],
  sourceName: "U.S. Bureau of Labor Statistics",
  sourceUrl: "https://www.bls.gov/schedule/2026/10_sched_list.htm",
  sourceVerificationState: "official",
  sourceCheckedAt: NOW,
};
const PPI = {
  ...CPI, id: "mev_ppi", eventId: "mev_ppi",
  title: "Producer Price Index for September 2026",
  timing: { value: "2026-10-15", label: "08:30 ET", precision: "date" },
  evidenceRefs: ["calendar:us-bls-2026-10-15-ppi-september-2026"],
};
function edition(overrides: Record<string, unknown> = {}) {
  return {
    id: "exact-edition-1", published_at: "2026-10-12T09:00:00.000Z",
    payload: {
      presenterDossierContext: {
        contractVersion: "presenter-dossier-edition-context/1",
        status: "BOUND",
        dossierId: "11111111-1111-4111-8111-111111111111",
        dossierAsOf: "2026-10-12T08:00:00.000Z",
      },
      journey: {
        contractVersion: "journey-briefing/v1",
        horizon: { today: [], tonight: [], later: [CPI, PPI] },
      },
      ...overrides,
    },
  };
}

test("frozen CPI and PPI carry exact dates, official source provenance, and an edition ID", () => {
  const view = projectPublishedHorizon(edition(), NOW);
  assert.equal(view.status, "AVAILABLE");
  assert.equal(view.editionId, "exact-edition-1");
  assert.deepEqual(view.horizon.later.map(item => item.timing.value), ["2026-10-14", "2026-10-15"]);
  assert.ok(view.horizon.later.every(item =>
    item.sourceVerificationState === "official"
    && item.sourceUrl === "https://www.bls.gov/schedule/2026/10_sched_list.htm"
    && item.evidenceRefs.length > 0
  ));
});

test("reader does not leak past entries, unsourced leads, or unscheduled guesses into future", () => {
  const view = projectPublishedHorizon(edition({
    journey: {
      contractVersion: "journey-briefing/v1",
      horizon: { today: [ { ...CPI, timing: { value: "2026-10-11", label: null, precision: "date" } } ],
        tonight: [{ ...CPI, id: "no-provenance", evidenceRefs: [] }],
        later: [PPI] },
    },
  }), NOW);
  assert.deepEqual(view.horizon.today, []);
  assert.deepEqual(view.horizon.tonight, []);
  assert.deepEqual(view.horizon.later.map(item => item.eventId), ["mev_ppi"]);
});

test("incomplete freeze or missing Dossier identity fails closed", () => {
  assert.equal(projectPublishedHorizon(null, NOW).status, "UNAVAILABLE");
  assert.equal(projectPublishedHorizon(edition({ presenterDossierContext: null }), NOW).status, "UNAVAILABLE");
  assert.equal(projectPublishedHorizon(edition({ journey: { horizon: {} } }), NOW).status, "UNAVAILABLE");
});

test("canonical publisher feeds the same frozen events to upcoming and Journey with provenance", () => {
  const runtime = readFileSync(new URL("../lib/market-event-runtime.ts", import.meta.url), "utf8");
  const compose = readFileSync(new URL("../lib/intelligence/edition.ts", import.meta.url), "utf8");
  const horizon = readFileSync(new URL("../lib/intelligence/journey-briefing.ts", import.meta.url), "utf8");
  const backstop = readFileSync(new URL("../lib/calendar.ts", import.meta.url), "utf8");
  assert.match(runtime, /getEconomicCalendar\(\)/);
  assert.match(runtime, /calendar\.map\(marketEventFromEconomicCalendar\)/);
  assert.match(runtime, /events: allEvents/);
  assert.match(compose, /marketEvents,\s*marketMotion,\s*diagnostics,\s*finalBoard/);
  assert.match(horizon, /sourceUrl: event\.sourceUrl/);
  assert.match(horizon, /sourceCheckedAt: event\.lastVerifiedAt/);
  assert.match(backstop, /us-bls-2026-10-14-cpi-september-2026/);
  assert.match(backstop, /us-bls-2026-10-15-ppi-september-2026/);
});
