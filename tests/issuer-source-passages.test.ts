import assert from "node:assert/strict";
import test from "node:test";
import {
  admissibleIssuerDocumentUrl,captureVerifiedIssuerPassages,extractIssuerPassagesFromHtml,
  diagnoseIssuerHtml,captureVerifiedIssuerPassagesDiagnosed,
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

test("adjacent ORIGINAL issuer paragraphs permit genuine two-sentence reporting without invented prose",()=>{
  const first="The fictional test issuer recorded third-quarter revenue of 46.72 billion in its published consolidated statement.";
  const second="The release separately specified the prior period and the measurement basis of the revenue figure, without asserting a realised change in its share price.";
  const html="<html><article><p>"+first+"</p><p>"+second+"</p></article></html>";
  const result=diagnoseIssuerHtml({...capture,metricValue:46.72,html});
  assert.equal(result.reason,"CAPTURED");
  assert.equal(result.passages.length,1);
  assert.equal(result.passages[0].text,first+" "+second);
  assert.equal(result.passages[0].sourceUrl,url);
  assert.equal(result.passages[0].matchedMetric,"46.72");
  assert.equal(result.passages[0].text.split(". ").length,2);
});
test("a short one-sentence original issuer metric is not padded by unrelated webpage furniture",()=>{
  const html="<html><header><p>The issuer has produced a new company logo, an alert banner, and a navigation bar.</p></header>"+
    "<p>Operating margin was 58.7 percent.</p>"+
    "<footer><p>Corporate media enquiries can be made through our public investor relations website.</p></footer></html>";
  assert.deepEqual(extractIssuerPassagesFromHtml({...capture,html}),[]);
  assert.equal(diagnoseIssuerHtml({...capture,html}).reason,"NO_ANCHORED_SOURCE_PROSE");
});
test("cash-flow tables in millions are diagnosed, not silently converted to model-made prose",()=>{
  const coreweave={
    issuer:"CRWV" as const,
    sourceUrl:"https://investors.coreweave.com/news/news-details/2026/sample/default.aspx",
    metricValue:6.422,capturedAt:"2026-10-21T06:00:00Z",
  };
  const html='<div>(In millions, except per-share data)</div>'+
    '<table><tr><th>Cash flows from investing</th><th>2026</th></tr>'+
    '<tr><td>Purchase of property and equipment including software</td><td>(6,422)</td></tr></table>'+
    '<p>The company reported a separate development across its infrastructure business.</p>';
  const result=diagnoseIssuerHtml({...coreweave,html});
  assert.equal(result.reason,"METRIC_IN_TABLE_NOT_VERIFIED");
  assert.deepEqual(result.passages,[]);
  assert.deepEqual(extractIssuerPassagesFromHtml({...coreweave,html}),[]);
});
test("the diagnosed HTTP collector returns safe reason codes without new sources",async()=>{
  const failure=await captureVerifiedIssuerPassagesDiagnosed({...capture,
    fetchImpl:(async()=>{throw new Error("network connection secret error")}) as typeof fetch});
  assert.equal(failure.reason,"FETCH_FAILED");
  assert.deepEqual(failure.passages,[]);
  const badUrl=await captureVerifiedIssuerPassagesDiagnosed({...capture,sourceUrl:"https://evil.example/report"});
  assert.equal(badUrl.reason,"REJECTED_URL");
});

test("CoreWeave original quarterly HTML may exceed generic 240KB yet is capped at 512KB",async()=>{
  const original="https://investors.coreweave.com/news/news-details/2026/sample/default.aspx";
  const issuer={issuer:"CRWV" as const,sourceUrl:original,metricValue:6.422,capturedAt:"2026-10-21T06:00:00Z"};
  const prose="<p>Operating cash flow was tracked as a separate financial reporting measurement rather than a change in share price.</p>";
  const table="<table><tr><th>In millions</th></tr><tr><td><p>Purchases of property and equipment including internal software were 6,422 in 2026 for this accounting statement. The following report describes capital expenditure in units used by the table.</p></td></tr></table>";
  const html="<html>"+prose+table+"<div>"+" ".repeat(300_000)+"</div></html>";
  assert.ok(html.length>240_000&&html.length<512_000);
  const raw=extractIssuerPassagesFromHtml({...issuer,html});
  assert.deepEqual(raw,[],"table-origin text is not a legitimate issuer narrative paragraph");
  const response=new Response(html,{headers:{"content-type":"text/html","content-length":String(html.length)}});
  Object.defineProperty(response,"url",{value:original});
  const fetchImpl=(async()=>response) as typeof fetch;
  const result=await captureVerifiedIssuerPassagesDiagnosed({...issuer,fetchImpl});
  assert.equal(result.reason,"METRIC_IN_TABLE_NOT_VERIFIED");
  assert.deepEqual(result.passages,[]);
});
test("512KB is a strict hard cap only for approved CoreWeave issuer URLs",async()=>{
  const issuer={issuer:"CRWV" as const,
    sourceUrl:"https://investors.coreweave.com/news/news-details/2026/sample/default.aspx",
    metricValue:6.422,capturedAt:"2026-10-21T06:00:00Z"};
  const huge=new Response("<html><p>6.422 cash purchases. This second sentence covers the fiscal period.</p></html>",
    {headers:{"content-type":"text/html","content-length":"512001"}});
  Object.defineProperty(huge,"url",{value:issuer.sourceUrl});
  const result=await captureVerifiedIssuerPassagesDiagnosed({...issuer,
    fetchImpl:(async()=>huge) as typeof fetch});
  assert.equal(result.reason,"BODY_UNREADABLE_OR_OVERSIZED");
  assert.deepEqual(result.passages,[]);
});
