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
};

const PRIMARY_RESULTS: readonly VerifiedEarningsScorecard[] = [
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
    return Number.isFinite(releasedAt)&&age>=0&&age<=lookbackDays*86400000;
  }).sort((a,b)=>b.releaseDay.localeCompare(a.releaseDay));
}
