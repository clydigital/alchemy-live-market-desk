import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {getManualSweeps} from "../lib/bluebelly-manual-sweeps.ts";

const read=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const at=new Date("2026-11-14T03:00:00Z");

test("14 Nov research deltas arrive through existing editor-vetted lenses, not canonical tables",()=>{
 for(const [topic,needle] of [
  ["ai","nvidia-ceo-earnings-governance"],
  ["energy","iea-crude-surplus-product-shortage"],
  ["hormuz","iea-flows-versus-maritime-safety"],
  ["bonds","treasury-curve-squeeze-and-cpi"],
  ["fed","cpi-versus-ppi-market-repricing"],
 ] as const){
  const rows=getManualSweeps(topic,at,6);
  const found=rows.find(row=>row.id.includes(needle));
  assert.ok(found,topic+" missing dated source research");
  assert.equal(found.date,"2026-11-14");
  assert.ok(found.findings.length>=1);
  for(const f of found.findings){
   assert.match(f.sourceUrl,/^https:\/\//);
   assert.ok(f.nextCheck.length>15);
   assert.ok(["SOURCE_CORROBORATED","RESEARCH_LEAD"].includes(f.status));
  }
 }
 const source=read("data/bluebelly-manual-sweeps.json");
 assert.match(source,/surplus in 4Q26/);
 assert.match(source,/diesel/);
 assert.match(source,/not.*GPU orders/i);
});

test("FAA watch is dated, reports only confirmed scope and expires visibly",()=>{
 const shelf=read("components/blue-desk/CurrentKeyStoriesShelf.tsx");
 assert.match(shelf,/data-key-story-incident="faa-ground-stop-2026-11-13"/);
 assert.match(shelf,/22 regional air-traffic control centres/);
 assert.match(shelf,/STALE INCIDENT SNAPSHOT/);
 assert.match(shelf,/2026-11-15T00:00:00Z/);
 assert.match(shelf,/does not establish a currently active stop/);
 assert.match(shelf,/reuters\.com\/world\/us\/faa-issues-national-ground-stop/);
 assert.match(shelf,/l3harris\.com\/newsroom\/press-release\/2026\/07/);
 assert.doesNotMatch(shelf,/service_role|createSupabaseAdminClient|\.upsert\(/);
});

test("Key Stories links IEA oil-vs-diesel and Hormuz-vs-safety evidence without probability claims",()=>{
 const shelf=read("components/blue-desk/CurrentKeyStoriesShelf.tsx");
 assert.match(shelf,/match:"iea-crude-surplus"/);
 assert.match(shelf,/match:"iea-flows"/);
 assert.match(shelf,/match:"cpi-versus-ppi"/);
 assert.doesNotMatch(shelf,/peace probability.*\d+%|probability of peace.*\d+%/i);
});
