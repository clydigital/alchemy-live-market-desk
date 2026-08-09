export type LiveDeskRoute = {
  label: string;
  href: string;
  description: string;
};

export const deskRoutes: LiveDeskRoute[] = [
  { label: "Overview", href: "/", description: "Research status and current desk state" },
  { label: "What’s New", href: "/whats-new", description: "Material deltas, statements and intake" },
  { label: "Stories", href: "/stories", description: "Persistent theses and event history" },
  { label: "Articles", href: "/articles", description: "Published coverage and article memory" },
  { label: "Hybrid Output", href: "/hybrid-output", description: "Audit the Live-to-Hybrid handoff" },
];

export const dataRoutes: LiveDeskRoute[] = [
  { label: "Markets", href: "/markets", description: "Cross-asset prices, momentum, anomalies and physical-flow monitors" },
  { label: "Macro Data", href: "/data/macro", description: "Releases, components and observations" },
  { label: "Heatmaps", href: "/data/heatmaps", description: "State, breadth and historical context" },
  { label: "Positioning", href: "/data/positioning", description: "CFTC-derived positioning context" },
  { label: "Charts", href: "/tools/charts", description: "Story-linked chart requests and library" },
  { label: "History", href: "/tools/history", description: "Research runs, changes and audit trail" },
];

const legacyTabMap: Record<string, string> = {
  overview: "/",
  "market state": "/data/heatmaps",
  "market-state": "/data/heatmaps",
  markets: "/markets",
  market: "/markets",
  research: "/whats-new",
  "research layer": "/whats-new",
  "research-layer": "/whats-new",
  stories: "/stories",
  articles: "/articles",
  "ai news": "/whats-new?filter=ai",
  "ai-news": "/whats-new?filter=ai",
  oil: "/stories?filter=oil",
  "oil system": "/stories?filter=oil",
  "oil-system": "/stories?filter=oil",
  breadth: "/data/heatmaps?filter=breadth",
  macro: "/data/macro",
  "macro data": "/data/macro",
  "macro-data": "/data/macro",
  calendar: "/data/macro?view=calendar",
  "economic calendar": "/data/macro?view=calendar",
  "economic-calendar": "/data/macro?view=calendar",
  guidance: "/stories?filter=guidance",
  statements: "/whats-new?filter=statements",
  signals: "/data/heatmaps?view=signals",
  earnings: "/articles?view=earnings",
  charts: "/tools/charts",
  ledger: "/tools/history",
};

export function legacyTabRedirect(tab: string | undefined) {
  if (!tab) return null;
  const normalised = decodeURIComponent(tab).trim().toLowerCase();
  return legacyTabMap[normalised] || null;
}
