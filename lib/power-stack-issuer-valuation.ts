/** Source-reviewed, owner-only issuer valuation comparisons.
 *
 * Reviewed model ranges are analyst hypotheses, not market prices, target
 * prices, independent intrinsic values, investment ratings, or a PEG screen.
 * The SQL table is read-only to the authenticated owner; no automatic writer.
 */
export type PrivateIssuerValuationReview=Readonly<{
 ticker:string;reviewed_at:string;review_status:"SOURCE_REVIEWED";
 price_observed_on:string;market_price:number|string;price_currency:string;
 price_source_url:string;source_timestamp_basis:"market_session"|"upstream_batch";
 valuation_low:number|string;valuation_high:number|string;valuation_currency:string;
 valuation_method:"DCF"|"FCF_MULTIPLE"|"EARNINGS_MULTIPLE"|"SUM_OF_PARTS"|"COMPS";
 valuation_source_url:string;method_explanation:string;downside_case:string;invalidation_test:string;
 financial_period_end:string;fundamental_source_url:string;
 revenue:number|string|null;net_income:number|string|null;
 operating_cash_flow:number|string;capital_expenditure:number|string;
 share_based_compensation:number|string|null;net_debt:number|string|null;
 reviewer_note:string;
}>;
export type IssuerReviewVerdict="BELOW_REVIEWED_RANGE"|"ABOVE_REVIEWED_RANGE"|"WITHIN_REVIEWED_RANGE";
export type IssuerReviewResult=Readonly<{
 ticker:string;verdict:IssuerReviewVerdict;reviewedAt:string;priceObservedOn:string;
 financialPeriodEnd:string;marketPrice:number;currency:string;
 valuationLow:number;valuationHigh:number;distanceToLowPct:number;distanceToHighPct:number;
 cashFlowFromOperations:number;capitalExpenditure:number;freeCashFlow:number;
 netIncome:number|null;revenue:number|null;shareBasedCompensation:number|null;netDebt:number|null;
 riskFlags:string[];valuationMethod:PrivateIssuerValuationReview["valuation_method"];
 methodExplanation:string;downsideCase:string;invalidationTest:string;reviewerNote:string;
 priceSourceUrl:string;fundamentalSourceUrl:string;valuationSourceUrl:string;
}>;
const oneDay=86400000;
const day=(v:string):number|null=>{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(v))return null;
 const ms=Date.parse(v+"T00:00:00Z");
 return Number.isFinite(ms)&&new Date(ms).toISOString().slice(0,10)===v?ms:null;
};
const n=(v:unknown):number|null=>{
 if(typeof v==="number")return Number.isFinite(v)?v:null;
 if(typeof v!=="string"||!v.trim())return null;
 const asNum=Number(v);return Number.isFinite(asNum)?asNum:null;
};
const https=(str:string):boolean=>{
 if(!str||str.length>2048)return false;
 try{const u=new URL(str);return u.protocol==="https:"&&!u.username&&!u.password&&!u.port&&u.hostname.includes(".");}
 catch{return false;}
};
const clean=(v:string,min=1,max=2500)=>typeof v==="string"&&v.trim().length>=min&&v.trim().length<=max;
const finiteOptional=(v:unknown):boolean=>v===null||n(v)!==null;
const round=(x:number)=>Number(x.toFixed(2));
/** Projection is deliberately strict: no comparison is accepted on an
 * unproven quote date, mismatched currency, stale financials or unsupported
 * fair-value source. 10% buffers are UI materiality bands, NOT model precision.
 */
