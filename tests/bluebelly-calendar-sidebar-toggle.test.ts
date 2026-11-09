import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const calendar=read("components/blue-desk/CatalystCalendar.tsx");
const calendarCSS=read("components/blue-desk/CatalystCalendar.module.css");
const tokens=read("app/bluebelly-tokens.css");
const header=read("components/blue-desk/BlueDeskHeader.tsx");

test("Calendar provides one accessible button for both shelving and restoring the desktop rail",()=>{
  assert.match(header,/id="bluebelly-command-navigation"/);
  assert.match(calendar,/const \[navShelved,setNavShelved\]=useState\(false\)/);
  assert.match(calendar,/onClick=\{\(\)=>setNavShelved\(value=>!value\)\}/);
  assert.match(calendar,/aria-controls="bluebelly-command-navigation" aria-expanded=\{!navShelved\}/);
  assert.match(calendar,/Show navigation sidebar/);
  assert.match(calendar,/Hide navigation sidebar/);
});

test("Calendar nav state releases the layout width and removes the rail from keyboard navigation when shelved",()=>{
  assert.match(calendar,/root\.setAttribute\("data-bluebelly-calendar-nav","shelved"\)/);
  assert.match(calendar,/sidebar\?\.setAttribute\("inert",""\)/);
  assert.match(calendar,/sidebar\?\.removeAttribute\("inert"\)/);
  assert.match(calendar,/root\.removeAttribute\("data-bluebelly-calendar-nav"\)/);
  assert.match(tokens,/html\[data-bluebelly-calendar-nav="shelved"\]/);
  assert.match(tokens,/padding-inline-start:0/);
  assert.match(tokens,/transform:translateX\(-100%\)/);
  assert.match(tokens,/cubic-bezier\(\.2,\.8,\.2,1\)/);
});

test("Toggle preserves keyboard focus affordance, tablet rail spacing and reduced-motion/mobile rules",()=>{
  assert.match(calendarCSS,/\.sidebarToggle\[data-shelved="true"\]\{left:0\}/);
  assert.match(calendarCSS,/@media\(min-width:721px\) and \(max-width:1050px\)/);
  assert.match(calendarCSS,/@media\(max-width:720px\)\{\.sidebarToggle\{display:none\}\}/);
  assert.match(calendarCSS, /prefers-reduced-motion:reduce/);
  assert.match(tokens,/prefers-reduced-motion:reduce/);
  assert.match(calendarCSS,/\.root button:focus-visible/);
  assert.match(calendar,/data-catalyst-calendar="v4"/);
  assert.match(calendar,/className=\{styles\.board\}/);
});

test("Wide-screen week board is not trapped behind the general 1460px article maximum",()=>{
  const page=read("app/blue-desk/calendar/page.tsx");
  assert.match(page,/data-blue-desk-calendar="ET-primary"/);
  assert.match(tokens,/main\[data-blue-desk-calendar="ET-primary"\] > div\{/);
  assert.match(tokens,/max-width:none/);
  assert.match(tokens,/width:100%/);
});
