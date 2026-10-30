import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {projectPublicArchive,publicArchiveSearchIndex,type PublicArchiveRow} from "../lib/bluebelly-publication-archive.ts";

const NOW=new Date("2026-10-30T11:00:00.000Z");
const base:PublicArchiveRow={
 record_key:"amazon-2026q3",event_type:"EARNINGS",
 headline:"Amazon Q3 2026 official revenue and cash research",
 event_at:null,event_day:"2026-10-29",
 source_url:"https://ir.aboutamazon.com/news-release/2026/q3",
 source_name:"Amazon Investor Relations",
 reader_href:"/key-stories?postEvent=amazon-2026q3",
 source_module:"lib/blue-desk-earnings-results.ts",
 topics:["AI_TECHNOLOGY","EQUITIES"],entity_keys:["AMZN"],
 publication_basis:"OBSERVED_PUBLIC_READER",approved_publication_id:null,
};
const project=(rows:PublicArchiveRow[],now=NOW)=>projectPublicArchive(rows,now);
test("a reviewed public article appears in the seven-day index, but not as editor-approved publication",()=>{
 const x=project([base]);assert.equal(x.length,1);
 assert.equal(x[0].id,"amazon-2026q3");
 assert.equal(x[0].eventDay,"2026-10-29");
 assert.equal(x[0].eventAt,null);
 assert.equal(x[0].verificationLabel,"REVIEWED PUBLIC READER SNAPSHOT");
 assert.deepEqual(x[0].entityKeys,["AMZN"]);
});
test("seven-day expiry is a public projection only and does not delete backend records",()=>{
 assert.equal(project([base],new Date("2026-11-09T10:00:00.000Z")).length,0);
 assert.equal(base.event_day,"2026-10-29");
 assert.equal(base.reader_href,"/key-stories?postEvent=amazon-2026q3");
});
test("actual timestamps and date-only event clocks stay different",()=>{
 const bank={...base,record_key:"fed-2026-10-28",event_type:"POLICY_DECISION",
  event_at:"2026-10-28T18:00:00+00:00",event_day:null,
  source_module:"lib/bluebelly-bank-decision-snapshots.ts",
  reader_href:"/key-stories?postEvent=fed-2026-10-28"};
 assert.equal(project([bank])[0]?.eventAt,bank.event_at);
 assert.equal(project([{...bank,event_day:"2026-10-28"}]).length,0);
 assert.equal(project([{...base,event_day:"2026-02-30"}]).length,0);
});
test("deduplicate exact record keys without merging unrelated published announcements",()=>{
 const a={...base};
 const b={...base,record_key:"intel-2026q3",source_name:"Intel",
  source_url:"https://www.intc.com/2026/q3",reader_href:"/key-stories?postEvent=intel-2026q3"};
 assert.equal(project([a,a,b]).length,2);
});
test("unsupported origin, offsite reader, nonexistent URL and missing approval receipt are rejected",()=>{
 assert.equal(project([{...base,source_module:"lib/private-owner-research.ts"}]).length,0);
 assert.equal(project([{...base,reader_href:"https://example.com/article"}]).length,0);
 assert.equal(project([{...base,reader_href:"/key-stories?postEvent=someone-else"}]).length,0);
 assert.equal(project([{...base,source_url:"http://fake.com/report"}]).length,0);
 assert.equal(project([{...base,publication_basis:"APPROVED_WITH_RECEIPT"}]).length,0);
});
test("the public archive index preserves approved versus reviewed-only labels",()=>{
 const r={...base,publication_basis:"APPROVED_WITH_RECEIPT",
  approved_publication_id:"00000000-0000-4000-8000-000000000001"};
 assert.equal(project([r])[0]?.verificationLabel,"APPROVED PUBLICATION");
});
test("source tags and entity list are bounded and controlled",()=>{
 assert.equal(project([{...base,topics:["AI","EQUITIES"]}]).length,0);
 assert.equal(project([{...base,topics:["AI_TECHNOLOGY","EQUITIES"],entity_keys:["../private"]}]).length,0);
});
test("newsroom shares search/category counts with archived readers without granting client database access",()=>{
 const page=readFileSync(new URL("../app/blue-desk/newsroom/page.tsx",import.meta.url),"utf8");
 const reader=readFileSync(new URL("../components/blue-desk/BluebellyNewsWire.tsx",import.meta.url),"utf8");
 const adapter=readFileSync(new URL("../lib/bluebelly-publication-archive-server.ts",import.meta.url),"utf8");
 assert.match(page,/getRecentArchivedPublicReaderItems\(now\)/);
 assert.match(page,/archiveEntries=\{archiveResult\.items\}/);
 assert.match(reader,/data-newsroom-archived-reader=/);
 assert.match(reader,/archiveOnly=archiveEntries\.filter/);
 assert.match(reader,/archiveVisible=archiveOnly\.filter/);
 assert.match(reader,/visibleCount=visible\.length\+archiveVisible\.length\+editorialVisible\.length/);
 assert.match(reader,/newsOnly=news\.filter\(n=>!archiveEntries\.some/);
 assert.match(adapter,/import "server-only"/);
 assert.match(adapter,/createSupabaseAdminClient/);
 assert.match(adapter,/projectPublicArchive/);
 assert.doesNotMatch(reader,/SUPABASE_SERVICE_ROLE_KEY|createSupabaseAdminClient|\.from\(/);
});
test("archive migration is backend-private and seeds only previously existing public reader IDs",()=>{
 const sql=readFileSync(new URL("../supabase/migrations/20261030110000_bluebelly_publication_archive.sql",import.meta.url),"utf8");
 assert.match(sql,/create table if not exists public\.bluebelly_publication_archive/);
 assert.match(sql,/enable row level security/);
 assert.match(sql,/revoke all on public\.bluebelly_publication_archive from anon,authenticated/);
 assert.match(sql,/on conflict \(record_key\) do nothing/);
 for(const k of ["fed-2026-10-28","boc-2026-10-28","rbnz-2026-10-28",
  "amazon-2026q3","intel-2026q3","sandisk-fy2027q1","sk-hynix-2026q3",
  "tsmc-2026q3","bea-pce-september-2026"])assert.ok(sql.includes(k),k);
 assert.doesNotMatch(sql,/grant select .*bluebelly_publication_archive/i);
});

test("FOMC and PCE aliases are discoverable without modifying review metadata",()=>{
 const fed={...base,record_key:"fed-2026-10-28",event_type:"POLICY_DECISION",
   event_day:null,event_at:"2026-10-28T18:00:00+00:00",entity_keys:["FED"],
   source_module:"lib/bluebelly-bank-decision-snapshots.ts",
   reader_href:"/key-stories?postEvent=fed-2026-10-28"};
 const result=project([fed]);
 assert.equal(result.length,1);
 assert.ok(publicArchiveSearchIndex(result[0]).includes("fomc"));
 assert.ok(publicArchiveSearchIndex(result[0]).includes("federal open market committee"));
 assert.equal(result[0].headline,base.headline);
 const pce={...base,record_key:"bea-pce-september-2026",event_type:"ECONOMIC_RELEASE",
   event_day:null,event_at:"2026-10-29T12:30:00+00:00",entity_keys:["US-PCE"],
   source_module:"lib/blue-desk-official-macro-results.ts",
   reader_href:"/key-stories?brief=bea-pce-september-2026"};
 assert.ok(publicArchiveSearchIndex(project([pce])[0]).includes("personal consumption expenditures"));
});
