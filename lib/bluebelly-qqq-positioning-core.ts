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
