/**
 * A small, explicitly source-qualified public snapshot of RECENT RELEASED
 * company results. Not a live consensus API, and not an earnings calendar.
 * Future results are admitted only with exact primary-source/period proof.
 *
 * Stale snapshots expire rather than masquerading as the latest quarter.
 */
export type EarningsScorecardMetric = {
  name: "Revenue" | "Operating profit / margin" | "Free cash flow" | "Capital expenditure";
  value: string | null;
  comparison: string | null;
  state: "measured" | "not_verified";
  note?: string;
};
export type VerifiedEarningsScorecard = {
  id: string;
  ticker: string;
  company: string;
  fiscalPeriod: string;
  releaseDay: string;
  sourceName: string;
  sourceUrl: string;
  additionalSourceUrl?: string;
  basis: string;
  headline: string;
  beatMiss: string;
  beatSource: "pre_release_consensus" | "company_guidance" | "unavailable";
  metrics: [EarningsScorecardMetric,EarningsScorecardMetric,EarningsScorecardMetric,EarningsScorecardMetric];
  outlook: string;
  conclusion: string;
  nextTest: string;
  preliminary: boolean;
  /** Conservative public availability gate for US after-close dated receipts; NOT a claimed issuer release timestamp. */
  availableNotBefore?: string;
};

