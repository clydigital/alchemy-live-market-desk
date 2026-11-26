import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const page=readFileSync(new URL("../app/market-tools/page.tsx",import.meta.url),"utf8");
test("private tools default to sources, retaining legacy manual query entry points",()=>{
  assert.match(page,/options\?\.check==="providers"\?"diagnostics"/);
  assert.match(page,/typeof options\?\.technical==="string"\?"technical"/);
  assert.match(page,/options\?\.view==="diagnostics"\?"diagnostics":"sources"/);
  assert.match(page,/id="ema-sd-levels"/);
  assert.match(page,/href="\/market-tools\?check=providers"/);
});
test("owner checks precede private reads and provider tests remain opt-in",()=>{
  const gate=page.indexOf("if(!access.ok)return");
  assert.ok(gate>0);
  for(const expression of ["await readTechnicalSnapshot(ticker)","getMarketData().catch","getMarketMonitor().catch","getMarketToolsProviderReadiness().catch","loadExtras().catch"]){
    assert.ok(page.indexOf(expression)>gate,expression);
  }
  assert.match(page,/checkProviders=access.ok&&diagnosticsView&&options\?\.check==="providers"/);
  assert.match(page,/relationshipView \? getMarketData/);
  assert.match(page,/relationshipView\|\|intakeView \? getMarketMonitor/);
  assert.match(page,/relationshipView \? loadExtras/);
  assert.match(page,/view==="technical"&&options.technical\?await readTechnicalSnapshot/);
});
test("focused views link canonical pages without a fabricated idea count",()=>{
  for(const link of ["/markets?mode=risk","/markets?mode=compare","/markets?mode=watch","/owner/research","/my-reports"]){
    assert.ok(page.includes('href="'+link+'"'),link);
  }
  assert.doesNotMatch(page,/No verified ideas yet|<strong>0<\/strong><span>Verified trade signals/);
  assert.match(page,/intakeView\?<ResearchTriggerIntake monitor=\{monitor\}/);
  assert.match(page,/relationshipView \? buildMarketToolsCorrelations/);
});
