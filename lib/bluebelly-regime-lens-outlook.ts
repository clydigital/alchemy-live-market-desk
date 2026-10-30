import type {EditorialRegimeId} from "./bluebelly-editorial-architecture.ts";

/** A human-reviewed, source-dated editorial thesis about each *research lens*.
 * Distinct from asset-specific tape, creator opinion and the canonical
 * System-2 Regime/Dossier state. These fields cannot be changed by news ingestion.
 */
export type LensOutlook="BEARISH"|"MIXED"|"BULLISH";
export type LensConfidence="LOW"|"MEDIUM"|"HIGH";
export type LensResearchOutlook=Readonly<{
 lens:EditorialRegimeId;
 outlook:LensOutlook;
 confidence:LensConfidence;
 headline:string;
 why:string;
 supporting:string;
 opposing:string;
 decidingTest:string;
 reviewedAt:string;
 evidenceStatus:string;
 sources:readonly {name:string;url:string;asOf:string;kind:"PRIMARY"|"COMMENTARY"}[];
}>;

export const LENS_OUTLOOK_REVIEWED_ON="2026-10-30" as const;
export const LENS_OUTLOOK_VERSION="bluebelly/editorial-lens-outlook/2026-10-30/1" as const;

export const LENS_RESEARCH_OUTLOOKS:Readonly<Record<EditorialRegimeId,LensResearchOutlook>>={
 fed:{
  lens:"fed",outlook:"MIXED",confidence:"MEDIUM",
  headline:"Inflation is sticky, yet household momentum is softening",
  why:"September headline PCE inflation rose 3.6% year on year, core PCE 3.1%, while real spending was approximately flat. The Fed's 28 October hold leaves a policy dilemma: cut too soon and risk inflation, or stay restrictive as demand slows.",
  supporting:"Elevated PCE and divided Fed voting support a restrictive policy bias rather than easy disinflation.",
  opposing:"Soft real household spending and falling Treasury yields on 29 October challenge a simple rates-higher narrative.",
  decidingTest:"Match the next original inflation and employment releases with the same-session US 2Y, expected Fed path, dollar and credit reaction.",
  reviewedAt:"2026-10-30",evidenceStatus:"Primary release and policy decision reviewed; matching all FX/repricing legs remains incomplete.",
  sources:[
   {name:"BEA September income and PCE",url:"https://www.bea.gov/news/2026/personal-income-and-outlays-september-2026",asOf:"2026-10-29",kind:"PRIMARY"},
   {name:"Federal Reserve FOMC statements",url:"https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm",asOf:"2026-10-28",kind:"PRIMARY"}
  ]
 },
 bonds:{
  lens:"bonds",outlook:"MIXED",confidence:"MEDIUM",
  headline:"High funding costs, but the latest yields eased",
  why:"The US 10-year Treasury yield was 4.98% on 29 October, about 7bp below the previous session. Still-elevated real yields and inflation keep financing expensive, but the decline means a one-directional sell-off call is not justified.",
  supporting:"Restrictive inflation-adjusted borrowing costs and supply/term-premium risks constrain refinancing.",
  opposing:"A retreat in nominal yields can reflect weaker forward growth or improved bond demand, and private credit conditions may not track government yields.",
  decidingTest:"Compare Treasury 2Y/10Y/30Y, real yields, auction demand, and dated IG/HY credit spreads—not headline yields alone.",
  reviewedAt:"2026-10-30",evidenceStatus:"Treasury closing observations available; current auction and credit-spread attribution require matching.",
  sources:[
   {name:"US Treasury nominal yield curve",url:"https://home.treasury.gov/resource-center/data-chart-center/interest-rates",asOf:"2026-10-29",kind:"PRIMARY"}
  ]
 },
 ai:{
  lens:"ai",outlook:"MIXED",confidence:"MEDIUM",
  headline:"Demand is real; shareholder cash returns diverge",
  why:"AWS grew roughly 39% year on year, yet Amazon's trailing free cash flow was about negative $42.4bn. Microsoft remained cash-positive and Sandisk showed supplier strength. Buying infrastructure and selling it are economically different businesses.",
  supporting:"Rapid cloud, chip and storage orders demonstrate real customer demand, not merely an imagined AI boom.",
  opposing:"Huge cash capex, funding costs and elevated expectations can overwhelm buyer free cash flow even when revenue rises.",
  decidingTest:"Track each issuer's operating cash less cash capex, leases, debt maturities and paid utilisation over successive quarters; separate buyers from suppliers.",
  reviewedAt:"2026-10-30",evidenceStatus:"Issuer results reviewed; a sector-wide financing crisis is not independently established.",
  sources:[
   {name:"Amazon Q3 earnings release",url:"https://ir.aboutamazon.com/news-release/news-release-details/2026/Amazon-com-Announces-Third-Quarter-Results/default.aspx",asOf:"2026-10-29",kind:"PRIMARY"},
   {name:"Microsoft FY27 Q1 earnings",url:"https://www.microsoft.com/en-us/Investor/earnings/FY-2027-Q1/press-release-webcast",asOf:"2026-10-28",kind:"PRIMARY"}
  ]
 },
 china:{
  lens:"china",outlook:"MIXED",confidence:"LOW",
  headline:"Cheaper compute could grow adoption or squeeze margins",
  why:"The strategic tension is credible, but the reviewed source set has not established a comparable current China-versus-US cost, performance and realised-revenue series. A lower model price alone does not prove a sustainable advantage.",
  supporting:"Broader access to cheaper models could stimulate AI applications and pressure incumbent pricing.",
  opposing:"Export controls, memory constraints, benchmarks and the cost of reliable enterprise deployment can erode the apparent advantage.",
  decidingTest:"Verify current BIS rules, independent matched model tests, actual enterprise contract prices and paid usage before revising the call.",
  reviewedAt:"2026-10-30",evidenceStatus:"Research hypothesis; no matched model-cost and paid-usage evidence admitted for a directional verdict.",
  sources:[
   {name:"US BIS Export Administration Regulations",url:"https://www.bis.gov/regulations/ear",asOf:"policy reference, no matched 30 Oct event",kind:"PRIMARY"}
  ]
 },
 energy:{
  lens:"energy",outlook:"BULLISH",confidence:"MEDIUM",
  headline:"Physical fuel scarcity outweighs near-term supply optimism",
  why:"The IEA's October oil review records depleted global buffers, disrupted Gulf product shipments and particularly tight diesel. The strongest case is in refined fuels; HFI's longer-term non-OPEC production ceiling remains an attributed thesis, not established fact.",
  supporting:"Low product stocks, disrupted exports and strong energy-producer cash generation reinforce scarcity economics.",
  opposing:"High prices are curbing demand; supply recovery or easing Gulf disruptions could compress crude and diesel premiums.",
  decidingTest:"Track official crude and distillate inventories, refinery runs, delivered product flows, global demand revisions and physical differentials separately.",
  reviewedAt:"2026-10-30",evidenceStatus:"Official October IEA/EIA physical evidence; no guarantee that Brent futures will rise every session.",
  sources:[
   {name:"IEA October Oil Market Report",url:"https://www.iea.org/reports/oil-market-report-october-2026",asOf:"2026-10-14",kind:"PRIMARY"},
   {name:"EIA weekly petroleum statistics",url:"https://www.eia.gov/petroleum/supply/weekly/",asOf:"2026-10-21",kind:"PRIMARY"},
   {name:"HFI non-OPEC supply commentary",url:"https://www.hfir.com/p/wctw-non-opec-supply-growth-isnt",asOf:"2026-10-29",kind:"COMMENTARY"}
  ]
 },
 yen:{
  lens:"yen",outlook:"MIXED",confidence:"LOW",
  headline:"Carry-unwind risk is plausible, not confirmed",
  why:"Japan rate expectations and global funding conditions can transmit into yen-funded trades. The stored research does not yet reconcile the current BoJ decision, JGB curve, USDJPY and cross-border flow observations into one verified direction.",
  supporting:"A narrowing foreign/Japan yield advantage or falling risk appetite can support yen repatriation.",
  opposing:"Yield differentials, hedging costs and actual investor flows can dominate policy headlines; stronger JPY alone does not prove a carry liquidation.",
  decidingTest:"Review the original BoJ decision and match USDJPY, 2Y/10Y JGB yields, basis swaps and foreign bond flows on the same windows.",
  reviewedAt:"2026-10-30",evidenceStatus:"Missing reconciled same-window 30 Oct yen funding observations; directional confidence intentionally low.",
  sources:[
   {name:"Bank of Japan policy releases",url:"https://www.boj.or.jp/en/mopo/outlook/",asOf:"current release pending reconciliation",kind:"PRIMARY"}
  ]
 },
 breadth:{
  lens:"breadth",outlook:"MIXED",confidence:"LOW",
  headline:"Real earnings meet stretched expectations and leverage",
  why:"Profitable AI demand and resilient earnings can support stocks, but concentration, leverage and cash conversion increase vulnerability to a shock. Why X's 30 October transcript makes a useful financial-instability argument—not a timed equity crash forecast.",
  supporting:"Strong AI customer demand and supplier earnings can keep market leadership profitable.",
  opposing:"High expectations, financing dependence and mechanical selling could magnify an adverse surprise; current index-wide breadth and forced-sale data remain incomplete.",
  decidingTest:"Match Nasdaq and equal-weight breadth, earnings revisions, credit spreads and margin exposure relative to market size; do not infer a crash from a historical analogy.",
  reviewedAt:"2026-10-30",evidenceStatus:"Issuer fundamentals plus attributed creator hypothesis; matched breadth/positioning evidence incomplete.",
  sources:[
   {name:"Amazon issuer earnings",url:"https://ir.aboutamazon.com/news-release/news-release-details/2026/Amazon-com-Announces-Third-Quarter-Results/default.aspx",asOf:"2026-10-29",kind:"PRIMARY"},
   {name:"Why X financial-instability discussion",url:"https://www.youtube.com/watch?v=YgqpOe2H17o",asOf:"2026-10-30",kind:"COMMENTARY"}
  ]
 },
 gold:{
  lens:"gold",outlook:"MIXED",confidence:"LOW",
  headline:"Long-term hedging demand meets near-term real-yield pressure",
  why:"Gold can benefit from geopolitical risk and reserve diversification, but elevated real yields increase the opportunity cost of holding it. A matched gold, dollar and TIPS observation is missing from the reviewed snapshot.",
  supporting:"Reserve allocation and geopolitical insurance can support strategic gold demand.",
  opposing:"A high real yield or forced liquidity sale can pressure near-term gold even when the strategic case remains intact.",
  decidingTest:"Reconcile official reserve data, spot gold, 10Y TIPS and DXY at identical timestamps before favouring either side.",
  reviewedAt:"2026-10-30",evidenceStatus:"Current cross-asset gold reaction not reconciled; assessment is mixed with low conviction.",
  sources:[
   {name:"US Treasury real-yield data",url:"https://home.treasury.gov/resource-center/data-chart-center/interest-rates",asOf:"2026-10-29 reference",kind:"PRIMARY"}
  ]
 },
 housing:{
  lens:"housing",outlook:"MIXED",confidence:"LOW",
  headline:"Affordability pressure is real, but contagion is not proven",
  why:"High mortgage funding costs can strain homebuyers and refinancing, while weak housing activity can eventually weigh on growth. The available research has not verified a new, simultaneous deterioration in credit performance and housing activity.",
  supporting:"Restrictive rates limit affordability and could transmit to construction, consumption and lenders.",
  opposing:"Housing weakness alone does not establish bank contagion; better income growth or lower mortgage spreads could stabilise demand.",
  decidingTest:"Compare Freddie Mac mortgage rates, Census sales and starts, BLS shelter and New York Fed household delinquency observations with matching dates.",
  reviewedAt:"2026-10-30",evidenceStatus:"Monitoring framework supported; timely multi-series housing/credit evidence incomplete.",
  sources:[
   {name:"Freddie Mac mortgage rate survey",url:"https://www.freddiemac.com/pmms",asOf:"monitor reference, latest matching observation not established",kind:"PRIMARY"},
   {name:"New York Fed household debt",url:"https://www.newyorkfed.org/microeconomics/hhdc",asOf:"monitor reference",kind:"PRIMARY"}
  ]
 }
};

export function getLensOutlook(id:EditorialRegimeId):LensResearchOutlook{return LENS_RESEARCH_OUTLOOKS[id]}

/** Relative editorial opinion, not a numeric forecast or model confidence. */
export function outlookPosition(outlook:LensOutlook):1|3|5{
 return outlook==="BEARISH"?1:outlook==="BULLISH"?5:3;
}
export function confidenceSegments(confidence:LensConfidence):1|2|3{
 return confidence==="HIGH"?3:confidence==="MEDIUM"?2:1;
}
