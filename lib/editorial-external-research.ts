/**
 * User-controlled research transfer into the anonymous browser-local lab.
 * No authentication, model API, canonical evidence admission or server writes.
 * Importing never upgrades a copied claim to verified or publishable.
 */
export type ImportedResearch={
  kind:"COTD"|"OB";
  title:string;meta:string;body:string;hook:string;catalysts:string;
  expectation:string;observed:string;explanation:string;alternative:string;
  confirmation:string;invalidation:string;missingProof:string;
  chart1:string;chart2:string;chart3:string;sources:string;
  status:"IMPORTED_UNVERIFIED";
  sourceCount:number;
};
type Result={ok:true;research:ImportedResearch;warnings:string[]}|
  {ok:false;error:string};
const MAX_INPUT=32_000;
const MAX_BODY=15_000;
const untrusted="IMPORTED FROM EXTERNAL RESEARCH — NOT INDEPENDENTLY VERIFIED. "+
 "Check each original source, event clock, price reaction, chart and claim before publication.";
function obj(v:unknown):Record<string,unknown>{
 return v&&typeof v==="object"&&!Array.isArray(v)?v as Record<string,unknown>:{};
}
function field(v:unknown,max:number):string {
 return typeof v==="string"?v.trim().slice(0,max):"";
}
function safeSource(s:string):string|null {
 const raw=s.trim().replace(/[.,;)\]>]+$/,"");
 if(!raw||raw.length>1800)return null;
 try {
  const u=new URL(raw);
  if(u.protocol!=="https:"||u.username||u.password||u.port||
     u.hostname==="localhost"||u.hostname.endsWith(".local")||
     u.hostname.endsWith(".internal")||u.hostname.endsWith(".example")||
     u.hostname.endsWith(".test")||u.hostname.endsWith(".invalid")||
     /^\d+(?:\.\d+){3}$/.test(u.hostname))return null;
  return u.toString();
 }catch{return null}
}
function extractedUrls(v:string):string[]{
 const urls=v.match(/https:\/\/[^\s<>"']+/gi)||[];
 return urls.flatMap(x=>{const url=safeSource(x);return url?[url]:[]});
}
export function sourceLinksFromResearch(raw:unknown,body:string):string[]{
 const declared=Array.isArray(raw)?raw.filter((v):v is string=>typeof v==="string"):[];
 const all=[...declared,...extractedUrls(body)];
 return [...new Set(all.map(x=>safeSource(x)).filter((x):x is string=>!!x))].slice(0,12);
}
export function parseExternalResearch(
 text:unknown,selectedKind:"OB"|"COTD",
):Result {
 if(typeof text!=="string"||!text.trim())
  return {ok:false,error:"Paste a ChatGPT research brief or supported JSON packet."};
 if(text.length>MAX_INPUT)
  return {ok:false,error:"Research input exceeds 32,000 characters; shorten it before importing."};
 const pasted=text.trim();
 // ChatGPT often wraps even requested JSON in a Markdown code fence.
 // Accept a whole fenced JSON packet without mistaking it for article prose.
 const fenced=pasted.match(/^\x60\x60\x60(?:json)?\s*([\s\S]*?)\s*\x60\x60\x60$/i);
 const raw=fenced?fenced[1].trim():pasted;
 let data:Record<string,unknown>={};
 if(raw.startsWith("{")){
   try{data=obj(JSON.parse(raw));}
   catch{return {ok:false,error:"Invalid JSON. Fix it, or paste the plain-text research instead."};}
   if(!Object.keys(data).length)
    return {ok:false,error:"This JSON packet contains no research fields."};
 }else {
   const headline=raw.match(/^#{1,3}\s+(.+)$/m)?.[1]||
     raw.split("\n").map(x=>x.trim()).find(x=>!!x)||"Untitled imported research";
   data={title:headline,body:raw,sourceUrls:extractedUrls(raw)};
 }
 const kind=data.kind==="OB"||data.kind==="COTD"?data.kind:selectedKind;
 const title=field(data.title,63);
 const body=field(data.body??data.article,MAX_BODY);
 const hook=field(data.hook,2400);
 if(!title||(!body&&!hook&&!field(data.catalysts??data.catalystTimeline,4000)))
  return {ok:false,error:"Provide a title plus article text or a substantive research hook."};
 const rawSources=data.sourceUrls??data.sources;
 const sources=sourceLinksFromResearch(
   typeof rawSources==="string"?rawSources.split(/\s+/):rawSources,
   [body,hook,field(data.catalysts??data.catalystTimeline,4000)].join("\n"),
 );
 const charts=Array.isArray(data.chartGuidance)?data.chartGuidance:[];
 const research:ImportedResearch={
  kind,title,meta:field(data.meta,150),body,hook,
  catalysts:field(data.catalysts??data.catalystTimeline,4000),
  expectation:field(data.expectation,4500),
  observed:field(data.observed??data.priceReaction,4500),
  explanation:field(data.explanation??data.mechanism,4500),
  alternative:field(data.alternative??data.countercase,4500),
  confirmation:field(data.confirmation??data.nextTrigger,4500),
  invalidation:field(data.invalidation,4500),
  missingProof:[untrusted,field(data.missingProof,3000)].filter(Boolean).join("\n"),
  chart1:field(data.chart1??charts[0],650),
  chart2:field(data.chart2??charts[1],650),
  chart3:field(data.chart3??charts[2],650),
  sources:sources.join("\n"),
  status:"IMPORTED_UNVERIFIED",sourceCount:sources.length,
 };
 const warnings=[
  "External research is unverified, even if the imported text calls it verified.",
  "Check sources against original publications; imported URLs are not fact-checks.",
  "Imported post-catalyst returns cannot be promoted as canonical event observations.",
 ];
 if(!sources.length)warnings.push("No valid original HTTPS source links were found.");
 if(!body)warnings.push("No full article body was provided; this is an editorial research outline.");
 return {ok:true,research,warnings};
}
/** Copy into ChatGPT; output is an import format, not an instruction to falsify sources. */
export function chatResearchTransferPrompt(kind:"OB"|"COTD"):string {
 return [
  "Research a markets "+kind+" article for Alchemy Markets, using connected plugins/web and original primary sources.",
  kind==="COTD"?"Start with the chart observation, and explicitly mark chart patterns uninspected unless chart evidence is supplied.":
   "Start with the catalyst chronology and what changed overnight; distinguish prior consensus from the announced result.",
  "Evaluate alternative explanations, the strongest countercase and the next falsifiable test.",
  "Label unmeasured 5m/30m/4h event-window reactions UNKNOWN. Never infer them from daily close data.",
  "No invented release clocks, prices, technical bands or company cash-flow measures.",
  "Return ONLY a JSON object with the following fields; use empty strings for missing data:",
  '{ "kind":"'+kind+'", "title":"", "meta":"", "body":"", "hook":"", "catalysts":"",',
  '"expectation":"", "observed":"", "explanation":"", "alternative":"",',
  '"confirmation":"", "invalidation":"", "missingProof":"",',
  '"chartGuidance":["","",""], "sourceUrls":["https://ACTUAL-OFFICIAL-PUBLISHER-URL"] }',
  "Cite actual original-page URLs, no invented links. Provide explicit source times and limitations.",
  "The receiving website keeps the result UNVERIFIED pending human source checks.",
 ].join("\n");
}
