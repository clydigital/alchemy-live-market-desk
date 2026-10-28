import test from "node:test";
import assert from "node:assert/strict";
import {researchIntakeDisplay} from "../lib/blue-desk/research-intake-display.ts";
import {fetchTodayNotionResearch} from "../lib/notion-market-research.ts";
import {readFileSync} from "node:fs";

const statuses=["NOT_CONFIGURED","UNAVAILABLE","PARTIAL","READY_FOR_REVIEW"] as const;

test("server Notion retrieval failure is never interpreted as an empty research archive",()=>{
  for(const status of statuses.slice(0,2)){
    const info=researchIntakeDisplay({status,sources:[]});
    assert.equal(info.connected,false);
    assert.match(info.label,/server-side/i);
    assert.match(info.detail,/Notion/i);
    assert.doesNotMatch(info.detail,/no research (?:exists|was published)/i);
  }
});

test("connected states distinguish bounded previews from full archive completeness",()=>{
  for(const status of statuses.slice(2)){
    const info=researchIntakeDisplay({status,sources:[]});
    assert.equal(info.connected,true);
    assert.match(info.detail,/(research inputs|additional Notion records)/i);
  }
});

test("Research Library keeps original archive access and no longer claims 26 Oct is the latest",()=>{
  const ui=readFileSync(new URL("../components/blue-desk/ResearchLibraryExplorer.tsx",import.meta.url),"utf8");
  assert.match(ui,/latestPulse\?\.url/);
  assert.match(ui,/researchIntakeDisplay\(intake\)/);
  assert.match(ui,/Browse MacroPulse archives/);
  assert.doesNotMatch(ui,/Open 26 October market map/);
  assert.match(ui,/open=\{!connection.connected\}/);
});


test("a Notion HTTP 404 is an access failure, never proof that today's source was not published",async()=>{
  const previousFetch=globalThis.fetch;
  const previousToken=process.env.NOTION_API_TOKEN;
  process.env.NOTION_API_TOKEN="fixture-only-token";
  globalThis.fetch=async()=>new Response(JSON.stringify({message:"Object not found"}),{
    status:404,headers:{"Content-Type":"application/json"},
  });
  try {
    const state=await fetchTodayNotionResearch(new Date("2026-10-28T14:00:00.000Z"));
    assert.equal(state.status,"UNAVAILABLE");
    assert.equal(state.sources.length,0);
    assert.ok(state.warnings.some(w=>w.includes("root page could not be listed (HTTP 404")));
    assert.ok(state.warnings.some(w=>w.includes("data source could not be queried (HTTP 404")));
    assert.ok(state.warnings.some(w=>w.includes("availability cannot be determined")));
    assert.ok(state.warnings.every(w=>!w.includes("not found in authorised Notion source")));
    const display=researchIntakeDisplay(state);
    assert.equal(display.connected,false);
    assert.equal(display.sourcePermissionWarning,true);
    assert.match(display.label,/source access blocked/i);
    assert.match(display.detail,/does not mean today's research is missing/i);
  }finally {
    globalThis.fetch=previousFetch;
    if(previousToken===undefined)delete process.env.NOTION_API_TOKEN;
    else process.env.NOTION_API_TOKEN=previousToken;
  }
});

test("private Research Library provides a permission-repair route and ranks historical archives last",()=>{
  const ui=readFileSync(new URL("../components/blue-desk/ResearchLibraryExplorer.tsx",import.meta.url),"utf8");
  assert.match(ui,/connection\.sourcePermissionWarning/);
  assert.match(ui,/Add connection and select the existing/);
  assert.match(ui,/rank\[a\.section\]-rank\[b\.section\]/);
  assert.match(ui,/Archives:3/);
});
