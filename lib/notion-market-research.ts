/**
 * Owner-only, read-only Notion research intake. The attached Notion integration
 * must have been explicitly shared the MacroPulse and Research Gap pages.
 * Notion text is RESEARCH INPUT, not independently verified market evidence.
 * Never import this module in a public page or give it a mutation capability.
 */
export type NotionResearchSource = {
  kind: "MACROPULSE" | "RESEARCH_GAP";
  title: string;
  url: string;
  pageId: string;
  retrievedAt: string;
  text: string;
  originalLinks: string[];
  /** MYT day of the source edition, distinct from the fetch timestamp. */
  editionDay?: string;
  /** Source-owned run quality, not a Bluebelly verification grade. */
  coverageStatus?: string;
};
export type NotionResearchBundle = {
  status: "READY_FOR_REVIEW" | "PARTIAL" | "NOT_CONFIGURED" | "UNAVAILABLE";
  sources: NotionResearchSource[];
  warnings: string[];
  fetchedAt: string;
};

const API="https://api.notion.com/v1";
const VERSION="2025-09-03";
const UUID=/^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;
const MACRO_ROOT="3ea519b6-7a94-8161-ba4d-ec8f97ebf658";
const GATE_SOURCE="b76f7ce0-ad59-49a1-8aac-61271f310493";
/** Only HTTP status and a fixed hint are displayed. Never forward Notion's
 * response body, token, request URL or any private content into diagnostics. */
