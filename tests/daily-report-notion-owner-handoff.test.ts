import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  selectNotionResearchPages,selectMacroPulseArchiveChild,selectPulseChildPages,extractNotionResearchBlocks,fetchTodayNotionResearch,
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
 assert.match(page,/data-reviewed-daily-report="published-only"/);
 assert.match(page,/publishedDaily\.published_at/);
 assert.match(page,/data-daily-story-coverage="persistent-and-dated"/);
 assert.match(page,/data-market-source-coverage="dated-originals"/);
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

test("Notion plain-text primary links enter the private candidate list but not verified News",()=>{
  const page=[
    {type:"paragraph",paragraph:{rich_text:[{plain_text:
      "Original exchange: https://www.saudiexchange.sa/wps/portal/saudiexchange/ourmarkets/main-market-watch (await final). "+
      "Social view https://x.com/someAnalyst/status/999; " +
      "do not trust http://insecure.example.net/a or https://localhost/secret"}]}},
    {type:"paragraph",paragraph:{rich_text:[{plain_text:
      "Another reference: https://www.saudiexchange.sa/wps/portal/saudiexchange/ourmarkets/main-market-watch"}]}}
  ];
  const result=extractNotionResearchBlocks(page);
  assert.ok(result.links.some(url=>url.startsWith("https://www.saudiexchange.sa/")));
  assert.ok(result.links.some(url=>url.startsWith("https://x.com/")));
  assert.equal(result.links.filter(url=>url.includes("saudiexchange.sa")).length,1);
  assert.ok(result.links.every(url=>url.startsWith("https://")&&!url.includes("localhost")));
  const research=buildDailyResearchPacket({
    now:"2026-10-26T01:00:00Z",news:[],calendar:[],prices:[],
    notion:{status:"PARTIAL",fetchedAt:"2026-10-26T01:00:00Z",warnings:[],sources:[{
      kind:"MACROPULSE",pageId:"404519b67a9481a38404d07a9db4a459",
      title:"Original-source research leads only",
      url:"https://www.notion.so/404519b67a9481a38404d07a9db4a459",
      text:result.text,originalLinks:result.links,
      retrievedAt:"2026-10-26T01:00:00Z",
    }]},
  });
  assert.equal(research.newsCount,0);
  assert.match(research.packet,/RESEARCH INPUT, NOT INDEPENDENT SOURCE VERIFICATION/);
  assert.ok(research.sourceUrls.some(url=>url.includes("x.com/")));
});

