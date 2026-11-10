/**
 * Finite, public-approved manual editorial reading index.
 * Each entry points to an EXISTING publicly readable, independently dated
 * article. This list does not ingest Notion, owner research, private PDFs,
 * creator transcripts or canonical evidence and does not approve new content.
 *
 * Additions require an existing public reader, source/provenance review and
 * a fixed historical research as-of. A render or a re-publication is not a
 * new market event.
 */
export const PUBLIC_RESEARCH_CATEGORIES = [
  "All", "AI & Earnings", "Rates & Bonds", "Energy & Geopolitics", "Markets & Policy",
] as const;
export type PublicResearchCategory = Exclude<(typeof PUBLIC_RESEARCH_CATEGORIES)[number],"All">;
export type PublicResearchEdition = {
  id: string;
  title: string;
  summary: string;
  href: string;
  category: PublicResearchCategory;
  asOf: string; // Fixed original research date, never derived from request or deploy time
  editorialUpdatedAt?:string; // Distinct authenticated/editorial release receipt, not source retrieval
  type: "Manual investigation" | "Dated editorial analysis";
  context: string;
  keywords: readonly string[];
};

const INDEX: readonly PublicResearchEdition[] = [
  {
    id:"market-desk-4-nov",title:"The Midterm Shock Faded. Why Are Bonds, AI and Central Banks Disagreeing?",
    summary:"4 November source-led post-election reversal, AMD cash conversion, the Riksbank hike and tomorrow’s BoE/BNM policy tests.",
    href:"/key-stories?feature=market-desk-4-nov-2026",category:"Markets & Policy",
    asOf:"2026-11-04",type:"Dated editorial analysis",
    context:"4 November market observations and primary releases; not a live price tape",
    keywords:["democrats","midterms","blue wave","riksbank","sweden","amd","earnings","dollar","bonds","treasury","ai","bnm","boe"],
  },
  {
    id:"midterm-seasonality",
    title:"Stocks Always Rose After Midterms. What Could Break the Streak?",
    summary:"Historical midterm performance with a separately dated 4 November post-election update on AI regulation fears, dollar weakness and the market rebound.",
    href:"/key-stories?feature=midterms-seasonality-2026",
    category:"Markets & Policy",asOf:"2026-11-02",type:"Dated editorial analysis",
    context:"Original analysis frozen 2 November; new results and reaction added in a separate 4 November section",editorialUpdatedAt:"2026-11-04T09:58:00Z",
    keywords:["midterms","congress","sectors","elections","breadth","spy","qqq"],
  },
  {
    id:"earnings-week-nov2",
    title:"Who Keeps the Cash from the AI Boom?",
    summary:"The 2–6 November earnings week examined issuer margins, spending, guidance and the cash conversion tests facing the AI and power supply chains.",
    href:"/earnings-week",
    category:"AI & Earnings",asOf:"2026-11-02",type:"Dated editorial analysis",
    context:"Pre-earnings week research; subsequent results require separate verification",
    keywords:["amd","palantir","apple","eaton","super micro","navitas","qualcomm","ai","earnings","capex"],
  },
  {
    id:"ai-selloff",
    title:"The 30 October AI Sell-off: Crash or Opportunity?",
    summary:"An intraday, source-dated explanation of the technology sell-off, earnings expectations, liquidity and conditions for a rebound.",
    href:"/key-stories?feature=ai-cash-selloff-october-2026",
    category:"AI & Earnings",asOf:"2026-10-30",type:"Dated editorial analysis",
    context:"Intraday observation; not a confirmed final-session crash",
    keywords:["tech","equities","semiconductors","ai","mags","crash","rebound"],
  },
  {
    id:"amazon-cash-test",
    title:"Amazon's AI Spending: Will the Cash Come Back?",
    summary:"How AWS profits, investment commitments and the cost of future computing capacity change the investor's verdict.",
    href:"/key-stories?feature=amazon-cash-test-october-2026",
    category:"AI & Earnings",asOf:"2026-10-29",type:"Dated editorial analysis",
    context:"Historical pre-results cash-flow investigation",
    keywords:["amazon","amzn","aws","capex","cash flow","hyperscalers"],
  },
  {
    id:"fomc-october",
    title:"October FOMC: The Rate Decision Versus the Bond Market",
    summary:"An examination of the policy statement, dissents, the short- and long-end Treasury response, and what would change the reading.",
    href:"/key-stories?feature=fomc-october-2026",
    category:"Rates & Bonds",asOf:"2026-10-28",type:"Dated editorial analysis",
    context:"October meeting snapshot; not today's Fed guidance",
    keywords:["fomc","fed","warsh","treasury","yields","bonds","rates","2y","30y"],
  },
  {
    id:"rbnz-october",
    title:"RBNZ Holds: Why the Decision Surprised Rate Traders",
    summary:"The New Zealand central bank's inflation-versus-growth dilemma, changing rate expectations and the NZD response.",
    href:"/key-stories?feature=rbnz-october-2026",
    category:"Rates & Bonds",asOf:"2026-10-28",type:"Dated editorial analysis",
    context:"October decision and source-dated market context",
    keywords:["rbnz","nzd","new zealand","central bank","rates"],
  },
  {
    id:"asia-equities",
    title:"Asia's AI Trade Is Splitting in Two",
    summary:"China's AI valuation reset versus Korea's chip recovery, Taiwan's realised earnings and Japan's currency-sensitive equity market.",
    href:"/features/asia-equities",
    category:"AI & Earnings",asOf:"2026-10-27",type:"Manual investigation",
    context:"Frozen 27 October Asia market closes",
    keywords:["china","japan","taiwan","korea","semiconductor","tsmc","sk hynix","asia","ai"],
  },
  {
    id:"global-bonds",
    title:"France's Bond Scare: The Greece Lesson",
    summary:"French sovereign borrowing costs, fiscal stress and the difference between a local bond scare and evidence of broader contagion.",
    href:"/features/global-bonds",
    category:"Rates & Bonds",asOf:"2026-10-27",type:"Manual investigation",
    context:"Source observations from 22–27 October",
    keywords:["france","greece","oat","bund","bonds","credit","europe","sovereign"],
  },
];

export const PUBLIC_RESEARCH_INDEX: readonly PublicResearchEdition[] = Object.freeze(
  [...INDEX].sort((a,b)=>b.asOf.localeCompare(a.asOf)||a.id.localeCompare(b.id)),
);

export function selectPublicResearch(query: string, category: string): PublicResearchEdition[] {
  const safeCategory = PUBLIC_RESEARCH_CATEGORIES.includes(category as (typeof PUBLIC_RESEARCH_CATEGORIES)[number])
    ? category : "All";
  const needle = typeof query === "string" ? query.trim().slice(0,100).toLocaleLowerCase("en-GB") : "";
  return PUBLIC_RESEARCH_INDEX.filter(item=>{
    if(safeCategory!=="All" && item.category!==safeCategory)return false;
    return !needle || [item.title,item.summary,item.category,item.context,...item.keywords]
      .some(value=>value.toLocaleLowerCase("en-GB").includes(needle));
  });
}

/** No manual edition qualifies for a fresh news slot merely by being in this
 * index. Home promotion must reference a separately source-qualified, recent
 * real event, never this array's publication/research timestamps. */
export const MANUAL_RESEARCH_AUTOPROMOTION_ENABLED = false;
