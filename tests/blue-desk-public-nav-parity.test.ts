import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { blueDeskHostAccess } from "../lib/blue-desk-host.ts";

const header = readFileSync(new URL("../components/blue-desk/BlueDeskHeader.tsx", import.meta.url), "utf8");
const homepage = readFileSync(new URL("../app/blue-desk/page.tsx", import.meta.url), "utf8");

test("all visible public header links target approved host paths and real anchors", () => {
  const match = header.match(/const PUBLIC_NAV = \[([\s\S]*?)\] as const;/);
  assert.ok(match, "public navigation must be explicitly enumerated");
  const hrefs = [...match[1].matchAll(/\["[^"]+",\s*"([^"]+)"\]/g)].map(m => m[1]);
  assert.deepEqual(hrefs, ["/", "/key-stories", "/markets", "/calendar"]);
  for (const href of hrefs) {
    const url = new URL(href, "https://bluebelly-desk.vercel.app");
    assert.equal(blueDeskHostAccess(url.pathname, url.hostname), "public", href);
    assert.equal(blueDeskHostAccess(url.pathname, "alchemy-live-market-desk.vercel.app"), "public", href);
    if (url.hash) assert.match(homepage, new RegExp('id="' + url.hash.slice(1) + '"'));
    if (url.pathname === "/key-stories") {
      const page=readFileSync(new URL("../app/blue-desk/key-stories/page.tsx",import.meta.url),"utf8");
      assert.match(page,/data-bluebelly-stories="catalyst-led"/);
    }
  }
});

test("private legacy navigation remains available only on owner host", () => {
  assert.match(header, /publicHost && !ownerWorkspace \? PUBLIC_NAV : PRIVATE_NAV/);
  assert.match(header, /activePath === "\/owner\/editorial"/);
  assert.match(header, /activePath === "\/owner\/presenter"/);
  assert.match(header, /isBlueDeskPublicReaderHost\(host\)/);
  const privateNav=header.split("const PRIVATE_NAV = [")[1]?.split("] as const;")[0]||"";
  const privateLinks=[...privateNav.matchAll(/\["[^"]+",\s*"([^"]+)"\]/g)].map(m=>m[1]);
  assert.deepEqual(privateLinks, ["/blue-desk", "/blue-desk/key-stories", "/markets",
    "/owner/daily-report", "/owner/editorial", "/owner/presenter", "/blue-desk/calendar"]);
  for(const privatePath of ["/articles","/data/macro","/concepts","/owner/daily-articles","/owner/x-wire"]){
    assert.equal(blueDeskHostAccess(privatePath,"bluebelly-desk.vercel.app"),"blocked");
    assert.ok(!privateLinks.includes(privatePath),"legacy links stay outside the main navigation");
  }
  assert.ok(!privateNav.includes("/owner/publications"));
  assert.ok(!privateNav.includes("Publish Reports"));
  assert.match(homepage, /publicHost \? \(/);
  assert.match(homepage, /<Link href="\/owner\/presenter">Presenter Studio →<\/Link>/);
  assert.match(homepage, /<Link href="\/calendar">Public calendar →<\/Link>/);
  assert.match(homepage, /<Link href="\/markets">Public markets →<\/Link>/);
});

test("no dead public links are advertised in the homepage special panels", () => {
  assert.match(homepage, /publicHost \? blueDeskPublicHref\("\/blue-desk\/markets", host\) : "\/markets"/);
  assert.doesNotMatch(homepage, /listPublishedReports/);
  assert.match(homepage, /!publicHost \? <Link className=\{styles\.textLink\} href="\/whats-new"/);
  assert.match(homepage, /publicHost \? "Explore public research" : "Dossier, Journey and presenter preparation"/);
  assert.match(homepage, /newsFeature\.sourceUrl/);
});
