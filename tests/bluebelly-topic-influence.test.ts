import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
 projectTopicInfluence,type XInfluenceRow,type CreatorInfluenceRow,
} from "../lib/bluebelly-topic-influence.ts";

const now=new Date("2026-11-10T07:00:00Z");
const post=(overrides:Partial<XInfluenceRow>={}):XInfluenceRow=>({
 post_id:"2119893805914583335",handle:"HormuzReport",
 original_url:"https://x.com/HormuzReport/status/2119893805914583335",
 published_at:"2026-11-09T06:00:00Z",retrieved_at:"2026-11-09T06:08:00Z",
 body:"Iran and Hormuz negotiations are reported to continue; reopening remains conditional and has not been verified.",
 intake_status:"discovery",...overrides,
});
const video=(overrides:Partial<CreatorInfluenceRow>={}):CreatorInfluenceRow=>({
 external_id:"abcdefghijk",publisher:"StockedUp",title:"AI infrastructure spending versus cash flow",
 url:"https://www.youtube.com/watch?v=abcdefghijk",
 published_at:"2026-11-08T06:00:00Z",transcript_interpreted_at:"2026-11-09T06:00:00Z",
 transcript_status:"ready",video_review_status:"reviewed",
 recontextualized_summary:"AI infrastructure spending is rising but the return on investment remains to be tested.",
 summary:"AI capex story",claim_checks:[
  {claim:"AI data centre capex may outpace free cash flow",kind:"creator_claim",
   verificationNeeded:true,verificationTarget:"Check original Nvidia and CoreWeave cash-flow filings."}
 ],...overrides,
});
const read=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("same source records produce two distinct topic feeds with immutable URLs and clocks",()=>{
 const x=post(),v=video();
 const hormuz=projectTopicInfluence("hormuz",[x],[v],now);
 const ai=projectTopicInfluence("ai",[x],[v],now);
 assert.equal(hormuz.x.length,1);
 assert.equal(hormuz.creators.length,0);
 assert.equal(ai.x.length,0);
 assert.equal(ai.creators.length,1);
 assert.equal(hormuz.x[0].id,"x:2119893805914583335");
 assert.equal(ai.creators[0].id,"video:abcdefghijk");
 assert.equal(ai.creators[0].reviewedAt,"2026-11-09T06:00:00Z");
 assert.equal(hormuz.x[0].verification,"UNVERIFIED_LEAD");
 assert.match(ai.creators[0].nextCheck,/Nvidia and CoreWeave/);
});

test("spoofed X URLs, excluded handles, wrong review states and unsafe video URLs cannot appear",()=>{
 const invalidPosts=[
  post({post_id:"1000000000000000000"}),
  post({handle:"GordianKnotDev"}),
  post({original_url:"https://fake-x.com/HormuzReport/status/2119893805914583335"}),
  post({intake_status:"deferred"}),
  post({published_at:"2026-11-11T00:00:00Z"}),
 ];
 const invalidVideo=[
  video({transcript_status:"missing"}),
  video({video_review_status:"transcript_only"}),
  video({transcript_interpreted_at:null}),
  video({publisher:"UnapprovedChannel"}),
  video({url:"https://evil.example/watch?v=abcdefghijk"}),
  video({published_at:"2026-11-12T00:00:00Z"}),
 ];
 const res=projectTopicInfluence("hormuz",invalidPosts,invalidVideo,now);
 assert.equal(res.x.length,0);
 assert.equal(res.creators.length,0);
});

test("topic-match requires actual source content rather than a generic tech or energy assumption",()=>{
 assert.equal(projectTopicInfluence("ai",[post({body:"Market participants are tracking an oil tanker near the Gulf"})],
  [video({title:"All about inflation",recontextualized_summary:"The Fed debates rates",summary:"No compute discussion",claim_checks:[]})],now).creators.length,0);
 assert.equal(projectTopicInfluence("hormuz",[],[video({title:"AI and GPU funding",recontextualized_summary:"AI capex warning"})],now).creators.length,0);
});

test("failure is distinguished from no relevant recent sources and source caps prevent flooding",()=>{
 const empty=projectTopicInfluence("ai",[],[],now,"UNAVAILABLE","AVAILABLE");
 assert.equal(empty.xState,"UNAVAILABLE");
 assert.equal(empty.creatorState,"EMPTY");
 const first=video(),second=video({external_id:"lmnopqrstuv",url:"https://youtu.be/lmnopqrstuv",title:"Nvidia margins and demand"});
 const projected=projectTopicInfluence("ai",[],[first,first,second],now);
 assert.equal(projected.creators.length,1); // one video per creator in the first slice
 assert.equal(projected.creators[0].sourceName,"StockedUp");
});

test("Hormuz and AI pages share a single read-only collector projection and never mutate Regime state",()=>{
 const server=read("lib/bluebelly-topic-influence-server.ts");
 const hormuz=read("app/blue-desk/hormuz/page.tsx");
 const ai=read("app/blue-desk/regime-watch/[lensId]/page.tsx");
 const panel=read("components/blue-desk/TopicInfluencePanel.tsx");
 assert.match(server,/from\("x_wire_posts"\)/);
 assert.match(server,/from\("research_intake_items"\)/);
 assert.match(server,/transcript_interpreted_at/);
 assert.match(hormuz,/getTopicInfluence\("hormuz",now\)/);
 assert.match(ai,/lensId==="ai"\?getTopicInfluence\("ai",now\)/);
 assert.match(ai,/TopicInfluencePanel input=\{influence\}/);
 assert.match(panel,/UNVERIFIED \/ NOT CANONICAL/);
 assert.doesNotMatch(server+panel,/\.insert\(|\.update\(|upsert\(|createSupabaseAdminClient\(\)\.from\("story_thesis_versions"\)/);
});
