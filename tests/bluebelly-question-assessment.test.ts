import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {projectQuestionAssessment,type QuestionRecord} from "../lib/bluebelly-question-assessment.ts";
import {getReviewedQuestion,getReviewedQuestions,QUESTION_REVIEWED_RECORDS} from "../lib/bluebelly-question-assessment-reviewed.ts";
const mk=(overrides:Partial<QuestionRecord>={}):QuestionRecord=>({
 id:"test",question:"Are things better?",scope:"Explicit objective",comparison:"Previous review",
 horizon:"Days",authority:"SOURCE_REVIEWED_PROVISIONAL",expiresAfterDays:2,
 revisions:[
  {revisionId:"one",reviewedOn:"2026-11-11",sourceThrough:"2026-11-11",verdict:"mixed",
   condition:"Disrupted",why:"Competing evidence",countercase:"There is relief",nextTest:"Official data",
   sources:[{name:"Issuer",url:"https://example.org/source",publishedOn:"2026-11-11"}]},
  {revisionId:"two",reviewedOn:"2026-11-12",sourceThrough:"2026-11-12",verdict:"deteriorating",
   condition:"Still disrupted",why:"New confirmed issue",countercase:"Some relief",nextTest:"Official data",
   sources:[{name:"Issuer",url:"https://example.org/new",publishedOn:"2026-11-12"}]}
 ],...overrides
});
test("previous verdict preserved and explicit source-date comparison used",()=>{
 const read=projectQuestionAssessment(mk(),new Date("2026-11-13T04:00:00Z"));
 assert.equal(read.verdict,"deteriorating");
 assert.equal(read.previousVerdict,"mixed");
 assert.equal(read.previousReviewedOn,"2026-11-11");
 assert.match(read.changeSummary,/Changed from mixed to deteriorating/);
 assert.equal(read.sourceThrough,"2026-11-12");
 assert.equal(read.freshness,"current");
});
test("a stale or unavailable reviewed period cannot silently claim unchanged",()=>{
 const stale=projectQuestionAssessment(mk(),new Date("2026-11-14T04:00:00Z"));
 assert.equal(stale.freshness,"stale");assert.equal(stale.verdict,"insufficient");
 assert.equal(stale.recordedVerdict,"deteriorating");
 const none=projectQuestionAssessment(mk({revisions:[]}),new Date("2026-11-13T04:00:00Z"));
 assert.equal(none.verdict,"insufficient");
});
test("unchanged needs a prior accepted revision and newly source-dated review",()=>{
 const one=mk().revisions[0];
 const bad=projectQuestionAssessment(mk({revisions:[{...one,verdict:"unchanged"}]}),new Date("2026-11-11T12:00:00Z"));
 assert.equal(bad.verdict,"insufficient");
 const same=projectQuestionAssessment(mk({revisions:[one,{...one,revisionId:"new",reviewedOn:"2026-11-12",sourceThrough:"2026-11-12",
  verdict:"unchanged",sources:[{name:"New original review",url:"https://example.org/d",publishedOn:"2026-11-12"}]}]}),new Date("2026-11-12T19:00:00Z"));
 assert.equal(same.verdict,"unchanged");
});
test("an invalid prior revision cannot legitimise an unchanged judgement",()=>{
 const first=mk().revisions[0],last=mk().revisions[1];
 const bad=projectQuestionAssessment(mk({revisions:[{...first,sources:[{name:"Invalid",url:"http://example.org",publishedOn:"2026-11-11"}]},
 {...last,verdict:"unchanged"}]}),new Date("2026-11-13"));
 assert.equal(bad.verdict,"insufficient");
});
test("spoofed, future or mismatched sources are not accepted",()=>{
 const base=mk().revisions[1];
 for(const source of [
  {name:"bad",url:"javascript:alert(1)",publishedOn:"2026-11-12"},
  {name:"bad",url:"https://user:pass@example.org",publishedOn:"2026-11-12"},
  {name:"bad",url:"https://example.org",publishedOn:"2026-11-30"},
  {name:"bad",url:"https://example.org",publishedOn:"2026-11-11"}
 ]){
 const r=projectQuestionAssessment(mk({revisions:[mk().revisions[0],{...base,sources:[source]}]}),new Date("2026-11-13"));
 assert.equal(r.reviewedOn,"2026-11-11");
 }
});
test("Hormuz and AI have separate scope and immutable verdict history",()=>{
 const ids=["hormuz-peace","hormuz-shipping","ai-overall","ai-hardware","ai-cash-returns","ai-financing"];
 assert.deepEqual(QUESTION_REVIEWED_RECORDS.map(r=>r.id),ids);
 const q=getReviewedQuestions(ids,new Date("2026-11-13"));
 assert.equal(q.length,6);
 assert.equal(q[0].verdict,"deteriorating");
 assert.equal(q[2].verdict,"deteriorating");
 assert.equal(q[3].verdict,"insufficient");
 assert.equal(q[4].verdict,"mixed");
 assert.equal(getReviewedQuestion("not-a-question",new Date()),null);
});
test("cards appear on Hormuz and AI, provide source expiry and do not write canonical data",()=>{
 const read=(name:string)=>readFileSync(new URL("../"+name,import.meta.url),"utf8");
 const card=read("components/blue-desk/QuestionVerdictCard.tsx");
 const hormuz=read("components/blue-desk/HormuzSituationBrief.tsx");
 const ai=read("app/blue-desk/regime-watch/[lensId]/page.tsx");
 const records=read("lib/bluebelly-question-assessment-reviewed.ts");
 assert.match(card,/data-question-verdict/);
 assert.match(card,/data-question-history/);
 assert.match(card,/read\.sourceThrough/);
 assert.match(card,/Countercase/);
 assert.match(card,/nextTest/);
 assert.match(hormuz,/getReviewedQuestions/);
 assert.match(hormuz,/<QuestionVerdictCard key=\{item\.id\} read=\{item\} compact\/>/);
 assert.match(hormuz,/data-hormuz-question-verdicts="peace-and-shipping"/);
 assert.match(ai,/getReviewedQuestions/);
 assert.match(ai,/QuestionVerdictCard/);
 assert.doesNotMatch(card+records,/\.upsert\(|\.insert\(|CRON_SECRET/);
});
