import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const calendar=read("components/blue-desk/CatalystCalendar.tsx");
const calendarCSS=read("components/blue-desk/CatalystCalendar.module.css");
const tokens=read("app/bluebelly-tokens.css");
const header=read("components/blue-desk/BlueDeskHeader.tsx");
const toggle=read("components/blue-desk/CommandSidebarToggle.tsx");
const chrome=read("components/blue-desk/bluebelly-chrome.module.css");

test("Shared Bluebelly command header owns one accessible shelf button on every page",()=>{
  assert.match(header,/id="bluebelly-command-navigation"/);
  assert.match(header,/import CommandSidebarToggle from "\.\/CommandSidebarToggle"/);
  assert.match(header,/<CommandSidebarToggle\/>/);
  assert.match(toggle,/const \[shelved,setShelved\]=useState\(false\)/);
  assert.match(toggle,/onClick=\{\(\)=>setShelved\(value=>!value\)\}/);
  assert.match(toggle,/aria-controls="bluebelly-command-navigation"/);
  assert.match(toggle,/aria-expanded=\{!shelved\}/);
  assert.match(toggle,/Show navigation sidebar/);
  assert.match(toggle,/Hide navigation sidebar/);
});

test("Shelving persists across page transitions and disables offscreen keyboard navigation",()=>{
  assert.match(toggle,/window\.localStorage\.getItem\(STORAGE_KEY\)/);
  assert.match(toggle,/window\.localStorage\.setItem\(STORAGE_KEY,shelved\?"1":"0"\)/);
  assert.match(toggle,/root\.setAttribute\("data-bluebelly-sidebar","shelved"\)/);
  assert.match(toggle,/nav\?\.setAttribute\("inert",""\)/);
  assert.match(toggle,/nav\?\.removeAttribute\("inert"\)/);
  assert.match(toggle,/root\.removeAttribute\("data-bluebelly-sidebar"\)/);
  assert.match(tokens,/html\[data-bluebelly-sidebar="shelved"\]/);
  assert.match(tokens,/padding-inline-start:0/);
  assert.match(tokens,/transform:translateX\(-100%\)/);
  assert.match(tokens,/cubic-bezier\(\.2,\.8,\.2,1\)/);
});

test("Shelf button stays flush to the far-left viewport edge in both states",()=>{
  assert.match(chrome,/\.sidebarToggle\{/);
  assert.match(chrome,/position:fixed;left:0;bottom:clamp\(20px,4vh,42px\)/);
  assert.doesNotMatch(chrome,/\.sidebarToggle\{left:(?:232|68)px/);
  assert.doesNotMatch(chrome,/\.sidebarToggle\[data-shelved="true"\]\{left:0\}/);
  assert.match(chrome,/\.commandSide \.sideFooter\{padding-left:52px\}/);
  assert.match(chrome,/@media\(max-width:720px\)\{\.sidebarToggle\{display:none\}\}/);
  assert.match(chrome,/\.sidebarToggle:focus-visible/);
  assert.match(chrome,/prefers-reduced-motion:reduce/);
  assert.match(tokens,/prefers-reduced-motion:reduce/);
  // Unmounting the header must not clear persisted root state and flash the rail.
  assert.doesNotMatch(toggle,/return \(\)=>\{\s*root\.removeAttribute\("data-bluebelly-sidebar"\)/);
});

test("Calendar has no second toggle and retains the unchanged week board",()=>{
  assert.doesNotMatch(calendar,/navShelved|sidebarToggle|data-bluebelly-calendar-nav/);
  assert.doesNotMatch(calendarCSS,/\.sidebarToggle\{/);
  assert.doesNotMatch(tokens,/data-bluebelly-calendar-nav/);
  assert.match(calendar,/data-catalyst-calendar="v4"/);
  assert.match(calendar,/className=\{styles\.board\}/);
});

test("Wide-screen calendar board still fills the reclaimed width",()=>{
  const page=read("app/blue-desk/calendar/page.tsx");
  assert.match(page,/data-blue-desk-calendar="ET-primary"/);
  assert.match(tokens,/main\[data-blue-desk-calendar="ET-primary"\] > div\{/);
  assert.match(tokens,/max-width:none/);
  assert.match(tokens,/width:100%/);
});

test("Single far-left control follows theme accent, not a hardcoded yellow tab",()=>{
  assert.match(chrome,/width:44px;height:44px;min-height:44px/);
  assert.match(chrome,/background:var\(--bb-command-accent\);border:1px solid var\(--bb-command-accent\)/);
  assert.match(chrome,/position:fixed;left:0;bottom:clamp\(20px,4vh,42px\)/);
  assert.match(toggle,/className=\{chrome\.toggleArrow\}/);
  assert.doesNotMatch(toggle,/>NAV</);
  assert.doesNotMatch(toggle,/createPortal|sidebarHideText|bluebelly-command-footer|Hide navbar/);
  assert.doesNotMatch(header,/bluebelly-command-footer/);
  assert.doesNotMatch(chrome,/\.sidebarHideText|\.toggleLabel/);
  assert.match(toggle,/onClick=\{\(\)=>setShelved\(value=>!value\)\}/);
  assert.match(toggle,/aria-expanded=\{!shelved\}/);
});
