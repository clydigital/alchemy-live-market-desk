import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import {blueDeskHostAccess} from "../lib/blue-desk-host.ts";

test("private Research Library lists November housing earnings investigation as research, not canonical news",()=>{
  const src=readFileSync(new URL("../components/blue-desk/ResearchLibraryExplorer.tsx",import.meta.url),"utf8");
  assert.match(src,/id:"housing-20261104"/);
  assert.match(src,/title:"4 November — Housing stocks rally, builders still cut prices"/);
  assert.match(src,/40e519b67a94817e9c61c030e7ca5849/);
  assert.match(src,/quality:"Private editorial research · not canonical"/);
  assert.match(src,/updated:"2026-11-04"/);
  assert.match(src,/Longbridge and housing data/);
  assert.equal(blueDeskHostAccess("/owner/research","bluebelly-desk.vercel.app"),"private");
});
