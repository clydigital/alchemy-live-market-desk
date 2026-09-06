import test from "node:test";
import assert from "node:assert/strict";
import { buildRatesResearchPlan, parseRatesContext } from "../lib/rates-research-plan.ts";
import { acquireRatesResearch, readRatesEvidence, ratesSourceClass } from "../lib/rates-research-acquisition.ts";
import { attachRatesContext } from "../lib/intelligence/rates-context.ts";
import type { IntakeItemInput, ResearchRunInput } from "../lib/research-update.ts";
import type { EvidencePackItem } from "../lib/intelligence/schemas.ts";

const now = new Date("2026-09-07T00:00:00Z");
const item = (title: string, summary = title): IntakeItemInput => ({ itemKey: title, title, summary,
  url: "https://reuters.com/example", publisher: "Reuters", itemType: "news", publishedAt: "2026-09-06T10:00:00Z",
  sourceQuality: 80, relevance: 80, novelty: 80, materiality: 80, recommendedAction: "collect_evidence" });
const input = (title: string): ResearchRunInput => ({ runKey: "test", scheduleSlot: "manual", scheduledFor: now.toISOString(), sourceChecks: [], items: [item(title)] });

test("rates planning is automatic and conditional; macro covers Mag7 and a company catalyst covers non-Mag7", () => {
  assert.deepEqual(buildRatesResearchPlan([item("Port strike disrupts freight")], now), []);
  for (const title of ["Nvidia earnings", "Micron earnings", "SpaceX funding and valuation"]) {
    const plan = buildRatesResearchPlan([item(title)], now);
    assert.ok(plan.some((v) => v.depth === "company"));
    assert.ok(plan.some((v) => v.key === "macro"));
    assert.ok(!plan.some((v) => v.assets.includes("MSTR")));
  }
  const macro = buildRatesResearchPlan([item("NFP JOLTS Bessent Fed comments ahead of rate decision")], now);
  for (const ticker of ["NVDA", "MSFT", "AAPL", "AMZN", "GOOGL", "META", "TSLA"]) assert.ok(macro.some((v) => v.assets.includes(ticker)));
});
test("ready transcript central names and explicit non-Mag7 tickers are eligible; incidental mentions are not", () => {
  const transcript = { ...item("AI infrastructure discussion"), itemType: "video" as const, transcriptStatus: "ready" as const,
    transcriptText: "Micron demand is strong. Micron capex guidance is the key story. $AVGO earnings also matter." };
  assert.ok(buildRatesResearchPlan([transcript], now).some((v) => v.assets.includes("MU")));
  assert.ok(buildRatesResearchPlan([transcript], now).some((v) => v.assets.includes("AVGO")));
  assert.deepEqual(buildRatesResearchPlan([{ ...transcript, transcriptStatus: "missing" }], now), []);
  assert.deepEqual(buildRatesResearchPlan([item("Shipping disruption", "A passing mention of Micron earnings.")], now), []);
});
test("Bitcoin checks MSTR lightly, MSTR central goes deep, generic strategy is not the issuer", () => {
  assert.equal(buildRatesResearchPlan([item("Bitcoin liquidity rally")], now).find((v) => v.assets.includes("MSTR"))?.depth, "mstr_light");
  const plan = buildRatesResearchPlan([item("MSTR preferred funding STRC STRK STRF STRD STRE STR")], now);
  assert.ok(plan.some((v) => v.depth === "mstr_deep"));
  assert.ok(!plan.some((v) => v.depth === "mstr_light"));
  assert.equal(plan.filter((v) => v.instrument).length, 5);
  assert.ok(plan.some((v) => v.key === "instrument:unresolved"));
  assert.deepEqual(buildRatesResearchPlan([item("Our strategy for portfolio growth")], now), []);
});
const html = (date = "2026-08-01", body = "Micron revenue and customer demand grew. Cash, debt maturities, interest expense and capex are disclosed for the quarter. Guidance reflects customer funding and valuation uncertainty. This is an earnings statement with more than one hundred and sixty characters of verifiable publisher content.") =>
  `<html><head><title>Micron earnings</title><meta property="article:published_time" content="${date}"></head><body><article><p>${body}</p></article></body></html>`;
