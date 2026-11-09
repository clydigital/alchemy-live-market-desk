/** iSaham FREE plan: single-symbol quotes, 1 credit each; usage is zero credits.
 * Intentionally no fundamental endpoint (Basic+ paid), no bulk, no browser calls.
 * "last_updated_timestamp" is an upstream compute batch start, NOT a trade clock.
 */
export const ISAHAM_DOCS_URL="https://api.isaham.my/docs";
const BASE="https://api.isaham.my";
type RecordObject=Record<string,unknown>;
type RequestFn=typeof fetch;
const asObject=(v:unknown):RecordObject|null=>v&&typeof v==="object"&&!Array.isArray(v)?v as RecordObject:null;
const finitePrice=(v:unknown)=>typeof v==="number"&&Number.isFinite(v)&&v>0&&v<1000000?v:null;
const validBatch=(v:unknown):v is string=>
 typeof v==="string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?\+08:00$/.test(v)
 && Number.isFinite(Date.parse(v));

export type ISahamQuote={symbol:string;price:number;observedOn:string;batchStartedAt:string;
  currency:"MYR";sourceName:"iSaham Data API";sourceUrl:typeof ISAHAM_DOCS_URL;timestampBasis:"upstream_batch"};
export type ISahamUsage={status:"ready"|"unconfigured"|"unavailable"|"quota_exhausted";remaining:number|null;tier:string|null;failureCode:string|null};
const tokenFrom=(env:Record<string,string|undefined>)=>(env.iSaham_API_KEY??env.ISAHAM_API_KEY??"").trim();
export function parseISahamQuote(payload:unknown,requestedSymbol:string):ISahamQuote|null{
  const root=asObject(payload),data=asObject(root?.data);
  const symbol=typeof data?.symbol==="string"?data.symbol.toUpperCase().trim():"";
  const price=finitePrice(data?.last_price);
  const batch=data?.last_updated_timestamp;
  if(root?.status!=="success"||symbol!==requestedSymbol||price===null||!validBatch(batch))return null;
  // Never use metadata.timestamp as a substitute for a missing source record time.
  const future=Date.parse(batch)>Date.now()+2*86400000;
  if(future)return null;
  return {symbol,price,observedOn:batch.slice(0,10),batchStartedAt:batch,
    currency:"MYR",sourceName:"iSaham Data API",sourceUrl:ISAHAM_DOCS_URL,timestampBasis:"upstream_batch"};
}
async function fetchJson(path:string,token:string,fetchImpl:RequestFn):Promise<{status:number;payload:unknown}|null>{
 try{
   const r=await fetchImpl(BASE+path,{method:"GET",
     headers:{Authorization:`Bearer ${token}`,Accept:"application/json"},
     cache:"no-store",signal:AbortSignal.timeout(12000)});
   if(!r.ok)return {status:r.status,payload:null};
   return {status:r.status,payload:await r.json()};
 }catch{return null;}
}
export async function readISahamUsage(opts:{env?:Record<string,string|undefined>;fetchImpl?:RequestFn}={}):Promise<ISahamUsage>{
 const token=tokenFrom(opts.env??process.env);
 if(!token)return {status:"unconfigured",remaining:null,tier:null,failureCode:"NO_RUNTIME_TOKEN"};
 const result=await fetchJson("/v1/account/usage",token,opts.fetchImpl??fetch);
 const data=asObject(asObject(result?.payload)?.data);
 const remaining=data?.credits_remaining;
 const rem=typeof remaining==="number"&&Number.isFinite(remaining)?remaining:null;
 const tier=typeof data?.tier==="string"?data.tier:null;
 if(!result) return {status:"unavailable",remaining:null,tier,failureCode:"NETWORK_OR_TIMEOUT"};
 if(result.status!==200) return {status:"unavailable",remaining:null,tier,
   failureCode:result.status===401?"AUTH_401":result.status===403?"ACCESS_403":
     result.status===429?"RATE_LIMIT_429":result.status===404?"ENDPOINT_404":"HTTP_"+result.status};
 if(asObject(result.payload)?.status!=="success"||rem===null)
   return {status:"unavailable",remaining:null,tier,failureCode:"UNEXPECTED_USAGE_RESPONSE"};
 return {status:rem<=0?"quota_exhausted":"ready",remaining:rem,tier,failureCode:null};
}
export async function readISahamQuote(symbol:string,opts:{env?:Record<string,string|undefined>;fetchImpl?:RequestFn}={}):Promise<ISahamQuote|null>{
 if(!/^[A-Z0-9][A-Z0-9\-]{1,17}$/.test(symbol))return null;
 const token=tokenFrom(opts.env??process.env);
 if(!token)return null;
 const result=await fetchJson("/v1/stocks/quote?symbol="+encodeURIComponent(symbol),token,opts.fetchImpl??fetch);
 if(result?.status!==200)return null;
 return parseISahamQuote(result.payload,symbol);
}
