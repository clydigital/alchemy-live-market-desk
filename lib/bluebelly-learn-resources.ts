/** Public, read-only learning references reviewed 4 November 2026.
 * External links point to publisher-hosted resources. Do not mirror PDFs/PPTX
 * unless a separately reviewed licence explicitly permits redistribution.
 * Educational references are not evidence for live market readings.
 */
export type BluebellyLearnResource = {
  id: string;
  track: "financials" | "valuation" | "psychology";
  title: string;
  publisher: string;
  summary: string;
  format: "PDF slides" | "PDF" | "PDF / PPTX index" | "Webinar + PDF slides" | "Online guide" | "Online course";
  level: "Beginner" | "Intermediate" | "Advanced";
  url: string;
  concepts: string[];
};

export const BLUEBELLY_LEARN_RESOURCES: BluebellyLearnResource[] = [
  {
    id: "fidelity-fundamentals", track: "financials",
    title: "Getting Started With Fundamental Analysis", publisher: "Fidelity",
    summary: "A practical introductory webinar with a downloadable PDF slide deck on company metrics and how to use them.",
    format: "Webinar + PDF slides", level: "Beginner",
    url: "https://www.fidelity.com/learning-center/trading-investing/fundamental-analysis/fundamentals-replay",
    concepts: ["price-to-earnings", "earnings-per-share"],
  },
  {
    id: "mit-financial-statements", track: "financials",
    title: "Financial Statement Analysis — Lecture 5", publisher: "MIT OpenCourseWare",
    summary: "19-page lecture PDF on liquidity, profit ratios, debt-service capacity and financial projections, with business examples.",
    format: "PDF slides", level: "Beginner",
    url: "https://ocw.mit.edu/courses/11-437-financing-economic-development-fall-2016/c73890cc6673869311d8c1f233a5f4e6_MIT11_437F16_Lec5.pdf",
    concepts: ["current-ratio", "quick-ratio", "days-sales-outstanding", "inventory-turnover", "gross-margin", "return-on-assets", "return-on-equity", "interest-coverage", "debt-service-coverage", "common-size-financial-statement", "sensitivity-analysis"],
  },
  {
    id: "sec-financial-guide", track: "financials",
    title: "Beginners' Guide to Financial Statements", publisher: "US Securities and Exchange Commission",
    summary: "An official guide to balance sheets, income statements, cash flows, footnotes and basic valuation ratios.",
    format: "Online guide", level: "Beginner",
    url: "https://www.sec.gov/investor/pubs/begfinstmtguide.htm",
    concepts: ["debt-to-equity", "price-to-earnings", "working-capital"],
  },
  {
    id: "mit-equities-pe", track: "financials",
    title: "Equities — EPS, P/E and Growth Stocks", publisher: "MIT Sloan / Andrew W. Lo",
    summary: "23 lecture slides on dividend valuation, earnings per share, P/E and changing growth expectations; historical examples.",
    format: "PDF slides", level: "Intermediate",
    url: "https://ocw.mit.edu/courses/15-401-finance-theory-i-fall-2008/1aea40b063cad5a335e980ecf30d84b7_MIT15_401F08_lec07.pdf",
    concepts: ["dividend-discount-model", "gordon-growth-model", "price-to-earnings"],
  },
  {
    id: "nyu-relative", track: "valuation",
    title: "Relative Valuation — P/E, PEG and EV/EBITDA", publisher: "NYU Stern / Aswath Damodaran",
    summary: "Lecture packet with PDF and PowerPoint links: compare businesses using multiples without ignoring risk or growth.",
    format: "PDF / PPTX index", level: "Intermediate",
    url: "https://pages.stern.nyu.edu/~adamodar/New_Home_Page/eqlect.htm",
    concepts: ["price-to-earnings", "peg-ratio", "ev-to-ebitda"],
  },
  {
    id: "nyu-dcf", track: "valuation",
    title: "Discounted Cash Flow Valuation", publisher: "NYU Stern / Aswath Damodaran",
    summary: "Lecture packet downloads covering cash flows, discount rates, growth assumptions and terminal value.",
    format: "PDF / PPTX index", level: "Advanced",
    url: "https://pages.stern.nyu.edu/~adamodar/New_Home_Page/eqlect.htm",
    concepts: ["discounted-cash-flow", "terminal-value", "free-cash-flow"],
  },
  {
    id: "nyu-corporate", track: "valuation",
    title: "Corporate Finance — Capital Allocation and Returns", publisher: "NYU Stern / Aswath Damodaran",
    summary: "PDF and presentation packets about hurdle rates, return on investment, financing and dividend policy.",
    format: "PDF / PPTX index", level: "Advanced",
    url: "https://pages.stern.nyu.edu/~adamodar/New_Home_Page/cflect.htm",
    concepts: ["return-on-invested-capital", "debt-to-equity", "discounted-cash-flow"],
  },
  {
    id: "nyu-philosophies", track: "valuation",
    title: "Investment Philosophies — Value, Growth and Timing", publisher: "NYU Stern / Aswath Damodaran",
    summary: "Free topical lecture PDFs on value screens, contrarian investing, growth, efficiency and market timing.",
    format: "PDF", level: "Intermediate",
    url: "https://pages.stern.nyu.edu/adamodar/New_Home_Page/invphilcourse/invphillect.htm",
    concepts: ["margin-of-safety", "price-to-book", "earnings-yield"],
  },
  {
    id: "cfa-behavioral", track: "psychology",
    title: "Behavioral Finance: The Second Generation", publisher: "CFA Institute Research Foundation",
    summary: "Research monograph on cognitive shortcuts, anchoring, loss aversion and how investors actually behave.",
    format: "PDF", level: "Intermediate",
    url: "https://www.cfainstitute.org/sites/default/files/-/media/documents/book/rf-publication/2019/behavioral-finance-the-second-generation.pdf",
    concepts: ["anchoring-bias", "loss-aversion", "confirmation-bias", "framing-effect", "regret-aversion", "overconfidence-bias"],
  },
  {
    id: "cfa-risk-profile", track: "psychology",
    title: "Risk Profiling Through a Behavioral Finance Lens", publisher: "CFA Institute Research Foundation",
    summary: "A focused research PDF distinguishing willingness to take risk from capacity to absorb it, with common biases.",
    format: "PDF", level: "Intermediate",
    url: "https://rpc.cfainstitute.org/-/media/documents/article/rf-brief/rfbr-v2-n1-1-pdf.pdf",
    concepts: ["risk-capacity", "risk-tolerance", "recency-bias"],
  },
  {
    id: "cme-trading-psychology", track: "psychology",
    title: "Trading Psychology", publisher: "CME Group",
    summary: "Practical course on accepting losses, avoiding self-destructive decisions and building a repeatable trading plan.",
    format: "Online course", level: "Beginner",
    url: "https://www.cmegroup.com/education/courses/trading-psychology",
    concepts: ["loss-aversion", "trading-plan", "overconfidence-bias"],
  },
  {
    id: "cme-position-sizing", track: "psychology",
    title: "Proper Position Size", publisher: "CME Group",
    summary: "Risk per trade, stop placement and position sizing from account loss limits and instrument tick values.",
    format: "Online course", level: "Beginner",
    url: "https://www.cmegroup.com/education/courses/trade-and-risk-management/proper-position-size",
    concepts: ["position-sizing", "risk-capacity", "trading-plan"],
  },
  {
    id: "ftmo-psychology", track: "psychology",
    title: "Trading Psychology Course", publisher: "FTMO Academy",
    summary: "Prop-trading-focused modules on awareness, expectations, habits, discipline and emotional stability. Provider-created education.",
    format: "Online course", level: "Beginner",
    url: "https://academy.ftmo.com/psychology-course/",
    concepts: ["trading-plan", "recency-bias", "loss-aversion"],
  },
];
