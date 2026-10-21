/**
 * Read-only source coverage diagnostic for the existing market Motion intake.
 * This does not verify any story, reinterpret a news event or publish a claim.
 * A quiet public News Brief feed must not silently masquerade as a healthy
 * first-party discovery pipeline.
 */
export const ORIGINAL_NEWS_COVERAGE_WINDOW_MS = 48 * 60 * 60 * 1000;

type NewsItem = {
  itemType: string;
  publishedAt: string;
  url: string;
};
type MotionCandidate = {
  sourceKind?: string | null;
  verificationState?: string | null;
  occurredAt?: string | null;
};

function occurredRecently(value: string | null | undefined, now: number) {
  const time = Date.parse(value || "");
  return Number.isFinite(time) && time <= now
    && now - time <= ORIGINAL_NEWS_COVERAGE_WINDOW_MS;
}
function attributableUrl(input: string) {
  try {
    const u = new URL(input);
    return u.protocol === "https:" && !u.username && !u.password && u.hostname.includes(".")
      && (u.pathname !== "/" || Boolean(u.search));
  } catch {
    return false;
  }
}

export function diagnoseCurrentRunOriginalNewsCoverage(
  items: readonly NewsItem[],
  candidates: readonly MotionCandidate[],
  now: Date,
): string[] {
  const time = now.getTime();
  if (!Number.isFinite(time)) return ["CURRENT_NEWS_COVERAGE_CLOCK_INVALID"];
  const freshNews = items.filter(item => item.itemType === "news"
    && occurredRecently(item.publishedAt, time) && attributableUrl(item.url));
  if (!freshNews.length) return [];
  const freshOriginal = candidates.filter(candidate =>
    ["official", "primary", "filing"].includes(candidate.sourceKind || "")
    && candidate.verificationState === "VERIFIED"
    && occurredRecently(candidate.occurredAt, time));
  if (freshOriginal.length) return [];
  const freshReporting = candidates.filter(candidate =>
    candidate.sourceKind === "reporting"
    && occurredRecently(candidate.occurredAt, time));
  return [
    "CURRENT_RUN_ORIGINAL_VERIFIED_NEWS_GAP: fresh_news="
    + freshNews.length + "; reported_motion_candidates=" + freshReporting.length
    + "; original_verified_motion_candidates=0",
  ];
}
