import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  selectNotionResearchPages,selectPulseChildPages,extractNotionResearchBlocks,fetchTodayNotionResearch,
} from "../lib/notion-market-research.ts";
import {buildDailyResearchPacket} from "../lib/daily-report-research-packet.ts";
import {parseReviewedSubmission} from "../lib/editorial-publications.ts";
import {blueDeskHostAccess} from "../lib/blue-desk-host.ts";

const day="2026-10-25";
const macro="3ea519b6-7a94-8161-ba4d-ec8f97ebf658";
const source="b76f7ce0-ad59-49a1-8aac-61271f310493";
const title=(value:string)=>({title:[{plain_text:value}]});
test("only exact authorised Notion parents qualify as research input",()=>{
  const rows=[
    {id:"403519b6-7a94-81df-8e29-feaacb0d7bb0",
     parent:{type:"page_id",page_id:macro},properties:{title:title(day+" — MacroPulse")}},
    {id:"404519b6-7a94-8115-afdb-c66b8082561d",
     parent:{type:"data_source_id",data_source_id:source},
     properties:{title:title(day+" 20:40 MYT — PM Research Gap Gate")}},
    {id:"404519b6-7a94-8129-86c2-e49a03021823",
     parent:{type:"data_source_id",data_source_id:source},
     properties:{title:title(day+" 08:40 MYT — AM Research Gap Gate")}},
    {id:"ffffffff-ffff-ffff-ffff-ffffffffffff",
     parent:{type:"page_id",page_id:"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"},
     properties:{title:title(day+" — MacroPulse")}},
  ];
  assert.deepEqual(selectNotionResearchPages(rows,day),{
    archiveId:"403519b67a9481df8e29feaacb0d7bb0",
    gateId:"404519b67a948115afdbc66b8082561d",
  });
  assert.deepEqual(selectNotionResearchPages(rows,day.replace("25","26")),{
    archiveId:null,gateId:null,
  });
});

test("slot selection uses explicit MYT slot, not page insertion or modification time",()=>{
  const blocks=[
    {type:"child_page",id:"404519b6-7a94-8157-a445-c71e742326ff",
      child_page:{title:"25 Oct 2026 · 18:00 MYT — Gulf market update"}},
    {type:"child_page",id:"404519b6-7a94-81b8-ba7a-c26a5e57b627",
      child_page:{title:"20:00 MYT — Pakistan LPG and Saudi risk"}},
    {type:"child_page",id:"404519b6-7a94-812d-9f2d-384c49874a5",
      child_page:{title:"25 Oct 2026 · 12:00 MYT — airport sources"}},
  ];
  assert.match(selectPulseChildPages(blocks,2)[0].title,/20:00/);
  assert.match(selectPulseChildPages(blocks,2)[1].title,/18:00/);
  assert.equal(selectPulseChildPages(blocks,0).length,0);
});
test("research page parser preserves source URLs, not claim-level verification",()=>{
  const blocks=[
    {type:"heading_2",heading_2:{rich_text:[{plain_text:"What changed"}]}},
    {type:"paragraph",paragraph:{rich_text:[
      {plain_text:"Official observation recorded ",
        href:null},
      {plain_text:"TASI 15:00 AST (NOT FINAL)",href:"https://www.saudiexchange.sa/main"},
    ]}},
  ];
  const v=extractNotionResearchBlocks(blocks);
  assert.match(v.text,/15:00 AST \(NOT FINAL\)/);
  assert.deepEqual(v.links,["https://www.saudiexchange.sa/main"]);
});
test("source packet refuses to upgrade Notion / Gate hypotheses to verified market price reactions",()=>{
  const notional={
    status:"PARTIAL" as const,fetchedAt:"2026-10-25T12:50:00Z",
    warnings:["27 qualifying MacroPulse posts not reviewed"],
    sources:[{kind:"RESEARCH_GAP" as const,title:"PM Research Gap Gate",
      url:"https://www.notion.so/404519b67a948115afdbc66b8082561d",
      pageId:"404519b67a948115afdbc66b8082561d",
      retrievedAt:"2026-10-25T12:50:00Z",
      text:"TASI late intraday observed; Monday US cash reaction UNKNOWN.",
      originalLinks:["https://www.saudiexchange.sa/main"]}],
  };
  const result=buildDailyResearchPacket({now:"2026-10-25T12:51:00Z",notion:notional,
    news:[],prices:[],calendar:[]});
  assert.equal(result.notionStatus,"PARTIAL");
  assert.match(result.packet,/27 qualifying MacroPulse posts not reviewed/);
  assert.match(result.packet,/RESEARCH INPUT, NOT INDEPENDENT SOURCE VERIFICATION/);
  assert.match(result.packet,/Price\/context source unavailable/);
  assert.match(result.packet,/No source-verified recent news/);
  assert.ok(result.sourceUrls.includes("https://www.saudiexchange.sa/main"));
  assert.ok(result.packet.length<=23800);
});

