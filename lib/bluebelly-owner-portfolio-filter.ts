/** Owner-only view filtering. No market-data mutation or implied portfolio return. */
export type PortfolioTableQuery={
 hs?:string; hsort?:string; hquote?:string;
 ws?:string; wsort?:string; wquote?:string; wtheme?:string;
};
type Quote={last?:number|null;change?:number|null;change3d?:number|null;change5d?:number|null};
type Row=Record<string,unknown>;
type Kind="holdings"|"watchlist";
const value=(v:unknown)=>typeof v==="string"?v.trim():"";
const finite=(v:unknown):number|null=>typeof v==="number"&&Number.isFinite(v)?v:null;
const tickerOf=(row:Row)=>value(row.ticker).toUpperCase();
const sub=(row:Row)=>row.position&&typeof row.position==="object"&&!Array.isArray(row.position)
 ?row.position as Row:{};
function compareNullable(a:number|null,b:number|null,descending=true){
 if(a===null)return b===null?0:1;
 if(b===null)return -1;
 return descending?b-a:a-b;
}
export function filterPortfolioRows<T extends Row>(
 rows:T[],prices:Map<string,Quote>|undefined,kind:Kind,query:PortfolioTableQuery,
):T[]{
 const isHolding=kind==="holdings";
 const search=value(isHolding?query.hs:query.ws).slice(0,80).toLowerCase();
 const availability=value(isHolding?query.hquote:query.wquote);
 const theme=isHolding?"":value(query.wtheme).slice(0,180);
 const sort=value(isHolding?query.hsort:query.wsort);
 const eligible=rows.filter(row=>{
  const ticker=tickerOf(row);
  if(search&&!([ticker,value(row.name)].join(" ").toLowerCase().includes(search)))return false;
  if(theme&&value(row.theme)!==theme)return false;
  const priced=Boolean(prices?.has(ticker));
  if(availability==="priced"&&!priced)return false;
  if(availability==="missing"&&priced)return false;
  return true;
 });
 const metric=(r:T,key:"1d"|"3d"|"5d"|"close"|"quantity"|"score"|"rank")=>{
  if(key==="quantity")return finite(sub(r).quantity);
  if(key==="score"||key==="rank")return finite(r[key]);
  const quote=prices?.get(tickerOf(r));
  return finite(quote?.[key==="1d"?"change":key==="3d"?"change3d":key==="5d"?"change5d":"last"]);
 };
 if(!sort||sort==="original"&&isHolding)return eligible;
 if(sort==="alpha")return eligible.sort((a,b)=>tickerOf(a).localeCompare(tickerOf(b)));
 const mapping:Record<string,["1d"|"3d"|"5d"|"close"|"quantity"|"score"|"rank",boolean]>={
  gain1d:["1d",true],loss1d:["1d",false],gain3d:["3d",true],gain5d:["5d",true],
  close:["close",true],quantity:["quantity",true],score:["score",true],rank:["rank",false],
 };
 const selected=mapping[sort]??(isHolding?null:mapping.rank);
 if(!selected)return eligible;
 return eligible.sort((a,b)=>compareNullable(metric(a,selected[0]),metric(b,selected[0]),selected[1])
  ||tickerOf(a).localeCompare(tickerOf(b)));
}
