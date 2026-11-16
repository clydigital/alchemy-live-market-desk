/** Dated QQQ settlement positions: never imply an intraday short-covering flow. */
export type ShortPosition={settlement:string;shares:number;daysToCover:number|null};
type Obj=Record<string,unknown>;
const obj=(x:unknown):Obj=>x!==null&&typeof x==="object"&&!Array.isArray(x)?x as Obj:{};
function numeric(x:unknown):number|null{
 if(typeof x!=="number"&&typeof x!=="string")return null;
 const s=String(x).replace(/,/g,"").trim();
 if(!/^\d+(?:\.\d+)?$/.test(s))return null;
 const n=Number(s);return Number.isFinite(n)?n:null;
}
function date(x:unknown):string|null{
 if(typeof x!=="string")return null;
 const m=x.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
 const iso=m?m[3]+"-"+m[1].padStart(2,"0")+"-"+m[2].padStart(2,"0"):x;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(iso))return null;
 const t=Date.parse(iso+"T00:00:00Z");
 return Number.isFinite(t)&&new Date(t).toISOString().slice(0,10)===iso?iso:null;
}
export function decodeNasdaqQqqShortInterest(payload:unknown,now:Date):ShortPosition[]{
 const data=obj(obj(payload).data);
 if(data.symbol!=null&&String(data.symbol).toUpperCase()!=="QQQ")return [];
 const table=obj(data.shortInterestTable);
 const raw=Array.isArray(table.rows)?table.rows:[];
 const seen=new Set<string>(),result:ShortPosition[]=[];
 for(const entry of raw){
  const r=obj(entry),settlement=date(r.settlementDate),shares=numeric(r.interest??r.shortInterest),daysToCover=numeric(r.daysToCover);
  if(!settlement||Date.parse(settlement+"T00:00:00Z")>+now||shares===null||!Number.isSafeInteger(shares)||seen.has(settlement))continue;
  seen.add(settlement);result.push({settlement,shares,daysToCover});
 }
 return result.sort((a,b)=>b.settlement.localeCompare(a.settlement)).slice(0,26);
}
export const RESEARCH_SNAPSHOT={settlement:"2026-10-30",shares:82794708,previousShares:82001618,daysToCover:1.91,
 publishedOn:"2026-11-10",floatRange:"12.22–12.27%",sources:[
  {label:"MarketBeat",url:"https://www.marketbeat.com/stocks/NASDAQ/QQQ/short-interest/"},
  {label:"ChartExchange",url:"https://chartexchange.com/symbol/nasdaq-qqq/short-interest"},
  {label:"Benzinga",url:"https://www.benzinga.com/quote/QQQ/short-interest"}
 ]} as const;
export function positioningRead(rows:readonly ShortPosition[],now:Date){
 const latest=rows[0],previous=rows[1];
 const age=latest?Math.floor((+now-Date.parse(latest.settlement+"T00:00:00Z"))/86400000):null;
 const fresh=age!==null&&age>=0&&age<=35&&latest.settlement>=RESEARCH_SNAPSHOT.settlement;
 const change=latest&&previous&&previous.shares>0?(latest.shares/previous.shares-1)*100:null;
 return {latest:latest??null,previous:previous??null,age,fresh,change,
  state:!fresh?"UNVERIFIED":change===null?"REPORTED":change<0?"SHORT INTEREST FALLING":change>0?"SHORT INTEREST RISING":"SHORT INTEREST FLAT"} as const;
}

/** FINRA published calendar. Publication day uses 16:40 ET dataset availability.
 * Calendar is deliberately bounded; beyond it the desk asks for a calendar refresh.
 */
export const RELEASE_CALENDAR_SOURCE="https://www.finra.org/filing-reporting/regulatory-filing-systems/short-interest";
const RELEASES=[
 ["2026-10-30","2026-11-10"],["2026-11-13","2026-11-24"],["2026-11-30","2026-12-09"],
 ["2026-12-15","2026-12-24"],["2026-12-31","2027-01-12"],
 ["2027-01-15","2027-01-27"],["2027-01-29","2027-02-09"],["2027-02-12","2027-02-24"],
 ["2027-02-26","2027-03-09"],["2027-03-15","2027-03-24"],["2027-03-31","2027-04-09"],
 ["2027-04-15","2027-04-26"],["2027-04-30","2027-05-11"],["2027-05-14","2027-05-25"],
 ["2027-05-28","2027-06-09"],["2027-06-15","2027-06-25"],["2027-06-30","2027-07-12"],
 ["2027-07-15","2027-07-26"],["2027-07-30","2027-08-10"],["2027-08-13","2027-08-24"],
 ["2027-08-31","2027-09-10"],["2027-09-15","2027-09-24"],["2027-09-30","2027-10-11"],
 ["2027-10-15","2027-10-26"],["2027-10-29","2027-11-09"],["2027-11-15","2027-11-24"],
 ["2027-11-30","2027-12-09"],["2027-12-15","2027-12-27"],["2027-12-31","2028-01-11"],
] as const;
export function qqqReleaseClock(settlement:string,now:Date){
 const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(now);
 const p=(key:string)=>parts.find(v=>v.type===key)?.value??"";
 const et=p("year")+"-"+p("month")+"-"+p("day")+"T"+p("hour")+":"+p("minute");
 const published=RELEASES.filter(x=>x[1]+"T16:40"<=et).at(-1);
 const next=RELEASES.find(x=>x[1]+"T16:40">et);
 return {expected:published?.[0]??null,publishedOn:published?.[1]??null,nextSettlement:next?.[0]??null,nextRelease:next?.[1]??null,
  state:!next&&!published?"CALENDAR NOT AVAILABLE":published&&settlement<published[0]?"NEW REPORT DUE":!next?"CALENDAR REFRESH NEEDED":"ON SCHEDULE"} as const;
}
export type TapeWindow={session:string|null;qqq:number|null;smh:number|null;rsp:number|null;spy:number|null};
export function qqqTapeState(one:TapeWindow,three:TapeWindow,five:TapeWindow){
 const valid=(x:TapeWindow)=>Boolean(x.session&&[x.qqq,x.smh,x.rsp,x.spy].every(n=>typeof n==="number"&&Number.isFinite(n)));
 const comparable=valid(one)&&valid(three)&&one.session===three.session;
 const followThrough=comparable&&valid(five)&&one.session===five.session;
 if(!valid(one))return "INCOMPLETE MATCHED SESSIONS";
 if(one.qqq!<0&&one.smh!<one.qqq!&&one.rsp!>0)return "TECH ROTATION / NO COVERING CONFIRMATION";
 if(comparable&&one.qqq!>0&&three.qqq!>0&&one.smh!>=one.qqq!&&three.smh!>=three.qqq!&&one.rsp!>=0&&three.rsp!>=0){
  return followThrough&&five.qqq!>0&&five.smh!>0&&five.rsp!>=0?"MULTI-SESSION RECOVERY CANDIDATE":"REVERSAL CANDIDATE";
 }
 if(one.qqq!>0)return "BOUNCE / COVERING UNCONFIRMED";
 if(comparable&&one.qqq!<0&&three.qqq!<0&&three.smh!<three.qqq!)return "SELLING PRESSURE PERSISTS";
 return "MIXED TAPE";
}
