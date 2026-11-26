import type {NewsroomEditorialItem} from "./bluebelly-newsroom-editorial.ts";

// Frozen, owner-approved editorial synopsis of the 27 Nov package. Source dates remain distinct from the edition date. Not a live quote feed or canonical Motion.
type Entry={id:string;market:string;title:string;date:string;source:string;urls:readonly (readonly [string,string])[];topics:NewsroomEditorialItem["topics"];stats:readonly (readonly [string,string])[];summary:string;why:string;bull:string;bear:string;view:string;levels:string;test:string};
export const NOV27_EDITORIAL:readonly Entry[]=[
  {
    "id": "australia",
    "market": "AUDUSD",
    "title": "Australia's AI Boom Meets an Inflation Problem",
    "date": "2026-11-26",
    "source": "Australian Bureau of Statistics",
    "urls": [
      [
        "ABS September capex",
        "https://www.abs.gov.au/statistics/economy/business-indicators/private-new-capital-expenditure-and-expected-expenditure-australia/sep-2026"
      ],
      [
        "ABS October CPI",
        "https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/consumer-price-index-australia/oct-2026"
      ]
    ],
    "topics": [
      "fx",
      "policy",
      "ai"
    ],
    "stats": [
      [
        "+12.2%",
        "Q3 private capex q/q"
      ],
      [
        "+18.6%",
        "Q3 private capex y/y"
      ],
      [
        "4.9%",
        "October annual CPI"
      ]
    ],
    "summary": "Private investment jumped as inflation accelerated. Can domestic rate expectations overcome global risk aversion?",
    "why": "Data-centre equipment contributed to investment growth, but the total capex figure is not AI-only. Imported equipment limits immediate domestic value creation. Persistent inflation can support Australian yields and AUD, yet weak global demand can offset that effect.",
    "bull": "Investment broadens into domestic employment and Australian rate expectations rise relative to US rates.",
    "bear": "Weak commodity demand or a stronger dollar overwhelms domestic strength.",
    "view": "Domestic data favour AUD conditionally; look for relative yield and FX confirmation.",
    "levels": "26 Nov indicative ECB-derived cross rate 0.6635; editorial tests 0.6560 and 0.6700–0.6715.",
    "test": "Australia–US yield differential, domestic investment and China demand."
  },
  {
    "id": "ai-debt",
    "market": "US100",
    "title": "Central Banks Warn of Growing AI Debt Risks",
    "date": "2026-11-26",
    "source": "Bank of England",
    "urls": [
      [
        "November Financial Stability Report",
        "https://www.bankofengland.co.uk/financial-stability-report/2026/november-2026"
      ]
    ],
    "topics": [
      "ai",
      "bonds",
      "earnings"
    ],
    "stats": [
      [
        "$305bn+",
        "Projected 2026 hyperscaler bond issuance"
      ],
      [
        "~8%",
        "Share of global investment-grade issuance"
      ]
    ],
    "summary": "The Bank of England warns that AI financing is increasing links across credit and equity markets.",
    "why": "Debt can finance new capacity and near-term orders. But expensive infrastructure needs paying customers and reliable cash generation. The issuance projection is not a measure of outstanding AI debt or evidence that lenders have stopped financing projects.",
    "bull": "Cash generation catches up with spending and lenders continue to fund viable projects.",
    "bear": "Borrowing costs rise and projects are delayed, putting supplier earnings under pressure.",
    "view": "A relief rally is possible; credit and cash conversion must confirm it.",
    "levels": "25 Nov Nasdaq-100 cash close 26,046.90; editorial tests 24,970 and 26,080–26,435.",
    "test": "Issuer free cash flow, credit spreads, financing costs and semiconductor leadership."
  },
  {
    "id": "ai-valuations",
    "market": "US100",
    "title": "Are AI Stocks Finally Becoming Cheap?",
    "date": "2026-11-24",
    "source": "Dell Technologies · issuer guidance",
    "urls": [
      [
        "Dell FY27 guidance",
        "https://investors.delltechnologies.com/sec-filings/all-sec-filings/content/0001571996-26-000050/exhibit991earnings8kq3fy27.htm"
      ],
      [
        "Sandisk Q1 FY27",
        "https://investor.sandisk.com/news-releases/news-release-details/sandisk-reports-fiscal-first-quarter-2027-financial-results"
      ],
      [
        "Micron FY26 results",
        "https://investors.micron.com/news/press-release/2026/Micron-Technology-Inc--Reports-Record-Fiscal-Fourth-Quarter-and-Full-Year-2026-Results/default.aspx"
      ],
      [
        "Nvidia Q3 FY27",
        "https://investor.nvidia.com/news/press-release-details/2026/NVIDIA-Announces-Financial-Results-for-Third-Quarter-Fiscal-2027/default.aspx"
      ]
    ],
    "topics": [
      "ai",
      "earnings"
    ],
    "stats": [
      [
        "$55–57",
        "Sandisk quarterly adjusted EPS guidance, pre-split"
      ],
      [
        "$38.15",
        "Micron quarterly adjusted EPS guidance midpoint"
      ],
      [
        "$29.68",
        "Dell FY27 adjusted EPS guidance"
      ],
      [
        "~4.2%",
        "Nvidia 13-week-equivalent sequential revenue growth"
      ]
    ],
    "summary": "Strong hardware earnings guidance can make valuations look unusually low, but a cyclical earnings peak can distort multiples.",
    "why": "Annualising a single quarter assumes extraordinary earnings persist. At an unchanged price, a 50% earnings decline doubles the implied P/E; a 75% decline quadruples it. Nvidia's $130bn revenue guidance includes an extra week: scaling to 13 weeks gives about $120.7bn versus $115.8bn in Q3, assuming even weekly revenue. Guidance is not realised earnings.",
    "bull": "Paid demand, earnings estimates and cash conversion remain resilient as semiconductor leadership returns.",
    "bear": "Memory prices and margins deteriorate faster than expected, turning apparent bargains into peak-earnings traps.",
    "view": "Selective valuation opportunities are plausible; distinguish quarterly run rates from full-year guidance and sustainable cash earnings.",
    "levels": "25 Nov Nasdaq-100 cash close 26,046.90; editorial tests 24,970 and 26,080–26,435.",
    "test": "Split-adjusted prices, revised earnings, memory supply and actual cash conversion."
  },
  {
    "id": "us-growth",
    "market": "US500",
    "title": "Strong US Growth Hides a Profitability Challenge",
    "date": "2026-11-25",
    "source": "US Bureau of Economic Analysis",
    "urls": [
      [
        "Q3 GDP and corporate profits",
        "https://www.bea.gov/news/2026/gdp-second-estimate-and-corporate-profits-3rd-quarter-2026/"
      ],
      [
        "Fed November Beige Book",
        "https://www.federalreserve.gov/monetarypolicy/beigebook202611-summary.htm"
      ]
    ],
    "topics": [
      "earnings",
      "policy"
    ],
    "stats": [
      [
        "4.3%",
        "Q3 annualised real GDP"
      ],
      [
        "$206bn",
        "Q3 increase in corporate profits"
      ],
      [
        "$384bn",
        "Q2 increase in corporate profits"
      ]
    ],
    "summary": "Economic output grew strongly while the increase in economy-wide corporate profits slowed.",
    "why": "Aggregate profits still increased; the smaller increment is not proof of falling S&P 500 earnings or measured index margins. Strong demand can coexist with higher costs, weaker pricing power and pressure on individual companies.",
    "bull": "Resilient demand supports earnings and rotation into reasonably valued sectors.",
    "bear": "Costs and weaker pricing power trigger earnings downgrades despite healthy GDP.",
    "view": "Growth argues against an immediate recession conclusion, but margins remain a risk.",
    "levels": "25 Nov S&P 500 cash close 7,182.78; session range 6,970.11–7,199.31. Editorial tests 6,970–7,000 and 7,200.",
    "test": "Holiday sales volumes versus discounts, profit margins, earnings revisions and equal-weight breadth."
  },
  {
    "id": "copper",
    "market": "Copper",
    "title": "Copper's Rebound Faces a China Profit Test",
    "date": "2026-10-28",
    "source": "China National Bureau of Statistics",
    "urls": [
      [
        "Jan–Sep industrial profits",
        "https://www.stats.gov.cn/english/PressRelease/202610/t20261028_1965704.html"
      ],
      [
        "Official 2026 release calendar",
        "https://www.stats.gov.cn/english/PressRelease/ReleaseCalendar/202512/t20251226_1962154.html"
      ]
    ],
    "topics": [
      "fx",
      "earnings"
    ],
    "stats": [
      [
        "+15.5%",
        "Jan–Sep industrial profits y/y"
      ],
      [
        "+103.8%",
        "Electronics profits"
      ],
      [
        "−5.9%",
        "Electrical machinery profits"
      ],
      [
        "−22.8%",
        "Automotive profits"
      ]
    ],
    "summary": "PREVIEW · The 27 November industrial profits report tests whether China's recovery extends beyond electronics.",
    "why": "Copper demand spans power grids, vehicles, electronics and traditional industry. Higher profits at producers can reflect selling prices rather than metal consumption. A broader downstream recovery would be more persuasive than another gain concentrated in a few sectors.",
    "bull": "Electrical equipment and other downstream sectors improve while physical demand indicators strengthen.",
    "bear": "Manufacturing weakness persists and dollar strength or weak physical demand stalls the rebound.",
    "view": "Selective recovery, not yet a broad industrial boom. This is a frozen pre-release analysis; no October profit actual is claimed.",
    "levels": "26 Nov delayed December COMEX range $5.3450–$5.4665/lb; editorial tests $5.32 and $5.47–$5.65. Not a continuous CFD quote.",
    "test": "Official Jan–Oct profit breakdown, production, inventories and copper's subsequent reaction."
  },
  {
    "id": "oil",
    "market": "UKOIL",
    "title": "Oil Traders Brace for OPEC+'s Weekend Decision",
    "date": "2026-11-01",
    "source": "OPEC",
    "urls": [
      [
        "1 November OPEC+ statement",
        "https://www.opec.org/pr-detail/620-1-november-2026.html"
      ],
      [
        "IEA November outlook",
        "https://www.iea.org/reports/oil-market-report-november-2026"
      ]
    ],
    "topics": [
      "energy"
    ],
    "stats": [
      [
        "29 Nov",
        "Scheduled OPEC+ meeting"
      ],
      [
        "Q4 2026",
        "IEA projected return to surplus"
      ],
      [
        "December",
        "September required output maintained under 1 Nov decision"
      ]
    ],
    "summary": "PREVIEW · The weekend meeting tests supply restraint against a projected surplus and continuing disruption risk.",
    "why": "An expected surplus may raise inventories and pressure prices, but actual physical disruption can offset that balance. Announced targets also differ from actual production and compliance.",
    "bull": "Continued or additional restraint and physical disruption support prices.",
    "bear": "More barrels or weak compliance strengthen the surplus case.",
    "view": "Be cautious on sustained rallies; the announcement and actual supply matter more than a weekend forecast.",
    "levels": "26 Nov FT Brent contract snapshot $94.39, range $94.29–$96.20; not the ICE settlement or broker CFD. Editorial tests $91–92 and $96.20–100.",
    "test": "Official decision, compliance, physical flows and the next liquid session."
  },
  {
    "id": "yen",
    "market": "USDJPY",
    "title": "The Yen Faces Its Next Inflation Test",
    "date": "2026-11-26",
    "source": "Bank of Japan",
    "urls": [
      [
        "Tamura 26 November speech",
        "https://www.boj.or.jp/en/about/press/koen_2026/ko261126a.htm"
      ],
      [
        "Tamura June policy speech",
        "https://www.boj.or.jp/en/about/press/koen_2026/ko260625a.htm"
      ],
      [
        "Tokyo CPI release calendar",
        "https://www.stat.go.jp/english/data/cpi/1582.htm"
      ]
    ],
    "topics": [
      "fx",
      "policy",
      "bonds"
    ],
    "stats": [
      [
        "~2%",
        "Tamura's personal neutral-rate estimate (June speech)"
      ],
      [
        "27 Nov",
        "Scheduled Tokyo CPI"
      ],
      [
        "158.66–159.51",
        "25 Nov observed USDJPY range"
      ]
    ],
    "summary": "PREVIEW · Tokyo inflation may alter Japanese rate expectations and the economics of yen-funded positions.",
    "why": "Higher Japanese rates or yen appreciation can reduce the returns on positions financed in yen. Investors may buy yen to reduce borrowing, potentially pressuring risk assets. This is a transmission mechanism, not evidence of a current global unwind. US yields also determine the relative return.",
    "bull": "Stronger Tokyo inflation and rising Japanese yields coincide with softer US yields, strengthening the yen.",
    "bear": "Soft inflation or resilient US yields keep USDJPY elevated.",
    "view": "Yen strength needs confirmation from the yield differential and cross-market behaviour. No November CPI result is claimed.",
    "levels": "26 Nov indicative historical USDJPY near 159.27 in one FX series; 158.65 and 159.50–160 are editorial tests, not intervention thresholds.",
    "test": "Tokyo CPI, US–Japan yield differential, yen strength and leveraged risk assets."
  },
  {
    "id": "euro-credit",
    "market": "EURUSD",
    "title": "Eurozone Business Lending Defies Tighter Credit",
    "date": "2026-11-26",
    "source": "European Central Bank",
    "urls": [
      [
        "October monetary developments",
        "https://www.ecb.europa.eu/press/stats/md/html/ecb.md2610~4bad1d63b5.en.html"
      ],
      [
        "October bank lending survey",
        "https://www.ecb.europa.eu/press/pr/date/2026/html/ecb.pr261027~506ef03145.en.html"
      ]
    ],
    "topics": [
      "fx",
      "bonds",
      "policy"
    ],
    "stats": [
      [
        "4.5%",
        "October corporate loan-stock growth"
      ],
      [
        "4.3%",
        "September revised corporate loan-stock growth"
      ],
      [
        "3.1%",
        "October household loan-stock growth"
      ]
    ],
    "summary": "Corporate loan growth accelerated while the wider adjusted private-sector loan growth rate slowed.",
    "why": "More outstanding credit can finance investment or refinancing; loan-stock growth alone does not distinguish the two. Tighter credit standards complicate a simple recovery thesis.",
    "bull": "New lending funds expansion and euro-area activity strengthens relative to the US.",
    "bear": "Refinancing pressure or weaker real activity undermines the euro.",
    "view": "Loan growth is a constructive signal, not proof of a broad demand recovery.",
    "levels": "26 Nov ECB-derived EURUSD reference 1.0975; editorial tests 1.0880 and 1.1000–1.1160.",
    "test": "Loan purpose, credit standards, real activity and ECB–Fed yield expectations."
  }
];
export function nov27NewsroomEditorial(now:Date,href:string):NewsroomEditorialItem[]{
 const t=+now;
 if(!Number.isFinite(t)||t<Date.parse("2026-11-26T21:39:00Z")||t>=Date.parse("2026-12-04T00:00:00Z"))return [];
 return NOV27_EDITORIAL.map(e=>({id:"nov27-editorial:"+e.id,headline:e.title,summary:e.summary,occurredAt:e.date,editorialUpdatedAt:"2026-11-26T21:39:00Z",sourceName:e.source,sourceUrl:e.urls[0][1],readerHref:href+"#"+e.id,topics:e.topics,verificationLabel:"DATED 27 NOV EDITORIAL · "+(["copper","yen","oil"].includes(e.id)?"FROZEN PREVIEW":"SOURCE-LINKED ANALYSIS"),why:e.why,nextTest:e.test,kind:"reported"}));
}
