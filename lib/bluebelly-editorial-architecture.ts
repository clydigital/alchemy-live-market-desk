import type { NewsBriefV1 } from "./market-brief-news.ts";
import type { PublicThesis } from "./blue-desk-thesis-ledger.ts";

/** Fixed editorial navigation, not the canonical persistent Regime engine. */
export const EDITORIAL_TOPICS = [
  {id:"all",label:"All news",pattern:null},
  {id:"policy",label:"Central banks",pattern:/\b(fed|fomc|federal reserve|powell|ecb|central bank|inflation|cpi|pce|bank of england|rate decision)\b/i},
  {id:"ai",label:"AI & technology",pattern:/\b(artificial intelligence|ai|llm|model|chips?|compute|semiconductor|nvidia|microsoft|inference|robotics|hyperscaler|data cent(?:re|er))\b/i},
  {id:"bonds",label:"Bonds & credit",pattern:/\b(bonds?|treasur(?:y|ies)|yields?|credit|auction|refinanc|debt|funding|duration|term premium|gilts?|bunds?)\b/i},
  {id:"energy",label:"Energy",pattern:/\b(oil|brent|wti|crude|hormuz|opec|lng|tanker|refiner|diesel|natural gas|pipeline)\b/i},
  {id:"fx",label:"FX & metals",pattern:/\b(dollar|usd|yen|jpy|forex|fx|currency|yuan|gold|bullion|silver|boj|exchange rate)\b/i},
  {id:"earnings",label:"Earnings & stocks",pattern:/\b(earnings|revenue|guidance|shares?|stocks?|equities|profits?|cash flow|capex|s&p 500|nasdaq|ipo|dividend)\b/i},
  {id:"other",label:"Other stories",pattern:null},
] as const;
export type EditorialTopicId = (typeof EDITORIAL_TOPICS)[number]["id"];

export function editorialNewsTopics(news:Pick<NewsBriefV1,"headline"|"summary">):EditorialTopicId[]{
  const text=(news.headline+" "+news.summary).slice(0,4000);
  const result:EditorialTopicId[]=[];
  for(const item of EDITORIAL_TOPICS){
    if(item.pattern && item.pattern.test(text))result.push(item.id);
  }
  return result.length?result:["other"];
}

/** Public-safe research navigation built ONLY from existing public Story snapshots.
 * Do not invent the regime engine's confidence, verdict, age or Evidence IDs. */
export const EDITORIAL_REGIME_LENSES = [
 {id:"fed",name:"Fed path & inflation",code:"01 / POLICY",question:"Are policy expectations changing because inflation is cooling, or because growth is weakening?",nextTest:"Fed statement, CPI/PCE detail and dated front-end Treasury observations.",motif:"fed",pattern:/\b(fed|fomc|inflation|cpi|pce|rate cut|policy rate|powell|labou?r market)\b/i},
 {id:"bonds",name:"Treasury & credit funding",code:"02 / COST OF CAPITAL",question:"Can long-term capital get cheaper, or is sovereign supply repricing borrowers?",nextTest:"Treasury auction demand, 10Y/30Y yields, credit spreads and financing terms.",motif:"bonds",pattern:/\b(treasur|bonds?|yield|term premium|credit|funding|refinanc|sovereign|duration|mortgage)\b/i},
 {id:"ai",name:"AI boom: demand vs returns",code:"03 / AI INVESTMENT",question:"AI capacity is expanding—but are the buyers generating enough cash to pay for it?",nextTest:"Issuer capex, cash flow, utilisation, earnings and debt maturity disclosures.",motif:"ai",pattern:/\b(ai|artificial intelligence|nvidia|hyperscaler|data cent|chip|semiconductor|compute|capex|coreweave)\b/i},
 {id:"china",name:"China–US compute race",code:"04 / TECH COMPETITION",question:"Does cheaper or more accessible computing widen adoption or squeeze margins?",nextTest:"Official export rules, benchmark methodology, memory supply and disclosed pricing.",motif:"china",pattern:/\b(china|chinese|beijing|deepseek|trade war|export control|tariff)\b/i},
 {id:"energy",name:"Energy & physical scarcity",code:"05 / SUPPLY & INFLATION",question:"Is the bottleneck crude supply, refined products, shipping or gas?",nextTest:"Dated physical flows, official inventory reports, freight and refining conditions.",motif:"energy",pattern:/\b(hormuz|oil|brent|wti|crude|iran|refin|diesel|lng|opec|tanker|energy)\b/i},
 {id:"yen",name:"Japan & carry transmission",code:"06 / GLOBAL FX",question:"When Japanese rates move, is there real evidence of overseas funding stress?",nextTest:"BOJ communication, JGB yields, USDJPY and dated funding conditions.",motif:"yen",pattern:/\b(japan|japanese|yen|jpy|boj|jgb|carry trade)\b/i},
 {id:"breadth",name:"Equity breadth & credit cycle",code:"07 / RISK QUALITY",question:"Are profits and participation broadening, or is index strength becoming narrower?",nextTest:"Equal-weight breadth, issuer earnings, bank provisions and credit spreads.",motif:"equities",pattern:/\b(spx|s&p|equity|equities|stocks?|nasdaq|breadth|banks?|earnings|credit cycle)\b/i},
 {id:"gold",name:"Gold & reserve allocation",code:"08 / RESERVE SYSTEM",question:"Is gold responding to real yields, reserve demand or a separate risk premium?",nextTest:"Official reserve releases, real yields, dollar and matched spot observations.",motif:"gold",pattern:/\b(gold|bullion|xau|central bank reserves?|real yields?)\b/i},
] as const;

export type EditorialRegimeId=(typeof EDITORIAL_REGIME_LENSES)[number]["id"];

/** A Story may appear in several lenses, or none. Classification is not a Story mutation. */
export function groupPublicResearch(theses:readonly PublicThesis[]) {
 return EDITORIAL_REGIME_LENSES.map(lens=>({
  ...lens,stories:theses.filter(story=>lens.pattern.test(story.title+" "+story.slug+" "+story.question)).slice(0,6)
 }));
}
