/** Public presentation-only entity registry. Every mapping is explicit; identity
 * must never imply evidence admission, canonical relationship, or market impact.
 */
export type EntityKind = "country" | "company" | "asset" | "institution" | "source";
export type EntityIdentity = { kind: EntityKind; id:string; label?:string };
export type EntityTone = "neutral" | "macro" | "earnings" | "technology" | "diplomacy" | "energy" | "ready" | "warn" | "risk";

export const COUNTRY_IDENTITY = {
  US:{label:"United States",flag:"🇺🇸"},EU:{label:"European Union",flag:"🇪🇺"},
  DE:{label:"Germany",flag:"🇩🇪"},GB:{label:"United Kingdom",flag:"🇬🇧"},
  JP:{label:"Japan",flag:"🇯🇵"},CA:{label:"Canada",flag:"🇨🇦"},
  AU:{label:"Australia",flag:"🇦🇺"},NZ:{label:"New Zealand",flag:"🇳🇿"},
  CN:{label:"China",flag:"🇨🇳"},HK:{label:"Hong Kong",flag:"🇭🇰"},
  TW:{label:"Taiwan",flag:"🇹🇼"},KR:{label:"South Korea",flag:"🇰🇷"},
  IN:{label:"India",flag:"🇮🇳"},IR:{label:"Iran",flag:"🇮🇷"},
  SA:{label:"Saudi Arabia",flag:"🇸🇦"},RU:{label:"Russia",flag:"🇷🇺"},
  UA:{label:"Ukraine",flag:"🇺🇦"},IL:{label:"Israel",flag:"🇮🇱"},
  PK:{label:"Pakistan",flag:"🇵🇰"},TR:{label:"Türkiye",flag:"🇹🇷"},
} as const;
export const COMPANY_IDENTITY:Record<string,{label:string;favicon:string}> = {
  MSFT:{label:"Microsoft",favicon:"https://www.microsoft.com/favicon.ico"},
  AAPL:{label:"Apple",favicon:"https://www.apple.com/favicon.ico"},
  NVDA:{label:"NVIDIA",favicon:"https://www.nvidia.com/favicon.ico"},
  GOOGL:{label:"Alphabet",favicon:"https://www.google.com/favicon.ico"},
  GOOG:{label:"Alphabet",favicon:"https://www.google.com/favicon.ico"},
  AMZN:{label:"Amazon",favicon:"https://www.amazon.com/favicon.ico"},
  META:{label:"Meta",favicon:"https://about.meta.com/favicon.ico"},
  TSLA:{label:"Tesla",favicon:"https://www.tesla.com/favicon.ico"},
  TSM:{label:"TSMC",favicon:"https://www.tsmc.com/favicon.ico"},
  AMD:{label:"AMD",favicon:"https://www.amd.com/favicon.ico"},
  MU:{label:"Micron",favicon:"https://www.micron.com/favicon.ico"},
  ORCL:{label:"Oracle",favicon:"https://www.oracle.com/favicon.ico"},
  AVGO:{label:"Broadcom",favicon:"https://www.broadcom.com/favicon.ico"},
  JPM:{label:"JPMorgan Chase",favicon:"https://www.jpmorganchase.com/favicon.ico"},
  BAC:{label:"Bank of America",favicon:"https://www.bankofamerica.com/favicon.ico"},
  C:{label:"Citigroup",favicon:"https://www.citigroup.com/favicon.ico"},
  XOM:{label:"ExxonMobil",favicon:"https://corporate.exxonmobil.com/favicon.ico"},
  CVX:{label:"Chevron",favicon:"https://www.chevron.com/favicon.ico"},
};
const SYMBOL_COUNTRY:Readonly<Record<string,keyof typeof COUNTRY_IDENTITY>> = {
  USD:"US",US02Y:"US",US05Y:"US",US10Y:"US",US20Y:"US",US30Y:"US",UST:"US",SPX:"US",NDX:"US",DXY:"US",
  EUR:"EU",STOXX:"EU",BUND:"DE",DAX:"DE",GBP:"GB",FTSE:"GB",UK02Y:"GB",UK10Y:"GB",
  JPY:"JP",JGB:"JP",NIKKEI:"JP",CAD:"CA",CA02Y:"CA",TSX:"CA",
  AUD:"AU",AU02Y:"AU",ASX:"AU",NZD:"NZ",NZ02Y:"NZ",NZX:"NZ",
  CNY:"CN",CNH:"CN",HSI:"HK",KOSPI:"KR",
};
const COUNTRY_ALIAS:Readonly<Record<string,keyof typeof COUNTRY_IDENTITY>> = {
  "UNITED STATES":"US","USA":"US","EURO AREA":"EU","EUROZONE":"EU","EUROPEAN UNION":"EU",
  "UNITED KINGDOM":"GB","UK":"GB","GERMANY":"DE","JAPAN":"JP","CANADA":"CA",
  "AUSTRALIA":"AU","NEW ZEALAND":"NZ","CHINA":"CN","HONG KONG":"HK",
  "TAIWAN":"TW","SOUTH KOREA":"KR","INDIA":"IN","IRAN":"IR","SAUDI ARABIA":"SA",
  "RUSSIA":"RU","UKRAINE":"UA","ISRAEL":"IL","PAKISTAN":"PK","TURKEY":"TR","TÜRKIYE":"TR",
};
export function countryCode(input:string):keyof typeof COUNTRY_IDENTITY|null{
  const k=input.trim().toUpperCase();
  if(Object.prototype.hasOwnProperty.call(COUNTRY_IDENTITY,k)) return k as keyof typeof COUNTRY_IDENTITY;
  return COUNTRY_ALIAS[k]||null;
}
/** Returns null for unknown/basket/compound symbols instead of fabricating a
 * national or company identity (e.g. BRENT, USDJPY, AI, GOLD).
 */
