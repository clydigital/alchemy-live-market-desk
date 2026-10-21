import type { EconomicCalendarEvent } from "./calendar.ts";

export const OFFICIAL_BLS_RELEASE_SCHEDULES = [
  { key:"cpi", url:"https://www.bls.gov/schedule/news_release/cpi.htm", family:"Consumer Price Index",category:"Inflation", question:"Do headline and core CPI change rate expectations?", assets:["USD","US02Y","SPX","GOLD"] },
  { key:"ppi", url:"https://www.bls.gov/schedule/news_release/ppi.htm", family:"Producer Price Index",category:"Inflation", question:"Does PPI change pipeline inflation and Fed expectations?", assets:["USD","US02Y","SPX"] },
  { key:"employment", url:"https://www.bls.gov/schedule/news_release/empsit.htm", family:"Employment Situation",category:"Labour",question:"Do payrolls, unemployment and wages alter the policy path?",assets:["USD","US02Y","SPX"] },
  { key:"jolts", url:"https://www.bls.gov/schedule/news_release/jolts.htm", family:"Job Openings and Labor Turnover Survey",category:"Labour", question:"Is hiring demand tightening or easing?",assets:["USD","US02Y","SPX"] },
] as const;
const MONTHS = ["january","february","march","april","may","june","july","august","september","october","november","december"];
const MONTH_SHORT = MONTHS.map(x=>x.slice(0,3));
const stripped = (s:string) => s.replace(/<[^>]*>/g," ").replace(/&nbsp;|&#160;/ig," ").replace(/&amp;/ig,"&").replace(/\s+/g," ").trim();

export function parseOfficialBlsScheduleHtml(
  html:string, definition:(typeof OFFICIAL_BLS_RELEASE_SCHEDULES)[number],
):EconomicCalendarEvent[] {
  const events:EconomicCalendarEvent[]=[];
  for(const match of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells=[...match[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(x=>stripped(x[1]));
    if(cells.length<3)continue;
    const reference=cells[0].match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})\b/i);
    const date=cells[1].match(/\b([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(20\d{2})\b/);
    if(!reference||!date)continue;
    const index=MONTH_SHORT.indexOf(date[1].slice(0,3).toLowerCase());
    if(index<0)continue;
    const day=Number(date[2]),year=Number(date[3]);
    const actualDay=new Date(Date.UTC(year,index,day));
    if(actualDay.getUTCMonth()!==index || actualDay.getUTCDate()!==day)continue;
    const iso=actualDay.toISOString().slice(0,10);
    const time=cells[2].match(/\b(0?[1-9]|1[0-2]):(\d{2})\s*(AM|PM)\b/i);
    if(!time)continue;
    const hour=(Number(time[1])%12)+(time[3].toUpperCase()==="PM"?12:0);
    const hh=String(hour).padStart(2,"0")+":"+time[2];
    const ref=reference[1]+" "+reference[2];
    events.push({
      id:"us-bls-"+iso+"-"+definition.key+"-"+ref.toLowerCase().replaceAll(" ","-"),
      date:iso,timeLabel:hh+" ET",country:"United States",g7Markets:["United States"],
      event:definition.family+" for "+ref,category:definition.category,impact:"High",
      referencePeriod:ref,status:"Scheduled",actual:null,consensus:null,previous:null,
      decidingQuestion:definition.question,affectedAssets:[...definition.assets],
      sourceName:"U.S. Bureau of Labor Statistics",sourceUrl:definition.url,
      sourceKind:"official-live",
    });
  }
  return events;
}

export async function getOfficialBlsReleaseTables(fetcher:typeof fetch = fetch):Promise<EconomicCalendarEvent[]> {
  const responses=await Promise.all(OFFICIAL_BLS_RELEASE_SCHEDULES.map(async definition=>{
    try{
      const response=await fetcher(definition.url,{
        headers:{accept:"text/html","user-agent":"Alchemy Live Desk economic calendar"},
        next:{revalidate:6*60*60},signal:AbortSignal.timeout(5000),
      });
      if(!response.ok)return [];
      return parseOfficialBlsScheduleHtml(await response.text(),definition);
    }catch{return [];}
  }));
  return responses.flat();
}
