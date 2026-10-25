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
    return title.startsWith(day+" ")&&/Research Gap Gate$/i.test(title) &&
      (sameId(parent.data_source_id,gateSource)||sameId(parent.database_id,gateSource));
  }).sort((a,b)=>name(b).localeCompare(name(a)));
  return {archiveId:safePageId(macro?.id),gateId:safePageId(gates[0]?.id)};
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
    const search=await notionRequest(token,"/search",{
      query:day,sort:{direction:"descending",timestamp:"last_edited_time"},page_size:100,
    });
    const today=selectNotionResearchPages(search.results,day,macroRoot,gateSource);
    // During the first MYT hours the new day may have no full Pulse or Gate.
    // Carry the preceding day's latest real research with an explicit vintage
    // warning; never re-label it as today's coverage.
    const previousDay=new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Kuala_Lumpur",
      year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(now.getTime()-24*3600_000));
    let previous:{archiveId:string|null;gateId:string|null}={archiveId:null,gateId:null};
    if(!today.gateId||!today.archiveId){
      try{
        const priorSearch=await notionRequest(token,"/search",{
          query:previousDay,sort:{direction:"descending",timestamp:"last_edited_time"},page_size:100,
        });
        previous=selectNotionResearchPages(priorSearch.results,previousDay,macroRoot,gateSource);
        if(priorSearch.has_more)warnings.push("Previous MYT day Notion discovery may be partial: search results paginated.");
      }catch {warnings.push("Previous MYT day research lookup unavailable; overnight coverage unverified.");}
    }
    const selected={
      archiveId:today.archiveId||previous.archiveId,
      gateId:today.gateId||previous.gateId,
    };
    if(!today.gateId&&selected.gateId)warnings.push(
      "Latest accessible Research Gap Gate is from "+previousDay+" MYT; today's Gate is not yet available.");
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
          warnings.push("The latest Research Gap Gate explicitly reports partial coverage, failed inputs or unread overflow. Treat its findings as bounded.");
        if(parsed.text) sources.push({kind:"RESEARCH_GAP",title:(today.gateId?day:previousDay)+" — latest Research Gap Gate",
          url:"https://www.notion.so/"+selected.gateId,pageId:selected.gateId,
          retrievedAt:fetchedAt,text:parsed.text,originalLinks:parsed.links});
      }catch {warnings.push("Research Gap run could not be read; coverage unknown.");}
    }else warnings.push("Today's Research Gap Gate not found in the authorised Notion source.");
    if(selected.archiveId){
      try{
        const available=selectPulseChildPages(await children(token,selected.archiveId,2),2);
        for(const page of available){
          try{
            const parsed=blocksText(await children(token,page.id,2),9500);
            if(parsed.text)sources.push({kind:"MACROPULSE",title:page.title,
              url:"https://www.notion.so/"+page.id,pageId:page.id,
              retrievedAt:fetchedAt,text:parsed.text,originalLinks:parsed.links});
          }catch{warnings.push("A selected MacroPulse post could not be read; slot coverage partial.");}
        }
        if(!available.length)warnings.push("No full MacroPulse posts found for today's day archive.");
      }catch{warnings.push("MacroPulse day archive could not be read.");}
    }else warnings.push("Today's MacroPulse archive not found in authorised Notion source.");
    if(search.has_more)warnings.push("Notion search results were paginated; latest-page discovery may be partial.");
  }catch{return {status:"UNAVAILABLE",sources:[],fetchedAt,
    warnings:["Notion read could not complete. Do not reuse an undated cached report."]};}
  return {status:sources.length===3&&warnings.length===0?"READY_FOR_REVIEW":"PARTIAL",sources,warnings,fetchedAt};
}