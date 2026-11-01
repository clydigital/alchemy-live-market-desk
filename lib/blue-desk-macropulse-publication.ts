/** Owner-only, deliberately manual publication of a research-derived dispatch.
 * Publishing preserves RESEARCH_DERIVED_UNADJUDICATED; it does not upgrade
 * original evidence, market causality, canonical Story or Regime status.
 */
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const SHA=/^[0-9a-f]{64}$/;
export type DigestApproval={
 id:string;digestSha256:string;
 checkedSources:boolean;checkedTimeWindows:boolean;
 checkedCountercase:boolean;approvePublicResearch:boolean;
};
export function parseDigestApproval(input:unknown):DigestApproval|null{
 if(!input||typeof input!=="object"||Array.isArray(input))return null;
 const value=input as Record<string,unknown>;
 const allowed=["id","digestSha256","checkedSources","checkedTimeWindows",
  "checkedCountercase","approvePublicResearch"];
 if(Object.keys(value).length!==allowed.length||
   Object.keys(value).some(key=>!allowed.includes(key))||
   typeof value.id!=="string"||!UUID.test(value.id)||
   typeof value.digestSha256!=="string"||!SHA.test(value.digestSha256)||
   !allowed.slice(2).every(key=>value[key]===true))return null;
 return value as DigestApproval;
}
export type ReviewableDispatch={
 status:string;digest_sha256:string;
 source_published_at:string;source_retrieved_at:string;
 verification_label:string;source_links:unknown;
};
export function dispatchIsReviewable(row:ReviewableDispatch,now:Date):boolean{
 const t=now.getTime(),s=Date.parse(row.source_published_at),r=Date.parse(row.source_retrieved_at);
 if(!Number.isFinite(t)||!Number.isFinite(s)||!Number.isFinite(r)||
   s>r||r>t||s>t||t-s>7*86400000||
   row.status!=="review"||!SHA.test(row.digest_sha256)||
   row.verification_label!=="RESEARCH_DERIVED_UNADJUDICATED"||
   !Array.isArray(row.source_links)||row.source_links.length<1||row.source_links.length>8)
   return false;
 let corroborating=false;
 for(const link of row.source_links){
  if(!link||typeof link!=="object")return false;
  const x=link as Record<string,unknown>;
  if(typeof x.url!=="string"||typeof x.label!=="string"||
    !["PRIMARY_RELEASE","DATA_OBSERVATION","REPORTING","SOCIAL_LEAD"].includes(String(x.kind)))return false;
  try{
   const u=new URL(x.url);
   if(u.protocol!=="https:"||u.username||u.password||!u.pathname||u.pathname==="/"||
     u.hostname==="localhost"||u.hostname.endsWith(".local")||
     u.hostname.endsWith(".internal"))return false;
  }catch{return false;}
  if(x.kind==="PRIMARY_RELEASE"||x.kind==="REPORTING")corroborating=true;
 }
 return corroborating;
}