export function identityForSymbol(symbol:string):EntityIdentity {
  const code=symbol.trim().toUpperCase();
  if(Object.prototype.hasOwnProperty.call(COMPANY_IDENTITY,code))return {kind:"company",id:code};
  const country=SYMBOL_COUNTRY[code];
  if(country)return {kind:"country",id:country,label:code};
  return {kind:"asset",id:code||"?",label:code||"Asset"};
}
export function identityForCountry(country:string):EntityIdentity {
  const code=countryCode(country);
  return code?{kind:"country",id:code}:{kind:"asset",id:"GLOBAL",label:country||"Global"};
}
export function identityForCalendar(kind:"economic"|"earnings",assets:readonly string[],sourceName:string):EntityIdentity{
  if(kind==="earnings"){
    const issuer=assets.map(a=>a.toUpperCase()).find(a=>Object.prototype.hasOwnProperty.call(COMPANY_IDENTITY,a));
    return issuer?{kind:"company",id:issuer}:assets.length?identityForSymbol(assets[0]):{kind:"asset",id:"EARNINGS",label:"Earnings"};
  }
  const fromSource=[
    ["Federal Reserve","US"],["Bureau of Labor Statistics","US"],["Bank of Japan","JP"],
    ["Bank of England","GB"],["European Central Bank","EU"],["Eurostat","EU"],
    ["Reserve Bank of Australia","AU"],["Reserve Bank of New Zealand","NZ"],
    ["Bank of Canada","CA"],["Statistics Canada","CA"],["Institute for Supply Management","US"],
  ] as const;
  const result=fromSource.find(([s])=>sourceName.toLowerCase().includes(s.toLowerCase()));
  if(result)return {kind:"country",id:result[1]};
  return assets.length?identityForSymbol(assets[0]):{kind:"asset",id:"GLOBAL",label:"Macro"};
}
export function publicIdentitySummary(entities:readonly EntityIdentity[],limit=5){
  const unique=new Set<string>();
  return entities.filter(e=>{const key=e.kind+":"+e.id;if(unique.has(key))return false;unique.add(key);return true}).slice(0,Math.max(0,Math.min(limit,8)));
}
