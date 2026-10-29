import test from "node:test";
import assert from "node:assert/strict";
import {recoverOfficialPublisherSource} from "../lib/official-publisher-source-recovery.ts";
const url="https://investor.atmeta.com/rss/pressrelease.aspx";
test("existing Jina transport requests original HTML, never summarised news or a new publisher URL",async()=>{
 const old=process.env.JINA_API_KEY;process.env.JINA_API_KEY="test-jina";
 try{
  let checked=false;
  const fetchImpl=(async(u:RequestInfo|URL,init?:RequestInit)=>{
   assert.equal(String(u),"https://r.jina.ai/"+url);
   const h=new Headers(init?.headers);
   assert.equal(h.get("X-Respond-With"),"html");
   assert.equal(h.get("X-No-Cache"),"true");
   assert.equal(h.get("Authorization"),"Bearer test-jina");
   checked=true;
   return new Response("<rss><channel><item><title>Meta Announces Capital Offering</title></item></channel></rss>");
  }) as typeof fetch;
  const result=await recoverOfficialPublisherSource(url,{fetchImpl});
  assert.equal(result.ok,true);
  assert.equal(checked,true);
  if(result.ok)assert.equal(result.resolvedUrl,url);
 }finally{if(old===undefined)delete process.env.JINA_API_KEY;else process.env.JINA_API_KEY=old;}
});
test("a Jina article Markdown summary is never passed off as original-source HTML",async()=>{
 const previous=process.env.JINA_API_KEY;const firecrawl=process.env.FIRECRAWL_API_KEY;
 process.env.JINA_API_KEY="test-jina";delete process.env.FIRECRAWL_API_KEY;
 try{
  const fetchImpl=(async()=>new Response("Title: Meta announcement\nURL: "+url+"\nMeta reports...")) as typeof fetch;
  const result=await recoverOfficialPublisherSource(url,{fetchImpl});
  assert.equal(result.ok,false);
 }finally{
  if(previous===undefined)delete process.env.JINA_API_KEY;else process.env.JINA_API_KEY=previous;
  if(firecrawl===undefined)delete process.env.FIRECRAWL_API_KEY;else process.env.FIRECRAWL_API_KEY=firecrawl;
 }
});
