import assert from "node:assert/strict";
import test from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  augmentCandidateSnapshotWithEia,
  augmentCandidateSnapshotWithMarketMonitor,
  augmentCandidateSnapshotWithTradingEconomics,
  buildCandidateSnapshotFromCanonicalEvidence,
  type CanonicalEvidenceRow,
  type CanonicalSnapshotResult,
} from "../lib/dossier-v2/canonical-snapshot.ts";
import { runManualDossierV2 } from "../lib/dossier-v2/manual-run.ts";
import type { ModelRunner } from "../lib/dossier-v2/research-brain.ts";
import { parseEiaWeeklyPetroleumPayload } from "../lib/providers/eia-v2.ts";
import { parseTradingEconomicsUsCalendarPayload } from "../lib/providers/trading-economics-calendar.ts";

const AS_OF = "2026-09-20T00:00:00.000Z";

function source(overrides: Record<string, unknown> = {}) {
  return {
    id: "source-1",
    ancestry_group_id: "ancestry-1",
    external_source_id: "external-source-1",
    source_name: "Primary Source",
    source_type: "news",
    source_url: "https://example.com",
    source_tier: 1,
    reliability_score: 100,
    provider_key: "research_intake",
    ...overrides,
  };
}

function baseRow(overrides: Partial<CanonicalEvidenceRow>): CanonicalEvidenceRow {
  return {
    id: "row-1",
    external_evidence_id: "external-1",
    claim_text: "Canonical evidence claim.",
    evidence_class: "news_report",
    support_direction: "context",
    available_at: "2026-09-19T20:00:00.000Z",
    received_at: "2026-09-19T20:01:00.000Z",
    freshness_status: "current",
    affected_assets: [],
    affected_topics: [],
    provenance_urls: ["https://example.com/evidence"],
    structured_payload: {},
    source: source(),
    ...overrides,
  };
}

test("Task 9 adapter separates direct evidence, creator leads, and future catalysts", () => {
  const rows: CanonicalEvidenceRow[] = [
    baseRow({
      id: "official",
      external_evidence_id: "ev:official",
      evidence_class: "official_release",
      claim_text: "Official release changed the policy rate.",
      affected_topics: ["monetary-policy"],
      source: source({
        id: "fed-source",
        ancestry_group_id: "fed-ancestry",
        source_name: "Federal Reserve",
      }),
    }),
    baseRow({
      id: "market",
      external_evidence_id: "ev:market",
      evidence_class: "market_observation",
      claim_text: "US 2Y yield moved after the release.",
      affected_assets: ["US02Y"],
      source: source({
        id: "market-source",
        ancestry_group_id: "market-ancestry",
        source_name: "Market Feed",
        source_type: "market_data",
      }),
    }),
    baseRow({
      id: "creator",
      external_evidence_id: "lead:creator",
      evidence_class: "transcript",
      claim_text: "Creator argues the move reflects positioning.",
      structured_payload: {
        evidenceNature: "creator_lead",
        candidateScore: 88,
      },
      source: source({
        id: "creator-source",
        ancestry_group_id: "youtube-ancestry",
        source_name: "Creator Channel",
        source_type: "video",
        source_tier: 5,
      }),
    }),
    baseRow({
      id: "future-event",
      external_evidence_id: "event:future",
      evidence_class: "other",
      claim_text: "Scheduled central bank event.",
      event_at: "2026-09-21T12:00:00.000Z",
      structured_payload: {
        evidenceNature: "scheduled_event",
        title: "Central bank decision",
        materiality: 95,
      },
      source: source({
        id: "calendar-source",
        ancestry_group_id: "calendar-ancestry",
        source_name: "Central Bank",
      }),
    }),
    baseRow({
      id: "expired-event",
      external_evidence_id: "event:expired",
      evidence_class: "other",
      claim_text: "Old scheduled event.",
      event_at: "2026-09-19T12:00:00.000Z",
      structured_payload: {
        evidenceNature: "scheduled_event",
        title: "Expired central bank event",
      },
    }),
  ];

  const result = buildCandidateSnapshotFromCanonicalEvidence(rows, {
    asOf: AS_OF,
    lookbackHours: 168,
  });

  assert.equal(result.diagnostics.observed_count, 2);
  assert.equal(result.diagnostics.lead_count, 1);
  assert.equal(result.diagnostics.catalyst_count, 1);
  assert.equal(result.diagnostics.skipped_expired_scheduled_count, 1);
  assert.equal(result.diagnostics.price_data_status, "OK");
  assert.equal(result.diagnostics.macro_data_status, "OK");

  const observed = result.snapshot.observed_evidence ?? [];
  assert.equal(observed.length, 2);

  const officialObserved = observed.find(
    (item) => item.evidence_id === "ev:official",
  );
  const marketObserved = observed.find(
    (item) => item.evidence_id === "ev:market",
  );

  assert.equal(officialObserved?.source_type, "OFFICIAL_DATA");
  assert.equal(marketObserved?.source_type, "MARKET_DATA");

  const officialProv = officialObserved?.provenance as Array<Record<string, unknown>>;
  assert.equal(officialProv[0]?.source_id, "fed-ancestry");

  const leads = result.snapshot.research_leads ?? [];
  assert.equal(leads.length, 1);
  assert.equal(leads[0]?.source_type, "CREATOR_LEAD");
  assert.equal(leads[0]?.urgency, "HIGH");

  const catalysts = result.snapshot.catalysts ?? [];
  assert.equal(catalysts.length, 1);
  assert.equal(catalysts[0]?.catalyst_id, "event:future");
});

