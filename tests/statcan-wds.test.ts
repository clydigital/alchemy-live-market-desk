import assert from "node:assert/strict";
import test from "node:test";

import {
  fetchStatCanChangedSeriesList,
  fetchStatCanVectorDetails,
  parseStatCanChangedSeriesData,
  parseStatCanChangedSeriesList,
  parseStatCanSeriesInfo,
  STATCAN_WDS_BASE,
} from "../lib/providers/statcan-wds.ts";

test("Statistics Canada changed-series parser accepts the documented wrapper and preserves release identity", () => {
  const rows = parseStatCanChangedSeriesList({
    status: "SUCCESS",
    object: {
      status: "SUCCESS",
      object: [
        {
          responseStatusCode: 0,
          vectorId: 107028707,
          productId: 25100059,
          coordinate: "5.2.1.0.0.0.0.0.0.0",
          releaseTime: "2026-08-20T08:30",
        },
      ],
    },
  });

  assert.deepEqual(rows, [{
    vectorId: 107028707,
    productId: 25100059,
    coordinate: "5.2.1.0.0.0.0.0.0.0",
    releaseTime: "2026-08-20T08:30",
  }]);
});

test("Statistics Canada series metadata parser preserves unit, scale and title metadata", () => {
  const rows = parseStatCanSeriesInfo([{
    status: "SUCCESS",
    object: {
      responseStatusCode: 0,
      productId: 35100003,
      coordinate: "1.12.0.0.0.0.0.0.0.0",
      vectorId: 32164132,
      frequencyCode: 12,
      scalarFactorCode: 3,
      decimals: 2,
      terminated: 0,
      SeriesTitleEn: "Canada;Example economic series",
      SeriesTitleFr: "Canada;Série économique d’exemple",
      memberUomCode: 47,
    },
  }]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].vectorId, 32164132);
  assert.equal(rows[0].scalarFactorCode, 3);
  assert.equal(rows[0].memberUomCode, 47);
  assert.equal(rows[0].terminated, false);
  assert.equal(rows[0].titleEn, "Canada;Example economic series");
});

test("Statistics Canada changed-data parser preserves reference period, release time and quality/status codes", () => {
  const byVector = parseStatCanChangedSeriesData([{
    status: "SUCCESS",
    object: {
      responseStatusCode: 0,
      vectorId: 32164132,
      vectorDataPoint: [
        {
          refPer: "2026-07-01",
          refPer2: "",
          refPerRaw: "2026-07-01",
          refPerRaw2: "",
          value: "1052.5",
          decimals: 1,
          scalarFactorCode: 0,
          symbolCode: 0,
          statusCode: 7,
          securityLevelCode: 0,
          releaseTime: "2026-08-20T08:30",
        },
      ],
    },
  }]);

  const points = byVector.get(32164132) || [];
  assert.equal(points.length, 1);
  assert.equal(points[0].value, 1052.5);
  assert.equal(points[0].refPer, "2026-07-01");
  assert.equal(points[0].statusCode, 7);
  assert.equal(points[0].releaseTime, "2026-08-20T08:30");
});

test("Statistics Canada changed-series fetch uses the keyless official WDS endpoint", async () => {
  let seenUrl = "";
  const fetchImpl: typeof fetch = async (input) => {
    seenUrl = String(input);
    return new Response(JSON.stringify({
      status: "SUCCESS",
      object: [{
        responseStatusCode: 0,
        vectorId: 1001,
        productId: 36100104,
        coordinate: "1.1.1.0.0.0.0.0.0.0",
        releaseTime: "2026-08-20T08:30",
      }],
    }), { status: 200, headers: { "content-type": "application/json" } });
  };

  const result = await fetchStatCanChangedSeriesList({ fetchImpl });
  assert.equal(seenUrl, `${STATCAN_WDS_BASE}/getChangedSeriesList`);
  assert.equal(result.state, "ready");
  assert.equal(result.changedSeries.length, 1);
});

test("Statistics Canada HTTP 409 is explicit table-lock unavailability, not an empty release", async () => {
  const fetchImpl: typeof fetch = async () => new Response("locked", { status: 409 });
  const result = await fetchStatCanChangedSeriesList({ fetchImpl });
  assert.equal(result.state, "unavailable");
  assert.equal(result.changedSeries.length, 0);
  assert.match(result.note || "", /locked|409/i);
});

test("Statistics Canada vector detail fetch combines metadata and changed points deterministically", async () => {
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    assert.equal(init?.method, "POST");
    assert.deepEqual(JSON.parse(String(init?.body)), [{ vectorId: 32164132 }]);

    if (url.endsWith("/getSeriesInfoFromVector")) {
      return new Response(JSON.stringify([{
        status: "SUCCESS",
        object: {
          responseStatusCode: 0,
          productId: 35100003,
          coordinate: "1.12.0.0.0.0.0.0.0.0",
          vectorId: 32164132,
          frequencyCode: 12,
          scalarFactorCode: 0,
          decimals: 2,
          terminated: 0,
          SeriesTitleEn: "Canada;Example",
          memberUomCode: 47,
        },
      }]), { status: 200 });
    }

    return new Response(JSON.stringify([{
      status: "SUCCESS",
      object: {
        responseStatusCode: 0,
        productId: 35100003,
        coordinate: "1.12.0.0.0.0.0.0.0.0",
        vectorId: 32164132,
        vectorDataPoint: [{ refPer: "2026-07-01", value: 10.5, decimals: 1, scalarFactorCode: 0, symbolCode: 0, statusCode: 0, securityLevelCode: 0, releaseTime: "2026-08-20T08:30" }],
      },
    }]), { status: 200 });
  };

  const result = await fetchStatCanVectorDetails([32164132], { fetchImpl });
  assert.equal(result.state, "ready");
  assert.equal(result.vectors.length, 1);
  assert.equal(result.vectors[0].seriesInfo?.titleEn, "Canada;Example");
  assert.equal(result.vectors[0].changedDataPoints[0].value, 10.5);
});

test("Statistics Canada vector detail fetch reports partial when one official method is temporarily unavailable", async () => {
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    if (url.endsWith("/getSeriesInfoFromVector")) {
      return new Response(JSON.stringify([{
        status: "SUCCESS",
        object: { responseStatusCode: 0, productId: 35100003, coordinate: "1.1.0.0.0.0.0.0.0.0", vectorId: 1001 },
      }]), { status: 200 });
    }
    return new Response("locked", { status: 409 });
  };

  const result = await fetchStatCanVectorDetails([1001], { fetchImpl });
  assert.equal(result.state, "partial");
  assert.equal(result.vectors[0].seriesInfo?.vectorId, 1001);
  assert.deepEqual(result.vectors[0].changedDataPoints, []);
});

test("Statistics Canada adapter refuses oversized vector batches instead of silently truncating", async () => {
  const ids = Array.from({ length: 51 }, (_, index) => index + 1);
  const result = await fetchStatCanVectorDetails(ids, { fetchImpl: async () => { throw new Error("must not fetch"); } });
  assert.equal(result.state, "unavailable");
  assert.match(result.note || "", /exceeds 50/i);
});
