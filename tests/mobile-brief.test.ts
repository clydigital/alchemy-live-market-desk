import assert from "node:assert/strict";
import test from "node:test";
import {
  dossierWarnings,
  evidenceCount,
  formatBriefDate,
  formatMarketChange,
  formatMarketLast,
  formatObservationDate,
  formatObservationLabel,
  formatSourceName,
  getMobileBriefStatus,
  getSectionState,
  loadMobileSnapshot,
  sanitizeSourceUrl,
  snapshotHealth,
  snapshotRows,
  snapshotStories,
  validateSnapshot,
} from "../app/mobile-brief/logic.ts";

const AS_OF = "2026-10-09T08:00:00.000Z";
const RETRIEVED = "2026-10-09T11:00:00.000Z";

function fixture() {
  return {
    contractVersion: "market-intelligence-snapshot/v1",
    generatedAt: "2026-10-09T09:00:00.000Z",
    dossier: { status: "current", dossierId: "dossier-canonical-1", asOf: AS_OF, degraded: false },
    regime: {
      headline: "US borrowing costs remain high",
      answer: "Borrowing remains expensive.",
      regimeImplication: "Stocks with future-dated earnings remain sensitive.",
      rateRegime: { state: "HAWKISH" },
      whatWouldChangeMind: "A sustained decline in real yields.",
    },
    monetarySignals: { summary: "Signals disagree.", confirming: [], contradicting: ["CREDIT"], unresolved: ["LIQUIDITY"] },
    marketState: {
      selectedRows: [{
        id: "dxy", symbol: "DXY", label: "US Dollar Index", last: 101.3, change5d: 0.45,
        asOf: "2026-10-08", sourceName: "Fixture", sourceUrl: "https://example.test",
      }],
    },
    stories: [{
      id: "dossier-story", persistentStoryId: "persistent-uuid", title: "Funding costs",
      epistemicLabel: "UNRESOLVED", whatChanged: "Yields rose.",
      whyItMatters: "Borrowing costs rise for businesses.",
      mechanism: "Higher yields can affect valuations.",
      conclusion: "The equity reaction remains uncertain.",
      whatWouldChangeMind: "A lasting decline in yields.",
      evidenceRefs: ["evidence-uuid-1"],
    }],
    contradictions: [{ id: "c1", title: "Credit diverges", detail: "Spreads remain narrow." }],
    researchGaps: ["Check the next auction"],
    guardrails: ["Market Motion is not canonical evidence"],
    sourceHealth: { dossier: "OK", marketMonitor: "PARTIAL" },
  };
}

const FIRST_LOAD = { snapshot: null, requestedAt: null, error: null };