test("Task 9 adapter never promotes news reports or creator transcripts to observed evidence", () => {
  const rows: CanonicalEvidenceRow[] = [
    baseRow({
      id: "news",
      external_evidence_id: "lead:news",
      evidence_class: "news_report",
      claim_text: "Named-source report requires verification.",
    }),
    baseRow({
      id: "creator",
      external_evidence_id: "lead:video",
      evidence_class: "transcript",
      claim_text: "Creator interpretation.",
      source: source({
        source_type: "video",
        source_name: "StockedUp",
        source_tier: 5,
      }),
    }),
  ];

  const result = buildCandidateSnapshotFromCanonicalEvidence(rows, {
    asOf: AS_OF,
  });

  assert.equal(result.snapshot.observed_evidence?.length, 0);
  assert.equal(result.snapshot.research_leads?.length, 2);
  assert.equal(result.diagnostics.price_data_status, "MISSING");
  assert.equal(result.diagnostics.macro_data_status, "MISSING");
});


test("Task 9 adapter admits explicit numerical market observations from reliable articles", () => {
  const rows: CanonicalEvidenceRow[] = [
    baseRow({
      id: "article-market",
      external_evidence_id: "ev:article-market",
      evidence_class: "news_report",
      claim_text:
        "The 10-year Treasury yield rose to 4.97% while the S&P 500 fell 1.2%.",
      affected_assets: ["US10Y", "SPX"],
      source: source({
        source_type: "news",
        source_name: "Axios",
        source_tier: 3,
        reliability_score: 76,
      }),
    }),
    baseRow({
      id: "article-narrative",
      external_evidence_id: "lead:article",
      evidence_class: "news_report",
      claim_text: "Investors are debating the outlook for growth.",
      source: source({
        source_type: "news",
        source_name: "Axios",
        source_tier: 3,
        reliability_score: 76,
      }),
    }),
  ];

  const result = buildCandidateSnapshotFromCanonicalEvidence(rows, {
    asOf: AS_OF,
    lookbackHours: 168,
  });

  assert.equal(result.diagnostics.observed_count, 1);
  assert.equal(result.diagnostics.lead_count, 1);
  assert.equal(result.diagnostics.price_data_status, "OK");

  const observed = result.snapshot.observed_evidence?.[0];
  assert.equal(observed?.evidence_id, "ev:article-market");
  assert.equal(observed?.source_type, "NEWS_MARKET_CONTEXT");
  assert.equal(observed?.is_admitted_fact, true);
});

