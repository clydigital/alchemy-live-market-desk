import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {getManualSweeps} from "../lib/bluebelly-manual-sweeps.ts";
import {NVIDIA_EARNINGS_WATCH,nvidiaEventState} from "../lib/bluebelly-nvidia-earnings-watch.ts";
const read=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("Key Stories default now leads with reviewed current stories, not only old thesis memory",()=>{
 const page=read("app/blue-desk/key-stories/page.tsx");
 const lean=read("components/blue-desk/LeanWatch.tsx");
 const shelf=read("components/blue-desk/CurrentKeyStoriesShelf.tsx");
 assert.match(page,/return <LeanWatch stories=\{orderStoriesByLatestMotion\(tracked,linkedMotion,now\).slice\(0,8\)\} host=\{host\} now=\{now\}\/>/);
 assert.match(lean,/<CurrentKeyStoriesShelf now=\{now\} host=\{host\}\/>/);
 assert.ok(lean.indexOf("<CurrentKeyStoriesShelf")<lean.indexOf('id="tracked-theses"'));
 assert.match(shelf,/data-key-story-lead="nvidia-leadership-q3"/);
 assert.match(shelf,/data-key-stories-current="source-reviewed-featured-not-canonical"/);
 assert.match(shelf,/nvidia-ceo-earnings-november-2026/);
 assert.match(shelf,/ai-compute-financing-november-2026/);
 assert.match(shelf,/1acd67c7-e804-48bf-9ee7-97a2f96be283/);
 assert.match(shelf,/fdddf542-68f9-4576-9fde-812af424c724/);
 assert.match(shelf,/find\(f=>f.status==="SOURCE_CORROBORATED"\)/);
 assert.doesNotMatch(shelf,/createSupabaseAdminClient|power_stack_owner_snapshots|service_role|generateText\(/);
});

test("New editorial feature routes use exact allowlisted feature strings, not arbitrary unpublished IDs",()=>{
 const page=read("app/blue-desk/key-stories/page.tsx");
 assert.match(page,/params\?\.feature==="nvidia-ceo-earnings-november-2026"/);
 assert.match(page,/params\?\.feature==="ai-compute-financing-november-2026"/);
 assert.match(page,/data-publication-state="source-reviewed-not-canonical"/);
 assert.match(page,/<CurrentKeyStoryArticle kind=\{currentEdition\} now=\{now\}/);
 assert.ok(page.indexOf("const currentEdition=")<page.indexOf("const recapId="));
 assert.match(page,/storyDepthForNews\(event\)/);
 assert.match(page,/getOriginalPressNews\(now,18,7\)/);
 const article=read("components/blue-desk/CurrentKeyStoryArticle.tsx");
 assert.match(article,/data-current-key-story=\{kind\}/);
 assert.match(article,/<NvidiaEarningsDecisionWatch mode="regime" now=\{now\}\/>/);
 assert.match(article,/No collapse in GPU orders has been established|no collapse in GPU orders has been established/i);
 assert.match(article,/Turnover is two-sided/);
 assert.match(article,/UNTESTED/);
 assert.match(article,/investors need to see|Next evidence:/);
 assert.doesNotMatch(article,/createSupabaseAdminClient|power_stack_owner_snapshots/);
});

test("Power Stack is an owner-authenticated decision terminal even when historical snapshot unavailable",()=>{
 const page=read("app/power-stack/page.tsx");
 const component=read("components/blue-desk/PowerStackDecisionHub.tsx");
 assert.match(page,/<h1>Power Stack<\/h1>/);
 assert.match(page,/<PowerStackDecisionHub now=\{researchedAt\}\/>/);
 assert.match(page,/<NvidiaEarningsDecisionWatch mode="power-stack"/);
 assert.ok(page.indexOf("auth.getUser()")<page.indexOf("<PowerStackDecisionHub"));
 assert.ok(page.indexOf('app_access_allowlist')<page.indexOf("<PowerStackDecisionHub"));
 assert.ok(page.indexOf("<PowerStackDecisionHub")<page.indexOf("!ready ? ("));
 assert.ok(page.indexOf('<NvidiaEarningsDecisionWatch mode="power-stack"')<page.indexOf("!ready ? ("));
 assert.ok(page.indexOf('const holdings = ready')<page.indexOf('<NvidiaEarningsDecisionWatch mode="power-stack"'));
 assert.match(page,/legacy_source_retired === true/);
 assert.match(component,/data-power-stack-terminal="owner-only-source-gated-ideas"/);
 assert.match(component,/Investment ideas/);
 assert.match(component,/Short trade ideas/);
 assert.match(component,/data-power-stack-candidate=\{idea.id\}/);
 assert.match(component,/No positions were bought, sold or re-ranked/);
 assert.doesNotMatch(component,/\.insert\(|\.upsert\(|\.update\(|service_role|authenticatedUserId/);
});

test("Power Stack queue separates conditional trade and investment lanes without fake live prices or automatic rankings",()=>{
 const q=read("components/blue-desk/PowerStackDecisionHub.tsx");
 for(const fragment of ["nvda-long","ai-cloud","tlt-duration","nvda-swing","bond-swing","oil-shipping","msci-flow"])assert.ok(q.includes(fragment),fragment);
 assert.match(q,/short-term|Short trade ideas/i);
 assert.match(q,/getManualSweeps\("ai",now,8\)/);
 assert.match(q,/getManualSweeps\("energy",now,5\)/);
 assert.match(q,/getManualSweeps\("breadth",now,5\)/);
 assert.match(q,/entry:|entry=/);
 assert.match(q,/failure:|failure=/);
 assert.match(q,/0 verified trade triggers/);
 assert.doesNotMatch(q,/lastPrice|user\.email|quantity|target_price|\.eq\("owner_user_id"/);
});

test("Issuer event date, company guidance and pre-result evidence are not invented outcomes",()=>{
 assert.equal(nvidiaEventState(new Date("2026-11-13T03:00:00Z")),"UPCOMING");
 assert.equal(NVIDIA_EARNINGS_WATCH.companyQ3Guidance.revenueBn,108);
 assert.equal(NVIDIA_EARNINGS_WATCH.companyQ3Guidance.grossMarginPct,74);
 const article=read("components/blue-desk/CurrentKeyStoryArticle.tsx");
 assert.match(article,/forecast|guidance/i);
 assert.match(article,/not an actual Q3 earnings announcement/);
 const shelf=read("components/blue-desk/CurrentKeyStoriesShelf.tsx");
 assert.match(shelf,/Company Q3 sales guide · not actual/);
 assert.match(shelf,/RESULTS CHECK DUE/);
});

test("Original manual sweeps support the new financing and macro tiles without source promotion",()=>{
 const now=new Date("2026-11-12T18:00:00Z");
 assert.ok(getManualSweeps("ai",now,8).some(s=>s.id.includes("coreweave")&&s.findings.some(f=>f.status==="SOURCE_CORROBORATED")));
 assert.ok(getManualSweeps("ai",now,8).some(s=>s.id.includes("nebius")&&s.findings.some(f=>f.status==="SOURCE_CORROBORATED")));
 assert.ok(getManualSweeps("breadth",now,5).some(s=>s.id.includes("msci")&&s.findings.some(f=>f.status==="SOURCE_CORROBORATED")));
 assert.ok(getManualSweeps("energy",now,5).some(s=>s.id.includes("siemens")&&s.findings.some(f=>f.status==="SOURCE_CORROBORATED")));
});
