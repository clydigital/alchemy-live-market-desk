import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const code=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("private writing workspaces consume research chart artifacts without another fetch",()=>{
 const writer=code("components/blue-desk/DailyReportWriter.tsx");
 const studio=code("components/blue-desk/DailyArticleStudio.tsx");
 assert.match(writer,/<ResearchChartPreview charts=\{research\.researchCharts\}/);
 assert.match(studio,/<ResearchChartPreview charts=\{packet\.researchCharts\}/);
 const chart=code("components/blue-desk/ResearchChartPreview.tsx");
 assert.match(chart,/encodeURIComponent\(c\.svg\)/);
 assert.match(chart,/c\.status!=="UNAVAILABLE"/);
 assert.match(chart,/c\.dataHash\.slice\(0,12\)/);
 assert.doesNotMatch(chart,/dangerouslySetInnerHTML|fetch\(/);
});
