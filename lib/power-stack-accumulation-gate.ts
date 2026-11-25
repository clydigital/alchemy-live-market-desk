/** Manual, private research calculation. Never an order or an automatic ranking.
 * Scenario assumptions are authored estimates, not reported financial facts.
 * Point-in-time use requires model/financial evidence available before the quote.
 */
export type Scenario={value:number;basis:string};
export type Evidence={state:"REVIEWED"|"ADVERSE"|"UNKNOWN";availableAt:string|null;sourceUrl:string|null;note:string};
export type AccumulationInput={ticker:string;currency:string;price:number;quoteCurrency:string;quoteAt:string;priceSourceUrl:string;modelAvailableAt:string;modelCurrency:string;modelSourceUrl:string;modelKind:"NORMALISED_EPS"|"AFFO"|"PROPERTY_NAV"|"FCF"|"OTHER";base:Scenario;bear:Scenario|null;bull:Scenario|null;cashGeneration:Evidence;balanceSheet:Evidence;earningsDirection:Evidence;invalidation:string;horizonMonths:number;};
const validUrl=(s:string|null)=>{try{const u=new URL(s??"");return u.protocol==="https:"&&!u.username&&!u.password&&!u.port&&u.hostname.includes(".")}catch{return false}};
const positive=(n:number)=>Number.isFinite(n)&&n>0;
const time=(s:string|null)=>s&&/T.*(?:Z|[+-]\d\d:\d\d)$/.test(s)?Date.parse(s):NaN;
const r=(n:number)=>Number(n.toFixed(2));
export function entryCeilings(base:number,targetUpside=.2,marginOfSafety=.2){
 if(!positive(base)||!positive(targetUpside)||!Number.isFinite(marginOfSafety)||marginOfSafety<0||marginOfSafety>=1)throw Error("Invalid valuation parameters");
 return {upsideCeiling:base/(1+targetUpside),discountCeiling:base*(1-marginOfSafety)};
}
export function evaluateAccumulation(input:AccumulationInput,asOf=new Date(),mode:"MANUAL"|"HISTORICAL"="MANUAL"){
 const now=asOf.getTime(),q=time(input.quoteAt),m=time(input.modelAvailableAt);
 const missing:string[]=[],adverse:string[]=[];
 const scenario=(s:Scenario|null)=>!!s&&positive(s.value)&&s.basis.trim().length>=10;
 if(!Number.isFinite(now)||!positive(input.price)||!scenario(input.base)||!Number.isFinite(q)||q>now||!Number.isFinite(m)||m>now||
  input.currency!==input.quoteCurrency||input.currency!==input.modelCurrency||!validUrl(input.priceSourceUrl)||!validUrl(input.modelSourceUrl)||
  input.priceSourceUrl===input.modelSourceUrl||!positive(input.horizonMonths))return {state:"INVALID" as const,metrics:null,missing:["Invalid price, currency, dates, model or provenance"],adverse:[]};
 if(mode==="MANUAL"&&now-q>6*86400000)missing.push("Quote older than six calendar days");
 if(mode==="HISTORICAL"&&m>q)missing.push("Model not available by historical quote");
 if(!scenario(input.bear)||input.bear!.value>input.base.value)missing.push("Explicit credible bear case required");
 if(input.bull!==null&&(!scenario(input.bull)||input.bull.value<input.base.value))missing.push("Bull scenario inconsistent");
 if(input.invalidation.trim().length<20)missing.push("Invalidation condition missing");
 for(const [label,e] of Object.entries({cashGeneration:input.cashGeneration,balanceSheet:input.balanceSheet,earningsDirection:input.earningsDirection})){
  const t=time(e.availableAt);
  if(e.state==="UNKNOWN"||!validUrl(e.sourceUrl)||!Number.isFinite(t)||t>now||(mode==="HISTORICAL"&&t>q)||e.note.trim().length<12)missing.push(label+" not qualified");
  else if(e.state==="ADVERSE")adverse.push(label+": "+e.note);
 }
 const {upsideCeiling,discountCeiling}=entryCeilings(input.base.value);
 const upside=100*(input.base.value/input.price-1),discount=100*(1-input.price/input.base.value);
 const bearValid=scenario(input.bear)&&input.bear!.value<=input.base.value;
 const bearReturn=bearValid?100*(input.bear!.value/input.price-1):null;
 const rewardRisk=bearReturn!==null&&bearReturn<0&&upside>0?upside/-bearReturn:null;
 const metrics={baseUpsidePct:r(upside),discountToBasePct:r(discount),upsideCeiling:r(upsideCeiling),discountCeiling:r(discountCeiling),bearReturnPct:bearReturn===null?null:r(bearReturn),rewardRisk:rewardRisk===null?null:r(rewardRisk)};
 const state=missing.length?"INCOMPLETE":adverse.length?"RISK_REVIEW":input.price<=upsideCeiling?"VALUATION_REVIEW_CANDIDATE":"ABOVE_UPSIDE_CEILING";
 return {state,metrics,missing,adverse};
}
