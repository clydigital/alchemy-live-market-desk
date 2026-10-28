import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {DAILY_BRIEFING_STEPS,privateNarrativeInstructions} from "../lib/blue-desk-narrative-playbook.ts";

test("one shared-evidence source contract teaches a chronological Daily Report, not a news dump",()=>{
 assert.deepEqual(DAILY_BRIEFING_STEPS.map(x=>x.name),[
  "The setup","The reveal","The teaching moment","The catch","The next decision",
 ]);
 const p=privateNarrativeInstructions("DAILY_REPORT");
 assert.match(p,/Research gathers attributed originals/);
 assert.match(p,/Storytelling can ONLY rearrange and explain/);
 assert.match(p,/one or two numerical comparisons/i);
 assert.match(p,/older and newer levels/);
 assert.match(p,/exact observation dates/);
 assert.match(p,/why the change matters/i);
 assert.match(p,/yield from a credit spread/);
 assert.match(p,/refinancing/);
 assert.match(p,/count of vessels from cargo volumes/);
 assert.match(p,/daily flow from a cumulative total/);
 assert.match(p,/everyday example/);
 assert.match(p,/countercase|competing explanation/i);
 assert.match(p,/what would change my mind/i);
 assert.match(p,/partial/i);
 assert.match(p,/No public publication/);
 assert.doesNotMatch(p,/1,307|1,340|9\.75|11\.7|\$113/);
});

test("one editorial generator serves OB and COTD without making either a second truth engine",()=>{
 const ob=privateNarrativeInstructions("OB");
 const cotd=privateNarrativeInstructions("COTD");
 assert.match(ob,/OPENING BELL: prioritise one timely verified news or macro catalyst/);
 assert.match(cotd,/CHART OF THE DAY: chart\/price-led/);
 assert.match(ob,/one evidence packet/);
 assert.match(cotd,/one evidence packet/);
 const route=readFileSync(new URL("../app/api/owner/editorial-generate/route.ts",import.meta.url),"utf8");
 assert.match(route,/privateNarrativeInstructions\(kind\)/);
 assert.match(route,/app_access_allowlist/);
 assert.match(route,/blueDeskHostAccess/);
 assert.match(route,/PRIVATE_UNVERIFIED_DRAFT/);
 assert.doesNotMatch(route,/createSupabaseAdminClient|story_thesis_versions|from\("stories"\)\.update/);
});

test("private studio shows the same evidence and story desks without changing publication",()=>{
 const page=readFileSync(new URL("../app/owner/daily-report/page.tsx",import.meta.url),"utf8");
 const writer=readFileSync(new URL("../components/blue-desk/DailyReportWriter.tsx",import.meta.url),"utf8");
 const research=readFileSync(new URL("../app/api/owner/daily-research/route.ts",import.meta.url),"utf8");
 assert.match(page,/data-private-daily-report="owner-only"/);
 assert.match(writer,/data-two-desk-briefing="shared-evidence"/);
 assert.match(writer,/DAILY_BRIEFING_STEPS/);
 assert.match(writer,/data-private-narrative-preview="unverified"/);
 assert.match(writer,/kind:"DAILY_REPORT"/);
 assert.match(writer,/not published/);
 assert.match(research,/buildDailyResearchPacket/);
 assert.match(research,/assessDailyResearchHealth/);
 assert.doesNotMatch(research,/insert\(|upsert\(|generateContent/);
});

test("all private writing formats explain earnings beat cash flow capex and missing comparisons",()=>{
 for(const kind of ["DAILY_REPORT","OB","COTD"] as const){
  const p=privateNarrativeInstructions(kind);
  assert.match(p,/MATERIAL RELEASED COMPANY EARNINGS/);
  assert.match(p,/PRE-RELEASE same-metric consensus/);
  assert.match(p,/free cash flow amount/);
  assert.match(p,/cash capex amount/);
  assert.match(p,/capex with commitments/);
  assert.match(p,/NO COMPARABLE CONSENSUS/);
  assert.doesNotMatch(p,/₩104\.6tn|₩83\.3tn/);
 }
 const contract=readFileSync(new URL("../lib/blue-desk-automated-report-contract.ts",import.meta.url),"utf8");
 assert.match(contract,/MATERIAL EARNINGS RELEASE/);
 assert.match(contract,/FCF amount and direction or NOT REPORTED/);
 assert.match(contract,/Never invent missing consensus, FCF, capex/);
});
