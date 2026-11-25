import {BLUEBELLY_STOCK_UNIVERSE} from "./bluebelly-equity-universe.ts";
import type {PublicEquityCoverageRow} from "./bluebelly-equity-coverage.ts";

export type IssuerResultRow={id:string;ticker:string;fiscal_period:string;filing_day:string|null;verification_status:string};
export type IssuerMetricRow={result_id:string;metric_key:string;value_numeric:number|string;unit:string;accounting_basis:string;period_basis:string;source_url:string;verification_status:string};
const definitions={
 revenue:{label:"Revenue",unit:"USD"},diluted_eps:{label:"Diluted EPS",unit:"USD/shares"},
 operating_income:{label:"Operating income",unit:"USD"},net_income:{label:"Net income",unit:"USD"},
 operating_cash_flow:{label:"Operating cash flow",unit:"USD"},capital_expenditure:{label:"Cash capex",unit:"USD"},
 free_cash_flow:{label:"Free cash flow",unit:"USD"},gross_margin_pct:{label:"Gross margin",unit:"percent"},
 adjusted_home_sales_gross_margin_pct:{label:"Adjusted home-sale gross margin",unit:"percent"},
 home_sales_gross_margin_pct:{label:"Home-sale gross margin",unit:"percent"},
 debt_to_capital_pct:{label:"Debt / capital",unit:"percent"},net_debt_to_capital_pct:{label:"Net debt / capital",unit:"percent"},
 same_property_noi_growth_pct:{label:"Same-property NOI growth YoY",unit:"percent"},
 occupancy_pct:{label:"Occupancy",unit:"percent"},blended_rent_growth_pct:{label:"Blended lease growth",unit:"percent"},
 renewal_rent_growth_pct:{label:"Renewal lease growth",unit:"percent"},new_lease_growth_pct:{label:"New lease growth",unit:"percent"},
 core_ffo_per_share:{label:"Core FFO per share",unit:"USD/shares"},affo_per_share:{label:"AFFO per share",unit:"USD/shares"},
 core_affo_per_share:{label:"Core AFFO per share",unit:"USD/shares"},
 core_ffo_guidance_mid:{label:"FY core FFO midpoint",unit:"USD/shares"},
 affo_guidance_mid:{label:"FY AFFO midpoint",unit:"USD/shares"},
 core_affo_guidance_mid:{label:"FY core AFFO midpoint",unit:"USD/shares"},
 net_debt_ebitda:{label:"Net debt / EBITDA",unit:"multiple"},liquidity:{label:"Liquidity",unit:"USD"},
} as const;
export type MetricKey=keyof typeof definitions;
export type FundamentalFact={key:MetricKey;label:string;value:number;unit:string;basis:string;period:string;sourceUrl:string;filingDay:string};
export type FundamentalRow={ticker:string;company:string;theme:string;priority:string;currency:string;price:number|null;priceDay:string|null;priceSource:string|null;period:string|null;filingDay:string|null;status:"CURRENT"|"STALE"|"UNAVAILABLE";facts:FundamentalFact[];valuation:{label:string;multiple:number;yieldPct:number;sourceUrl:string;basis:string}|null};
const allowedBases=new Set(["SEC_US_GAAP","SEC_US_GAAP_DERIVED","ISSUER_RELEASE_GAAP","ISSUER_RELEASE_NON_GAAP","ISSUER_RELEASE_OPERATING","ISSUER_GUIDANCE_NON_GAAP"]);
const guidanceKeys=new Set(["core_ffo_guidance_mid","affo_guidance_mid","core_affo_guidance_mid"]);
function day(s:string|null){if(!s||!/^\d{4}-\d{2}-\d{2}$/.test(s))return null;const ms=Date.parse(s+"T00:00:00Z");return Number.isFinite(ms)&&new Date(ms).toISOString().slice(0,10)===s?ms:null;}
function source(s:string){try{const u=new URL(s);return u.protocol==="https:"&&u.hostname==="www.sec.gov"&&!u.username&&!u.password&&!u.port&&/^\/Archives\/edgar\/data\/\d+\/\d+\//.test(u.pathname);}catch{return false;}}
function number(v:unknown){if(typeof v!=="number"&&(typeof v!=="string"||!v.trim()))return null;const n=Number(v);return Number.isFinite(n)?n:null;}
/** Public aggregate read only. No private estimates, portfolio membership or valuation models. */
export function projectFundamentalComparison(results:readonly IssuerResultRow[],metrics:readonly IssuerMetricRow[],quotes:readonly PublicEquityCoverageRow[],now=new Date()):FundamentalRow[]{
 const today=now.toISOString().slice(0,10),todayMs=day(today)!;
 const quoteByTicker=new Map(quotes.map(q=>[q.ticker,q]));
 return BLUEBELLY_STOCK_UNIVERSE.map(spec=>{
  const candidates=results.filter(r=>r.ticker===spec.ticker&&["partial","verified"].includes(r.verification_status)&&day(r.filing_day)!==null&&r.filing_day!<=today).sort((a,b)=>b.filing_day!.localeCompare(a.filing_day!));
  const selected=candidates[0];const q=quoteByTicker.get(spec.ticker);
  const quoteDay=day(q?.asOf??null),quoteValid=q?.status==="SOURCE_DATED"&&q.currency===spec.currency&&typeof q.price==="number"&&q.price>0&&quoteDay!==null&&quoteDay<=todayMs&&todayMs-quoteDay<=6*86400000;
  const status:FundamentalRow["status"]=!selected?"UNAVAILABLE":todayMs-day(selected.filing_day!)!>150*86400000?"STALE":"CURRENT";
  const facts:FundamentalFact[]=[];
  if(selected){
   for(const key of Object.keys(definitions) as MetricKey[]){
    const def=definitions[key],guidance=guidanceKeys.has(key);
    const matches=metrics.filter(m=>m.result_id===selected.id&&m.metric_key===key&&m.verification_status==="verified"&&allowedBases.has(m.accounting_basis)&&m.unit===def.unit&&source(m.source_url)&&m.period_basis===(guidance?"fiscal_year_guidance":"fiscal_quarter")&&(guidance?m.accounting_basis==="ISSUER_GUIDANCE_NON_GAAP":m.accounting_basis!=="ISSUER_GUIDANCE_NON_GAAP"));
    if(!matches.length)continue;
    const values=new Set(matches.map(m=>number(m.value_numeric)));
    if(values.size!==1||values.has(null))continue;
    const m=matches[0],v=number(m.value_numeric)!;
    facts.push({key,label:def.label,value:v,unit:def.unit,basis:m.accounting_basis,period:guidance?"FY "+(selected.fiscal_period.match(/20\d{2}/)?.[0]??"unspecified")+" guidance":selected.fiscal_period,sourceUrl:m.source_url,filingDay:selected.filing_day!});
   }
  }
  const guide=facts.find(f=>f.key==="core_affo_guidance_mid")??facts.find(f=>f.key==="affo_guidance_mid")??facts.find(f=>f.key==="core_ffo_guidance_mid");
  const fiscalYear=selected?.fiscal_period.match(/20\d{2}/)?.[0];
  const valuation=status==="CURRENT"&&quoteValid&&guide&&guide.value>0&&fiscalYear===today.slice(0,4)&&q!.asOf!>=guide.filingDay?{label:guide.key==="core_ffo_guidance_mid"?"P/Core FFO":guide.key==="core_affo_guidance_mid"?"P/Core AFFO":"P/AFFO",multiple:q!.price!/guide.value,yieldPct:100*guide.value/q!.price!,sourceUrl:guide.sourceUrl,basis:guide.period}:null;
  return {ticker:spec.ticker,company:spec.company,theme:spec.theme,priority:spec.priority,currency:spec.currency,price:quoteValid?q!.price:null,priceDay:quoteValid?q!.asOf:null,priceSource:quoteValid?q!.sourceUrl:null,period:selected?.fiscal_period??null,filingDay:selected?.filing_day??null,status:facts.length?status:"UNAVAILABLE",facts,valuation};
 });
}
