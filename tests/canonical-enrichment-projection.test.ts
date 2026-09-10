import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../lib/intelligence/publication-feed-data.ts", import.meta.url), "utf8");

test("canonical enrichment reads avoid broad row projections", () => {
  assert.match(source, /stories", "select=id,slug,title,thesis,status,confidence,rank,market_question/);
  assert.match(source, /story_updates", "select=id,story_id,update_type,headline,detail,observed_at,created_at/);
  assert.match(source, /sources", "select=id,story_id,publisher,source_type,title,url,publication_date,observation_date,reliability_score/);
  assert.match(source, /earnings_calls", "select=id,ticker,company_name,fiscal_period,call_date,transcript_status,relevance_reason,summary,guidance,capex,demand,prior_quarter_change/);
  assert.match(source, /guidance_items", "select=id,entity,ticker,category,period,guidance_type,metric,current_view,prior_view,wording_change,market_interpretation,source_url,source_classification,published_at,assets/);

  for (const table of ["stories", "story_updates", "sources", "earnings_calls", "guidance_items"]) {
    assert.doesNotMatch(source, new RegExp(`${table}\\\", \\\"select=\\*`));
  }
});

test("public canonical record arrays retain their full compatibility projections", () => {
  for (const table of ["market_state_ledger", "research_run_status", "story_thesis_versions", "story_events", "current_causal_edges", "current_asset_impacts"]) {
    assert.match(source, new RegExp(`${table}\\\",[\\s\\S]{0,120}select=\\*`));
  }
});
