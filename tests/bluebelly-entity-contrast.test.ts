import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
function source(path:string){return readFileSync(new URL("../"+path,import.meta.url),"utf8");}
test("shared company icons contrast on navy, with no duplicate calendar logo palette",()=>{
 const css=source("components/blue-desk/EntityIdentity.module.css");
 const calendar=source("components/blue-desk/CatalystCalendar.module.css");
 assert.match(css,/\.company\{background:linear-gradient\(145deg,#f6fbfc,#dcecef\)/);
 assert.match(css,/color:#214156/);
 assert.match(css,/\.company img\{/);
 assert.doesNotMatch(calendar,/\.companyMark,\.countryBall/);
 assert.doesNotMatch(calendar,/\.countryBall\{/);
});
