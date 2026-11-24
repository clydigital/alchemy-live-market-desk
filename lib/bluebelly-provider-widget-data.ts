// Pure, source-dated market widget calculations. No credentials or network.
export const SECTOR_TICKERS = ["XLB","XLC","XLE","XLF","XLI","XLK","XLP","XLRE","XLU","XLV","XLY"] as const;
export const BENCHMARK_TICKERS = ["SPY","QQQ","RSP","SMH","SOXX"] as const;
export const FX_TICKERS = ["EUR/USD","USD/JPY","XAU/USD","BTC/USD"] as const;
export type DailyClose = {day:string;close:number};
export type WidgetRow = {symbol:string;day:string;close:number;change:number|null;priorDay:string|null};
export function validDay(day:string):boolean{
 return /^\d{4}-\d{2}-\d{2}$/.test(day)&&Number.isFinite(Date.parse(day))&&new Date(day).toISOString().slice(0,10)===day;
}
export function rankClose(symbol:string,bars:DailyClose[]):WidgetRow|null{
 const sorted=[...bars].filter(b=>validDay(b.day)&&Number.isFinite(b.close)&&b.close>0).sort((a,b)=>b.day.localeCompare(a.day));
 const last=sorted[0];if(!last)return null;
 const prior=sorted.find(b=>b.day<last.day);
 const change=prior?(last.close/prior.close-1)*100:null;
 return {symbol,day:last.day,close:last.close,change:change!==null&&Number.isFinite(change)?change:null,priorDay:prior?.day??null};
}
export function parseMassiveDay(payload:unknown,day:string):Record<string,number>{
 const root=payload as {status?:string;results?:Array<{T?:unknown;c?:unknown}>}|null;
 if(!validDay(day)||root?.status!=="OK"||!Array.isArray(root.results))return {};
 const allow=new Set<string>([...SECTOR_TICKERS,...BENCHMARK_TICKERS]);
 const values:Record<string,number>={};
 for(const row of root.results)if(typeof row.T==="string"&&allow.has(row.T)&&typeof row.c==="number"&&Number.isFinite(row.c)&&row.c>0)values[row.T]=row.c;
 return values;
}
export function parseTwelveDaily(payload:unknown,symbol:string,beforeDay:string):WidgetRow|null{
 const root=payload as {status?:string;meta?:{symbol?:string;interval?:string};values?:Array<{datetime?:unknown;close?:unknown}>}|null;
 if(root?.status!=="ok"||root.meta?.symbol!==symbol||root.meta?.interval!=="1day"||!Array.isArray(root.values))return null;
 return rankClose(symbol,root.values.flatMap(v=>{
  const day=v.datetime;
  const close=typeof v.close==="string"&&v.close.trim()!==""?Number(v.close):NaN;
  return typeof day==="string"&&validDay(day)&&day<beforeDay&&Number.isFinite(close)&&close>0?[{day,close}]:[];
 }));
}
