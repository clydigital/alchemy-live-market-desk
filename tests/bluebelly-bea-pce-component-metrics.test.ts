import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {parseOfficialBeaPceMetricRows} from "../lib/macro/bea-pce-actual.ts";

test("BEA PCE stores four distinct comparable metrics with correct windows",()=>{
 const rows=parseOfficialBeaPceMetricRows("Headline PCE +0.5% m/m; +3.6% y/y; Core PCE +0.3% m/m; +3.1% y/y");
 assert.deepEqual(rows.map(x=>x.metric_key),["pce_headline_mom","pce_headline_yoy","pce_core_mom","pce_core_yoy"]);
 assert.deepEqual(rows.map(x=>x.actual),[0.5,3.6,0.3,3.1]);
 assert.deepEqual(rows.map(x=>x.transformation),["mom","yoy","mom","yoy"]);
 assert.ok(rows.every(x=>x.unit==="%"));
});
test("no partial or fake official metrics are admitted from free text",()=>{
 for(const s of ["Headline PCE +0.5% m/m; Core PCE +0.3% m/m",
   "Headline CPI +0.5% m/m; +3.6% y/y; Core PCE +0.3% m/m; +3.1% y/y",
   "Headline PCE +0.5% m/m; +999.9% y/y; Core PCE +0.3% m/m; +3.1% y/y"]){
  assert.deepEqual(parseOfficialBeaPceMetricRows(s),[]);
 }
});
test("existing scheduled macro run writes four BEA actual columns and backfills verified prior releases",()=>{
 const source=readFileSync(new URL("../lib/macro/official-actuals.ts",import.meta.url),"utf8");
 assert.match(source,/upsertOfficialBeaPceMetrics/);
 assert.match(source,/ignoreDuplicates:true/);
 assert.match(source,/update\(\{\s*actual:m\.actual,source_url:resolved.sourceUrl,retrieved_at:fetchedAt/);
 assert.match(source,/recoverCompletedBeaPceMetrics\(client, now\)/);
 assert.match(source,/record.source_url!==expected/);
});
