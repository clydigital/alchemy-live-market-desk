import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPublishedTreasuryCloseRows, collectScheduledTreasuryDailyCloses,
} from "../lib/scheduled-treasury-close-ledger.ts";
import type { TreasuryNominalCurve } from "../lib/providers/treasury-nominal-curve.ts";

const NOW = new Date("2026-11-10T02:00:00Z");
const IDS = ["us2y","us5y-fred","us10y-fred","us20y-fred","us30y-fred"] as const;

function curve(value = 4.5): TreasuryNominalCurve {
  const series = Object.fromEntries(IDS.map((id) => [id, [
    { date: "2026-11-06", yieldPercent: value + 0.1, sourceUpdatedAt: "2026-11-07T00:50:00Z" },
    { date: "2026-11-09", yieldPercent: value, sourceUpdatedAt: "2026-11-10T01:03:51Z" },
  ]])) as TreasuryNominalCurve["series"];
  return {status:"OK",sourceUrl:"https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_yield_curve&field_tdr_date_value=2026",series,warning:null};
}

test("source-only ledger projects all five dated nominal yields, not intraday invented closes", () => {
  const rows=buildPublishedTreasuryCloseRows(curve(),NOW);
  assert.equal(rows.length,10);
  assert.deepEqual(IDS.map(id=>rows.filter(r=>r.tenor_id===id).at(-1)?.observation_date),IDS.map(()=>"2026-11-09"));
  assert.equal(rows.filter(r=>r.observation_date==="2026-11-09").length,5);
  assert.equal(rows[1].source_updated_at,"2026-11-10T01:03:51Z");
  assert.equal(rows[1].yield_percent,4.5);
  assert.equal(rows[1].id,"treasury-nominal:us2y:2026-11-09:4.5000");
});

test("future dates, invalid rates and future source revisions cannot enter persisted observations", () => {
  const bad=curve();
  bad.series.us2y.push({date:"2026-11-11",yieldPercent:4.1,sourceUpdatedAt:"2026-11-11T02:00:00Z"});
  bad.series["us5y-fred"].push({date:"2026-11-10",yieldPercent:NaN,sourceUpdatedAt:null});
  bad.series["us10y-fred"].push({date:"2026-11-10",yieldPercent:4.7,sourceUpdatedAt:"2026-11-12T02:00:00Z"});
  assert.equal(buildPublishedTreasuryCloseRows(bad,NOW).length,10);
});

test("value revisions are append-only identities, identical repeats remain stable", () => {
  const original=buildPublishedTreasuryCloseRows(curve(4.50),NOW);
  const revision=buildPublishedTreasuryCloseRows(curve(4.51),NOW);
  assert.notEqual(original[1].id,revision[1].id);
  assert.deepEqual(original,buildPublishedTreasuryCloseRows(curve(4.50),NOW));
});

test("successful inserts must be corroborated by exact latest-identity readback", async () => {
  let writes=0;
  const result=await collectScheduledTreasuryDailyCloses(NOW,{
    fetchCurve:async()=>curve(),insert:async rows=>{writes=rows.length;return rows.map(r=>r.id);},
    readBack:async ids=>ids,
  });
  assert.equal(writes,10);
  assert.equal(result.status,"RECORDED");
  assert.equal(result.latestByTenor["us30y-fred"],"2026-11-09");
  assert.equal(result.insertedRows,10);
});

test("repeat collection with no new inserts is still verified, never a false failure", async () => {
  const result=await collectScheduledTreasuryDailyCloses(NOW,{
    fetchCurve:async()=>curve(),insert:async()=>[],readBack:async ids=>ids,
  });
  assert.equal(result.status,"RECORDED");
  assert.equal(result.insertedRows,0);
});

test("partial provider rows and readback gaps are never described as complete", async () => {
  const result=await collectScheduledTreasuryDailyCloses(NOW,{
    fetchCurve:async()=>curve(),insert:async rows=>rows.map(r=>r.id),
    readBack:async ids=>ids.slice(0,-1),
  });
  assert.equal(result.status,"PERSISTENCE_FAILED");
  assert.ok(result.warnings.some(x=>x.startsWith("PERSISTED_READBACK_MISSING:")));
});

test("upstream unavailable preserves database and does not claim a close", async () => {
  let wrote=false;const noRows=curve();
  noRows.status="UNAVAILABLE";
  for(const id of IDS)noRows.series[id]=[];
  const result=await collectScheduledTreasuryDailyCloses(NOW,{
    fetchCurve:async()=>noRows,
    insert:async()=>{wrote=true;return [];},
  });
  assert.equal(result.status,"UPSTREAM_UNAVAILABLE");
  assert.equal(wrote,false);
});
