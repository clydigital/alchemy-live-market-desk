import { marketStoryHeadline } from "./market-story-headline.ts";
import { MARKET_EDITORIAL_V1, type MarketEditorialRole } from "./market-editorial-v1.ts";

export const BLUE_DESK_EDITORIAL_READ_V1 = "blue-desk-editorial-read/v1" as const;
type ObjectRecord = Record<string, unknown>;
export type BlueDeskEditorialReadV1 = {
  contractVersion: typeof BLUE_DESK_EDITORIAL_READ_V1;
  editionId: string;
  publishedAt: string;
  articles: Array<{
    articleId: string;
    kind: "STORY" | "MOTION";
    title: string;
    asOf: string;
    materialChangeAt: string | null;
    context: "VERIFIED_EVENT" | "MATERIAL_STORY_CHANGE" | "CONTINUING_STORY";
    paragraphs: Array<{
      role: MarketEditorialRole;
      text: string;
      evidenceState: "SOURCE_VERIFIED" | "CANONICAL_INTERPRETATION" | "CONDITIONAL" | "CONTEXT_ONLY";
      sources: Array<{ url: string; sourceName: string }>;
    }>;
    sourceLinks: Array<{ url: string; sourceName: string }>;
  }>;
};

const UUID=/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const HASH=/^[0-9a-f]{32}$/i;
const PROCESS=/^(?:observed by research gap|detected:|detected\b|story:\s*detected|verification pending|awaiting provider|source retrieval failed|research gap)/i;
const OPERATIONAL=/\b(?:pipeline|system 2|canonical evidence|dossier status|thesis version|source coverage|provider authentication|ingestion)\b/i;
const ROLES: MarketEditorialRole[]=["development","mechanism","markets","outlook"];
const EVIDENCE_STATES=["SOURCE_VERIFIED","CANONICAL_INTERPRETATION","CONDITIONAL","CONTEXT_ONLY"];
function record(v: unknown):ObjectRecord|null {
  return v && typeof v==="object"&&!Array.isArray(v) ? v as ObjectRecord:null;
}
function string(v:unknown):string|null {
  return typeof v==="string" && v.trim() ? v.trim():null;
}
function time(v:unknown,latest?:string):string|null {
  const s=string(v);
  if (!s||!Number.isFinite(Date.parse(s))) return null;
  const d=new Date(s).toISOString();
  return latest && Date.parse(d)>Date.parse(latest)?null:d;
}
function directUrl(v:unknown):string|null {
  const s=string(v);
  if (!s||s.length>2048) return null;
  try {
    const u=new URL(s);
    return u.protocol==="https:"&&!u.username&&!u.password
      &&u.hostname.length>3&&(u.pathname!=="/"||Boolean(u.search))?u.href:null;
  }catch{return null;}
}
function plainTitle(factualParagraph:string,rawTitle:unknown):string|null {
  const original=marketStoryHeadline([string(rawTitle)]);
  const fallback=marketStoryHeadline([factualParagraph]);
  const selection=(original&&original.length<=63?original:fallback)||"";
  if (!selection||PROCESS.test(selection)||OPERATIONAL.test(selection)) return null;
  if (selection.length<=63) return selection;
  const cut=selection.slice(0,62).trimEnd();
  const last=cut.lastIndexOf(" ");
  return (last>=24?cut.slice(0,last):cut).trimEnd()+"…";
}
/**
 * Immutable publication -> limited public-facing reader contract. Never exposes
 * raw Dossier lessons, evidence candidate pools, model prompts, internal IDs,
 * private source metadata or mutable Story state. Does not query a database.
 *
 * This is deliberately a pure projector: deploy the public route only after
 * the independent P-1 access classification/audit and V7 frontend agreement.
 */