function response(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

test("valid v1 snapshot is returned unchanged; Dossier, generation, and observation clocks remain distinct", () => {
  const input = fixture();
  const result = validateSnapshot(input);
  assert.strictEqual(result, input);
  assert.equal(result.dossier?.asOf, AS_OF);
  assert.equal(result.generatedAt, "2026-10-09T09:00:00.000Z");
  assert.equal(result.marketState?.selectedRows[0].asOf, "2026-10-08");
});

test("rejects unsupported contracts, absent canonical identifiers, or malformed Dossier times", () => {
  const baseline = fixture();
  const invalid = [
    null, {}, [], 123,
    { ...baseline, contractVersion: "market-intelligence-snapshot/v2" },
    { ...baseline, dossier: null },
    { ...baseline, dossier: { ...baseline.dossier, dossierId: "" } },
    { ...baseline, dossier: { ...baseline.dossier, dossierId: "   " } },
    { ...baseline, dossier: { ...baseline.dossier, asOf: "" } },
    { ...baseline, dossier: { ...baseline.dossier, asOf: "not-a-date" } },
    { ...baseline, regime: null },
    { ...baseline, regime: { ...baseline.regime, headline: "" } },
  ];
  for (const value of invalid) {
    assert.throws(() => validateSnapshot(value), /Incomplete or malformed snapshot contract/);
  }
});

test("rejects malformed section container types and incompatible entry payloads in validateSnapshot", () => {
  const baseline = fixture();
  const malformedPayloads = [
    { ...baseline, contradictions: {} },
    { ...baseline, contradictions: "none" },
    { ...baseline, contradictions: [null] },
    { ...baseline, contradictions: [{ id: "1", title: "T", detail: 123 }] },
    { ...baseline, stories: "text" },
    { ...baseline, stories: {} },
    { ...baseline, stories: [null] },
    { ...baseline, stories: [{ id: "s1", title: 123 }] },
    { ...baseline, stories: [{ id: "s1", title: "Title", evidenceRefs: {} }] },
    { ...baseline, stories: [{ id: "s1", title: "Title", evidenceRefs: [123] }] },
    { ...baseline, researchGaps: "none" },
    { ...baseline, researchGaps: {} },
    { ...baseline, researchGaps: [null] },
    { ...baseline, researchGaps: ["valid", 123] },
    { ...baseline, guardrails: "none" },
    { ...baseline, guardrails: [123] },
    { ...baseline, monetarySignals: "signals" },
    { ...baseline, monetarySignals: { summary: 123 } },
    { ...baseline, monetarySignals: { contradicting: "none" } },
    { ...baseline, monetarySignals: { contradicting: [null] } },
    { ...baseline, monetarySignals: { unresolved: {} } },
    { ...baseline, sourceHealth: "healthy" },
    { ...baseline, sourceHealth: [["dossier", "OK"]] },
    { ...baseline, sourceHealth: 123 },
    { ...baseline, sourceHealth: { dossier: null } },
    { ...baseline, sourceHealth: { dossier: 123 } },
    { ...baseline, sourceHealth: { dossier: "" } },
    { ...baseline, sourceHealth: { dossier: "   " } },
    { ...baseline, sourceHealth: { "": "OK" } },
    { ...baseline, sourceHealth: { "  ": "OK" } },
    { ...baseline, sourceHealth: { dossier: { state: "OK" } } },
  ];
  for (const invalidPayload of malformedPayloads) {
    assert.throws(() => validateSnapshot(invalidPayload), /Incomplete or malformed snapshot contract/);
  }
});

test("accepts omitted or explicitly empty section containers without throwing", () => {
  const baseline = fixture();
  const omittedSections = validateSnapshot({
    ...baseline,
    stories: undefined,
    contradictions: null,
    researchGaps: undefined,
    guardrails: null,
    monetarySignals: undefined,
    sourceHealth: undefined,
  });
  assert.equal(omittedSections.stories, undefined);
  assert.equal(omittedSections.contradictions, null);
  assert.equal(omittedSections.sourceHealth, undefined);

  const emptySections = validateSnapshot({
    ...baseline,
    stories: [],
    contradictions: [],
    researchGaps: [],
    guardrails: [],
    monetarySignals: { summary: "", confirming: [], contradicting: [], unresolved: [] },
    sourceHealth: {},
  });
  assert.deepEqual(emptySections.stories, []);
  assert.deepEqual(emptySections.contradictions, []);
  assert.deepEqual(emptySections.researchGaps, []);
  assert.deepEqual(emptySections.guardrails, []);
  assert.deepEqual(emptySections.monetarySignals?.contradicting, []);
  assert.deepEqual(emptySections.sourceHealth, {});
});

test("getSectionState distinguishes omitted, empty and non-empty sections", () => {
  assert.deepEqual(getSectionState(undefined), { status: "not_supplied" });
  assert.deepEqual(getSectionState(null), { status: "not_supplied" });
  assert.deepEqual(getSectionState([]), { status: "empty" });
  assert.deepEqual(getSectionState(["entry"]), { status: "has_entries", items: ["entry"] });
});

test("a successful GET stores only the validated snapshot and current retrieval time", async () => {
  let requested = 0;
  const result = await loadMobileSnapshot(FIRST_LOAD, async () => {
    requested += 1;
    return response(fixture());
  }, () => RETRIEVED);
  assert.equal(requested, 1);
  assert.equal(result.error, null);
  assert.equal(result.requestedAt, RETRIEVED);
  assert.equal(result.snapshot?.dossier?.dossierId, "dossier-canonical-1");
  assert.equal(result.snapshot?.stories?.[0].conclusion, "The equity reaction remains uncertain.");
});

test("first-load 503 produces no invented assessment or MacroPulse fallback", async () => {
  const result = await loadMobileSnapshot(FIRST_LOAD, async () => response(null, 503));
  assert.equal(result.snapshot, null);
  assert.equal(result.requestedAt, null);
  assert.equal(result.error, "No usable Dossier presentation is available.");
  assert.deepEqual(Object.keys(result).sort(), ["error", "requestedAt", "snapshot"]);
});

test("failed refresh preserves the exact last verified in-session snapshot and retrieval clock", async () => {
  const previous = { snapshot: validateSnapshot(fixture()), requestedAt: RETRIEVED, error: null };
  const failed = await loadMobileSnapshot(previous, async () => response({ error: "unavailable" }, 503));
  assert.strictEqual(failed.snapshot, previous.snapshot);
  assert.equal(failed.requestedAt, RETRIEVED);
  assert.match(failed.error ?? "", /No usable Dossier presentation/);

  const malformed = await loadMobileSnapshot(previous, async () => response({ contractVersion: "invalid" }));
  assert.strictEqual(malformed.snapshot, previous.snapshot);
  assert.equal(malformed.requestedAt, RETRIEVED);
  assert.match(malformed.error ?? "", /Incomplete or malformed/);

  const offline = await loadMobileSnapshot(previous, async () => { throw new Error("Network unavailable"); });
  assert.strictEqual(offline.snapshot, previous.snapshot);
  assert.equal(offline.error, "Network unavailable");

  const non503 = await loadMobileSnapshot(previous, async () => response({}, 502));
  assert.equal(non503.error, "Snapshot unavailable (HTTP 502).");
});

test("missing or non-finite market values never become fabricated prices or percentages", () => {
  for (const value of [null, undefined, NaN, Infinity, -Infinity, "42"]) {
    assert.equal(formatMarketLast(value), "n/a");
    assert.equal(formatMarketChange(value), "n/a");
  }
  assert.equal(formatMarketLast(0), "0");
  assert.equal(formatMarketChange(-2.5), "-2.50%");
  assert.equal(formatMarketChange(0), "0.00%");
});

test("missing or malformed observation times are unknown, not falsely fresh", () => {
  assert.equal(formatObservationDate(undefined), "unknown");
  assert.equal(formatObservationDate(null), "unknown");
  assert.equal(formatObservationDate("invalid"), "unknown");
  assert.equal(formatObservationDate("2026-10-08"), "2026-10-08");
  assert.equal(formatBriefDate("invalid"), "Unknown");
  assert.equal(formatBriefDate(null), "Unknown");
  assert.match(formatBriefDate(AS_OF), /Oct 2026/);
});

test("fixed clock distinguishes current, stale and degraded Dossiers without touching source freshness", () => {
  const current = validateSnapshot(fixture());
  assert.deepEqual(dossierWarnings(current, Date.parse("2026-10-10T07:00:00Z")), { stale: false, degraded: false });
  assert.deepEqual(dossierWarnings(current, Date.parse("2026-10-10T09:00:00Z")), { stale: true, degraded: false });
  const flagged = { ...fixture(), dossier: { ...fixture().dossier, degraded: true } };
  assert.deepEqual(dossierWarnings(validateSnapshot(flagged), Date.parse(AS_OF)), { stale: false, degraded: true });
  for (const status of ["fallback_previous_healthy", "degraded_latest", "unavailable"]) {
    const input = { ...fixture(), dossier: { ...fixture().dossier, status } };
    assert.equal(dossierWarnings(validateSnapshot(input), Date.parse(AS_OF)).degraded, true);
  }
  assert.equal(current.marketState?.selectedRows[0].asOf, "2026-10-08");
});

test("missing market rows and Stories yield empty lists, while absent health is not_supplied", () => {
  const data = validateSnapshot({ ...fixture(), marketState: undefined, stories: undefined, sourceHealth: undefined });
  assert.deepEqual(snapshotRows(data), []);
  assert.deepEqual(snapshotStories(data), []);
  assert.deepEqual(snapshotHealth(data), { status: "not_supplied" });
  const nullSubfields = validateSnapshot({ ...fixture(), marketState: { selectedRows: null as unknown as [] }, stories: undefined, sourceHealth: null });
  assert.deepEqual(snapshotRows(nullSubfields), []);
  assert.deepEqual(snapshotStories(nullSubfields), []);
  assert.deepEqual(snapshotHealth(nullSubfields), { status: "not_supplied" });
});

test("canonical Story assertions are passed through unchanged, including uncertainty", () => {
  const data = validateSnapshot(fixture());
  const [story] = snapshotStories(data);
  assert.equal(story.whatChanged, "Yields rose.");
  assert.equal(story.whyItMatters, "Borrowing costs rise for businesses.");
  assert.equal(story.mechanism, "Higher yields can affect valuations.");
  assert.equal(story.conclusion, "The equity reaction remains uncertain.");
  assert.equal(story.whatWouldChangeMind, "A lasting decline in yields.");
  assert.equal(story.persistentStoryId, "persistent-uuid");
  assert.equal(evidenceCount(story.evidenceRefs), "1");
  assert.equal(data.contradictions?.[0].detail, "Spreads remain narrow.");
});

test("absent provenance is not misrepresented as zero canonical evidence", () => {
  assert.equal(evidenceCount(undefined), "not supplied");
  assert.equal(evidenceCount(null), "not supplied");
  assert.equal(evidenceCount([]), "0");
  const noLinks = validateSnapshot({ ...fixture(), stories: [{ ...fixture().stories[0], persistentStoryId: null, evidenceRefs: undefined }] });
  const [story] = snapshotStories(noLinks);
  assert.equal(story.persistentStoryId, null);
  assert.equal(evidenceCount(story.evidenceRefs), "not supplied");
});

test("snapshotHealth distinguishes absent/null, empty, and populated provider health records", () => {
  const absentData = validateSnapshot({ ...fixture(), sourceHealth: undefined });
  assert.deepEqual(snapshotHealth(absentData), { status: "not_supplied" });

  const nullData = validateSnapshot({ ...fixture(), sourceHealth: null });
  assert.deepEqual(snapshotHealth(nullData), { status: "not_supplied" });

  const emptyData = validateSnapshot({ ...fixture(), sourceHealth: {} });
  assert.deepEqual(snapshotHealth(emptyData), { status: "empty" });

  const populatedData = validateSnapshot(fixture());
  assert.deepEqual(snapshotHealth(populatedData), {
    status: "has_entries",
    items: [["dossier", "OK"], ["marketMonitor", "PARTIAL"]],
  });
});

test("failed refresh with malformed provider health preserves in-session snapshot and signals error", async () => {
  const previous = { snapshot: validateSnapshot(fixture()), requestedAt: RETRIEVED, error: null };

  const malformedContainer = await loadMobileSnapshot(previous, async () => response({
    ...fixture(),
    sourceHealth: ["OK"],
  }));
  assert.strictEqual(malformedContainer.snapshot, previous.snapshot);
  assert.equal(malformedContainer.requestedAt, RETRIEVED);
  assert.match(malformedContainer.error ?? "", /Incomplete or malformed snapshot contract/);

  const malformedValue = await loadMobileSnapshot(previous, async () => response({
    ...fixture(),
    sourceHealth: { dossier: null },
  }));
  assert.strictEqual(malformedValue.snapshot, previous.snapshot);
  assert.equal(malformedValue.requestedAt, RETRIEVED);
  assert.match(malformedValue.error ?? "", /Incomplete or malformed snapshot contract/);
});

test("valid source name and HTTPS/HTTP URL are preserved and sanitized safely", () => {
  assert.equal(formatSourceName("FRED US2Y"), "FRED US2Y");
  assert.equal(formatSourceName("  Market Dollar Index  "), "Market Dollar Index");
  assert.equal(sanitizeSourceUrl("https://fred.stlouisfed.org/series/DGS2"), "https://fred.stlouisfed.org/series/DGS2");
  assert.equal(sanitizeSourceUrl("http://example.test/feed"), "http://example.test/feed");
});

test("missing source name displays Source not reported and never fabricates a provider", () => {
  assert.equal(formatSourceName(undefined), "Source not reported");
  assert.equal(formatSourceName(null), "Source not reported");
  assert.equal(formatSourceName(""), "Source not reported");
  assert.equal(formatSourceName("   "), "Source not reported");
});

test("missing, relative, credentialed, or unsafe URLs are suppressed to null for plain text rendering", () => {
  assert.equal(sanitizeSourceUrl(undefined), null);
  assert.equal(sanitizeSourceUrl(null), null);
  assert.equal(sanitizeSourceUrl(""), null);
  assert.equal(sanitizeSourceUrl("   "), null);
  assert.equal(sanitizeSourceUrl("javascript:alert(1)"), null);
  assert.equal(sanitizeSourceUrl("data:text/html,hello"), null);
  assert.equal(sanitizeSourceUrl("file:///etc/passwd"), null);
  assert.equal(sanitizeSourceUrl("ftp://example.com"), null);
  assert.equal(sanitizeSourceUrl("invalid-url"), null);
  assert.equal(sanitizeSourceUrl("/relative/path"), null);
  assert.equal(sanitizeSourceUrl("http://user:pass@example.com/data"), null);
  assert.equal(sanitizeSourceUrl("https://admin@example.com"), null);
});

test("observation date label preserves row's own asOf timestamp and handles missing/malformed inputs", () => {
  assert.equal(formatObservationLabel("2026-10-08"), "Observed: 2026-10-08");
  assert.equal(formatObservationLabel("2026-10-08T12:00:00.000Z"), "Observed: 2026-10-08T12:00:00.000Z");
  assert.equal(formatObservationLabel(undefined), "Observation date unknown");
  assert.equal(formatObservationLabel(null), "Observation date unknown");
  assert.equal(formatObservationLabel("not-a-date"), "Observation date unknown");
});

test("getMobileBriefStatus announces status clearly for first load, success, cached error, and first-load failure", () => {
  const data = validateSnapshot(fixture());

  // First load (loading)
  const loadingFirst = getMobileBriefStatus({ loading: true, snapshot: null, error: null });
  assert.equal(loadingFirst.srStatus, "Loading market intelligence brief…");
  assert.equal(loadingFirst.isAlert, false);

  // First load success
  const loadedFirst = getMobileBriefStatus({ loading: false, snapshot: data, error: null });
  assert.equal(loadedFirst.srStatus, "Market intelligence brief loaded.");
  assert.equal(loadedFirst.isAlert, false);

  // Subsequent refresh (loading)
  const loadingRefresh = getMobileBriefStatus({ loading: true, snapshot: data, error: null, hasRefreshed: true });
  assert.equal(loadingRefresh.srStatus, "Refreshing market intelligence brief…");
  assert.equal(loadingRefresh.isAlert, false);

  // Subsequent refresh success
  const refreshedSuccess = getMobileBriefStatus({ loading: false, snapshot: data, error: null, hasRefreshed: true });
  assert.equal(refreshedSuccess.srStatus, "Brief refreshed.");
  assert.equal(refreshedSuccess.isAlert, false);

  // Cached failure (refresh error when prior snapshot is retained)
  const cachedError = getMobileBriefStatus({
    loading: false,
    snapshot: data,
    error: "No usable Dossier presentation is available.",
    hasRefreshed: true,
  });
  assert.equal(
    cachedError.srStatus,
    "Latest refresh failed. Showing retained snapshot from this browser session, which may be out of date. No usable Dossier presentation is available.",
  );
  assert.equal(cachedError.isAlert, true);

  // Unavailable first load
  const unavailableFirst = getMobileBriefStatus({
    loading: false,
    snapshot: null,
    error: "No usable Dossier presentation is available.",
  });
  assert.equal(unavailableFirst.srStatus, "Live snapshot unavailable. No usable Dossier presentation is available.");
  assert.equal(unavailableFirst.isAlert, true);

  // First load empty state (no snapshot, no error, not loading)
  const emptyState = getMobileBriefStatus({ loading: false, snapshot: null, error: null });
  assert.equal(emptyState.srStatus, "No verified market assessment available.");
  assert.equal(emptyState.isAlert, false);
});
