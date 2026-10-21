/**
 * Private Presenter Prep's read-only editorial status, pinned to ONE already
 * selected immutable edition. No source requests, models or mutation.
 * Never use a later composed article to enrich an older selected base.
 */
export const PRESENTER_PREP_EDITORIAL_READ_V1="presenter-prep-editorial-read/1" as const;
type Data=Record<string,unknown>;
type Pinned={editionId:string;publishedAt:string};
export type PrepEditorialItem={
  storyId:string;headline:string;asOf:string;materialChangeAt:string|null;
  kind:"FULL_ARTICLE"|"FACTUAL_BRIEF"|"DEVELOPING";
  reporting:Array<{text:string;sourceName:string;sourceUrl:string;availableAt:string|null}>;
  implications:Array<{text:string;basis:string}>;
  gaps:string[];
  marketReaction:"NOT_ESTABLISHED_BY_EDITORIAL";
};
export type PrepEditorialReadiness={
  contractVersion:typeof PRESENTER_PREP_EDITORIAL_READ_V1;
  status:"UNAVAILABLE"|"NO_EDITORIAL"|"HAS_EDITORIAL";
  selectedEditionId:string|null;
  items:PrepEditorialItem[];
};
function data(x:unknown):Data|null {
  return x!==null&&typeof x==="object"&&!Array.isArray(x)?x as Data:null;
}
function txt(x:unknown,max=720):string|null {
  return typeof x==="string"&&x.trim().length>0&&x.trim().length<=max?x.trim():null;
}
function iso(x:unknown):string|null {
  const s=txt(x,60);
  return s&&Number.isFinite(Date.parse(s))?new Date(s).toISOString():null;
}
function uuid(x:unknown):boolean {
  return typeof x==="string"&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(x);
}
function source(x:unknown):string|null {
  const s=txt(x,2000);
  if(!s)return null;
  try{
    const u=new URL(s);
    if(u.protocol!=="https:"||u.username||u.password||!u.hostname.includes(".")
      ||["localhost","127.0.0.1"].includes(u.hostname))return null;
    return s;
  }catch{return null;}
}
function eligibleClock(raw:unknown,at:string):string|null{
  const d=iso(raw);
  return d&&Date.parse(d)<=Date.parse(at)?d:null;
}
function names(bundle:Data):Map<string,string>{
  const out=new Map<string,string>();
  if(!Array.isArray(bundle.sourceLinks))return out;
  for(const raw of bundle.sourceLinks.slice(0,16)){
    const o=data(raw);
    const url=source(o?.url),name=txt(o?.sourceName,100);
    if(url&&name)out.set(url,name);
  }
  return out;
}
function storyWitness(payload:Data,article:Data):boolean{
  const id=txt(article.storyId,100),version=txt(article.storyThesisVersionId,100);
  const snapshot=txt(article.storySnapshotId,100),asOf=iso(article.asOf);
  if(!id||!version||!snapshot||!asOf)return false;
  const packets=Array.isArray(payload.marketImpactPackets)?payload.marketImpactPackets:[];
  return packets.some(raw=>{
    const p=data(raw),identity=data(p?.identity);
    return p?.kind==="STORY"&&identity?.storyId===id
      && identity?.storyThesisVersionId===version
      && identity?.storySnapshotId===snapshot&&iso(p?.asOf)===asOf;
  });
}
function articleContext(payload:Data,article:Data,publicationAt:string):boolean {
  const asOf=eligibleClock(article.asOf,publicationAt);
  const material=article.materialChangeAt;
  return Boolean(asOf&&storyWitness(payload,article)
    &&(material===null||(iso(material)!==null&&Boolean(eligibleClock(material,asOf)))));
}
function frozenHeadline(payload:Data,article:Data):string{
  const id=article.storyId;
  const packet=(Array.isArray(payload.marketImpactPackets)?payload.marketImpactPackets:[])
    .map(data).find(p=>data(p?.identity)?.storyId===id);
  return txt(packet?.headline,180)||"Source-backed Story";
}
function validParent(bundle:Data,edition:{supersedesSnapshotId:string|null}):boolean {
  // Authored composed bundles MUST identify the exact base they supersede.
  return typeof edition.supersedesSnapshotId==="string"
    &&bundle.parentEditionId===edition.supersedesSnapshotId;
}
function fullArticle(
  payload:Data,raw:unknown,publicationAt:string,
):PrepEditorialItem|null{
  const a=data(raw);
  if(!a||a.contractVersion!=="article-sections/2"||a.readiness!=="FULL_ARTICLE"
    ||!articleContext(payload,a,publicationAt)
    ||!Array.isArray(a.reporting)||a.reporting.length<3||a.reporting.length>5
    ||!Array.isArray(a.interpretation)||a.interpretation.length<2||a.interpretation.length>5)return null;
  const asOf=iso(a.asOf)!;
  const links=names(a);
  const reporting:PrepEditorialItem["reporting"]=[];
  for(const rawPart of a.reporting){
    const p=data(rawPart),text=txt(p?.text),when=eligibleClock(p?.sourceAvailableAt,asOf);
    const urls=Array.isArray(p?.sourceUrls)?p.sourceUrls.map(source).filter((u):u is string=>Boolean(u)):[];
    const ids=Array.isArray(p?.evidenceIds)?p.evidenceIds:[];
    if(p?.basis!=="SOURCE_VERIFIED"||!text||text.length<160||!when
      ||ids.length===0||!ids.every(uuid)||urls.length===0||!urls.every(u=>links.has(u)))return null;
    reporting.push({text,sourceName:links.get(urls[0])!,sourceUrl:urls[0],availableAt:when});
  }
  if(new Set(reporting.map(p=>p.text)).size<3)return null;
  const implications:PrepEditorialItem["implications"]=[];
  let mechanism=false,asset=false;
  for(const rawPart of a.interpretation){
    const p=data(rawPart),text=txt(p?.text);
    const support=p?.support,basis=p?.basis;
    if(!text||!["CANONICAL_INTERPRETATION","HISTORICAL_CONTEXT","CONDITIONAL"].includes(String(basis))
      ||!["mechanism","asset","countercase","nextTest"].includes(String(support)))return null;
    mechanism||=support==="mechanism";asset||=support==="asset";
    implications.push({text,basis:String(basis)});
  }
  if(!mechanism||!asset)return null;
  return{
    storyId:String(a.storyId),headline:frozenHeadline(payload,a),asOf,
    materialChangeAt:iso(a.materialChangeAt),
    kind:"FULL_ARTICLE",reporting,implications,gaps:[],
    marketReaction:"NOT_ESTABLISHED_BY_EDITORIAL",
  };
}
function shortArticle(payload:Data,raw:unknown,publicationAt:string):PrepEditorialItem|null{
  const a=data(raw);
  if(!a||a.contractVersion!=="market-editorial/v1"||a.kind!=="STORY"
    ||!["READY","DEVELOPING"].includes(String(a.readiness))
    ||!articleContext(payload,a,publicationAt)||!Array.isArray(a.paragraphs))return null;
  const links=names(a);
  const asOf=iso(a.asOf)!;
  const reporting:PrepEditorialItem["reporting"]=[];
  const implications:PrepEditorialItem["implications"]=[];
  for(const rawPart of a.paragraphs.slice(0,4)){
    const p=data(rawPart),text=txt(p?.text);
    if(!text)continue;
    if(p?.role==="development"&&p.evidenceState==="SOURCE_VERIFIED"){
      const ids=Array.isArray(p.evidenceIds)?p.evidenceIds:[];
      const url=(Array.isArray(p.sourceUrls)?p.sourceUrls:[]).map(source).find(u=>u&&links.has(u));
      if(ids.length>0&&ids.every(uuid)&&url){
        reporting.push({text,sourceName:links.get(url)!,sourceUrl:url,availableAt:null});
      }
    }else if(["mechanism","markets","outlook"].includes(String(p?.role))
      &&["CONTEXT_ONLY","CANONICAL_INTERPRETATION","CONDITIONAL"].includes(String(p?.evidenceState))){
      implications.push({text,basis:String(p?.evidenceState)});
    }
  }
  const ready=a.readiness==="READY"&&reporting.length>0;
  return{
    storyId:String(a.storyId),headline:txt(a.headline,180)||frozenHeadline(payload,a),
    asOf,materialChangeAt:iso(a.materialChangeAt),
    kind:ready?"FACTUAL_BRIEF":"DEVELOPING",
    reporting,implications,
    gaps:ready?[]:[
      ...(reporting.length===0?["No source-verified factual opening admitted in this edition."]:[]),
      ...(a.readiness==="DEVELOPING"?["Full editorial verification is incomplete."]:[]),
    ],
    marketReaction:"NOT_ESTABLISHED_BY_EDITORIAL",
  };
}
export function buildPresenterPrepEditorialReadiness(input:{
  presenterStatus:"READY"|"UNAVAILABLE";
  pinned:Pinned|null;
  selectedEdition:{id:string;publishedAt:string;supersedesSnapshotId:string|null;
    payload:Record<string,unknown>}|null;
  focusedStoryId?:string|null;
}):PrepEditorialReadiness {
  const unavailable:PrepEditorialReadiness={
    contractVersion:PRESENTER_PREP_EDITORIAL_READ_V1,
    status:"UNAVAILABLE",selectedEditionId:null,items:[],
  };
  const {pinned,selectedEdition:e}=input;
  if(input.presenterStatus!=="READY"||!pinned||!e||pinned.editionId!==e.id
    ||iso(e.publishedAt)!==iso(pinned.publishedAt))return unavailable;
  const payload=e.payload;
  const items:PrepEditorialItem[]=[];
  const v2=data(payload.marketEditorialSectionsV2);
  if(v2?.contractVersion==="article-sections/2"&&validParent(v2,e)&&Array.isArray(v2.articles)){
    for(const raw of v2.articles.slice(0,3)){
      const item=fullArticle(payload,raw,e.publishedAt);
      if(item)items.push(item);
    }
  }
  const v1=data(payload.marketEditorial);
  if(v1?.contractVersion==="market-editorial/v1"&&validParent(v1,e)&&Array.isArray(v1.articles)){
    for(const raw of v1.articles.slice(0,3)){
      const item=shortArticle(payload,raw,e.publishedAt);
      if(item&&!items.some(i=>i.storyId===item.storyId))items.push(item);
    }
  }
  const focus=input.focusedStoryId;
  const ordered=focus?[...items.filter(i=>i.storyId===focus),...items.filter(i=>i.storyId!==focus)]:items;
  return {
    contractVersion:PRESENTER_PREP_EDITORIAL_READ_V1,selectedEditionId:e.id,
    status:ordered.length?"HAS_EDITORIAL":"NO_EDITORIAL",items:ordered.slice(0,3),
  };
}
