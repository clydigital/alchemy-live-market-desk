/** A strictly bounded, read-only Alpha Vantage daily history smoke check.
 * Uses one compact free-tier request on manual demand only. No API key leaves this server in a response.
 */
export type AlphaDailyRead = {
  state:"ready"|"unconfigured"|"unavailable"|"limited";
  asOf:string|null;
  sampleCount:number;
  retrievedAt:string|null;
  note:"OK"|"KEY_MISSING"|"RATE_LIMIT_OR_ENTITLEMENT"|"INVALID_RESPONSE"|"HTTP_ERROR"|"REQUEST_FAILED";
};
type Fetcher=typeof fetch;
export function classifyAlphaDailyPayload(raw:unknown,retrievedAt:string):AlphaDailyRead {
  const base:AlphaDailyRead={state:"unavailable",asOf:null,sampleCount:0,retrievedAt,note:"INVALID_RESPONSE"};
  if(!raw||typeof raw!=="object"||Array.isArray(raw))return base;
  const payload=raw as Record<string,unknown>;
  if(typeof payload.Note==="string"||typeof payload.Information==="string")
    return {...base,state:"limited",note:"RATE_LIMIT_OR_ENTITLEMENT"};
  const points=payload["Time Series (Daily)"];
  if(!points||typeof points!=="object"||Array.isArray(points))return base;
  const accepted=Object.entries(points as Record<string,unknown>).flatMap(([day,values])=>{
    if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(Date.parse(day+"T00:00:00Z")))return [];
    if(!values||typeof values!=="object"||Array.isArray(values))return [];
    const close=Number((values as Record<string,unknown>)["4. close"]);
    if(!Number.isFinite(close)||close<=0)return [];
    return [day];
  }).sort();
  if(!accepted.length)return base;
  return {state:"ready",asOf:accepted.at(-1)!,sampleCount:accepted.length,retrievedAt,note:"OK"};
}
export async function readAlphaVantageDailyPilot(options:{apiKey?:string;fetchImpl?:Fetcher}={}):Promise<AlphaDailyRead>{
 const key=(options.apiKey??process.env.ALPHA_VANTAGE_API_KEY??"").trim();
 if(!key)return {state:"unconfigured",asOf:null,sampleCount:0,retrievedAt:null,note:"KEY_MISSING"};
 const url=new URL("https://www.alphavantage.co/query");
 url.searchParams.set("function","TIME_SERIES_DAILY");
 url.searchParams.set("symbol","SPY");
 url.searchParams.set("outputsize","compact");
 url.searchParams.set("apikey",key);
 const retrievedAt=new Date().toISOString();
 try{
  const response=await(options.fetchImpl??fetch)(url.toString(),{
   headers:{accept:"application/json"},cache:"no-store",signal:AbortSignal.timeout(9000),
  });
  if(!response.ok)return {state:"unavailable",asOf:null,sampleCount:0,retrievedAt,note:"HTTP_ERROR"};
  return classifyAlphaDailyPayload(await response.json(),retrievedAt);
 }catch{return {state:"unavailable",asOf:null,sampleCount:0,retrievedAt,note:"REQUEST_FAILED"};}
}
