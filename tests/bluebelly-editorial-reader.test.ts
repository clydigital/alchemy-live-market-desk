import test from "node:test";
import assert from "node:assert/strict";
import {renderPrivateEditorialReaderHtml,type ReaderEdition} from "../lib/bluebelly-editorial-reader.ts";

function edition():ReaderEdition{
 return {
  editionId:"2026-10-30-private-v4",reportDay:"2026-10-30",asOf:"2026-10-31T02:00:00Z",
  title:"Why technology sold off despite real AI demand",
  deck:"The cash is real, but which actor can afford to fund the next wave?",
  executiveSummary:"Verified prices and issuer disclosures pose a different question from attributed creator predictions.",
  snapshotSha256:"a".repeat(64),status:"PRIVATE_DRAFT",
  sources:[{
   id:"filing-1",publisher:"Example official issuer",title:"Original source document",
   url:"https://www.sec.gov/Archives/edgar/data/00000000/official.htm",
   publishedAt:"2026-10-30T10:00:00Z",status:"ORIGINAL_VERIFIED",period:"Quarter ended Sep 2026",
  },{
   id:"creator-1",publisher:"Creator (attributed)",title:"YouTube transcript source",
   url:"https://www.youtube.com/watch?v=YgqpOe2H17o",
   publishedAt:"2026-10-30T08:00:00Z",status:"ATTRIBUTED",
  }],
  sections:[
   {id:"cash-flows",title:"Who is funding the buildout?",opening:"Revenue is not equivalent to cash left over.",blocks:[
    {kind:"paragraph",text:"A customer can pay for capacity while investors question the lender's position.",sourceIds:["filing-1","creator-1"]},
    {kind:"figure",title:"Source-dated net spending",period:"Quarter ended September 2026",unit:"USD bn",
     method:"Company filing; illustrative fixture values",sourceId:"filing-1",
     rows:[{label:"Operating cash",value:13},{label:"Cash capex",value:9}],caption:"Comparison of numbers with the same period"},
   ]},
   {id:"the-argument",title:"The financing debate",opening:"The causal chain has a missing transaction receipt.",blocks:[
    {kind:"cause-chain",title:"From capex to credit",nodes:[{label:"Cash spending",observed:true},{label:"Forced asset sale",observed:false}],
     note:"Observed outlays do not establish collateral enforcement.",sourceIds:["filing-1","creator-1"]},
    {kind:"x-post",url:"https://x.com/KobeissiLetter/status/2116271956987154764",handle:"KobeissiLetter",
     publishedAt:"2026-10-30T20:52:07Z",summary:"Attribution: unverified QQQ short-interest assertion.",
     originalVerified:false,sourceIds:["creator-1"]},
   ]},
  ],
 };
}
test("longform v4 keeps reader type, 390px breakpoint and printable linked X fallback",()=>{
 const html=renderPrivateEditorialReaderHtml(edition());
 assert.match(html,/data-private-reader-v4="true"/);
 assert.match(html,/font:18px\/1\.76/);
 assert.match(html,/@media\(max-width:420px\)/);
 assert.match(html,/@page\{size:A4/);
 assert.match(html,/Five-minute orientation/);
 assert.match(html,/Who is funding the buildout/);
 assert.match(html,/The financing debate/);
 assert.match(html,/Source-dated net spending/);
 assert.match(html,/Hypothesis/);
 assert.match(html,/Attributed original link; post not independently verified/);
 assert.match(html,/https:\/\/x\.com\/KobeissiLetter\/status\/2116271956987154764/);
 assert.match(html,/Load original X embed/);
 assert.match(html,/Read original X post/);
 assert.match(html,/Evidence and source ledger/);
 assert.match(html,/Private unapproved draft; not public/);
});
test("original social post cannot silently replace independent evidence in a chart",()=>{
 const e=edition();
 e.sections[0].blocks[1]={kind:"figure",title:"Unverified creator number",period:"October 2026",
   unit:"USD bn",method:"Unverified post",sourceId:"creator-1",rows:[{label:"Claim",value:2}],caption:"Not independently verified"};
 assert.throws(()=>renderPrivateEditorialReaderHtml(e),/Figure is missing verified source/);
});
test("orphan sources, dangerous URLs and mismatched original X handles are refused",()=>{
 const missing=edition();
 missing.sections[0].blocks[0]={kind:"paragraph",text:"Unjoined claim",sourceIds:["imaginary-source"]};
 assert.throws(()=>renderPrivateEditorialReaderHtml(missing),/Unjoined source ID/);
 const badUrl=edition();badUrl.sources[0].url="javascript:alert(1)";
 assert.throws(()=>renderPrivateEditorialReaderHtml(badUrl),/Unsafe URL/);
 const badX=edition();const post=badX.sections[1].blocks[1];
 if(post.kind!=="x-post")throw Error("Bad test fixture");
 post.url="https://x.com/OtherHandle/status/2116271956987154764";
 assert.throws(()=>renderPrivateEditorialReaderHtml(badX),/X post requires exact/);
});
test("untrusted strings are escaped and never become report script or markup",()=>{
 const e=edition();
 e.title='Report <script>alert("hello")</script>';
 e.sections[0].blocks[0]={kind:"paragraph",text:"<img src=x onerror=alert(1)>",sourceIds:["filing-1"]};
 const html=renderPrivateEditorialReaderHtml(e);
 assert.ok(html.includes("&lt;script&gt;alert(&quot;hello&quot;)&lt;/script&gt;"));
 assert.ok(html.includes("&lt;img src=x onerror=alert(1)&gt;"));
 assert.ok(!html.includes("<img src=x onerror=alert(1)>"));
});
test("edition identity, duplicates and invalid negative chart values fail closed",()=>{
 const e=edition();e.snapshotSha256="not-a-hash";
 assert.throws(()=>renderPrivateEditorialReaderHtml(e),/Incomplete immutable/);
 const duplicate=edition();duplicate.sections.push({...duplicate.sections[1]});
 assert.throws(()=>renderPrivateEditorialReaderHtml(duplicate),/Invalid section/);
 const negative=edition();const fig=negative.sections[0].blocks[1];
 if(fig.kind!=="figure")throw Error("Bad figure fixture");
 fig.rows[0].value=-1;
 assert.throws(()=>renderPrivateEditorialReaderHtml(negative),/Figure is missing verified source/);
});
