import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { DATED_EQUITY_ARTICLES, getDatedEquityArticle } from "../lib/bluebelly-dated-equity-articles.ts";

const reader = readFileSync(new URL("../components/blue-desk/DatedEquityArticleReader.tsx", import.meta.url), "utf8");
const page = readFileSync(new URL("../app/blue-desk/newsroom/page.tsx", import.meta.url), "utf8");
const feature = readFileSync(new URL("../components/blue-desk/SectorDivergenceFeature.tsx", import.meta.url), "utf8");
const market = readFileSync(new URL("../app/blue-desk/markets/page.tsx", import.meta.url), "utf8");
const screener = readFileSync(new URL("../components/blue-desk/PublicMarketScreener.tsx", import.meta.url), "utf8");
const scss = readFileSync(new URL("../components/blue-desk/PublicMarketScreener.module.css", import.meta.url), "utf8");
const host = readFileSync(new URL("../lib/blue-desk-host.ts", import.meta.url), "utf8");

test("the five full editorial readers are source-derived, dated and only accessible by known IDs", () => {
  assert.equal(DATED_EQUITY_ARTICLES.length, 5);
  assert.equal(new Set(DATED_EQUITY_ARTICLES.map(x=>x.id)).size, 5);
  for(const article of DATED_EQUITY_ARTICLES) {
    assert.ok(article.sections.flatMap(s=>s.paragraphs).join(" ").split(/\s+/).length >= 350, article.id);
    assert.ok(article.sections[0].paragraphs.length >= 2, article.id + " lead paragraphs");
    assert.ok(article.sources.length >= 3, article.id + " source links");
    assert.ok(article.sources.every(s=>s.url.startsWith("https://")), article.id);
    assert.ok(!article.sources.some(s=>s.url.includes("notion.com/")), article.id + " no private links");
    assert.equal(getDatedEquityArticle(article.id)?.title, article.title);
  }
  assert.equal(getDatedEquityArticle("not-a-real-article"), null);
  assert.equal(getDatedEquityArticle(undefined), null);
  assert.equal(getDatedEquityArticle("../owner/research"), null);
});

test("Solarvest prioritises July audited FY2026 758.9m and distinguishes preliminary 757.1m", () => {
  const a = getDatedEquityArticle("solarvest-peers");
  assert.ok(a);
  assert.equal(a?.ticker, "SLVEST");
  const text = a?.sections.flatMap(x=>x.paragraphs).join(" ") || "";
  assert.match(text, /RM758\.9 million/);
  assert.match(text, /preliminary release gave revenue of RM757\.1 million/);
  assert.doesNotMatch(text,/RM759 million/);
  assert.match(text,/Samaiden/);
  assert.match(text,/Pekat/);
});

test("readers use existing public Newsroom route, no new auth exceptions or private Notion fetches",()=>{
  assert.match(page, /getDatedEquityArticle\(typeof requested\.divergence==="string"/);
  assert.match(page, /if\(article\)return <DatedEquityArticleReader/);
  assert.match(reader, /data-dated-equity-reader=\{article\.id\}/);
  assert.match(reader, /original|source|Source/i);
  assert.match(reader, /2026-11-05/);
  assert.match(feature, /divergence=solarvest-peers/);
  assert.match(feature, /Read full company-level analysis/);
  assert.match(market, /articleHrefBase=\{blueDeskPublicHref/);
  assert.match(page, /<BluebellyNewsWire news=\{news\}/);
  assert.match(host, /if \(pathname === "\/newsroom"\) return "\/blue-desk\/newsroom";/);
  assert.doesNotMatch(host,/newsroom\/divergences\/\[/);
  assert.doesNotMatch(reader,/createSupabaseAdminClient|fetch\(|notion\.com/);
});

test("recovered XL ranking sorts 1D by completed session and refuses unmatched dates",()=>{
  assert.match(screener,/useState<string\[\]>\(\(\) => observations\.filter\(row => row\.type === "Sector"\)/);
  assert.match(screener,/useState<EtfComparisonSortColumn \| null>\("1D"\)/);
  assert.match(screener,/row\.asOf === date/);
  assert.match(screener,/group\.length >= 8/);
  assert.match(screener,/Source-matched ETF price rotation, not confirmed investment flows/);
  assert.match(screener,/Sector rotation summary unavailable/);
  assert.match(screener,/publicMarketWindowChange\(row,period\) === null \? "unknown"/);
  assert.match(scss,/\.rotationSummary\{/);
  assert.doesNotMatch(screener,/createSupabaseAdminClient|\.insert\(|\.upsert\(/);
});
