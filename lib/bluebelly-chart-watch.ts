import type { NewsroomEditorialItem } from "./bluebelly-newsroom-editorial.ts";
import { isPublicVisualEligible, type VisualPayload } from "./bluebelly-visual-evidence.ts";

/** Editorial *series* membership, never an automatically inferred market verdict.
 * Approvals are source-exact and refer only to already public, reviewed readers.
 * The list starts empty: private Chart Watch research is not public content.
 */
export type ChartWatchApproval = {
  editorialId: string;
  sourceUrl: string;
  readerPath: string;
  reviewReceiptId: string;
  publicChartRights: true;
  visual: VisualPayload;
};

/** First owner-authorised public editorial. Licence clearance is limited to
 * Bluebelly-created figures of financial facts in AMD's own issuer release:
 * no copied financial graphics and no redistribution of vendor price feeds.
 * Actual owner approval/review log is the referenced Notion page ID.
 */
export const CHART_WATCH_PUBLIC_APPROVALS: readonly ChartWatchApproval[] = [
 {
  editorialId:"earnings-release:amd-2026q3",
  sourceUrl:"https://newsroom.amd.com/news/amd-reports-third-quarter-2026-earnings/",
  readerPath:"/key-stories?brief=amd-2026q3",
  reviewReceiptId:"40e519b6-7a94-8132-9f7c-f29dee2178bf",
  publicChartRights:true,
  visual:{
   schema_version:"bluebelly.visual.v1",
   visual_id:"cw-amd-q3-2026-reportable-segment-revenue",
   kind:"bar",
   title:"AMD reportable segment revenue: Q3 2025 versus Q3 2026",
   description:"Issuer reported Q3 Data Centre +97% year on year while total company revenue grew 45%; compare separate reportable segments, no company price series.",
   unit:"US$ billion",
   as_of_et:"2026-11-03T18:44:34-05:00",
   retrieved_at:"2026-11-03T23:44:34Z",
   period_basis:"Fiscal quarters ended 27 Sep 2025 and 26 Sep 2026. Original issuer Q3 2026 release dated 3 Nov 2026.",
   columns:["Business segment","Q3 2025 US$bn","Q3 2026 US$bn"],
   rows:[["Data Centre",4.341,8.546],["Client & Gaming",4.048,3.722],["Embedded",0.857,1.109]],
   series:[{name:"Q3 2025",values:[4.341,4.048,.857]},{name:"Q3 2026",values:[8.546,3.722,1.109]}],
   sources:[
    {url:"https://newsroom.amd.com/news/amd-reports-third-quarter-2026-earnings/",publisher:"AMD Investor Relations",observed_at:"2026-11-03T23:44:34Z"},
    {url:"https://www.sec.gov/Archives/edgar/data/2488/000000248826000188/amdq32026earningsslidesf.htm",publisher:"US SEC, accession 0000002488-26-000188",observed_at:"2026-11-03T23:44:34Z"},
   ],
   evidence_status:"ORIGINAL_VERIFIED",
   limitations:["Issuer-published financial facts plotted in an original Bluebelly SVG; not a copied chart or third-party price-feed redistribution.","Quarterly cash-flow facts are in the full article; no pre-release analyst-consensus or next regular-session market reaction is asserted."],
  },
 }
];

/** Only source-qualified, chart-verified and explicitly rights-cleared
 * editorial reports can be labelled as published Chart Watch entries.
 * A title, ticker mention or a research draft cannot confer membership.
 */
/** Both the public host's clean route and the non-public preview's exact
 * /blue-desk alias denote the same existing reader, without opening any
 * arbitrary route. Query-string identity stays byte-for-byte strict. */
function canonicalReaderPath(path:string):string{
 return path.startsWith("/blue-desk/key-stories")
  ?path.slice("/blue-desk".length):path;
}
function publicReaderPath(path: string): boolean {
  return /^\/(?:blue-desk\/)?key-stories(?:\?|$)/.test(path) &&
    !path.includes("\\") && !path.includes("//") &&
    !/[\r\n]/.test(path);
}

export function isPublishedChartWatch(
  item: NewsroomEditorialItem,
): boolean {
  const approved = item.chartWatch;
  return !!approved &&
    approved.reviewReceiptId.trim().length > 5 &&
    approved.publicChartRights === true &&
    publicReaderPath(item.readerHref) &&
    item.sourceUrl.startsWith("https://") &&
    isPublicVisualEligible(approved.visual);
}

/** The reviewed Newsroom list remains the authority: an approval alone
 * cannot introduce a new article, private source or alternate public route.
 */
export function applyChartWatchApprovals(
  editorials: readonly NewsroomEditorialItem[],
  approvals: readonly ChartWatchApproval[] = CHART_WATCH_PUBLIC_APPROVALS,
): NewsroomEditorialItem[] {
  const duplicateIds = new Set<string>();
  const byId = new Map<string, ChartWatchApproval>();
  for (const approval of approvals) {
    if (byId.has(approval.editorialId)) duplicateIds.add(approval.editorialId);
    else byId.set(approval.editorialId, approval);
  }
  return editorials.map(item => {
    const approval = byId.get(item.id);
    if (!approval || duplicateIds.has(item.id) ||
        item.sourceUrl !== approval.sourceUrl ||
        canonicalReaderPath(item.readerHref) !== approval.readerPath ||
        !publicReaderPath(item.readerHref) ||
        !approval.reviewReceiptId.trim() ||
        approval.publicChartRights !== true ||
        !isPublicVisualEligible(approval.visual)) return item;
    const enriched: NewsroomEditorialItem = {
      ...item,
      chartWatch: {
        reviewReceiptId: approval.reviewReceiptId,
        publicChartRights: true,
        visual: approval.visual,
      },
    };
    return isPublishedChartWatch(enriched) ? enriched : item;
  });
}

export function publishedChartWatchCount(
  editorials: readonly NewsroomEditorialItem[],
): number {
  return editorials.filter(isPublishedChartWatch).length;
}
