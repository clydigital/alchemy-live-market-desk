/**
 * First-party schedule discovery for BEA Personal Income and Outlays.
 * Only the original BEA current/next-year schedules are admitted. Original
 * publication clocks are ET 08:30. These are EVENTS, not released actuals.
 * This runs within the existing macro actual collector, never a new task.
 */
import type {EconomicCalendarEvent} from "../calendar.ts";
const PAGES=[
 "https://www.bea.gov/news/schedule",
 "https://www.bea.gov/news/schedule/next-year",
] as const;
const MONTHS=[
 "january","february","march","april","may","june",
 "july","august","september","october","november","december",
] as const;
function cleanText(body:string){
 return body.replace(/<(?:script|style|noscript|svg)\b[^>]*>[\s\S]*?<\/(?:script|style|noscript|svg)>/gi," ")
  .replace(/<[^>]+>/g," ").replace(/&nbsp;|&#160;/gi," ")
  .replace(/&amp;/gi,"&").replace(/\s+/g," ").trim();
}
function calendarDate(year:number,month:number,day:number){
 const d=new Date(Date.UTC(year,month-1,day));
 if(!Number.isFinite(d.getTime())||d.getUTCFullYear()!==year||
   d.getUTCMonth()+1!==month||d.getUTCDate()!==day)return null;
 return d.toISOString().slice(0,10);
}
export function parseOfficialBeaPceSchedule(html:string,sourceUrl:string){
 if(!PAGES.includes(sourceUrl as typeof PAGES[number])||html.length>1_000_000)return [];
 const text=cleanText(html);
 const yearMatch=/\bYear\s+(20\d{2})\b/i.exec(text.slice(0,12_000));
 if(!yearMatch)return [];
 const releaseYear=Number(yearMatch[1]);
 const scheduleRow=/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})\s+8:30\s*AM\s+(?:(?:N\s*e\s*w\s*s|News)\s+)?Personal Income and Outlays,\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})\b/gi;
 const rows:EconomicCalendarEvent[]=[];
 for(const hit of text.matchAll(scheduleRow)){
  const month=MONTHS.indexOf(hit[1].toLowerCase() as typeof MONTHS[number])+1;
  const date=calendarDate(releaseYear,month,Number(hit[2]));
  const reference=hit[3].toLowerCase(),referenceYear=Number(hit[4]);
  // Reference period is at most two months before release (holiday/shutdown
  // delays can cross a calendar year); never derive it from the release date.
  const releaseMonthSerial=releaseYear*12+month;
  const referenceMonthSerial=referenceYear*12+MONTHS.indexOf(reference as typeof MONTHS[number])+1;
  if(!date||!referenceYear||releaseMonthSerial-referenceMonthSerial<1||
    releaseMonthSerial-referenceMonthSerial>3)continue;
  const monthShort=reference.slice(0,3);
  rows.push({
   id:"us-bea-"+date+"-personal-income-outlays-"+monthShort+"-"+referenceYear,
   date,timeLabel:"08:30 ET",country:"United States",
   g7Markets:["United States"],event:"Personal Income and Outlays",
   category:"Inflation",impact:"High",
   referencePeriod:hit[3][0].toUpperCase()+hit[3].slice(1).toLowerCase()+" "+referenceYear,
   status:"Scheduled",actual:null,consensus:null,previous:null,
   decidingQuestion:"Do core PCE, headline prices and real consumption change the Fed inflation and growth outlook?",
   affectedAssets:["USD","US02Y","SPX","GOLD"],
   sourceName:"U.S. Bureau of Economic Analysis",
   sourceUrl,sourceKind:"official-live",
  });
 }
 return [...new Map(rows.map(row=>[row.id,row])).values()].slice(0,18);
}
export async function getOriginalBeaPceSchedule(options:{
 fetchImpl?:typeof fetch,
 now?:Date,
}={}):Promise<{events:EconomicCalendarEvent[];attempted:number;read:number}>{
 const fetchImpl=options.fetchImpl??fetch;
 let read=0;
 const pages=await Promise.all(PAGES.map(async url=>{
  try{
   const res=await fetchImpl(url,{cache:"no-store",
    headers:{accept:"text/html,application/xhtml+xml",
      "user-agent":"Bluebelly scheduled official BEA calendar reader"},
    signal:AbortSignal.timeout(8_000)});
   if(!res.ok||(res.url&&new URL(res.url).toString()!==url)
     ||!(res.headers.get("content-type")||"text/html").includes("text/html"))
     return [];
   const body=(await res.text()).slice(0,900_000);
   const rows=parseOfficialBeaPceSchedule(body,url);
   if(rows.length>0)read++;
   return rows;
  }catch{return [];}
 }));
 const events=[...new Map(pages.flat().map(row=>[row.id,row])).values()];
 const now=(options.now??new Date()).getTime();
 // Avoid admitting the distant past, but keep enough runway for the next
 // fiscal year and the current release's bounded historical recovery.
 return {events:events.filter(row=>{
  const t=Date.parse(row.date+"T00:00:00Z");
  return t>=now-15*86_400_000&&t<=now+380*86_400_000;
 }),attempted:PAGES.length,read};
}
