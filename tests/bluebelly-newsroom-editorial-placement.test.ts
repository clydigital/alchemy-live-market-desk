import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {recentBankDecisions} from "../lib/bluebelly-bank-decision-snapshots.ts";
import {recentReportedEditorial} from "../lib/bluebelly-reported-editorial.ts";
import {selectPostEventRecaps} from "../lib/bluebelly-post-event-recap.ts";
import {projectNewsroomEditorial} from "../lib/bluebelly-newsroom-editorial.ts";
import {selectNewsroomHotPicks} from "../lib/bluebelly-newsroom-hot-picks.ts";
import {editorialNewsTopics} from "../lib/bluebelly-editorial-architecture.ts";

const now=new Date("2026-10-30T04:30:00.000Z");
const reader="/key-stories";
const items=projectNewsroomEditorial(
 recentBankDecisions(now,168),recentReportedEditorial(now,168),
 selectPostEventRecaps([],now,8),reader,now,
);
test("Binance incident and Fed recap become independent dated searchable Newsroom articles",()=>{
 const incident=items.find(x=>x.id==="reported:binance-security-incident-2026-10-30");
 assert.ok(incident);
 assert.equal(incident.kind,"incident");
 assert.ok(incident.topics.includes("crypto"));
 assert.match(incident.readerHref,/\?reported=binance-security-incident-2026-10-30/);
 assert.match(incident.summary,/\$6\.3bn/);
 assert.match(incident.why,/NOT a confirmed final cash loss/);
 const fed=items.find(x=>x.id==="recap:fed-2026-10-28");
 assert.ok(fed);
 assert.equal(fed.kind,"bank");
 assert.ok(fed.topics.includes("policy"));
 assert.match(fed.readerHref,/\?postEvent=fed-2026-10-28/);
 assert.ok(!items.some(x=>x.id==="policy:fed-2026-10-28"),"No duplicate Fed card");
 assert.ok(items.some(x=>x.kind==="earnings"),"Reviewed released earnings appear beside decisions");
 assert.ok(items.every(x=>Date.parse(x.occurredAt)<=+now));
 assert.deepEqual(items.map(x=>x.occurredAt),[...items.map(x=>x.occurredAt)].sort((a,b)=>Date.parse(b)-Date.parse(a)));
});
test("Hot Picks can select the incident from the same source-qualified Newsroom index",()=>{
 const picks=selectNewsroomHotPicks([],[],now,5,items);
 assert.ok(picks.keys.includes("editorial:reported:binance-security-incident-2026-10-30"));
 assert.ok(picks.keys.length<=5);
 assert.ok(new Set(picks.keys).size===picks.keys.length);
 assert.ok(editorialNewsTopics({headline:"Binance Bitcoin security breach",summary:"Crypto exchange withdrawals"}).includes("crypto"));
});
test("Homepage contains no dedicated permanent incident/recap takeover; Newsroom controls the placement",()=>{
 const file=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
 const home=file("components/blue-desk/DecisionBrief.tsx");
 const newsroom=file("app/blue-desk/newsroom/page.tsx");
 const wire=file("components/blue-desk/BluebellyNewsWire.tsx");
 assert.doesNotMatch(home,/data-bluebelly-live-crypto-incident|<PostEventRecapFeature/);
 assert.match(newsroom,/editorials=\{editorials\}/);
 assert.match(wire,/data-newsroom-editorial-article/);
 assert.match(wire,/topic==="hot"/);
 assert.match(wire,/aAt=Date\.parse/);
 assert.match(wire,/data-newsroom-timeline="expandable-only"/);
});

test("Microsoft 365 incident enters the 48h Newsroom without being mislabeled a breach or proven price catalyst",()=>{
 const observed=new Date("2026-11-13T15:00:00Z");
 const incident=recentReportedEditorial(observed,48).find(row=>row.id==="microsoft-365-service-incident-2026-11-12");
 assert.ok(incident);
 assert.equal(incident.kind,"SERVICE_INCIDENT");
 assert.match(incident.reporting,/authentication\/routing/);
 assert.match(incident.countercase,/No evidence currently establishes a cyberattack/);
 const projected=projectNewsroomEditorial([], [incident], [], reader, observed)[0];
 assert.equal(projected.kind,"incident");
 assert.ok(projected.topics.includes("ai"));
 assert.ok(!projected.topics.includes("crypto"));
 assert.match(projected.verificationLabel,/CAUSE PENDING/);
 assert.match(projected.readerHref,/\?reported=microsoft-365-service-incident-2026-11-12/);
 assert.equal(recentReportedEditorial(new Date("2026-11-13T08:06:24Z"),48).some(x=>x.id===incident.id),false);
 assert.equal(recentReportedEditorial(new Date("2026-11-16T09:00:00Z"),48).some(x=>x.id===incident.id),false);
 const readerFile=readFileSync(new URL("../components/blue-desk/NewsroomEventReader.tsx",import.meta.url),"utf8");
 assert.match(readerFile,/official-cloud-service-incident/);
 assert.match(readerFile,/root cause pending/);
});