export function notionResearchErrorHint(error:unknown):string {
  if(error instanceof Error && error.name==="AbortError")
    return "request timeout";
  const status=error instanceof Error
    ? Number(error.message.match(/^Notion read failed: (\d{3})$/)?.[1]||0) : 0;
  switch(status){
    case 400:return "HTTP 400: Notion API request/schema incompatible";
    case 401:return "HTTP 401: Notion token rejected or expired";
    case 403:return "HTTP 403: integration has insufficient permissions";
    case 404:return "HTTP 404: source ID missing or not shared with integration";
    case 429:return "HTTP 429: Notion rate limit";
    default:return status>=500&&status<600?"Notion API server error": "network error or timeout";
  }
}
type AnyRecord = Record<string,unknown>;
function obj(v:unknown):AnyRecord {
  return v!==null && typeof v==="object" && !Array.isArray(v) ? v as AnyRecord : {};
}
function rows(v:unknown):AnyRecord[] {
  return Array.isArray(v) ? v.map(obj) : [];
}
function txt(v:unknown,max=400):string {
  return typeof v==="string"?v.trim().slice(0,max):"";
}
function safePageId(v:unknown):string|null{
  const s=txt(v,50);
  return UUID.test(s)?s.replace(/-/g,"").toLowerCase():null;
}
function sameId(a:unknown,b:string):boolean{
  return safePageId(a)===safePageId(b);
}
function blocksText(blocks:readonly AnyRecord[],max=11000):{text:string;links:string[]}{
  const lines:string[]=[];
  const links=new Set<string>();
  // Notion Pulse posts often paste raw source URLs into text rather than
  // hyperlinking them. Extract both representations as UNVERIFIED candidates,
  // never as assertions or confirmed original-source receipts.
  const remember=(value:unknown)=>{
    if(typeof value!=="string"||links.size>=32)return;
    const trimmed=value.trim().replace(/[).,;!?\]}>]+$/g,"");
    try{
      const u=new URL(trimmed);
      if(u.protocol!=="https:"||u.username||u.password||
         u.href.length>2000||u.hostname.endsWith(".local")||
         u.hostname.endsWith(".internal")||
         /^(?:localhost|127(?:\.\d+){3}|0\.0\.0\.0)$/i.test(u.hostname))return;
      links.add(u.href);
    }catch{ /* not a valid https candidate */ }
  };
  for(const block of blocks){
    const type=txt(block.type,32);
    if(!["paragraph","heading_1","heading_2","heading_3","bulleted_list_item",
      "numbered_list_item","quote","callout","table_row","toggle"].includes(type))continue;
    const child=obj(block[type]);
    const rich=rows(child.rich_text);
    const paragraph=rich.map(span=>{
      const text=obj(span.text);
      const original=txt(span.plain_text,3500)||txt(text.content,3500);
      const link=txt(obj(span.href).url,2000)||txt(span.href,2000)||txt(text.link && obj(text.link).url,2000);
      if(link)remember(link);
      for(const match of original.matchAll(/https:\/\/[^\s<>"'`]+/g))remember(match[0]);
      return original;
    }).join("");
    if(paragraph) lines.push((type.startsWith("heading")?"## ":"")+paragraph);
    if(lines.join("\n").length>=max)break;
  }
  return {text:lines.join("\n").slice(0,max),links:[...links]};
}
export function extractNotionResearchBlocks(v:unknown,max=11000){
  return blocksText(rows(v),max);
}
export function selectNotionResearchPages(searchResults:unknown,day:string,macroRoot=MACRO_ROOT,gateSource=GATE_SOURCE){
  const items=rows(searchResults);
  // Database row titles are schema-specific (e.g. Research Gap uses "Run",
  // not "title" or "Name"). Select the actual Notion title property by type.
  const name=(item:AnyRecord)=>{
    const props=obj(item.properties);
    const typed=Object.values(props).map(obj).find(p=>p.type==="title");
    const field=typed||[props.Run,props.title,props.Name].map(obj)
      .find(p=>Array.isArray(p.title))||{};
    return rows(obj(field).title).map(s=>txt(s.plain_text,250)||txt(obj(s.text).content,250)).join("")||
      rows(item.title).map(s=>txt(s.plain_text,250)||txt(obj(s.text).content,250)).join("");
  };
  const macro=items.find(p=>name(p)===day+" — MacroPulse" &&
    sameId(obj(p.parent).page_id,macroRoot));
  const gates=items.filter(p=>{
    const title=name(p);
    const parent=obj(p.parent);
    return title.startsWith(day+" ")&&/Research Gap (?:Gate|Investigation)(?: \(\d{1,2}:\d{2} slot\))?$/i.test(title) &&
      (sameId(parent.data_source_id,gateSource)||sameId(parent.database_id,gateSource));
  }).sort((a,b)=>name(b).localeCompare(name(a)));
  return {archiveId:safePageId(macro?.id),gateId:safePageId(gates[0]?.id)};
}
/** Parent-scoped fallback when Notion title search omits pages in a collection. */
export function selectMacroPulseArchiveChild(blocks:unknown,day:string):string|null{
  const exact=day+" — MacroPulse";
  const item=rows(blocks).find(b=>b.type==="child_page" &&
    txt(obj(b.child_page).title,250)===exact&&safePageId(b.id));
  return safePageId(item?.id);
}
export function selectPulseChildPages(blocks:unknown,max=2) {
  return rows(blocks).filter(b=>b.type==="child_page"&&safePageId(b.id))
    .map(b=>({id:safePageId(b.id)!,title:txt(obj(b.child_page).title,300)}))
    .filter(b=>b.title.length>5)
    // Slot titles may be "20:00 MYT" or "25 Oct ... 18:00": sort
    // by explicit slot time, never by Notion block insertion timestamps.
    .sort((a,b)=>{
      const slot=(v:string)=>{
        const h=v.match(/(?:^|\D)(\d{1,2}):(\d{2})(?=\s*MYT)/i);
        return h?Number(h[1])*60+Number(h[2]):-1;
      };
      return slot(b.title)-slot(a.title);
    }).slice(0,Math.max(0,Math.min(3,max)));
}
async function notionRequest(token:string,path:string,body?:object):Promise<AnyRecord>{
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),11000);
  try {
    const res=await fetch(API+path,{
      method:body?"POST":"GET",
      headers:{"Authorization":"Bearer "+token,"Notion-Version":VERSION,
        ...(body?{"Content-Type":"application/json"}:{})},
      body:body?JSON.stringify(body):undefined,
      cache:"no-store",
      signal:controller.signal,
    });
    if(!res.ok) throw Error("Notion read failed: "+res.status);
    return obj(await res.json());
  }finally{clearTimeout(timeout);}
}
async function children(token:string,id:string,maxPages=2):Promise<AnyRecord[]>{
  const blocks:AnyRecord[]=[];
  let cursor:string|undefined;
  for(let i=0;i<maxPages;i++){
    const url="/blocks/"+id+"/children?page_size=100"+(cursor?"&start_cursor="+encodeURIComponent(cursor):"");
    const response=await notionRequest(token,url);
    blocks.push(...rows(response.results));
    const next=txt(response.next_cursor,200);
    if(!response.has_more||!next)break;
    cursor=next;
  }
  return blocks.slice(0,150);
}
/**
 * Search remains the inexpensive first pass. Missing hits are retried using
 * exactly the authorised MacroPulse page parent and Research Gap data source,
 * never a workspace-wide guess. API 2025-09-03 queries data_sources, not
 * databases. Results still pass the same parent/title validation.
 */
