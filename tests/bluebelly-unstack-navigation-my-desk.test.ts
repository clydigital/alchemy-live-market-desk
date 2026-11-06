import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {blueDeskHostAccess} from "../lib/blue-desk-host.ts";
const read=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const header=read("components/blue-desk/BlueDeskHeader.tsx");
const desk=read("app/my-reports/page.tsx");
const navLinks=(kind:"PRIVATE_NAV"|"PUBLIC_NAV"|"PUBLIC_MORE")=>{
 const section=header.split("const "+kind+" = [")[1]?.split("] as const;")[0]||"";
 return [...section.matchAll(/\["([^"]+)",\s*"([^"]+)"\]/g)].map(match=>({label:match[1],href:match[2]}));
};

test("Unstacked Bluebelly exposes three market-first utilities with owner CTA outside nav",()=>{
 assert.deepEqual(navLinks("PUBLIC_NAV"),[
  {label:"Markets",href:"/markets"},
  {label:"Calendar",href:"/calendar"},
  {label:"Watch",href:"/key-stories"},
 ]);
 assert.ok(navLinks("PUBLIC_MORE").some(x=>x.label==="Source Feed"&&x.href==="/newsroom"));
 assert.ok(navLinks("PUBLIC_MORE").some(x=>x.label==="Research Archive"&&x.href==="/research"));
 assert.match(header,/href="\/my-reports">My Desk/);
 for(const link of navLinks("PUBLIC_NAV")){
  assert.equal(blueDeskHostAccess(link.href,"bluebelly-desk.vercel.app"),"public");
 }
 for(const link of navLinks("PUBLIC_MORE")){
  assert.equal(blueDeskHostAccess(link.href,"bluebelly-desk.vercel.app"),"public");
 }
});

test("Owner header limits direct destinations; research, X Wire and tools live inside My Desk",()=>{
 const direct=navLinks("PRIVATE_NAV");
 assert.deepEqual(direct.map(x=>x.label),["Markets","Calendar","Watch","My Desk"]);
 assert.ok(direct.length<=5);
 for(const path of ["/my-reports","/power-stack","/owner/research","/owner/x-wire","/market-tools"]){
  assert.equal(blueDeskHostAccess(path,"bluebelly-desk.vercel.app"),"private",path);
 }
 assert.equal(blueDeskHostAccess("/owner/daily-report","bluebelly-desk.vercel.app"),"private");
 for(const route of ["/owner/research","/owner/x-wire","/market-tools"]){
  assert.ok(desk.includes('href="'+route+'"'),route);
 }
});

test("My Desk removes report generation and Daily Intelligence UI, not the protected data stores",()=>{
 assert.match(desk,/data-private-desk="source-first-market-workspace"/);
 assert.match(desk,/data-my-desk-primary="market-research-shortcuts"/);
 assert.match(desk,/data-my-desk-portfolio-status="not-verified"/);
 assert.doesNotMatch(desk,/OwnerDailyIntelligenceHome|OwnerDailyTopicIdeas|OwnerDailyReportAttachments|OwnerPrivatePdfInputHealth|OwnerAutomaticReportReader|DailyReportWriter/);
 assert.doesNotMatch(desk,/createSupabaseAdminClient|generateContent|\.insert\(|\.upsert\(|\.delete\(/);
 assert.match(desk,/index:false,follow:false/);
 const archives=read("lib/bluebelly-owner-daily-intelligence.ts");
 const slate=read("lib/bluebelly-owner-report-led-ideas.ts");
 const protectedReader=read("app/api/owner/html-editions/route.ts");
 assert.match(archives,/blue_desk_private_html_editions/);
 assert.match(archives,/blue_desk_work_html_editions/);
 assert.match(slate,/html_sha256===latest\.htmlSha256/);
 assert.match(protectedReader,/app_access_allowlist/);
 assert.match(protectedReader,/getUser\(\)/);
});
