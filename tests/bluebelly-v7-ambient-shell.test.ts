import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=(name:string)=>readFileSync(new URL("../"+name,import.meta.url),"utf8");

test("shared v7 shell mounts pointer halo and sidebar splash once without duplicate navigation",()=>{
  const header=read("components/blue-desk/BlueDeskHeader.tsx");
  assert.match(header,/import CommandPointerHalo from "\.\/CommandPointerHalo"/);
  assert.match(header,/import CommandSidebarSplash from "\.\/CommandSidebarSplash"/);
  assert.match(header,/data-bluebelly-layout="v7-command"/);
  assert.match(header,/<CommandPointerHalo\/>/);
  assert.match(header,/<CommandSidebarSplash\/>/);
  assert.match(header,/aria-label="Bluebelly command navigation"/);
  assert.match(header,/const publicHost = isBlueDeskPublicReaderHost\(host\)/);
  assert.match(header,/ownerWorkspace/);
  assert.match(header,/blueDeskPublicHref/);
  assert.equal(header.match(/<CommandPointerHalo\/>/g)?.length,1);
  assert.equal(header.match(/<CommandSidebarSplash\/>/g)?.length,1);
});

test("pointer movement uses local rAF and tears down listeners, never mutates market state",()=>{
  const src=read("components/blue-desk/CommandPointerHalo.tsx");
  assert.match(src,/"use client"/);
  assert.match(src,/data-bluebelly-pointer-halo="presentation-only"/);
  assert.match(src,/aria-hidden="true"/);
  assert.match(src,/window\.addEventListener\("pointermove",move,\{passive:true\}\)/);
  assert.match(src,/window\.requestAnimationFrame\(render\)/);
  assert.match(src,/window\.cancelAnimationFrame\(frame\)/);
  assert.match(src,/window\.removeEventListener\("pointermove",move\)/);
  assert.match(src,/window\.removeEventListener\("blur",hide\)/);
  assert.match(src,/document\.removeEventListener\("visibilitychange",visibility\)/);
  assert.match(src,/contrast\.removeEventListener\("change",modeChange\)/);
  assert.match(src,/reduced\.removeEventListener\("change",modeChange\)/);
  assert.match(src,/event\.pointerType!=="mouse"/);
  assert.match(src,/window\.innerWidth>720/);
  assert.doesNotMatch(src,/localStorage|sessionStorage|fetch\(|sendBeacon|WebSocket|navigator\.geolocation|setInterval/);
  assert.doesNotMatch(src,/document\.body\.style|document\.documentElement\.style/);
});

test("pointer halo cannot intercept clicks and fails closed for reduced motion, touch and print",()=>{
  const css=read("components/blue-desk/CommandPointerHalo.module.css");
  assert.match(css,/pointer-events:none/);
  assert.match(css,/opacity:0/);
  assert.match(css,/data-visible="true"/);
  assert.match(css,/var\(--bb-command-alt\)/);
  assert.match(css,/var\(--bb-command-accent\)/);
  assert.match(css,/max-width:720px/);
  assert.match(src,/event\.pointerType!=="mouse"/);
  assert.match(css,/prefers-reduced-motion:reduce/);
  assert.match(css,/prefers-contrast:more/);
  assert.match(css,/forced-colors:active/);
  assert.match(css,/@media print/);
});

test("original sidebar splash is a decorative, theme-aware vector beneath interactive nav",()=>{
  const art=read("components/blue-desk/CommandSidebarSplash.tsx");
  const css=read("components/blue-desk/CommandSidebarSplash.module.css");
  const chrome=read("components/blue-desk/bluebelly-chrome.module.css");
  assert.match(art,/data-bluebelly-sidebar-splash="vector-ambient-art"/);
  assert.match(art,/aria-hidden="true"/);
  assert.match(art,/<svg/);
  assert.match(art,/focusable="false"/);
  assert.match(art,/className=\{styles\.scanline\}/);
  assert.match(css,/pointer-events:none/);
  assert.match(css,/z-index:0/);
  assert.match(css,/var\(--bb-command-accent\)/);
  assert.match(css,/var\(--bb-command-alt\)/);
  assert.match(css,/prefers-reduced-motion:reduce/);
  assert.match(css,/forced-colors:active/);
  assert.match(chrome,/\.commandSide\{isolation:isolate\}/);
  assert.match(chrome,/\.commandSide \.sideBrand,\.commandSide \.sideNav,\.commandSide \.sideFooter/);
  assert.match(chrome,/position:relative;z-index:1/);
  assert.match(chrome,/\.commandSide \.sideCurrent/);
  assert.match(chrome,/\.commandSide \.sideLink:focus-visible/);
});

test("existing four-theme palette and private navigation rules are unchanged",()=>{
  const tokens=read("app/bluebelly-tokens.css");
  const header=read("components/blue-desk/BlueDeskHeader.tsx");
  for(const theme of ["yellow-black","turquoise","neon-blue","pastel-green"])
    assert.ok(tokens.includes('data-bluebelly-theme="'+theme+'"'),"theme "+theme);
  assert.match(header,/const nav = publicHost && !ownerWorkspace \? PUBLIC_NAV : PRIVATE_NAV/);
  assert.match(header,/\["My Desk", "\/my-reports"\]/);
  assert.doesNotMatch(header,/useState|useEffect|localStorage/);
});
