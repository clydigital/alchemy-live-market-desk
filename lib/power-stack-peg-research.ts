/** Private Power Stack 1-year forward PEG research.
 * The FMP forecast `date` is a fiscal-period end, not an analyst revision date.
 * A provider retrieval timestamp is NEVER substituted for that missing revision vintage.
 * One-year PEG = (dated price / EPS for first forecast FY) /
 *                ((EPS for following FY / first forecast FY EPS - 1) * 100).
 * Not a public Markets signal, not an investment recommendation.
 */
export type PegResearchObservation = {
  ticker: string;
  retrieved_at: string;
  estimate_native_updated_at: string | null;
  forecast_first_fy_end: string;
  forecast_second_fy_end: string;
  eps_first_fy: number | string;
  eps_second_fy: number | string;
  first_fy_analysts: number | null;
  second_fy_analysts: number | null;
  quote_price: number | string;
  quote_observed_on: string;
  quote_currency: string;
  estimate_currency: string;
  forecast_source: string;
  forecast_source_url: string;
  quote_source: string;
};
export type PegResearchEvaluation = {
  forwardPE: number | null;
  growthPct: number | null;
  forwardPEG: number | null;
  quality: "indicative" | "stale" | "unavailable";
  reason: "OK_RETRIEVAL_ONLY" | "STALE_RETRIEVAL" | "STALE_PRICE" |
          "INVALID_INPUT" | "INVALID_FISCAL_PERIOD" | "CURRENCY_MISMATCH" |
          "NON_POSITIVE_GROWTH" | "SOURCE_MISSING";
  hasNativeEstimateRevision: boolean;
  quoteObservedOn: string;
  forecastRetrievedOn: string;
  forecastPeriod: string;
};
const dayMS=86400000;
const finite=(v:unknown):number|null=>{
  if(typeof v==="number")return Number.isFinite(v)?v:null;
  if(typeof v!=="string"||!v.trim())return null;
  const n=Number(v);
  return Number.isFinite(n)?n:null;
};
function day(value:string):number|null {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
  const t=Date.parse(value+"T00:00:00Z");
  return Number.isFinite(t)&&new Date(t).toISOString().slice(0,10)===value?t:null;
}
function fetchedOn(value:string):number|null {
  const t=Date.parse(value);
  return Number.isFinite(t)?t:null;
}
const round=(v:number,places=2)=>Number(v.toFixed(places));
export function evaluatePegResearch(input:PegResearchObservation, now=new Date()):PegResearchEvaluation {
  const empty:PegResearchEvaluation={
    forwardPE:null,growthPct:null,forwardPEG:null,quality:"unavailable",
    reason:"INVALID_INPUT",hasNativeEstimateRevision:input.estimate_native_updated_at!==null,
    quoteObservedOn:input.quote_observed_on,
    forecastRetrievedOn:input.retrieved_at,
    forecastPeriod:input.forecast_first_fy_end+" → "+input.forecast_second_fy_end,
  };
  const first=day(input.forecast_first_fy_end);
  const second=day(input.forecast_second_fy_end);
  const quoteDay=day(input.quote_observed_on);
  const retrieved=fetchedOn(input.retrieved_at);
  const quote=finite(input.quote_price);
  const eps1=finite(input.eps_first_fy);
  const eps2=finite(input.eps_second_fy);
  const today=now.getTime();
  if(!Number.isFinite(today)||first===null||second===null||quoteDay===null||retrieved===null ||
    quote===null||eps1===null||eps2===null||quote<=0||eps1<=0||eps2<=0 ||
    retrieved>today+5*60000||quoteDay>today+dayMS)return empty;
  if(second-first<300*dayMS||second-first>430*dayMS||
     first<=quoteDay||first-quoteDay>550*dayMS)
    return {...empty,reason:"INVALID_FISCAL_PERIOD"};
  if(input.quote_currency.toUpperCase()!==input.estimate_currency.toUpperCase())
    return {...empty,reason:"CURRENCY_MISMATCH"};
  if(!/^https:\/\/[^\s]+$/.test(input.forecast_source_url)||!input.forecast_source.trim()||!input.quote_source.trim())
    return {...empty,reason:"SOURCE_MISSING"};
  const pe=quote/eps1, growth=(eps2/eps1-1)*100;
  const basic={...empty,forwardPE:round(pe),growthPct:round(growth)};
  if(growth<=0)return {...basic,reason:"NON_POSITIVE_GROWTH"};
  const peg=round(pe/growth);
  const ageOfQuote=Math.floor((today-quoteDay)/dayMS);
  const ageOfFetch=(today-retrieved)/dayMS;
  if(ageOfQuote>7)return {...basic,forwardPEG:peg,reason:"STALE_PRICE",quality:"stale"};
  if(ageOfFetch>45)return {...basic,forwardPEG:peg,reason:"STALE_RETRIEVAL",quality:"stale"};
  // Even if the record includes a native revision date, we do not auto-promote
  // the metric to a technical alignment signal or a buy recommendation.
  return {...basic,forwardPEG:peg,reason:"OK_RETRIEVAL_ONLY",quality:"indicative"};
}
