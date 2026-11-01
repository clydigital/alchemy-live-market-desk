import "server-only";
import type { PublicMarketObservation } from "./blue-desk-public-markets";

/**
 * Neutral, immutable public symbol catalogue, not a Power Stack owner feed.
 * Derived from existing publicly discussed equity/ETF research; padded with
 * broad indexes/sector ETFs. No account identity, holdings, weights, scores,
 * investment decisions, membership dates, owner notes or broker data.
 *
 * This catalogue stays available after private Power Stack GitHub Pages
 * publishing is retired. Quotes come ONLY from the independently dated
 * existing Bluebelly market monitor; unmatched symbols show unavailable.
 */
const PUBLIC_RESEARCH_UNIVERSE: ReadonlyArray<{ticker:string;name:string}> = [
  {
    "ticker": "3191.HK",
    "name": "Global X China Semiconductor ETF"
  },
  {
    "ticker": "3308.HK",
    "name": "Zhongji Innolight"
  },
  {
    "ticker": "6742UW",
    "name": "YTL Power structured warrant / linked instrument"
  },
  {
    "ticker": "6809.HK",
    "name": "Montage Technology"
  },
  {
    "ticker": "688825",
    "name": "CXMT"
  },
  {
    "ticker": "9988.HK",
    "name": "Alibaba Group"
  },
  {
    "ticker": "AEM",
    "name": "Agnico Eagle Mines"
  },
  {
    "ticker": "ARKK",
    "name": "ARK Innovation ETF"
  },
  {
    "ticker": "AVGO",
    "name": "Broadcom"
  },
  {
    "ticker": "BG",
    "name": "Bunge Global"
  },
  {
    "ticker": "BKR",
    "name": "Baker Hughes"
  },
  {
    "ticker": "BTC",
    "name": "Bitcoin"
  },
  {
    "ticker": "BWXT",
    "name": "BWX Technologies"
  },
  {
    "ticker": "CCJ",
    "name": "Cameco"
  },
  {
    "ticker": "CEG",
    "name": "Constellation Energy"
  },
  {
    "ticker": "CF",
    "name": "CF Industries"
  },
  {
    "ticker": "COIN",
    "name": "Coinbase Global"
  },
  {
    "ticker": "CRDO",
    "name": "Credo Technology"
  },
  {
    "ticker": "CRM",
    "name": "Salesforce"
  },
  {
    "ticker": "CRWD",
    "name": "CrowdStrike"
  },
  {
    "ticker": "CTVA",
    "name": "Corteva"
  },
  {
    "ticker": "DAYANG",
    "name": "Dayang Enterprise Holdings Berhad"
  },
  {
    "ticker": "DELL",
    "name": "Dell Technologies"
  },
  {
    "ticker": "DIA",
    "name": "SPDR Dow Jones ETF"
  },
  {
    "ticker": "ETN",
    "name": "Eaton"
  },
  {
    "ticker": "FCFS",
    "name": "FirstCash Holdings"
  },
  {
    "ticker": "FCX",
    "name": "Freeport-McMoRan"
  },
  {
    "ticker": "FLEX",
    "name": "Flex"
  },
  {
    "ticker": "GDX",
    "name": "VanEck Gold Miners ETF"
  },
  {
    "ticker": "GEV",
    "name": "GE Vernova"
  },
  {
    "ticker": "GLD",
    "name": "SPDR Gold Shares"
  },
  {
    "ticker": "GLDM",
    "name": "SPDR Gold MiniShares"
  },
  {
    "ticker": "GRAB",
    "name": "Grab Holdings"
  },
  {
    "ticker": "HIBISCS",
    "name": "Hibiscus Petroleum Berhad"
  },
  {
    "ticker": "HYG",
    "name": "iShares iBoxx High Yield Corporate Bond ETF"
  },
  {
    "ticker": "IEF",
    "name": "iShares 7-10 Year Treasury Bond ETF"
  },
  {
    "ticker": "IGV",
    "name": "iShares Expanded Tech Software ETF"
  },
  {
    "ticker": "IWM",
    "name": "iShares Russell 2000 ETF"
  },
  {
    "ticker": "LNG",
    "name": "Cheniere Energy"
  },
  {
    "ticker": "LQD",
    "name": "iShares iBoxx Investment Grade Corporate Bond ETF"
  },
  {
    "ticker": "MISC",
    "name": "MISC Berhad"
  },
  {
    "ticker": "MNHLDG",
    "name": "MN Holdings"
  },
  {
    "ticker": "MPC",
    "name": "Marathon Petroleum"
  },
  {
    "ticker": "MSTR",
    "name": "Strategy"
  },
  {
    "ticker": "MU",
    "name": "Micron Technology"
  },
  {
    "ticker": "NTR",
    "name": "Nutrien"
  },
  {
    "ticker": "NVT",
    "name": "nVent Electric"
  },
  {
    "ticker": "PSX",
    "name": "Phillips 66"
  },
  {
    "ticker": "PWR",
    "name": "Quanta Services"
  },
  {
    "ticker": "QQQ",
    "name": "Invesco Nasdaq 100 ETF"
  },
  {
    "ticker": "RSP",
    "name": "Invesco S&P 500 Equal Weight ETF"
  },
  {
    "ticker": "SGOV",
    "name": "iShares 0-3 Month Treasury Bond ETF"
  },
  {
    "ticker": "SLB",
    "name": "SLB"
  },
  {
    "ticker": "SMH",
    "name": "VanEck Semiconductor ETF"
  },
  {
    "ticker": "SMR",
    "name": "NuScale Power"
  },
  {
    "ticker": "SOXX",
    "name": "iShares Semiconductor ETF"
  },
  {
    "ticker": "SPY",
    "name": "SPDR S&P 500 ETF"
  },
  {
    "ticker": "STNG",
    "name": "Scorpio Tankers"
  },
  {
    "ticker": "SYM",
    "name": "Symbotic"
  },
  {
    "ticker": "TENAGA",
    "name": "Tenaga Nasional"
  },
  {
    "ticker": "TLT",
    "name": "iShares 20+ Year Treasury Bond ETF"
  },
  {
    "ticker": "TSLA",
    "name": "Tesla"
  },
  {
    "ticker": "TTWO",
    "name": "Take-Two Interactive Software"
  },
  {
    "ticker": "VGIT",
    "name": "Vanguard Intermediate-Term Treasury ETF"
  },
  {
    "ticker": "VGT",
    "name": "Vanguard Information Technology ETF"
  },
  {
    "ticker": "VLO",
    "name": "Valero Energy"
  },
  {
    "ticker": "VMI",
    "name": "Valmont Industries"
  },
  {
    "ticker": "VST",
    "name": "Vistra"
  },
  {
    "ticker": "VYX",
    "name": "NCR Voyix"
  },
  {
    "ticker": "WPM",
    "name": "Wheaton Precious Metals"
  },
  {
    "ticker": "XBI",
    "name": "SPDR S&P Biotech ETF"
  },
  {
    "ticker": "XLB",
    "name": "Materials Select Sector SPDR"
  },
  {
    "ticker": "XLC",
    "name": "Communication Services Select Sector SPDR"
  },
  {
    "ticker": "XLE",
    "name": "Energy Select Sector SPDR"
  },
  {
    "ticker": "XLF",
    "name": "Financial Select Sector SPDR"
  },
  {
    "ticker": "XLI",
    "name": "Industrial Select Sector SPDR"
  },
  {
    "ticker": "XLK",
    "name": "Technology Select Sector SPDR"
  },
  {
    "ticker": "XLP",
    "name": "Consumer Staples Select Sector SPDR"
  },
  {
    "ticker": "XLRE",
    "name": "Real Estate Select Sector SPDR"
  },
  {
    "ticker": "XLU",
    "name": "Utilities Select Sector SPDR"
  },
  {
    "ticker": "XLV",
    "name": "Health Care Select Sector SPDR"
  },
  {
    "ticker": "XLY",
    "name": "Consumer Discretionary Select Sector SPDR"
  },
  {
    "ticker": "XOM",
    "name": "ExxonMobil"
  },
  {
    "ticker": "YTLPOWR",
    "name": "YTL Power International Berhad"
  }
];

