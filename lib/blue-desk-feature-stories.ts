/** Public, manually researched editorial features: never canonical System 2 Story evidence.
 * Frozen as-of 27 Oct 2026; must not render as live observations.
 * All material figures carry original source URLs with dates and instrument scope.
 */
export type FeatureSource={label:string;date:string;url:string;kind:"primary"|"reporting"|"analysis"};
export type FeatureScene={title:string;time:string;paragraphs:string[];sourceIds:number[];lesson?:{question:string;answer:string;counter:string;check:string}};
export type FeatureResearch={name:string;question:string;tests:string[];contradiction:string};
export type FeatureStory={
 slug:"asia-equities"|"global-bonds";title:string;deck:string;tagline:string;asOf:string;
 thesis:string;confidence:string;
 facts:{label:string;value:string;detail:string;sourceIds:number[]}[];
 scenes:FeatureScene[];comparison?:{heading:string;columns:string[];rows:string[][]};
 scenarios:{name:string;condition:string;outcome:string;against:string}[];
 manual:FeatureResearch[];sources:FeatureSource[];
};
export const featureStories:Record<FeatureStory["slug"],FeatureStory>={
 "asia-equities":{
  slug:"asia-equities",title:"Asia's AI Trade Is Splitting in Two",
  deck:"China is still selling technology shares while Korea rebounds, Taiwan hangs on, and Japan rises with a weaker yen. The question is who can turn AI spending into real earnings.",
  tagline:"ASIA MARKETS · INDEPENDENT EDITORIAL RESEARCH",asOf:"27 October 2026 · Asian market closes; individual data dates specified",
  thesis:"The region is repricing AI profit expectations rather than responding to one uniform Asia shock. China is the sharpest warning; Taiwan's realised earnings are the strongest immediate counterexample.",
  confidence:"Working interpretation · medium, not a canonical Dossier verdict",
  facts:[
   {label:"Shanghai Composite",value:"−1.33%",detail:"27 Oct 2026 daily close",sourceIds:[0]},
   {label:"KOSPI",value:"+3.09%",detail:"27 Oct daily close; does not erase earlier drawdown",sourceIds:[0]},
   {label:"Taiwan TAIEX",value:"+0.12%",detail:"27 Oct close; TSMC led late recovery",sourceIds:[1]},
   {label:"Nikkei 225",value:"+1.73%",detail:"27 Oct close; yen weakened on session",sourceIds:[0,5]}
  ],
  scenes:[
   {title:"Act 1 — The rally that became too expensive",time:"26 October · Reuters analysis of preceding months",
    paragraphs:[
     "China's STAR50, packed with semiconductor and AI-related companies, had fallen roughly 40% in under four months. Reuters estimated that about US$480 billion in market value had been erased. China's broad blue-chip index was also down roughly 20% from its June high.",
     "Investors had priced in enormous AI opportunities. But when profits, export access and future demand looked less certain, they began paying less for the same earnings. Falling valuation multiples can hurt a market before reported corporate profits decline."
    ],sourceIds:[2],
    lesson:{question:"How can stocks crash while businesses are still growing?",
     answer:"Imagine a company earning 10 a year. At 40 times earnings it is worth 400; at 25 times, it is worth 250 even if profits have not fallen. The missing piece is the price investors are willing to pay for future growth.",
     counter:"If forward profits accelerate enough, earnings can catch up to the valuation and support the shares.",
     check:"Compare forward P/E, analyst estimate revisions, index breadth and actual reported cash flows."}},
   {title:"Act 2 — China's good industrial number meets a bad tape",time:"27 October · mainland and Hong Kong session",
    paragraphs:[
     "Industrial profits grew 14.4% year-on-year in September, yet investors continued selling technology shares. On 27 October the Shanghai Composite lost about 1.3% and the STAR50 fell about 4.8%. A strong aggregate industrial number could not settle doubts about individual AI-company margins.",
     "This is the divergence to investigate. A broad profit statistic covers far more than the companies driving the index's recent boom. Capital-intensive AI infrastructure also requires cash today while earnings may arrive years later. US export restrictions and funding costs add uncertainty; neither should be asserted as the proven cause of one daily fall.",
     "Hong Kong participated in the China-tech weakness. The Hang Seng fell about 0.7%, but Hong Kong is not the same basket as the mainland STAR market: internet platforms, property exposure, mainland earnings and international capital flows matter."
    ],sourceIds:[0,2,3]},
   {title:"Act 3 — Korea's rebound is a test, not a pardon",time:"27 October · GDP release and market close",
    paragraphs:[
     "South Korea's third-quarter GDP expanded 1.0% quarter-on-quarter and 3.4% year-on-year. The KOSPI gained 3.09% as chip stocks rallied. After the preceding correction, a large one-day bounce is meaningful but does not establish a durable new uptrend.",
     "Korea supplies memory and high-bandwidth memory to the AI supply chain. Earnings guidance from SK Hynix and Samsung, orders, inventories, chip pricing and semiconductor breadth are more useful than the index close by itself."
    ],sourceIds:[0,4],
    lesson:{question:"Why can Korean chips rebound while Chinese AI stocks fall?",
     answer:"A memory manufacturer can sell scarce chips and report near-term revenue even while an AI application developer is still trying to prove future profit. They share the AI theme but not the same cash-flow timetable.",
     counter:"If hyperscaler spending is cut, chip orders can slow too.",
     check:"Read SK Hynix and Samsung results on 28–29 Oct; compare realised margins with capex and inventory."}},
   {title:"Act 4 — Taiwan's stronger fundamentals face a valuation test",time:"15 October earnings; 27 October market close",
    paragraphs:[
     "TSMC reported third-quarter revenue up 50.9% year-on-year in New Taiwan dollars, net income up 68.7%, and gross margin of 66.4%. These are realised profits, not just promises about a future AI boom.",
     "Yet the TAIEX only edged up 0.12% on 27 October. TSMC's late recovery kept the benchmark positive. Its weighting exceeds 40% of total market value, so an index near flat can conceal weaker conditions in other shares. Foreign institutions were net sellers that session.",
     "Could Taiwan follow China? Yes, through index concentration and global AI-capex expectations. But a China-style collapse is not demonstrated by correlation alone; TSMC's profitability gives Taiwan a very different initial position."
    ],sourceIds:[1,6],
    lesson:{question:"Why doesn't a record quarter guarantee a higher share price?",
     answer:"Shares price the future, not only the quarter just reported. Investors can accept that earnings were excellent and still lower the multiple if they think growth will slow or financing costs remain high.",
     counter:"Sustained margin strength, higher orders and broader market participation can challenge the bearish comparison.",
     check:"Monitor TSMC guidance, US cloud capex, Taiwan advance/decline and equal-weight breadth."}},
   {title:"Act 5 — Japan is not simply a yen-strength story",time:"27 October · Nikkei and currency session",
    paragraphs:[
     "Japan's Nikkei rose about 1.7% as chip-related stocks recovered. The yen weakened rather than strengthened during the session, so yen appreciation cannot explain this day's rise.",
     "A strong yen can be a headwind for exporters because overseas revenue converts into fewer yen. But it is only one input. Japanese bond yields, BOJ policy, exporter earnings, domestic banks and technology-company performance may pull in different directions.",
     "The test is to compare the Nikkei with the broader TOPIX, USD/JPY and 10-year Japanese government bonds over matching sessions instead of forcing a single currency headline to explain the entire index."
    ],sourceIds:[0,5]}
  ],
  comparison:{heading:"What the 27 October tape actually says",columns:["Market","Observed move","Leading interpretation","What challenges it"],rows:[
   ["China / STAR50","−4.8%","Sharp AI valuation unwind","September industrial-profit improvement"],
   ["Korea / KOSPI","+3.09%","Chip and growth relief","Still vulnerable to HBM guidance"],
   ["Taiwan / TAIEX","+0.12%","TSMC provided index support","Narrow leadership; foreign selling"],
   ["Hong Kong / Hang Seng","About −0.7%","Mainland tech and funding exposure","Different index and earnings composition"],
   ["Japan / Nikkei","+1.73%","Semiconductor rebound","Weaker yen does not prove durable breadth"]
  ]},
  scenarios:[
   {name:"A — Earnings defend Asia",condition:"Memory and foundry earnings/guidance hold; US cloud capex is sustained.",outcome:"Taiwan and Korea outperform; Chinese tech stabilisation becomes possible.",against:"Profit guidance cuts or cash flow failing to follow capex."},
   {name:"B — A tactical bounce only",condition:"Korea and Japan rebound but market breadth/earnings revisions fail to follow.",outcome:"Choppy, concentrated rallies; investors remain selective.",against:"Several successive sessions of improving breadth and revisions."},
   {name:"C — AI repricing spreads",condition:"US cloud spending forecasts weaken, higher real yields persist, or chips lose support.",outcome:"Taiwan, Korean memory and Japanese equipment names could follow China's de-rating.",against:"Strong new orders, higher realised margins and easing discount rates."}
  ],
  manual:[
   {name:"China",question:"Is this primarily valuation compression, earnings deterioration, or forced/position-driven selling?",tests:["STAR50 vs CSI300 and Hang Seng Tech: 1D, 5D, 1M and drawdown from peak","Company earnings revisions, free cash flow, liquidity and export restriction updates","Breadth, turnover and margin-financing trends"],contradiction:"September's +14.4% industrial-profit figure conflicts with a simplistic earnings-collapse account."},
   {name:"Korea and Taiwan",question:"Is the AI-hardware profit engine intact beyond one rebound?",tests:["SK Hynix (28 Oct) and Samsung (29 Oct) official releases","TSMC October 15 release, Q4 guidance and next monthly sales","KOSPI vs semiconductor equal-weight; Taiwan breadth and foreign flows"],contradiction:"Realised TSMC margins are very strong even though technology multiples face pressure."},
   {name:"Japan and Hong Kong",question:"Which part is FX, bonds, sector earnings or China risk?",tests:["Nikkei vs TOPIX; USD/JPY and JGB10Y matched close-to-close","Hang Seng Tech vs broader Hang Seng and CSI300","Break-and-hold chart tests only with dated EMA bands"],contradiction:"The Nikkei rose on 27 Oct while yen weakened; a stronger-yen narrative fails that day's observation."}
  ],
  sources:[
   {label:"MarketsFN — final Asia closing-index table",date:"27 Oct 2026",url:"https://www.marketsfn.com/article/kospi-surges-309-amid-strategic-developments-in-asian-markets",kind:"reporting"},
   {label:"Focus Taiwan — TAIEX close and TSMC weight",date:"27 Oct 2026",url:"https://focustaiwan.tw/business/202610270015",kind:"reporting"},
   {label:"Reuters — China AI valuation unwind",date:"26 Oct 2026",url:"https://www.investing.com/news/economy-news/analysisin-china-the-ai-bubble-has-already-burst-4972445",kind:"reporting"},
   {label:"Reuters — mainland/Hong Kong selling despite profits",date:"27 Oct 2026",url:"https://www.brecorder.com/news/40446100",kind:"reporting"},
   {label:"Bank of Korea — Q3 2026 GDP release",date:"27 Oct 2026",url:"https://www.bok.or.kr/eng/bbs/E0000634/view.do?nttId=11065943",kind:"primary"},
   {label:"investingLive — yen and Japanese chip-session context",date:"27 Oct 2026",url:"https://investinglive.com/news/investinglive-asia-pacific-market-news-regional-stocks-mostly-rose/",kind:"reporting"},
   {label:"TSMC — Q3 2026 earnings",date:"15 Oct 2026",url:"https://www.sec.gov/Archives/edgar/data/1046179/000104617926000726/a3q26e_withguidancexfinal.htm",kind:"primary"}
  ]
 },
 "global-bonds":{
  slug:"global-bonds",title:"France's Bond Scare: The Greece Lesson",
  deck:"In 2010 Greece lost market access. In October 2026 France's borrowing premium hit a 15-year high. The parallel is a warning about credibility, not proof that a second Greek rescue is imminent.",
  tagline:"GLOBAL BONDS · FRANCE VS GREECE · INDEPENDENT EDITORIAL RESEARCH",
  asOf:"27 October 2026 · latest cited market quotes and 2025 Eurostat fiscal year",
  thesis:"France is experiencing a sovereign risk-premium repricing within an already expensive global bond market. What distinguishes a French fiscal scare from a systemic eurozone crisis is whether stress spreads to banks and other sovereigns and whether Paris can pass a credible budget.",
  confidence:"Working interpretation · medium; no evidence France has lost bond-market access",
  facts:[
   {label:"France–Germany 10Y spread",value:"~178 bp",detail:"22 Oct intraday extreme, not current",sourceIds:[0]},
   {label:"France–Germany 10Y spread",value:"~153 bp",detail:"27 Oct indicative quote after Moody's relief",sourceIds:[1]},
   {label:"France 2025 deficit",value:"5.1% GDP",detail:"Eurostat, release 21 Oct 2026",sourceIds:[2]},
   {label:"Greece 2025 fiscal balance",value:"+2.0% GDP",detail:"Surplus, Eurostat; not 2010 Greece",sourceIds:[2]}
  ],
  scenes:[
   {title:"Act 1 — Greece's lenders stopped believing the numbers",time:"2009–2010 · historical case",
    paragraphs:[
     "In October 2009 Greece revealed that its deficit was far worse than previously reported. Investors began demanding ever higher interest to lend. By 2010 Greece could no longer refinance normal government borrowing on acceptable terms and sought help from euro-area partners and the IMF.",
     "There is a feedback loop here. A government with a large debt load must repeatedly replace maturing bonds. If new creditors demand far higher yields, interest costs grow, making the next refinancing even harder. A confidence problem can become a solvency and banking problem.",
     "Greece required repeated assistance programmes. The crisis culminated in a 2012 restructuring: holders of about €197 billion of privately held Greek bonds took a 53.5% cut to face value, reducing debt stock by roughly €107 billion."
    ],sourceIds:[3,4],
    lesson:{question:"Why does a bond price fall when lenders become worried?",
     answer:"An existing bond promises fixed cash flows. To entice a new buyer after confidence falls, its market price drops until the implied yield rises. Rising yields are therefore the price of worsening trust, even before the government defaults.",
     counter:"Yields also rise when inflation or policy-rate expectations rise. Compare the country with Germany to isolate some sovereign-specific risk.",
     check:"Watch a government's 10-year yield against Germany's 10-year Bund, not only its absolute yield."}},
   {title:"Act 2 — Greece rebuilt credibility; France lost part of its premium",time:"2025 audited fiscal year; October 2026 repricing",
    paragraphs:[
     "The comparison now turns upside down. Eurostat reported Greece had a 2025 government surplus of 2.0% of GDP while France had a deficit of 5.1%. Greek debt remained much higher, at 145.4% of GDP against France's 115.7%. But investors also price the direction of budgets, not just the debt headline.",
     "France's market stress does not mean it is replaying 2010 Greece. France remains a large, diversified, investment-grade issuer with ongoing market access. Its problem is uncertainty over how a fragmented parliament can deliver spending restraint and tax measures while growth is weak.",
     "On 22 October the 10-year French OAT yield touched about 5.14% and its premium to a German Bund approached 178 basis points, its widest since 2011. A widening spread says investors demanded more compensation for French risk than for the eurozone's safest reference borrower."
    ],sourceIds:[0,2,5],
    lesson:{question:"What does a 178-basis-point spread mean in money?",
     answer:"One basis point is 0.01 percentage point. So 178 bp means a French 10-year yield 1.78 percentage points above the German 10-year benchmark. For illustration, on €10 billion of newly issued debt, an additional 1.78 percentage points implies about €178 million extra annual interest if that difference applied to the whole issuance.",
     counter:"That is illustrative, not France's realised cost: old bonds have existing coupons, auctions have different maturities and the spread changes.",
     check:"Use the same maturity and timestamp for OAT and Bund yields, plus auction clearing yield and bid/cover."}},
   {title:"Act 3 — The rating surprise brings relief, not a cure",time:"23–27 October 2026 · Moody's and repricing",
    paragraphs:[
     "Moody's maintained France's Aa3 rating with a negative outlook on 23 October rather than making the downgrade some investors feared. French bonds rallied on 26 October; by 27 October the spread was reported around 153 basis points. That is a meaningful retreat from the extreme, but it leaves a much wider risk premium than in calmer periods.",
     "The unresolved issue is France's 2027 budget. The government aims to bring the deficit to 5% of GDP, but parliamentary resistance and social unrest complicate the plan. A credit-rating reprieve buys time; it does not pass a budget or improve tax receipts.",
     "This is the next divergence to watch: if the French risk premium narrows on budget progress and the relief holds, the market is distinguishing a severe valuation adjustment from a runaway sovereign crisis. If OAT yields rise again while Bund yields fall, French-specific stress is returning."
    ],sourceIds:[1,5,6]},
   {title:"Act 4 — Could the ECB rescue France like it rescued the euro?",time:"ECB legal framework, 2022; EU deficit status current",
    paragraphs:[
     "Europe has more crisis-fighting tools than it did in 2010. But the ECB's Transmission Protection Instrument is intended for unwarranted, disorderly disruption to monetary-policy transmission, not to underwrite a government's budget.",
     "The ECB considers fiscal compliance, macroeconomic imbalances, debt sustainability and policy commitments. France is currently subject to an EU excessive-deficit procedure, a material obstacle for TPI eligibility. That does not prove an intervention is legally impossible under every future scenario: the ECB retains discretion and would judge evolving conditions.",
     "Watch whether investors stop treating the scare as a France-only problem. If Italian, Belgian and Greek spreads rise together, bank stocks weaken and euro funding becomes strained, the cost of inaction for Europe changes."
    ],sourceIds:[7,8,9]},
   {title:"Act 5 — Place France inside the global bond market",time:"Late October · cross-market transmission",
    paragraphs:[
     "A bond scare is not confined to Paris. US Treasuries, British gilts and Japanese government bonds are also contending with high financing requirements, changing inflation expectations and policy uncertainty. But they do not all share the same sovereign-risk mechanism.",
     "If French bonds sell off while German Bunds rally, that is a relative-credit warning. If both French and German yields climb together, a broader inflation or rate shock may be dominating. If US Treasury yields fall and credit spreads widen, flight to safety may be underway rather than an easing-growth celebration.",
     "Japan introduces another mechanism. Rising JGB yields can change the incentives of domestic investors to keep money abroad. A yen rally alongside global risk reduction would strengthen a carry-unwind interpretation; a weaker yen on a Nikkei rebound would not."
    ],sourceIds:[0,10]}
  ],
  comparison:{heading:"Why France is not simply Greece 2010 again",columns:["Test","Greece then","France now","Next evidence"],rows:[
   ["Fiscal surprise","Misreported budget deficit in 2009","High published deficit; political consolidation impasse","2027 budget enacted vs rejected"],
   ["Market access","Lost sustainable refinancing in 2010","Continues to borrow; higher risk premium","Auctions, yield curve and funding calendar"],
   ["Debt treatment","2012 private bond face-value haircut of 53.5%","No announced haircut or rescue programme","Rating changes and new financing terms"],
   ["European backstop","First programmes built during the crisis","ESM/TPI exist, but eligibility and mandate limit use","ECB statements, TPI criteria, spillovers"],
   ["2025 finances","Not applicable to crisis-era Greece","France deficit 5.1%; Greece surplus 2.0%","Trend in primary balance and growth"]
  ]},
  scenarios:[
   {name:"A — France stabilises",condition:"Credible budget progress; 10Y OAT–Bund premium continues to narrow; auctions clear.",outcome:"French banks and bonds recover, euro contagion risk recedes.",against:"A failed budget, fresh widening and banking spread stress."},
   {name:"B — A long fiscal grind",condition:"No immediate crisis, but budget compromises fall short while global yields stay high.",outcome:"Persistently expensive French refinancing and volatile, elevated premium.",against:"Sustained budget repair or an abrupt market-access disruption."},
   {name:"C — Eurozone contagion",condition:"French spread re-accelerates as BTP, Belgian and Greek spreads widen and bank funding worsens.",outcome:"The story shifts from a France-specific downgrade risk to a eurozone transmission problem.",against:"Non-French spreads stay orderly, banks hold up, and auction demand persists."}
  ],
  manual:[
   {name:"France–Germany bond tape",question:"Is today's move specific to France or driven by global inflation and rates?",tests:["Record 10Y OAT and Bund yields at identical timestamps; compute OAT–Bund basis points","Compare 2Y, 10Y, 30Y OAT slopes, yield auction tail, bid-cover and AFT calendar","Separate intraday widening from the session close and 1–3-session follow-through"],contradiction:"The October 22 spread spike reversed after the Moody's rating hold; one alarming peak is not the latest state."},
   {name:"Sovereign contagion and ECB",question:"Is this still a domestic French credibility scare?",tests:["Italy/Germany, Greece/Germany and Belgium/Germany spreads","French bank equity/CDS vs broader EU banking sector; EUR/USD and EUR/CHF","2027 French budget votes, Moody's negative outlook, S&P Nov review, ECB TPI statements"],contradiction:"ECB TPI exists but France's ongoing excessive-deficit procedure constrains an easy rescue story."},
   {name:"Global rates and refinancing",question:"Is the bond market pricing inflation, fiscal supply, or flight to safety?",tests:["US02Y/US10Y/US30Y vs real yields and 10Y breakevens","US high-yield spreads, MOVE and equity financials; gilt and JGB10Y changes","Match each yield reaction to official inflation/policy and auction timestamps"],contradiction:"Falling Treasuries yields can indicate a growth scare, not necessarily a dovish policy shift."}
  ],
  sources:[
   {label:"Reuters — French 10-year spread reaches 2011 extreme",date:"22 Oct 2026",url:"https://live.euronext.com/en/financial-news/french-debt-risk-premium-reaches-euro-zone-sovereign-crisis-levels",kind:"reporting"},
   {label:"Investing.com — French yields and spread, Tuesday quote",date:"27 Oct 2026",url:"https://in.investing.com/news/forex-news/french-yields-edge-higher-as-moodys-relief-fades-israeli-election-in-focus-5655992",kind:"reporting"},
   {label:"Eurostat — 2025 deficit/debt notification",date:"21 Oct 2026",url:"https://ec.europa.eu/eurostat/web/products-euro-indicators/w/2-21102026-ap",kind:"primary"},
   {label:"ESM — Greece programme timeline and debt crisis",date:"2009–2018 historical",url:"https://www.esm.europa.eu/assistance/greece/timeline-greece-exit",kind:"primary"},
   {label:"ESM — 2012 private sector debt restructuring",date:"2012 historical",url:"https://www.esm.europa.eu/content/what-was-private-sector-debt-restructuring-march-2012",kind:"primary"},
   {label:"Reuters — Moody's France rating hold",date:"23 Oct 2026",url:"https://www.reuters.com/world/europe/unrest-hit-france-poised-moodys-ratings-verdict-2026-10-23/",kind:"reporting"},
   {label:"French finance ministry — stated 2027 budget target",date:"23 Oct 2026",url:"https://www.publicnow.com/view/1D624D0BC39A2773DC6B5BC1D653BA49126278F4",kind:"primary"},
   {label:"ECB — TPI eligibility criteria and mandate",date:"21 Jul 2022",url:"https://www.ecb.europa.eu/press/pr/date/2022/html/ecb.pr220721~973e6e7273.en.html",kind:"primary"},
   {label:"European Commission — France excessive-deficit procedure",date:"current as of Oct 2026",url:"https://economy-finance.ec.europa.eu/economic-governance-framework/stability-and-growth-pact/corrective-arm-excessive-deficit-procedure/excessive-deficit-procedures-overview/france_en",kind:"primary"},
   {label:"MSCI — France spread-contagion scenarios",date:"21 Oct 2026",url:"https://www.msci.com/research-and-insights/quick-take/scenario-analysis-when-french-bond-spreads-widen",kind:"analysis"},
   {label:"LSEG FTSE Russell — OAT/Bund term and fiscal risk context",date:"23 Oct 2026",url:"https://www.lseg.com/en/insights/ftse-russell/how-do-you-like-your-oats",kind:"analysis"}
  ]
 }
};
export function getFeatureStory(slug:string):FeatureStory|undefined{
 if(slug==="asia-equities"||slug==="global-bonds")return featureStories[slug];
 return undefined;
}
