import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  retiredLivePublicDestination, blueDeskHostAccess,
  LIVE_DESK_PRESENTATION_HOST,
} from "../lib/blue-desk-host.ts";

const live=LIVE_DESK_PRESENTATION_HOST;
const root="https://bluebelly-desk.vercel.app";

test("old public Live links become reversible, bounded Bluebelly redirects",()=>{
 const mapping=[
  ["/", root+"/"],
  ["/blue-desk",root+"/"],
  ["/owner/live",root+"/"],
  ["/owner/markets",root+"/markets"],
  ["/markets",root+"/markets"],
  ["/blue-desk/markets",root+"/markets"],
  ["/daily-report",root+"/newsroom"],
  ["/blue-desk/daily-report",root+"/newsroom"],
  ["/key-stories",root+"/key-stories"],
  ["/blue-desk/key-stories",root+"/key-stories"],
  ["/newsroom",root+"/newsroom"],
  ["/calendar",root+"/calendar"],
  ["/blue-desk/calendar",root+"/calendar"],
  ["/hormuz",root+"/hormuz"],
  ["/regime-watch/fed",root+"/regime-watch/fed"],
  ["/blue-desk/regime-watch/yen",root+"/regime-watch/yen"],
  ["/learn/decks/d02",root+"/learn/decks/d02"],
  ["/features/global-bonds",root+"/features/global-bonds"],
 ];
 for(const [path,target] of mapping){
  assert.equal(blueDeskHostAccess(path,live),"public",path);
  assert.equal(retiredLivePublicDestination(path,live),target,path);
 }
});

test("bounded public filters survive, unknown data does not propagate",()=>{
 assert.equal(retiredLivePublicDestination("/markets",live,"?group=rates&secret=abc"),root+"/markets?group=rates");
 assert.equal(retiredLivePublicDestination("/calendar",live,"?window=30d&token=private"),root+"/calendar?window=30d");
 assert.equal(retiredLivePublicDestination("/key-stories",live,"?feature=amazon-fomc&key=secret"),root+"/key-stories?feature=amazon-fomc");
 assert.equal(retiredLivePublicDestination("/markets",live,"?group=%2F%2Fevil.com"),root+"/markets");
});

test("historical replay selectors stay at original authenticated / compatibility path",()=>{
 for(const k of ["edition","dossier","story","motion","regime","event","research_run","article","snapshot"]){
  assert.equal(retiredLivePublicDestination("/",live,"?"+k+"=older"),null,k);
  assert.equal(retiredLivePublicDestination("/markets",live,"?"+k+"=older"),null,k);
 }
});

test("no auth, cron, API, private owner, or alternate domain gets redirected",()=>{
 for(const path of ["/api/research-update","/api/hybrid-feed","/api/internal/canonical-feed",
   "/api/cron/research/morning","/auth/sso","/auth/callback",
   "/owner/editorial","/owner/research","/dossier","/hybrid-output","/legacy",
   "/owner/presenter/editions","/my-reports"]){
  assert.equal(retiredLivePublicDestination(path,live),null,path);
 }
 for(const host of [root.slice(8),"alchemy-live-market-desk-rogue-magazine.vercel.app",
  "attacker.vercel.app","alchemy-blue-desk.vercel.app"]){
  assert.equal(retiredLivePublicDestination("/",host),null,host);
 }
});

test("Live middleware redirects human pages before auth but never replaces machine handler",()=>{
 const middleware=readFileSync(new URL("../middleware.ts",import.meta.url),"utf8");
 assert.match(middleware,/retiredLivePublicDestination\(pathname, host, request\.nextUrl\.search\)/);
 assert.match(middleware,/status: 307, headers: \{ "Cache-Control": "no-store" \}/);
 assert.match(middleware,/destination\.pathname = safePath === "\/owner\/markets" \? "\/markets" : safePath/);
 assert.match(middleware,/\!\["edition","dossier","story","motion","regime","event","research_run","article","snapshot"\]/);
 assert.ok(middleware.indexOf('if (accessScope === "public")')<middleware.indexOf('startsWithAny(pathname, MACHINE_AUTH_PATHS)'));
 assert.match(middleware,/startsWithAny\(pathname, MACHINE_AUTH_PATHS\)/);
 assert.match(middleware,/pathname\.startsWith\("\/api\/cron\/"\)/);
 assert.match(middleware,/app_access_allowlist/);
});
