/** Bluebelly entity marks: deterministic, display-only identity. No scraping or inferred issuer claims.
 * All company favicon URLs are explicitly allowlisted. Unknown tickers render a monogram.
 * Country markers distinguish economic geography, not proof of a market causal relationship.
 */
export type EntityKind = "country" | "company" | "asset" | "institution";
export type EntityIdentity = {kind:EntityKind; code:string; label?:string};
export const BLUEBELLY_COMPANIES:Readonly<Record<string,{name:string;favicon:string}>> = {
  MSFT:{name:"Microsoft",favicon:"https://www.microsoft.com/favicon.ico"},
  AAPL:{name:"Apple",favicon:"https://www.apple.com/favicon.ico"},
  NVDA:{name:"NVIDIA",favicon:"https://www.nvidia.com/favicon.ico"},
  GOOGL:{name:"Alphabet",favicon:"https://www.google.com/favicon.ico"},
  GOOG:{name:"Alphabet",favicon:"https://www.google.com/favicon.ico"},
  AMZN:{name:"Amazon",favicon:"https://www.amazon.com/favicon.ico"},
  META:{name:"Meta",favicon:"https://about.meta.com/favicon.ico"},
  TSLA:{name:"Tesla",favicon:"https://www.tesla.com/favicon.ico"},
  TSM:{name:"TSMC",favicon:"https://www.tsmc.com/favicon.ico"},
  AMD:{name:"AMD",favicon:"https://www.amd.com/favicon.ico"},
  MU:{name:"Micron",favicon:"https://www.micron.com/favicon.ico"},
  ORCL:{name:"Oracle",favicon:"https://www.oracle.com/favicon.ico"},
  AVGO:{name:"Broadcom",favicon:"https://www.broadcom.com/favicon.ico"},
  QCOM:{name:"Qualcomm",favicon:"https://www.qualcomm.com/favicon.ico"},
  NFLX:{name:"Netflix",favicon:"https://www.netflix.com/favicon.ico"},
  JPM:{name:"JPMorgan Chase",favicon:"https://www.jpmorganchase.com/favicon.ico"},
  BAC:{name:"Bank of America",favicon:"https://www.bankofamerica.com/favicon.ico"},
  WFC:{name:"Wells Fargo",favicon:"https://www.wellsfargo.com/favicon.ico"},
  GS:{name:"Goldman Sachs",favicon:"https://www.goldmansachs.com/favicon.ico"},
  XOM:{name:"ExxonMobil",favicon:"https://corporate.exxonmobil.com/favicon.ico"},
  CVX:{name:"Chevron",favicon:"https://www.chevron.com/favicon.ico"},
  ASML:{name:"ASML",favicon:"https://www.asml.com/favicon.ico"},
  ARM:{name:"Arm",favicon:"https://www.arm.com/favicon.ico"},
  CRWV:{name:"CoreWeave",favicon:"https://www.coreweave.com/favicon.ico"},
};
export const BLUEBELLY_COUNTRIES:Readonly<Record<string,{name:string;flag:string}>> = {
  US:{name:"United States",flag:"🇺🇸"},EU:{name:"European Union",flag:"🇪🇺"},
  DE:{name:"Germany",flag:"🇩🇪"},GB:{name:"United Kingdom",flag:"🇬🇧"},
  JP:{name:"Japan",flag:"🇯🇵"},CN:{name:"China",flag:"🇨🇳"},
  CA:{name:"Canada",flag:"🇨🇦"},AU:{name:"Australia",flag:"🇦🇺"},
  NZ:{name:"New Zealand",flag:"🇳🇿"},FR:{name:"France",flag:"🇫🇷"},
  IT:{name:"Italy",flag:"🇮🇹"},IR:{name:"Iran",flag:"🇮🇷"},
  SA:{name:"Saudi Arabia",flag:"🇸🇦"},RU:{name:"Russia",flag:"🇷🇺"},
  UA:{name:"Ukraine",flag:"🇺🇦"},IN:{name:"India",flag:"🇮🇳"},
  KR:{name:"South Korea",flag:"🇰🇷"},TW:{name:"Taiwan",flag:"🇹🇼"},
  IL:{name:"Israel",flag:"🇮🇱"},PK:{name:"Pakistan",flag:"🇵🇰"},
};
export const ASSET_CODES:Readonly<Record<string,string>> = {
  BRENT:"Brent",WTI:"WTI",GOLD:"Gold",XAUUSD:"Gold",SILVER:"Silver",
  SPX:"S&P 500",SP500:"S&P 500",US500:"S&P 500",NDX:"Nasdaq 100",
  NAS100:"Nasdaq 100",DXY:"US Dollar Index",JXY:"Yen Index",
  BTC:"Bitcoin",ETH:"Ethereum",OIL:"Oil",LNG:"LNG",
  VIX:"VIX",COPPER:"Copper",TLT:"Treasury ETF",IEF:"Treasury ETF",
};
const CURRENCY:Record<string,string>={USD:"US",JPY:"JP",EUR:"EU",GBP:"GB",AUD:"AU",NZD:"NZ",CAD:"CA",CNY:"CN"};
const INSTITUTIONS:Readonly<Record<string,{name:string;country:string}>>={
  FED:{name:"Federal Reserve",country:"US"},BOJ:{name:"Bank of Japan",country:"JP"},
  ECB:{name:"European Central Bank",country:"EU"},BOE:{name:"Bank of England",country:"GB"},
  BOC:{name:"Bank of Canada",country:"CA"},RBA:{name:"Reserve Bank of Australia",country:"AU"},
  RBNZ:{name:"Reserve Bank of New Zealand",country:"NZ"},OPEC:{name:"OPEC",country:""},
};
export function normaliseEntityCode(value:string):string{
  return (typeof value==="string"?value:"").trim().toUpperCase().replace(/[^A-Z0-9.-]/g,"").slice(0,16);
}
export function entityForAsset(value:string):EntityIdentity|null{
  const code=normaliseEntityCode(value);if(!code)return null;
  if(BLUEBELLY_COMPANIES[code])return {kind:"company",code};
  if(ASSET_CODES[code])return {kind:"asset",code};
  if(INSTITUTIONS[code])return {kind:"institution",code};
  if(CURRENCY[code])return {kind:"country",code:CURRENCY[code]};
  if(BLUEBELLY_COUNTRIES[code])return {kind:"country",code};
  if(/^US(?:0?[257]|10|20|30)Y$/.test(code)||/^UST(?:2|5|10|20|30)$/.test(code))
    return {kind:"country",code:"US"};
  if(/^JP(?:0?[257]|10|20|30)Y$/.test(code)||code==="JGB"||code==="NIKKEI")
    return {kind:"country",code:"JP"};
  if(code==="BUND"||code==="DAX")return {kind:"country",code:"DE"};
  if(code==="FTSE"||code.startsWith("UK")&&/Y$/.test(code))return {kind:"country",code:"GB"};
  if(code==="STOXX"||code==="BTP")return {kind:"country",code:code==="BTP"?"IT":"EU"};
  if(code==="ASX")return {kind:"country",code:"AU"};
  if(code==="TSX")return {kind:"country",code:"CA"};
  if(code==="USDJPY")return {kind:"asset",code};
  return {kind:"asset",code};
}
export function entityName(identity:EntityIdentity):string{
  if(identity.label)return identity.label;
  if(identity.kind==="country")return BLUEBELLY_COUNTRIES[identity.code]?.name||identity.code;
  if(identity.kind==="company")return BLUEBELLY_COMPANIES[identity.code]?.name||identity.code;
  if(identity.kind==="institution")return INSTITUTIONS[identity.code]?.name||identity.code;
  return ASSET_CODES[identity.code]||identity.code;
}
export function companyFavicon(code:string):string|null{
  return BLUEBELLY_COMPANIES[normaliseEntityCode(code)]?.favicon||null;
}
export function institutionCountry(code:string):string|null{
  return INSTITUTIONS[normaliseEntityCode(code)]?.country||null;
}
export function identitiesFromAssets(assets:readonly string[],max=5):EntityIdentity[]{
  const seen=new Set<string>();const result:EntityIdentity[]=[];
  for(const asset of assets){
    const id=entityForAsset(asset);if(!id)continue;
    const key=id.kind+":"+id.code;if(seen.has(key))continue;
    seen.add(key);result.push(id);if(result.length>=Math.max(1,Math.min(8,max)))break;
  }return result;
}
export function entityForCalendarEvent(kind:"economic"|"earnings",assets:readonly string[]){
  if(kind==="earnings"){
    for(const asset of assets){const id=entityForAsset(asset);if(id?.kind==="company")return id;}
  }
  for(const asset of assets){const id=entityForAsset(asset);if(id&&(id.kind==="country"||id.kind==="company"))return id;}
  return {kind:"asset",code:"MARKET"} as EntityIdentity;
}
