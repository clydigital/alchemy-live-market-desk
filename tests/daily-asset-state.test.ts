import assert from "node:assert/strict";
import test from "node:test";

import { buildDailyAssetState } from "../lib/daily-asset-state.ts";

function row(
  id: string,
  last: number,
  previousClose: number,
  dayChange: number,
  symbol = id.toUpperCase(),
  sourceName = "Market data",
) {
  return {
    id,
    symbol,
    label: id,
    type: id.includes("10y") ? "Rates" : "Major Index",
    benchmark: null,
    last,
    previousClose,
    sessionOpen: previousClose,
    dayChange,
    gapChange: 0,
    change3d: dayChange,
    change5d: dayChange,
    rsi: null,
    stochRsi: null,
    volPercentile: null,
    relative5d: null,
    attentionScore: 50,
    hot: false,
    contradiction: false,
    tags: [],
    asOf: "2026-09-25",
    frequency: "daily",
    sourceName,
    sourceUrl: "https://example.com",
    points: [],
  };
}

function monitor() {
  return {
    updatedAt: "2026-09-25T12:00:00Z",
    rows: [
      row("spx", 7700, 7670, 0.39, "SP500", "S&P Dow Jones Indices via FRED"),
      row("spx-proxy", 767.18, 766.9, 0.04, "SPY", "Nasdaq official ETF history"),
      row("ndx", 741.1, 740.9, 0.03, "QQQ", "Nasdaq official ETF history"),
      row("nasdaq-comp", 26939.37, 26929.58, 0.04, "COMP", "Nasdaq official index history"),
      row("wti", 101, 103, -1.94, "CL=F", "U.S. Energy Information Administration"),
      row("us10y-fred", 5.11, 4.96, 3.02, "DGS10", "Federal Reserve Economic Data"),
      row("us10y", 5.18, 5.12, 1.17, "^TNX", "U.S. Treasury"),
      row("gold", 4528.39, 4519.38, 0.20, "XAUUSD", "goldprice.dev XAU/USD spot"),
      row("gold-proxy", 391.69, 392.87, -0.30, "GLD", "Nasdaq official ETF history"),
      row("btc", 104300, 103100, 1.16, "BTCUSD", "Coinbase Exchange BTC-USD spot"),
      row("btc-proxy", 47.81, 47.88, -0.15, "IBIT", "Nasdaq official ETF history"),
    ],
    breadth: [],
    contradictions: [],
    researchTriggers: [],
    limitations: [],
  } as any;
}

function presentation() {
  const lens = (key: string, interpretation: string, reaction: string) => ({
    key,
    label: key,
    observed: true,
    reaction,
    interpretation,
    evidenceRefs: [`ev:${key}:1`, `ev:${key}:2`],
    unresolvedSignals: [],
  });
  return {
    asOf: "2026-09-25T12:00:00Z",
    header: {
      regimeFamily: "RATES_LED_TIGHTENING",
      regimeImplication: "High yields keep the equity regime selective rather than clean risk-on.",
      whatWouldChangeMind: "A sustained fall in real yields with improving breadth.",
    },
    regimeStrip: [
      lens("US_RATES", "Rates remain restrictive.", "US 10Y remains above 5%."),
      lens("BREADTH", "Breadth remains fragile.", "Equal weight lags."),
      lens("TECH_AI", "AI leadership is recovering but rates remain a constraint.", "Semis rebounded."),
      lens("OIL_WAR_INFLATION", "De-escalation pressure is pulling crude lower.", "WTI fell."),
      lens("GOLD", "Gold remains supported despite restrictive rates.", "Gold rose."),
    ],
    rateRegime: {
      state: "HAWKISH",
      confidence: "HIGH",
      summary: "Long-end yields remain restrictive.",
      evidenceRefs: ["rate:1", "rate:2"],
    },
    stockRadar: [
      {
        symbol: "NBIS",
        company_name: "Nebius",
        why_relevant: "Relative strength and AI compute pricing remain supportive.",
        research_question: "Can strength persist?",
        linkage_type: "LINKED_MAJOR_STORY",
        linked_main_thread_or_story_id: "story-ai",
        confirming_signal: "Breakout and continued outperformance.",
        invalidating_signal: "Relative strength deteriorates.",
        evidence_references: ["nbis:1", "nbis:2"],
      },
      {
        symbol: "DELL",
        company_name: "Dell",
        why_relevant: "Selling pressure and a technical breakdown remain a downside risk.",
        research_question: "Does weakness persist?",
        linkage_type: "LINKED_MAJOR_STORY",
        linked_main_thread_or_story_id: "story-ai",
        confirming_signal: "Further downside breakdown.",
        invalidating_signal: "Reclaims resistance.",
        evidence_references: ["dell:1", "dell:2"],
      },
    ],
  } as any;
}

