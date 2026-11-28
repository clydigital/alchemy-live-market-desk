/** Public issuer research navigation only. No scraping, ingestion, API, or proprietary data republication. */
export const GEKKO_STOCKS_HUB="https://www.gekko.app/stocks";
export function gekkoStockResearchUrl(ticker:string,region:string):string|null{
 const symbol=ticker.trim().toUpperCase();
 if(region!=="US"||!/^[A-Z]{1,5}$/.test(symbol))return null;
 return GEKKO_STOCKS_HUB+"/"+symbol.toLowerCase();
}
export const GEKKO_RESEARCH_CHECKS=["GekkoIndex zone and recent change","Proprietary fair value versus dated price","Insider purchases and institutional disclosures","Unusual options activity and short-interest context when available","Earnings revisions, earnings dates and seasonality"] as const;
