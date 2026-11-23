import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync(new URL("../lib/bluebelly-catalyst-sources.ts",import.meta.url),"utf8");
function pattern(name:"publicDomain"|"calendarPublisher"){
 const literal=source.match(new RegExp("const "+name+" = (/[^\\n]+/)\\.test\\(host\\)"))?.[1];
 assert.ok(literal,name+" source allowlist regex not found");
 return new RegExp(literal.slice(1,-1));
}
test("official government publisher checks accept genuine federal domains, reject lookalikes",()=>{
 const official=pattern("publicDomain");
 for(const host of ["www.bls.gov","www.bea.gov","www.eia.gov","www.federalreserve.gov","www.bankofengland.co.uk"])
  assert.equal(official.test(host),true,host);
 for(const host of ["www.bls.gov.evil.example","example.gov.fake","fakegov.com"])
  assert.equal(official.test(host),false,host);
});
test("corroborated calendar allowlist accepts known release publishers, rejects suffix spoofing",()=>{
 const corroborated=pattern("calendarPublisher");
 for(const host of ["pmi.spglobal.com","www.ifo.de","www.treasurydirect.gov","www.conference-board.org"])
  assert.equal(corroborated.test(host),true,host);
 for(const host of ["pmi.spglobal.com.evil.example","www.ifo.de.fake"])
  assert.equal(corroborated.test(host),false,host);
});
