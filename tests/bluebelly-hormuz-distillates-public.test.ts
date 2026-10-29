import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {projectHormuzPublicWatch} from "../lib/bluebelly-hormuz-public.ts";
import {blueDeskHostAccess,blueDeskPresentationTarget,blueDeskPublicHref} from "../lib/blue-desk-host.ts";
import type {GlobalFlowMonitor,FlowMetric} from "../lib/global-flow-monitor-core.ts";
const read=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const now=new Date("2026-10-29T12:00:00Z");
const make=(id:string,current:string|null,asOf="2026-10-28",cadence="Daily"):FlowMetric=>({
 id,family:"Market Confirmation",geography:"US",label:id,current,previous:"4",
 delta:"+1.2%",direction:"rising",state:current===null?"coverage_gap":"ready",
 asOf,cadence,sourceName:"Example original provider",sourceUrl:"https://www.eia.gov/petroleum/supply/weekly/",
 interpretation:"source based",
});
const bare=():GlobalFlowMonitor=>({
 oil:[],gold:[],researchTriggers:[{id:"private",priority:99,assets:[],reason:"owner data",researchQuestion:"private"}],
 coverageGaps:[],updatedAt:now.toISOString(),
});
test("public path opens exact view without exposing machine API or owners",()=>{
 assert.equal(blueDeskHostAccess("/hormuz","bluebelly-desk.vercel.app"),"public");
 assert.equal(blueDeskHostAccess("/blue-desk/hormuz","bluebelly-desk.vercel.app"),"public");
 assert.equal(blueDeskPresentationTarget("/hormuz","bluebelly-desk.vercel.app"),"/blue-desk/hormuz");
 assert.equal(blueDeskPublicHref("/blue-desk/hormuz","bluebelly-desk.vercel.app"),"/hormuz");
 assert.equal(blueDeskHostAccess("/hormuz/owner","bluebelly-desk.vercel.app"),"blocked");
 assert.equal(blueDeskHostAccess("/api/oil/hormuz","bluebelly-desk.vercel.app"),"blocked");
});
test("missing shipping, cracks and distillate inventories never become zero or claims of recovery",()=>{
 const v=projectHormuzPublicWatch(bare(),now);
 assert.equal(v.crossingState,"unavailable");
 assert.equal(v.crossing.snapshot,null);
 assert.equal(v.available,0);
 assert.equal(v.tiles.length,10);
 assert.ok(v.tiles.every(x=>x.value===null&&x.status==="unavailable"));
 assert.ok(v.missingIds.some(x=>/jet/.test(x.label)));
 assert.match(v.dataLimit,/AIS counts/);
 assert.doesNotMatch(JSON.stringify(v),/owner data|private/);
});
test("directly sourced crude, distillate and refinery readings retain dates and unit boundaries",()=>{
 const input=bare();
 input.oil=[
  make("brent-confirmation","96.50"),
  make("distillate-crack","47.20"),
  make("321-crack","18.10"),
  make("us-distillate-stocks","110.2 MBBL","2026-10-23","Weekly · EIA WPSR"),
  make("us-refinery-utilisation","91.4 %","2026-10-23","Weekly · EIA WPSR"),
  make("gasoline-crack",null),
 ];
 const v=projectHormuzPublicWatch(input,now);
 assert.equal(v.available,5);
 assert.equal(v.tiles.find(x=>x.id==="distillate-crack")?.value,"47.20");
 assert.match(v.tiles.find(x=>x.id==="distillate-crack")?.explanation||"",/not a Singapore gasoil or jet/);
 assert.equal(v.tiles.find(x=>x.id==="us-distillate-stocks")?.observedAt,"2026-10-23");
 assert.equal(v.tiles.find(x=>x.id==="gasoline-crack")?.value,null);
 assert.equal(v.tiles.find(x=>x.id==="gasoline-crack")?.status,"unavailable");
});
test("daily and weekly source dates become stale without price inference",()=>{
 const input=bare();
 input.oil=[make("brent-confirmation","99","2026-10-01"),
  make("us-distillate-stocks","100","2026-10-05","Weekly"),
  make("wti-confirmation","88","2026-11-02"),
 ];
 const v=projectHormuzPublicWatch(input,now);
 assert.equal(v.available,0);
 for(const id of ["brent-confirmation","us-distillate-stocks","wti-confirmation"])
  assert.equal(v.tiles.find(x=>x.id===id)?.status,"stale");
 assert.match(v.noPriceCausality,/not attributed/);
});
test("sourced AIS count is preserved but never treated as oil volume",()=>{
 const input=bare();
 input.hormuz={checkedAt:now.toISOString(),nextAttemptAt:null,refreshFailed:false,
  snapshot:{observedAt:"2026-10-29T11:40:00.000Z",retrievedAt:"2026-10-29T11:43:00.000Z",
   periodHours:24,total:18,inbound:7,outbound:11,daily:[]}};
 const v=projectHormuzPublicWatch(input,now);
 assert.equal(v.crossingState,"current");
 assert.equal(v.crossing.snapshot?.total,18);
 assert.equal(v.comparison,null);
 assert.ok(!v.noPriceCausality.includes("18"));
});
test("dashboard does not widen access to operational research, paid APIs or new schedules",()=>{
 const page=read("app/blue-desk/hormuz/page.tsx");
 const publicRepo=read("lib/bluebelly-hormuz-public.ts");
 const nav=read("components/blue-desk/BlueDeskHeader.tsx");
 const news=read("app/blue-desk/newsroom/page.tsx");
 assert.match(page,/getGlobalFlowMonitor\(\)/);
 assert.match(page,/<HormuzCrossings monitor=\{watch.crossing\}/);
 assert.match(page,/id="fuels"/);
 assert.match(page,/id="inventory"/);
 assert.match(page,/UKMTO/);
 assert.match(page,/distillate-crack/); // source-mapped via the public projection
 assert.match(nav,/Hormuz Watch/);
 assert.match(news,/physical-versus-market watch/);
 assert.match(publicRepo,/us-distillate-stocks/);
 assert.match(publicRepo,/us-refinery-utilisation/);
 assert.match(publicRepo,/brent-confirmation/);
 assert.doesNotMatch(page,/createSupabaseAdminClient|\.rpc\(|service_role|CRON_SECRET|setInterval|fetch\(/);
});
