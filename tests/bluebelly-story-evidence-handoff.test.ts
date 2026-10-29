import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {selectTopicTrend,topicTrendKey} from "../lib/bluebelly-story-evidence.ts";
import {matchPublicStoryXPosts,type Row} from "../lib/bluebelly-story-social-match.ts";
import type {PublicTrendCard} from "../lib/blue-desk-whats-new-trends.ts";

const now=new Date("2026-10-29T06:00:00Z");
const topic=(id:string,title:string)=>({id,title,fact:"An issuer verified release",assets:[] as string[]});
const post=(id:string,handle:string,body:string,at="2026-10-29T02:00:00Z"):Row=>({
 post_id:id,handle,original_url:"https://x.com/"+handle+"/status/"+id,
 published_at:at,body,intake_status:"discovery",
});
const chart=(key:string,status:PublicTrendCard["status"]="ready"):PublicTrendCard=>({
 key,title:key,label:"Original market observation",sourceName:"Source",sourceUrl:"https://example.com/original",
 asOf:"2026-10-28",status,unit:"%",last:4.3,changes:{d1:1.1,d3:2,d5:3},
 points:Array.from({length:8},(_,i)=>({time:1792000000+i*86400,close:1+i/3})),
 missingReason:null,
});
test("story charts are relevant dated original series, not synthetic event reactions",()=>{
 assert.equal(topicTrendKey(topic("a","Brent crude and Hormuz shipping")),"energy");
 assert.equal(topicTrendKey(topic("b","SK hynix AI chip demand")),"semiconductors");
 assert.equal(topicTrendKey(topic("c","FOMC and the 2-year Treasury")),"rates-long");
 assert.equal(topicTrendKey(topic("d","The RBNZ's unexpected pause")),null);
 assert.equal(topicTrendKey(topic("e","General macro overview")),null);
 const cards=[chart("energy"),chart("semiconductors"),chart("rates-long","stale")];
 assert.equal(selectTopicTrend(topic("a","Brent crude"),cards)?.key,"energy");
 assert.equal(selectTopicTrend(topic("c","Treasury bonds"),cards),null);
 assert.equal(selectTopicTrend(topic("d","General outlook"),cards),null);
});
test("only exact original source, relevant live X posts are displayed as commentary",()=>{
 const id1="2115600000000000001",id2="2115600000000000002";
 const rows=[
  post(id1,"KobeissiLetter","Amazon AWS cloud earnings and spending outlook is a major surprise."),
  post(id2,"HormuzReport","Tanker traffic and shipping disruption reported around Hormuz."),
  post("2115600000000000003","KobeissiLetter","Unrelated sports results from today."),
  post("2115600000000000004","FakeAccount","Amazon earnings today might surprise everyone."),
  {...post("2115600000000000005","KobeissiLetter","Amazon revenues discussed by analysts."),original_url:"https://x.com.evil.test/KobeissiLetter/status/2115600000000000005"},
  post("2115600000000000006","KobeissiLetter","Amazon cloud revenue story from last month.","2026-10-20T02:00:00Z"),
  post("2115600000000000007","KobeissiLetter","Amazon cloud revenue future account.","2026-10-30T02:00:00Z"),
 ];
 const matched=matchPublicStoryXPosts([topic("amazon","Amazon AWS investment test"),topic("oil","Hormuz tanker disruption"),topic("macro","Generic economic data")],rows,now);
 assert.deepEqual(matched.amazon?.map(x=>x.id),[id1]);
 assert.deepEqual(matched.oil?.map(x=>x.id),[id2]);
 assert.equal(matched.macro,undefined);
 assert.equal(matched.amazon[0].url,"https://x.com/KobeissiLetter/status/"+id1);
});
test("dashboard and daily report connect only bounded public-discovery reads to source-dated charts",()=>{
 const src=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
 const home=src("app/blue-desk/page.tsx"),report=src("app/blue-desk/daily-report/page.tsx");
 const reader=src("lib/bluebelly-public-story-social.ts"),view=src("components/blue-desk/DecisionBrief.tsx");
 for(const page of [home,report]){
  assert.match(page,/getPublicStoryXPosts\(decisionTopics\(/);
  assert.match(page,/socialPostsByTopic=\{socialPostsByTopic\}/);
  assert.match(page,/trends=\{trendCards\}/);
 }
 assert.match(reader,/\.eq\("intake_status","discovery"\)/);
 assert.match(reader,/\.limit\(120\)/);
 assert.doesNotMatch(reader,/\.upsert\(|\.insert\(|\.update\(|\.delete\(/);
 assert.match(view,/StoryEvidenceChart card=\{chart\}/);
 assert.match(view,/StoryXContext posts=\{posts\}/);
 assert.match(src("components/blue-desk/StoryXContext.tsx"),/UNVERIFIED COMMENTARY/);
 assert.match(src("components/blue-desk/StoryEvidenceChart.tsx"),/NOT EVENT REACTION/);
});
