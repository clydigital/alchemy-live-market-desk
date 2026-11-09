import type { PublicMarketObservation } from "./blue-desk-public-markets.ts";

/**
 * A bounded identity-only discovery catalogue. These are *not* quote adapters:
 * an unmonitored entry cannot enter price charts, comparisons, the Dossier,
 * or a public portfolio until a validated provider mapping is approved.
 */
export type CatalogueAssetClass = "ETF" | "FX";
export type CatalogueStatus = "SOURCE_DATED" | "MONITORED_UNAVAILABLE" | "CATALOGUE_ONLY";
export type CatalogueScope = "additional" | "all" | "monitored";
export type CatalogueEntry = {
  id: string; symbol: string; label: string; assetClass: string;
  venue: string | null; status: CatalogueStatus; last: number | null;
  asOf: string | null; sourceUrl: string | null;
};
export type CataloguePage = {
  items: CatalogueEntry[]; query: string; scope: CatalogueScope; page: number;
  pages: number; total: number; catalogueCount: number; monitoredCount: number;
  pricedCount: number; filteredCount: number; pageSize: number;
};
const ETF_REFERENCE: ReadonlyArray<readonly [string,string]> = [
  ["SPY","SPDR S&P 500 ETF Trust"],["VOO","Vanguard S&P 500 ETF"],
  ["IVV","iShares Core S&P 500 ETF"],["VTI","Vanguard Total Stock Market ETF"],
  ["IWM","iShares Russell 2000 ETF"],["IJR","iShares Core S&P Small-Cap ETF"],
  ["MDY","SPDR S&P MidCap 400 ETF"],["QQQM","Invesco Nasdaq 100 ETF"],
  ["EEM","iShares MSCI Emerging Markets ETF"],["VWO","Vanguard FTSE Emerging Markets ETF"],
  ["EFA","iShares MSCI EAFE ETF"],["VEA","Vanguard FTSE Developed Markets ETF"],
  ["EWJ","iShares MSCI Japan ETF"],["EWG","iShares MSCI Germany ETF"],
  ["EWU","iShares MSCI United Kingdom ETF"],["EWA","iShares MSCI Australia ETF"],
  ["EWC","iShares MSCI Canada ETF"],["EWT","iShares MSCI Taiwan ETF"],
  ["INDA","iShares MSCI India ETF"],["FXI","iShares China Large-Cap ETF"],
  ["MCHI","iShares MSCI China ETF"],["KWEB","KraneShares CSI China Internet ETF"],
  ["HYG","iShares High Yield Corporate Bond ETF"],["LQD","iShares Investment Grade Corporate Bond ETF"],
  ["TLT","iShares 20+ Year Treasury Bond ETF"],["IEF","iShares 7-10 Year Treasury Bond ETF"],
  ["SHY","iShares 1-3 Year Treasury Bond ETF"],["SGOV","iShares 0-3 Month Treasury Bond ETF"],
  ["TIP","iShares TIPS Bond ETF"],["BND","Vanguard Total Bond Market ETF"],
  ["GLD","SPDR Gold Shares"],["IAU","iShares Gold Trust"],
  ["SLV","iShares Silver Trust"],["USO","United States Oil Fund"],
  ["UNG","United States Natural Gas Fund"],["DBA","Invesco DB Agriculture Fund"],
  ["XOP","SPDR S&P Oil & Gas Exploration & Production ETF"],["OIH","VanEck Oil Services ETF"],
  ["TAN","Invesco Solar ETF"],["ICLN","iShares Global Clean Energy ETF"],
  ["URA","Global X Uranium ETF"],["NLR","VanEck Uranium and Nuclear ETF"],
  ["BOTZ","Global X Robotics & Artificial Intelligence ETF"],
  ["ROBO","ROBO Global Robotics and Automation Index ETF"],
  ["CIBR","First Trust Nasdaq Cybersecurity ETF"],["HACK","Amplify Cybersecurity ETF"],
  ["ITB","iShares U.S. Home Construction ETF"],["XHB","SPDR S&P Homebuilders ETF"],
  ["KRE","SPDR S&P Regional Banking ETF"],["XRT","SPDR S&P Retail ETF"],
  ["JETS","U.S. Global Jets ETF"],["ETHA","iShares Ethereum Trust ETF"],
  ["IGV","iShares Expanded Tech-Software Sector ETF"],["SMH","VanEck Semiconductor ETF"],
  ["SOXX","iShares Semiconductor ETF"],["RSP","Invesco S&P 500 Equal Weight ETF"],
];
const FX_REFERENCE: ReadonlyArray<readonly [string,string]> = [
  ["EURUSD","Euro / US Dollar"],["GBPUSD","Pound Sterling / US Dollar"],
  ["AUDUSD","Australian Dollar / US Dollar"],["NZDUSD","New Zealand Dollar / US Dollar"],
  ["USDJPY","US Dollar / Japanese Yen"],["USDCAD","US Dollar / Canadian Dollar"],
  ["USDCHF","US Dollar / Swiss Franc"],["USDCNH","US Dollar / Offshore Chinese Yuan"],
  ["USDMYR","US Dollar / Malaysian Ringgit"],["USDSGD","US Dollar / Singapore Dollar"],
  ["USDKRW","US Dollar / South Korean Won"],["USDTWD","US Dollar / Taiwan Dollar"],
  ["EURGBP","Euro / Pound Sterling"],["EURJPY","Euro / Japanese Yen"],
  ["GBPJPY","Pound Sterling / Japanese Yen"],["AUDJPY","Australian Dollar / Japanese Yen"],
  ["NZDJPY","New Zealand Dollar / Japanese Yen"],["CADJPY","Canadian Dollar / Japanese Yen"],
  ["CHFJPY","Swiss Franc / Japanese Yen"],["USDMXN","US Dollar / Mexican Peso"],
  ["USDBRL","US Dollar / Brazilian Real"],
];
const refs: readonly CatalogueEntry[] = [
  ...ETF_REFERENCE.map(([symbol,label])=>({
    id:"ref:etf:"+symbol, symbol,label,assetClass:"ETF" as const,venue:"US-listed ETF",
    status:"CATALOGUE_ONLY" as const,last:null,asOf:null,sourceUrl:null,
  })),
  ...FX_REFERENCE.map(([symbol,label])=>({
    id:"ref:fx:"+symbol,symbol,label,assetClass:"FX" as const,venue:"OTC spot pair",
    status:"CATALOGUE_ONLY" as const,last:null,asOf:null,sourceUrl:null,
  })),
];
export const PUBLIC_CATALOGUE_REFERENCE_COUNT=refs.length;
const PAGE_SIZE=15;
function cleanQuery(q:unknown):string{
  return typeof q==="string"?q.trim().slice(0,64):"";
}
function cleanScope(s:unknown):CatalogueScope{
  return s==="monitored"?"monitored":s==="all"?"all":"additional";
}
function cleanPage(p:unknown):number{
  if(typeof p!=="string"||!/^[1-9]\d{0,4}$/.test(p))return 1;
  return Math.max(1,Math.min(10000,Number(p)));
}
/** No quote, provider, or owner calls; the only inputs are already-public observations. */
export function searchPublicAssetCatalogue(
  observations: readonly PublicMarketObservation[],
  options: {query?:unknown;scope?:unknown;page?:unknown}={},
):CataloguePage{
  const query=cleanQuery(options.query),scope=cleanScope(options.scope);
  const byKey=new Map<string,CatalogueEntry>();
  for(const row of observations){
    const symbol=row.symbol?.trim();
    if(!symbol||!row.id||!row.label)continue;
    const key=symbol.toUpperCase();
    if(byKey.has(key))continue;
    const valid=typeof row.last==="number"&&Number.isFinite(row.last)
      && !!row.asOf && row.dataStatus!=="UNAVAILABLE_OR_STALE";
    byKey.set(key,{id:"mon:"+row.id,symbol,label:row.label,
      assetClass:row.type,venue:null,
      status:valid?"SOURCE_DATED":"MONITORED_UNAVAILABLE",
      last:valid?row.last:null,asOf:row.asOf,sourceUrl:row.sourceUrl});
  }
  const monitoredCount=byKey.size;
  const pricedCount=[...byKey.values()].filter(row=>row.status==="SOURCE_DATED").length;
  for(const row of refs){
    if(!byKey.has(row.symbol.toUpperCase()))byKey.set(row.symbol.toUpperCase(),row);
  }
  const universe=[...byKey.values()].sort((a,b)=>
    a.symbol.localeCompare(b.symbol)||a.id.localeCompare(b.id));
  const text=query.toLocaleLowerCase("en");
  const results=universe.filter(row=>
    (scope==="all"||scope==="monitored"&&row.status!=="CATALOGUE_ONLY"
      ||scope==="additional"&&row.status==="CATALOGUE_ONLY")
    &&(!text||row.symbol.toLocaleLowerCase("en").includes(text)
      ||row.label.toLocaleLowerCase("en").includes(text)
      ||row.assetClass.toLocaleLowerCase("en").includes(text)));
  const pages=Math.max(1,Math.ceil(results.length/PAGE_SIZE));
  const page=Math.min(cleanPage(options.page),pages);
  return {items:results.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE),
    query,scope,page,pages,total:universe.length,catalogueCount:universe.length-monitoredCount,
    monitoredCount,pricedCount,filteredCount:results.length,pageSize:PAGE_SIZE};
}
