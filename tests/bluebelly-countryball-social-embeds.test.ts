import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {selectEventSocialContext,type CapturedSocialLead} from "../lib/bluebelly-event-social.ts";
import {recentBankDecisions} from "../lib/bluebelly-bank-decision-snapshots.ts";
const src=(f:string)=>readFileSync(new URL("../"+f,import.meta.url),"utf8");
const at="2026-10-28T18:00:00Z",now=new Date("2026-10-28T20:24:00Z");
const make=(title:string,url:string,at="2026-10-28T12:44:53.000Z",publisher="X/@KobeissiLetter",quality=35):CapturedSocialLead=>
 ({title,url,published_at:at,publisher,status:"accepted",item_type:"news",source_quality:quality});
test("prior-verified X lead is selected automatically only as dated pre-FOMC commentary",()=>{
 const rows=[
  make('It is officially Fed day. We expect a hawkish pause today.',
    "https://x.com/KobeissiLetter/status/2115424565086093615"),
  make('FOMC press conference will move DXY after Fed release.',
    "https://x.com/FirstSquawk/status/2115424565086093617","2026-10-28T19:10:00.000Z","X/@FirstSquawk"),
 ];
 const posts=selectEventSocialContext(rows,"fed-2026-10-28",at,now);
 assert.equal(posts.length,2);
 assert.equal(posts[0].phase,"AFTER DECISION");
 assert.equal(posts[1].phase,"BEFORE DECISION");
 assert.equal(posts[1].handle,"KobeissiLetter");
 assert.equal(posts[1].url,"https://x.com/KobeissiLetter/status/2115424565086093615");
});
test("wrong accounts, forged domains, unsupported events, unverified topic and future posts fail closed",()=>{
 const good=make("FOMC interest rates unchanged","https://x.com/KobeissiLetter/status/2115424565086093615");
 const bad=[
  make("FOMC","https://x.com.evil.test/KobeissiLetter/status/2115424565086093615"),
  make("FOMC","http://x.com/KobeissiLetter/status/2115424565086093615"),
  make("Fed","https://x.com/KobeissiLetter/status/notanid"),
  make("Fed","https://x.com/KobeissiLetter/status/2115424565086093615?ref=bad"),
  make("FOMC","https://x.com/UntrustedPundit/status/2115424565086093615","2026-10-28T12:44:53Z","X/@UntrustedPundit"),
  make("FOMC","https://x.com/FirstSquawk/status/2115424565086093616","2026-10-28T12:44:53Z","X/@KobeissiLetter"),
  make("Fed","https://x.com/KobeissiLetter/status/2115424565086093617","2026-10-29T02:00:00Z"),
  make("Fed","https://x.com/KobeissiLetter/status/2115424565086093618","2026-10-25T12:00:00Z"),
  make("New Nvidia GPU","https://x.com/KobeissiLetter/status/2115424565086093619"),
  make("Fed","https://x.com/KobeissiLetter/status/2115424565086093620","2026-10-28T12:44:53Z","X/@KobeissiLetter",70)
 ];
 assert.deepEqual(selectEventSocialContext([good,...bad],"fed-2026-10-28",at,now).map(x=>x.id),["2115424565086093615"]);
 assert.deepEqual(selectEventSocialContext([good],"other-event",at,now),[]);
 assert.deepEqual(selectEventSocialContext([good],"fed-2026-10-28",at,new Date("2026-10-28T17:00:00Z")),[]);
});
test("policy reader restores countryballs and keeps all original explanatory sections",()=>{
 const banks=recentBankDecisions(now);
 assert.deepEqual(banks.map(b=>b.countryCode),["US","CA","NZ"]);
 const reader=src("components/blue-desk/NewsroomEventReader.tsx");
 const css=src("components/blue-desk/NewsroomEventReader.module.css");
 const news=src("components/blue-desk/Newsroom48hTimeline.tsx");
 const page=src("app/blue-desk/key-stories/page.tsx");
 for(const heading of ["THE SCENE","THE NEW INFORMATION","THE MONEY QUESTION","THE CATCH","THE NEXT TEST"])
  assert.ok(reader.includes(heading),"missing "+heading);
 assert.match(reader,/kind="country" code=\{bank.countryCode\}/);
 assert.match(reader,/SourceTweetEmbeds posts=\{socialPosts\}/);
 assert.match(page,/getEventSocialContext\(policy.id,policy.releaseAt,now\)/);
 assert.match(news,/data-news-countryball=\{item.countryCode\}/);
 assert.match(css,/\.countryBall\{/);
 assert.match(reader,/bank\?\.expectedStatus/);
 assert.match(reader,/bank\?\.alternative/);
 assert.match(reader,/bank\?\.nextTest/);
});
test("X embeds are genuine original posts, automatically matched; facts never derive from X",()=>{
 const embed=src("components/blue-desk/SourceTweetEmbeds.tsx");
 const server=src("lib/bluebelly-event-social-server.ts");
 assert.match(embed,/twitter-tweet/);
 assert.match(embed,/platform\.twitter\.com\/widgets\.js/);
 assert.match(embed,/data-dnt="true"/);
 assert.match(embed,/UNVERIFIED COMMENTARY/);
 assert.match(embed,/Open original post if embed is unavailable/);
 assert.match(server,/server-only/);
 assert.match(server,/\.eq\("source_quality",35\)/);
 assert.match(server,/\.like\("publisher","X\/@%"\)/);
 assert.match(server,/\.limit\(120\)/);
 assert.doesNotMatch(server,/create|insert|upsert|publish|getUser/i);
});