test("only dated publisher bodies become context; snippets, future dates, wrong instruments and unsafe redirects do not", async () => {
  const target = buildRatesResearchPlan([item("Micron earnings")], now).find((v) => v.assets.includes("MU"))!;
  const read = (body: string) => readRatesEvidence({ url: "https://investors.micron.com/earnings", title: "Micron" }, target, now,
    async () => new Response(body, { headers: { "content-type": "text/html" } }), AbortSignal.timeout(1000));
  const result = await read(html());
  assert.equal(result?.publishedAt, "2026-08-01T00:00:00.000Z");
  assert.equal(parseRatesContext(result?.divergenceNote)?.assets[0], "MU");
  assert.match(result!.summary, /Latest available status is unverified/);
  assert.equal(await read(html("2027-01-01")), null);
  assert.equal(await read(html("")), null);
  let calls = 0;
  assert.equal(await readRatesEvidence({ url: "https://micron.com/a", title: "Micron" }, target, now,
    async () => { calls++; return new Response(null, { status: 302, headers: { location: "https://127.0.0.1/admin" } }); }, AbortSignal.timeout(1000)), null);
  assert.equal(calls, 1);
  assert.equal(await readRatesEvidence({ url: "https://strategy.com/a", title: "STRC" }, { ...target, instrument: "STRC" }, now,
    async () => new Response(html(), { headers: { "content-type": "text/html" } }), AbortSignal.timeout(1000)), null);
  assert.equal(ratesSourceClass("https://investor.nvidia.com/a"), "company_primary");
  assert.equal(ratesSourceClass("https://www.sec.gov/a"), "regulatory_filing");
});
test("provider failure leaves the publishable base intake unchanged and reports attempted gaps", async () => {
  const base = input("Micron earnings");
  const result = await acquireRatesResearch(base, { now, env: { NODE_ENV: "test" }, fetchImpl: async () => { throw new Error("offline"); } });
  assert.deepEqual(result.input.items, base.items);
  assert.ok(result.diagnostics.every((v) => /attempted/.test(v)));
});
test("successful discovery reads publisher pages, persists dated context and retains the original catalyst", async () => {
  const base = input("Micron earnings");
  const result = await acquireRatesResearch(base, { now, env: { NODE_ENV: "test", BRAVE_API_KEY: "test" }, fetchImpl: async (url) => {
    if (String(url).includes("api.search.brave.com")) return Response.json({ web: { results: [{ url: "https://investors.micron.com/earnings", title: "Micron earnings", description: "Unverified search snippet" }] } });
    return new Response(html(), { headers: { "content-type": "text/html" } });
  } });
  assert.equal(result.input.items[0], base.items[0]);
  assert.ok(result.input.items.length > 1);
  assert.ok(!result.input.items.some((v) => v.summary.includes("Unverified search snippet")));
});
test("quarterly context joins only its recruited trigger and keeps publication dates; no unrelated or future context", () => {
  const seed = { id: "news", structuredPayload: { itemKey: "micron-news" }, provenanceUrls: ["https://reuters.com/a"] } as unknown as EvidencePackItem;
  const context = { id: "filing", provenanceUrls: ["https://sec.gov/a"], publishedAt: "2026-06-01", structuredPayload: {
    itemKey: "rates-context:123", ratesContext: { triggerItemKeys: ["micron-news"], retrievedAt: "2026-09-06T23:00:00Z" },
  } } as unknown as EvidencePackItem;
  assert.deepEqual(attachRatesContext([seed], [context], now.toISOString()).map((v) => v.id), ["news", "filing"]);
  assert.deepEqual(attachRatesContext([], [context], now.toISOString()), []);
  assert.equal(attachRatesContext([{ ...seed, structuredPayload: { itemKey: "other" } }], [context], now.toISOString()).length, 1);
  assert.equal(attachRatesContext([seed], [{ ...context, publishedAt: "2027-01-01" }], now.toISOString()).length, 1);
  assert.equal(context.publishedAt, "2026-06-01");
});

// No-budget behaviour is part of the publication contract, not a retrieval success.
test("exhausted scheduled budget does not delay or block base publication", async () => {
  const base = input("Micron earnings");
  let calls = 0;
  const result = await acquireRatesResearch(base, { now, budgetMs: 0, fetchImpl: async () => { calls++; throw new Error("must not fetch"); } });
  assert.equal(calls, 0);
  assert.equal(result.input, base);
  assert.ok(result.diagnostics.some((v) => /base publication continues/.test(v)));
});
