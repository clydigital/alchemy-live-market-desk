import test from "node:test";
import assert from "node:assert/strict";
import {projectTreasuryLedger,preferLedgerSeries} from "../lib/treasury-ledger-reader-core.ts";
const now=new Date("2026-11-27T11:00Z"),url="https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_yield_curve&field_tdr_date_value=2026";
const row=(day:string,value:string)=>({tenor_id:"us2y",observation_date:day,yield_percent:value,source_url:url,source_updated_at:day+"T18:00:00Z",collected_at:"2026-11-26T13:33:00Z"});
test("Thanksgiving does not erase previous official Treasury observations",()=>{
 const read=projectTreasuryLedger([row("2026-11-24","4.63"),row("2026-11-25","4.61")],now);
 assert.equal(read.length,1);assert.equal(read[0].points.at(-1)?.close,4.61);
 assert.equal(new Date(read[0].points.at(-1)!.time*1000).toISOString().slice(0,10),"2026-11-25");
 assert.equal(preferLedgerSeries(null,read[0].points),true);
 assert.equal(preferLedgerSeries(read[0].points,read[0].points),false);
 assert.equal(preferLedgerSeries([{time:read[0].points.at(-1)!.time+86400,close:4.62}],read[0].points),false);
});
test("invalid origin, future values, or ambiguous latest vintage are not promoted",()=>{
 const a=row("2026-11-24","4.63"),b=row("2026-11-25","4.61");
 assert.equal(projectTreasuryLedger([a,{...b,source_url:"https://home.treasury.gov.evil.test/pages/xml?data=daily_treasury_yield_curve"}],now).length,0);
 assert.equal(projectTreasuryLedger([a,b,{...b,yield_percent:"4.62"}],now).length,0);
 assert.equal(projectTreasuryLedger([a,row("2026-11-28","4.61")],now).length,0);
});
