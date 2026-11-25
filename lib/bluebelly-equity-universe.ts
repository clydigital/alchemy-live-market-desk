/** Shared, public, editorial *identity* universe for Bluebelly stock monitoring.
 * No private Power Stack holdings or user membership. Listings are explicit:
 * ADRs are US listings, not interchangeable with local European ordinary shares.
 * An identity is not proof of a fresh price, thesis or tradable instrument.
 */
export type StockRegion="US"|"EU"|"ASIA";
export type StockPriority="CORE"|"SECONDARY";
export type StockIdentity={
 ticker:string; company:string; region:StockRegion; exchange:string;
 currency:"USD"|"EUR"|"DKK"|"MYR"|"KRW"|"TWD"|"HKD"|"CNY"; timeZone:string; priority:StockPriority;
 theme:"AI"|"ENERGY"|"HEALTH"|"NUCLEAR"|"INDUSTRIAL"|"CONSUMER"|"LUXURY"|"REAL_ESTATE";
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
const asia=(ticker:string,company:string,exchange:string,currency:StockIdentity["currency"],timeZone:string,theme:StockIdentity["theme"]):StockIdentity=>({ticker,company,region:"ASIA",exchange,currency,timeZone,priority:"SECONDARY",theme,providerSymbol:ticker,monitorId:"asia-stock-"+ticker.toLowerCase().replace(/[^a-z0-9]/g,"-")});
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
 us("MAA","Mid-America Apartment Communities","REAL_ESTATE"),
 us("TOL","Toll Brothers","REAL_ESTATE"),
 us("PHM","PulteGroup","REAL_ESTATE"),
 us("INVH","Invitation Homes","REAL_ESTATE"),
 us("ESS","Essex Property Trust","REAL_ESTATE"),
 us("CPT","Camden Property Trust","REAL_ESTATE"),
 us("AMH","AMH","REAL_ESTATE","SECONDARY"),
 us("NVR","NVR","REAL_ESTATE","SECONDARY"),
 us("JLL","Jones Lang LaSalle","REAL_ESTATE","SECONDARY"),
 us("CBRE","CBRE Group","REAL_ESTATE","SECONDARY"),
 us("RKT","Rocket Companies","REAL_ESTATE","SECONDARY"),
 us("O","Realty Income","REAL_ESTATE","SECONDARY"),
 us("GRBK","Green Brick Partners","REAL_ESTATE","SECONDARY"),
 us("EXR","Extra Space Storage","REAL_ESTATE","SECONDARY"),
 us("PLD","Prologis","REAL_ESTATE","SECONDARY"),
 us("DHI","D.R. Horton","REAL_ESTATE","SECONDARY"),
 us("LEN","Lennar","REAL_ESTATE","SECONDARY"),
 us("SDHC","Smith Douglas Homes","REAL_ESTATE","SECONDARY"),
 us("OPEN","Opendoor","REAL_ESTATE","SECONDARY"),
 us("FNF","Fidelity National Financial","REAL_ESTATE","SECONDARY"),
 us("FAF","First American Financial","REAL_ESTATE","SECONDARY"),
 us("ELS","Equity LifeStyle Properties","REAL_ESTATE","SECONDARY"),
 us("SUI","Sun Communities","REAL_ESTATE","SECONDARY"),
 us("AVB","AvalonBay Communities","REAL_ESTATE","SECONDARY"),
 us("EQR","Equity Residential","REAL_ESTATE","SECONDARY"),
 us("WELL","Welltower","REAL_ESTATE","SECONDARY"),
 us("VICI","VICI Properties","REAL_ESTATE","SECONDARY"),
 us("DLR","Digital Realty","REAL_ESTATE","SECONDARY"),
 us("EQIX","Equinix","REAL_ESTATE","SECONDARY"),
 us("DELL","Dell Technologies","AI","SECONDARY"),
 us("ADI","Analog Devices","AI","SECONDARY"),
 us("SNDK","SanDisk","AI","SECONDARY"),
 us("HPE","Hewlett Packard Enterprise","AI","SECONDARY"),
 us("AMBA","Ambarella","AI","SECONDARY"),
 us("TSM","Taiwan Semiconductor ADR","AI","SECONDARY"),
 us("NBIS","Nebius","AI","SECONDARY"),
 us("WDAY","Workday","AI","SECONDARY"),
 us("CRM","Salesforce","AI","SECONDARY"),
 us("CRDO","Credo Technology","AI","SECONDARY"),
 us("FLEX","Flex","AI","SECONDARY"),
 us("VYX","NCR Voyix","AI","SECONDARY"),
 us("SYM","Symbotic","AI","SECONDARY"),
 us("PANW","Palo Alto Networks","AI","SECONDARY"),
 us("CHKP","Check Point","AI","SECONDARY"),
 us("CRWD","CrowdStrike","AI","SECONDARY"),
 us("POWL","Powell Industries","INDUSTRIAL","SECONDARY"),
 us("ETN","Eaton","INDUSTRIAL","SECONDARY"),
 us("VRT","Vertiv","INDUSTRIAL","SECONDARY"),
 us("GEV","GE Vernova","INDUSTRIAL","SECONDARY"),
 us("NVT","nVent","INDUSTRIAL","SECONDARY"),
 us("MWA","Mueller Water Products","INDUSTRIAL","SECONDARY"),
 us("XYL","Xylem","INDUSTRIAL","SECONDARY"),
 us("TT","Trane Technologies","INDUSTRIAL","SECONDARY"),
 us("MOD","Modine","INDUSTRIAL","SECONDARY"),
 us("BE","Bloom Energy","INDUSTRIAL","SECONDARY"),
 us("NUE","Nucor","INDUSTRIAL","SECONDARY"),
 us("STLD","Steel Dynamics","INDUSTRIAL","SECONDARY"),
 us("FCX","Freeport-McMoRan","INDUSTRIAL","SECONDARY"),
 us("SCCO","Southern Copper","INDUSTRIAL","SECONDARY"),
 us("MOS","Mosaic","INDUSTRIAL","SECONDARY"),
 us("LDOS","Leidos","INDUSTRIAL","SECONDARY"),
 us("CTVA","Corteva","INDUSTRIAL","SECONDARY"),
 us("NTR","Nutrien","INDUSTRIAL","SECONDARY"),
 us("VMI","Valmont Industries","INDUSTRIAL","SECONDARY"),
 us("BG","Bunge","INDUSTRIAL","SECONDARY"),
 us("DAL","Delta Air Lines","INDUSTRIAL","SECONDARY"),
 us("DHT","DHT Holdings","ENERGY","SECONDARY"),
 us("FRO","Frontline","ENERGY","SECONDARY"),
 us("CMBT","CMB.TECH","ENERGY","SECONDARY"),
 us("INSW","International Seaways","ENERGY","SECONDARY"),
 us("LNG","Cheniere Energy","ENERGY","SECONDARY"),
 us("STNG","Scorpio Tankers","ENERGY","SECONDARY"),
 us("BKR","Baker Hughes","ENERGY","SECONDARY"),
 us("SLB","SLB","ENERGY","SECONDARY"),
 us("VLO","Valero","ENERGY","SECONDARY"),
 us("MPC","Marathon Petroleum","ENERGY","SECONDARY"),
 us("PSX","Phillips 66","ENERGY","SECONDARY"),
 us("JNJ","Johnson & Johnson","HEALTH","SECONDARY"),
 us("ABBV","AbbVie","HEALTH","SECONDARY"),
 us("TTWO","Take-Two Interactive","CONSUMER","SECONDARY"),
 us("ICE","Intercontinental Exchange","CONSUMER","SECONDARY"),
 us("CME","CME Group","CONSUMER","SECONDARY"),
 us("CBOE","Cboe Global Markets","CONSUMER","SECONDARY"),
 us("BLK","BlackRock","CONSUMER","SECONDARY"),
 us("AXP","American Express","CONSUMER","SECONDARY"),
 us("FCFS","FirstCash","CONSUMER","SECONDARY"),
 us("COIN","Coinbase","CONSUMER","SECONDARY"),
 us("MSTR","Strategy","CONSUMER","SECONDARY"),
 us("AEM","Agnico Eagle Mines","CONSUMER","SECONDARY"),
 us("WPM","Wheaton Precious Metals","CONSUMER","SECONDARY"),
 us("CEG","Constellation Energy","NUCLEAR","SECONDARY"),
 us("VST","Vistra","NUCLEAR","SECONDARY"),
 us("CCJ","Cameco","NUCLEAR","SECONDARY"),
 asia("000660.KS","SK Hynix","Korea Exchange","KRW","Asia/Seoul","AI"),
 asia("005930.KS","Samsung Electronics","Korea Exchange","KRW","Asia/Seoul","AI"),
 asia("009540.KS","HD Korea Shipbuilding & Offshore Engineering","Korea Exchange","KRW","Asia/Seoul","INDUSTRIAL"),
 asia("010140.KS","Samsung Heavy Industries","Korea Exchange","KRW","Asia/Seoul","INDUSTRIAL"),
 asia("042660.KS","Hanwha Ocean","Korea Exchange","KRW","Asia/Seoul","INDUSTRIAL"),
 asia("8299.TWO","Phison Electronics","Taipei Exchange","TWD","Asia/Taipei","AI"),
 asia("0245.KL","MN Holdings","Bursa Malaysia","MYR","Asia/Kuala_Lumpur","INDUSTRIAL"),
 asia("0310.KL","UUE Holdings","Bursa Malaysia","MYR","Asia/Kuala_Lumpur","INDUSTRIAL"),
 asia("0296.KL","HE Group","Bursa Malaysia","MYR","Asia/Kuala_Lumpur","INDUSTRIAL"),
 asia("5398.KL","Gamuda","Bursa Malaysia","MYR","Asia/Kuala_Lumpur","INDUSTRIAL"),
 asia("5347.KL","Tenaga Nasional","Bursa Malaysia","MYR","Asia/Kuala_Lumpur","INDUSTRIAL"),
 asia("3816.KL","MISC","Bursa Malaysia","MYR","Asia/Kuala_Lumpur","ENERGY"),
 asia("5199.KL","Hibiscus Petroleum","Bursa Malaysia","MYR","Asia/Kuala_Lumpur","ENERGY"),
 asia("6742.KL","YTL Power","Bursa Malaysia","MYR","Asia/Kuala_Lumpur","INDUSTRIAL"),
 asia("5141.KL","Dayang Enterprise","Bursa Malaysia","MYR","Asia/Kuala_Lumpur","ENERGY"),
 asia("9988.HK","Alibaba Group","Hong Kong Stock Exchange","HKD","Asia/Hong_Kong","AI"),
 asia("6809.HK","Montage Technology","Hong Kong Stock Exchange","HKD","Asia/Hong_Kong","AI"),
 asia("3308.HK","Zhongji Innolight","Hong Kong Stock Exchange","HKD","Asia/Hong_Kong","AI"),
 asia("688825.SS","CXMT","Shanghai STAR Market","CNY","Asia/Shanghai","AI"),
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
 const byRegion={US:0,EU:0,ASIA:0};
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

export const ASIA_STOCKS:readonly StockIdentity[]=BLUEBELLY_STOCK_UNIVERSE.filter(x=>x.region==="ASIA");
