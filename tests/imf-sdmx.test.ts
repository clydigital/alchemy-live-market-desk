import assert from "node:assert/strict";
import test from "node:test";

import {
  IMF_SDMX_BASE_URL,
  buildImfSdmxUrl,
  fetchImfSdmxSensor,
  normalizeImfKey,
  parseImfSdmxCsv,
} from "../lib/providers/imf-sdmx.ts";

test("IMF SDMX WEO URL and key identity are deterministic", () => {
  assert.equal(normalizeImfKey("DEU.NGDP_RPCH.A"), "DEU.NGDP_RPCH.A");
  const url = buildImfSdmxUrl({
    agencyId: "IMF.RES",
    dataflowId: "WEO",
    key: "DEU.NGDP_RPCH.A",
    startPeriod: "2020",
    endPeriod: "2030",
  });
  assert.equal(
    url,
    `${IMF_SDMX_BASE_URL}/IMF.RES/WEO/~/DEU.NGDP_RPCH.A?startPeriod=2020&endPeriod=2030`,
  );
});

test("IMF SDMX query refuses full wildcard, empty dimensions and invalid periods", () => {
  assert.throws(() => normalizeImfKey("*"), /full-data wildcard/);
  assert.throws(() => normalizeImfKey("DEU..A"), /empty dimension/);
  assert.throws(() => normalizeImfKey("*.NGDP_RPCH.*"), /at most one wildcard/);
  assert.throws(() => buildImfSdmxUrl({
    agencyId: "IMF.RES",
    dataflowId: "WEO",
    key: "DEU.NGDP_RPCH.A",
    startPeriod: "2030",
    endPeriod: "2020",
  }), /must not be after/);
});

test("IMF SDMX CSV parser preserves all source fields, value and status", () => {
  const parsed = parseImfSdmxCsv([
    "COUNTRY,INDICATOR,FREQUENCY,TIME_PERIOD,OBS_VALUE,OBS_STATUS,TITLE",
    'DEU,NGDP_RPCH,A,2025,0.2,A,"Real GDP growth, annual percent change"',
    'DEU,NGDP_RPCH,A,2026,0.9,E,"Real GDP growth, annual percent change"',
  ].join("\n"));

  assert.equal(parsed.length, 2);
  assert.equal(parsed[1].timePeriod, "2026");
  assert.equal(parsed[1].value, 0.9);
  assert.equal(parsed[1].status, "E");
  assert.equal(parsed[1].fields.COUNTRY, "DEU");
  assert.equal(parsed[1].fields.TITLE, "Real GDP growth, annual percent change");
});

test("IMF SDMX CSV parser handles BOM, escaped quotes and missing numeric values without fabrication", () => {
  const parsed = parseImfSdmxCsv(
    '\uFEFFCOUNTRY,TIME_PERIOD,OBS_VALUE,OBS_STATUS,TITLE\nUSA,2026,,P,"GDP ""projection"""',
  );
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].value, null);
  assert.equal(parsed[0].status, "P");
  assert.equal(parsed[0].fields.TITLE, 'GDP "projection"');
});

test("IMF SDMX CSV parser fails closed on schema or row-width drift", () => {
  assert.throws(() => parseImfSdmxCsv("COUNTRY,OBS_VALUE\nUSA,2.1"), /TIME_PERIOD/);
  assert.throws(() => parseImfSdmxCsv(
    "COUNTRY,TIME_PERIOD,OBS_VALUE\nUSA,2026,2.1,EXTRA",
  ), /row width/);
});

test("IMF SDMX fetch returns normalized ready data from the official keyless surface", async () => {
  const calls: string[] = [];
  const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push(String(input));
    assert.equal(new Headers(init?.headers).get("accept"), "text/csv");
    return new Response(
      "COUNTRY,INDICATOR,FREQUENCY,TIME_PERIOD,OBS_VALUE,OBS_STATUS\nUSA,NGDP_RPCH,A,2026,2.1,E",
      { status: 200, headers: { "content-type": "text/csv" } },
    );
  };

  const snapshot = await fetchImfSdmxSensor({
    agencyId: "IMF.RES",
    dataflowId: "WEO",
    key: "USA.NGDP_RPCH.A",
    startPeriod: "2025",
    endPeriod: "2026",
    fetchImpl: fetchImpl as typeof fetch,
  });

  assert.equal(snapshot.state, "ready");
  assert.equal(snapshot.dataset?.observations[0].value, 2.1);
  assert.equal(snapshot.dataset?.key, "USA.NGDP_RPCH.A");
  assert.ok(calls[0].startsWith(`${IMF_SDMX_BASE_URL}/IMF.RES/WEO/~/USA.NGDP_RPCH.A`));
});

test("IMF SDMX provider and row-bound failures remain explicit", async () => {
  const httpFailure = await fetchImfSdmxSensor({
    agencyId: "IMF.RES",
    dataflowId: "WEO",
    key: "USA.NGDP_RPCH.A",
    startPeriod: "2025",
    endPeriod: "2026",
    fetchImpl: (async () => new Response("down", { status: 503 })) as typeof fetch,
  });
  assert.equal(httpFailure.state, "unavailable");
  assert.match(httpFailure.note ?? "", /HTTP 503/);

  const tooLarge = await fetchImfSdmxSensor({
    agencyId: "IMF.RES",
    dataflowId: "WEO",
    key: "USA.NGDP_RPCH.A",
    startPeriod: "2025",
    endPeriod: "2026",
    maxRows: 1,
    fetchImpl: (async () => new Response(
      "COUNTRY,TIME_PERIOD,OBS_VALUE\nUSA,2025,2.0\nUSA,2026,2.1",
      { status: 200 },
    )) as typeof fetch,
  });
  assert.equal(tooLarge.state, "unavailable");
  assert.match(tooLarge.note ?? "", /row safety bound/);
});
