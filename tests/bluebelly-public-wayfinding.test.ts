import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { blueDeskHostAccess, blueDeskPublicHref } from "../lib/blue-desk-host.ts";

const page = readFileSync(new URL("../app/blue-desk/page.tsx", import.meta.url), "utf8");
const publicHost = "bluebelly-desk.vercel.app";

test("Bluebelly Treasury shortcuts open the source-dated rates view, not the homepage", () => {
  assert.match(page, /blueDeskPublicHref\("\/blue-desk\/markets\?group=rates", host\)/);
  assert.match(page, /href="\/markets\?group=rates">Observed Treasury yields and history/);
  assert.doesNotMatch(page, /href="\/#rates-title">Observed Treasury yields/);
  assert.equal(blueDeskPublicHref("/blue-desk/markets?group=rates", publicHost), "/markets?group=rates");
  assert.equal(blueDeskHostAccess("/markets", publicHost), "public");
});

test("Public shortcuts lead to the existing Earnings Hub and Daily Report", () => {
  assert.match(page, /href="\/calendar#earnings-hub">Company earnings this week/);
  assert.match(page, /href="\/daily-report">Daily Market Report/);
  assert.equal(blueDeskHostAccess("/calendar", publicHost), "public");
  assert.equal(blueDeskHostAccess("/daily-report", publicHost), "public");
});

test("Public hero omits internal Dossier approval jargon and private destinations remain gated", () => {
  assert.doesNotMatch(page, /No Dossier approval required/);
  assert.match(page, /SOURCE-VERIFIED FACT/);
  assert.match(page, /DATED STORY CONTEXT/);
  assert.equal(blueDeskHostAccess("/owner/presenter", publicHost), "private");
  assert.equal(blueDeskHostAccess("/newsroom", publicHost), "public");
  assert.equal(blueDeskHostAccess("/regime-watch", publicHost), "public");
});
