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

export const CHART_WATCH_PUBLIC_APPROVALS: readonly ChartWatchApproval[] = [];

/** Only source-qualified, chart-verified and explicitly rights-cleared
 * editorial reports can be labelled as published Chart Watch entries.
 * A title, ticker mention or a research draft cannot confer membership.
 */
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
        item.readerHref !== approval.readerPath ||
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
