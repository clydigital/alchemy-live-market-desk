/** Public issuer guidance, reviewed manually; displayed only in owner research.
 * These are issuer announcements, not consensus or vendor estimate history.
 * Date-only announcements eligible only from following UTC calendar day.
 */
export type GuidanceReceipt={ticker:string;fiscalEnd:string;releaseDay:string;basis:"GAAP_DILUTED_EPS"|"NON_GAAP_DILUTED_EPS"|"ADJUSTED_OPERATING_INCOME_PER_SHARE";kind:"POINT"|"FLOOR";currency:"USD";value:number;sourceUrl:string};
const ci2="https://newsroom.thecignagroup.com/2026-07-30-The-Cigna-Group-Reports-Strong-Second-Quarter-2026-Results,-Raises-2026-Outlook";
const ci3="https://www.sec.gov/Archives/edgar/data/1739940/000114036126042030/ef20084818_ex99-1.htm";
const dell2="https://investors.delltechnologies.com/news-events/press-releases/detail/1653/dell-technologies-delivers-second-quarter-fiscal-2027-financial-results";
const dell3="https://investors.delltechnologies.com/sec-filings/all-sec-filings/content/0001571996-26-000050/exhibit991earnings8kq3fy27.htm";
export const REVIEWED_GUIDANCE:readonly GuidanceReceipt[]=[
 {ticker:"CI",fiscalEnd:"2026-12-31",releaseDay:"2026-07-30",basis:"ADJUSTED_OPERATING_INCOME_PER_SHARE",kind:"FLOOR",currency:"USD",value:30.45,sourceUrl:ci2},
 {ticker:"CI",fiscalEnd:"2026-12-31",releaseDay:"2026-11-05",basis:"ADJUSTED_OPERATING_INCOME_PER_SHARE",kind:"FLOOR",currency:"USD",value:30.60,sourceUrl:ci3},
 {ticker:"DELL",fiscalEnd:"2027-01-29",releaseDay:"2026-09-01",basis:"GAAP_DILUTED_EPS",kind:"POINT",currency:"USD",value:24.37,sourceUrl:dell2},
 {ticker:"DELL",fiscalEnd:"2027-01-29",releaseDay:"2026-11-24",basis:"GAAP_DILUTED_EPS",kind:"POINT",currency:"USD",value:28.24,sourceUrl:dell3},
 {ticker:"DELL",fiscalEnd:"2027-01-29",releaseDay:"2026-09-01",basis:"NON_GAAP_DILUTED_EPS",kind:"POINT",currency:"USD",value:25.50,sourceUrl:dell2},
 {ticker:"DELL",fiscalEnd:"2027-01-29",releaseDay:"2026-11-24",basis:"NON_GAAP_DILUTED_EPS",kind:"POINT",currency:"USD",value:29.68,sourceUrl:dell3},
];
const day=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+"T00:00:00Z"))&&new Date(s+"T00:00:00Z").toISOString().slice(0,10)===s?Date.parse(s+"T00:00:00Z"):NaN;
const source=(s:string)=>{try{const u=new URL(s);return u.protocol==="https:"&&!u.username&&!u.password&&!u.port&&["www.sec.gov","newsroom.thecignagroup.com","investors.delltechnologies.com"].includes(u.hostname)}catch{return false}};
const key=(r:GuidanceReceipt)=>[r.ticker,r.fiscalEnd,r.currency,r.basis,r.kind].join("|");
export type GuidanceComparison={latest:GuidanceReceipt;prior:GuidanceReceipt|null;changePct:number|null};
export function compareGuidance(receipts:readonly GuidanceReceipt[],now=new Date()):GuidanceComparison[]{
 const cutoff=day(now.toISOString().slice(0,10));
 const valid=receipts.filter(r=>day(r.releaseDay)<cutoff&&day(r.releaseDay)<day(r.fiscalEnd)&&Number.isFinite(r.value)&&r.value>0&&source(r.sourceUrl)&&/^[A-Z0-9.\-]{1,18}$/.test(r.ticker));
 const groups=new Map<string,GuidanceReceipt[]>();
 for(const r of valid){const k=key(r);groups.set(k,[...(groups.get(k)??[]),r]);}
 const result:GuidanceComparison[]=[];
 for(const group of groups.values()){
  const dates=[...new Set(group.map(r=>r.releaseDay))].sort().reverse();
  // Conflicting same-day values are not a revision. Reject the affected group.
  if(dates.some(d=>new Set(group.filter(r=>r.releaseDay===d).map(r=>r.value)).size>1))continue;
  const latest=group.find(r=>r.releaseDay===dates[0])!,prior=group.find(r=>r.releaseDay===dates[1])??null;
  result.push({latest,prior,changePct:prior?100*(latest.value/prior.value-1):null});
 }
 return result.sort((a,b)=>key(a.latest).localeCompare(key(b.latest)));
}
