export type SpotSymbol="XAU/USD"|"BTC/USD"|"ETH/USD";
export type SpotQuote={symbol:SpotSymbol;price:number|null;asOf:string|null;state:"fresh"|"stale"|"unavailable";source:string;sourceUrl:string;unit:string};
const obj=(x:unknown):Record<string,unknown>=>x&&typeof x==="object"&&!Array.isArray(x)?x as Record<string,unknown>:{};
const price=(x:unknown):number|null=>{const n=typeof x==="number"?x:typeof x==="string"&&x.trim()?Number(x):NaN;return Number.isFinite(n)&&n>0?n:null};
const stamp=(x:unknown):string|null=>typeof x==="string"&&/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(x)&&Number.isFinite(Date.parse(x))?new Date(x).toISOString():null;
export function unavailableSpot(symbol:SpotSymbol):SpotQuote{
 const gold=symbol==="XAU/USD";
 return {symbol,price:null,asOf:null,state:"unavailable",source:gold?"XAUS":"Coinbase Exchange",sourceUrl:gold?"https://xaus.com/api/":"https://exchange.coinbase.com/trade/"+symbol.replace("/","-"),unit:gold?"USD / troy oz":"USD"};
}
export function parseSpotQuote(symbol:SpotSymbol,payload:unknown,now:Date):SpotQuote{
 const base=unavailableSpot(symbol),p=obj(payload),gold=symbol==="XAU/USD",ds=obj(p.data_state);
 if(gold&&ds.status!=="fresh"&&ds.status!=="stale")return base;
 const value=price(gold?p.spot_usd_oz:p.price),at=stamp(gold?ds.as_of:p.time);
 if(value===null||!at)return base;
 const age=+now-Date.parse(at);
 if(!Number.isFinite(age)||age<0)return base;
 return {...base,price:value,asOf:at,state:age>(gold?30:5)*60000||gold&&ds.status==="stale"?"stale":"fresh"};
}
