/** Exact approved, immutable public article snapshot. Never a canonical Story verdict. */
export type EditorialPublication={
 id:string;kind:"COTD"|"OB"|"DAILY_REPORT";title:string;meta_description:string;
 body:string;excerpt:string;source_urls:string[];status:"published";published_at:string;
};
export type ReviewedSubmission={
 kind:"COTD"|"OB"|"DAILY_REPORT";title:string;meta_description:string;body:string;
 excerpt:string;source_urls:string[];
};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validPublicationId(s:unknown):s is string{
 return typeof s==="string"&&UUID.test(s);
}
function safeSource(value:string):string|null{
 try{
  if(value.length>1800||!value.trim())return null;
  const url=new URL(value.trim());
  if(url.protocol!=="https:"||url.username||url.password||url.port||
    !url.hostname.includes(".")||url.hostname.endsWith(".local")||
    url.hostname.endsWith(".internal")||url.hostname.endsWith(".example")||
    /^(\d+\.){3}\d+$/.test(url.hostname))return null;
  return url.toString();
 }catch{return null;}
}
/** Unverified import fields do not confer publication authority. Owner review is separate. */
export function parseReviewedSubmission(input:unknown):ReviewedSubmission|null{
 if(!input||typeof input!=="object"||Array.isArray(input))return null;
 const r=input as Record<string,unknown>;
 const kind=r.kind==="OB"||r.kind==="COTD"||r.kind==="DAILY_REPORT"?r.kind:null;
 const title=typeof r.title==="string"?r.title.trim():"";
 const meta=typeof r.meta_description==="string"?r.meta_description.trim():
  typeof r.meta==="string"?r.meta.trim():"";
 const body=typeof r.body==="string"?r.body.trim():"";
 const excerpt=typeof r.excerpt==="string"?r.excerpt.trim():
  body.replace(/\s+/g," ").slice(0,240);
 const lines=Array.isArray(r.source_urls)?r.source_urls:r.sources;
 const original=typeof lines==="string"?lines.split(/\r?\n|\s+/):lines;
 const urls=Array.isArray(original)?original.filter((v):v is string=>typeof v==="string"):[];
 const dedup=[...new Set(urls.map(safeSource).filter((v):v is string=>v!==null))];
 if(!kind||title.length<5||title.length>63||meta.length>150||
  body.length<200||body.length>15000||excerpt.length>260||
  dedup.length<1||dedup.length>12)return null;
 if(urls.length!==dedup.length&&urls.some(x=>!safeSource(x)))return null;
 return {kind,title,meta_description:meta,body,excerpt,source_urls:dedup};
}
export function isLikelyPdf(bytes:Uint8Array):boolean{
 if(bytes.length<400||bytes.length>3145728)return false;
 const ascii=new TextDecoder("latin1");
 const start=ascii.decode(bytes.subarray(0,8));
 const tail=ascii.decode(bytes.subarray(Math.max(0,bytes.length-2048)));
 return start.startsWith("%PDF-")&&tail.includes("%%EOF");
}
