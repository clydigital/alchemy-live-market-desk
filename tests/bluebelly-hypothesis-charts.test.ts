import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {parseHypothesisSnapshot, type RegistryRow} from "../lib/bluebelly-hypothesis-registry.ts";
import {buildHypothesisResearchCharts} from "../lib/bluebelly-research-charts.ts";
const now=new Date("2026-11-26T12:00:00Z");
const row:RegistryRow={id:"RG-FIXTURE",pageId:"aaaaaaaaaaaa4aaa8aaaaaaaaaaaaaaa",title:"Fixture",state:"ACTIVE",theme:"",currentRead:"Mixed",nextTrigger:"Check",lastChecked:null,lastEdited:null,snapshot:null};
const gem={id:"g1",label:"Fixture & report",role:"CONDITIONAL",state:"RETAINED_SOURCE_RECEIPT",sourceDate:"2026-11-20",sourceUrl:"https://example.com/report",observation:"Recorded comparison",premise:"Test only"};
const chart={id:"fixture-series",title:"Fixture comparison",unit:"bp",state:"RETAINED",basis:"Comparable saved report observations",points:[{label:"A",value:10,gemId:"g1"},{label:"B",value:20,gemId:"g1"}]};
const base={version:"evidence-gems/1",hypothesisId:row.id,reviewedOn:"2026-11-26",currentRead:"Mixed",conditional:"IF A THEN B",nextTest:"Check",gems:[gem],charts:[chart]};
test("dated research values project to existing content-addressed SVG and source table",()=>{
 const snapshot=parseHypothesisSnapshot(base,row,now)!;
 const result=buildHypothesisResearchCharts(snapshot)[0];
 assert.equal(result.kind,"RESEARCH_SNAPSHOT");
 assert.equal(result.status,"READY");
 assert.equal(result.asOf,"2026-11-20");
 assert.equal(result.marks[0].sources[0].url,gem.sourceUrl);
 assert.match(result.svg!,/Private research snapshot; not independently verified or live/);
 assert.match(result.svg!,/Fixture &amp; report/);
 assert.equal(result.dataHash,buildHypothesisResearchCharts(snapshot)[0].dataHash);
 const changed=parseHypothesisSnapshot({...base,charts:[{...chart,points:[chart.points[0],{...chart.points[1],value:25}]}]},row,now)!;
 assert.notEqual(result.dataHash,buildHypothesisResearchCharts(changed)[0].dataHash);
});
test("malformed or unqualified chart data cannot discard valid hypothesis gems or imply verification",()=>{
 for(const invalid of [
 {...chart,points:[chart.points[0],{...chart.points[1],gemId:"missing"}]},
 {...chart,points:[chart.points[0],{...chart.points[1],value:"20"}]},
 {...chart,points:[chart.points[0],{...chart.points[1],value:Infinity}]},
 {...chart,unit:"invented"},
 {...chart,unit:"%",points:[chart.points[0],{...chart.points[1],value:101}]},
 {...chart,points:[chart.points[0],chart.points[0]]}
 ]){
 const p=parseHypothesisSnapshot({...base,charts:[invalid]},row,now)!;
 assert.equal(p.gems.length,1);assert.deepEqual(p.charts,[]);assert.ok(p.chartWarnings?.length);
 }
 for(const source of [{...gem,state:"PENDING"},{...gem,state:"ATTRIBUTED"},{...gem,sourceDate:null}]){
 const p=parseHypothesisSnapshot({...base,gems:[source]},row,now)!;
 assert.equal(p.gems.length,1);assert.equal(p.charts?.length,0);
 }
 const attributed=parseHypothesisSnapshot({...base,gems:[{...gem,state:"ATTRIBUTED"}],charts:[{...chart,state:"ATTRIBUTED"}]},row,now)!;
 assert.match(buildHypothesisResearchCharts(attributed)[0].window,/ATTRIBUTED/);
 const legacy=parseHypothesisSnapshot({...base,charts:undefined},row,now)!;
 assert.equal(legacy.charts,undefined);assert.deepEqual(buildHypothesisResearchCharts(legacy),[]);
});
test("hypothesis charts stay in existing owner panel and use safe image preview",()=>{
 const panel=readFileSync(new URL("../components/blue-desk/HypothesisEvidencePanel.tsx",import.meta.url),"utf8");
 const preview=readFileSync(new URL("../components/blue-desk/ResearchChartPreview.tsx",import.meta.url),"utf8");
 assert.match(panel,/buildHypothesisResearchCharts\(row.snapshot\)/);
 assert.match(preview,/READY means chart coverage/);
 assert.doesNotMatch(preview,/dangerouslySetInnerHTML/);
});