export type PowerStackResearchAsset = {
  ticker: string;
  name: string;
  role: "research";
  asOf: null;
};

export async function getPowerStackResearchAssets(): Promise<{
  items: PowerStackResearchAsset[];
  status: "available";
  tapeStatus: "unavailable";
}> {
  return {
    items: PUBLIC_RESEARCH_UNIVERSE.map(asset=>({
      ticker:asset.ticker,name:asset.name,role:"research" as const,asOf:null,
    })),
    status:"available",
    tapeStatus:"unavailable",
  };
}

/** Public registry membership does NOT encode actual owner positions. */
export function mergePowerStackMarketSearch(
  observations: readonly PublicMarketObservation[],
  assets: readonly PowerStackResearchAsset[],
): PublicMarketObservation[] {
  const byTicker = new Map(assets.map(asset=>[asset.ticker,asset]));
  const matched = new Set<string>();
  const rows = observations.map(row=>{
    const asset=byTicker.get(row.symbol.toUpperCase());
    if(!asset)return row;
    matched.add(asset.ticker);
    return {...row,researchRole:"research" as const,researchAsOf:null};
  });
  for(const asset of assets) {
    if(matched.has(asset.ticker))continue;
    rows.push({
      id:"research:"+asset.ticker,label:asset.name,symbol:asset.ticker,
      type:"Power Stack",last:null,change:null,change3d:null,change5d:null,
      changeUnit:"%",asOf:null,frequency:"daily",
      sourceName:"Public symbol catalogue · market quote unavailable",
      sourceUrl:null,researchRole:"research",researchAsOf:null,
      dataStatus:"UNAVAILABLE_OR_STALE",
    });
  }
  return rows;
}
