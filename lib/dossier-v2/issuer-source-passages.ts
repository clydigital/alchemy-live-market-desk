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
/** Exact source paragraphs, never authored claims or artificial prose. */
export function extractIssuerPassagesFromHtml(input:{
  html:string;issuer:Issuer;sourceUrl:string;metricValue:number;capturedAt:string;
}):IssuerSourcePassage[] {
  const url=admissibleIssuerDocumentUrl(input.issuer,input.sourceUrl);
  if(!url||!Number.isFinite(input.metricValue)||!Number.isFinite(Date.parse(input.capturedAt))
    ||input.html.length>MAX_HTML_BYTES)return[];
  const clean=input.html
    .replace(/<!--[\s\S]*?-->/g," ")
    .replace(/<(script|style|noscript|svg|nav|footer|header)\b[^>]*>[\s\S]*?<\/\1\s*>/gi," ");
  const variants=[
    String(input.metricValue),
    input.metricValue.toLocaleString("en-US",{useGrouping:true,maximumFractionDigits:6}),
  ];
  const seen=new Set<string>();
  return [...clean.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p\s*>/gi)]
    .flatMap(hit=>{
      const text=normalize(hit[1]);
      if(text.length<160||text.length>720||sentences(text)<2
        ||!/[\p{L}]/u.test(text)||/(?:privacy policy|terms of use|cookie preferences)/i.test(text)
        ||!variants.some(v=>new RegExp("(^|[^\\d])"+v.replace(/[.()*+?^$|[\]\\]/g,"\\$&")+"(?!\\d)").test(text))
        ||seen.has(text))return[];
      seen.add(text);
      return [{text,sourceUrl:url,capturedAt:new Date(input.capturedAt).toISOString(),
        matchedMetric:String(input.metricValue)}];
    }).slice(0,MAX_PASSAGES);
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
export async function captureVerifiedIssuerPassages(input:{
  issuer:Issuer;sourceUrl:string;metricValue:number;capturedAt:string;
  fetchImpl?:typeof fetch;
}):Promise<IssuerSourcePassage[]> {
  const url=admissibleIssuerDocumentUrl(input.issuer,input.sourceUrl);
  if(!url)return[];
  try{
    const response=await (input.fetchImpl??fetch)(url,{
      headers:{accept:"text/html", "user-agent":"AlchemyMarketsResearch/1.0 source-provenance-capture"},
      cache:"no-store",redirect:"error",signal:AbortSignal.timeout(TIMEOUT_MS),
    });
    if(!response.ok||response.url!==url)return[];
    const html=await boundedHtml(response);
    if(!html)return[];
    return extractIssuerPassagesFromHtml({...input,html,sourceUrl:url});
  }catch{return[];}
}
