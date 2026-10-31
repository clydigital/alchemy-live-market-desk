import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("retired Live Desk composite redirects without any database fetching", () => {
  const page = read("app/legacy/page.tsx");
  assert.match(page, /legacyTabRedirect\(tab\)/);
  assert.match(page, /redirect\(target \?\? "\/blue-desk"\)/);
  assert.doesNotMatch(page, /getDeskData|getMarketData|getEconomicCalendar|MarketWorkspace|Promise\.all/);
});

test("retired Live Desk links cannot send users in circles", () => {
  const history = read("app/tools/history/page.tsx");
  const macro = read("app/data/macro/page.tsx");
  assert.doesNotMatch(history, /\/legacy\?tab=Ledger/);
  assert.doesNotMatch(macro, /\/legacy\?tab=Macro/);
  assert.match(macro, /https:\/\/bluebelly-desk\.vercel\.app\/calendar/);
});

test("legacy presentation retirement does not touch machine, auth, or edition routes", () => {
  const page = read("app/legacy/page.tsx");
  assert.doesNotMatch(page, /api\/|auth\/|edition\s*=|supabase|service_role/);
  const routing = read("lib/bluebelly-legacy-human-retirement.ts");
  assert.match(routing, /historical_edition_needs_exact_replay/);
  assert.match(routing, /owner_host_not_yet_proven/);
});