test("Task 9 adapter admits existing Live market monitor rows and marks FRED macro coverage", () => {
  const base = buildCandidateSnapshotFromCanonicalEvidence([], {
    asOf: AS_OF,
    lookbackHours: 168,
  });

  const result = augmentCandidateSnapshotWithMarketMonitor(
    base,
    {
      updatedAt: AS_OF,
      rows: [
        {
          id: "us2y",
          symbol: "DGS2",
          label: "US 2Y Yield",
          type: "Rates",
          last: 5.12,
          dayChange: 0.8,
          change5d: 3.2,
          asOf: "2026-09-19",
          frequency: "daily",
          sourceName: "Federal Reserve Economic Data",
          sourceUrl: "https://fred.stlouisfed.org/series/DGS2",
        },
        {
          id: "spx",
          symbol: "^GSPC",
          label: "S&P 500",
          type: "Major Index",
          last: 7025,
          dayChange: -0.6,
          change5d: 1.1,
          asOf: "2026-09-19",
          frequency: "daily",
          sourceName: "Nasdaq official index history",
          sourceUrl: "https://www.nasdaq.com/",
        },
      ],
      breadth: [{
        id: "large-cap",
        label: "US large-cap proxy",
        sourceName: "Nasdaq official daily histories",
        sampleSize: 96,
        targetSize: 100,
        current: {
          asOf: "2026-09-19",
          sampleSize: 96,
          above20: 61,
          above50: 58,
          above200: 64,
          newHighs20: 12,
          newLows20: 4,
        },
        weekAgo: { asOf: "2026-09-12", above50: 54, above200: 62 },
        monthAgo: { asOf: "2026-08-20", above50: 49, above200: 60 },
      }],
      limitations: [],
    },
    { asOf: AS_OF, lookbackHours: 168 },
  );

  assert.equal(result.diagnostics.price_data_status, "OK");
  assert.equal(result.diagnostics.macro_data_status, "OK");
  assert.equal(result.snapshot.price_data?.status, "OK");
  assert.equal(result.snapshot.macro_data?.status, "OK");
  assert.equal(result.snapshot.observed_evidence?.length, 3);
  assert.ok(
    result.snapshot.observed_evidence?.some(
      (item) => item.evidence_id === "market-monitor:us2y:2026-09-19",
    ),
  );
  const breadth = result.snapshot.observed_evidence?.find(
    (item) => item.evidence_id === "market-breadth:large-cap:2026-09-19",
  );
  assert.equal(breadth?.source_type, "MARKET_DATA");
  assert.equal(breadth?.category, "BREADTH");
  assert.equal(breadth?.grouping_key, "market-breadth:large-cap");
  assert.match(String(breadth?.claim_or_fact), /58% above the 50-day average/);
});

test("Task 9 market monitor admission preserves the cross-asset macro spine before the 28-row cap", () => {
  const base = buildCandidateSnapshotFromCanonicalEvidence([], {
    asOf: AS_OF,
    lookbackHours: 168,
  });

  const core = [
    ["us2y", "DGS2", "US 2Y Yield", "Rates"],
    ["us10y", "^TNX", "US 10Y Yield", "Rates"],
    ["spx", "^GSPC", "S&P 500", "Major Index"],
    ["smh", "SMH", "SMH Semiconductors", "AI / Semis"],
    ["dxy", "UUP", "US Dollar", "FX"],
    ["usdjpy", "JPY=X", "USDJPY", "FX"],
    ["nikkei", "EWJ", "Japan Equities", "Major Index"],
    ["kospi", "EWY", "Korea Equities", "Major Index"],
    ["hang-seng", "EWH", "Hong Kong Equities", "Major Index"],
    ["gold", "GLD", "Gold proxy", "Metal"],
    ["wti", "CL=F", "WTI", "Energy"],
    ["distillate", "HO=F", "ULSD / heating oil", "Energy"],
    ["crack-distillate", "distillate", "Distillate crack", "Energy"],
    ["hyg", "HYG", "High Yield Credit", "Credit / Risk"],
  ] as const;

  const rows = [
    ...Array.from({ length: 30 }, (_, index) => ({
      id: `filler-${String(index).padStart(2, "0")}`,
      symbol: `FILL${index}`,
      label: `Filler ${index}`,
      type: "Major Index",
      last: 100 + index,
      dayChange: 0,
      change5d: 0,
      asOf: "2026-09-19",
      frequency: "daily" as const,
      sourceName: "Nasdaq official index history",
      sourceUrl: "https://www.nasdaq.com/",
      attentionScore: 99 - index,
    })),
    ...core.map(([id, symbol, label, type]) => ({
      id,
      symbol,
      label,
      type,
      last: 100,
      dayChange: 0,
      change5d: 0,
      asOf: "2026-09-19",
      frequency: "daily" as const,
      sourceName: id === "us2y" ? "Federal Reserve Economic Data" : "Canonical market source",
      sourceUrl: "https://example.com/market",
      attentionScore: 0,
    })),
  ];

  const result = augmentCandidateSnapshotWithMarketMonitor(
    base,
    {
      updatedAt: AS_OF,
      rows,
      limitations: [],
    },
    { asOf: AS_OF, lookbackHours: 168 },
  );

  const ids = new Set(result.snapshot.observed_evidence?.map((item) => item.evidence_id));
  assert.equal(result.snapshot.observed_evidence?.length, 28);
  for (const [id] of core) {
    assert.ok(ids.has(`market-monitor:${id}:2026-09-19`), `missing macro monitor row ${id}`);
  }
});

