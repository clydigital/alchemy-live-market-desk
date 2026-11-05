/**
 * Presentation-only, date-pinned readings of source-reviewed issuer receipts.
 * Signals describe documented operating momentum and company outlook, NOT
 * consensus beats, trading recommendations or measured share-price responses.
 * Unknown/new records fail closed; no keyword inference from headlines.
 */
export type EarningsTone = "positive" | "mixed" | "caution" | "unverified";
export type EarningsQuickRead = {
  resultTone: EarningsTone;
  resultLabel: string;
  guidanceTone: EarningsTone;
  guidanceLabel: string;
  interpretation: string;
  guidanceDetail: string;
};

const UNKNOWN: EarningsQuickRead = {
  resultTone: "unverified", resultLabel: "Not assessed",
  guidanceTone: "unverified", guidanceLabel: "Not assessed",
  interpretation: "The original issuer release is available, but a comparable earnings and outlook assessment has not been verified.",
  guidanceDetail: "Company guidance has not been independently reconciled in this desk record.",
};

const READINGS: Readonly<Record<string, EarningsQuickRead>> = {
  "DASH|2026-10-29": {
    resultTone: "positive", resultLabel: "Sales and cash grew",
    guidanceTone: "unverified", guidanceLabel: "Not assessed",
    interpretation: "Revenue grew 34% year on year and free cash flow was $787m. The acquisition and organic order mix still need scrutiny.",
    guidanceDetail: "No comparable forward sales or earnings range is established in this receipt.",
  },
  "SHOP|2026-11-03": {
    resultTone: "positive", resultLabel: "Growth with cash",
    guidanceTone: "unverified", guidanceLabel: "Not assessed",
    interpretation: "Revenue rose 32% year on year with a 22% issuer-defined free-cash-flow margin. The Q4 cash margin is the next test.",
    guidanceDetail: "The Q4 gross-profit outlook is not quantified in this calendar receipt.",
  },
  "NVO|2026-11-04": {
    resultTone: "unverified", resultLabel: "Figures unchecked",
    guidanceTone: "unverified", guidanceLabel: "Not assessed",
    interpretation: "The issuer has announced nine-month results, but comparable financial figures and consensus are not reconciled here.",
    guidanceDetail: "Read the original release before interpreting management guidance.",
  },
  "AMD|2026-11-03": {
    resultTone: "mixed", resultLabel: "AI up, cash down",
    guidanceTone: "positive", guidanceLabel: "Higher sales target",
    interpretation: "Data Centre sales rose 97% year on year, but quarterly free cash flow fell about 64%. Growth has not yet translated into steadier cash.",
    guidanceDetail: "Management targets Q4 revenue of about $17bn ±3% versus Q3's $13.377bn; this is not an analyst-consensus comparison.",
  },
  "AAPL|2026-11-02": {
    resultTone: "positive", resultLabel: "Record sales",
    guidanceTone: "unverified", guidanceLabel: "Not assessed",
    interpretation: "Revenue rose 12% year on year and operating profit was strong. The AI payoff and matched quarterly free cash flow remain unmeasured.",
    guidanceDetail: "No directly comparable forward revenue or earnings target is established in this review.",
  },
  "PLTR|2026-11-02": {
    resultTone: "positive", resultLabel: "Growth with cash",
    guidanceTone: "unverified", guidanceLabel: "Not assessed",
    interpretation: "Revenue grew 96% year on year and derived quarterly free cash flow was positive. Contract conversion and valuation remain the catch.",
    guidanceDetail: "This record does not establish a quantified same-basis forward guidance comparison.",
  },
  "AMZN|2026-10-29": {
    resultTone: "mixed", resultLabel: "AWS up, FCF down",
    guidanceTone: "unverified", guidanceLabel: "Not assessed",
    interpretation: "AWS revenue grew 39% year on year, but the last 12 months produced negative free cash flow after heavy infrastructure spending.",
    guidanceDetail: "The outlook here is a cash-conversion test, not a quantified forward company forecast.",
  },
  "INTC|2026-10-29": {
    resultTone: "mixed", resultLabel: "Quarter improved",
    guidanceTone: "caution", guidanceLabel: "PC outlook weak",
    interpretation: "Q3 sales and margin improved, but Q4 revenue guidance and persistent PC weakness challenge a straightforward recovery.",
    guidanceDetail: "Management guided Q4 revenue to $15bn–$16bn and warned PC weakness could persist into the first half of 2027.",
  },
  "SNDK|2026-10-29": {
    resultTone: "positive", resultLabel: "Sales and cash strong",
    guidanceTone: "positive", guidanceLabel: "Higher sales target",
    interpretation: "Data-centre sales rose 61% sequentially and quarterly free cash flow was positive; sustainable pricing is the next test.",
    guidanceDetail: "Fiscal Q2 revenue guidance of $12.2bn–$12.6bn is above the reported Q1 revenue of $11.031bn.",
  },
  "000660.KS|2026-10-28": {
    resultTone: "positive", resultLabel: "Memory profits surged",
    guidanceTone: "caution", guidanceLabel: "Capex rising",
    interpretation: "Memory sales and profit accelerated, but this preliminary release does not yet establish quarterly cash after investment.",
    guidanceDetail: "Management expects next-year investment to rise significantly; the actual outlay is not yet reported here.",
  },
  "TSM|2026-10-15": {
    resultTone: "positive", resultLabel: "Above own guide",
    guidanceTone: "mixed", guidanceLabel: "Capex commitment",
    interpretation: "Revenue and margin exceeded the company's own range, with higher free cash flow. Longer-term spending still needs to earn its return.",
    guidanceDetail: "Management reiterated 2026 capex of $60bn–$64bn and expects greater spending over 2026–28; this is not analyst-consensus guidance.",
  },
};

export function earningsQuickRead(ticker: string, releaseDay: string): EarningsQuickRead {
  return READINGS[ticker + "|" + releaseDay] ?? UNKNOWN;
}
