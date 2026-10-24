import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
 validInvestigationInput,projectGroundedInvestigation,
 safeGroundingUrl,investigationSystemInstruction,
 investigationToDraftPacket,mergeInvestigationIntoDraftPacket,
} from "../lib/editorial-investigation.ts";
import { blueDeskHostAccess } from "../lib/blue-desk-host.ts";

const issuer="https://investor.atmeta.com/investor-news/press-release-details/2026/Meta-Reports-Third-Quarter-2026-Results/";
const fed="https://www.federalreserve.gov/newsevents/pressreleases/monetary20260916a.htm";
const packet="Previous Dossier reports higher oil and lower Treasury yields. "+
 "Brent and Treasury observations use different sources and clocks; "+
 "release-window Fed funds futures have not been measured. Do not assert causality.";
const modeCases=[
 ["IMPACT","What happened at the 14 October CPI release and how did rates react?"],
 ["COTD","Is the 4H Brent 20 EMA band holding after the latest Gulf catalyst?"],
 ["OB","Why did US Treasury yields fall while crude strengthened overnight?"],
] as const;
test("three reader routes share one bounded investigation contract, rather than three reasoning engines",()=>{
 for(const [mode,question] of modeCases){
  const result=validInvestigationInput({mode,question,packet});
  assert.equal(result?.mode,mode);
  assert.match(investigationSystemInstruction(mode),/STRONGEST COUNTERCASE/);
  assert.match(investigationSystemInstruction(mode),/EXPECTED VS OBSERVED/);
  assert.match(investigationSystemInstruction(mode),/UNKNOWN/);
 }
 assert.equal(validInvestigationInput({mode:"STORY",question:modeCases[0][1],packet}),null);
 assert.equal(validInvestigationInput({mode:"OB",question:"oil",packet}),null);
 assert.equal(validInvestigationInput({mode:"OB",question:modeCases[2][1],packet:"notes"}),null);
 assert.equal(validInvestigationInput({mode:"IMPACT",question:modeCases[0][1],packet:packet.repeat(200)}),null);
});
test("grounding returns attributable leads and defensible status, never verified Evidence",()=>{
 const response={text:"WHAT IS NEW: Meta reported cash flow. EXPECTED VS OBSERVED: direct-quarter CFO differs "+
  "from SEC YTD subtraction. MOST PLAUSIBLE MECHANISM: limited definition. "+
  "STRONGEST COUNTERCASE: financing leases. NEXT DECIDING TEST: company IR reconciliation. "+
  "PRIMARY SOURCE CHECKS STILL NEEDED: confirm filing. OUTPUT ROUTE: OB only after review.",
  groundingMetadata:{
   groundingChunks:[
    {web:{title:"Meta investor relations",uri:issuer}},
    {web:{title:"Fed rate decision",uri:fed}},
    {web:{title:"Localhost bait",uri:"http://127.0.0.1/private"}},
    {web:{title:"Duplicate source",uri:issuer}},
   ],
   groundingSupports:[
    {segment:{text:"Issuer quarterly CFO was reported in the Meta results."},groundingChunkIndices:[0,1,1]},{segment:{text:"Fed press statement published."},groundingChunkIndices:[0]},{segment:{text:"Unsupported internal link."},groundingChunkIndices:[999]},
   ],
   webSearchQueries:["Meta quarterly cash flow filing","Fed statement site:federalreserve.gov"],
  }};
 const obj=projectGroundedInvestigation(response,"OB");
 assert.equal(obj?.status,"RESEARCH_LEADS_UNVERIFIED");
 assert.equal(obj?.canPublish,false);
 assert.equal(obj?.groundedSupportCount,2);
 assert.equal(obj?.sources.length,2);
 assert.equal(obj?.sources[0].supportCount,2);
 assert.equal(obj?.sources[1].supportCount,1);
 assert.equal(obj?.searchQueries.length,2);
 assert.equal(obj?.claimSupports.length,2);
 assert.deepEqual(obj?.claimSupports[0].urls,[issuer,fed]);
 assert.deepEqual(obj?.claimSupports[1].urls,[issuer]);
 assert.ok(!obj?.claimSupports.some(x=>x.excerpt.includes("internal")));

 assert.match(obj?.limitations.join(" "),/not independently admitted canonical Evidence/);
 const injected=investigationToDraftPacket(obj);
 assert.match(injected,/NONCANONICAL AND UNVERIFIED/);
 assert.match(injected,/original source NOT independently checked/);
 assert.match(injected,/NOT independently checked/);
 assert.ok(injected.includes(issuer));
 assert.ok(injected.length<=10_000);
 const huge="Raw owner context ".repeat(2000);
 const merged=mergeInvestigationIntoDraftPacket(huge,obj);
 assert.ok(merged.length<=24_000);
 assert.ok(merged.includes("NONCANONICAL AND UNVERIFIED"));
 assert.ok(merged.includes(issuer));
 assert.equal(mergeInvestigationIntoDraftPacket("A",null),"A");
});
test("no machine-readable grounding is not silently passed off as verified",()=>{
 const obj=projectGroundedInvestigation({text:"A".repeat(210),groundingMetadata:{}}, "IMPACT");
 assert.ok(obj);
 assert.equal(obj?.sources.length,0);
 assert.equal(obj?.groundedSupportCount,0);
 assert.match(obj?.limitations.join(" "),/No machine-readable grounding sources/);
 assert.equal(projectGroundedInvestigation({text:"Too short"},"OB"),null);
});
test("search-result URLs cannot be javascript, HTTP, credentials or internal resources",()=>{
 for(const url of [
  "http://sec.gov/report",
  "javascript:alert(1)",
  "https://localhost/admin",
  "https://127.0.0.1/data",
  "https://internal.local/secret",
  "https://user:pass@example.com/data",
  "https://server.internal/data",
  "https://example.com:8443/source",
 ]){
  assert.equal(safeGroundingUrl(url),null,url);
 }
 assert.equal(safeGroundingUrl(issuer),issuer);
});
test("owner route has identical auth, same-origin and host protections as legacy writer",()=>{
 const route=readFileSync(new URL("../app/api/owner/editorial-investigate/route.ts",import.meta.url),"utf8");
 assert.match(route,/createSupabaseServerClient/);
 assert.match(route,/auth\.getUser\(\)/);
 assert.match(route,/app_access_allowlist/);
 assert.match(route,/u\.host!==host|url\.host!==host/);
 assert.match(route,/blueDeskHostAccess\("\/api\/owner\/editorial-investigate",host\)/);
 assert.match(route,/tools:\[\{googleSearch:\{\}\}\]/);
 assert.match(route,/maxDuration=60/);
 assert.match(route,/Cache-Control.*private, no-store/);
 assert.doesNotMatch(route,/createSupabaseAdminClient|story_thesis_versions|persistSensorMemory|\\.from\("intelligence_evidence"\)/);
 assert.equal(blueDeskHostAccess("/api/owner/editorial-investigate","bluebelly-desk.vercel.app"),"blocked");
 assert.equal(blueDeskHostAccess("/api/owner/editorial-investigate","alchemy-live-market-desk.vercel.app"),"private");
});
test("editorial UI offers explicit investigation, opt-in research and existing draft generation",()=>{
 const ui=readFileSync(new URL("../components/blue-desk/InvestigationWorkbench.tsx",import.meta.url),"utf8");
 const writer=readFileSync(new URL("../components/blue-desk/EditorialWorkbench.tsx",import.meta.url),"utf8");
 assert.match(ui,/Investigate sources and countercase/);
 assert.match(ui,/Immediate impact/);
 assert.match(ui,/Chart-led COTD/);
 assert.match(ui,/Opening Bell/);
 assert.match(ui,/onUse\(result\)/);
 assert.match(ui,/RESEARCH LEADS.*UNVERIFIED/);
 assert.match(ui,/Passages with search-provider source links/);
 assert.match(writer,/mergeInvestigationIntoDraftPacket\(writingRequest\(draft,selected\),investigation\)/);
 assert.match(writer,/packet:mergeInvestigationIntoDraftPacket\(/);
 assert.match(writer,/setInvestigation\(null\)/);
});