test("Task 9 adapter admits official EIA weekly energy evidence without making it a health dependency", () => {
  const base = buildCandidateSnapshotFromCanonicalEvidence([], {
    asOf: AS_OF,
    lookbackHours: 168,
  });

  const eia = parseEiaWeeklyPetroleumPayload(
    {
      response: {
        data: [
          { period: "2026-09-18", series: "WCESTUS1", value: 426398, units: "Thousand Barrels" },
          { period: "2026-09-11", series: "WCESTUS1", value: 423429, units: "Thousand Barrels" },
          { period: "2026-09-18", series: "WPULEUS3", value: 94.0, units: "Percent" },
          { period: "2026-09-11", series: "WPULEUS3", value: 96.8, units: "Percent" },
        ],
      },
    },
    { retrievedAt: "2026-09-19T23:00:00.000Z" },
  );

  const result = augmentCandidateSnapshotWithEia(base, eia, {
    asOf: AS_OF,
    lookbackHours: 168,
  });

  assert.equal(result.snapshot.sources_status?.eia_weekly_petroleum?.status, "OK");
  assert.equal(result.snapshot.observed_evidence?.length, 2);
  assert.ok(
    result.snapshot.observed_evidence?.every((item) => item.source_type === "OFFICIAL_DATA"),
  );
  assert.match(
    String(result.snapshot.observed_evidence?.[0]?.claim_or_fact ?? ""),
    /prior week/i,
  );
});

test("Task 9 adapter admits Trading Economics actual-consensus-previous as optional US surprise evidence", () => {
  const base = buildCandidateSnapshotFromCanonicalEvidence([], {
    asOf: AS_OF,
    lookbackHours: 168,
  });

  const calendar = parseTradingEconomicsUsCalendarPayload(
    [{
      CalendarId: "123",
      Date: "2026-09-19T20:00:00Z",
      Country: "United States",
      Category: "Manufacturing PMI",
      Event: "S&P Global Manufacturing PMI Flash",
      Source: "S&P Global",
      SourceURL: "https://www.spglobal.com/",
      Actual: "57.0",
      Previous: "53.9",
      Forecast: "53.6",
      TEForecast: "53.8",
      Importance: 3,
    }],
    { retrievedAt: "2026-09-19T20:01:00.000Z" },
  );

  const result = augmentCandidateSnapshotWithTradingEconomics(base, calendar, {
    asOf: AS_OF,
    lookbackHours: 168,
  });

  assert.equal(result.snapshot.sources_status?.trading_economics_us_calendar?.status, "OK");
  assert.equal(result.snapshot.observed_evidence?.length, 1);
  assert.equal(result.snapshot.observed_evidence?.[0]?.source_type, "ECONOMIC_CALENDAR");
  assert.equal(result.snapshot.observed_evidence?.[0]?.is_admitted_fact, true);
  assert.match(
    String(result.snapshot.observed_evidence?.[0]?.claim_or_fact ?? ""),
    /actual 57\.0 vs consensus 53\.6; previous 53\.9/i,
  );
});

