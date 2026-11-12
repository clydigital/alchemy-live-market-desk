/** Shared, public, editorial *identity* universe for Bluebelly stock monitoring.
 * No private Power Stack holdings or user membership. Listings are explicit:
 * ADRs are US listings, not interchangeable with local European ordinary shares.
 * An identity is not proof of a fresh price, thesis or tradable instrument.
 */
export type StockRegion="US"|"EU";
export type StockPriority="CORE"|"SECONDARY";
export type StockIdentity={
 ticker:string; company:string; region:StockRegion; exchange:string;
 currency:"USD"|"EUR"|"DKK"; timeZone:string; priority:StockPriority;
 theme:"AI"|"ENERGY"|"HEALTH"|"NUCLEAR"|"INDUSTRIAL"|"CONSUMER"|"LUXURY";
 providerSymbol:string; monitorId:string;
};
const us=(
 ticker:string,company:string,theme:StockIdentity["theme"],priority:StockPriority="CORE",
):StockIdentity=>({ticker,company,region:"US",exchange:"US-listed (Nasdaq/NYSE; venue verification required)",
 currency:"USD",timeZone:"America/New_York",priority,theme,providerSymbol:ticker,
 monitorId:ticker==="SPCX"?"spcx":"us-stock-"+ticker.toLowerCase()});
const eu=(
 ticker:string,company:string,exchange:string,currency:"EUR"|"DKK",timeZone:string,
 theme:StockIdentity["theme"],priority:StockPriority="CORE",
):StockIdentity=>({ticker,company,region:"EU",exchange,currency,timeZone,
 priority,theme,providerSymbol:ticker,monitorId:"eu-stock-"+ticker.toLowerCase().replace(/[^a-z0-9]/g,"-")});
export const BLUEBELLY_STOCK_UNIVERSE:readonly StockIdentity[]=Object.freeze([
 us("NVDA","Nvidia","AI"),us("AMD","AMD","AI"),us("AAPL","Apple","CONSUMER"),
 us("MSFT","Microsoft","AI"),us("AMZN","Amazon","AI"),us("GOOGL","Alphabet","AI"),
 us("META","Meta","AI"),us("TSLA","Tesla","INDUSTRIAL"),
 us("AVGO","Broadcom","AI"),us("MU","Micron","AI"),us("ORCL","Oracle","AI"),
 us("CRWV","CoreWeave","AI"),us("SPCX","SpaceX Class A","AI"),
 us("ADBE","Adobe","AI"),us("CI","Cigna","HEALTH"),us("CVS","CVS Health","HEALTH"),
 us("CF","CF Industries","INDUSTRIAL"),us("XOM","ExxonMobil","ENERGY"),
 us("CVX","Chevron","ENERGY"),us("GRAB","Grab","CONSUMER"),
 us("BWXT","BWX Technologies","NUCLEAR"),us("OKLO","Oklo","NUCLEAR"),
 us("SMR","NuScale Power","NUCLEAR"),us("PWR","Quanta Services","INDUSTRIAL"),
 us("ENPH","Enphase Energy","INDUSTRIAL"),
 eu("ASML.AS","ASML","Euronext Amsterdam","EUR","Europe/Amsterdam","AI"),
 eu("ADYEN.AS","Adyen","Euronext Amsterdam","EUR","Europe/Amsterdam","AI","SECONDARY"),
 eu("SAP.DE","SAP","Xetra","EUR","Europe/Berlin","AI"),
 eu("SIE.DE","Siemens","Xetra","EUR","Europe/Berlin","INDUSTRIAL"),
 eu("RHM.DE","Rheinmetall","Xetra","EUR","Europe/Berlin","INDUSTRIAL"),
 eu("IFX.DE","Infineon Technologies","Xetra","EUR","Europe/Berlin","AI"),
 eu("AIR.PA","Airbus","Euronext Paris","EUR","Europe/Paris","INDUSTRIAL"),
 eu("TTE.PA","TotalEnergies","Euronext Paris","EUR","Europe/Paris","ENERGY"),
 eu("MC.PA","LVMH","Euronext Paris","EUR","Europe/Paris","LUXURY"),
 eu("SU.PA","Schneider Electric","Euronext Paris","EUR","Europe/Paris","INDUSTRIAL"),
 eu("OR.PA","L’Oreal","Euronext Paris","EUR","Europe/Paris","CONSUMER","SECONDARY"),
 eu("NOVO-B.CO","Novo Nordisk B","Nasdaq Copenhagen","DKK","Europe/Copenhagen","HEALTH"),
]);
export function findStockIdentity(ticker:string):StockIdentity|undefined{
 return BLUEBELLY_STOCK_UNIVERSE.find(x=>x.ticker===ticker.toUpperCase());
}
export function stockUniverseCoverage(){
 const byRegion={US:0,EU:0};
 for(const x of BLUEBELLY_STOCK_UNIVERSE)byRegion[x.region]++;
 return {total:BLUEBELLY_STOCK_UNIVERSE.length,byRegion};
}
/** Names currently missing from the preexisting MAG7/base Nasdaq monitor.
 * Existing monitored tickers retain their original source/benchmark identities.
 */
export const ADDITIONAL_US_STOCKS:readonly StockIdentity[]=BLUEBELLY_STOCK_UNIVERSE.filter(x=>
 x.region==="US"&&!["NVDA","AMD","AAPL","MSFT","AMZN","GOOGL","META","TSLA",
 "AVGO","MU","ORCL","CRWV","SPCX"].includes(x.ticker));
export const EUROPE_STOCKS:readonly StockIdentity[]=BLUEBELLY_STOCK_UNIVERSE.filter(x=>x.region==="EU");
