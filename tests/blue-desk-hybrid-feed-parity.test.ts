import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path: string) =>
  readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("private Blue Desk embeds the actual Hybrid four-tab feed and canonically published data", () => {
  const page = source("app/blue-desk/feed/page.tsx");
  const component = source("components/blue-desk/hybrid-feed/LiveDeskFeed.tsx");
  const research = source("components/blue-desk/hybrid-feed/ResearchDashboard.tsx");
  assert.match(page, /getCanonicalPublicationPayload\(\)/);
  assert.match(page, /getHybridFeedData\(\)/);
  assert.match(page, /<BlueDeskHeader activePath="\/blue-desk\/feed"/);
  assert.match(page, /<LiveDeskFeed feed=\{feed\} data=\{data\} initialTab="research"/);
  assert.match(page, /className="hybridFeedMount"/);
  assert.match(component, /\{ id: "research", label: "Research"/);
  assert.match(component, /\{ id: "state", label: "Market State"/);
  assert.match(component, /\{ id: "calendar", label: "Calendar"/);
  assert.match(component, /\{ id: "earnings", label: "Earnings"/);
  assert.match(component, /className="live-feed-page"/);
  assert.match(component, /className="live-feed-hero"/);
  assert.match(component, /className="live-feed-score"/);
  assert.match(component, /className="live-feed-tabs"/);
  assert.match(component, /className="feed-state-list"/);
  assert.match(component, /className="feed-earnings-layout"/);
  assert.match(component, /<ResearchDashboard/);
  assert.match(research, /className=\{\`research-dashboard /);
  assert.match(research, /className="research-dashboard-grid"/);
});

test("feed keeps Hybrid's original visual selectors, ratios, and fonts instead of invented mock cards", () => {
  const css = source("app/blue-desk/feed/hybrid-feed.css");
  assert.match(css, /Canonical live-desk feed/);
  assert.match(css, /Statistical research dashboard/);
  assert.match(css, /\.live-feed-hero\{display:grid;grid-template-columns:minmax\(0,1\.55fr\) minmax\(260px,\.45fr\)/);
  assert.match(css, /\.live-feed-score\{display:grid;grid-template-columns:repeat\(5,1fr\)/);
  assert.match(css, /\.live-feed-tabs\{display:flex/);
  assert.match(css, /\.feed-state-row/);
  assert.match(css, /\.research-stat-list/);
  assert.match(css, /\.research-narrative/);
  assert.match(css, /\.hybridFeedMount \{/);
  assert.match(css, /Hanken Grotesk/);
  assert.match(css, /JetBrains Mono/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});

test("owner feed never becomes part of public Bluebelly routes or public navigation", () => {
  const host = source("lib/blue-desk-host.ts");
  const nav = source("components/blue-desk/BlueDeskHeader.tsx");
  const middleware = source("middleware.ts");
  const page = source("app/blue-desk/feed/page.tsx");
  assert.match(nav, /\["Hybrid Feed", "\/blue-desk\/feed"\]/);
  const publicNav = nav.slice(nav.indexOf("const PUBLIC_NAV"), nav.indexOf("const NAV_ICONS"));
  assert.doesNotMatch(publicNav, /Hybrid Feed|\/blue-desk\/feed/);
  assert.match(host, /hostname === BLUEBELLY_PRESENTATION_HOST \? "blocked" : "private"/);
  assert.doesNotMatch(host, /pathname === "\/blue-desk\/feed"/);
  assert.match(middleware, /if \(accessScope === "blocked"\)/);
  assert.match(middleware, /if \(accessScope === "public"\)/);
  assert.match(middleware, /supabase\.auth\.getClaims\(\)/);
  assert.doesNotMatch(page, /export async function (?:POST|PUT|PATCH|DELETE)/);
});

test("transplanted Hybrid feed does not introduce another writer, secret, scheduler or fabricated observations", () => {
  for (const path of [
    "components/blue-desk/hybrid-feed/LiveDeskFeed.tsx",
    "components/blue-desk/hybrid-feed/ResearchDashboard.tsx",
    "components/blue-desk/hybrid-feed/RelationshipChart.tsx",
    "lib/blue-desk-hybrid-feed/research-dashboard.ts",
    "lib/blue-desk-hybrid-feed/canonical-visuals.ts",
  ]) {
    const text = source(path);
    assert.doesNotMatch(text, /createSupabaseAdminClient|SUPABASE_SERVICE_ROLE_KEY|database\.insert|supabase\.from|fetch\(|setInterval\(|Math\.random\(/);
  }
  const page = source("app/blue-desk/feed/page.tsx");
  assert.doesNotMatch(page, /getLiveDeskHomepageDailyBrief|createStory|updateStory|mutateStory|seedMarket|mockFeed/);
});
