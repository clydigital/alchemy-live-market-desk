import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const page=readFileSync(new URL("../app/blue-desk/newsroom/week-ahead/page.tsx",import.meta.url),"utf8");
test("frozen 2 November Midterm cross-asset review has explicit source and uncertainty boundaries",()=>{
 assert.match(page,/data-midterm-crossasset="creator-attributed-frozen-2026-11-02"/);
 for(const id of ["QT82i3qsHjs","vYAAtuF8_Cs"])assert.match(page,new RegExp(id));
 for(const asset of ["SPY","QQQ","SMH","SOXX","PLTR","VGK","XLE","TSLA","BA","IBIT","DXY","RSP"])assert.match(page,new RegExp(asset));
 assert.match(page,/13\.89% over six months/);
 assert.match(page,/15\.4% average twelve-month gain/);
 assert.match(page,/creator claim is canonical Bluebelly market evidence/);
 assert.match(page,/Both <strong>crash and durable rebound remain unconfirmed<\/strong>/);
 assert.match(page,/What happens next/);
 assert.match(page,/BLS official calendar/);
 assert.match(page,/midterm-views/);
 assert.match(page,/Goldman Sachs Asset Management/);
});
