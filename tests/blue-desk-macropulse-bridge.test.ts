import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {parseMacroPulseDigest} from "../lib/blue-desk-macropulse-brief.ts";
import {acceptsMacroPulseIngest,scopedMacroPulseToken} from "../lib/blue-desk-macropulse-ingest-auth.ts";
import {blueDeskHostAccess} from "../lib/blue-desk-host.ts";

const now=new Date("2026-10-26T01:00:00.000Z");
const payload=JSON.parse(readFileSync(new URL("./fixtures/macropulse-centcom-bluebelly-digest.json",import.meta.url),"utf8"));

test("real Composio-read MacroPulse is transformed into attributed editorial, not verified market News",()=>{
 const output=parseMacroPulseDigest(payload,now);
 assert.ok(output);
 assert.equal(output?.sourcePulseId,"2026-10-26-0200-centcom-hormuz-cumulative-milestone-x-vintage-audit");
 assert.match(output?.whatChanged||"",/CENTCOM's cumulative claims/);
 assert.match(output?.whyItMatters||"",/No matching post-announcement/);
 assert.match(output?.countercase||"",/conflict participant/);
 assert.ok(output?.sourceLinks.every(x=>x.url.startsWith("https://")));
 assert.equal("verificationLabel" in (output||{}),false);
 assert.equal("storyDecision" in (output||{}),false);
});
test("zero trust editorial admission rejects stale, spoofed, future and overclaim inputs",()=>{
 const rejected=[
  {status:"published"}, {verificationLabel:"SOURCE_VERIFIED"}, {storyDecision:"ACCEPT"},
  {contractVersion:"new-dossier-v2"}, {sourcePageId:"not-a-uuid"},
  {sourcePageUrl:"https://notion.so.evil.invalid/notion-404519b67a948118b347d363f9b215a9"},
  {sourcePageUrl:"https://notion.so/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"},
  {sourcePulseId:"not-a-pulse"},
  {sourcePublishedAt:"2026-10-27T18:00:00.000Z"},
  {sourcePublishedAt:"2026-10-01T18:00:00.000Z"},
  {sourceRetrievedAt:"2026-10-26T10:00:00.000Z"},
  {headline:"Breaking!"},
  {countercase:"none"},
  {sourceLinks:[]}, {sourceLinks:[{...payload.sourceLinks[0],url:"http://localhost/private"}]},
  {sourceLinks:[payload.sourceLinks[0],payload.sourceLinks[0]]},
  {primaryRegion:"global"},
 ];
 for(const item of rejected){
  assert.equal(parseMacroPulseDigest({...payload,...item},now),null,
   "invalid field "+Object.keys(item)[0]+" must not pass");
 }
});
test("machine ingress is scoped, fails closed without config and resists prefix tokens",()=>{
 const token="m".repeat(40);
 assert.equal(scopedMacroPulseToken("too-short"),false);
 assert.equal(scopedMacroPulseToken(token),true);
 assert.equal(acceptsMacroPulseIngest("Bearer "+token,token),true);
 assert.equal(acceptsMacroPulseIngest("Bearer "+token.slice(0,-1),token),false);
 assert.equal(acceptsMacroPulseIngest("Bearer "+token,undefined),false);
 assert.equal(acceptsMacroPulseIngest("Basic "+token,token),false);
});
test("public hosts cannot access machine ingestion or signed-in review API",()=>{
 for(const host of ["bluebelly-desk.vercel.app","alchemy-live-market-desk.vercel.app"]){
  assert.notEqual(blueDeskHostAccess("/api/internal/bluebelly-editorial",host),"public");
  assert.notEqual(blueDeskHostAccess("/api/owner/macropulse-briefs",host),"public");
 }
 assert.equal(blueDeskHostAccess("/api/internal/bluebelly-editorial","private-preview.vercel.app"),"private");
 const cfg=readFileSync(new URL("../lib/supabase/config.ts",import.meta.url),"utf8");
 assert.match(cfg,/\/api\/internal\/bluebelly-editorial/);
 const receiver=readFileSync(new URL("../app/api/internal/bluebelly-editorial/route.ts",import.meta.url),"utf8");
 assert.match(receiver,/BLUEBELLY_MACROPULSE_INGEST_TOKEN/);
 assert.match(receiver,/isBlueDeskPublicReaderHost\(host\)/);
 assert.match(receiver,/status:"review"/);
 assert.match(receiver,/parseMacroPulseDigest/);
 assert.match(receiver,/duplicate:true/);
 assert.doesNotMatch(receiver,/story_thesis_versions|market_motion_items|\.upsert\(/);
});
test("MacroPulse briefs stay private until owner-checked, explicitly approved research publication",()=>{
 const migration=readFileSync(new URL("../supabase/migrations/20261025220902_blue_desk_macropulse_briefs.sql",import.meta.url),"utf8");
 assert.match(migration,/enable row level security/);
 assert.match(migration,/using\(status='published'\)/);
 assert.match(migration,/revoke all on public\.blue_desk_macropulse_briefs/);
 assert.doesNotMatch(migration,/grant insert|grant update|grant delete/i);
 assert.doesNotMatch(migration,/story_thesis_versions|market_motion_items/i);
 const owner=readFileSync(new URL("../app/api/owner/macropulse-briefs/route.ts",import.meta.url),"utf8");
 assert.match(owner,/session\.auth\.getUser\(\)/);
 assert.match(owner,/app_access_allowlist/);
 assert.match(owner,/\.eq\("status","review"\)/);
 assert.match(owner,/authenticated\(req\)/);
 assert.match(owner,/parseDigestApproval/);
 assert.match(owner,/dispatchIsReviewable/);
 assert.match(owner,/originHost!==host/);
 assert.match(owner,/\.eq\("status","review"\)/);
 assert.match(owner,/reviewed_by:auth\.email/);
 assert.match(owner,/Publication readback failed/);
 assert.doesNotMatch(owner,/generateContent|story_thesis_versions/);
 const publicReader=readFileSync(new URL("../lib/blue-desk-macropulse-brief-server.ts",import.meta.url),"utf8");
 assert.match(publicReader,/getSupabasePublicConfig/);
 assert.doesNotMatch(publicReader,/createSupabaseAdminClient/);
 const page=readFileSync(new URL("../app/blue-desk/daily-report/page.tsx",import.meta.url),"utf8");
 assert.match(page,/getPublishedMacroPulseBriefs/);
 assert.match(page,/data-macropulse-editorial="attributed-research"/);
 assert.match(page,/not independently verified breaking News/);
});

test("MacroPulse owner component requires explicit, separate publication confirmations",()=>{
 const ui=readFileSync(new URL("../components/blue-desk/MacroPulseBriefQueue.tsx",import.meta.url),"utf8");
 assert.match(ui,/data-owner-macropulse-queue="private-review"/);
 for(const key of ["checkedSources","checkedTimeWindows","checkedCountercase","approvePublicResearch"])
  assert.ok(ui.includes(key));
 assert.match(ui,/disabled=\{!ready\|\|state!=="idle"\}/);
 assert.match(ui,/No automatic public publication/);
});

test("the Newsroom preserves published MacroPulse research without classifying it as news proof",()=>{
 const newsroom=readFileSync(new URL("../app/blue-desk/newsroom/page.tsx",import.meta.url),"utf8");
 assert.match(newsroom,/getPublishedMacroPulseBriefs\(4\)/);
 assert.match(newsroom,/data-macropulse-editorial="research-derived-not-canonical"/);
 assert.match(newsroom,/projectPublishedResearchFocus\(researchDigests,now,6\)/);
 assert.match(newsroom,/PublishedResearchDispatches/);
 const shelf=readFileSync(new URL("../components/blue-desk/PublishedResearchDispatches.tsx",import.meta.url),"utf8");
 assert.match(shelf,/item\.countercase/);
 assert.match(shelf,/item\.sourcePageUrl/);
 assert.match(shelf,/item\.sourceLinks/);
});
