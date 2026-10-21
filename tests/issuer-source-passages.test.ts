import assert from "node:assert/strict";
import test from "node:test";
import {
  admissibleIssuerDocumentUrl,captureVerifiedIssuerPassages,extractIssuerPassagesFromHtml,
} from "../lib/dossier-v2/issuer-source-passages.ts";

const url="https://pr.tsmc.com/english/news/3346";
const t="Taiwan Semiconductor Manufacturing Company reports an operating margin of 58.7 percent in the fiscal results for its latest reporting quarter. The issuer's original press release also describes the accounts covered by that consolidated metric, including the reporting scope and comparatives.";
const paragraph="<p>"+t+"</p>";
const capture={issuer:"TSM" as const,sourceUrl:url,metricValue:58.7,capturedAt:"2026-10-21T06:00:00Z"};
test("original HTTPS issuer allowlist prevents arbitrary URLs and same-host lookalikes",()=>{
  assert.equal(admissibleIssuerDocumentUrl("TSM",url),url);
  for(const invalid of [
    "http://pr.tsmc.com/english/news/3346",
    "https://pr.tsmc.com.evil.example/news/3346",
    "https://evil.example/english/news/3346",
    "https://127.0.0.1/internal",
    "https://pr.tsmc.com/",
    "https://user:password@pr.tsmc.com/english/news/3346",
    "https://pr.tsmc.com:8443/english/news/3346",
  ])assert.equal(admissibleIssuerDocumentUrl("TSM",invalid),null);
});
test("only genuine metric-anchored substantive issuer paragraphs are retained",()=>{
  const html="<html><script>"+paragraph+"</script><nav>"+paragraph+"</nav>"
    +paragraph+"<p>Another paragraph without the verified source metric.</p>"+paragraph+"</html>";
  const output=extractIssuerPassagesFromHtml({...capture,html});
  assert.equal(output.length,1);
  assert.equal(output[0].text,t);
  assert.equal(output[0].matchedMetric,"58.7");
  assert.equal(output[0].capturedAt,new Date(capture.capturedAt).toISOString());
  assert.equal(output[0].sourceUrl,url);
  assert.equal(extractIssuerPassagesFromHtml({...capture,metricValue:99,html:paragraph}).length,0);
  assert.deepEqual(extractIssuerPassagesFromHtml({...capture,html:"<p>58.7 percent this year.</p>"}),[]);
});
test("capture uses no redirect, bounded HTML and no blocking failure",async()=>{
  let options:RequestInit|undefined;
  const mock=async(_url:RequestInfo|URL,init?:RequestInit)=>{
    options=init;
    return new Response("<html>"+paragraph+"</html>",{
      status:200,headers:{"content-type":"text/html"},
    });
  };
  // Test Response in a fetch adapter with final URL set as a real fetch would.
  const fetchImpl=(async(input:RequestInfo|URL,init?:RequestInit)=>{
    const r=await mock(input,init);
    Object.defineProperty(r,"url",{value:String(input)});
    return r;
  }) as typeof fetch;
  const output=await captureVerifiedIssuerPassages({...capture,fetchImpl});
  assert.equal(output.length,1);
  assert.equal(options?.redirect,"error");
  assert.equal(options?.cache,"no-store");
  const offsite=(async()=>new Response(paragraph,{headers:{"content-type":"text/html"}})) as typeof fetch;
  assert.deepEqual(await captureVerifiedIssuerPassages({...capture,fetchImpl:offsite}),[]);
  const broken=(async()=>{throw new Error("fetch failed")}) as typeof fetch;
  assert.deepEqual(await captureVerifiedIssuerPassages({...capture,fetchImpl:broken}),[]);
});
test("incorrect content type, oversized originals and short excerpts fail closed",async()=>{
  const html="<html>"+paragraph+"</html>";
  for(const response of [
    new Response(html,{headers:{"content-type":"application/json"}}),
    new Response(html,{headers:{"content-type":"text/html","content-length":"240001"}}),
    new Response("<p>58.7 percent.</p>",{headers:{"content-type":"text/html"}}),
  ]) {
    Object.defineProperty(response,"url",{value:url});
    const adapter=(async()=>response) as typeof fetch;
    assert.deepEqual(await captureVerifiedIssuerPassages({...capture,fetchImpl:adapter}),[]);
  }
});
