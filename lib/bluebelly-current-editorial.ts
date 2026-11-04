/**
 * Publicly source-checked 4 November editorial update. This is an explicitly
 * dated editor-led reading slate, NOT canonical Motion, a live quote feed,
 * automatic source admission, or a private Notion research projector.
 * A later day retains the archive without claiming continuing freshness.
 */
export type DeskEditorialUpdate={
 id:string;headline:string;summary:string;why:string;nextTest:string;
 sourceName:string;sourceUrl:string;sourceDay:string;readerHref:string;
 initialPublishedOn:string;editorialUpdatedAt?:string;
 topics:readonly ("ai"|"policy"|"bonds"|"earnings"|"energy"|"fx")[];
};
export const DESK_EDITORIAL_EDITION="2026-11-04" as const;
export const DESK_EDITORIAL_UPDATES:readonly DeskEditorialUpdate[]=[
 {
  id:"midterm-blue-wave-4nov",headline:"Congress flips blue. The AI sell-off partially reverses.",
  summary:"Democrats secured the House and Senate. AI-regulation worries initially pressured shares, but US futures and European equities recovered by the European morning; the dollar and Treasury yields remained softer in Reuters' dated market reports.",
  why:"Political scrutiny and data-centre permitting could affect future AI spending, but no nationwide construction ban has been enacted. The initial risk-off move and subsequent rebound support competing explanations, not a confirmed new bear market.",
  nextTest:"Compare QQQ/SMH with RSP, DXY and 2Y/10Y Treasury yields over matched sessions; identify actual bills, permits and delays. Do not turn proposed restrictions into enacted law.",
  sourceName:"Reuters · 4 Nov global markets",sourceUrl:"https://www.reuters.com/world/china/global-markets-wrapup-1-2026-11-04/",
  sourceDay:"2026-11-04",readerHref:"/key-stories?feature=midterms-seasonality-2026",
  initialPublishedOn:"2026-11-02",editorialUpdatedAt:"2026-11-04T09:58:00Z",topics:["policy","ai","bonds","fx"],
 },
 {
  id:"riksbank-rate-4nov",headline:"Sweden raises rates to 2% despite a softer global growth outlook.",
  summary:"The Riksbank increased its policy rate by 25 basis points from 1.75% to 2%, effective 11 November. It cited stronger activity and energy-related inflation pressure, with further increases possible if its outlook holds.",
  why:"Energy supply shocks and resilient local activity can keep some central banks restrictive even when US Treasury yields fall on political-growth worries. The Swedish decision cannot be called a market surprise without a frozen consensus.",
  nextTest:"Check Sweden's next CPIF and jobs data, krona and Swedish 2-year yield reaction, plus the 5 November BoE decision. Consensus surprise and matched currency reaction are unverified here.",
  sourceName:"Sveriges Riksbank · 4 Nov decision",sourceUrl:"https://www.riksbank.se/en-gb/press-and-published/notices-and-press-releases/press-releases/2026/policy-rate-raised-to-2-per-cent/",
  sourceDay:"2026-11-04",readerHref:"/key-stories?postEvent=riksbank-2026-11-04",
  initialPublishedOn:"2026-11-04",topics:["policy","bonds","fx"],
 },
 {
  id:"amd-ai-cash-4nov",headline:"AMD's AI demand nearly doubles. Cash conversion is the objection.",
  summary:"AMD's third-quarter 2026 revenue rose 45% to $13.377 billion, led by data-centre revenue up 97%. It reported $554 million in quarterly free cash flow versus $1.530 billion a year earlier.",
  why:"AI chip sales are a realised business result, not only a spending promise. But sharply weaker year-on-year quarterly free cash flow means demand strength and shareholder cash generation are separate tests.",
  nextTest:"Verify Wednesday's regular-session AMD/SMH/QQQ reaction against the earnings event, then watch inventory, gross margin and the company's Q4 $17 billion revenue outlook. Do not use premarket moves as the regular-session close.",
  sourceName:"AMD · original Q3 2026 release",sourceUrl:"https://newsroom.amd.com/news/amd-reports-third-quarter-2026-earnings/",
  sourceDay:"2026-11-03",readerHref:"/key-stories?brief=amd-2026q3",
  initialPublishedOn:"2026-11-04",topics:["ai","earnings"],
 },
] as const;

export const DESK_WATCHLIST=[
 {title:"AI leadership vs broad market",instruments:"QQQ · SMH · SOXX · RSP",question:"Is chip weakness spreading, or does AMD's earnings strength bring buyers back?",href:"/markets"},
 {title:"Dollar, bonds and safe havens",instruments:"DXY · US02Y · US10Y · USDJPY · gold",question:"Does the post-election yield and dollar move survive incoming data, or reverse as risk appetite returns?",href:"/markets?group=rates"},
 {title:"Energy / inflation transmission",instruments:"Brent · distillate cracks · Hormuz traffic",question:"Are oil and product prices responding to actual shipping supply, or weaker demand expectations?",href:"/hormuz"},
 {title:"Tomorrow's policy decisions",instruments:"BNM 5 Nov 15:00 MYT · BoE 5 Nov 12:00 GMT",question:"Which banks remain worried about energy inflation, and what changes relative to their previous decisions?",href:"/calendar"},
] as const;
