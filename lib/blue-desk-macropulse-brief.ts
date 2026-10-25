/** Editorial transport contract, not an independent source-verification claim. */
export type MacroPulseLink={url:string;label:string;kind:"PRIMARY_RELEASE"|"DATA_OBSERVATION"|"REPORTING"|"SOCIAL_LEAD"};
export type MacroPulseDigest={
 contractVersion:"bluebelly/macropulse-brief/1";
 sourcePageId:string;sourcePulseId:string;sourcePageUrl:string;
 sourcePublishedAt:string;sourceRetrievedAt:string;
 headline:string;standfirst:string;whatChanged:string;whyItMatters:string;
 countercase:string;watchNext:string;primaryRegion:"US"|"Europe"|"Asia"|"Other";
 editorialModel:string;sourceLinks:MacroPulseLink[];
};
export type PublicMacroPulseBrief={
 id:string;source_page_id:string;source_pulse_id:string;source_page_url:string;
 source_published_at:string;source_retrieved_at:string;headline:string;
 standfirst:string;what_changed:string;why_it_matters:string;
 countercase:string;watch_next:string;primary_region:MacroPulseDigest["primaryRegion"];
 source_links:MacroPulseLink[];verification_label:"RESEARCH_DERIVED_UNADJUDICATED";
 published_at:string;
};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PULSE=/^20\d\d-\d\d-\d\d-\d{4}-[a-z0-9-]{8,150}$/;
const CLEAN=/^[^\u0000-\u001f\u007f]*$/;
function field(v:unknown,min:number,max:number){
 return typeof v==="string"&&v.trim()===v&&v.length>=min&&v.length<=max&&
 CLEAN.test(v)?v:null;
}
function httpsUrl(value:unknown):string|null{
 if(typeof value!=="string"||value.length>1600)return null;
 try{
  const u=new URL(value);
  if(u.protocol!=="https:"||u.username||u.password||u.port||
    u.hostname.endsWith(".local")||u.hostname.endsWith(".internal")||
    /^\d+\.\d+\.\d+\.\d+$/.test(u.hostname)||
    u.hostname==="localhost"||u.hostname.endsWith(".example"))return null;
  return u.href;
 }catch{return null;}
}
function exactNotionPage(value:unknown,id:string):string|null{
 const url=httpsUrl(value);
 if(!url)return null;
 const u=new URL(url);
 if(u.search||u.hash)return null;
 const compact=id.toLowerCase().replaceAll("-","");
 if(!["www.notion.so","notion.so","app.notion.com"].includes(u.hostname))return null;
 if(!u.pathname.toLowerCase().replaceAll("-","").endsWith(compact))return null;
 return url;
}
export function parseMacroPulseDigest(value:unknown,now=new Date()):MacroPulseDigest|null{
 if(!value||typeof value!=="object"||Array.isArray(value)||!Number.isFinite(now.getTime()))
  return null;
 const x=value as Record<string,unknown>;
 if(x.contractVersion!=="bluebelly/macropulse-brief/1")return null;
 const sourcePageId=typeof x.sourcePageId==="string"&&UUID.test(x.sourcePageId)?x.sourcePageId:null;
 if(!sourcePageId)return null;
 const sourcePageUrl=exactNotionPage(x.sourcePageUrl,sourcePageId);
 const sourcePulseId=field(x.sourcePulseId,12,180);
 if(!sourcePageUrl||!sourcePulseId||!PULSE.test(sourcePulseId))return null;
 const p=Date.parse(String(x.sourcePublishedAt||""));
 const r=Date.parse(String(x.sourceRetrievedAt||""));
 const t=now.getTime();
 if(!Number.isFinite(p)||!Number.isFinite(r)||p>r||r>t+120000||
  p>t||p<t-7*86400000||r<t-2*86400000)return null;
 const headline=field(x.headline,20,140);
 const standfirst=field(x.standfirst,55,550);
 const whatChanged=field(x.whatChanged,60,1500);
 const whyItMatters=field(x.whyItMatters,70,1500);
 const countercase=field(x.countercase,50,1000);
 const watchNext=field(x.watchNext,40,950);
 const editorialModel=field(x.editorialModel,2,50);
 if(!headline||!standfirst||!whatChanged||!whyItMatters||
    !countercase||!watchNext||!editorialModel)return null;
 if(!["US","Europe","Asia","Other"].includes(String(x.primaryRegion)))return null;
 const urls=new Set<string>();
 const input=x.sourceLinks;
 if(!Array.isArray(input)||input.length<1||input.length>8)return null;
 const sourceLinks:MacroPulseLink[]=[];
 for(const raw of input){
  if(!raw||typeof raw!=="object"||Array.isArray(raw))return null;
  const v=raw as Record<string,unknown>;
  const url=httpsUrl(v.url),label=field(v.label,4,130),kind=v.kind;
  if(!url||!label||!["PRIMARY_RELEASE","DATA_OBSERVATION","REPORTING","SOCIAL_LEAD"].includes(String(kind))||
     urls.has(url))return null;
  urls.add(url);sourceLinks.push({url,label,kind:kind as MacroPulseLink["kind"]});
 }
 // Every brief is labelled research-derived. The sender cannot declare
 // independent verification, canonical acceptance or automatic publication.
 if(x.status!==undefined||x.verificationLabel!==undefined||x.storyDecision!==undefined)return null;
 return {contractVersion:"bluebelly/macropulse-brief/1",
  sourcePageId,sourcePulseId,sourcePageUrl,
  sourcePublishedAt:new Date(p).toISOString(),sourceRetrievedAt:new Date(r).toISOString(),
  headline,standfirst,whatChanged,whyItMatters,countercase,watchNext,
  primaryRegion:x.primaryRegion as MacroPulseDigest["primaryRegion"],
  editorialModel,sourceLinks};
}