async function discoverNotionDay(
  token:string,day:string,macroRoot:string,gateSource:string,
):Promise<{archiveId:string|null;gateId:string|null;searchPaginated:boolean;fallbackWarnings:string[]}>{
  const fallbackWarnings:string[]=[];
  let searchResults:AnyRecord[]=[];
  let searchPaginated=false;
  try{
    const search=await notionRequest(token,"/search",{
      query:day,sort:{direction:"descending",timestamp:"last_edited_time"},page_size:100,
    });
    searchResults=rows(search.results);
    searchPaginated=Boolean(search.has_more);
  }catch(error){fallbackWarnings.push("Notion title search unavailable ("+notionResearchErrorHint(error)+"); parent-scoped read attempted.");}
  const found=selectNotionResearchPages(searchResults,day,macroRoot,gateSource);
  if(found.archiveId&&found.gateId)return {...found,searchPaginated,fallbackWarnings};
  const [archive,gate]=await Promise.all([
    found.archiveId?Promise.resolve(found.archiveId):children(token,macroRoot,2)
      .then(items=>selectMacroPulseArchiveChild(items,day))
      .catch(error=>{fallbackWarnings.push("MacroPulse root page could not be listed ("+notionResearchErrorHint(error)+").");return null;}),
    found.gateId?Promise.resolve(found.gateId):
      notionRequest(token,"/data_sources/"+gateSource+"/query",{
        filter:{property:"Run",title:{contains:day}},page_size:100,
      }).then(res=>selectNotionResearchPages(res.results,day,macroRoot,gateSource).gateId)
        .catch(error=>{fallbackWarnings.push("Research Gap data source could not be queried ("+notionResearchErrorHint(error)+").");return null;}),
  ]);
  // A successful exact parent and data-source read supersedes a failing
  // workspace title search. The title-search outage does not mean the
  // complete, independently scoped results are missing.
  if(archive&&gate){
    return {archiveId:archive,gateId:gate,searchPaginated,
      fallbackWarnings:fallbackWarnings.filter(w=>!w.startsWith("Notion title search unavailable"))};
  }
  return {archiveId:archive,gateId:gate,searchPaginated,fallbackWarnings};
}
export async function fetchTodayNotionResearch(now=new Date()):Promise<NotionResearchBundle>{
  const fetchedAt=now.toISOString();
  const token=process.env.NOTION_API_TOKEN?.trim()||process.env.NOTION_MARKET_RESEARCH_TOKEN?.trim();
  if(!token) return {status:"NOT_CONFIGURED",sources:[],fetchedAt,
    warnings:["Notion server-side read-only token is not configured. No research was silently imported."]};
  const day=new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Kuala_Lumpur",
    year:"numeric",month:"2-digit",day:"2-digit"}).format(now);
  const macroRoot=process.env.NOTION_MACROPULSE_ROOT_PAGE_ID||MACRO_ROOT;
  const gateSource=process.env.NOTION_RESEARCH_GATE_DATA_SOURCE_ID||GATE_SOURCE;
  if(!safePageId(macroRoot)||!safePageId(gateSource))
    return {status:"UNAVAILABLE",sources:[],fetchedAt,warnings:["Invalid configured Notion source IDs."]};
  const sources:NotionResearchSource[]=[];
  const warnings:string[]=[];
  try{
    const today=await discoverNotionDay(token,day,macroRoot,gateSource);
    warnings.push(...today.fallbackWarnings);
    // During the first MYT hours the new day may have no full Pulse or Gate.
    // Carry the preceding day's latest real research with an explicit vintage
    // warning; never re-label it as today's coverage.
    const previousDay=new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Kuala_Lumpur",
      year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(now.getTime()-24*3600_000));
    let previous:{archiveId:string|null;gateId:string|null}={archiveId:null,gateId:null};
    if(!today.gateId||!today.archiveId){
      const prior=await discoverNotionDay(token,previousDay,macroRoot,gateSource);
      previous=prior;
      warnings.push(...prior.fallbackWarnings.map(w=>"Previous-day lookup: "+w));
      // Exact parent-scoped MacroPulse and data-source Gate fallbacks already
      // validated the absent title-search hits. Workspace search pagination
      // alone is not a source-coverage failure; preserve real fallback errors.
    }
    const selected={
      archiveId:today.archiveId||previous.archiveId,
      gateId:today.gateId||previous.gateId,
    };
    if(!today.gateId&&selected.gateId)warnings.push(
      "Latest accessible Research Gap run is from "+previousDay+" MYT; no current-day run was found.");
    if(!today.archiveId&&selected.archiveId)warnings.push(
      "Latest accessible full MacroPulse posts are from "+previousDay+" MYT; today's daily archive is not yet available.");
    if(selected.gateId){
      try{
        const [page, pageBlocks]=await Promise.all([
          notionRequest(token,"/pages/"+selected.gateId),
          children(token,selected.gateId,2),
        ]);
        const parsed=blocksText(pageBlocks,12500);
        const props=obj(page.properties);
        const select=(name:string)=>{
          const p=obj(props[name]);
          return txt(obj(p.select).name,60)||txt(obj(p.status).name,60);
        };
        const incomplete=[select("Status"),select("Coverage"),select("Input Health")]
          .some(v=>/^(PARTIAL|FAILED|MATERIAL GAP|INSUFFICIENT)$/i.test(v));
        if(incomplete||/(?:Coverage\s+PARTIAL|Input Health\s+PARTIAL|Run\s+PARTIAL|eligible overflow|unconsumed eligible)/i.test(parsed.text))
          warnings.push("The latest Research Gap run explicitly reports partial coverage, failed inputs or unread overflow. Treat its findings as bounded.");
        const title=rows(obj(props.Run).title).map(v=>txt(v.plain_text,300)||txt(obj(v.text).content,300)).join("") ||
          (today.gateId?day:previousDay)+" — latest Research Gap run";
        if(parsed.text) sources.push({kind:"RESEARCH_GAP",title,
          url:"https://www.notion.so/"+selected.gateId,pageId:selected.gateId,
          editionDay:today.gateId?day:previousDay,coverageStatus:select("Coverage")||select("Status")||undefined,
          retrievedAt:fetchedAt,text:parsed.text,originalLinks:parsed.links});
      }catch(error) {warnings.push("Research Gap run could not be read ("+notionResearchErrorHint(error)+"); coverage unknown.");}
    }else warnings.push(warnings.some(w=>/Research Gap data source could not be queried/i.test(w))
      ?"Research Gap Gate availability cannot be determined because Notion data-source access failed."
      :"Today's Research Gap Gate not found in the authorised Notion source.");
    if(selected.archiveId){
      try{
        const available=selectPulseChildPages(await children(token,selected.archiveId,2),2);
        for(const page of available){
          try{
            const parsed=blocksText(await children(token,page.id,2),9500);
            if(parsed.text)sources.push({kind:"MACROPULSE",title:page.title,
              url:"https://www.notion.so/"+page.id,pageId:page.id,
              editionDay:today.archiveId?day:previousDay,
              retrievedAt:fetchedAt,text:parsed.text,originalLinks:parsed.links});
          }catch(error){warnings.push("A selected MacroPulse post could not be read ("+notionResearchErrorHint(error)+"); slot coverage partial.");}
        }
        if(!available.length)warnings.push("No full MacroPulse posts found for today's day archive.");
      }catch(error){warnings.push("MacroPulse day archive could not be read ("+notionResearchErrorHint(error)+").");}
    }else warnings.push(warnings.some(w=>/MacroPulse root page could not be listed/i.test(w))
      ?"MacroPulse archive availability cannot be determined because Notion root-page access failed."
      :"Today's MacroPulse archive not found in authorised Notion source.");

  }catch{return {status:"UNAVAILABLE",sources:[],fetchedAt,
    warnings:["Notion read could not complete. Do not reuse an undated cached report."]};}
  const readBlocked=sources.length===0&&warnings.some(w=>
    /(?:root page could not be listed|data source could not be queried|archive could not be read|run could not be read)/i.test(w));
  return {status:readBlocked?"UNAVAILABLE":
      sources.some(s=>s.kind==="MACROPULSE")&&sources.some(s=>s.kind==="RESEARCH_GAP")&&warnings.length===0
        ?"READY_FOR_REVIEW":"PARTIAL",
    sources,warnings,fetchedAt};
}