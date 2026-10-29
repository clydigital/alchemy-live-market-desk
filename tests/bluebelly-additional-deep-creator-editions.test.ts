import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import {blueDeskHostAccess} from "../lib/blue-desk-host.ts";

const page=readFileSync(new URL("../app/my-reports/page.tsx",import.meta.url),"utf8");
test("My Desk includes one longform private HTML per additional creator, preserving StockedUp",()=>{
 const ids=[
  "1zeCOOzNIUHdvQvQYksyizDlz9Z0CITFs",
  "1Wole_xxwImEEaLBCuOyBHgwlLZRsKY16",
  "1VDfUcSkgIQCOM5jpoS8TTnVrPRq8YPuR",
  "15vGOFXyIU2pGCufoR8vR2EjLCfNI1hfI",
 ];
 for(const id of ids){
  assert.equal(page.split('id:"'+id+'"').length,2,"Missing or duplicated private report "+id);
 }
 assert.match(page,/const PAGE_SIZE=2/);
 assert.match(page,/CATEGORIES\.map/);
 assert.match(page,/kind:"creators"/);
 assert.match(page,/Supadata transcripts/);
 assert.match(page,/UNKNOWN/);
 assert.match(page,/noindex|index:false/);
 assert.equal(blueDeskHostAccess("/my-reports","bluebelly-desk.vercel.app"),"private");
});
test("new batch selection doesn't pretend creator claims are original verified data",()=>{
 assert.match(page,/attributed claims pending/);
 assert.match(page,/historical and unverified/);
 assert.match(page,/price response labelled UNKNOWN/);
 assert.doesNotMatch(page,/autoPublish|createSupabaseAdminClient/);
});
