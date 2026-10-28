import test from "node:test";
import assert from "node:assert/strict";
import {researchIntakeDisplay} from "../lib/blue-desk/research-intake-display.ts";
import {fetchTodayNotionResearch,selectNotionResearchPages} from "../lib/notion-market-research.ts";
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
  assert.match(ui,/open=\{intake.status==="PARTIAL"\|\|!connection.connected\}/);
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


const GATE_SOURCE="b76f7ce0-ad59-49a1-8aac-61271f310493";
const MACRO_ROOT="3ea519b6-7a94-8161-ba4d-ec8f97ebf658";
const pmId="407519b6-7a94-814f-ad77-fd69d7296f52";
const amId="407519b6-7a94-8125-b8a2-c023f81f9eeb";
const archive29="407519b6-7a94-8183-a1ff-ebfb0544ac4d";
const archive28="406519b6-7a94-81ef-86f7-ded561ad6c41";
const slot29="407519b6-7a94-81b5-a439-eedec342f1f8";
function gateRow(id:string,title:string){
  return {id,parent:{type:"data_source_id",data_source_id:GATE_SOURCE},
    properties:{Run:{type:"title",title:[{plain_text:title}]}}};
}
const am=gateRow(amId,"2026-10-28 08:40 MYT — AM Research Gap Gate");
const pm=gateRow(pmId,"2026-10-28 20:40 MYT — PM Research Gap Investigation");

test("Notion Gate discovery includes exact PM Investigation variant and selects it over AM",()=>{
  const selected=selectNotionResearchPages([am,pm],"2026-10-28");
  assert.equal(selected.gateId,pmId.replaceAll("-",""));
  assert.equal(selectNotionResearchPages([am],"2026-10-28").gateId,amId.replaceAll("-",""));
  assert.equal(selectNotionResearchPages([
    gateRow(pmId,"2026-10-28 20:40 MYT — PM Research Gap unrelated report")
  ],"2026-10-28").gateId,null);
});

test("midnight MYT intake carries yesterday's exact PM run, preserves PARTIAL and labels source editions",async()=>{
  const originalFetch=globalThis.fetch;
  const originalToken=process.env.NOTION_API_TOKEN;
  process.env.NOTION_API_TOKEN="read-only-test-token";
  globalThis.fetch=async(input,init)=>{
    const url=new URL(String(input));
    const path=url.pathname;
    const pfx="/v1/blocks/";
    const respond=(value:unknown)=>new Response(JSON.stringify(value),{status:200,
      headers:{"content-type":"application/json"}});
    if(path==="/v1/search")return respond({results:[],has_more:false});
    if(path==="/v1/data_sources/"+GATE_SOURCE+"/query"){
      const body=JSON.parse(String(init?.body||"{}"));
      return respond({results:body?.filter?.title?.contains==="2026-10-28"?[am,pm]:[],has_more:false});
    }
    if(path.startsWith(pfx+MACRO_ROOT+"/children"))
      return respond({results:[
        {id:archive29,type:"child_page",child_page:{title:"2026-10-29 — MacroPulse"}},
        {id:archive28,type:"child_page",child_page:{title:"2026-10-28 — MacroPulse"}}
      ],has_more:false});
    if(path.startsWith(pfx+archive29+"/children"))
      return respond({results:[{id:slot29,type:"child_page",
        child_page:{title:"00:00 MYT — Official market preflight"}}],has_more:false});
    if(path.startsWith(pfx+slot29+"/children"))
      return respond({results:[{type:"paragraph",paragraph:{
        rich_text:[{plain_text:"Original source-backed research for the 00:00 MYT edition."}]
      }}],has_more:false});
    if(path.startsWith(pfx+pmId+"/children"))
      return respond({results:[{type:"paragraph",paragraph:{
        rich_text:[{plain_text:"Coverage PARTIAL: 68 eligible; 8 full-read."}]
      }}],has_more:false});
    if(path==="/v1/pages/"+pmId)return respond({properties:{
      Run:{type:"title",title:[{plain_text:"2026-10-28 20:40 MYT — PM Research Gap Investigation"}]},
      Status:{select:{name:"PARTIAL"}},Coverage:{select:{name:"PARTIAL"}},
      "Input Health":{select:{name:"PARTIAL"}}
    }});
    throw Error("Unexpected mock Notion request path: "+path);
  };
  try{
    const bundle=await fetchTodayNotionResearch(new Date("2026-10-28T16:22:00Z"));
    const gate=bundle.sources.find(x=>x.kind==="RESEARCH_GAP");
    const pulse=bundle.sources.find(x=>x.kind==="MACROPULSE");
    assert.equal(gate?.pageId,pmId.replaceAll("-",""));
    assert.equal(gate?.title,"2026-10-28 20:40 MYT — PM Research Gap Investigation");
    assert.equal(gate?.editionDay,"2026-10-28");
    assert.equal(gate?.coverageStatus,"PARTIAL");
    assert.equal(pulse?.editionDay,"2026-10-29");
    assert.equal(bundle.status,"PARTIAL");
    assert.ok(bundle.warnings.some(w=>w.includes("Latest accessible Research Gap run is from 2026-10-28")));
    assert.ok(bundle.warnings.some(w=>w.includes("explicitly reports partial coverage")));
    assert.ok(bundle.warnings.every(w=>!w.includes("HTTP 404")));
  }finally{
    globalThis.fetch=originalFetch;
    if(originalToken===undefined)delete process.env.NOTION_API_TOKEN;
    else process.env.NOTION_API_TOKEN=originalToken;
  }
});

test("Research Library shows source vintage rather than mislabelling the fetch as publication time",()=>{
  const ui=readFileSync(new URL("../components/blue-desk/ResearchLibraryExplorer.tsx",import.meta.url),"utf8");
  assert.match(ui,/editionDay/);
  assert.match(ui,/checked "\+safeDate\(source.retrievedAt\)/);
  assert.match(ui,/coverageStatus/);
  assert.match(ui,/Coverage and freshness notes/);
});
