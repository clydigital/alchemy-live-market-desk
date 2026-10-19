import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pages = ["app/blue-desk/page.tsx", "app/blue-desk/calendar/page.tsx"];
const unwanted = [
  "LIVE DESK INTELLIGENCE",
  "BLUE DESK PRESENTATION",
  "Provider snapshots, not live quotes",
  "Each observation retains its own date",
  "Eastern Time first",
  "Singapore Time beneath",
  "ET PRIMARY · SGT SECONDARY",
  "LIVE DESK VERIFIED SOURCE SCHEDULE",
  "ONE INTELLIGENCE AUTHORITY",
  "Publication time and observation time remain distinct",
];

test("Blue Desk pages do not display internal branding explanations or timezone instructions", () => {
  for (const path of pages) {
    const source = readFileSync(new URL("../" + path, import.meta.url), "utf8");
    for (const text of unwanted) {
      assert.equal(source.includes(text), false, path + " includes redundant text: " + text);
    }
  }
});

test("Blue Desk keeps essential source coverage and timestamp evidence visible", () => {
  const home = readFileSync(new URL("../app/blue-desk/page.tsx", import.meta.url), "utf8");
  const calendar = readFileSync(new URL("../app/blue-desk/calendar/page.tsx", import.meta.url), "utf8");
  assert.match(home, /sourceHealth\.warnings/);
  assert.match(home, /DualTimestamp value=\{row\.asOf\}/);
  assert.match(calendar, /sourceHealth\.warnings/);
  assert.match(calendar, /event\.scheduledAt/);
  assert.match(calendar, /TIME NOT CONFIRMED/);
});
