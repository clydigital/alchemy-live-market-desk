/**
 * Bounded first-party source capture for the existing verified-issuer-result
 * intake. This is SOURCE MATERIAL ONLY, never a new canonical claim.
 * Only the existing authenticated issuer workflow can call the writer.
 */
export type IssuerSourcePassage = {
  text: string; sourceUrl: string; capturedAt: string; matchedMetric: string;
};
type Issuer = "GS" | "C" | "TSM" | "CRWV";
const HOSTS: Record<Issuer, readonly string[]> = {
  GS: ["goldmansachs.com"], C: ["citigroup.com"],
  TSM: ["tsmc.com"], CRWV: ["coreweave.com"],
};
const MAX_HTML_BYTES=240_000;
const MAX_PASSAGES=3;
const TIMEOUT_MS=5_000;
const ENTITY:Record<string,string>={
  amp:"&",quot:'"',apos:"'",nbsp:" ",lt:"<",gt:">",ndash:"–",mdash:"—",
  rsquo:"’",lsquo:"‘",rdquo:"”",ldquo:"“",hellip:"…",
};
function decode(value:string) {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,(_,symbol:string)=>{
    if(symbol.startsWith("#")) {
      const radix=symbol[1]?.toLowerCase()==="x"?16:10;
      const n=Number.parseInt(symbol.slice(radix===16?2:1),radix);
      return n>=32&&n<0x110000 ? String.fromCodePoint(n) : " ";
    }
    return ENTITY[symbol.toLowerCase()]||" ";
  });
}
function normalize(value:string) {
  return decode(value.replace(/<[^>]*>/g," ")).replace(/\s+/g," ").trim();
}
function sentences(text:string) { return (text.match(/[.!?](?=\s+[A-Z]|$)/g)||[]).length; }
export function admissibleIssuerDocumentUrl(issuer:Issuer,raw:string):string|null {
  try {
    const u=new URL(raw);
    const allowed=HOSTS[issuer].some(host=>u.hostname===host||u.hostname.endsWith("."+host));
    if(u.protocol!=="https:"||!allowed||u.username||u.password||u.port||raw.length>1400
      ||!u.pathname||u.pathname==="/")return null;
    return u.href;
  }catch{return null;}
}
export type IssuerCaptureReason=
  |"CAPTURED"|"REJECTED_URL"|"SOURCE_UNAVAILABLE"|"NOT_HTML"
  |"BODY_UNREADABLE_OR_OVERSIZED"|"NO_ANCHORED_SOURCE_PROSE"
  |"METRIC_IN_TABLE_NOT_VERIFIED"|"FETCH_FAILED";
export type IssuerCaptureResult={passages:IssuerSourcePassage[];reason:IssuerCaptureReason};

/** 
 * Match exact issuer values as printed. A normalised billions value (e.g.
 * 6.422) is NOT the same source text as a table reported "in millions"
 * (6,422). Those require separate unit/period adjudication, not a casual
 * substitution that turns a table row into a verified paragraph.
 */
function containsMetric(text:string,metricValue:number):boolean{
  const variants=[String(metricValue),
    metricValue.toLocaleString("en-US",{useGrouping:true,maximumFractionDigits:6})];
  return variants.some(v=>new RegExp("(^|[^\\d])"+v.replace(/[.()*+?^$|[\]\\]/g,"\\$&")+"(?!\\d)").test(text));
}
function sourceParagraphs(html:string):string[]{
  const clean=html
    .replace(/<!--[\s\S]*?-->/g," ")
    .replace(/<(script|style|noscript|svg|nav|footer|header)\b[^>]*>[\s\S]*?<\/\1\s*>/gi," ");
  return [...clean.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p\s*>/gi)]
    .map(m=>normalize(m[1]))
    .filter(text=>text.length>=20 && text.length<=650 && /[\p{L}]/u.test(text)
      && !/(?:privacy policy|terms of use|cookie preferences)/i.test(text))
    .slice(0,120);
}
/**
 * Source prose often uses SHORT, adjacent <p> blocks, including TSMC's
 * revenue and margin statements. Stitch at most two adjoining ORIGINAL
 * blocks verbatim. Do not author a connecting sentence or infer a price
 * reaction; source span and retrieval time remain attached to the same URL.
 *
 * Financial tables are intentionally excluded: metric magnitude, currency,
 * reporting period and sign need reconciliation with the header and row.
 */
