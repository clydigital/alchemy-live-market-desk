import assert from "node:assert/strict";
import test from "node:test";

import {
  applyResearchDiscoveryProviders,
  enabledResearchDiscoveryProviders,
  normaliseDiscoveryUrl,
} from "../lib/research-discovery-providers.ts";
import { type ResearchRunInput } from "../lib/research-update.ts";

function baseInput(items: ResearchRunInput["items"] = []): ResearchRunInput {
  return {
    runKey: "test:morning:2026-08-17",
    scheduleSlot: "morning",
    scheduledFor: "2026-08-17T01:15:00.000Z",
    sourceChecks: [],
    items,
    recalibrations: [],
    summary: "Base research cycle.",
    dryRun: true,
  };
}

test("recurring-free provider plan keeps GDELT active without credentials", () => {
  assert.deepEqual(enabledResearchDiscoveryProviders({}), ["gdelt"]);
});

test("provider plan enables keyed services only when their credentials are present", () => {
  const providers = enabledResearchDiscoveryProviders({
    BRAVE_SEARCH_API_KEY: "brave",
    EXA_API_KEY: "exa",
    TAVILY_API_KEY: "tavily",
    APIFY_API_TOKEN: "apify",
    APIFY_RESEARCH_TASK_ID: "task",
  });
  assert.deepEqual(providers, ["brave-search", "exa", "tavily", "gdelt", "apify"]);
});

test("provider switches can explicitly disable an otherwise configured service", () => {
  const providers = enabledResearchDiscoveryProviders({
    BRAVE_SEARCH_API_KEY: "brave",
    RESEARCH_BRAVE_SEARCH_ENABLED: "false",
    RESEARCH_GDELT_ENABLED: "false",
  });
  assert.deepEqual(providers, []);
});

test("discovery URL normalization removes tracking and fragments", () => {
  assert.equal(
    normaliseDiscoveryUrl("https://example.com/story?utm_source=test&x=1#section"),
    "https://example.com/story?x=1",
  );
});

test("GDELT enrichment retains the underlying publisher URL rather than GDELT as evidence", async () => {
  const now = new Date("2026-08-17T10:00:00.000Z");
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    assert.match(url, /api\.gdeltproject\.org/);
    return new Response(JSON.stringify({
      articles: [{
        title: "Oil shipping disruption deepens",
        url: "https://example.com/oil-story?utm_source=gdelt",
        seendate: "20260817T093000Z",
        domain: "example.com",
        sourcecountry: "United States",
        language: "English",
      }],
    }), { status: 200, headers: { "content-type": "application/json" } });
  };

  const result = await applyResearchDiscoveryProviders(baseInput(), "morning", {
    now,
    fetchImpl,
    env: {
      RESEARCH_BRAVE_SEARCH_ENABLED: "false",
      RESEARCH_EXA_ENABLED: "false",
      RESEARCH_TAVILY_ENABLED: "false",
      RESEARCH_APIFY_ENABLED: "false",
    },
  });

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].publisher, "example.com");
  assert.equal(result.items[0].url, "https://example.com/oil-story");
  assert.match(result.items[0].newsSignal || "", /GDELT/);
  assert.match(result.items[0].reviewReason || "", /not independent corroboration/i);
  assert.match(result.summary || "", /gdelt:checked discovered=1 retained=1/);
});

test("cross-provider discovery cannot duplicate an article already collected directly", async () => {
  const now = new Date("2026-08-17T10:00:00.000Z");
  const existing = {
    itemKey: "feed:existing",
    itemType: "news" as const,
    publisher: "Example",
    externalId: "https://example.com/oil-story",
    title: "Existing direct item",
    url: "https://example.com/oil-story",
    publishedAt: "2026-08-17T09:00:00.000Z",
    summary: "Direct evidence.",
    sourceQuality: 80,
    relevance: 80,
    novelty: 70,
    materiality: 80,
    recommendedAction: "collect_evidence" as const,
    evidence: [{
      title: "Existing direct item",
      url: "https://example.com/oil-story",
      publisher: "Example",
      publishedAt: "2026-08-17T09:00:00.000Z",
      claim: "Direct evidence.",
    }],
  };
  const fetchImpl: typeof fetch = async () => new Response(JSON.stringify({
    articles: [{
      title: "Same article through an aggregator",
      url: "https://example.com/oil-story?utm_campaign=duplicate",
      seendate: "20260817T093000Z",
      domain: "example.com",
    }],
  }), { status: 200, headers: { "content-type": "application/json" } });

  const result = await applyResearchDiscoveryProviders(baseInput([existing]), "morning", {
    now,
    fetchImpl,
    env: {
      RESEARCH_BRAVE_SEARCH_ENABLED: "false",
      RESEARCH_EXA_ENABLED: "false",
      RESEARCH_TAVILY_ENABLED: "false",
      RESEARCH_APIFY_ENABLED: "false",
    },
  });

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].itemKey, "feed:existing");
  assert.match(result.summary || "", /gdelt:no_new_items discovered=1 retained=0/);
});
