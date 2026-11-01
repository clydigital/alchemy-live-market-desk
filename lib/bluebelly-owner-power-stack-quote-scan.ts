import type {PublicMarketObservation} from "./blue-desk-public-markets";

type SourceRow={
 ticker?:unknown; status?:unknown; sessionDate?:unknown; close?:unknown;
 changePct?:unknown; change3dPct?:unknown; change5dPct?:unknown;
 sourceName?:unknown; reason?:unknown; refreshStatus?:unknown;
};
type Input={
 contractVersion?:unknown; generatedAt?:unknown; holdings?:unknown; watchlist?:unknown;
};
export type OwnerPowerStackQuoteScan={
 asOf:string|null;
 holdingRows:Map<string,PublicMarketObservation>;
 watchRows:Map<string,PublicMarketObservation>;
 unresolvedHolding:Array<{ticker:string;reason:string}>;
 unresolvedWatch:Array<{ticker:string;reason:string}>;
 holdingTracked:number;watchTracked:number;holdingPriced:number;watchPriced:number;
};

function date(value:unknown):string|null {
 if(typeof value!=="string"||!/^20\d{2}-\d{2}-\d{2}$/.test(value))return null;
 const time=Date.parse(value+"T00:00:00Z");
 return Number.isFinite(time)&&new Date(time).toISOString().slice(0,10)===value?value:null;
}
function recentSession(value:string,now=new Date()){
 const d=Date.parse(value+"T00:00:00Z");
 const today=Date.parse(now.toISOString().slice(0,10)+"T00:00:00Z");
 if(!Number.isFinite(d)||d>today)return false;
 let businessDays=0;
 for(let t=d+86400000;t<=today;t+=86400000){
  const day=new Date(t).getUTCDay();
  if(day!==0&&day!==6)businessDays++;
 }
 return businessDays<=2;
}
function n(v:unknown):number|null{return typeof v==="number"&&Number.isFinite(v)?v:null;}
function safeTicker(v:unknown){
 return typeof v==="string"&&/^[A-Z0-9][A-Z0-9.\-]{0,17}$/.test(v)?v:"";
}
function readRows(value:unknown,now:Date){
 const data=Array.isArray(value)?value.slice(0,200) as SourceRow[]:[];
 const priced=new Map<string,PublicMarketObservation>();
 const unresolved:Array<{ticker:string;reason:string}>=[];
 for(const raw of data){
  const ticker=safeTicker(raw?.ticker);
  if(!ticker)continue;
  const session=date(raw.sessionDate),last=n(raw.close);
  const good=raw.status==="CLOSED"&&session!==null&&recentSession(session,now)&&last!==null&&last>0;
  if(!good){
   unresolved.push({ticker,reason:raw.status==="CLOSED"?"Price observation stale or invalid":
    typeof raw.reason==="string"?raw.reason.slice(0,160):"Source-mapped price unavailable"});
   continue;
  }
  const row:PublicMarketObservation={
   id:"owner-quote:"+ticker,symbol:ticker,label:ticker,type:"Power Stack",
   last,change:n(raw.changePct),change3d:n(raw.change3dPct),change5d:n(raw.change5dPct),
   changeUnit:"%",frequency:"daily",asOf:session,
   sourceName:typeof raw.sourceName==="string"?raw.sourceName.slice(0,100):"Exchange-session chart feed",
   sourceUrl:null,
  };
  const prev=priced.get(ticker);
  if(!prev||session!==(prev.asOf||"")&&session>(prev.asOf||""))priced.set(ticker,row);
 }
 return {priced,unresolved,tracked:data.length};
}
export function readOwnerPowerStackQuoteScan(snapshot:unknown,now=new Date()):OwnerPowerStackQuoteScan|null{
 if(!snapshot||typeof snapshot!=="object"||Array.isArray(snapshot))return null;
 const input=(snapshot as Record<string,unknown>).quoteScan as Input|null;
 if(!input||input.contractVersion!=="bluebelly-private-power-stack-scan/1")return null;
 const stamp=typeof input.generatedAt==="string"&&Number.isFinite(Date.parse(input.generatedAt))?input.generatedAt:null;
 const holdings=readRows(input.holdings,now),watchlist=readRows(input.watchlist,now);
 return {
  asOf:stamp,holdingRows:holdings.priced,watchRows:watchlist.priced,
  unresolvedHolding:holdings.unresolved,unresolvedWatch:watchlist.unresolved,
  holdingTracked:holdings.tracked,watchTracked:watchlist.tracked,
  holdingPriced:holdings.priced.size,watchPriced:watchlist.priced.size,
 };
}
