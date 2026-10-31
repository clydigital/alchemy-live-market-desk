import type {NewsBriefV1} from "./market-brief-news.ts";

/** Pure, owner-only My Desk projection. The saved report is the parent.
 * Suggestions are ephemeral views, not new slates, evidence or article archives. */
export type DailyTopicIdea={
 rank:1|2|3;
 title:string;
 format:"COTD"|"OB"|"BOTH";
 theme:string;
 thesis:string;
 antithesis:string;
 nextCheck:string;
 technicalCheck:string;
 sourceUrls:string[];
 provenance:"DAILY_REPORT"|"NEWSROOM_SUPPLEMENT"|"RESEARCH_GAP";
 reportSection:string|null;
};
const DIMISS=/\b(appendix|provenance|pilot proves|research process|original sources|source ledger|what the creators|reader instructions|chronology|five.minute read|three paths|cause.chain)\b/i;
const SAFE_URL=(raw:string):string|null=>{
 try{
  const x=new URL(raw.replace(/&amp;/g,"&"));
  return x.protocol==="https:"&&!x.username&&!x.password&&x.href.length<=2048?x.href:null;
 }catch{return null;}
};
function plain(value:string):string{
 return value.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi," ")
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi," ")
  .replace(/<span\b[^>]*class=["'][^"']*\brefs\b[^"']*["'][^>]*>[\s\S]*?<\/span>/gi," ")
  .replace(/<[^>]*>/g," ")
  .replace(/&#(x[0-9a-f]+|\d+);/gi,(_,x:string)=>{
    const n=x[0].toLowerCase()==="x"?parseInt(x.slice(1),16):Number(x);
    return n>31&&n<0x110000?String.fromCodePoint(n):" ";
  })
  .replace(/&(amp|lt|gt|quot|apos|nbsp|ndash|mdash|rsquo|lsquo|hellip);/gi,(_,v:string)=>({
    amp:"&",lt:"<",gt:">",quot:'"',apos:"'",nbsp:" ",ndash:"–",mdash:"—",
    rsquo:"’",lsquo:"‘",hellip:"…",
  })[v.toLowerCase() as "amp"]||" ")
  .replace(/\s+/g," ").trim();
}
function excerpt(value:string,length=410):string{
 const v=plain(value);if(v.length<=length)return v;
 const candidate=v.slice(0,length);
 const last=Math.max(candidate.lastIndexOf(". "),candidate.lastIndexOf("; "),candidate.lastIndexOf(" — "));
 return (last>=length*.55?candidate.slice(0,last+1):candidate.replace(/\s+\S*$/,""))+"…";
}
function themeFor(title:string){
 if(/\b(intel|sandisk|semi|chip|memory|hynix|nvidia|tsmc|amd)\b/i.test(title))
  return {theme:"Semiconductors",format:"COTD" as const,technical:"Compare SOXX/semiconductor breadth with the Nasdaq and each named issuer's next guidance; do not infer a current chart signal."};
 if(/\b(oil|brent|hormuz|diesel|gasoil|lng|crude|opec|tanker)\b/i.test(title))
  return {theme:"Energy",format:"OB" as const,technical:"Check time-matched Brent, products/crack spreads and inventories before attributing an equity or inflation response."};
 if(/\b(fed|fomc|bond|yield|pce|cpi|inflation|boj|rates|treasury)\b/i.test(title))
  return {theme:"Rates & policy",format:"OB" as const,technical:"Check dated US 2Y/10Y/30Y yields, DXY and rate-path repricing against the event time."};
 if(/\b(ai|capex|cash|funding|financ|microsoft|alphabet|amazon|meta|cloud)\b/i.test(title))
  return {theme:"AI & cash flow",format:"COTD" as const,technical:"Compare issuer capex, operating cash flow and free cash flow with QQQ/SOXX breadth; confirm observation dates."};
 if(/\b(usd|yen|jpy|fx|currency|dollar)\b/i.test(title))
  return {theme:"FX",format:"COTD" as const,technical:"Check DXY and USD/JPY 4H/daily trend bands against dated yield and risk observations."};
 return {theme:"Other markets",format:"BOTH" as const,technical:"Match the event's exact timestamp to the affected asset, sector and relevant benchmark before drawing a technical conclusion."};
}
function sourcesFrom(html:string){
 const sources:string[]=[];
 for(const match of html.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["']/gi)){
  const url=SAFE_URL(match[1]);if(url&&!sources.includes(url))sources.push(url);
  if(sources.length>=6)break;
 }
 return sources;
}
function extractSections(html:string){
 const sections:Array<{title:string;body:string;id:string}>=[];
 for(const match of html.matchAll(/<section\b([^>]*)>([\s\S]*?)<\/section\s*>/gi)){
  const heading=match[2].match(/<h2\b[^>]*>([\s\S]*?)<\/h2\s*>/i);
  if(!heading)continue;
  const title=plain(heading[1]);
  const id=match[1].match(/\bid=["']([a-z0-9_-]{1,72})["']/i)?.[1]||"";
  if(title.length<15||title.length>180||DIMISS.test(title)||/^(verdict|tape|sources|qa|scenario|creator|provenance)$/i.test(id))continue;
  sections.push({title,body:match[2],id});
 }
 return sections;
}
/** One idea per distinct subject where possible. No invented reaction, quote,
 * empirical countercase or technical level; missing research is explicit. */
export function projectReportLedTopicIdeas(
 html:string|null,verifiedNews:readonly NewsBriefV1[]=[],limit=3
):DailyTopicIdea[]{
 const candidates:DailyTopicIdea[]=[];
 if(html&&html.length>=1000){
  for(const section of extractSections(html)){
   const paragraphs=[...section.body.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p\s*>/gi)]
    .map(m=>plain(m[1])).filter(v=>v.length>=75&&v.length<5000);
   if(!paragraphs.length)continue;
   const topic=themeFor(section.title);
   const counter=paragraphs.slice(1).find(v=>/\b(however|but|yet|although|whereas|alternativ|unresolved|not necessarily|does not|doesn't|cannot|could|risk|instead|while)\b/i.test(v));
   const next=paragraphs.slice(1).find(v=>/\b(next|watch|test|confirm|invalidate|falsif|guidance|revision|would change|upcoming|look for)\b/i.test(v));
   candidates.push({
    rank:1,title:section.title,format:topic.format,theme:topic.theme,
    thesis:excerpt(paragraphs[0]),
    antithesis:counter?excerpt(counter,340):
     "A rival explanation has not been established in this section. Test whether the observed move reflects the stated mechanism or a separate driver.",
    nextCheck:next?excerpt(next,360):
     "Confirm the next dated official release and event-matched price response; the current report does not specify a decisive trigger here.",
    technicalCheck:topic.technical,
    sourceUrls:sourcesFrom(section.body),provenance:"DAILY_REPORT",
    reportSection:section.id||null,
   });
  }
 }
 const result:DailyTopicIdea[]=[];
 const seenThemes=new Set<string>();
 const usedTitles=new Set<string>();
 for(const uniqueOnly of [true,false]){
  for(const item of candidates){
   if(result.length>=Math.max(0,Math.min(3,limit)))break;
   if(usedTitles.has(item.title)||uniqueOnly&&seenThemes.has(item.theme))continue;
   result.push(item);seenThemes.add(item.theme);usedTitles.add(item.title);
  }
 }
 // The Newsroom is a source-qualified supplement, not a new daily parent.
 for(const news of verifiedNews){
  if(result.length>=Math.max(0,Math.min(3,limit)))break;
  if(news.verification!=="SOURCE_VERIFIED"||!SAFE_URL(news.sourceUrl))continue;
  const topic=themeFor(news.headline);
  if(result.some(item=>item.title.toLowerCase()===news.headline.toLowerCase()||
    item.sourceUrls.includes(news.sourceUrl)||item.theme===topic.theme))continue;
  result.push({
   rank:1,title:news.headline,format:topic.format,theme:topic.theme,
   thesis:excerpt(news.summary),antithesis:"The causal interpretation remains open: another driver or a temporary reaction may explain the market move. This needs independent confirmation.",
   nextCheck:"Check the next official update, the event-matched market reaction and evidence that would contradict this interpretation.",
   technicalCheck:topic.technical,sourceUrls:[news.sourceUrl],
   provenance:"NEWSROOM_SUPPLEMENT",reportSection:null,
  });
 }
 while(result.length<Math.max(0,Math.min(3,limit))){
  result.push({
   rank:1,title:"Open research slot — no defensible third angle yet",
   format:"BOTH",theme:"Evidence gap",thesis:"The current Daily Report and source-verified Newsroom material do not establish another distinct topic.",
   antithesis:"Do not recycle the same report story or elevate a creator claim solely to fill this slot.",
   nextCheck:"Investigate a new dated catalyst with an original source and a falsifiable competing explanation.",
   technicalCheck:"No technical reading or price reaction is claimed.",
   sourceUrls:[],provenance:"RESEARCH_GAP",reportSection:null,
  });
 }
 return result.map((idea,i)=>({...idea,rank:(i+1) as 1|2|3}));
}
/** Archive visibility cutover, not deletion of historical source records. */
export const MY_DESK_ARCHIVE_CUTOVER="2026-10-31T12:53:20.000Z";
export function postCutoverDailyArchive<T extends {createdAt:string}>(
 editions:readonly T[],cutover=MY_DESK_ARCHIVE_CUTOVER
):T[]{
 return editions.filter(e=>Number.isFinite(Date.parse(e.createdAt))&&Date.parse(e.createdAt)>=Date.parse(cutover));
}
