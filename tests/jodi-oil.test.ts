import assert from "node:assert/strict";
import test from "node:test";

import {
  assessmentStatus,
  buildJodiOilAnnualCandidates,
  fetchJodiOilSnapshot,
  parseJodiOilCsv,
} from "../lib/providers/jodi-oil.ts";

const HEADER = "REF_AREA,ENERGY_PRODUCT,FLOW_BREAKDOWN,UNIT_MEASURE,TIME_PERIOD,OBS_VALUE,ASSESSMENT_CODE";

test("JODI annual URL candidates cover settled and current-year naming conventions", () => {
  assert.deepEqual(buildJodiOilAnnualCandidates("primary", 2026), [
    "https://www.jodidata.org/_resources/files/downloads/oil-data/annual-csv/primary/2026.csv",
    "https://www.jodidata.org/_resources/files/downloads/oil-data/annual-csv/primary/primaryyear2026.csv",
  ]);
  assert.deepEqual(buildJodiOilAnnualCandidates("secondary", 2026), [
    "https://www.jodidata.org/_resources/files/downloads/oil-data/annual-csv/secondary/2026.csv",
    "https://www.jodidata.org/_resources/files/downloads/oil-data/annual-csv/secondary/secondaryyear2026.csv",
  ]);
  assert.throws(() => buildJodiOilAnnualCandidates("primary", 2001), /invalid/);
});

test("JODI parser preserves source identity, quality code and KBD observations", () => {
  const rows = parseJodiOilCsv([
    HEADER,
    "US,CRUDEOIL,INDPROD,KBD,2026-05,13500,1",
    "CN,GASDIES,TOTDEMO,KBD,2026-05,4200,2",
    "MY,LPG,TOTIMPSB,KBD,2026-05,200,3",
    "JP,JETKERO,TOTDEMO,KBD,2026-05,500,4",
  ].join("\n"));

  assert.equal(rows.length, 4);
  assert.equal(rows[0].period, "2026-05");
  assert.equal(rows.find((row) => row.countryCode === "US")?.value, 13500);
  assert.equal(rows.find((row) => row.countryCode === "CN")?.assessmentStatus, "caution");
  assert.equal(rows.find((row) => row.countryCode === "MY")?.assessmentStatus, "unassessed");
  assert.equal(rows.find((row) => row.countryCode === "JP")?.assessmentStatus, "under_verification");
  assert.equal(assessmentStatus("9"), "unknown");
});

test("JODI parser filters country/unit without rewriting source values", () => {
  const rows = parseJodiOilCsv([
    HEADER,
    "US,CRUDEOIL,INDPROD,KBD,2026-05,13500,1",
    "US,CRUDEOIL,CLOSINGSTK,KBBL,2026-05,420000,1",
    "CA,CRUDEOIL,INDPROD,KBD,2026-05,5000,1",
  ].join("\n"), { countries: ["us"], units: ["KBD"] });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].countryCode, "US");
  assert.equal(rows[0].unit, "KBD");
  assert.equal(rows[0].value, 13500);
});

test("JODI parser fails closed on schema drift and skips malformed numeric rows", () => {
  assert.throws(
    () => parseJodiOilCsv("REF_AREA,ENERGY_PRODUCT,FLOW_BREAKDOWN,UNIT_MEASURE,TIME_PERIOD,OBS_VALUE\nUS,CRUDEOIL,INDPROD,KBD,2026-05,1"),
    /ASSESSMENT_CODE/,
  );

  const rows = parseJodiOilCsv([
    HEADER,
    "US,CRUDEOIL,INDPROD,KBD,2026-05,not-a-number,1",
    "US,CRUDEOIL,INDPROD,KBD,bad-period,13500,1",
    "US,CRUDEOIL,INDPROD,KBD,2026-05,13500,1",
  ].join("\n"));
  assert.equal(rows.length, 1);
});

test("JODI fetch falls through current-year filename convention and combines current/prior years", async () => {
  const seen: string[] = [];
  const fetchImpl = (async (input: string | URL | Request) => {
    const url = String(input);
    seen.push(url);

    if (url.endsWith("/primary/2026.csv") || url.endsWith("/secondary/2026.csv")) {
      return new Response("missing", { status: 404 });
    }
    if (url.endsWith("/primary/primaryyear2026.csv")) {
      return new Response(`${HEADER}\nUS,CRUDEOIL,INDPROD,KBD,2026-05,13500,1`, { status: 200 });
    }
    if (url.endsWith("/secondary/secondaryyear2026.csv")) {
      return new Response(`${HEADER}\nUS,GASDIES,TOTDEMO,KBD,2026-05,4100,2`, { status: 200 });
    }
    if (url.endsWith("/primary/2025.csv")) {
      return new Response(`${HEADER}\nUS,CRUDEOIL,INDPROD,KBD,2025-12,13200,1`, { status: 200 });
    }
    if (url.endsWith("/secondary/2025.csv")) {
      return new Response(`${HEADER}\nUS,GASDIES,TOTDEMO,KBD,2025-12,3900,1`, { status: 200 });
    }
    return new Response("missing", { status: 404 });
  }) as typeof fetch;

  const snapshot = await fetchJodiOilSnapshot({
    now: new Date("2026-08-20T00:00:00Z"),
    countries: ["US"],
    fetchImpl,
  });

  assert.equal(snapshot.state, "ready");
  assert.equal(snapshot.latestPeriod, "2026-05");
  assert.equal(snapshot.observations.length, 4);
  assert.ok(seen.some((url) => url.endsWith("primaryyear2026.csv")));
  assert.ok(seen.some((url) => url.endsWith("secondaryyear2026.csv")));
  assert.equal(snapshot.sourceFiles.filter((file) => file.state === "ready").length, 4);
});

test("JODI fetch reports partial coverage instead of treating a missing file as deletion", async () => {
  const fetchImpl = (async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes("/secondary/")) return new Response("missing", { status: 404 });
    if (url.endsWith("/primary/2026.csv")) {
      return new Response(`${HEADER}\nUS,CRUDEOIL,INDPROD,KBD,2026-05,13500,1`, { status: 200 });
    }
    if (url.endsWith("/primary/2025.csv")) {
      return new Response(`${HEADER}\nUS,CRUDEOIL,INDPROD,KBD,2025-12,13200,1`, { status: 200 });
    }
    return new Response("missing", { status: 404 });
  }) as typeof fetch;

  const snapshot = await fetchJodiOilSnapshot({
    now: new Date("2026-08-20T00:00:00Z"),
    fetchImpl,
  });

  assert.equal(snapshot.state, "partial");
  assert.equal(snapshot.latestPeriod, "2026-05");
  assert.equal(snapshot.observations.length, 2);
  assert.match(snapshot.note || "", /missing files|unavailable/i);
});

test("JODI fetch reports unavailable when every requested source file fails", async () => {
  const fetchImpl = (async () => new Response("missing", { status: 404 })) as typeof fetch;
  const snapshot = await fetchJodiOilSnapshot({
    years: [2026],
    kinds: ["primary"],
    fetchImpl,
  });

  assert.equal(snapshot.state, "unavailable");
  assert.equal(snapshot.latestPeriod, null);
  assert.deepEqual(snapshot.observations, []);
  assert.equal(snapshot.sourceFiles[0].state, "unavailable");
});
