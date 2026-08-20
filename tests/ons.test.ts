import assert from "node:assert/strict";
import test from "node:test";

import {
  ONS_BASE_URL,
  buildOnsObservationUrl,
  fetchOnsDatasetSensor,
  normalizeOnsDatasetId,
  parseOnsDatasetMetadata,
  parseOnsLatestVersionHref,
  parseOnsObservations,
} from "../lib/providers/ons.ts";

test("ONS dataset id and latest-version identity are deterministic", () => {
  assert.equal(normalizeOnsDatasetId("cpih01"), "cpih01");
  assert.throws(() => normalizeOnsDatasetId("../cpih01"), /invalid/);
  assert.deepEqual(
    parseOnsLatestVersionHref("https://api.beta.ons.gov.uk/v1/datasets/cpih01/editions/time-series/versions/67"),
    { edition: "time-series", version: "67" },
  );
});

test("ONS metadata parser preserves release, unit and latest version identity", () => {
  const parsed = parseOnsDatasetMetadata({
    id: "cpih01",
    title: "Consumer Prices Index including owner occupiers' housing costs (CPIH)",
    description: "Monthly CPIH dataset",
    last_updated: "2026-02-18T10:25:05.825Z",
    release_frequency: "Monthly",
    next_release: "To be announced",
    state: "published",
    unit_of_measure: "Index: 2015=100",
    national_statistic: true,
    links: {
      latest_version: {
        href: "https://api.beta.ons.gov.uk/v1/datasets/cpih01/editions/time-series/versions/67",
        id: "67",
      },
    },
    publications: [{ title: "UK consumer price inflation", href: "https://www.ons.gov.uk/example" }],
  });

  assert.equal(parsed.id, "cpih01");
  assert.equal(parsed.latestEdition, "time-series");
  assert.equal(parsed.latestVersion, "67");
  assert.equal(parsed.releaseFrequency, "Monthly");
  assert.equal(parsed.unitOfMeasure, "Index: 2015=100");
  assert.equal(parsed.publications[0].title, "UK consumer price inflation");
});

test("ONS observation URL requires a bounded explicit dimension query", () => {
  const url = buildOnsObservationUrl("cpih01", "time-series", 67, {
    time: "*",
    geography: "K02000001",
    aggregate: "cpih1dim1A0",
  });
  assert.equal(
    url,
    `${ONS_BASE_URL}/datasets/cpih01/editions/time-series/versions/67/observations?time=*&geography=K02000001&aggregate=cpih1dim1A0`,
  );
  assert.throws(() => buildOnsObservationUrl("cpih01", "time-series", 67, {}), /required/);
});

test("ONS observation parser preserves values, dimensions and unit", () => {
  const sourceUrl = "https://api.beta.ons.gov.uk/v1/example";
  const parsed = parseOnsObservations({
    observations: [
      {
        observation: "105.1",
        dimensions: {
          time: { option: { id: "Mar-18" } },
          geography: { option: { id: "K02000001" } },
          aggregate: { option: { id: "cpih1dim1A0" } },
        },
      },
    ],
    total_observations: 1,
    unit_of_measure: "Index: 2015=100",
  }, sourceUrl);

  assert.equal(parsed.observations[0].value, 105.1);
  assert.deepEqual(parsed.observations[0].dimensions, {
    time: "Mar-18",
    geography: "K02000001",
    aggregate: "cpih1dim1A0",
  });
  assert.equal(parsed.totalObservations, 1);
  assert.equal(parsed.unitOfMeasure, "Index: 2015=100");
});

test("ONS observation parser accepts array-shaped dimension payloads without inventing fields", () => {
  const parsed = parseOnsObservations({
    observations: [{
      observation: 3.4,
      dimensions: [
        { dimension: "time", option_id: "2026 Q2" },
        { dimension: "geography", option_id: "K02000001" },
      ],
      metadata: { status: "published" },
    }],
  }, "https://api.beta.ons.gov.uk/v1/example");
  assert.deepEqual(parsed.observations[0].dimensions, {
    time: "2026 Q2",
    geography: "K02000001",
  });
  assert.deepEqual(parsed.observations[0].metadata, { status: "published" });
});

test("ONS fetch can return metadata only without uncontrolled observation fan-out", async () => {
  const calls: string[] = [];
  const fetchImpl = async (input: RequestInfo | URL) => {
    calls.push(String(input));
    return new Response(JSON.stringify({
      id: "cpih01",
      title: "CPIH",
      links: { latest_version: { href: `${ONS_BASE_URL}/datasets/cpih01/editions/time-series/versions/67`, id: "67" } },
    }), { status: 200, headers: { "content-type": "application/json" } });
  };

  const snapshot = await fetchOnsDatasetSensor({ datasetId: "cpih01", fetchImpl: fetchImpl as typeof fetch });
  assert.equal(snapshot.state, "ready");
  assert.equal(snapshot.observations, null);
  assert.equal(calls.length, 1);
});

test("ONS fetch resolves latest edition/version before requesting explicit observations", async () => {
  const calls: string[] = [];
  const fetchImpl = async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    if (calls.length === 1) {
      return new Response(JSON.stringify({
        id: "cpih01",
        title: "CPIH",
        links: { latest_version: { href: `${ONS_BASE_URL}/datasets/cpih01/editions/time-series/versions/67`, id: "67" } },
      }), { status: 200 });
    }
    return new Response(JSON.stringify({
      observations: [{ observation: "105.1" }],
      total_observations: 1,
      unit_of_measure: "Index: 2015=100",
    }), { status: 200 });
  };

  const snapshot = await fetchOnsDatasetSensor({
    datasetId: "cpih01",
    observationQuery: { time: "Mar-18", geography: "K02000001", aggregate: "cpih1dim1A0" },
    fetchImpl: fetchImpl as typeof fetch,
  });

  assert.equal(snapshot.state, "ready");
  assert.equal(snapshot.dataset?.latestVersion, "67");
  assert.equal(snapshot.observations?.observations[0].value, 105.1);
  assert.equal(calls.length, 2);
  assert.match(calls[1], /versions\/67\/observations/);
});

test("ONS provider failure remains explicit and observation failure is partial", async () => {
  const unavailable = await fetchOnsDatasetSensor({
    datasetId: "cpih01",
    fetchImpl: (async () => new Response("no", { status: 503 })) as typeof fetch,
  });
  assert.equal(unavailable.state, "unavailable");

  let n = 0;
  const partial = await fetchOnsDatasetSensor({
    datasetId: "cpih01",
    observationQuery: { time: "Mar-18", geography: "K02000001", aggregate: "cpih1dim1A0" },
    fetchImpl: (async () => {
      n += 1;
      if (n === 1) {
        return new Response(JSON.stringify({
          id: "cpih01",
          links: { latest_version: { href: `${ONS_BASE_URL}/datasets/cpih01/editions/time-series/versions/67`, id: "67" } },
        }), { status: 200 });
      }
      return new Response("locked", { status: 503 });
    }) as typeof fetch,
  });
  assert.equal(partial.state, "partial");
  assert.equal(partial.dataset?.id, "cpih01");
  assert.equal(partial.observations, null);
});
