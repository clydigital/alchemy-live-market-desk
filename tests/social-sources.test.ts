import { test, describe } from "node:test";
import assert from "node:assert";
import { getSocialWatchlist, matchSocialAccount } from "../lib/social-sources.ts";

describe("Alchemy Social Sources Watchlist Tests", () => {
  test("watchlist contains all nine canonical watched accounts", () => {
    const list = getSocialWatchlist();
    const handles = list.map(a => a.handle.toLowerCase());
    const expected = [
      "bluekurtic",
      "hfi_research",
      "oilandenergy",
      "thestudyofwar",
      "currentreport1",
      "arena",
      "kobeissiletter",
      "firstsquawk",
      "zerohedge"
    ];

    assert.strictEqual(list.length, 9);
    for (const item of expected) {
      assert.ok(handles.includes(item), `Watchlist missing account: ${item}`);
    }
  });

  test("source classification matches correct metadata", () => {
    const bluekurtic = matchSocialAccount("Bluekurtic");
    assert.ok(bluekurtic);
    assert.strictEqual(bluekurtic.handle, "Bluekurtic");
    assert.strictEqual(bluekurtic.priority, "high");
    assert.strictEqual(bluekurtic.requiresCorroboration, false);
    assert.strictEqual(bluekurtic.evidenceClass, "specialist_commentary");

    const isw = matchSocialAccount("https://x.com/TheStudyofWar");
    assert.ok(isw);
    assert.strictEqual(isw.handle, "TheStudyofWar");
    assert.strictEqual(isw.category, "specialist geopolitical source");

    const firstSquawk = matchSocialAccount("@FirstSquawk");
    assert.ok(firstSquawk);
    assert.strictEqual(firstSquawk.handle, "FirstSquawk");
    assert.strictEqual(firstSquawk.requiresCorroboration, true);
    assert.strictEqual(firstSquawk.category, "breaking signal");

    const zerohedge = matchSocialAccount("https://twitter.com/zerohedge/status/12345");
    assert.ok(zerohedge);
    assert.strictEqual(zerohedge.handle, "zerohedge");
    assert.strictEqual(zerohedge.requiresCorroboration, true);
    assert.strictEqual(zerohedge.priority, "medium-high");
  });

  test("returns null for unmatched handle or invalid URL", () => {
    assert.strictEqual(matchSocialAccount("invalid_handle_xyz_123"), null);
    assert.strictEqual(matchSocialAccount("https://example.com/not_twitter"), null);
    assert.strictEqual(matchSocialAccount(null), null);
    assert.strictEqual(matchSocialAccount(undefined), null);
  });
});
