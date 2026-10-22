import assert from "node:assert/strict";
import test from "node:test";
import { storyIdentityBalls } from "../lib/blue-desk/story-identity.ts";

test("company and country balls reflect explicit source-authored mentions only",()=>{
 const badges=storyIdentityBalls("AI backlog climbs at Dell as Nvidia tightens supply","US technology suppliers",3);
 assert.deepEqual(badges.map(x=>x.code),["DELL","NVDA","US"]);
 assert.equal(storyIdentityBalls("Rates-led repricing overwhelms optimism","US Treasury yields rise")[0]?.code,"US");
 assert.deepEqual(storyIdentityBalls("Macro focus","Unresolved cross-market interpretation"),[]);
});

test("countryballs distinguish Japan, China, the Gulf and do not infer unnamed exposures",()=>{
 const names=storyIdentityBalls("Iran and Saudi oil strikes","Japan's yen weakens as China watches",5);
 assert.deepEqual(names.map(x=>x.code),["IR","SA","JP","CN"]);
 assert.deepEqual(storyIdentityBalls("Oil risks rise","Energy markets are unsettled"),[]);
 assert.deepEqual(storyIdentityBalls("Apple earnings","Apple revenue grows").map(x=>x.code),["AAPL"]);
});