export function extractIssuerPassagesFromHtml(input:{
  html:string;issuer:Issuer;sourceUrl:string;metricValue:number;capturedAt:string;
}):IssuerSourcePassage[] {
  const url=admissibleIssuerDocumentUrl(input.issuer,input.sourceUrl);
  if(!url||!Number.isFinite(input.metricValue)||!Number.isFinite(Date.parse(input.capturedAt))
    ||input.html.length>MAX_HTML_BYTES)return[];
  const paragraphs=sourceParagraphs(input.html);
  const seen=new Set<string>();
  const out:IssuerSourcePassage[]=[];
  for(let i=0;i<paragraphs.length;i++){
    const anchored=paragraphs[i];
    if(!containsMetric(anchored,input.metricValue))continue;
    const alternatives=[
      anchored,
      ...(i>0?[paragraphs[i-1]+" "+anchored]:[]),
      ...(i+1<paragraphs.length?[anchored+" "+paragraphs[i+1]]:[]),
    ];
    const passage=alternatives.find(x=>x.length>=160&&x.length<=720
      &&sentences(x)>=2&&!seen.has(x));
    if(!passage)continue;
    seen.add(passage);
    out.push({text:passage,sourceUrl:url,
      capturedAt:new Date(input.capturedAt).toISOString(),
      matchedMetric:String(input.metricValue)});
    if(out.length>=MAX_PASSAGES)break;
  }
  return out;
}
export function diagnoseIssuerHtml(input:{
  html:string;issuer:Issuer;sourceUrl:string;metricValue:number;capturedAt:string;
}):IssuerCaptureResult {
  const passages=extractIssuerPassagesFromHtml(input);
  if(passages.length)return{passages,reason:"CAPTURED"};
  // A financial table with a different magnitude is a positive discovery of
  // an extraction limitation, NOT valid factual paragraphs. Keep it a HOLD.
  const scaled=Number((input.metricValue*1000).toFixed(4));
  if(Number.isFinite(scaled) && scaled!==input.metricValue
    && /\b(?:in millions|in thousands)\b/i.test(normalize(input.html))
    && /<t(?:able|r|d|h)\b/i.test(input.html)
    && containsMetric(normalize(input.html),scaled)){
    return{passages:[],reason:"METRIC_IN_TABLE_NOT_VERIFIED"};
  }
  return{passages:[],reason:"NO_ANCHORED_SOURCE_PROSE"};
}
async function boundedHtml(response:Response):Promise<string|null> {
  const type=response.headers.get("content-type")||"";
  const claimed=Number(response.headers.get("content-length")||"0");
  if(!/\btext\/html\b/i.test(type)||(claimed>MAX_HTML_BYTES))return null;
  const reader=response.body?.getReader();
  if(!reader)return null;
  const chunks:Uint8Array[]=[];
  let bytes=0;
  try {
    for(;;){
      const part=await reader.read();
      if(part.done)break;
      bytes+=part.value.byteLength;
      if(bytes>MAX_HTML_BYTES)return null;
      chunks.push(part.value);
    }
    const output=new Uint8Array(bytes);let offset=0;
    for(const chunk of chunks){output.set(chunk,offset);offset+=chunk.byteLength;}
    return new TextDecoder().decode(output);
  }finally{await reader.cancel().catch(()=>{});}
}
/**
 * No redirects, credentials, proxy or arbitrary-URL scraper.
 * Failure returns no extra passages and cannot block issuer metric Evidence.
 */
export async function captureVerifiedIssuerPassagesDiagnosed(input:{
  issuer:Issuer;sourceUrl:string;metricValue:number;capturedAt:string;
  fetchImpl?:typeof fetch;now?:()=>Date;
}):Promise<IssuerCaptureResult> {
  const url=admissibleIssuerDocumentUrl(input.issuer,input.sourceUrl);
  if(!url)return{passages:[],reason:"REJECTED_URL"};
  try{
    const response=await (input.fetchImpl??fetch)(url,{
      headers:{accept:"text/html", "user-agent":"AlchemyMarketsResearch/1.0 source-provenance-capture"},
      cache:"no-store",redirect:"error",signal:AbortSignal.timeout(TIMEOUT_MS),
    });
    if(!response.ok||response.url!==url)return{passages:[],reason:"SOURCE_UNAVAILABLE"};
    if(!/\btext\/html\b/i.test(response.headers.get("content-type")||""))
      return{passages:[],reason:"NOT_HTML"};
    const html=await boundedHtml(response);
    if(!html)return{passages:[],reason:"BODY_UNREADABLE_OR_OVERSIZED"};
    return diagnoseIssuerHtml({...input,html,sourceUrl:url,
      capturedAt:(input.now?.()??new Date()).toISOString()});
  }catch{return{passages:[],reason:"FETCH_FAILED"};}
}
/** Backwards-compatible bounded result for the existing verified issuer intake. */
export async function captureVerifiedIssuerPassages(input:{
  issuer:Issuer;sourceUrl:string;metricValue:number;capturedAt:string;
  fetchImpl?:typeof fetch;now?:()=>Date;
}):Promise<IssuerSourcePassage[]> {
  const result=await captureVerifiedIssuerPassagesDiagnosed(input);
  return result.passages;
}
