/**
 * Display-only sign classification for the public Markets reader.
 *
 * Compare the same two-decimal change that the UI prints, never the
 * unrounded provider delta. This must not mutate market observations.
 */
export type MarketMovementDirection = "up" | "down" | "quiet";

export function displayedMarketChange(change: number | null): number | null {
  if (change === null || !Number.isFinite(change)) return null;
  const rounded = Number(change.toFixed(2));
  return rounded === 0 ? 0 : rounded;
}

export function marketMovementDirection(change: number | null): MarketMovementDirection {
  const displayed = displayedMarketChange(change);
  if (displayed !== null && displayed > 0) return "up";
  if (displayed !== null && displayed < 0) return "down";
  return "quiet";
}
