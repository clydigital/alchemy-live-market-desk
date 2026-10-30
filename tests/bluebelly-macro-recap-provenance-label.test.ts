import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {decisionRecapSourceLabel} from "../lib/bluebelly-recap-provenance.ts";

test("BEA macro outcome must never receive issuer-verified earnings provenance",()=>{
 assert.equal(decisionRecapSourceLabel("FEATURE",false,"bea-pce-september-2026"),
   "BEA ORIGINAL RELEASE · SOURCE-REVIEWED");
 assert.match(decisionRecapSourceLabel("NEW",true,"amazon-2026q3"),/ISSUER-REVIEWED/);
 assert.equal(decisionRecapSourceLabel("UPCOMING",false,"issuer-ir:CRWV:Q3 2026"),
   "PREVIEW · OUTCOME NOT YET VERIFIED");
 assert.equal(decisionRecapSourceLabel("NEW",false,"generic-headline"),
   "SOURCE-REVIEWED MARKET DEVELOPMENT");
});

test("public decision recap obtains its label from the typed source helper",()=>{
 const source=readFileSync(new URL("../components/blue-desk/ShortNewsRecap.tsx",import.meta.url),"utf8");
 assert.match(source,/decisionRecapSourceLabel\(topic.status,Boolean\(earnings\),topic.id\)/);
});
