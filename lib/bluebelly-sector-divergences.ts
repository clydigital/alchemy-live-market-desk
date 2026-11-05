/**
 * Dated public editorial observations, not a live quote feed or an automated
 * evidence admission. Price returns are unadjusted US regular-session closes
 * from Longbridge daily OHLC, ending 4 November 2026.
 * Currency and date are explicit to avoid implying simultaneous Bursa/US tape.
 */
export const DIVERGENCE_US_SESSION = "4 November 2026 (US close)" as const;
export const DIVERGENCE_BURSA_SESSION = "5 November 2026 (MYT)" as const;
export const SECTOR_DIVERGENCES = [
  {
    etf: "XLY", name: "Consumer discretionary", oneDay: "+4.26%", fiveDay: "+6.07%", twentyDay: "+9.85%",
    leaders: "Booking +9.83%; Home Depot +6.53%",
    laggards: "Tesla −3.34%; Amazon only +2.35% over 20 sessions",
    context: "Amazon gained 6.12% on the day, but its two-fifths combined weighting with Tesla makes XLY a poor stand-in for household purchasing power. Home Depot gained 24.38% over 20 sessions, while Tesla rose just 1.95%.",
    nextTest: "Retail volumes, Home Depot demand, jobs data and Amazon's cloud cash conversion.",
    sourceName: "Amazon investor relations", sourceUrl: "https://ir.aboutamazon.com/quarterly-results/default.aspx",
  },
  {
    etf: "XLK", name: "Technology", oneDay: "−0.01%", fiveDay: "−7.59%", twentyDay: "−12.36%",
    leaders: "Microsoft +6.68%; Apple +5.31%",
    laggards: "Nvidia −3.17%; Micron −7.00%; Dell −8.82%",
    context: "Large platforms gained as chipmakers and server suppliers lagged. Over 20 sessions Microsoft rose 4.92% but Micron fell 26.91% and Dell 35.68%. Not every technology exposure listed here necessarily belongs to the present XLK holdings; these are notable related names.",
    nextTest: "New AI orders, memory prices, capex guidance and free cash flow rather than price weakness alone.",
    sourceName: "Micron investor results", sourceUrl: "https://investors.micron.com/financials/quarterly-results/default.aspx",
  },
  {
    etf: "XLP", name: "Consumer staples", oneDay: "+3.36%", fiveDay: "+5.87%", twentyDay: "+12.53%",
    leaders: "Dollar Tree +9.64%; Dollar General +8.52%",
    laggards: "Coca-Cola +1.05% on the day",
    context: "Discounters led established beverage brands. Dollar Tree rose 26.40% over 20 sessions; Coca-Cola rose 11.63%. That may reflect households trading down, but the retailer's prior results also benefited from tariff refunds.",
    nextTest: "Customer traffic, volumes and margins excluding one-off tariff refunds.",
    sourceName: "Dollar Tree financial releases", sourceUrl: "https://corporate.dollartree.com/news-media/press-releases/",
  },
  {
    etf: "XLRE", name: "Real estate", oneDay: "+3.32%", fiveDay: "+7.10%", twentyDay: "+11.22%",
    leaders: "American Tower +4.04%; Welltower +2.83%",
    laggards: "Digital Realty +2.44%; Equinix +2.16% over 20 sessions",
    context: "The sector is not just homebuilding. Digital Realty reported record annualised leasing and core FFO of $2.10 per share versus $1.89 a year earlier, yet its stock lagged XLRE by 8.78 percentage points over 20 sessions. It also issued roughly $2.9bn of shares year-to-date, making dilution part of the investment question.",
    nextTest: "Leases converting to paying rent, financing costs, equity issuance and per-share FFO.",
    sourceName: "Digital Realty Q3 2026", sourceUrl: "https://investor.digitalrealty.com/news-releases/news-release-details/digital-realty-reports-third-quarter-2026-results",
  },
  {
    etf: "XLE", name: "Energy", oneDay: "−4.74%", fiveDay: "−7.20%", twentyDay: "+0.25%",
    leaders: "Relative resilience: SLB −1.09%; Chevron −3.69%",
    laggards: "Marathon Petroleum −8.11%; ConocoPhillips −5.17%",
    context: "Crude's falling geopolitical premium can help fuel buyers while squeezing producers. The weaker refinery name is not automatically a bargain: margins depend on petrol and diesel selling prices, crude inputs and inventory accounting.",
    nextTest: "Brent and WTI, refined-product crack spreads, inventories and producer guidance.",
    sourceName: "EIA weekly petroleum status", sourceUrl: "https://www.eia.gov/petroleum/supply/weekly/",
  },
] as const;
export const SOLARVEST_RESEARCH = {
  ticker: "SLVEST", exchange: "Bursa Malaysia", code: "0215", currency: "MYR",
  fy26RevenueRmMillion: 757.1,
  fy26NetProfitRmMillion: 79.8,
  q1fy27RevenueRmMillion: 155.9,
  q1fy27NetProfitRmMillion: 19.0,
  unbilledOrderBookRmMillion: 2371,
  q1ReportUrl: "https://solarvest.com/solarvest-delivers-stronger-1qfy27-performance-with-20-yoy-growth-in-net-profit/",
  fullYearUrl: "https://solarvest.com/solarvest-marks-fourth-consecutive-record-breaking-year-with-54-yoy-net-profit-growth-to-rm80-million/",
} as const;
