import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("v7 shell reuses canonical host-aware links and preserves source search", () => {
  const header = read("components/blue-desk/BlueDeskHeader.tsx");
  assert.match(header, /data-bluebelly-layout="v7-command"/);
  assert.match(header, /className=\{chrome\.commandCrumb\}/);
  assert.match(header, /className=\{chrome\.navHint\}/);
  assert.match(header, /blueDeskPublicHref\(path,\s*host\)/);
  assert.match(header, /const PUBLIC_NAV/);
  assert.match(header, /const PUBLIC_MORE/);
  assert.match(header, /CurrentMarketUpdates host=\{host\} mode="mast"/);
  assert.match(header, /action=\{publicHost\?"\/newsroom":"\/blue-desk\/newsroom"\}/);
  assert.match(header, /aria-label="Bluebelly command"/);
  assert.match(header, /href=\{blueDeskPublicHref\("\/blue-desk",host\)\}/);
  assert.match(header, /\["My Desk", "\/my-reports"\]/);
  assert.doesNotMatch(header, /localStorage|sessionStorage|window\.location|fetch\(/);
});

test("v7 shell keeps four existing theme IDs, accessible rail and compact mobile fallback", () => {
  const tokens = read("app/bluebelly-tokens.css");
  const styles = read("components/blue-desk/bluebelly-chrome.module.css");
  const prefs = read("components/blue-desk/ThemePreferences.tsx");
  for (const theme of ["yellow-black", "turquoise", "neon-blue", "pastel-green"]) {
    assert.match(tokens, new RegExp(`data-bluebelly-theme="${theme}"`));
    assert.match(prefs, new RegExp(`'${theme}'`));
  }
  assert.match(tokens, /body:has\(header\[data-bluebelly-layout="v7-command"\]\)/);
  assert.match(styles, /\.commandSide\{/);
  assert.match(styles, /\.sideCurrent\{/);
  assert.match(styles, /max-width:1050px/);
  assert.match(styles, /max-width:720px/);
  assert.match(styles, /prefers-reduced-motion/);
  assert.match(styles, /@media\(min-width:721px\)/);
  assert.match(styles, /\.mastInner>\.brand\{display:none\}/);
  assert.match(styles, /\.links,\.mobileNav\{display:none\}/);
  assert.doesNotMatch(tokens, /data-theme=/);
});
