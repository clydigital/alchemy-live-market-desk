import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const core = readFileSync(new URL("../lib/provider-benchmark-poc.ts", import.meta.url), "utf8");
const route = readFileSync(new URL("../app/api/admin/diagnostics/provider-benchmark/route.ts", import.meta.url), "utf8");

test("provider benchmark covers the five current discovery providers", () => {
  for (const provider of ["brave", "exa", "tavily", "gdelt", "apify"]) {
    assert.match(core, new RegExp(`provider: \\"${provider}\\"|\\"${provider}\\"`));
  }
});

test("provider benchmark uses a fixed five-question market set", () => {
  for (const id of ["oil-hormuz", "fed-inflation", "long-end", "yen-carry", "ai-equities"]) {
    assert.match(core, new RegExp(id));
  }
  assert.match(core, /PROVIDER_BENCHMARK_QUERIES/);
});

test("benchmark remains bounded and does not use Firecrawl", () => {
  assert.match(core, /const MAX_RESULTS = 5/);
  assert.doesNotMatch(core.toLowerCase(), /firecrawl/);
});

test("benchmark route is preview-only and non-persistent", () => {
  assert.match(route, /VERCEL_ENV !== "preview"/);
  assert.match(route, /Provider benchmark is preview-only/);
  assert.doesNotMatch(route, /supabase|intelligenceRest|stories|hybrid/i);
});

test("benchmark does not return credential values", () => {
  assert.match(core, /secretValuesReturned: false/);
  assert.doesNotMatch(route, /BRAVE_SEARCH_API_KEY|EXA_API_KEY|TAVILY_API_KEY|APIFY_API_TOKEN/);
});

test("benchmark records usefulness dimensions rather than a binary provider check", () => {
  for (const metric of ["avgLatencyMs", "dateCoverage", "freshCoverageAmongDated", "domainDiversity", "syndicationRiskRatio", "crossProviderDuplicateRatio", "relevanceScore"]) {
    assert.match(core, new RegExp(metric));
  }
});
