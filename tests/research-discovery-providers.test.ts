import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const providerSource = readFileSync(new URL("../lib/research-discovery-providers.ts", import.meta.url), "utf8");
const scheduledSource = readFileSync(new URL("../lib/firecrawl-scheduled-research.ts", import.meta.url), "utf8");
const envExample = readFileSync(new URL("../.env.example", import.meta.url), "utf8");

test("free research stack contains the five bounded discovery providers", () => {
  for (const provider of ["brave-search", "exa", "tavily", "gdelt", "apify"]) {
    assert.match(providerSource, new RegExp(`\\"${provider}\\"`));
  }
});

test("discovery layer remains bounded before canonical intake", () => {
  assert.match(providerSource, /MAX_PROVIDER_RESULTS = 6/);
  assert.match(providerSource, /MAX_PROVIDER_RETAINED = 4/);
  assert.match(providerSource, /WINDOW_MS = 36 \* 60 \* 60 \* 1_000/);
  assert.match(providerSource, /search_depth: "basic"/);
  assert.match(providerSource, /time_range: "day"/);
});

test("provider calls use their official service endpoints and GDELT stays keyless", () => {
  assert.match(providerSource, /api\.search\.brave\.com\/res\/v1\/web\/search/);
  assert.match(providerSource, /api\.exa\.ai\/search/);
  assert.match(providerSource, /api\.tavily\.com\/search/);
  assert.match(providerSource, /api\.gdeltproject\.org\/api\/v2\/doc\/doc/);
  assert.match(providerSource, /api\.apify\.com\/v2\/actor-tasks/);
  assert.match(providerSource, /if \(provider === "gdelt"\) return true/);
});

test("discovery is ordered after deterministic acquisition and before Firecrawl recovery", () => {
  const directIndex = scheduledSource.indexOf("buildScheduledResearchInput(slot, options)");
  const discoveryIndex = scheduledSource.indexOf("await applyResearchDiscoveryProviders(");
  const highImpactIndex = scheduledSource.indexOf("await applyHighImpactMarketDiscovery(");
  const firecrawlIndex = scheduledSource.indexOf("return applyFirecrawlResearchFallback(");
  assert.ok(directIndex >= 0);
  assert.ok(discoveryIndex > directIndex);
  assert.ok(highImpactIndex > discoveryIndex);
  assert.ok(firecrawlIndex > highImpactIndex);
});

test("discovery providers preserve underlying publisher provenance and deduplicate URLs", () => {
  assert.match(providerSource, /publisherFromUrl\(item\.url\)/);
  assert.match(providerSource, /Search APIs are discovery mechanisms, not publication authorities/);
  assert.match(providerSource, /cross-provider duplicates count once/i);
  assert.match(providerSource, /seen\.has\(key\)/);
  assert.match(providerSource, /safeUrl\(item\.url\)/);
});

test("keyed providers and kill switches are documented for deployment", () => {
  for (const key of [
    "BRAVE_SEARCH_API_KEY=",
    "EXA_API_KEY=",
    "TAVILY_API_KEY=",
    "APIFY_API_TOKEN=",
    "APIFY_RESEARCH_TASK_ID=",
    "RESEARCH_BRAVE_SEARCH_ENABLED=true",
    "RESEARCH_EXA_ENABLED=true",
    "RESEARCH_TAVILY_ENABLED=true",
    "RESEARCH_GDELT_ENABLED=true",
    "RESEARCH_APIFY_ENABLED=true",
  ]) {
    assert.ok(envExample.includes(key), `missing ${key}`);
  }
});