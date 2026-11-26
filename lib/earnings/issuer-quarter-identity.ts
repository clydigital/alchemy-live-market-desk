import {parseFiscalQuarter} from "./sec-quarter-facts.ts";

/** Preserve historical keys while matching equivalent fiscal periods. Prefer
 * the most advanced existing state, not whichever alias the DB returns first. */
export function canonicalIssuerQuarter(value:string):string|null{
 const q=parseFiscalQuarter(value);
 return q?"Q"+q.quarter+" FY"+q.year:null;
}
const rank:Readonly<Record<string,number>>={
 published:90,verified:80,partial:70,review_required:60,source_detected:50,retry:40,due:30,scheduled:20,
};
export function selectExistingIssuerQuarter<T extends {fiscal_period:string;state:string}>(rows:readonly T[],period:string):T|null{
 const key=canonicalIssuerQuarter(period);
 if(!key)return null;
 return rows.filter(row=>canonicalIssuerQuarter(row.fiscal_period)===key)
  .sort((a,b)=>(rank[b.state]??0)-(rank[a.state]??0)||
   Number(b.fiscal_period===key)-Number(a.fiscal_period===key)||
   a.fiscal_period.localeCompare(b.fiscal_period))[0]??null;
}
