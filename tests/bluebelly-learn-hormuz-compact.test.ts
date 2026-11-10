import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const learn=read("app/blue-desk/learn/page.tsx");
const explorer=read("components/blue-desk/BlueDeskLearnExplorer.tsx");
const learnCss=read("app/blue-desk/learn/learn.module.css");
const hormuz=read("app/blue-desk/hormuz/page.tsx");
const brief=read("components/blue-desk/HormuzSituationBrief.tsx");
const hormuzCss=read("app/blue-desk/hormuz/hormuz.module.css");
const briefCss=read("components/blue-desk/HormuzSituationBrief.module.css");

test("Learn search and glossary are first, with all original resources behind three native disclosures",()=>{
 assert.ok(learn.indexOf('id="glossary"')<learn.indexOf('id="resources"'));
 assert.match(learn,/BlueDeskLearnExplorer concepts=\{concepts\}/);
 assert.match(learn,/LEARNING_TRACKS\.map/);
 assert.match(learn,/<details className=\{ui.sourceTrack\}/);
 assert.match(learn,/<summary className=\{ui.sourceTrackHeading\}/);
 assert.match(learn,/BLUEBELLY_LEARN_RESOURCES\.filter/);
 assert.match(learn,/resource.url/);
 assert.match(learn,/rel="noopener noreferrer"/);
 assert.doesNotMatch(learn,/<details[^>]*\sopen(?:[\s>]|=)/);
 assert.match(explorer,/useState\(12\)/);
 assert.match(explorer,/hashchange/);
 assert.match(explorer,/scrollIntoView/);
 assert.match(explorer,/setVisibleCount\(Math.max\(12,position\+1\)\)/);
});
test("Learn compacts search and fixes mobile result-to-detail flow while retaining the thematic palette",()=>{
 assert.match(learnCss,/\.sourceTrack\[open\]>/);
 assert.match(learnCss,/\.sourceTrack summary:focus-visible/);
 assert.match(learnCss,/\.glossarySection\{margin-top:15px/);
 assert.match(learnCss,/\.indexPane\{order:0\}/);
 assert.match(learnCss,/\.focusPane\{order:1;position:static\}/);
 assert.match(learnCss,/\.hero h1\{font-size:clamp\(30px/);
 assert.doesNotMatch(learnCss,/#ffdb23|#49e2d0|#3da8ff|#b9e9aa/);
});

test("Hormuz prioritises diplomacy, shipping and crude/diesel over chronological incident walls",()=>{
 assert.match(hormuz,/HormuzSituationBrief newsroomHref=/);
 assert.ok(hormuz.indexOf('<HormuzSituationBrief')<hormuz.indexOf('id="shipping"'));
 assert.ok(hormuz.indexOf('id="shipping"')<hormuz.indexOf('id="fuels"'));
 assert.ok(hormuz.indexOf('id="fuels"')<hormuz.indexOf('id="incidents"'));
 for(const id of ["incidents","inventory","decisions","coverage"]){
  assert.match(hormuz,new RegExp('id="'+id+'"'));
  assert.match(hormuz,new RegExp('<details className=\\{\\x60\\$\\{s.section\\} \\$\\{s.evidenceShelf\\}\\x60\\} id="'+id+'"'));
 }
 assert.match(hormuz,/HormuzCrossings monitor=\{watch.crossing\}/);
 assert.match(hormuz,/products\.slice\(0,1\)\.map\(reading\)/);
 assert.match(hormuz,/products\.slice\(1\)\.map\(reading\)/);
 assert.match(hormuz,/balance\.map\(reading\)/);
 assert.match(hormuz,/incidents\.reports\.slice\(0,6\)/);
 assert.match(hormuz,/watch\.missingIds\.map/);
 assert.match(hormuz,/getGlobalFlowMonitor/);
 assert.match(hormuz,/getHormuzIncidents/);
 assert.doesNotMatch(hormuz,/<details[^>]*\sopen(?:[\s>]|=)/);
});
test("Hormuz keeps X Wire and creator evidence available but outside the two primary quick-read cards",()=>{
 assert.match(brief,/data-hormuz-situation="source-dated-quick-read"/);
 assert.match(brief,/Negotiations & conflict/);
 assert.match(brief,/What is moving\?/);
 assert.match(brief,/<details className=\{s.wireDisclosure\}/);
 assert.match(brief,/TopicInfluencePanel input=\{wire\} compact/);
 assert.match(brief,/Unverified public posts/);
 assert.match(brief,/Source-verified reporting/);
 assert.match(brief,/newsCoverageDegraded/);
 assert.match(brief,/Vessel crossings are not verified barrels/);
 assert.match(briefCss,/\.columns\{grid-template-columns:repeat\(2/);
 assert.match(briefCss,/\.wireDisclosure>summary:focus-visible/);
 assert.match(hormuzCss,/\.evidenceSummary:focus-visible/);
 assert.match(hormuzCss,/\.riskDetail summary:focus-visible/);
 assert.match(hormuzCss,/\.evidenceShelf\{/);
});
