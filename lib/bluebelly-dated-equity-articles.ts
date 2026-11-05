/* Source-derived, publicly authored dated editorial editions, 5 Nov 2026.
 * Frozen observations, not canonical Stories or live quotes. No private Notion
 * fetch at public render time. Solarvest FY2026 uses the July audited annual report RM758.9m;
 * the May preliminary issuer release reported RM757.1m.
 */
export type DatedEquityArticle = {
  id: string; title: string; ticker: string; category: string; summary: string;
  priceSession: string; edition: string; rank: number;
  sections: {heading: string; paragraphs: string[]}[];
  sources: {label: string; url: string}[];
};
export const DATED_EQUITY_ARTICLES: readonly DatedEquityArticle[] = [
  {
    "id": "xly-consumer",
    "title": "XLY Soared. Is the American Consumer Actually Back?",
    "ticker": "XLY",
    "category": "US CONSUMER · XLY",
    "summary": "A consumer ETF jumped even as Tesla fell. Amazon's cloud and cash flow complicate the recovery story.",
    "priceSession": "4 Nov 2026, US regular close",
    "edition": "5 November 2026",
    "sections": [
      {
        "heading": "",
        "paragraphs": [
          "The consumer-discretionary sector just had one of the strongest days on Wall Street. On Wednesday, 4 November, XLY rose 4.26% as stocks rebounded after the US midterm elections and crude prices plunged.",
          "That sounds like investors have suddenly rediscovered their confidence in American shoppers. There is a catch: the fund's biggest two investments are Amazon and Tesla, and they moved in opposite directions.",
          "Amazon jumped 6.12%. Tesla fell 3.34%. Both are consumer-discretionary companies by index classification, yet neither trades purely on whether households can afford another holiday or restaurant meal."
        ]
      },
      {
        "heading": "The Amazon problem with reading XLY",
        "paragraphs": [
          "Amazon makes up approximately 21.84% of XLY, according to the holdings snapshot available at Wednesday's close. Tesla accounts for another 18.41%. Together, these two companies represent roughly two-fifths of the fund.",
          "For Amazon, the current debate is arguably more about artificial intelligence than shopping baskets. Its latest reported quarter delivered $46.0 billion in AWS revenue, up 39% from a year earlier. AWS operating profit reached $17.8 billion. Meanwhile, Amazon's trailing twelve-month free cash flow swung to a $42.4 billion outflow, largely because of increased spending on AI infrastructure.",
          "That makes Wednesday's jump interesting. Investors may be reassessing the value of Amazon's existing cloud operations and the potential for slower future construction costs. But a recovery in its share price is not direct evidence that consumer demand accelerated overnight."
        ]
      },
      {
        "heading": "What about businesses closer to household spending?",
        "paragraphs": [
          "Home Depot gained approximately 6.53%, a much clearer expression of hopes that lower yields and borrowing costs will eventually help renovations and housing-related spending.",
          "Restaurants, travel and other retailers also matter, but their earnings drivers are different. A cheaper barrel of oil may free some household cash and reduce costs for transport and travel operators. It does not automatically improve wages, employment or consumers' willingness to borrow.",
          "The distinction matters because the market can rally on expectations of easier conditions long before the sales receipts improve."
        ]
      },
      {
        "heading": "What investors should watch",
        "paragraphs": [
          "A healthier XLY recovery would involve more than Amazon's share price. Retailers and travel companies need to show rising volumes or resilient margins, Home Depot needs sustained demand rather than only lower borrowing-cost expectations, and Tesla's weakness needs to stop working against the sector.",
          "Watch the next US labour and inflation releases, company guidance, and whether a broader selection of XLY holdings keeps up with the ETF. For now, Wednesday showed greater appetite for consumer-linked shares, not proof that the American consumer is back."
        ]
      },
      {
        "heading": "Which stocks have and have not caught up?",
        "paragraphs": [
          "Notable names, not exhaustive 50-constituent rankings. The XLY ETF rose 4.26% on 4 Nov; among selected large or liquid XLY names, Booking Holdings (BKNG) +9.83%, Lowe's (LOW) +7.50%, Home Depot (HD) +6.53%, McDonald's (MCD) +6.53%, and Amazon (AMZN) +6.12% outperformed while Tesla (TSLA) −3.34% went backwards. The gap is sharper over 20 trading sessions: HD +24.38%, MCD +21.37% versus AMZN +2.35%, TSLA +1.95%, XLY +9.85%. AMZN is thus a one-day winner but a 20-session relative laggard. Why: AWS growth is real, but company-wide free-cash-flow cost and portfolio concentration matter. Do not infer a full consumer spending recovery from XLY."
        ]
      }
    ],
    "sources": [
      {
        "label": "XLY 4 Nov closing history",
        "url": "https://finance.yahoo.com/quote/XLY/history/"
      },
      {
        "label": "XLY holdings",
        "url": "https://www.schwab.wallst.com/schwab/Prospect/research/etfs/schwabETF/index.asp?symbol=XLY&type=holdings"
      },
      {
        "label": "Amazon original Q3 release",
        "url": "https://ir.aboutamazon.com/news-release/news-release-details/2026/Amazon-com-Announces-Third-Quarter-Results/"
      },
      {
        "label": "AMZN 4 Nov close",
        "url": "https://stockanalysis.com/stocks/amzn/history/"
      },
      {
        "label": "TSLA 4 Nov close",
        "url": "https://stockanalysis.com/stocks/tsla/history/"
      },
      {
        "label": "HD 4 Nov close",
        "url": "https://www.financecharts.com/stocks/HD/summary/price"
      },
      {
        "label": "Reuters 4 Nov post-election close",
        "url": "https://www.reuters.com/business/us-stock-index-futures-steady-democrats-seize-congress-2026-11-04/"
      }
    ],
    "rank": 1
  },
  {
    "id": "xlre-property",
    "title": "Real Estate Jumped. But This Is Not Just a Housing Rally.",
    "ticker": "XLRE",
    "category": "US PROPERTY · XLRE",
    "summary": "Higher property shares do not equal more home sales. Senior living, warehouses and data centres run on different economics.",
    "priceSession": "4 Nov 2026, US regular close",
    "edition": "5 November 2026",
    "sections": [
      {
        "heading": "",
        "paragraphs": [
          "Wall Street's real-estate sector rose 3.32% on Wednesday, 4 November, as Treasury yields eased and investors returned to interest-rate-sensitive shares. But the XLRE rally should not be mistaken for a recovery in home sales.",
          "The fund's biggest holdings are not companies building new houses. They include Welltower, a senior-housing landlord; Prologis, a warehouse owner; and Equinix, a data-centre operator.",
          "The market is effectively paying more for several very different kinds of rent."
        ]
      },
      {
        "heading": "Three property businesses, three explanations",
        "paragraphs": [
          "Welltower is the biggest XLRE holding, at approximately 11.5% in the close-of-day holdings snapshot. Its third-quarter results explain why it is not simply a mortgage-rate trade. Normalised funds from operations — a common measure of REIT earnings — rose 24.6% per share to $1.67. Operating income from comparable senior-housing properties increased 21%.",
          "That growth is being driven partly by occupancy and revenue per occupied room, not first-time homebuyers.",
          "Ventas provides another senior-living example. It reported $0.99 in normalised FFO per share, up 10% year on year, with comparable senior-housing cash property income up 16%. Ageing-population demand can support this segment even while ordinary residential sales are struggling.",
          "Prologis answers a different question: are businesses still renting warehouse space? Its third quarter showed 95.1% average occupancy and 5.9% growth in same-store cash net operating income. E-commerce, manufacturing and supply chains matter more to its tenants than mortgage approvals."
        ]
      },
      {
        "heading": "There is an AI business hiding inside XLRE",
        "paragraphs": [
          "Equinix owns and operates data-centre and interconnection facilities. Its third-quarter revenue rose 11% to $2.571 billion, and it raised 2026 guidance. It expects total annual capital spending of around $5–6 billion.",
          "This is an important exception to the idea that all data-centre exposure should trade alike. An established landlord with paying customers, existing facilities and recurring contracts faces different risks from a younger operator trying to finance large new campuses."
        ]
      },
      {
        "heading": "Lower yields help, but do not solve every problem",
        "paragraphs": [
          "REITs can benefit when bond yields decline, because borrowing costs and the value investors place on future rental cash flows may improve. Wednesday's rally fits that explanation, although one trading session cannot prove it.",
          "Welltower and Ventas still need acquisition returns to justify expansion. Prologis needs sustained leasing demand. Equinix must earn acceptable returns on expensive new capacity. Debt maturities, occupancy and financing terms can overwhelm a favourable rate move.",
          "For REITs, FFO and adjusted FFO are useful operating measures, not interchangeable with cash left after every investment. The key question is whether the rents and operating cash produced by new assets justify the capital tied up.",
          "A stronger XLRE trend would be one accompanied by improving occupancy, cash rents and financing conditions — not merely one good day for the sector ETF."
        ]
      },
      {
        "heading": "Which stocks have and have not caught up?",
        "paragraphs": [
          "XLRE climbed 11.22% over 20 trading sessions. Within selected property names, senior-housing Welltower (WELL) +12.15% and towers American Tower (AMT) +17.26% led, while Digital Realty (DLR) +2.44%, Equinix (EQIX) +2.16% and Prologis (PLD) +3.19% lagged the ETF by approximately 8.8, 9.1 and 8.0 percentage points respectively. All were higher on 4 November itself; \"laggard\" here refers to the 20-session relative performance, not a negative day.",
          "Especially relevant DLR contradiction: [Q3 original](https://digitalrealtytrust.gcs-web.com/news-releases/news-release-details/digital-realty-reports-third-quarter-2026-results) reported core FFO/share $2.10 versus $1.89 a year earlier, record bookings at its share worth $627m in annualised rent, yet the shares trailed XLRE. The countercase is financing and dilution: year-to-date ATM issuance was approximately 15.9m shares for $2.9bn of net proceeds. This is a genuine fundamental research candidate, not proof of undervaluation. Examine development yields, new leases turning into cash and per-share FFO after equity issuance. Source: Longbridge regular-session candles through 4 Nov, 20-session unadjusted price returns. Full screen: ."
        ]
      }
    ],
    "sources": [
      {
        "label": "XLRE 4 Nov close",
        "url": "https://finance.yahoo.com/quote/XLRE/history/"
      },
      {
        "label": "XLRE holdings, close-of-day 4 Nov",
        "url": "https://www.schwab.wallst.com/schwab/Prospect/research/etfs/schwabETF/index.asp?symbol=XLRE&type=holdings"
      },
      {
        "label": "Welltower Q3 original release, 26 Oct",
        "url": "https://welltower.com/investors/press-release-details/?id=811"
      },
      {
        "label": "Ventas Q3 original SEC exhibit, 27 Oct",
        "url": "https://www.sec.gov/Archives/edgar/data/740260/000074026026000026/q32026earningsrelease.htm"
      },
      {
        "label": "Prologis Q3 original release, 15 Oct",
        "url": "https://ir.prologis.com/news-events/press-releases/detail/1055/prologis-reports-third-quarter-2026-results"
      },
      {
        "label": "Equinix Q3 original release, 28 Oct",
        "url": "https://investor.equinix.com/news-events/press-releases/detail/1128/equinix-reports-third-quarter-results-and-raises-2026"
      }
    ],
    "rank": 2
  },
  {
    "id": "xle-crude",
    "title": "Oil Collapsed. Why Did Energy Stocks Get Hit So Hard?",
    "ticker": "XLE",
    "category": "ENERGY · XLE",
    "summary": "Crude's geopolitical premium fell. Refiners, producers and oilfield services do not all respond in the same way.",
    "priceSession": "4 Nov 2026, US regular close",
    "edition": "5 November 2026",
    "sections": [
      {
        "heading": "",
        "paragraphs": [
          "Oil prices suffered an extraordinary reversal on Wednesday, 4 November. Brent crude settled 8.7% lower at $94.62 a barrel, while US West Texas Intermediate fell 8.3% to $88.12.",
          "Energy shares moved with them. The XLE sector ETF lost 4.74% even as the S&P 500 rallied. ExxonMobil fell around 4.62%, Chevron 3.69%, and ConocoPhillips 5.17%.",
          "That is the other side of a market celebrating cheaper fuel."
        ]
      },
      {
        "heading": "Why an election could move oil",
        "paragraphs": [
          "Following the US midterm result, investors began pricing a greater possibility of diplomacy around the Iran conflict and less prolonged disruption to Middle Eastern oil supplies.",
          "That does not mean an agreement has been signed or that tankers can now move without risk. What changed was the market's assessment of future danger.",
          "Oil contains a geopolitical risk premium when traders fear supplies could be interrupted. If that fear diminishes, prices can fall before a single additional barrel reaches the market.",
          "It is also why the move can reverse sharply: a fresh strike, shipping disruption or failed negotiation could restore part of that premium."
        ]
      },
      {
        "heading": "Why XLE followed oil down",
        "paragraphs": [
          "XLE is heavily concentrated in large producers. ExxonMobil and Chevron together make up approximately 42.6% of the fund in the 4 November holdings snapshot. That concentration means falling oil-price expectations have a significant impact on the ETF.",
          "Producers earn less per barrel when selling prices fall, all else equal. Their production costs and existing development commitments do not disappear overnight. A lower realised oil price can squeeze future operating cash, reduce the cushion available for dividends and buybacks, and make some new drilling less attractive.",
          "Not every energy company works that way.",
          "Refiners such as Marathon Petroleum and Valero care about the gap between crude input costs and refined-product selling prices — the refining margin, or crack spread. That margin can improve or deteriorate independently of the headline crude benchmark.",
          "Oilfield-services companies such as SLB and Halliburton depend more heavily on customers' drilling and project budgets. Those budgets usually move more slowly than spot crude, although sustained lower prices can eventually force cuts."
        ]
      },
      {
        "heading": "Good for consumers, bad for all energy shares?",
        "paragraphs": [
          "Not necessarily. Cheaper crude can reduce fuel and freight costs and ease some inflation pressure, potentially supporting airlines, retailers and property-sensitive shares. But it can also signal weaker demand; a falling price is not always good economic news.",
          "For energy investors, the important distinction is whether prices dropped because supply risk improved or because oil consumption weakened. Wednesday's reporting points primarily to changing geopolitical expectations, but that remains an interpretation to test.",
          "Watch independently confirmed diplomatic developments, Strait of Hormuz shipping conditions, EIA inventory and production data, and the relationship between Brent, diesel/petrol margins and energy-company earnings forecasts.",
          "A one-day collapse in the oil risk premium is not the same as the end of the oil shock."
        ]
      },
      {
        "heading": "Which stocks have and have not caught up?",
        "paragraphs": [
          "XLE fell 4.74% on 4 Nov. Among notable energy names, Marathon Petroleum (MPC) −8.11%, ConocoPhillips (COP) −5.17%, Occidental (OXY) −5.13%, ExxonMobil (XOM) −4.62% were weaker; Chevron (CVX) −3.69% and SLB −1.09% were relatively resilient, though still down. Not an exhaustive sector constituent ranking.",
          "Across 20 sessions the contrast reverses: SLB +7.51%, CVX +5.76%, XOM +3.18%, while MPC −11.21% versus XLE +0.25%. Lower crude is not automatically good for a refiner: processing margins depend on petrol/diesel selling prices versus input crude and inventory timing. This calls for actual dated product crack spreads, refinery utilisation and issuer guidance before concluding MPC is a catch-up buy. Price source: Longbridge as of US 4 Nov close, unadjusted 20-session price returns."
        ]
      }
    ],
    "sources": [
      {
        "label": "Brent/WTI settlement and market explanation, 5 Nov report describing 4 Nov session",
        "url": "https://www.moneycontrol.com/news/business/markets/crude-oil-prices-fall-for-fourth-straight-day-after-9-crash-brent-slips-below-95-wti-near-87-14070894.html"
      },
      {
        "label": "Reuters — 4 Nov US markets/election/oil selloff",
        "url": "https://www.reuters.com/business/us-stock-index-futures-steady-democrats-seize-congress-2026-11-04/"
      },
      {
        "label": "XLE 4 Nov historical close",
        "url": "https://finance.yahoo.com/quote/XLE/history/"
      },
      {
        "label": "XLE holdings at 4 Nov close",
        "url": "https://www.schwab.wallst.com/schwab/Prospect/research/etfs/schwabETF/index.asp?symbol=XLE&type=holdings"
      },
      {
        "label": "MarketWatch 4 Nov XOM/CVX/COP closing performance",
        "url": "https://www.marketwatch.com/data-news/exxonmobil-holdings-corp-stock-underperforms-wednesday-when-compared-to-competitors-567eb0bb-75d8b4fd318b"
      }
    ],
    "rank": 3
  },
  {
    "id": "ai-builders",
    "title": "Big Tech Rebounded. Its Data-Centre Builders Did Not.",
    "ticker": "XLK",
    "category": "AI INFRASTRUCTURE · TECHNOLOGY",
    "summary": "Why established technology platforms rallied as some of the companies financing new AI capacity sold off.",
    "priceSession": "4 Nov 2026, US regular close",
    "edition": "5 November 2026",
    "sections": [
      {
        "heading": "",
        "paragraphs": [
          "Amazon rose 6.12% on Wednesday. Microsoft gained around 6.68%. Yet CoreWeave, a specialist AI cloud provider, fell 9.90%.",
          "It looked contradictory. Investors bought some of the companies spending most heavily on artificial intelligence while selling others that make money by building and renting out computing capacity.",
          "The split says something important about the current AI trade: owning an existing profitable computing business is not the same financial proposition as financing a new one."
        ]
      },
      {
        "heading": "Why the election changed the debate",
        "paragraphs": [
          "After Democrats won control of both chambers of Congress, investors began weighing greater scrutiny of data-centre development, particularly where local voters are concerned about electricity and water use.",
          "That may sound negative for all AI companies. But some investors see a possible benefit for established firms: if new campuses are delayed, existing capacity could become scarcer and pressure to keep adding expensive new buildings might ease.",
          "That is a market interpretation, not evidence that a nationwide ban has been enacted. State permits, local rules and actual corporate construction decisions will determine what changes."
        ]
      },
      {
        "heading": "Amazon shows the attraction — and the cost",
        "paragraphs": [
          "Amazon's latest reported quarter illustrates the financial trade-off. AWS revenue rose 39% to $46.0 billion, with AWS operating profit of $17.8 billion.",
          "Demand for its cloud services looks strong. But investment is consuming cash. Amazon's company-wide trailing twelve-month free cash flow was an outflow of $42.4 billion, compared with an inflow of $14.8 billion a year earlier, mainly because of increased AI infrastructure spending.",
          "A slower build-out could improve free cash flow if existing capacity remains busy and cloud revenue keeps growing. It could also constrain growth or hand customers to rivals. That is the important fork, not whether Amazon's share price had a good day."
        ]
      },
      {
        "heading": "CoreWeave faces a different test",
        "paragraphs": [
          "CoreWeave is growing quickly, but its financing economics are tougher. In the second quarter of 2026, it reported $2.575 billion of revenue and an approximately $626 million net loss. Net interest expense was $640 million for the quarter.",
          "Its reported backlog reached about $104 billion at 30 June, a powerful indication of contracted demand. But backlog is not the same as cash received today: capacity still has to be delivered, customers served and the financing paid for.",
          "That gap matters especially if political or construction delays push out when a new data centre can start earning revenue while interest costs continue.",
          "There are exceptions. Equinix, an established data-centre landlord, reported 11% revenue growth in its latest quarter and raised its outlook. This is not simply an argument that all infrastructure is bad and all software platforms are good."
        ]
      },
      {
        "heading": "The next verdict will come from earnings",
        "paragraphs": [
          "CoreWeave is scheduled to report its third-quarter results on 10 November at 5:00 p.m. ET. Watch operating losses, net interest expense, available funding, delivered capacity and how much of its backlog is turning into revenue.",
          "For Amazon, follow the balance between AWS growth, capital expenditure and free cash flow. For the industry, look for actual changes in permits and customer orders, not election-night speculation.",
          "AI demand can remain real while the economics of paying for its infrastructure deteriorate. That is the risk Wednesday's market split exposed."
        ]
      },
      {
        "heading": "Which stocks have and have not caught up?",
        "paragraphs": [
          "XLK was almost flat at −0.01% on 4 Nov. Selected technology winners were Microsoft +6.68%, Apple +5.31%, Arista +5.04%; laggards included Nvidia −3.17%, Micron −7.00%, Dell −8.82%. Over 20 sessions Microsoft +4.92% diverged from XLK −12.36%, while Nvidia −15.72%, Micron −26.91% and Dell −35.68% lost ground. Verify current fund membership before describing a listed name as an XLK constituent; these are notable technology exposures, not a complete ETF ranking.",
          "Cross-sector extension (do not mislabel these as XLK holdings): Quanta Services (PWR) −11.65%, Vertiv (VRT) −12.89%, Vistra (VST) −13.83% and CoreWeave (CRWV) −9.90% on 4 Nov, despite AMZN +6.12% and MSFT +6.68%. This is cloud-customer-versus-infrastructure-finance divergence, not verified evidence of cancelled AI contracts. Deep-dive candidate: [Micron FQ4 original](https://investors.micron.com/news/press-release/2026/Micron-Technology-Inc--Reports-Record-Fiscal-Fourth-Quarter-and-Full-Year-2026-Results/default.aspx) showed record FQ4 revenue and cash generation despite price weakness; investigate guidance revisions, HBM demand, valuation and capital cycle before calling it a bargain. Prices: Longbridge closes through 4 Nov, unadjusted 20-session changes."
        ]
      }
    ],
    "sources": [
      {
        "label": "Reuters 4 Nov market close — Big Tech rise versus AI infrastructure falls",
        "url": "https://www.reuters.com/business/us-stock-index-futures-steady-democrats-seize-congress-2026-11-04/"
      },
      {
        "label": "AMZN 4 Nov price close",
        "url": "https://stockanalysis.com/stocks/amzn/history/"
      },
      {
        "label": "CRWV 4 Nov price close",
        "url": "https://www.marketbeat.com/stocks/NASDAQ/CRWV/news/"
      },
      {
        "label": "MSFT 4 Nov move",
        "url": "https://ticker-brief.com/roundups/2026-11-04"
      },
      {
        "label": "Amazon original Q3 release",
        "url": "https://ir.aboutamazon.com/news-release/news-release-details/2026/Amazon-com-Announces-Third-Quarter-Results/"
      },
      {
        "label": "CoreWeave original Q2 release",
        "url": "https://investors.coreweave.com/news/news-details/2026/CoreWeave-Reports-Strong-Second-Quarter-2026-Results/default.aspx"
      },
      {
        "label": "CoreWeave issuer-confirmed Q3 call date",
        "url": "https://investors.coreweave.com/news/news-details/2026/CoreWeave-Announces-Date-of-Third-Quarter-2026-Financial-Results-and-Conference-Call/default.aspx"
      },
      {
        "label": "Equinix original Q3 release",
        "url": "https://investor.equinix.com/news-events/press-releases/detail/1128/equinix-reports-third-quarter-results-and-raises-2026"
      }
    ],
    "rank": 4
  },
  {
    "id": "solarvest-peers",
    "title": "Solarvest Has Doubled. Why Hasn't Every Solar Stock Followed?",
    "ticker": "SLVEST",
    "category": "MALAYSIA · SOLAR / CLEAN ENERGY",
    "summary": "Solarvest's contract and earnings growth stands out. The harder question is whether rivals can turn orders into cash.",
    "priceSession": "Malaysia 5 Nov 2026; US equities 4 Nov 2026",
    "edition": "5 November 2026",
    "sections": [
      {
        "heading": "",
        "paragraphs": [
          "Solarvest Holdings has turned Malaysia's renewable-energy construction boom into something shareholders can measure. Its audited revenue rose about 41% to RM758.9 million in the financial year to March 2026, while net profit grew 54% to RM80 million. The earlier 20 May preliminary release gave revenue of RM757.1 million; the July annual report is the later audited basis.",
          "The shares have rewarded that progress. At RM4.02 on 5 November, Solarvest is more than twice its 52-week low of RM1.82, although it is already around 12% below the 52-week high.",
          "But the interesting question is not whether clean energy is popular. It is why investors are willing to pay so much for some companies while others with improving earnings remain less celebrated."
        ]
      },
      {
        "heading": "The contracts have substance",
        "paragraphs": [
          "Solarvest has an RM2.37 billion unbilled engineering-and-construction order book — more than three times its last full-year revenue, although these are future contracts, not cash already received. The company expects much of that work to be recognised across FY2027 and FY2028.",
          "It also has agreements covering 135 megawatts-peak of corporate solar capacity, which management expects could eventually generate around RM54 million in annual recurring revenue once the projects are completed.",
          "A partnership with Brookfield offers additional scale and funding support. RAM Ratings reaffirmed an AA3/Stable rating on the applicable sukuk tranches in October, citing execution capability and the order pipeline.",
          "There is a catch. Trading at roughly 47 times trailing earnings in an indicative 5 November sector snapshot, Solarvest is already priced for continued growth."
        ]
      },
      {
        "heading": "Two Malaysian rivals deserve attention",
        "paragraphs": [
          "Samaiden Group nearly doubled net profit in its latest full financial year, reaching RM39 million. Revenue, however, rose only about 3%. That is an intriguing improvement in profitability, but investors still need to establish how much comes from sustainable margins and how much from project timing and mix.",
          "Pekat Group is another useful comparison. Its June-quarter revenue increased about 38% and attributable profit rose about 29%. Its operations span solar construction and electrical infrastructure, including work connected with data centres.",
          "Neither is obviously a bargain: both were trading at about 43–44 times trailing earnings in the same indicative sector snapshot.",
          "Cypark is a different sort of candidate. It returned to a quarterly profit of around RM5.7 million after a loss in the prior-year period, but that single profitable quarter does not resolve its wider execution and financing risks. A low share price is not necessarily a low valuation."
        ]
      },
      {
        "heading": "In America, the solar split is even sharper",
        "paragraphs": [
          "Utility-scale equipment suppliers have enjoyed a strong rebound. Nextpower/NXT gained 11% on 4 November; its latest quarter delivered $1.1 billion of revenue and more than $6 billion of backlog.",
          "ARRAY Technologies jumped nearly 15% on the same day after unveiling a combination with Shoals, despite cutting its current-year revenue guidance. That is partly a merger and synergy trade, not pure solar demand.",
          "Residential solar looks less convincing. Enphase rose about 4% on 4 November but remained down almost 6% over twenty trading sessions. The company said US residential sell-through was 35% lower than a year earlier. SolarEdge also trailed, despite narrowing losses in its last reported quarter."
        ]
      },
      {
        "heading": "What could decide the next winner?",
        "paragraphs": [
          "Malaysia's Corporate Renewable Energy Supply Scheme illustrates the risk. Solar shares surged when lower grid-access charges were announced in September, but retreated when the effective charge was clarified at 18 sen per kilowatt-hour in October.",
          "A contract is valuable only if the customer can still afford to buy the electricity, the contractor can deliver profitably, and financing costs do not consume the returns.",
          "For Solarvest, Samaiden and Pekat, the next tests are signed projects, order conversion, operating cash and sustainable margins. For US suppliers, watch installations, backlog deliveries and balance-sheet strength.",
          "The divergence is not solar versus fossil fuels. It is businesses converting clean-energy demand into profitable cash flow versus businesses still waiting for that conversion."
        ]
      }
    ],
    "sources": [
      {
        "label": "Solarvest FY2026 audited annual report (July 2026)",
        "url": "https://solarvest.com/investor-relations/investor-centre/"
      },
      {
        "label": "Solarvest 1QFY27 issuer report",
        "url": "https://solarvest.com/solarvest-delivers-stronger-1qfy27-performance-with-20-yoy-growth-in-net-profit/"
      },
      {
        "label": "RAM Ratings Solarvest AA3/Stable assessment",
        "url": "https://www.ram.com.my/pressrelease/?prviewid=7457"
      },
      {
        "label": "Solarvest market closing and historical range",
        "url": "https://www.investing.com/equities/solarvest-holdings-bhd-historical-data"
      },
      {
        "label": "Samaiden FY26 filed numbers",
        "url": "https://www.klsescreener.com/v2/stock/financial-report/0223/2026-06-30"
      },
      {
        "label": "Pekat Q2 filed numbers",
        "url": "https://www.klsescreener.com/v2/stock/financial-report/0233/2026-06-30"
      },
      {
        "label": "Nextpower/NXT official quarter",
        "url": "https://investors.nextracker.com/news/news-details/2026/Nextpower-Reports-Q2-Fiscal-Year-2027-Financial-Results/default.aspx"
      },
      {
        "label": "Array Q3 and merger announcement",
        "url": "https://ir.arraytechinc.com/news-releases/news-release-details/array-technologies-and-shoals-technologies-group-announce"
      },
      {
        "label": "Enphase Q3",
        "url": "https://newsroom.enphase.com/news-releases/news-release-details/enphase-energy-reports-financial-results-third-quarter-2026"
      },
      {
        "label": "SolarEdge Q2",
        "url": "https://solaredge.gcs-web.com/news-releases/news-release-details/solaredge-announces-second-quarter-2026-financial-results"
      },
      {
        "label": "October CRESS cost clarification",
        "url": "https://www.thestar.com.my/business/business-news/2026/10/15/cress-viability-intact"
      }
    ],
    "rank": 0
  }
];
const DATED_EQUITY_ARTICLE_IDS = new Set(DATED_EQUITY_ARTICLES.map(a => a.id));
export function getDatedEquityArticle(id: string | undefined): DatedEquityArticle | null {
  if (!id || !DATED_EQUITY_ARTICLE_IDS.has(id)) return null;
  return DATED_EQUITY_ARTICLES.find(a => a.id === id) ?? null;
}
