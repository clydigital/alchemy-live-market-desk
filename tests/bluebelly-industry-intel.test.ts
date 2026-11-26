import test from "node:test";
import assert from "node:assert/strict";
import {INDUSTRY_LENSES,INDUSTRY_CONDITIONAL_TESTS,MATERIAL_RESEARCH_QUESTIONS,industryNews,questionNews} from "../lib/bluebelly-industry-intel.ts";
import {blueDeskHostAccess,blueDeskPresentationTarget} from "../lib/blue-desk-host.ts";
test("industry questions retain unique identities and valid lens links",()=>{
 assert.equal(INDUSTRY_LENSES.length,8);
 assert.equal(new Set(MATERIAL_RESEARCH_QUESTIONS.map(q=>q.id)).size,MATERIAL_RESEARCH_QUESTIONS.length);
 for(const q of MATERIAL_RESEARCH_QUESTIONS)for(const id of q.lenses)assert.ok(INDUSTRY_LENSES.some(l=>l.id===id));
});
test("related headlines require entity and issue terms; absence is not a verdict",()=>{
 const a={headline:"Google adjusts TPU procurement",summary:"Supplier allocation changes"};
 const b={headline:"Google launches new search feature",summary:"New consumer product"};
 const c={headline:"Tesla and SpaceX merger talks",summary:"Special committee negotiations"};
 assert.deepEqual(questionNews("google-accelerator-allocation",[a,b,c]),[a]);
 assert.deepEqual(questionNews("tesla-spacex-transaction",[a,b,c]),[c]);
 assert.deepEqual(industryNews("unknown",[a]),[]);
 assert.deepEqual(questionNews("google-accelerator-allocation",[]),[]);
});
test("only exact public industry route is enabled, not arbitrary child routes",()=>{
 const h="bluebelly-desk.vercel.app";
 assert.equal(blueDeskHostAccess("/industry-intel",h),"public");
 assert.equal(blueDeskHostAccess("/industry-intel/private",h),"blocked");
 assert.equal(blueDeskPresentationTarget("/industry-intel",h),"/blue-desk/industry-intel");
});

test("each persistent industry question has a conditional mechanism and countercase",()=>{
 for(const q of MATERIAL_RESEARCH_QUESTIONS){assert.ok(INDUSTRY_CONDITIONAL_TESTS[q.id]?.ifThen);assert.ok(INDUSTRY_CONDITIONAL_TESTS[q.id]?.countercase);}
});

 test("Take-Two thread is consumer-only, distinguishes source facts from conditional economics and matches relevant news",()=>{
 const q=MATERIAL_RESEARCH_QUESTIONS.find(x=>x.id==="ttwo-recurring-monetisation");
 assert.ok(q);assert.deepEqual(q.lenses,["consumer"]);assert.deepEqual(q.companies,["TTWO"]);
 const hypothesis=INDUSTRY_CONDITIONAL_TESTS[q.id];assert.equal(hypothesis.disclosed?.length,4);assert.ok(hypothesis.comparison?.includes("contractual ARR"));assert.ok(hypothesis.ifThen.includes("hypotheses"));
 const yes={headline:"Take-Two reports GTA VI launch bookings",summary:"Recurring spending guidance"};
 const no={headline:"Take-Two appoints director",summary:"Board update"};
 assert.deepEqual(questionNews(q.id,[yes,no]),[yes]);
 for(const source of hypothesis.disclosed??[])assert.equal(new URL(source.url).protocol,"https:");
 });
