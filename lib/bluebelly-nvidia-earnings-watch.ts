/** Original-source, time-frozen issuer/earnings evidence. It is not a live
 * valuation, stock quote, earnings result, investment order or approved Regime
 * verdict. Publish actual Q3 only in a separate, subsequently source-reviewed
 * edition with the exact report ID, release clock and verified financial basis. */
export const NVIDIA_EARNINGS_WATCH={
 id:"nvidia-2026-11-17-fy27-q3-earnings-decision",
 reviewedOn:"2026-11-13 MYT · sourced before Q3 publication",
 sourceTier:"ORIGINAL_ISSUER_RELEASES + ATTRIBUTED_REPORTING",
 issuer:"NVIDIA",
 ticker:"NVDA",
 q3ReportAt:"2026-11-17T21:20:00Z",
 q3CallAt:"2026-11-17T22:00:00Z",
 transition:{
  summary:"NVIDIA confirmed Jensen Huang's resignation on 12 November. Colette Kress, its CFO since 2013, is interim CEO while the board seeks a permanent successor. The board expects its customer commitments and product roadmap to continue, which is an assurance, not independent evidence that every order will be delivered.",
  originalUrl:"https://nvidianews.nvidia.com/_gallery/download_pdf/6af5c3cc3d6332f541088655/",
  announcedOn:"2026-11-12",
  unresolved:"The board's investigative findings, permanent CEO, regulatory/export outcomes and any material changes to customer or supply commitments have not been verified."
 },
 previousQuarter:{
  period:"Q2 FY2027",
  revenueBn:96.221,
  dataCenterRevenueBn:89.0,
  nonGaapGrossMarginPct:75.0,
  originalUrl:"https://investor.nvidia.com/news/press-release-details/2026/NVIDIA-Announces-Financial-Results-for-Second-Quarter-Fiscal-2027/default.aspx",
  comparison:"Reported historical revenue and margins, not a promise of Q3 earnings or cash flow."
 },
 companyQ3Guidance:{
  period:"Q3 FY2027 · quarter ended 25 October 2026",
  revenueBn:108.0,
  guidanceTolerancePct:2.0,
  revenueLowBn:105.84,
  revenueHighBn:110.16,
  grossMarginPct:74.0,
  grossMarginTolerancePp:0.5,
  basis:"Issuer Q2 FY2027 outlook, both GAAP and non-GAAP gross-margin guidance; no China Data Center compute revenue assumed.",
  originalUrl:"https://investor.nvidia.com/news/press-release-details/2026/NVIDIA-Announces-Financial-Results-for-Second-Quarter-Fiscal-2027/default.aspx"
 },
 calendar:{
  results:"17 Nov 2026 · approx. 1:20 pm PT / 18 Nov 05:20 MYT",
  call:"17 Nov 2026 · 2:00 pm PT / 18 Nov 06:00 MYT",
  originalUrl:"https://investor.nvidia.com/news/press-release-details/2026/NVIDIA-Sets-Conference-Call-for-Third-Quarter-Financial-Results/",
  status:"UPCOMING_ISSUER_EVENT"
 },
 signal:{
  decision:"The CEO transition is resolved; succession and potential strategic/financing changes remain open.",
  uncertainty:"MIXED: no uncertainty about Huang's current CEO status; still elevated uncertainty about succession, investigation, export rules and the company's role coordinating AI supply and credit.",
  beneficiaries:"A continuing NVIDIA GPU/software ecosystem and customers with confirmed usable compute could benefit if booked demand and deliveries remain strong. Competitors may gain only if there is evidence of customer substitution.",
  pressure:"NVIDIA's valuation and some suppliers/customers may face a larger risk premium if leadership alters capacity reservations or customer financing. The transition alone is not evidence of cancelled orders.",
  supply:"Physical GPU capacity and contract fulfilment depend on foundry/memory packaging, manufacturing reservations, export permissions and deployment. A leadership change does not automatically reduce already manufactured supply.",
  demand:"Customer orders and use of AI computing must be assessed separately from the demand for NVDA shares. End-customer utilisation, cloud-provider financing and actual delivery schedules distinguish genuine demand from speculative capex.",
  financing:"Assess customer prepayments, any NVIDIA-supported financing and cloud-provider operating cash after capex, without counting announced commitments as disbursed cash.",
  market:"High daily trading volume is two-sided turnover, not an independently measured net buy order. A capitulation rebound requires a subsequent close/retest and evidence that selling pressure has abated.",
  competitor:"Compare NVDA versus SMH/SOXX, AMD, AVGO, TSM, major GPU clients and AI data-centre operators at matching timestamps. Relative strength alone does not prove permanent switching."
 },
 scenarios:[
  {
   id:"continuity-upside",
   label:"Recovery case",
   stance:"CONDITIONALLY_CONSTRUCTIVE",
   needs:"Revenue at or above the upper company-guidance range, supported margins and forward orders, plus independently confirmed roadmap/customer continuity and credible succession.",
   marketRead:"Could reduce the governance risk premium and support an earnings-led recovery, but does not prove a full chart reversal or justify an unsourced price target.",
   invalidation:"Management reports material order cancellations, cuts delivery plans or revises customer funding commitments adversely."
  },
  {
   id:"guidance-in-range",
   label:"Wait-and-verify case",
   stance:"UNCERTAINTY_REMAINS",
   needs:"Revenue broadly within previous company guidance, no major loss of AI demand, but a still-unresolved permanent CEO and financing strategy.",
   marketRead:"Business resilience can coexist with a weak share price. Compare the pre-release expectation with actual results and next-quarter guidance; no earnings beat is assumed.",
   invalidation:"Forward results, realised cash generation or customer reports contradict the apparent continuity."
  },
  {
   id:"demand-funding-weakens",
   label:"Structural downside case",
   stance:"THESIS_CHALLENGED",
   needs:"Revenue materially below the old guidance, lower sustainable gross margins, weaker orders, adverse export restrictions or weakened customer/supplier financing.",
   marketRead:"Would challenge both near-term earnings and the multi-year valuation. Lower stock price alone is not evidence this path is already happening.",
   invalidation:"Verified customer utilisation, order backlog, realised margins and source-dated revenue/guidance recover."
  }
 ] as const,
 technical:[
  {id:"early",title:"Early reversal attempt",test:"After heavy volume, price reclaims a well-defined support level and holds a subsequent retest. Compare subsequent bars and broad semiconductor participation.",risk:"Still countertrend; a wick or single strong candle can be short-covering, not lasting demand."},
  {id:"event",title:"Earnings-confirmed accumulation",test:"Wait for issuer-reported results, forward guidance and the market's next-session absorption; distinguish facts from a relief rally.",risk:"Even a strong quarter can sell off if consensus and embedded expectations were higher."},
  {id:"trend",title:"Trend-following entry",test:"Only call daily trend repair after price reclaims the user-selected EMA band and the band is respected again on a pullback.",risk:"Higher entry price, but avoids assuming an oversold move has ended."}
 ] as const,
 nextChecks:[
  "Compare actual Q3 revenue, margin and forward guidance to the same-basis $108bn ±2% / 74% ±0.5pp management range; never invent EPS consensus.",
  "Read CFO commentary and Q&A for order quality, shipment schedules, capacity/packaging constraints, working capital, cash flow and customer financing commitments.",
  "Verify a permanent CEO decision, board/security findings and any changed export approvals through issuer/SEC/regulator sources.",
  "Measure dated NVDA vs SMH/AMD/AVGO/TSM/AI-cloud reaction before declaring a company-specific or sector-wide rerating.",
  "Refresh the daily EMA/volume chart after the complete US session; separate a potential capitulation wick from a confirmed retest."
 ]
} as const;

export type NvidiaEarningsWatch = typeof NVIDIA_EARNINGS_WATCH;
export type NvidiaEventState="UPCOMING"|"RESULTS_DUE_CHECK_ISSUER"|"OFFICIAL_RESULTS_CONFIRMED";
export function nvidiaEventState(now:Date,hasExactSourceReviewedResults=false):NvidiaEventState{
 if(hasExactSourceReviewedResults)return "OFFICIAL_RESULTS_CONFIRMED";
 const t=now.getTime();
 return Number.isFinite(t)&&t>=Date.parse(NVIDIA_EARNINGS_WATCH.q3ReportAt)
  ?"RESULTS_DUE_CHECK_ISSUER":"UPCOMING";
}
