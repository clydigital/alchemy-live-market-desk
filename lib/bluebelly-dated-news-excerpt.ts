import type { NewsBriefV1 } from "./market-brief-news.ts";

/**
 * Public seven-day reader only. Never render a source notice as substantive
 * evidence, or let an unverified lead borrow the SOURCE_VERIFIED presentation.
 * The verified NewsBrief projection upstream owns original-page provenance.
 */
export function datedNewsSourceExcerpt(
  news: Pick<NewsBriefV1,"verification"|"headline"|"summary">,
): string | null {
  if (news.verification !== "SOURCE_VERIFIED") return null;
  const text = news.summary.trim();
  if (!text || text === news.headline.trim()) return null;
  if (text.startsWith("The original publisher issued this dated announcement.")) return null;
  if (text.startsWith("Original announcement verified.")) return null;
  // An extract is never a blank cheque to print an unlimited feed body.
  return text.length <= 480 ? text : text.slice(0, 477).trimEnd() + "…";
}