test("Task 9 adapter excludes legacy MacroMicro-backed evidence from new Dossier inputs", () => {
  const rows: CanonicalEvidenceRow[] = [
    baseRow({
      id: "legacy-macromicro",
      external_evidence_id: "verified-macro:legacy-fedwatch",
      evidence_class: "other",
      claim_text: "Legacy MacroMicro-derived FedWatch observation.",
      structured_payload: {
        evidenceNature: "verified_macro_data",
        signalKind: "rate_expectation",
        signalContext: "STRONG_ACTIVITY_SURPRISE",
      },
      source: source({
        id: "legacy-macromicro-source",
        ancestry_group_id: "legacy-macromicro-ancestry",
        external_source_id: "macromicro.me|macromicro",
        source_name: "MacroMicro",
        source_url: "https://en.macromicro.me/",
        source_type: "data_provider",
      }),
    }),
    baseRow({
      id: "official-fed",
      external_evidence_id: "verified-macro:official-fed",
      evidence_class: "official_release",
      claim_text: "Official Federal Reserve evidence remains eligible.",
      source: source({
        id: "official-fed-source",
        ancestry_group_id: "official-fed-ancestry",
        source_name: "Federal Reserve",
        source_url: "https://www.federalreserve.gov/",
        source_type: "data_provider",
      }),
    }),
  ];

  const result = buildCandidateSnapshotFromCanonicalEvidence(rows, {
    asOf: AS_OF,
    lookbackHours: 168,
  });

  const ids = new Set(result.snapshot.observed_evidence?.map((item) => item.evidence_id));
  assert.equal(ids.has("verified-macro:legacy-fedwatch"), false);
  assert.equal(ids.has("verified-macro:official-fed"), true);
});

test("Task 9 adapter excludes evidence that was not available by as_of", () => {
  const rows: CanonicalEvidenceRow[] = [
    baseRow({
      id: "future-evidence",
      evidence_class: "official_release",
      available_at: "2026-09-20T01:00:00.000Z",
      received_at: "2026-09-20T01:01:00.000Z",
    }),
  ];

  const result = buildCandidateSnapshotFromCanonicalEvidence(rows, {
    asOf: AS_OF,
  });

  assert.equal(result.diagnostics.rows_considered, 0);
  assert.equal(result.diagnostics.skipped_future_count, 1);
  assert.equal(result.snapshot.observed_evidence?.length, 0);
});

function missingDossierTableClient(): SupabaseClient {
  return {
    from(table: string) {
      assert.equal(table, "market_dossiers_v2");
      return {
        select(_fields: string) {
          return {
            order(_column: string, _options: unknown) {
              return {
                limit(_limit: number) {
                  return {
                    async maybeSingle() {
                      return {
                        data: null,
                        error: {
                          code: "PGRST205",
                          message:
                            "Could not find the table 'public.market_dossiers_v2' in the schema cache",
                        },
                      };
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient;
}

function leadOnlySnapshot(): CanonicalSnapshotResult {
  return buildCandidateSnapshotFromCanonicalEvidence(
    [
      baseRow({
        id: "creator",
        external_evidence_id: "lead:creator",
        evidence_class: "transcript",
        claim_text: "Creator interpretation awaiting corroboration.",
        source: source({
          source_type: "video",
          source_name: "StockedUp",
          source_tier: 5,
        }),
      }),
    ],
    {
      asOf: AS_OF,
    },
  );
}

test("Task 9 manual mode stays read-only when Dossier V2 persistence is not deployed", async () => {
  let modelCalls = 0;
  const failingRunner: ModelRunner = async () => {
    modelCalls += 1;
    throw new Error("forced dry-run model failure");
  };

  const result = await runManualDossierV2({
    asOf: AS_OF,
    client: missingDossierTableClient(),
    snapshotResult: leadOnlySnapshot(),
    researchBrainOptions: {
      modelRunner: failingRunner,
    },
  });

  assert.equal(result.mode, "dry_run");
  assert.equal(result.persistence_available, false);
  assert.equal(result.previous_dossier_id, null);
  assert.equal(modelCalls, 1);
  assert.equal(result.analytical_output.diagnostics.degraded, true);
  assert.equal(result.packet.research_leads.length, 1);
  assert.equal(result.packet.observed_evidence.length, 0);
});

test("Task 9 persist mode fails closed when the production Dossier V2 table is absent", async () => {
  await assert.rejects(
    async () => {
      await runManualDossierV2({
        asOf: AS_OF,
        persist: true,
        client: missingDossierTableClient(),
        snapshotResult: leadOnlySnapshot(),
      });
    },
    /market_dossiers_v2 is not deployed/,
  );
});