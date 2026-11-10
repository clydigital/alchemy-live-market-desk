import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const page=read("app/blue-desk/regime-watch/page.tsx");
const css=read("app/blue-desk/regime-watch/regime-watch.module.css");
const meter=read("components/blue-desk/RegimeOutlookMeter.tsx");
const meterCss=read("components/blue-desk/RegimeOutlookMeter.module.css");

test("the nine differentiated outlooks are the first content after the introduction",()=>{
 const lens=page.indexOf('id="lens-grid"');
 assert.ok(lens>0);
 for(const id of ['id="source-reasons"','id="cross-regime-watch"','id="view-changes"','id="deep-research"']){
  assert.ok(page.indexOf(id)>lens,id);
 }
 assert.ok(page.indexOf('id="source-reasons"')<page.indexOf('id="cross-regime-watch"'));
 assert.match(page,/data-research-lens=\{lens.id\}/);
 assert.match(page,/RegimeOutlookMeter assessment=\{getLensOutlook\(lens.id\)\} size="summary"/);
 assert.match(page,/getLensOutlook\(lens.id\).headline/);
 assert.doesNotMatch(page,/CurrentMarketUpdates/);
 assert.doesNotMatch(page,/\<p\>\{lens.question\}\<\/p\>/);
});

test("source detail, review queue and older issuer files use keyboard-native progressive disclosure",()=>{
 assert.match(page,/data-regime-pulse-preview="three-sourced-highlights"/);
 assert.match(page,/\.slice\(0,3\)\.map\(item=>/);
 assert.match(page,/data-regime-pulse-all="progressive-disclosure"/);
 assert.match(page,/<details className=\{styles.pulseAll\}/);
 assert.match(page,/<details id="view-changes"/);
 assert.match(page,/<details id="deep-research"/);
 assert.match(page,/data-regime-deeper-files="collapsed-by-default"/);
 assert.match(page,/data-regime-view-scan="stored-stories-and-admitted-original-sources"/);
 assert.match(page,/data-regime-source-reasons="live-source-linked-not-canonical"/);
 assert.match(page,/data-crash-watch-entry="own-research-watch"/);
 for(const fragment of ["coreweave-ai-financing","tesla-spacex-financing",'id="transmission"',"getManualSweeps","getTopicInfluences"]){
  assert.ok(page.includes(fragment),fragment);
 }
 // No static open attribute: users can reveal details on demand.
 assert.doesNotMatch(page,/<details[^>]+\sopen(?:[\s>]|=)/);
});
test("compact meter retains scoped directional target, confidence and explicit dated detail route",()=>{
 assert.match(meter,/size\?:"compact"\|"full"\|"summary"/);
 assert.match(meter,/if\(size==="summary"\)/);
 assert.match(meter,/data-outlook-meter=\{assessment.lens\}/);
 assert.match(meter,/data-confidence=\{assessment.confidence\}/);
 assert.match(meter,/assessment.directionTarget/);
 assert.match(meter,/Outlook for/);
 assert.match(meter,/Fundamental outlook/);
 assert.match(meter,/Confidence/);
 assert.match(meterCss,/\.summaryTarget\{/);
 assert.match(page,/blueDeskPublicHref\("\/blue-desk\/regime-watch\/"\+lens.id,host\)/);
 assert.match(page,/LENS_OUTLOOK_REVIEWED_ON/);
});
test("theme-aware desktop and mobile density never changes the global palette",()=>{
 for(const s of [css,meterCss]){
  for(const token of ["var(--bb-text)","var(--bb-card-border)"])assert.ok(s.includes(token));
  assert.doesNotMatch(s,/#ffdb23|#49e2d0|#3da8ff|#b9e9aa/);
 }
 assert.match(css,/\.cards\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\);gap:9px\}/);
 assert.match(css,/@media\(max-width:600px\)/);
 assert.match(css,/\.cards\{grid-template-columns:1fr;gap:6px\}/);
 assert.match(css,/\.card \.art\{display:none\}/);
 assert.match(css,/\.pulseAll>summary/);
 assert.match(css,/\.deepShelf>summary/);
});