test("existing authorised writer can draft a Daily Report, owner publication approval remains distinct",()=>{
 const gen=readFileSync(new URL("../app/api/owner/editorial-generate/route.ts",import.meta.url),"utf8");
 const source=readFileSync(new URL("../app/api/owner/daily-research/route.ts",import.meta.url),"utf8");
 const writer=readFileSync(new URL("../components/blue-desk/DailyReportWriter.tsx",import.meta.url),"utf8");
 assert.match(gen,/body.kind==="DAILY_REPORT"/);
 assert.match(gen,/MacroPulse and Research Gap Notion pages are UNVERIFIED/);
 assert.match(gen,/app_access_allowlist/);
 assert.match(gen,/origin/);
 assert.match(source,/app_access_allowlist/);
 assert.match(source,/fetchTodayNotionResearch/);
 assert.match(source,/private, no-store/);
 assert.doesNotMatch(source,/createSupabaseAdminClient|insert\(|upsert\(|generateContent/);
 assert.match(writer,/kind:"DAILY_REPORT"/);
 assert.match(writer,/PRIVATE WORKSPACE/);
 assert.equal(blueDeskHostAccess("/api/owner/daily-research","bluebelly-desk.vercel.app"),"blocked");
 assert.equal(blueDeskHostAccess("/owner/daily-report","bluebelly-desk.vercel.app"),"blocked");
 assert.equal(blueDeskHostAccess("/api/owner/daily-research","preview.vercel.app"),"private");
});

test("reviewed Daily Report uses existing PDF approval contract, SQL RLS and dedicated reader",()=>{
 const base={
  kind:"DAILY_REPORT",title:"Daily Market Report — 25 October 2026",
  meta:"Verified catalysts, causes and questions for next week.",
  body:"Original source observations and their actual timestamps remain distinct. ".repeat(6),
  sources:"https://www.saudiexchange.sa/main",
 };
 assert.equal(parseReviewedSubmission(base)?.kind,"DAILY_REPORT");
 assert.equal(parseReviewedSubmission({...base,kind:"UNVERIFIED_ANALYSIS"}),null);
 const migration=readFileSync(new URL("../supabase/migrations/20261025154229_daily_report_editorial_kind_20261025.sql",import.meta.url),"utf8");
 assert.match(migration,/check \(kind in \('COTD','OB','DAILY_REPORT'\)\)/);
 assert.doesNotMatch(migration,/grant insert|grant update|grant delete/i);
 const pub=readFileSync(new URL("../components/blue-desk/ReportPublisher.tsx",import.meta.url),"utf8");
 assert.match(pub,/DAILY_REPORT/);
 assert.match(pub,/sourcesChecked/);
 const publicReader=readFileSync(new URL("../lib/editorial-publications-server.ts",import.meta.url),"utf8");
 assert.match(publicReader,/getLatestPublishedDailyReport/);
 assert.match(publicReader,/\.eq\("kind","DAILY_REPORT"\)/);
 assert.match(publicReader,/\.neq\("kind","DAILY_REPORT"\)/);
 const page=readFileSync(new URL("../app/blue-desk/daily-report/page.tsx",import.meta.url),"utf8");
 assert.match(page,/getLatestPublishedDailyReport/);
 assert.match(page,/Reviewed research references/);
});

test("Notion Gate discovery uses the real Run title property, not Name or title",()=>{
  const rows=[
    {id:"403519b6-7a94-81df-8e29-feaacb0d7bb0",
     parent:{type:"page_id",page_id:macro},properties:{title:{type:"title",title:[{plain_text:day+" — MacroPulse"}]}}},
    {id:"404519b6-7a94-8115-afdb-c66b8082561d",
     parent:{type:"data_source_id",data_source_id:source},
     properties:{Run:{id:"title",type:"title",title:[{plain_text:day+" 20:40 MYT — PM Research Gap Gate"}]}}},
    {id:"404519b6-7a94-8129-86c2-e49a03021823",
     parent:{type:"data_source_id",data_source_id:source},
     properties:{Run:{id:"title",type:"title",title:[{plain_text:day+" 08:40 MYT — AM Research Gap Gate"}]}}},
  ];
  assert.deepEqual(selectNotionResearchPages(rows,day),{
    archiveId:"403519b67a9481df8e29feaacb0d7bb0",
    gateId:"404519b67a948115afdbc66b8082561d",
  });
});

test("MYT midnight handoff uses real prior-day Pulse and PARTIAL Gate without pretending current coverage",async()=>{
  const previousFetch=globalThis.fetch,previousToken=process.env.NOTION_API_TOKEN;
  process.env.NOTION_API_TOKEN="unit-test-notion-read-only";
  const macroId="403519b67a9481df8e29feaacb0d7bb0";
  const gateId="404519b67a948115afdbc66b8082561d";
  const p22="404519b67a9481a38404d07a9db4a459";
  const p20="404519b67a9481b8ba7ac26a5e57b627";
  const gateRun=day+" 20:40 MYT — PM Research Gap Gate";
  const pageRows=[
    {id:macroId,parent:{page_id:macro},properties:{title:{type:"title",title:[{plain_text:day+" — MacroPulse"}]}}},
    {id:gateId,parent:{data_source_id:source},properties:{Run:{type:"title",title:[{plain_text:gateRun}]}}},
  ];
  const body=(text:string)=>({results:[{type:"paragraph",paragraph:{rich_text:[{plain_text:text}]}}],has_more:false});
  globalThis.fetch=async(input,init)=>{
    const url=String(input);
    let response:unknown;
    if(url.endsWith("/search")){
      const payload=JSON.parse(String(init?.body||"{}"));
      response={results:payload.query==="2026-10-25"?pageRows:[],has_more:false};
    }else if(url.includes("/blocks/"+macroId.replaceAll("-","")+"/children")){
      response={results:[
        {type:"child_page",id:p20,child_page:{title:"20:00 MYT — Evening market research"}},
        {type:"child_page",id:p22,child_page:{title:"22:00 MYT — Latest market research"}},
      ],has_more:false};
    }else if(url.includes("/blocks/"+gateId.replaceAll("-","")+"/children")){
      response=body("Research Gap completed 8 inputs, 27 unconsumed eligible; no verified market reaction.");
    }else if(url.includes("/blocks/"+p22.replaceAll("-","")+"/children")){
      response=body("Latest verified research lead; original-source check still needed.");
    }else if(url.includes("/blocks/"+p20.replaceAll("-","")+"/children")){
      response=body("Earlier observed research lead; no canonical verdict.");
    }else if(url.includes("/pages/"+gateId.replaceAll("-",""))){
      response={properties:{
        Status:{type:"select",select:{name:"PARTIAL"}},
        Coverage:{type:"select",select:{name:"PARTIAL"}},
        "Input Health":{type:"select",select:{name:"PARTIAL"}},
      }};
    }else throw Error("Unexpected Notion test request: "+url);
    return new Response(JSON.stringify(response),{status:200,headers:{"Content-Type":"application/json"}});
  };
  try{
    const result=await fetchTodayNotionResearch(new Date("2026-10-25T16:41:00.000Z"));
    assert.equal(result.status,"PARTIAL");
    assert.equal(result.sources.length,3);
    assert.match(result.sources[0].title,/2026-10-25/);
    assert.match(result.sources[1].title,/22:00/);
    assert.match(result.sources[2].title,/20:00/);
    assert.ok(result.warnings.some(w=>w.includes("2026-10-25 MYT")));
    assert.ok(result.warnings.some(w=>w.includes("partial coverage")));
    assert.equal(result.sources.some(s=>s.title.includes("2026-10-26")),false);
  }finally{
    globalThis.fetch=previousFetch;
    if(previousToken===undefined)delete process.env.NOTION_API_TOKEN;
    else process.env.NOTION_API_TOKEN=previousToken;
  }
});
