import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const providerSource = readFileSync(new URL("../lib/market-tools-provider-readiness.ts", import.meta.url), "utf8");
const ownerPage = readFileSync(new URL("../app/market-tools/page.tsx", import.meta.url), "utf8");

test("one owner-only manual check includes all five providers without new schedules", () => {
  for (const provider of ["FRED/ALFRED", "EIA Open Data", "Alpha Vantage", "Financial Modeling Prep", "BEA"]) {
    assert.ok(providerSource.includes(`provider:"${provider}"`), `missing owner check for ${provider}`);
  }
  assert.match(providerSource, /readFmpRecords\(\{endpoint:"earnings-calendar"/);
  assert.match(providerSource, /fetchBeaSnapshot\(process\.env\.BEA_API_KEY\)/);
  assert.match(providerSource, /unstable_cache\(fetchProviderReadiness/);
  assert.match(ownerPage, /checkProviders\s*\?\s*getMarketToolsProviderReadiness/);
});

test("owner UI never treats runtime visibility as proof of Vercel Team Shared scope", () => {
  assert.match(providerSource, /runtimeCredential:/);
  assert.match(providerSource, /sharedScope:"not_inspected"/);
  assert.match(ownerPage, /Vercel Shared scope: unverified/);
  assert.match(ownerPage, /Missing runtime credentials do not establish absence from Vercel Team Shared Variables/);
  assert.match(ownerPage, /prove canonical ingestion/);
  assert.match(providerSource, /m\?\.state==="restricted"\?"limited"/);
});