export function evaluateIssuerValuation(
 input:PrivateIssuerValuationReview,now=new Date(),
):IssuerReviewResult|null{
 if(!input||input.review_status!=="SOURCE_REVIEWED"||
   !/^[A-Z0-9][A-Z0-9.\-]{0,17}$/.test(input.ticker)||input.source_timestamp_basis!=="market_session"||
   !["DCF","FCF_MULTIPLE","EARNINGS_MULTIPLE","SUM_OF_PARTS","COMPS"].includes(input.valuation_method))return null;
 const current=now.getTime(),reviewed=Date.parse(input.reviewed_at),quoted=day(input.price_observed_on),end=day(input.financial_period_end);
 const today=day(now.toISOString().slice(0,10));
 if(!Number.isFinite(current)||!Number.isFinite(reviewed)||today===null||quoted===null||end===null||
   reviewed>current+300000||reviewed<current-45*oneDay||
   quoted>today||quoted<today-6*oneDay||
   end>today||end<today-210*oneDay||reviewed<quoted)return null;
 const price=n(input.market_price),low=n(input.valuation_low),high=n(input.valuation_high),
 ocf=n(input.operating_cash_flow),capex=n(input.capital_expenditure);
 if(price===null||low===null||high===null||ocf===null||capex===null||
  price<=0||low<=0||low>high||capex<0||
  !finiteOptional(input.net_income)||!finiteOptional(input.revenue)||
  !finiteOptional(input.share_based_compensation)||!finiteOptional(input.net_debt)||
  (n(input.share_based_compensation)??0)<0||
  !/^[A-Z]{3}$/.test(input.price_currency)||input.price_currency!==input.valuation_currency)return null;
 if(!https(input.price_source_url)||!https(input.fundamental_source_url)||
   !https(input.valuation_source_url)||
   new Set([input.price_source_url,input.fundamental_source_url,input.valuation_source_url]).size!==3)return null;
 if(!clean(input.method_explanation,80)||!clean(input.downside_case,35)||
  !clean(input.invalidation_test,30)||!clean(input.reviewer_note,20))return null;
 const freeCashFlow=ocf-capex;
 const riskFlags:string[]=[];
 if(freeCashFlow<0)riskFlags.push("Negative reported free cash flow");
 if(freeCashFlow===0)riskFlags.push("No reported free cash flow cushion");
 if(n(input.net_income)!==null&&n(input.net_income)!<=0)riskFlags.push("Non-positive reported net income");
 if(n(input.share_based_compensation)!==null&&ocf>0&&n(input.share_based_compensation)!/ocf>0.25)
   riskFlags.push("Share-based compensation exceeds 25% of reported operating cash flow");
 const verdict:IssuerReviewVerdict=price<low*.9?"BELOW_REVIEWED_RANGE":
  price>high*1.1?"ABOVE_REVIEWED_RANGE":"WITHIN_REVIEWED_RANGE";
 return {ticker:input.ticker,verdict,reviewedAt:input.reviewed_at,priceObservedOn:input.price_observed_on,
  financialPeriodEnd:input.financial_period_end,marketPrice:price,currency:input.price_currency,
  valuationLow:low,valuationHigh:high,distanceToLowPct:round((low/price-1)*100),
  distanceToHighPct:round((high/price-1)*100),
  cashFlowFromOperations:ocf,capitalExpenditure:capex,freeCashFlow:round(freeCashFlow),
  revenue:n(input.revenue),netIncome:n(input.net_income),
  shareBasedCompensation:n(input.share_based_compensation),netDebt:n(input.net_debt),
  riskFlags,valuationMethod:input.valuation_method,methodExplanation:input.method_explanation,
  downsideCase:input.downside_case,invalidationTest:input.invalidation_test,reviewerNote:input.reviewer_note,
  priceSourceUrl:input.price_source_url,fundamentalSourceUrl:input.fundamental_source_url,
  valuationSourceUrl:input.valuation_source_url};
}
/** Duplicates / future dates are never used as an improved valuation; only
 * the latest *accepted* review for a given owner-tracked issuer is displayed.
 */
export function projectIssuerValuationReviews(
 raw:readonly unknown[],trackedTickers:readonly string[],now=new Date(),limit=100,
):IssuerReviewResult[]{
 const allowed=new Set(trackedTickers.map(t=>t.toUpperCase()));
 const output:IssuerReviewResult[]=[],seen=new Set<string>();
 const sorted=[...raw].filter((x):x is PrivateIssuerValuationReview=>
  !!x&&typeof x==="object"&&!Array.isArray(x)&&typeof (x as {reviewed_at?:unknown}).reviewed_at==="string")
  .sort((a,b)=>b.reviewed_at.localeCompare(a.reviewed_at));
 for(const record of sorted){
  if(!allowed.has(record.ticker)||seen.has(record.ticker))continue;
  const evaled=evaluateIssuerValuation(record,now);
  if(!evaled)continue;
  seen.add(record.ticker);output.push(evaled);
  if(output.length>=limit)break;
 }
 return output;
}
