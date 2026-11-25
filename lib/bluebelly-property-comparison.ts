/** Reviewed sector-specific receipts for the existing Industry Intel matrix.
 * No owner valuation, quote, holdings or order levels. No annualising a quarter.
 * Core AFFO and AFFO definitions vary across issuers. Scope is retained per cell.
 */
export const PROPERTY_METRICS=[
 {key:"core_ffo",label:"Core FFO / diluted share",unit:"USD/share",type:"REIT"},
 {key:"affo",label:"AFFO / share (issuer definition)",unit:"USD/share",type:"REIT"},
 {key:"noi_yoy",label:"Same-store NOI growth YoY",unit:"%",type:"REIT"},
 {key:"occupancy",label:"Same-store average occupancy",unit:"%",type:"REIT"},
 {key:"new_lease",label:"New lease rent growth",unit:"%",type:"REIT"},
 {key:"renewal",label:"Renewal rent growth",unit:"%",type:"REIT"},
 {key:"leverage",label:"Net debt / trailing adjusted EBITDAre",unit:"x",type:"REIT"},
 {key:"fixed_debt",label:"Fixed or hedged debt share",unit:"%",type:"REIT"},
 {key:"maturity",label:"Weighted debt maturity",unit:"years",type:"REIT"},
 {key:"orders",label:"Net new orders",unit:"homes",type:"BUILDER"},
 {key:"order_value",label:"Net new order value",unit:"USD bn",type:"BUILDER"},
 {key:"backlog",label:"Unit backlog",unit:"homes",type:"BUILDER"},
 {key:"closings",label:"Closings",unit:"homes",type:"BUILDER"},
 {key:"gross_margin",label:"Home sale gross margin",unit:"%",type:"BUILDER"},
 {key:"cancellations",label:"Cancellation rate",unit:"%",type:"BUILDER"},
 {key:"incentives",label:"Sales incentives",unit:"%",type:"BUILDER"},
 {key:"net_debt_capital",label:"Net debt / capital",unit:"%",type:"BUILDER"},
 {key:"p_affo",label:"Price / forward AFFO",unit:"x",type:"REIT"},
 {key:"p_book",label:"Price / book",unit:"x",type:"BUILDER"}
] as const;
type Key=typeof PROPERTY_METRICS[number]["key"];
type Scope="QUARTER"|"PERIOD_END";
type Fact={key:Key;value:number;scope:Scope;basis:string};
type Receipt={ticker:string;type:"REIT"|"BUILDER";periodEnd:string;releaseDay:string;availableNotBefore:string;sourceUrl:string;facts:readonly Fact[];guidance:string};
const q=(key:Key,value:number,basis:string):Fact=>({key,value,scope:"QUARTER",basis});
const end=(key:Key,value:number,basis:string):Fact=>({key,value,scope:"PERIOD_END",basis});
const RECEIPTS:readonly Receipt[]=[
 {ticker:"MAA",type:"REIT",periodEnd:"2026-09-30",releaseDay:"2026-10-28",availableNotBefore:"2026-11-25T21:27:00Z",sourceUrl:"https://www.sec.gov/Archives/edgar/data/912595/000119312526436173/maa-ex99_1.htm",facts:[
 q("core_ffo",2.10,"Issuer Core FFO per diluted share; non-GAAP"),
 q("affo",1.79,"Issuer Core AFFO per diluted share; non-GAAP"),
 q("noi_yoy",-1.8,"Same-store operating NOI YoY, issuer definition"),
 q("occupancy",95.3,"Same-store average physical occupancy"),
 q("new_lease",-6,"Same-store effective new lease rate growth"),
 q("renewal",5.3,"Same-store effective renewal lease growth"),
 end("leverage",4.7,"Net debt / trailing adjusted EBITDAre; issuer definition"),
 end("fixed_debt",79.3,"Fixed-rate debt / total debt; issuer definition"),
 end("maturity",5.6,"Total debt average years to maturity")],
 guidance:"FY2026 Core AFFO $7.40–7.52 per diluted share; Core FFO $8.43–8.55; same-store NOI growth −1.70% to −0.80%. Guidance is not realised quarterly AFFO."},
 {ticker:"INVH",type:"REIT",periodEnd:"2026-09-30",releaseDay:"2026-10-28",availableNotBefore:"2026-11-25T21:27:00Z",sourceUrl:"https://www.sec.gov/Archives/edgar/data/1687229/000168722926000053/q32026supplemental.htm",facts:[
 q("core_ffo",0.48,"Issuer Core FFO per share; non-GAAP"),
 q("affo",0.38,"Issuer AFFO per share; non-GAAP"),
 q("noi_yoy",1.1,"Same-store NOI YoY"),
 q("occupancy",96.4,"Same-store average occupancy"),
 q("new_lease",-0.2,"Same-store new lease rent growth"),
 q("renewal",4.3,"Same-store renewal rent growth"),
 end("leverage",5.5,"Net debt / TTM adjusted EBITDAre; issuer definition"),
 end("fixed_debt",90.2,"Fixed or swapped-to-fixed debt / total debt")],
 guidance:"FY2026 Core FFO midpoint $1.96/share; same-store NOI growth guidance midpoint 1.2%; not realised AFFO."},
 {ticker:"PHM",type:"BUILDER",periodEnd:"2026-09-30",releaseDay:"2026-10-22",availableNotBefore:"2026-11-25T21:27:00Z",sourceUrl:"https://www.sec.gov/Archives/edgar/data/822416/000082241626000041/ex991earningspr9302026.htm",facts:[
 q("orders",6208,"Quarter net new home orders"),
 q("order_value",3.5,"Quarter net new order value, rounded billions"),
 end("backlog",10298,"Unit backlog at quarter end, +4% YoY"),
 q("closings",6876,"Quarter home closings"),
 q("gross_margin",24.8,"Home sale gross margin, not consolidated operating margin")],
 guidance:"Reported backlog value $6.4bn, +3% YoY. Management cited mortgage-rate and affordability pressures; no comparable cancellation rate or incentive metric captured in this receipt."}
];
const REITS=new Set(["MAA","INVH","ESS","CPT","AMH","O","PLD","AVB","EQR","VICI","DLR","EQIX","WELL"]);
const BUILDERS=new Set(["TOL","PHM","NVR","DHI","LEN"]);
export function propertyComparison(tickers:readonly string[],now=new Date()){
 const t=now.getTime();
 return tickers.map(ticker=>{
  const type=REITS.has(ticker)?"REIT":BUILDERS.has(ticker)?"BUILDER":null;
  const receipt=RECEIPTS.find(r=>r.ticker===ticker&&Date.parse(r.availableNotBefore)<=t&&t-Date.parse(r.releaseDay+"T00:00:00Z")<=90*86400000);
  const cells=PROPERTY_METRICS.map(m=>{
   const fact=receipt?.facts.find(f=>f.key===m.key&&Number.isFinite(f.value));
   return {key:m.key,state:type===null?"NOT_CLASSIFIED":type!==m.type?"NOT_APPLICABLE":fact?"REVIEWED":"NOT_VERIFIED",value:fact?.value??null,unit:m.unit,scope:fact?.scope??null,basis:fact?.basis??null};
  });
  return {ticker,type,periodEnd:receipt?.periodEnd??null,releaseDay:receipt?.releaseDay??null,sourceUrl:receipt?.sourceUrl??null,guidance:receipt?.guidance??null,cells};
 });
}
