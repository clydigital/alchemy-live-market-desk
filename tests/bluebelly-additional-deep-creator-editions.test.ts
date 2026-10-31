import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import {blueDeskHostAccess} from "../lib/blue-desk-host.ts";
const page=readFileSync(new URL("../app/my-reports/page.tsx",import.meta.url),"utf8");
test("My Desk excludes legacy creator HTML editions without deleting their historical source research",()=>{
 for(const id of ["1zeCOOzNIUHdvQvQYksyizDlz9Z0CITFs","1Wole_xxwImEEaLBCuOyBHgwlLZRsKY16",
  "1VDfUcSkgIQCOM5jpoS8TTnVrPRq8YPuR","15vGOFXyIU2pGCufoR8vR2EjLCfNI1hfI"])
  assert.ok(!page.includes(id));
 assert.match(page,/OwnerDailyIntelligenceHome/);
 assert.match(page,/OwnerDailyTopicIdeas/);
 assert.doesNotMatch(page,/CATEGORIES\.map|kind:"creators"|Supadata transcripts/);
 assert.match(page,/index:false,follow:false/);
 assert.equal(blueDeskHostAccess("/my-reports","bluebelly-desk.vercel.app"),"private");
});
test("creator claims remain attributed, not silently reclassified as verified report evidence",()=>{
 const parser=readFileSync(new URL("../lib/bluebelly-my-desk-suggestions.ts",import.meta.url),"utf8");
 assert.match(parser,/NEWSROOM_SUPPLEMENT/);
 assert.match(parser,/SOURCE_VERIFIED/);
 assert.match(parser,/Do not recycle the same report story or elevate a creator claim/);
 assert.doesNotMatch(page,/autoPublish|createSupabaseAdminClient/);
});