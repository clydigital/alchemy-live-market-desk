import test from "node:test";
import assert from "node:assert/strict";
import {authorizeVerifiedEventOwner} from "../lib/bluebelly-verified-event-owner-auth.ts";
import {projectVerifiedMarketEvents} from "../lib/bluebelly-verified-event-read-model.ts";
import {combineQualifiedNews} from "../lib/blue-desk-qualified-news.ts";
import type {NewsBriefV1} from "../lib/market-brief-news.ts";
import {blueDeskHostAccess} from "../lib/blue-desk-host.ts";

const validUser={id:"e58dc23f-3612-4bcd-afd0-c99d952a4bb1",email:" Owner@Example.org "};
const getUser=async()=>({data:{user:validUser},error:null});

test("server-verified, active allowlisted owner can enter the private event reader",async()=>{
 const seen:string[]=[];
 const owner=await authorizeVerifiedEventOwner({
  getUser,
  readActiveAllowlist:async email=>{
   seen.push(email);
   return {data:{email:"owner@example.org"},error:null};
  },
 });
 assert.deepEqual(owner,{ok:true,email:"owner@example.org"});
 assert.deepEqual(seen,["owner@example.org"]);
 assert.equal(blueDeskHostAccess("/api/owner/verified-events","alchemy-live-market-desk-rogue-magazine.vercel.app"),"private");
 assert.equal(blueDeskHostAccess("/api/owner/verified-events","bluebelly-desk.vercel.app"),"blocked");
 assert.equal(blueDeskHostAccess("/api/owner/verified-events","alchemy-live-market-desk.vercel.app"),"private");
});

test("an authorised event reader projects the exact same source IDs and observed clocks as the Newsroom brief",async()=>{
 const now=new Date("2026-11-06T00:00:00.000Z");
 const brief:NewsBriefV1={
  contractVersion:"news-brief/1",contentType:"NEWS_BRIEF",
  id:"a40d9b33-26d4-4acc-9509-633fcbbe42ff",
  sourceName:"Reserve Bank of Australia",
  sourceUrl:"https://www.rba.gov.au/media-releases/2026/mr-26-30.html",
  sourceKind:"official",verification:"SOURCE_VERIFIED",
  headline:"Statement by the Monetary Policy Board: Monetary Policy Decision",
  summary:"The Monetary Policy Board announced its policy decision in its original official release.",
  occurredAt:"2026-11-03T03:30:00.000Z",
  observedAt:"2026-11-04T13:35:10.951Z",
 };
 const owner=await authorizeVerifiedEventOwner({
  getUser,readActiveAllowlist:async()=>({data:{email:"owner@example.org"},error:null}),
 });
 assert.equal(owner.ok,true);
 const newsroom=combineQualifiedNews([],[brief],18);
 const model=projectVerifiedMarketEvents(newsroom,now,{since:"2026-11-02T00:00:00.000Z"});
 assert.equal(model.events.length,1);
 assert.equal(model.events[0].sourceRecordId,newsroom[0].id);
 assert.equal(model.events[0].occurredAt,newsroom[0].occurredAt);
 assert.equal(model.events[0].sourceObservedAt,newsroom[0].observedAt);
 assert.equal(model.events[0].originalUrl,newsroom[0].sourceUrl);
 assert.equal(model.events[0].freshness,"OLDER_7D");
 assert.deepEqual(model.events[0].marketReaction,{status:"NOT_VERIFIED",value:null});
});

test("session validation must precede any allowlist or research read",async()=>{
 let called=0;
 const cases=[
  {data:{user:null},error:null},
  {data:{user:{email:"owner@example.org"}},error:null},
  {data:{user:{id:"id",email:""}},error:null},
  {data:{user:{id:"id",email:"owner@example.org"}},error:{message:"Invalid JWT"}},
 ];
 for(const identity of cases){
  const result=await authorizeVerifiedEventOwner({
   getUser:async()=>identity,
   readActiveAllowlist:async()=>{called++;return {data:{email:"owner@example.org"},error:null};},
  });
  assert.deepEqual(result,{ok:false,status:401,error:"Owner sign-in required"});
 }
 assert.equal(called,0);
});

test("non-allowlisted or mismatched owner email never gains access",async()=>{
 const deny=await authorizeVerifiedEventOwner({
  getUser,
  readActiveAllowlist:async()=>({data:null,error:null}),
 });
 assert.deepEqual(deny,{ok:false,status:403,error:"Owner account not authorised"});
 const mismatch=await authorizeVerifiedEventOwner({
  getUser,
  readActiveAllowlist:async()=>({data:{email:"other@example.org"},error:null}),
 });
 assert.deepEqual(mismatch,{ok:false,status:403,error:"Owner account not authorised"});
});

test("provider outages fail closed with a clear status; never fall back to unverified identity",async()=>{
 const down=await authorizeVerifiedEventOwner({
  getUser:async()=>{throw new Error("Auth provider unreachable")},
  readActiveAllowlist:async()=>{throw new Error("Must not be called")},
 });
 assert.deepEqual(down,{ok:false,status:503,error:"Owner authentication unavailable"});
 const noAllow=await authorizeVerifiedEventOwner({
  getUser,readActiveAllowlist:async()=>{throw new Error("PostgREST timeout")},
 });
 assert.deepEqual(noAllow,{ok:false,status:503,error:"Owner authorisation unavailable"});
 const failAllow=await authorizeVerifiedEventOwner({
  getUser,readActiveAllowlist:async()=>({data:null,error:{message:"permission denied"}}),
 });
 assert.deepEqual(failAllow,{ok:false,status:503,error:"Owner authorisation unavailable"});
});
