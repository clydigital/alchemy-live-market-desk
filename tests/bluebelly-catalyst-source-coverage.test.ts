import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { isMaterialCatalystHeadline } from "../lib/bluebelly-catalyst-headline-policy.ts";

test("peace radar excludes generic summits and unrelated agreements",()=>{
  assert.equal(isMaterialCatalystHeadline("diplomacy","Summit in Samarkand, a boon for child wellbeing and health"),false);
  assert.equal(isMaterialCatalystHeadline("diplomacy","Retail agreement signed by two companies"),false);
  assert.equal(isMaterialCatalystHeadline("diplomacy","White House confirms ceasefire between two countries"),true);
  assert.equal(isMaterialCatalystHeadline("diplomacy","Delegations resume peace negotiations"),true);
  assert.equal(isMaterialCatalystHeadline("diplomacy","UN mediator outlines peace agreement"),true);
});

test("tech radar excludes generic partner press releases but retains material unveils",()=>{
  assert.equal(isMaterialCatalystHeadline("technology","Apple announces American Manufacturing Program partners"),false);
  assert.equal(isMaterialCatalystHeadline("technology","NVIDIA expands a partnership with a healthcare provider"),false);
  assert.equal(isMaterialCatalystHeadline("technology","Apple unveils a new Mac device"),true);
  assert.equal(isMaterialCatalystHeadline("technology","NVIDIA introduces Blackwell architecture"),true);
  assert.equal(isMaterialCatalystHeadline("technology","Tesla robotaxi roadshow begins"),true);
});

test("official feed is repaired and failed feeds remain distinct from not-configured adapters",()=>{
  const source=readFileSync(new URL("../lib/bluebelly-catalyst-sources.ts",import.meta.url),"utf8");
  const view=readFileSync(new URL("../components/blue-desk/CatalystCalendar.tsx",import.meta.url),"utf8");
  assert.match(source,/https:\/\/www\.whitehouse\.gov\/briefings-statements\/feed\//);
  assert.doesNotMatch(source,/https:\/\/www\.whitehouse\.gov\/feed\//);
  assert.match(source,/https:\/\/www\.federalreserve\.gov\/feeds\/speeches\.xml/);
  assert.match(source,/not_configured/);
  assert.match(view,/feeds needing review/);
  assert.match(view,/not configured/);
});
