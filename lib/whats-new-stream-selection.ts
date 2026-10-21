/** Keep persistent Story history findable even when transient Motion leads are numerous.
 * Presentation-only, bounded and chronological; never duplicates or admits evidence. */
export function selectRecentWithStoryReserve<T extends {
  id: string;
  stream: string;
  timestamp: string | null | undefined;
}>(items: readonly T[], limit = 60, storyReserve = 8): T[] {
  const cap = Math.max(0, Math.trunc(limit));
  const reservedCap = Math.min(cap, Math.max(0, Math.trunc(storyReserve)));
  const byTime = (a: T, b: T) =>
    (Date.parse(b.timestamp || "") || 0) - (Date.parse(a.timestamp || "") || 0);
  const sorted = [...items].sort(byTime);
  const stories = sorted.filter((item) => item.stream === "Story").slice(0, reservedCap);
  const selected = new Set(stories);
  const others = sorted.filter((item) => !selected.has(item)).slice(0, cap - stories.length);
  return [...stories, ...others].sort(byTime);
}
