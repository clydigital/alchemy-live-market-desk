import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {resolveLegacyBluebellyHumanLink,BLUEBELLY_HUMAN_ORIGIN}
 from "../lib/bluebelly-legacy-human-retirement.ts";

const read=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("legacy Live human route mapping points into existing Bluebelly pages without additional pages",()=>{
 for(const [old,now] of [
  ["/","/"],["/owner/live","/"],["/markets","/markets"],
  ["/stories","/key-stories"],["/hybrid-output","/daily-report"],
  ["/dossier","/daily-report"],["/calendar","/calendar"]
 ]){
  assert.deepEqual(resolveLegacyBluebellyHumanLink("live",old),{
   state:"ready",target:BLUEBELLY_HUMAN_ORIGIN+now,requiresOwner:false
  });
 }
});

test("Hybrid human route mapping does not create a Journey, Dossier or History copy",()=>{
 for(const [old,now] of [
  ["/journey","/daily-report"],["/tracking","/key-stories"],
  ["/investigations","/key-stories"],["/markets","/markets"],
  ["/history","/daily-report"]
 ]){
  assert.deepEqual(resolveLegacyBluebellyHumanLink("hybrid",old),{
   state:"ready",target:BLUEBELLY_HUMAN_ORIGIN+now,requiresOwner:false
  });
 }
});

test("historical identities and owner-only routes cannot silently downgrade to current public editions",()=>{
 for(const [source,path,search] of [
  ["live","/hybrid-output","?edition=abc"],
  ["hybrid","/journey","?edition=abc"],
  ["hybrid","/story/some-identifier",""],
  ["live","/hybrid-output/prepare","?edition=abc"],
  ["live","/dossier","?dossier=exact"],
 ] as const){
  assert.deepEqual(resolveLegacyBluebellyHumanLink(source,path,search),
   {state:"defer",reason:"historical_edition_needs_exact_replay"});
 }
 for(const path of ["/owner/presenter","/owner/editorial","/owner/daily-report","/hybrid-output/prepare"]){
  assert.deepEqual(resolveLegacyBluebellyHumanLink("live",path),
   {state:"defer",reason:"owner_host_not_yet_proven"});
 }
});

test("API, cron, authentication and attacker URLs never receive a redirect",()=>{
 for(const path of ["/api/hybrid-feed-v2","/api/cron/research/morning",
  "/auth/callback","/_next/data","//other.example","/%2fadmin",
  "/login","/internal/secret"]){
  assert.deepEqual(resolveLegacyBluebellyHumanLink("live",path),{state:"not_mapped"},path);
 }
 assert.deepEqual(resolveLegacyBluebellyHumanLink("hybrid","/journey","?edition=x&edition=y"),
  {state:"defer",reason:"historical_edition_needs_exact_replay"});
});

test("remaining legacy UI points one-way into Bluebelly, not external Hybrid",()=>{
 const shell=read("components/live-desk/LiveDeskShell.tsx");
 const links=read("lib/live-desk/routes.ts");
 assert.match(shell,/href="https:\/\/bluebelly-desk\.vercel\.app\/"/);
 assert.doesNotMatch(shell,/href="https:\/\/alchemy-hybrid-market-desk/);
 assert.doesNotMatch(shell,/href="\/hybrid-output"/);
 assert.doesNotMatch(links,/href: "\/hybrid-output"/);
 const header=read("components/blue-desk/BlueDeskHeader.tsx");
 assert.doesNotMatch(header,/<Link[^>]+href="https:\/\/alchemy-live-market-desk/);
 assert.doesNotMatch(header,/<Link[^>]+href="https:\/\/alchemy-hybrid-market-desk/);
});
