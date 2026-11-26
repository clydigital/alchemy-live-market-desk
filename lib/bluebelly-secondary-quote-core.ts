export type SecondarySpec={symbol:string;label:string;type:"INDEX"|"CURRENCY"|"FUTURE";currency:string;unit:string};
export const SECONDARY_QUOTE_SPECS:readonly SecondarySpec[]=[
 {symbol:"DX-Y.NYB",label:"DXY dollar index",type:"INDEX",currency:"USD",unit:"index points"},
 {symbol:"JPY=X",label:"USD/JPY",type:"CURRENCY",currency:"JPY",unit:"JPY per USD"},
 {symbol:"EURUSD=X",label:"EUR/USD",type:"CURRENCY",currency:"USD",unit:"USD per EUR"},
 {symbol:"GBPUSD=X",label:"GBP/USD",type:"CURRENCY",currency:"USD",unit:"USD per GBP"},
 {symbol:"AUDUSD=X",label:"AUD/USD",type:"CURRENCY",currency:"USD",unit:"USD per AUD"},
 {symbol:"CL=F",label:"WTI front-month futures",type:"FUTURE",currency:"USD",unit:"USD / barrel"},
 {symbol:"BZ=F",label:"Brent front-month futures",type:"FUTURE",currency:"USD",unit:"USD / barrel"},
 {symbol:"HG=F",label:"Copper front-month futures",type:"FUTURE",currency:"USD",unit:"USD / lb"},
 {symbol:"SI=F",label:"Silver front-month futures",type:"FUTURE",currency:"USD",unit:"USD / troy oz"},
 {symbol:"NG=F",label:"Natural gas front-month futures",type:"FUTURE",currency:"USD",unit:"USD / MMBtu"},
 {symbol:"ES=F",label:"S&P 500 front-month futures",type:"FUTURE",currency:"USD",unit:"index points"},
 {symbol:"NQ=F",label:"Nasdaq 100 front-month futures",type:"FUTURE",currency:"USD",unit:"index points"}
];
export type SecondaryQuote=SecondarySpec&{price:number|null;asOf:string|null;state:"recent"|"old"|"unavailable";sourceUrl:string};
const obj=(v:unknown):Record<string,unknown>=>v&&typeof v==="object"&&!Array.isArray(v)?v as Record<string,unknown>:{};
export function missingSecondary(spec:SecondarySpec):SecondaryQuote{
 return {...spec,price:null,asOf:null,state:"unavailable",sourceUrl:"https://finance.yahoo.com/quote/"+encodeURIComponent(spec.symbol)+"/"};
}
export function recheckSecondary(q:SecondaryQuote,now:Date):SecondaryQuote{
 if(!q.asOf||q.price===null)return q;
 const age=+now-Date.parse(q.asOf);
 if(!Number.isFinite(age)||age<0)return missingSecondary(q);
 return {...q,state:age<=30*60000?"recent":"old"};
}
export function parseSecondary(spec:SecondarySpec,payload:unknown,now:Date):SecondaryQuote{
 const base=missingSecondary(spec),chart=obj(obj(payload).chart);
 if(chart.error!=null||!Array.isArray(chart.result)||chart.result.length!==1)return base;
 const m=obj(obj(chart.result[0]).meta),p=m.regularMarketPrice,t=m.regularMarketTime;
 if(m.symbol!==spec.symbol||m.instrumentType!==spec.type||m.currency!==spec.currency)return base;
 if(typeof p!=="number"||!Number.isFinite(p)||p<=0||typeof t!=="number"||!Number.isSafeInteger(t)||t<=0||t*1000>+now)return base;
 return recheckSecondary({...base,price:p,asOf:new Date(t*1000).toISOString()},now);
}
