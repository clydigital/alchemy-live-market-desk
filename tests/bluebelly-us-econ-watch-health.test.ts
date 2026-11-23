import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {buildUsEconWatchHealthReceipt} from "../lib/bluebelly-us-econ-watch-health.ts";
import {projectUsEconStatWatch} from "../lib/bluebelly-us-econ-stat-watch.ts";

const at=new Date("2026-11-25T15:40:00Z");
const pending={
 id:"us-bea-2026-11-25-personal-income-outlays-oct-2026",
 release_name:"Personal Income and Outlays",release_date:"2026-11-25T13:30:00Z",
 agency:"U.S. Bureau of Economic Analysis",source_url:"https://www.bea.gov/news/schedule",
 source_classification:"official_government",reference_period:"October 2026",
 status:"released_pending_ingestion",actual:null,ingestion_attempt_status:"failed_retryable",
};
test("critical overdue official release leads to actionable non-green receipt",()=>{
 const watch=projectUsEconStatWatch({releases:[pending],metrics:[],now:at});
 const receipt=buildUsEconWatchHealthReceipt(watch,at);
 assert.equal(receipt.state,"CRITICAL");
 assert.equal(receipt.criticalCount,1);
 assert.ok(receipt.warningCodes.some(x=>x.startsWith("OVERDUE_HIGH_IMPACT_ACTUAL:")));
 assert.equal(receipt.canonicalRegimeUnchanged,true);
 assert.equal(receipt.checkedAt,at.toISOString());
});
test("forecast provider missing is degraded, not an invented BEA result or unverified order",()=>{
 const watch=projectUsEconStatWatch({releases:[{...pending,status:"scheduled"}],metrics:[],
  now:new Date("2026-11-24T20:00:00Z"),consensusProviderConfigured:false});
 const receipt=buildUsEconWatchHealthReceipt(watch,new Date("2026-11-24T20:00:00Z"));
 assert.equal(receipt.state,"DEGRADED");
 assert.equal(receipt.criticalCount,0);
 assert.equal(receipt.provider,"UNCONFIGURED");
});
test("daily authenticated check is scheduled only after existing official actuals; no new collector",()=>{
 const route=readFileSync("app/api/cron/research/us-econ-watch-health/route.ts","utf8");
 const server=readFileSync("lib/bluebelly-us-econ-stat-watch-server.ts","utf8");
 const vercel=JSON.parse(readFileSync("vercel.json","utf8"));
 assert.match(route,/acceptsResearchAuthorization/);
 assert.match(route,/NEXT_PUBLIC_RESEARCH_SCHEDULE_ENABLED/);
 assert.match(route,/getUsEconStatWatch/);
 assert.match(route,/state==="CRITICAL"\?503:200/);
 assert.doesNotMatch(route,/\.insert\(|\.upsert\(|\.update\(|ingestOfficialMacroActuals/);
 assert.match(server,/getEconomicCalendar/);
 assert.deepEqual(vercel.crons.filter((x:{path:string})=>x.path==="/api/cron/research/us-econ-watch-health")
  .map((x:{schedule:string})=>x.schedule),["40 15 * * *"]);
 assert.ok(vercel.crons.some((x:{path:string,schedule:string})=>
  x.path==="/api/cron/research/official-actuals"&&x.schedule==="12 15 * * *"));
});
