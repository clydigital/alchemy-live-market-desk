import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { deriveMarketThemeKeys, momentumForTransition } from "../lib/market-theme-taxonomy.ts";
import { sourceVerificationRole, sourceVerificationWeight } from "../lib/intelligence/source-verification.ts";
import { materialAssessmentHasEligibleEvidence, selectStoryReviewTargets } from "../lib/intelligence/story-review.ts";
import type { EvidencePackItem } from "../lib/intelligence/schemas.ts";

const root = path.resolve(import.meta.dirname, "..");
const migration = fs.readFileSync(path.join(root, "supabase", "migrations", "20260907110000_persistent_market_theme_taxonomy.sql"), "utf8");

function evidence(input: Partial<EvidencePackItem> = {}): EvidencePackItem {
  return {
    id: "evidence-1", claim: "Direct market observation", summary: null, evidenceClass: "market_observation",
    sourceName: "Exchange", sourceTier: 2, reliabilityScore: 90, ancestryGroupId: "exchange",
    supportDirection: "supporting", eventAt: "2026-09-07T01:00:00Z", publishedAt: "2026-09-07T01:00:00Z",
    availableAt: "2026-09-07T01:00:00Z", receivedAt: "2026-09-07T01:00:00Z", freshnessStatus: "current",
    affectedAssets: ["BRENT"], affectedTopics: ["iran-oil-inflation-rates"], provenanceUrls: ["https://example.test"],
    structuredPayload: {}, ...input,
  };
}

test("taxonomy persists all requested families and uses a many-to-many Story link", () => {
  for (const label of ["Macro Regime", "Financial System", "Real Assets & Monetary Alternatives", "Geopolitics", "Technology & Capex", "Structural Risks"]) {
    assert.match(migration, new RegExp(label.replace(/[&]/g, "\\&")));
  }
  assert.match(migration, /create table if not exists public\.intelligence_story_theme_links/);
  assert.match(migration, /alter table public\.intelligence_story_theme_links enable row level security/);
  assert.match(migration, /primary key \(story_id, theme_id\)/);
  assert.match(migration, /iran-oil-inflation-rates/);
  assert.match(migration, /fiscal-dominance/);
});

test("one Story deterministically receives multiple theme assignments", () => {
  const themes = deriveMarketThemeKeys({
    title: "Iran oil shock risks inflation and Fed rates",
    thesis: "A Hormuz security disruption could affect energy and policy expectations.",
    causalMechanism: "Oil prices feed into inflation expectations.",
    assets: ["BRENT", "US10Y"],
  });
  assert.deepEqual(themes, ["rates-monetary-policy", "inflation-commodities", "energy", "war-security"]);
});

test("state transitions retain momentum semantics instead of overwriting Story memory", () => {
  assert.equal(momentumForTransition("developing", "confirmed"), "accelerating");
  assert.equal(momentumForTransition("confirmed", "weakening"), "decelerating");
  assert.equal(momentumForTransition("weakening", "invalidated"), "reversing");
  assert.equal(momentumForTransition("confirmed", "confirmed"), "stable");
  assert.match(migration, /last_material_update_at/);
});

test("only evidence newer than the stored review time wakes freshness review", () => {
  const story = {
    id: "story-1", slug: "oil", title: "Oil", thesis: "Test", status: "developing", confidence: 30,
    marketQuestion: null, dominantNarrative: null, strongestSupport: null, strongestContradiction: null,
    confirmationTrigger: null, invalidationTrigger: null, nextCatalyst: null, assets: [],
    lastEvaluatedAt: "2026-09-07T02:00:00Z", lastEvidenceAt: "2026-09-07T01:00:00Z", nextCatalysts: [],
  };
  const stale = evidence({ affectedTopics: ["oil"], eventAt: "2026-09-07T01:00:00Z", publishedAt: "2026-09-07T01:00:00Z" });
  assert.deepEqual(selectStoryReviewTargets({ stories: [story], evidence: [stale], evidenceLinks: [], queue: [], debt: [], now: new Date("2026-09-07T02:30:00Z") }), []);
  const fresh = evidence({ affectedTopics: ["oil"], eventAt: "2026-09-07T03:00:00Z", publishedAt: "2026-09-07T03:00:00Z" });
  assert.equal(selectStoryReviewTargets({ stories: [story], evidence: [fresh], evidenceLinks: [], queue: [], debt: [], now: new Date("2026-09-07T04:00:00Z") })[0]?.reason, "supporting_evidence");
});

test("ZeroHedge is discovery-only and has zero canonical verification weight", () => {
  const lead = evidence({ sourceName: "ZeroHedge Reads", sourceTier: 3, sourceVerificationRole: sourceVerificationRole({ sourceName: "ZeroHedge Reads" }) });
  const target = { story: { id: "story", slug: "oil", title: "Oil", thesis: "Test", status: "developing", confidence: 30, marketQuestion: null, dominantNarrative: null, strongestSupport: null, strongestContradiction: null, confirmationTrigger: null, invalidationTrigger: null, nextCatalyst: null, assets: [] }, reason: "supporting_evidence", reasonRank: 5, reasons: ["supporting_evidence"], queueIds: [], selectedAt: "2026-09-07T02:00:00Z", relevantEvidence: [lead] };
  assert.equal(sourceVerificationWeight(lead), 0);
  assert.equal(materialAssessmentHasEligibleEvidence("reinforced", [lead.id], target), false);
  assert.match(migration, /verificationRole','discovery_only/);
});

test("ZeroHedge Reads members on independent domains remain discovery-only", () => {
  for (const source of [
    { sourceName: "BullionStar", provenanceUrls: ["https://www.bullionstar.us/"] },
    { sourceName: "ForexLive", provenanceUrls: ["https://www.forexlive.com/"] },
    { sourceName: "Mises Institute", provenanceUrls: ["https://mises.org/"] },
    { sourceName: "Capitalist Exploits", provenanceUrls: ["https://www.capitalistexploits.at/"] },
  ]) {
    assert.equal(sourceVerificationRole(source), "discovery_only");
    assert.equal(sourceVerificationWeight(evidence({ sourceName: source.sourceName, provenanceUrls: source.provenanceUrls, sourceVerificationRole: sourceVerificationRole(source) })), 0);
  }
  assert.match(migration, /ZeroHedge Reads is a discovery ecosystem/);
});