export function projectBlueDeskMarketEditorial(input:unknown):BlueDeskEditorialReadV1|null {
  const edition=record(input);
  const id=string(edition?.id);
  const publishedAt=time(edition?.published_at);
  const payload=record(edition?.payload);
  const editorial=record(payload?.marketEditorial);
  if (!id||!UUID.test(id)||!publishedAt||!editorial
    ||editorial.contractVersion!==MARKET_EDITORIAL_V1||!Array.isArray(editorial.articles)) return null;
  const articles:BlueDeskEditorialReadV1["articles"]=[];
  const seen=new Set<string>();
  for (const raw of editorial.articles.slice(0,3)) {
    const article=record(raw);
    const hash=string(article?.fingerprint),kind=article?.kind;
    const asOf=time(article?.asOf,publishedAt);
    const materialChangeAt=article?.materialChangeAt===null ? null : time(article?.materialChangeAt,asOf||undefined);
    const lineage=article?.lineage;
    if (!hash||!HASH.test(hash)||seen.has(hash)||!asOf||article?.readiness!=="READY"
      ||!["STORY","MOTION"].includes(String(kind))
      ||(kind==="MOTION"&&(lineage!=="VERIFIED_MOTION_ONLY"
        ||article?.storyThesisVersionId!==null||article?.storySnapshotId!==null))
      ||(kind==="STORY"&&(!UUID.test(String(article?.storyThesisVersionId))
        ||!UUID.test(String(article?.storySnapshotId))
        ||!["EXACT_EDITION_MANIFEST","FROZEN_DOSSIER_CONTEXT"].includes(String(lineage))))
      ||(lineage==="FROZEN_DOSSIER_CONTEXT"&&article?.materialChangeAt!==null)
      ||(article?.materialChangeAt!==null&&!materialChangeAt)) continue;
    const originalSourceLinks=new Map<string,string>();
    for(const item of Array.isArray(article.sourceLinks)?article.sourceLinks.slice(0,12):[]) {
      const link=record(item),url=directUrl(link?.url),name=string(link?.sourceName);
      if(url&&name&&name.length<=90)originalSourceLinks.set(url,name);
    }
    if (!originalSourceLinks.size)continue;
    const rawParagraphs=article.paragraphs;
    if (!Array.isArray(rawParagraphs)||rawParagraphs.length<3||rawParagraphs.length>4)continue;
    const paragraphs:BlueDeskEditorialReadV1["articles"][number]["paragraphs"]=[];
    let rejected=false;
    const used=new Set<string>();
    for(const item of rawParagraphs) {
      const p=record(item),role=p?.role as MarketEditorialRole,text=string(p?.text);
      const evidenceState=p?.evidenceState;
      if(!ROLES.includes(role)||paragraphs.some(x=>x.role===role)||!text||text.length<30||text.length>720
        ||!EVIDENCE_STATES.includes(String(evidenceState))||PROCESS.test(text)||OPERATIONAL.test(text)){rejected=true;break;}
      const urls=Array.isArray(p?.sourceUrls)?p.sourceUrls:[];
      const sources:Array<{url:string;sourceName:string}>=[];
      for(const rawUrl of urls) {
        const url=directUrl(rawUrl),name=url?originalSourceLinks.get(url):null;
        if(!url||!name){rejected=true;break;}
        sources.push({url,sourceName:name});
        used.add(url);
      }
      if(rejected)break;
      if(role==="development"&&(evidenceState!=="SOURCE_VERIFIED"||!sources.length)){rejected=true;break;}
      if(role==="markets"&&evidenceState!=="CONDITIONAL"){rejected=true;break;}
      paragraphs.push({role,text,evidenceState:evidenceState as typeof EVIDENCE_STATES[number] & BlueDeskEditorialReadV1["articles"][number]["paragraphs"][number]["evidenceState"],sources});
    }
    if (rejected||!["development","mechanism","markets"].every(role=>paragraphs.some(p=>p.role===role)))continue;
    const development=paragraphs.find(p=>p.role==="development")!;
    const title=plainTitle(development.text,article.headline);
    if(!title)continue;
    seen.add(hash);
    articles.push({
      articleId:hash,kind:kind as "STORY" | "MOTION",title,asOf,materialChangeAt,
      context:kind==="MOTION"?"VERIFIED_EVENT":materialChangeAt?"MATERIAL_STORY_CHANGE":"CONTINUING_STORY",
      paragraphs,sourceLinks:[...used].map(url=>({url,sourceName:originalSourceLinks.get(url)!})),
    });
  }
  return {contractVersion:BLUE_DESK_EDITORIAL_READ_V1,editionId:id,publishedAt,articles};
}
