/**
 * External opinion/industry reads are attributed and secondary.
 * They must never override original issuer figures or be described as polls.
 * Any dated quote/estimate remains frozen to the cited research cutoff.
 */
export type DatedDebateRead={label:string; claim:string; kind:"analyst"|"industry"|"reporting"|"investor-forum";source:string;date:string;limitation:string};
export const DATED_MARKET_DEBATES:Record<string,readonly DatedDebateRead[]>={
 AMZN:[{
  label:"AWS demand versus the payback date",claim:"Industry coverage highlights Amazon's contracted infrastructure demand while analysts press for evidence that capex creates future free cash flow.",kind:"industry",date:"October 2026",
  source:"https://www.geekwire.com/2026/amazon-earnings-preview-aws-is-booked-up-and-wall-street-wants-to-know-what-comes-next/",
  limitation:"Industry reporting describes competing expectations; customer commitments are not collected cash and the expected payback is not independently measured."
 }],
 INTC:[{
  label:"The 42% gross-margin hurdle",claim:"A dated pre-earnings analysis focuses on Intel's 42% non-GAAP Q3 margin outlook, external Foundry contracts and how capacity spending will be funded.",kind:"analyst",date:"26 October 2026",
  source:"https://finance.yahoo.com/markets/stocks/articles/intel-break-margin-test-arriving-153319298.html",
  limitation:"The analyst's forward valuation and survey estimates may differ by timing/provider; only Intel's own $15.8–16.8bn guidance is the company-sourced bar."
 }],
 SNDK:[{
  label:"Long-term agreements versus memory-cycle risk",claim:"A bullish SanDisk holder extrapolates multiyear customer commitments into very large guaranteed future free cash flow.",kind:"investor-forum",date:"24–26 October 2026",
  source:"https://www.reddit.com/r/SNDK_Stock/comments/1xelcu7/my_analysis_of_sndk/",
  limitation:"Self-selected holder opinion, not the terms of the contracts. Committed revenue cannot establish a guaranteed free-cash-flow margin."
 },{
  label:"Sell the news even after good earnings",claim:"Another retail discussion asks whether strong memory results could already be in the price ahead of earnings.",kind:"investor-forum",date:"October 2026",
  source:"https://www.reddit.com/r/SNDK_Stock/comments/1xfcupj/bullish_or_bearish_for_earnings/",
  limitation:"A forum discussion is not a representative survey or evidence of an actual future stock reaction."
 }],
 AMD:[{
  label:"Customer contracts and warrants",claim:"AMD's unusual two-customer equity warrant terms prompt the question of how much accelerator growth accrues to existing shareholders after potential dilution.",kind:"industry",date:"5 August 2026",
  source:"https://ir.amd.com/financial-information/sec-filings/content/0000002488-26-000123/amd-20260627.htm",
  limitation:"This is an analytical question grounded in the original filing, not a named analyst recommendation. No warrant shares had vested at the filing date."
 }],
 AAPL:[{
  label:"Weak supply-chain demand story",claim:"Reuters attributed reports of at least 15% component-order reductions to Nikkei Asia. Jefferies also highlighted shorter delivery lead times and discounts.",kind:"reporting",date:"9–19 October 2026",
  source:"https://www.reuters.com/business/retail-consumer/apple-cuts-iphone-18-pro-orders-due-soft-demand-nikkei-asia-reports-2026-10-09/",
  limitation:"Reuters could not independently confirm the Nikkei component cuts; lead times and supplier orders are not verified final device sell-through."
 },{
  label:"An opposite geographic demand signal",claim:"Counterpoint Research estimated first-three-week iPhone 18 Pro sales 3.1% higher worldwide, led by China, while US and Japan observations were weaker.",kind:"industry",date:"27 October 2026",
  source:"https://www.reuters.com/business/retail-consumer/initial-global-sales-apple-iphone-18-pro-higher-than-17-series-counterpoint-2026-10-27/",
  limitation:"An independent research estimate, not Apple's audited worldwide unit sales. Regions and launch timing differ."
 }],
 PFE:[{
  label:"The dividend investor's countercase",claim:"An earnings preview argues that Pfizer's oncology portfolio, future pipeline and yield may support long-term investment despite patent expiries and weaker COVID sales.",kind:"analyst",date:"28 October 2026",
  source:"https://www.zacks.com/stock/news/3017408/pfizer-stock-ahead-of-q3-earnings-to-buy-or-not-to-buy",
  limitation:"This is analyst commentary, not a guaranteed forecast or a dividend coverage statement; the company's six-month cash bridge must be checked separately."
 }],
 PLTR:[{
  label:"Company's exceptionally bullish AI adoption pitch",claim:"Palantir's management highlights US commercial growth and large contract awards as evidence that its software is embedding in customer operations.",kind:"industry",date:"3 August 2026",
  source:"https://investors.palantir.com/news-details/2026/Palantir-Reports",
  limitation:"Issuer advocacy, not independent market sentiment. Contract value includes option and timing risks; valuation is a separate judgement."
 }]
};
