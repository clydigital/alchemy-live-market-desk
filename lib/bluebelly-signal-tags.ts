/**
 * Read-only editorial *discovery* tags. A keyword can suggest a question;
 * it does not establish a priced divergence, fair value, causal shock or Regime.
 */
export const SIGNAL_TAGS=[
 {id:"divergence",label:"Divergence",question:"Are observed market and fundamental measures telling different stories?"},
 {id:"mispricing",label:"Potential mispricing",question:"Is a source-dated market valuation inconsistent with independently verified fundamentals?"},
 {id:"catalyst",label:"Catalyst watch",question:"Which dated release or decision could change the thesis?"},
 {id:"regime",label:"Regime pressure",question:"Is financing, policy or inflation pressure changing?"},
 {id:"supply",label:"Supply/demand dislocation",question:"Is a physical constraint or demand shift changing availability?"},
 {id:"counter",label:"Counter-signal",question:"What evidence challenges the prevailing interpretation?"},
] as const;
export type SignalTagId=typeof SIGNAL_TAGS[number]["id"];
export type SignalTag=Readonly<{id:SignalTagId;label:string;state:"QUESTION"|"SOURCED_COMPARISON"}>;
export type ValuationComparison=Readonly<{
 marketPrice:number;priceObservedOn:string;priceSourceUrl:string;
 fundamentalValue:number;fundamentalBasis:string;fundamentalSourceUrl:string;
 comparisonExplanation:string;
}>;
export type SignalTagInput=Readonly<{
 title:string;detail?:string;nextCheck?:string;
 evidence:"AUTOMATED_LEAD"|"SOURCE_ONLY_NEWS"|"SOURCE_CORROBORATED"|"RESEARCH_LEAD"|"CONTRADICTED";
 reviewedValuation?:ValuationComparison|null;
}>;
const lower=(s:string)=>s.toLowerCase();
const validHttps=(v:string)=>{try{const u=new URL(v);return u.protocol==="https:"&&!u.username&&!u.password&&u.hostname.includes(".");}catch{return false;}};
function vettedValuation(v:ValuationComparison|undefined|null):boolean{
 if(!v||!Number.isFinite(v.marketPrice)||v.marketPrice<=0||
   !Number.isFinite(v.fundamentalValue)||v.fundamentalValue<=0||
   !/^\d{4}-\d{2}-\d{2}$/.test(v.priceObservedOn)||
   !validHttps(v.priceSourceUrl)||!validHttps(v.fundamentalSourceUrl)||
   v.priceSourceUrl===v.fundamentalSourceUrl||
   v.fundamentalBasis.trim().length<12||v.comparisonExplanation.trim().length<20)return false;
 return true;
}
const DIFFERENCE=/\b(?:despite|while|versus|vs\.?|although|even as|but|yet|contrast|diverg(?:e|ence)|disconnect|lag(?:s|ging)?|outpac\w*|faster than|not keeping pace)\b/i;
const DIMENSIONS=[
 /\b(?:price|shares?|stocks?|etf|valuation|yield|brent|crack|index|equities|premium)\b/i,
 /\b(?:revenue|sales|demand|orders?|shipments?|backlog|capex|capacity|utilisation|utilization|contracts?)\b/i,
 /\b(?:cash flow|fcf|profit|earnings|margin|loss|interest expense|debt|finance|funding|credit)\b/i,
 /\b(?:supply|inventory|storage|tanker|shipping|refin\w*|exports?|lng|diesel|gasoline|fuel)\b/i,
 /\b(?:rate|fed|policy|inflation|cpi|tariff|sanction|export controls?)\b/i,
];
const CATALYST=/\b(?:earnings|fomc|cpi|pce|payrolls|auctions?|meetings?|scheduled|deadline|vote|decision|index review|guidance|result(?:s)?|regulat(?:or|ory)|licen[cs]ing)\b/i;
const PRESSURE=/\b(?:fed|rates?|treasur\w*|credit|debt|funding|financing|inflation|tariff|sanction|war|policy|export control|liquidity)\b/i;
const CHANGING=/\b(?:tight|stress|risk|higher|lower|hike|cut|repric|widen|narrow|shif|shock|restrict|surg|slow|disrupt|rising|falling|ris\w*|climb\w*|increase|decrease)\w*\b/i;
const SUPPLY=/\b(?:supply|demand|fuel|diesel|gasoline|lng|refiner\w*|ship\w*|tankers?|inventory|storage|capacity|pipeline|grid|hbm|orders?|chokepoint)\b/i;
const DISTORTION=/\b(?:disrupt|block|tight|constrain|shortage|surplus|delay|bottleneck|recovery|recover|shut|backlog|outpac|scarcity|spike|scarce|ration)\w*\b/i;
const COUNTER=/\b(?:despite|however|yet|contradict|countercase|not necessarily|even as|nevertheless|failed to|not enough|is not|does not)\b/i;
/** Label even source-corroborated text as a RESEARCH QUESTION: corroborating
 * the original event does not verify the market interpretation. */
export function suggestSignalTags(input:SignalTagInput):SignalTag[]{
 const text=(input.title+" "+(input.detail||"")).slice(0,2100);
 const titlesOnly=lower(input.title);
 const ids:SignalTagId[]=[];
 const add=(id:SignalTagId)=>{if(!ids.includes(id))ids.push(id);};
 if(DIFFERENCE.test(text)&&DIMENSIONS.filter(re=>re.test(text)).length>=2)add("divergence");
 if(input.evidence==="SOURCE_CORROBORATED"&&vettedValuation(input.reviewedValuation))add("mispricing");
 if(CATALYST.test(titlesOnly))add("catalyst");
 if(PRESSURE.test(text)&&CHANGING.test(text))add("regime");
 if(SUPPLY.test(text)&&DISTORTION.test(text))add("supply");
 if(COUNTER.test(titlesOnly)&&!ids.includes("divergence"))add("counter");
 return ids.slice(0,3).map(id=>{
  const meta=SIGNAL_TAGS.find(x=>x.id===id)!;
  return {id,label:meta.label,state:id==="mispricing"?"SOURCED_COMPARISON" as const:"QUESTION" as const};
 });
}
