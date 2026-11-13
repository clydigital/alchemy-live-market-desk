import test from "node:test";
import assert from "node:assert/strict";
import {recentReportedEditorial,reportedEditorialById} from "../lib/bluebelly-reported-editorial.ts";
import {projectNewsroomEditorial} from "../lib/bluebelly-newsroom-editorial.ts";
import {selectNewsroomHotPicks} from "../lib/bluebelly-newsroom-hot-picks.ts";

const NOW=new Date("2026-11-14T04:00:00Z");

test("Nov 14 update uses dated source-backed editorial, without treating social leads as verified",()=>{
 const recent=recentReportedEditorial(NOW,48);
 const id=new Set(recent.map(x=>x.id));
 for(const slug of [
  "nvidia-ceo-transition-sec-2026-11-12",
  "fermi-hyperscaler-600mw-sec-2026-11-12",
  "bahrain-drones-hormuz-conflicting-claims-2026-11-13",
 ]) assert.ok(id.has(slug),slug);
 const nvidia=recent.find(r=>r.id.startsWith("nvidia-ceo-transition"))!;
 assert.match(nvidia.sourceUrl,/^https:\/\/www\.sec\.gov\//);
 assert.match(nvidia.reporting,/11 November/);
 assert.match(nvidia.nextTest,/17 November/);
 const fermi=recent.find(r=>r.id.startsWith("fermi-hyperscaler"))!;
 assert.match(fermi.sourceUrl,/^https:\/\/www\.sec\.gov\//);
 assert.match(fermi.reporting,/definitive long-term lease is outstanding/);
 assert.doesNotMatch(fermi.reporting,/Amazon/);
 const hormuz=recent.find(r=>r.id.startsWith("bahrain-drones"))!;
 assert.match(hormuz.reporting,/not independently verified/);
});

test("source-specific categories and cautions survive Newsroom projection",()=>{
 const rows=projectNewsroomEditorial([],recentReportedEditorial(NOW,168),[],"/blue-desk/key-stories",NOW);
 const fermi=rows.find(r=>r.id==="reported:fermi-hyperscaler-600mw-sec-2026-11-12")!;
 const hormuz=rows.find(r=>r.id==="reported:bahrain-drones-hormuz-conflicting-claims-2026-11-13")!;
 assert.ok(fermi.topics.includes("energy")&&fermi.topics.includes("ai"));
 assert.equal(fermi.verificationLabel,"ISSUER SEC EXHIBIT · FINAL LEASE PENDING");
 assert.ok(hormuz.topics.includes("energy"));
 assert.match(hormuz.verificationLabel,/CLAIMS UNVERIFIED/);
 assert.ok(fermi.readerHref.includes("?reported="));
 const hot=selectNewsroomHotPicks([],[],NOW,5,rows);
 assert.ok(hot.keys.length>0);
 assert.equal(new Set(hot.keys).size,hot.keys.length);
});

test("short-lived reportage does not remain in evergreen newsroom windows",()=>{
 assert.equal(reportedEditorialById("nvidia-ceo-transition-sec-2026-11-12",new Date("2026-11-20T00:00:00Z")),null);
 assert.equal(recentReportedEditorial(new Date("2026-11-21T00:00:00Z"),48).length,0);
});
