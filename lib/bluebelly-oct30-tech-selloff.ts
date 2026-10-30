/**
 * A dated, reviewed newsroom edition. This is an editor-selected contextual
 * article, not a System 2 event or a substitute for the Market Monitor.
 * Reported asset reactions are INTRADAY on 30 Oct 2026 (14:15 EDT), not a close.
 */
export const OCT30_SELL_OFF = {
  id:"ai-cash-selloff-2026-10-30",
  title:"AI Demand Is Booming. So Why Are Investors Selling?",
  headline:"Tech Stocks Tumble as AI Spending Faces a Cash Test",
  fact:"By 2:15 p.m. EDT on 30 October, the Nasdaq was down about 3.4% and the S&P 500 2.2% in AP's intraday market report. Intel had lost about 30.9%. These are not closing returns.",
  why:"The market is no longer satisfied with growth alone. Amazon's AWS is expanding rapidly, but the group is spending even faster; Intel's next-quarter outlook disappointed. Investors are questioning both the return on AI investment and the valuations already paid.",
  mechanism:"AP reported a broad technology-led sell-off. The earnings releases support concerns about future cash returns, but do not prove any one earnings item caused the entire market decline. A lasting crash would require evidence of broader breadth and credit deterioration.",
  test:"Compare the completed 30 October index, equal-weight and semiconductor closes with high-yield and CCC credit spreads; then follow next week's ISM releases and issuer cash-flow/capex guidance.",
  occurredAt:"2026-10-30T18:15:00.000Z", // AP reported 14:15 EDT snapshot
  activeUntil:"2026-11-03T18:15:00.000Z",
  sourceUrl:"https://apnews.com/article/16c266731fdf64178f38070af2b42497",
  sourceName:"Associated Press · 30 October 2026, 14:15 EDT snapshot",
  href:"?feature=ai-cash-selloff-october-2026",
  assets:["NDX","SPX","AMZN","INTC","GOOGL"],
} as const;
export function oct30SelloffIsLead(now:Date){
  const t=now.getTime();
  return Number.isFinite(t)&&t>=Date.parse(OCT30_SELL_OFF.occurredAt)&&t<Date.parse(OCT30_SELL_OFF.activeUntil);
}