test("owner Writer sees exact public source-checked announcements without auto-approving research leads",()=>{
  const api=readFileSync(new URL("../app/api/owner/daily-research/route.ts",import.meta.url),"utf8");
  const writer=readFileSync(new URL("../components/blue-desk/DailyReportWriter.tsx",import.meta.url),"utf8");
  assert.match(api,/getOriginalPressNews\(now,12\)/);
  assert.match(api,/combineQualifiedNews\(motionNews,originalPress,12\)/);
  assert.match(api,/app_access_allowlist/);
  assert.doesNotMatch(api,/\.insert\(|\.upsert\(|\.update\(/);
  assert.match(writer,/setSelectedSources\(" "\)|setSelectedSources\(" "\.trim\(\)\)|setSelectedSources\(""\)/);
  assert.match(writer,/maximum 12/);
  assert.match(writer,/sourceUrls:urls/);
  assert.doesNotMatch(writer,/sourceUrls:research\.sourceUrls/);
  assert.match(writer,/reviewStatus:"UNVERIFIED"/);
});

test("Notion links receive only exact-source receipt matches; no claim or social-post promotion",()=>{
  const document="https://www.federalreserve.gov/newsevents/pressreleases/monetary20261025a.htm";
  const social="https://x.com/creator/status/123";
  const news={
    contractVersion:"news-brief/1" as const,contentType:"NEWS_BRIEF" as const,
    id:"11111111-1111-4111-8111-111111111111",
    headline:"Federal Reserve Board issues a statement on monetary policy",
    summary:"Original official statement; price reaction unknown.",
    sourceName:"Federal Reserve Board",sourceUrl:document,sourceKind:"official",
    occurredAt:"2026-10-25T12:00:00Z",observedAt:"2026-10-25T12:10:00Z",
    verification:"SOURCE_VERIFIED" as const,
  };
  const notion={
    status:"PARTIAL" as const,fetchedAt:"2026-10-25T12:50:00Z",warnings:[],
    sources:[{kind:"MACROPULSE" as const,title:"Research leads",pageId:"404519b67a9481a38404d07a9db4a459",
      url:"https://www.notion.so/404519b67a9481a38404d07a9db4a459",
      retrievedAt:"2026-10-25T12:50:00Z",text:"Issuer statement; social view remains untested.",
      originalLinks:[document,social,document+"?utm_source=notion"]}],
  };
  const result=buildDailyResearchPacket({now:"2026-10-25T12:51:00Z",notion,news:[news],prices:[],calendar:[]});
  assert.equal(result.newsCount,1);
  assert.equal(result.researchSourceCandidates.length,2);
  assert.deepEqual(result.researchSourceCandidates.map(c=>c.verification),
    ["EXACT_NEWS_SOURCE_MATCH","UNVERIFIED_LINK"]);
  assert.equal(result.researchSourceCandidates[0].matchingNewsHeadline,news.headline);
  assert.equal(result.researchSourceCandidates[1].matchingNewsHeadline,null);
  assert.match(result.packet,/research leads only; ALL claims require original-source checks/i);
  const writer=readFileSync(new URL("../components/blue-desk/DailyReportWriter.tsx",import.meta.url),"utf8");
  assert.match(writer,/researchSourceCandidates/);
  assert.match(writer,/Select 1–12 complete original-source HTTPS URLs/);
  assert.doesNotMatch(writer,/sourceUrls:research\.sourceUrls/);
});

test("Notion direct parent/data-source fallback retrieves full today's Pulse and Gate when title search omits them",async()=>{
  const previousFetch=globalThis.fetch;
  const oldToken=process.env.NOTION_API_TOKEN;
  process.env.NOTION_API_TOKEN="mock-notion-token";
  const root="3ea519b67a948161ba4dec8f97ebf658";
  const archive="aaaa1111aaaa41118aaa1111aaaa1111";
  const gate="bbbb2222bbbb42228bbb2222bbbb2222";
  const post10="cccc3333cccc43338ccc3333cccc3333";
  const post08="dddd4444dddd44448ddd4444dddd4444";
  const day="2026-10-26";
  const text=(message:string)=>({results:[
    {type:"paragraph",paragraph:{rich_text:[{plain_text:message}]}}
  ],has_more:false});
  globalThis.fetch=async(url,options)=>{
    const path=String(url);
    const respond=(data:unknown)=>new Response(JSON.stringify(data),
      {status:200,headers:{"Content-Type":"application/json"}});
    if(path.endsWith("/search"))return respond({results:[],has_more:false});
    if(path.includes("/data_sources/")&&path.endsWith("/query")){
      assert.equal(options?.method,"POST");
      const body=JSON.parse(String(options?.body||"{}"));
      assert.equal(body.filter.property,"Run");
      assert.equal(body.filter.title.contains,day);
      return respond({results:[{
        id:gate,parent:{type:"data_source_id",data_source_id:source},
        properties:{Run:{type:"title",title:[{plain_text:day+" 08:40 MYT — AM Research Gap Gate"}]}}
      }],has_more:false});
    }
    if(path.includes("/blocks/"+macro+"/children")||path.includes("/blocks/"+root+"/children"))
      return respond({results:[{id:archive,type:"child_page",
        child_page:{title:day+" — MacroPulse"}}],has_more:false});
    if(path.includes("/blocks/"+archive+"/children"))
      return respond({results:[
        {id:post08,type:"child_page",child_page:{title:"08:00 MYT — full research"}},
        {id:post10,type:"child_page",child_page:{title:"10:00 MYT — full research"}}
      ],has_more:false});
    if(path.includes("/blocks/"+gate+"/children"))return respond(text("Gate reviewed the sources; no market reaction attributed."));
    if(path.includes("/blocks/"+post10+"/children"))
      return respond(text("Primary observation: https://www.federalreserve.gov/newsevents/pressreleases/monetary20261026a.htm"));
    if(path.includes("/blocks/"+post08+"/children"))return respond(text("Morning research notes."))
    if(path.includes("/pages/"+gate))return respond({properties:{
      Status:{type:"select",select:{name:"COMPLETE"}},
      Coverage:{type:"select",select:{name:"COMPLETE"}},
      "Input Health":{type:"select",select:{name:"COMPLETE"}},
    }});
    throw Error("Unexpected direct Notion lookup "+path);
  };
  try{
    const input=new Date("2026-10-26T04:30:00.000Z");
    const result=await fetchTodayNotionResearch(input);
    assert.equal(result.status,"READY_FOR_REVIEW");
    assert.equal(result.sources.length,3);
    assert.ok(result.sources.some(x=>x.kind==="RESEARCH_GAP"));
    assert.ok(result.sources.some(x=>x.title.startsWith("10:00 MYT")));
    assert.ok(result.sources.some(x=>x.originalLinks.some(u=>u.includes("federalreserve.gov"))));
    assert.equal(result.warnings.length,0);
    const rootBlocks=[{id:archive,type:"child_page",child_page:{title:day+" — MacroPulse"}}];
    assert.equal(selectMacroPulseArchiveChild(rootBlocks,day),archive);
    assert.equal(selectMacroPulseArchiveChild(rootBlocks,"2026-10-25"),null);
  }finally{
    globalThis.fetch=previousFetch;
    if(oldToken===undefined)delete process.env.NOTION_API_TOKEN;
    else process.env.NOTION_API_TOKEN=oldToken;
  }
});

test("a configured but unshared or invalid Notion token reports UNAVAILABLE, not merely partial coverage",async()=>{
 const saved=process.env.NOTION_API_TOKEN;
 const previousFetch=globalThis.fetch;
 process.env.NOTION_API_TOKEN="invalid-mock-token";
 globalThis.fetch=async()=>new Response(JSON.stringify({message:"Unauthorized"}),
  {status:401,headers:{"Content-Type":"application/json"}});
 try{
  const state=await fetchTodayNotionResearch(new Date("2026-10-26T04:30:00.000Z"));
  assert.equal(state.status,"UNAVAILABLE");
  assert.equal(state.sources.length,0);
  assert.ok(state.warnings.some(w=>w.includes("data source could not be queried")));
 }finally{
  globalThis.fetch=previousFetch;
  if(saved===undefined)delete process.env.NOTION_API_TOKEN;
  else process.env.NOTION_API_TOKEN=saved;
 }
});