test("daily asset state publishes six fixed anchors and rates change in basis points", () => {
  const state = buildDailyAssetState({ monitor: monitor(), presentation: presentation() });
  assert.equal(state.contractVersion, "daily-asset-state/1");
  assert.deepEqual(state.assets.map((item) => item.key), ["SPX", "NASDAQ", "CRUDE", "US_RATES", "GOLD", "BITCOIN"]);
  assert.equal(state.assets.find((item) => item.key === "SPX")?.last, 7700);
  assert.equal(state.assets.find((item) => item.key === "SPX")?.symbol, "SP500");
  assert.equal(state.assets.find((item) => item.key === "NASDAQ")?.last, 26939.37);
  assert.equal(state.assets.find((item) => item.key === "NASDAQ")?.symbol, "COMP");
  assert.equal(state.assets.find((item) => item.key === "GOLD")?.last, 4528.39);
  assert.equal(state.assets.find((item) => item.key === "GOLD")?.symbol, "XAUUSD");
  assert.equal(state.assets.find((item) => item.key === "BITCOIN")?.last, 104300);
  assert.equal(state.assets.find((item) => item.key === "BITCOIN")?.symbol, "BTCUSD");
  const rates = state.assets.find((item) => item.key === "US_RATES");
  assert.equal(rates?.dailyChangeUnit, "bps");
  assert.equal(rates?.last, 5.18);
  assert.equal(rates?.sourceLabel, "U.S. Treasury");
  assert.equal(rates?.dailyChange, 6);
  assert.equal(rates?.bias, "HAWKISH");
  assert.equal(state.assets.find((item) => item.key === "BITCOIN")?.bias, "UNRESOLVED");
});

test("daily asset state does not invent a directional thesis without a canonical presentation", () => {
  const state = buildDailyAssetState({ monitor: monitor(), presentation: null });
  assert.equal(state.assets.find((item) => item.key === "SPX")?.bias, "UNRESOLVED");
  assert.equal(state.assets.find((item) => item.key === "NASDAQ")?.bias, "UNRESOLVED");
  assert.equal(state.assets.find((item) => item.key === "US_RATES")?.bias, "UNRESOLVED");
  assert.equal(state.stockRadar.length, 0);
});

test("stock radar remains bounded and carries confirmation/invalidation", () => {
  const state = buildDailyAssetState({ monitor: monitor(), presentation: presentation() });
  assert.ok(state.stockRadar.length <= 3);
  assert.equal(state.stockRadar[0].symbol, "NBIS");
  assert.match(state.stockRadar[0].confirmingSignal, /outperformance/i);
  assert.match(state.stockRadar[1].invalidatingSignal, /resistance/i);
});

test("daily asset state fails closed instead of substituting ETF proxies", () => {
  const proxyOnly = monitor();
  proxyOnly.rows = proxyOnly.rows.filter((item: any) =>
    ["spx-proxy", "ndx", "gold-proxy", "btc-proxy", "wti", "us10y-fred"].includes(item.id),
  );
  const state = buildDailyAssetState({ monitor: proxyOnly, presentation: presentation() });
  assert.equal(state.assets.find((item) => item.key === "SPX")?.last, null);
  assert.equal(state.assets.find((item) => item.key === "NASDAQ")?.last, null);
  assert.equal(state.assets.find((item) => item.key === "GOLD")?.last, null);
  assert.equal(state.assets.find((item) => item.key === "BITCOIN")?.last, null);
  assert.match(state.limitations.join(" "), /fails closed/i);
});
