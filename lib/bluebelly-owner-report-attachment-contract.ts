/** Pure contract for supplemental, owner-only Daily Intelligence PDF downloads.
 * These are not canonical observations, published reports or source verification. */
export const REPORT_ATTACHMENT_BUCKET="editorial-pdfs";
export const REPORT_ATTACHMENT_PREFIX="private-daily-research";
export const REPORT_ATTACHMENT_MAX_BYTES=5_000_000;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FILENAME=/^20\d{2}-\d{2}-\d{2}--[a-z0-9-]{1,56}--[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/;
export function attachmentOwnerPrefix(ownerId:string){
 if(!UUID.test(ownerId))throw Error("INVALID_ATTACHMENT_OWNER");
 return REPORT_ATTACHMENT_PREFIX+"/"+ownerId.toLowerCase();
}
export function validAttachmentName(name:unknown):name is string{
 if(typeof name!=="string"||!FILENAME.test(name))return false;
 const day=name.slice(0,10);
 return Number.isFinite(Date.parse(day+"T00:00:00Z"))&&new Date(day+"T00:00:00Z").toISOString().slice(0,10)===day;
}
export function attachmentObjectName(day:string,sourceName:string,id:string){
 if(!UUID.test(id)||!/^20\d{2}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(Date.parse(day+"T00:00:00Z"))||
  new Date(day+"T00:00:00Z").toISOString().slice(0,10)!==day)throw Error("INVALID_ATTACHMENT_DAY");
 const slug=sourceName.replace(/\.pdf$/i,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,56)||"research-attachment";
 return day+"--"+slug+"--"+id.toLowerCase()+".pdf";
}
export function looksLikePdf(bytes:Uint8Array):boolean{
 if(bytes.length<1000||bytes.length>REPORT_ATTACHMENT_MAX_BYTES)return false;
 const header=new TextDecoder().decode(bytes.subarray(0,5));
 if(header!=="%PDF-")return false;
 const tail=new TextDecoder().decode(bytes.subarray(Math.max(0,bytes.length-2048)));
 return tail.includes("%%EOF");
}
