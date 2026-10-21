import type { CSSProperties } from "react";

export const MARKET_ICON_NAMES = ["home", "market", "deep-dive", "research", "library", "calendar", "learn", "studio", "rates", "bond", "curve", "currency", "gold", "oil", "energy", "credit", "inflation", "ai", "chip", "factory", "equities", "volatility", "divergence", "risk", "shield", "source", "evidence", "transmission", "catalyst", "chart", "compare", "global", "layers", "watch", "spark", "download", "copy", "arrow-up", "arrow-down", "check"] as const;
export type MarketIconName = typeof MARKET_ICON_NAMES[number];

/** Standalone decorative glyph; give a title only if the adjacent label is absent. */
export function MarketIcon({
  name, size = 20, title, className,
}: { name: MarketIconName; size?: number; title?: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24" width={size} height={size} className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      fill="none" stroke="currentColor" strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round"
      style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 } as CSSProperties}
    >
      <use href={`/market-iconography/sprite.svg#bb-${name}`} />
    </svg>
  );
}