const PRIMARY_RESULTS: readonly VerifiedEarningsScorecard[] = [
  // Individually verified issuer releases, dated 29 Oct 2026 after the US close.
  // These are editorial source-reviewed receipts, not automatically admitted
  // canonical Evidence UUIDs or same-basis consensus surprises.
  {
    id:"amazon-2026q3",ticker:"AMZN",company:"Amazon",fiscalPeriod:"Q3 2026",
    releaseDay:"2026-10-29",availableNotBefore:"2026-10-30T00:00:00Z",
    sourceName:"Amazon Investor Relations · Q3 original",
    sourceUrl:"https://ir.aboutamazon.com/news-release/news-release-details/2026/Amazon-com-Announces-Third-Quarter-Results/default.aspx",
    basis:"US GAAP reported quarter ended 30 September 2026; issuer-defined FCF is TRAILING TWELVE MONTHS",
    headline:"Amazon's AWS accelerates, but its infrastructure bill overwhelms trailing cash.",
    beatMiss:"No matching pre-release analyst consensus is verified here. Operating results and financing cash-flow data are not the same as an EPS surprise.",
    beatSource:"unavailable",
    metrics:[
      {name:"Revenue",value:"$201.9bn",comparison:"+12% YoY; AWS $46.0bn, +39% YoY",state:"measured"},
      {name:"Operating profit / margin",value:"$28.1bn · 13.9% margin",comparison:"vs $17.4bn Q3 2025",state:"measured"},
      {name:"Free cash flow",value:"−$42.357bn · TTM",comparison:"vs +$14.788bn TTM year earlier",state:"measured",
       note:"TTM is NOT the single Q3 result. Separately, Q3 operating cash $42.422bn less net equipment purchases $75.878bn = approximately −$33.456bn for Q3."},
      {name:"Capital expenditure",value:"$77.259bn gross cash PP&E · Q3",comparison:"vs $35.095bn in Q3 2025",state:"measured",
       note:"Gross Q3 cash PP&E before $1.381bn equipment-sale/incentive proceeds; distinct from net TTM PP&E purchases $210.657bn and full-year planned capex."},
    ],
    outlook:"AWS sales +39% and operating profit $17.8bn support infrastructure demand; free cash flow after investment is the unresolved shareholder-return test.",
    conclusion:"The cloud business is expanding quickly, and consolidated operating profit is growing. Yet the last twelve months produced negative free cash flow because investment outpaced operating cash. That does not prove AWS itself lost money or AI orders were cancelled.",
    nextTest:"Q4 operating cash versus net cash capex, 2027 spending guidance, AWS paid utilisation and borrowing costs.",
    preliminary:false,
  },
  {
    id:"intel-2026q3",ticker:"INTC",company:"Intel",fiscalPeriod:"Q3 2026",
    releaseDay:"2026-10-29",availableNotBefore:"2026-10-30T00:00:00Z",
    sourceName:"Intel · SEC-filed Q3 original",
    sourceUrl:"https://www.intc.com/filings-reports/all-sec-filings/content/0000050863-26-000188/q326earningsrelease.htm",
    basis:"US GAAP quarter ended 26 September 2026; guidance Q4 2026; adjusted EPS is separately identified",
    headline:"Intel's quarter improved, but a weaker PC outlook challenges the recovery.",
    beatMiss:"Issuer says Q3 exceeded its own guidance; analyst-consensus beat/miss is not established in this source-reviewed scorecard.",
    beatSource:"company_guidance",
    metrics:[
      {name:"Revenue",value:"$16.5bn",comparison:"+21% YoY; Data Center and AI segment $7.3bn, +78% YoY",state:"measured"},
      {name:"Operating profit / margin",value:"$2.522bn · 15.3% GAAP margin",comparison:"vs $0.683bn · 5.0% a year earlier",state:"measured"},
      {name:"Free cash flow",value:null,comparison:null,state:"not_verified",
       note:"Q3 operating cash $5.1bn was reported; no issuer-definition-compatible Q3 FCF bridge has been validated for this public snapshot."},
      {name:"Capital expenditure",value:null,comparison:null,state:"not_verified",
       note:"Do not infer Q3 net cash capital spending or free cash flow from full-year plans or unrelated estimates."},
    ],
    outlook:"Q4 revenue guidance $15.0–16.0bn and GAAP EPS $0.10; management expects PC weakness to continue into at least the first half of 2027.",
    conclusion:"The reported quarter shows progress, especially in data centres, but the next-quarter sales outlook and PC-market weakness warn against treating the recovery as settled.",
    nextTest:"Q4 sales and gross margin versus issuer guidance, PC CPU demand and actual foundry customer profitability.",
    preliminary:false,
  },
  {
    id:"sandisk-fy2027q1",ticker:"SNDK",company:"Sandisk",fiscalPeriod:"Fiscal Q1 2027",
    releaseDay:"2026-10-29",availableNotBefore:"2026-10-30T00:00:00Z",
    sourceName:"Sandisk Investor Relations · FY27 Q1 original",
    sourceUrl:"https://investor.sandisk.com/news-releases/news-release-details/sandisk-reports-fiscal-first-quarter-2027-financial-results",
    basis:"US GAAP fiscal quarter ended 2 October 2026; cash after net PP&E; non-GAAP figures separate",
    headline:"Sandisk data-centre revenue jumps 61% sequentially, a different chip-market story.",
    beatMiss:"No dated same-basis analyst consensus verified. Company-reported sequential growth is not an analyst-consensus beat.",
    beatSource:"unavailable",
    metrics:[
      {name:"Revenue",value:"$11.031bn",comparison:"+23% QoQ; data-centre $4.802bn, +61% QoQ",state:"measured"},
      {name:"Operating profit / margin",value:"$8.780bn · 79.6% GAAP margin",comparison:"vs $7.037bn prior quarter; margin derived from sales",state:"measured"},
      {name:"Free cash flow",value:"$6.309bn · Q1",comparison:"vs $7.083bn prior quarter",state:"measured",
       note:"Issuer FCF = $6.363bn operating cash less $0.054bn net cash PP&E; adjusted FCF after Flash Ventures and prepayments was $5.696bn, not interchangeable."},
      {name:"Capital expenditure",value:"$54m net cash PP&E · Q1",comparison:"vs $43m prior quarter",state:"measured",
       note:"Separate this small net PP&E amount from manufacturing joint-venture funding, deposits and future investment commitments."},
    ],
    outlook:"Fiscal Q2 2027 revenue guidance $12.2–12.6bn. The 8-for-1 split planned for 19 November changes the per-share basis, not total company value.",
    conclusion:"Storage demand and current cash production are strong. It is not a simple all-chips rally: customer concentration, unusually high margins and sustainable pricing must be tested against a different PC-demand cycle.",
    nextTest:"Next-quarter data-centre volumes versus pricing, adjusted FCF after Flash Ventures/prepayments, and split-adjusted comparable EPS.",
    preliminary:false,
  },
  {
    id:"sk-hynix-2026q3",
    ticker:"000660.KS",
    company:"SK hynix",
    fiscalPeriod:"Q3 2026",
    releaseDay:"2026-10-28",
    sourceName:"SK hynix · original Q3 results",
    sourceUrl:"https://news.skhynix.com/en/q3-2026-business-results/",
    basis:"Consolidated K-IFRS · KRW trillion · preliminary quarterly disclosure",
    headline:"Memory-chip earnings jumped; the cash-spending test is still open.",
    beatMiss:"No verified comparable pre-release analyst consensus in this scorecard. Do not call this a beat.",
    beatSource:"unavailable",
    metrics:[
      {name:"Revenue",value:"₩104.62tn",comparison:"↑ 328% YoY · ↑ 32% QoQ",state:"measured"},
      {name:"Operating profit / margin",value:"₩83.33tn · 80% margin",comparison:"↑ 632% YoY · ↑ 38% QoQ",state:"measured"},
      {name:"Free cash flow",value:null,comparison:null,state:"not_verified",note:"No standalone quarterly FCF amount established in this preliminary release; shareholder-return targets are not an FCF reading."},
      {name:"Capital expenditure",value:null,comparison:null,state:"not_verified",note:"Actual Q3 cash capex and YoY change not established. Management expects next year's investment to increase significantly; this is a forecast, not money already spent."},
    ],
    outlook:"HBM4 expected to become a mainstream product in Q4; long-term customer agreements cover over half of 2027–28 production capacity. Management expects next-year investment to rise significantly.",
    conclusion:"The chip supplier is earning far more from AI-memory demand, but this release alone cannot establish whether free cash flow rose after the cost of building new capacity.",
    nextTest:"Audited or detailed Q3 cash-flow statement, actual capital expenditure, HBM4 sales mix and customer commitments.",
    preliminary:true,
  },
  {
    id:"tsmc-2026q3",
    ticker:"TSM",
    company:"TSMC",
    fiscalPeriod:"Q3 2026",
    releaseDay:"2026-10-15",
    sourceName:"TSMC · official Q3 earnings and guidance",
    sourceUrl:"https://investor.tsmc.com/english/quarterly-results/2026/q3",
    additionalSourceUrl:"https://investor.tsmc.com/english/encrypt/files/encrypt_file/qr/phase4_reports/2026-10/6996be551d904f126c5521bd349b85be71cea0d6/3Q26%20Presentation%20%28E%29_WoG.pdf",
    basis:"TIFRS consolidated · NT$ revenue and profit (USD revenue shown separately); issuer guidance is not analyst consensus",
    headline:"Revenue beat management's range; an analyst-consensus beat is not established here.",
    beatMiss:"Revenue $46.72bn versus management's $44.6–45.8bn guidance; operating margin 58.7% versus its 56–58% guidance. These are COMPANY GUIDANCE comparisons, not analyst-consensus beats.",
    beatSource:"company_guidance",
    metrics:[
      {name:"Revenue",value:"NT$1,494.24bn (US$46.72bn)",comparison:"↑ 50.9% YoY in NT$ · above management's US$44.6–45.8bn range",state:"measured"},
      {name:"Operating profit / margin",value:"NT$876.45bn · 58.7% margin",comparison:"↑ 75.0% YoY · margin ↑ 8.1pp YoY; above 56–58% guidance",state:"measured"},
      {name:"Free cash flow",value:"NT$476.56bn",comparison:"↑ 241.9% YoY · ↑ 65.8% QoQ",state:"measured",note:"Issuer definition: Q3 operating cash flow NT$919.77bn minus cash capex NT$443.21bn. Q3 2025 FCF was NT$139.38bn."},
      {name:"Capital expenditure",value:"NT$443.21bn spent in Q3",comparison:"↑ 54.2% YoY · ↓ 10.6% QoQ",state:"measured",note:"Separate from the reiterated US$60–64bn planned FULL-YEAR 2026 capital budget. Q3 2025 cash capex was NT$287.45bn."},
    ],
    outlook:"Management reiterated its US$60–64bn full-year 2026 capital budget, while projecting higher capital spending over 2026–28 than in the preceding three years.",
    conclusion:"TSMC generated more cash after capital spending even as its annual capex bill grew. Its quarter-on-quarter capex fell, a reminder that planned annual investment and cash spent in one quarter are different numbers.",
    nextTest:"Q4 operating cash flow, actual cash capex, margin guidance and whether next year's investment keeps delivering higher cash returns.",
    preliminary:false,
  },
];

/** Calendar-aligned selection. Never show future or aged data as a current result. */
export function getRecentVerifiedEarningsScorecards(now=new Date(),lookbackDays=30):VerifiedEarningsScorecard[] {
  const nowMs=now.getTime();
  if(!Number.isFinite(nowMs)||!Number.isInteger(lookbackDays)||lookbackDays<1||lookbackDays>90)return [];
  return PRIMARY_RESULTS.filter(record=>{
    const releasedAt=Date.parse(record.releaseDay+"T00:00:00Z");
    const age=nowMs-releasedAt;
    const notBefore=record.availableNotBefore ? Date.parse(record.availableNotBefore) : releasedAt;
    return Number.isFinite(releasedAt)&&Number.isFinite(notBefore)&&nowMs>=notBefore&&age>=0&&age<=lookbackDays*86400000;
  }).sort((a,b)=>b.releaseDay.localeCompare(a.releaseDay));
}
