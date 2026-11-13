import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {proxySignalTone,lensCardSignal} from "../lib/bluebelly-regime-lens-card-signal.ts";
import type {RegimeMeterReading} from "../lib/bluebelly-regime-market-meter.ts";
import type {RegimeDirectionId} from "../lib/bluebelly-regime-direction-reads.ts";

const read=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("rising borrowing and crude prices are red, unlike rising breadth or chip prices",()=>{
 for(const id of ["fed","bonds","energy"] as const){
  assert.equal(proxySignalTone(id,1),"pressure",id);
  assert.equal(proxySignalTone(id,-1),"improving",id);
 }
 for(const id of ["ai","breadth"] as const){
  assert.equal(proxySignalTone(id,1),"improving",id);
  assert.equal(proxySignalTone(id,-1),"pressure",id);
 }
 for(const id of ["fed","bonds","energy","ai","breadth"] as const){
  assert.equal(proxySignalTone(id,0),"mixed",id);
  assert.equal(proxySignalTone(id,null),"unknown",id);
 }
});
test("Market Compass has semantic state colour in summary rail and every asset card",()=>{
 const page=read("components/blue-desk/MarketCompass.tsx");
 const css=read("components/blue-desk/MarketCompass.module.css");
 assert.match(page,/data-compass-state=\{summary.state\}/);
 assert.match(page,/lensCardSignal\(id,readings\)/);
 assert.match(page,/data-signal-tone=\{signal.tone\}/);
 assert.match(page,/signal.scope/);
 assert.match(page,/signal.readout/);
 assert.match(page,/data-legend-tone="unknown"/);
 for(const id of ["improving","pressure","mixed","unknown"]){
  assert.ok(css.includes(`.asset[data-signal-tone="${id}"]`),id);
 }
 for(const state of ["RISK_OFF","RISK_ON","MIXED","UNMEASURED"]){
  assert.ok(css.includes(`.wrap[data-compass-state="${state}"]`),state);
 }
 assert.match(css,/\.asset\[data-status="last_reported"\]/);
 assert.match(css,/@media\(max-width:620px\)/);
 assert.doesNotMatch(page,/\.upsert\(|\.insert\(|generateText\(/);
});
test("homepage conditions carry direction-coded, text-labelled tape and source coverage",()=>{
 const page=read("components/blue-desk/MarketConditionsBoard.tsx");
 const css=read("components/blue-desk/MarketConditionsBoard.module.css");
 assert.match(page,/proxySignalTone\(signalId,needle\)/);
 for(const s of ["ai","energy","bonds","breadth"])assert.ok(page.includes(`signalId="${s}"`),s);
 assert.match(page,/data-signal-tone=\{signal\}/);
 assert.match(page,/data-signal-tone=\{tone\}/);
 assert.match(page,/metric="jobs"/);
 assert.match(page,/metric="source"/);
 assert.match(page,/NO CURRENT SIGNAL/);
 assert.match(css,/\.card\[data-signal-tone="pressure"\]/);
 assert.match(css,/\.card\[data-signal-tone="unknown"\]/);
 const board=read("components/blue-desk/DeskWhiteboard.tsx");
 const boardCss=read("components/blue-desk/DeskWhiteboard.module.css");
 assert.match(board,/data-compass-state=\{compass.state\}/);
 assert.match(board,/RISK-OFF SESSION/);
 assert.match(boardCss,/\.cell\[data-compass-state="RISK_OFF"\]/);
 assert.match(boardCss,/\.cell\[data-compass-state="UNMEASURED"\]/);
});
test("Power Stack research readiness is differentiated without claiming an actionable trigger",()=>{
 const file=read("components/blue-desk/PowerStackDecisionHub.tsx");
 const css=read("components/blue-desk/PowerStackDecisionHub.module.css");
 assert.match(file,/data-idea-tone=\{IDEA_STATUS_TONE\[idea.id\]\?\?"research"\}/);
 assert.match(file,/0 verified trade triggers/);
 assert.match(file,/"ai-cloud":"risk"/);
 assert.match(file,/"bond-swing":"pending"/);
 assert.match(file,/"tlt-duration":"research"/);
 for(const t of ["risk","pending","research"])assert.ok(css.includes(`.card[data-idea-tone="${t}"]`),t);
 assert.doesNotMatch(file,/\.insert\(|\.upsert\(|positions\.update\(/);
});
