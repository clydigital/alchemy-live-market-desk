import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("Market Consequence Standard is one existing-pipeline editorial contract, not another System 2",()=>{
 const standard=read("docs/editorial/BLUEBELLY_MARKET_CONSEQUENCE_STANDARD.md");
 for(const check of ["Event:","Economic effect:","Uncertainty:","Expectations:","Price response:"])
  assert.ok(standard.includes(check),check);
 assert.match(standard,/economic effect ≠ price reaction/i);
 assert.match(standard,/cause not established/i);
 assert.match(standard,/existing canonical Dossier\/System 2 process/i);
 assert.match(standard,/No general market verdict from a company-specific fact/);
 assert.match(standard,/Never trade detail for readability/);
});

test("private Daily/OB/COTD writing and automatic report prompts put brief before full evidence",()=>{
 const p=read("lib/blue-desk-narrative-playbook.ts");
 assert.match(p,/QUICK MARKET BRIEF of one to three plain-English sentences/);
 assert.match(p,/FULL STORY with actual-versus-expected figures/);
 assert.match(p,/EXPECTATIONS NOT VERIFIED/);
 assert.match(p,/MARKET REACTION UNMEASURED/);
 assert.match(p,/CAUSE NOT ESTABLISHED/);
 assert.match(p,/at most three initially relevant candidate explanations/);
 const report=read("lib/blue-desk-automated-report-contract.ts");
 assert.match(report,/one-to-three-sentence plain-English consequence in executiveSummary BEFORE full source-led detail/);
 assert.match(report,/priced in without actual expectation evidence/);
 assert.match(read("docs/editorial/BLUEBELLY_STORY_DRIVEN_DAILY_REPORTS.md"),/Quick Market Brief above evidence/);
});

test("public Newsroom and three Key Story examples lead with a brief and retain source detail",()=>{
 const wire=read("components/blue-desk/BluebellyNewsWire.tsx");
 assert.match(wire,/data-quick-market-brief="source-qualified-summary"/);
 assert.match(wire,/SOURCE VERIFIED · LAST 48H/);
 assert.match(wire,/original report/);
 const fed=read("components/blue-desk/KeyStoryDeepArticle.tsx");
 assert.match(fed,/QUICK MARKET BRIEF/);
 assert.match(fed,/data-quick-market-brief="source-reviewed"/);
 assert.match(fed,/depth\.numbers\.map/);
 assert.match(fed,/depth\.missing/);
 const midterms=read("components/blue-desk/MidtermRallyFeature.tsx");
 assert.match(midterms,/data-quick-market-brief="frozen-source-reviewed"/);
 assert.match(midterms,/does not guarantee a stock-market rally/);
 assert.match(midterms,/historical return figures describe specified samples/i);
 const hormuz=read("components/blue-desk/HormuzMediationFeature.tsx");
 assert.match(hormuz,/data-quick-market-brief="source-reviewed-conditional"/);
 assert.match(hormuz,/proposed reopening is not a completed agreement/);
 assert.match(hormuz,/SOURCE\.reuters/);
});
