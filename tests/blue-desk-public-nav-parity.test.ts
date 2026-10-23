import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { blueDeskHostAccess } from "../lib/blue-desk-host.ts";

const header = readFileSync(new URL("../components/blue-desk/BlueDeskHeader.tsx", import.meta.url), "utf8");
const homepage = readFileSync(new URL("../app/blue-desk/page.tsx", import.meta.url), "utf8");

test("public header links target genuine approved reading routes, not homepage anchor loops", () => {
  const match = header.match(/const PUBLIC_NAV = \[([\s\S]*?)\] as const;/);
  assert.ok(match, "public navigation must be explicitly enumerated");
  const hrefs = [...match[1].matchAll(/\["[^"]+",\s*"([^"]+)"\]/g)].map(m => m[1]);
  assert.deepEqual(hrefs, ["/", "/key-stories", "/rates", "/what-changed", "/markets", "/calendar", "/presenter", "/learn"]);
  assert.ok(hrefs.every(href => !href.includes("#")));
  const ratesReader = readFileSync(new URL("../app/blue-desk/markets/page.tsx", import.meta.url), "utf8");
  assert.match(ratesReader, /publicOfficialMacroTrends/);
  assert.match(ratesReader, /group === "rates" \? "\/markets\?group=rates"/);
  assert.match(ratesReader, /<PublicGovernmentRateTrendChart/);
  for (const href of hrefs) {
    const url = new URL(href, "https://bluebelly-desk.vercel.app");
    assert.equal(blueDeskHostAccess(url.pathname, url.hostname), href === "/presenter" ? "private" : "public", href);
    assert.equal(blueDeskHostAccess(url.pathname, "alchemy-live-market-desk.vercel.app"), href === "/presenter" ? "private" : "public", href);
    assert.equal(url.hash, "", "Primary navigation must not loop to homepage sections");
  }
});

test("private legacy navigation remains available only on owner host", () => {
  assert.match(header, /publicHost \? PUBLIC_NAV : PRIVATE_NAV/);
  assert.match(header, /isBlueDeskPublicReaderHost\(host\)/);
  for (const privatePath of ["/articles", "/blue-desk/presenter", "/data/macro", "/concepts"]) {
    assert.ok(header.includes('"' + privatePath + '"'), privatePath + " must be preserved for private host");
    assert.equal(blueDeskHostAccess(privatePath, "bluebelly-desk.vercel.app"), "blocked");
  }
  assert.match(homepage, /publicHost \? \(/);
  assert.match(homepage, /<Link href="\/hybrid-output\/prepare">Presenter Studio →<\/Link>/);
  assert.match(homepage, /<Link href="\/calendar">Public calendar →<\/Link>/);
  assert.match(homepage, /<Link href="\/presenter">Presenter Deck \(sign-in\) →<\/Link>/);
  assert.match(homepage, /<Link href="\/markets">Public markets →<\/Link>/);
});

test("no dead public links are advertised in the homepage special panels", () => {
  assert.match(homepage, /publicHost \? blueDeskPublicHref\("\/blue-desk\/markets", host\) : "\/markets"/);
  assert.match(homepage, /!publicHost \? <Link href="\/articles"/);
  assert.match(homepage, /!publicHost \? <Link className=\{styles\.textLink\} href="\/whats-new"/);
  assert.match(homepage, /publicHost \? "Explore public research" : "Dossier, Journey and presenter preparation"/);
  assert.match(homepage, /sourceFact\.sourceUrl/);
});
