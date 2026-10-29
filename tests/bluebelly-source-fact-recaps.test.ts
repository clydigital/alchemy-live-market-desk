import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {extractOfficialPressFacts} from "../lib/official-press-facts.ts";
import {applyOfficialPressNewsIntake,OFFICIAL_PRESS_FEEDS} from "../lib/official-press-news-intake.ts";
import {projectOriginalPressNews} from "../lib/blue-desk-original-press-news.ts";
import type {ResearchRunInput} from "../lib/research-update.ts";

const title="NVIDIA and Oracle Expand AI Data Center Capacity to Multi-Gigawatt Scale";
const url="https://nvidianews.nvidia.com/news/nvidia-and-oracle-expand-ai-data-center-capacity";
const at="2026-10-27T16:00:00.000Z";
const now=new Date("2026-10-28T02:00:00.000Z");
const line1="NVIDIA and Oracle have agreed to expand data center capacity with new AI systems across multiple locations.";
const line2="Oracle says the expansion will add 2 gigawatts of AI computing capacity through the new infrastructure partnership.";
const html="<html><head><title>"+title+"</title></head><body><nav><p>Subscribe now for newsletter updates from NVIDIA.</p></nav><main><h1>"+title+"</h1><p>"+line1+"</p><p>"+line2+"</p><p>Read our privacy policy and contact us for more information.</p><script><p>NVIDIA posted a false earnings profit of $1 trillion.</p></script></main></body></html>";
const rss="<rss><channel><item><title>"+title+"</title><link>"+url+"</link><pubDate>Tue, 27 Oct 2026 16:00:00 GMT</pubDate></item></channel></rss>";
const response=(body:string,type:string)=>new Response(body,{status:200,headers:{"content-type":type}});
const payload:ResearchRunInput={runKey:"facts-proof",scheduleSlot:"morning",scheduledFor:now.toISOString(),sourceChecks:[],items:[]};
const proof="Original official RSS publication clock and directly linked same-host press-release HTML checked. Headline describes the announcement only, not its financial effect.";

test("only actual bounded article paragraphs become attributed source facts",()=>{
 const facts=extractOfficialPressFacts(html,title);
 assert.deepEqual(facts,[line1,line2]);
 assert.deepEqual(extractOfficialPressFacts("<html><script>"+line1+"</script></html>",title),[]);
 assert.deepEqual(extractOfficialPressFacts("<html><main><p>Newsletter: contact us and subscribe now.</p></main></html>",title),[]);
});
test("an original RSS release carries its own fact evidence into the existing intake record",async()=>{
 const feed=OFFICIAL_PRESS_FEEDS.find(x=>x.host==="nvidianews.nvidia.com")!;
 const fetchImpl=(async (target:RequestInfo|URL)=>{
  const u=String(target);
  if(u===feed.feed)return response(rss,"application/rss+xml");
  if(u===url)return response(html,"text/html");
  return response("<rss><channel></channel></rss>","text/xml");
 }) as typeof fetch;
 const result=await applyOfficialPressNewsIntake(payload,{now,fetchImpl});
 assert.equal(result.items.length,1);
 const row=result.items[0];
 assert.equal(row.summary,line1+" "+line2);
 assert.equal(row.evidence?.length,3);
 assert.equal(row.evidence?.[0].claim,title);
 assert.deepEqual(row.evidence?.slice(1).map(x=>x.claim),["OFFICIAL_FACT: "+line1,"OFFICIAL_FACT: "+line2]);
 const db={id:"00000000-0000-4000-8000-000000000123",
   item_key:"official-press:"+createHash("sha256").update(url).digest("hex").slice(0,24),
   item_type:"news",status:"accepted",publisher:feed.publisher,title,
   summary:row.summary,url,published_at:at,created_at:"2026-10-27T16:30:00.000Z",
   source_quality:95,relevance:84,novelty:76,materiality:80,candidate_score:84,
   review_reason:proof,evidence_links:row.evidence};
 const projected=projectOriginalPressNews([db],now,8,7);
 assert.equal(projected.length,1);
 assert.equal(projected[0].summary,line1+" "+line2);
 // Legacy evidence remains eligible but cannot claim additional source facts.
 const legacy=projectOriginalPressNews([{...db,summary:title,evidence_links:row.evidence?.slice(0,1)}],now,8,7);
 assert.equal(legacy.length,1);
 assert.match(legacy[0].summary,/market-price reaction/);
 const forged=projectOriginalPressNews([{...db,summary:"NVIDIA shares surged 50%."}],now,8,7);
 assert.match(forged[0].summary,/market-price reaction/);
 const wrongSource=projectOriginalPressNews([{...db,evidence_links:row.evidence?.map(x=>
   x.claim.startsWith("OFFICIAL_FACT")?{...x,url:"https://other.example/news"}:x)}],now,8,7);
 assert.match(wrongSource[0].summary,/market-price reaction/);
});

test("press contact phone/email is not misclassified as a source financial fact",()=>{
 const contact="<html><main><h1>Broadcom Announces AI Infrastructure Financing</h1><p>Broadcom press contacts Roger Smith +1.408.348.1569 roger.smith@broadcom.com for additional details.</p><p>Broadcom announced a 63 billion dollar AI compute capacity financing partnership for 2026.</p></main></html>";
 const facts=extractOfficialPressFacts(contact,"Broadcom Announces AI Infrastructure Financing");
 assert.equal(facts.length,1);
 assert.match(facts[0],/63 billion/);
 assert.doesNotMatch(facts[0],/@/);
});
