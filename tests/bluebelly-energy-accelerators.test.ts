import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {buildEnergyAccelerators,signOfSourceChange} from "../lib/bluebelly-energy-accelerators.ts";
import type {HormuzWatchTile} from "../lib/bluebelly-hormuz-public.ts";

const tile=(id:string,delta:string|null,status:HormuzWatchTile["status"]="available"):HormuzWatchTile=>({
 id,label:id,category:"balances",value:"103,300 MBBL",previous:"99,200 MBBL",delta,
 observedAt:"2026-11-06",frequency:"Weekly · EIA WPSR",
 sourceName:"US EIA original",sourceUrl:"https://www.eia.gov/petroleum/supply/weekly/",
 status,explanation:"Original weekly source period",
});
test("acceleration direction parses source units but never converts change to a probability",()=>{
 assert.equal(signOfSourceChange("+4,100 MBBL"),1);
 assert.equal(signOfSourceChange("-1,020 MBBL/D"),-1);
 assert.equal(signOfSourceChange("+2.6%"),1);
 assert.equal(signOfSourceChange("0 MBBL"),0);
 assert.equal(signOfSourceChange("not measured"),null);
 assert.equal(signOfSourceChange(null),null);
});
test("diesel and gasoline independently expose stocks, product-supplied demand and crack proxies",()=>{
 const cards=buildEnergyAccelerators([
  tile("us-distillate-stocks","+4,100 MBBL"),
  tile("us-distillate-demand","-1,000 MBBL/D"),
  tile("distillate-crack","+1.8%"),
  tile("us-gasoline-stocks","+1,800 MBBL"),
  tile("us-implied-demand","-200 MBBL/D"),
  tile("gasoline-crack","-0.8%"),
 ]);
 assert.deepEqual(cards.map(x=>x.id),["crude","diesel","gasoline"]);
 assert.deepEqual(cards.map(x=>x.readings.length),[3,3,3]);
 const diesel=cards[1];
 assert.deepEqual(diesel.readings.map(x=>x.direction),[1,-1,1]);
 assert.deepEqual(cards[2].readings.map(x=>x.direction),[1,-1,-1]);
 assert.equal(diesel.readings[0].observedAt,"2026-11-06");
 assert.ok(diesel.readings.every(x=>x.sourceUrl?.startsWith("https://www.eia.gov/")));
 assert.match(diesel.nextTest,/Europe\/Asia/);
});
test("stale, missing and delta-less sources park accelerator needles rather than implying balance",()=>{
 const cards=buildEnergyAccelerators([
  tile("us-crude-stocks","+100 MBBL","stale"),
  tile("us-refinery-inputs",null),
 ]);
 const crude=cards[0].readings;
 assert.equal(crude[0].state,"stale");
 assert.equal(crude[0].direction,null);
 assert.equal(crude[1].state,"available");
 assert.equal(crude[1].direction,null);
 assert.equal(crude[2].state,"unavailable");
 assert.equal(crude[2].direction,null);
});
test("Hormuz view displays actual meter components and source boundaries, with no hidden signal writer",()=>{
 const p=(name:string)=>readFileSync(new URL("../"+name,import.meta.url),"utf8");
 const page=p("app/blue-desk/hormuz/page.tsx");
 const component=p("components/blue-desk/EnergyAcceleratorDashboard.tsx");
 const dial=p("components/blue-desk/AcceleratorDial.tsx");
 assert.match(page,/EnergyAcceleratorDashboard tiles=\{watch.tiles\}/);
 assert.match(page,/energy-accelerators/);
 assert.match(component,/NOT SCARCITY LEVEL/);
 assert.match(component,/Product supplied approximates consumption/);
 assert.match(component,/sourceUrl/);
 assert.match(dial,/not a probability/);
 assert.doesNotMatch(page+component,/upsert\(|createSupabaseAdminClient|CRON_SECRET/);
});
