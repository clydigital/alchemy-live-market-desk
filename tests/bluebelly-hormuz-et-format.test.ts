import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {formatHormuzET} from "../lib/bluebelly-hormuz-time.ts";
test("ET formatter works on Node and names actual daylight-saving timezone",()=>{
 assert.match(formatHormuzET(new Date("2026-10-28T18:00:00Z")),/Oct 28, 2026.*2:00 PM EDT/);
 assert.match(formatHormuzET(new Date("2026-12-01T18:00:00Z")),/Dec 1, 2026.*1:00 PM EST/);
 assert.equal(formatHormuzET(new Date("not a date")),"Time unavailable");
});
test("public Hormuz route cannot instantiate the unsupported Intl option combination",()=>{
 const page=readFileSync(new URL("../app/blue-desk/hormuz/page.tsx",import.meta.url),"utf8");
 const formatter=readFileSync(new URL("../lib/bluebelly-hormuz-time.ts",import.meta.url),"utf8");
 assert.match(page,/formatHormuzET\(now\)/);
 assert.match(page,/formatHormuzET\(new Date\(report.occurredAt\)\)/);
 assert.doesNotMatch(page,/dateStyle:\s*"medium"/);
 assert.doesNotMatch(formatter,/dateStyle|timeStyle/);
});
