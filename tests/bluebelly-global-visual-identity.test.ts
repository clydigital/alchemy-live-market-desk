import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  BLUEBELLY_COMPANIES, BLUEBELLY_COUNTRIES, ASSET_CODES, companyFavicon,
  entityForAsset, identitiesFromAssets, entityForCalendarEvent,
} from "../lib/bluebelly-entity-identity.ts";

const root=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("issuer country and commodity identities are source-code based, never headline-guessed",()=>{
  assert.deepEqual(entityForAsset("MSFT"),{kind:"company",code:"MSFT"});
  assert.deepEqual(entityForAsset("GOOGL"),{kind:"company",code:"GOOGL"});
  assert.deepEqual(entityForAsset("US10Y"),{kind:"country",code:"US"});
  assert.deepEqual(entityForAsset("DGS10"),{kind:"country",code:"US"});
  assert.deepEqual(entityForAsset("JGB"),{kind:"country",code:"JP"});
  assert.deepEqual(entityForAsset("BUND"),{kind:"country",code:"DE"});
  assert.deepEqual(entityForAsset("EUR"),{kind:"country",code:"EU"});
  assert.deepEqual(entityForAsset("BRENT"),{kind:"asset",code:"BRENT"});
  assert.deepEqual(entityForAsset("TSLA"),{kind:"company",code:"TSLA"});
  assert.equal(BLUEBELLY_COUNTRIES.DE.flag,"🇩🇪");
  assert.equal(ASSET_CODES.GOLD,"Gold");
});

test("company logos resolve only from issuer domain allowlist and unknown tickers fall back",()=>{
  assert.match(companyFavicon("aapl")||"",/^https:\/\/www\.apple\.com\/favicon\.ico$/);
  assert.equal(companyFavicon("???"),null);
  assert.equal(companyFavicon("https://evil.example/tracking"),null);
  assert.ok(Object.keys(BLUEBELLY_COMPANIES).includes("AMZN"));
});

test("scope strips dedupe repeated tickers and cap marks without modifying evidence",()=>{
  assert.deepEqual(identitiesFromAssets(["MSFT","MSFT","NVDA","US10Y","BRENT"],3)
    .map(x=>x.code),["MSFT","NVDA","US"]);
  assert.equal(identitiesFromAssets([],5).length,0);
  assert.deepEqual(entityForCalendarEvent("earnings",["USD","MSFT"]),{kind:"company",code:"MSFT"});
});

test("Figtree is loaded at root rather than per-page and retains code monospace",()=>{
  const layout=root("app/layout.tsx"),css=root("app/globals.css");
  assert.match(layout,/Figtree\(\{ subsets: \["latin"\]/);
  assert.match(layout,/className=\{figtree.variable\}/);
  assert.match(css,/--bluebelly-font/);
  assert.match(css,/pre, code, kbd, samp/);
  assert.match(root("app/blue-desk/blue-desk.module.css"),/font-family: var\(--bluebelly-font\)/);
});

test("one identity system is consumed by the highest-signal public and owner surfaces",()=>{
  for(const path of [
    "components/blue-desk/CatalystCalendar.tsx",
    "components/blue-desk/EarningsWeekGrid.tsx",
    "app/blue-desk/markets/page.tsx",
    "app/blue-desk/page.tsx",
    "app/blue-desk/key-stories/page.tsx",
    "app/blue-desk/stories/[articleId]/page.tsx",
    "components/blue-desk/OwnerTodayTalk.tsx",
    "components/blue-desk/PublicGovernmentRateTrendChart.tsx",
    "components/blue-desk/ResearchLibraryExplorer.tsx",
  ]) {
    assert.match(root(path),/Entity(?:Mark|Row|Chip|Stack)|ScopeStrip/,"Missing shared identity in "+path);
  }
  assert.doesNotMatch(root("components/blue-desk/CatalystCalendar.tsx"),/const FLAGS:Record/);
  assert.doesNotMatch(root("components/blue-desk/CatalystCalendar.tsx"),/const LOGOS:Record/);
});

test("frozen Story editions expose only explicitly authored asset identity metadata",()=>{
  const projection=root("lib/market-brief-articles.ts");
  assert.match(projection,/affectedAssets\?: string\[\]/);
  assert.match(projection,/candidate\.assets\.length \? \{ affectedAssets: candidate\.assets\.slice\(0,8\) \}/);
  assert.match(root("app/blue-desk/stories/[articleId]/page.tsx"),/Story scope · not evidence/);
});
