import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {projectArticleCloseScenarios,projectCreatorPerspectives} from "../lib/bluebelly-article-perspectives.ts";
import type {EditorialPriceCard} from "../lib/editorial-price-context.ts";
const read=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const now="2026-10-25T03:00:00Z";
function card(id:string,type="Indices",status:EditorialPriceCard["status"]="OBSERVED"):EditorialPriceCard{
 return {id,label:"Example "+id,symbol:id.toUpperCase(),type,
  source:"One daily original feed",sourceUrl:"https://example.com/series",lastDate:"2026-10-23",
  lastClose:110,levelUnit:type==="Rates"?"%":"source units",status,
  caution:"Only completed source observations",
  comparisons:[
   {sessions:1,label:"1 session",referenceDate:"2026-10-22",reference:100,
    change:type==="Rates"?1000:10,percent:type==="Rates"?null:10,unit:type==="Rates"?"bp":"%",reason:null},
   {sessions:3,label:"3 sessions",referenceDate:"2026-10-20",reference:105,
    change:type==="Rates"?500:5,percent:type==="Rates"?null:4.76,unit:type==="Rates"?"bp":"%",reason:null},
   {sessions:5,label:"5 sessions",referenceDate:"2026-10-16",reference:108,
    change:type==="Rates"?200:2,percent:type==="Rates"?null:1.85,unit:type==="Rates"?"bp":"%",reason:null},
  ]};
}
test("energy topic selects related source-dated closes without inventing EMA or 4H measurements",()=>{
 const out=projectArticleCloseScenarios("Brent oil Hormuz",[
  card("spx"),card("brent"),card("wti"),card("smh")]);
 assert.deepEqual(out.map(x=>x.id),["brent","wti","spx"]);
 assert.equal(out[0].asOf,"2026-10-23");
 assert.equal(out[0].previousDate,"2026-10-22");
 assert.equal(out[0].oneSessionChange,10);
 assert.equal(out[0].threeSessionChange,4.76);
 assert.match(out[0].conditions,/Check the daily EMA20\/EMA50 bands/);
 assert.doesNotMatch(out[0].conditions,/broke|confirmed EMA|crossed EMA/);
});
test("missing previous sessions and stale observation cannot become confirmed chart stance",()=>{
 const row=card("us10y-fred","Rates","STALE");row.comparisons=[];
 const out=projectArticleCloseScenarios("Bond yields Treasury",[row]);
 assert.equal(out.length,1);
 assert.equal(out[0].oneSessionChange,null);
 assert.equal(out[0].oneSessionUnit,"bp");
 assert.match(out[0].conditions,/No fresh completed daily comparison/);
});
function video(publisher:string,url="https://www.youtube.com/watch?v=QOsuKK8dsic"){
 return {publisher,url,title:"Semiconductor stocks, AI capex and Treasury yields",
  published_at:"2026-10-24T01:30:07Z",transcript_status:"ready",
  video_analysis_status:"not_attempted",creator_logic:"Unverified creator argument",
  recontextualized_summary:"Creator argues the AI and chip trade may face earnings and funding pressure, although the alternative is resilient demand."};
}
test("only recent ready transcript perspectives from allowed creators with safe original YouTube links",()=>{
 const items=[
  video("StockedUp"),
  video("FX Evolution","https://www.youtube.com/watch?v=EXAMPLE2"),
  video("Lucid Trading","https://www.youtube.com/watch?v=EXAMPLE3"),
  {...video("TraderNick","https://www.youtube.com/watch?v=EXAMPLE4"),video_analysis_status:"failed"},
  {...video("Traders Reality","https://www.youtube.com/watch?v=EXAMPLE5"),published_at:"2026-09-30T12:00:00Z"},
  video("Wall Street Truthbombs","https://youtube.com/watch?v=EXAMPLE6"),
  video("StockedUp","https://youtube.com/watch?v=EXAMPLE7"),
  video("StockedUp","https://evil.example/video"),
 ];
 const out=projectCreatorPerspectives("AI semiconductors",[...items],now);
 assert.deepEqual(out.map(x=>x.publisher),["StockedUp","FX Evolution","Wall Street Truthbombs"]);
 assert.ok(out.every(x=>x.url.startsWith("https://")));
 assert.ok(out.every(x=>x.view.includes("Creator argues")));
});
test("creator views never appear for unrelated themes or missing summaries",()=>{
 assert.deepEqual(projectCreatorPerspectives("Japan BOJ inflation",[
   video("StockedUp"),{...video("TraderNick"),recontextualized_summary:null},
 ],now),[]);
});
test("Bluebelly pages use native nav and archive vs close/creator data remains visibly separate",()=>{
 const nav=read("components/blue-desk/BlueDeskHeader.tsx");
 const home=read("app/blue-desk/page.tsx");
 const presenter=read("app/blue-desk/presenter/page.tsx");
 const historical=read("app/blue-desk/presenter/full-prep/page.tsx");
 const article=read("app/blue-desk/stories/[articleId]/page.tsx");
 const workbench=read("components/blue-desk/EditorialWorkbench.tsx");
 const privateNav=nav.split("const PRIVATE_NAV = [")[1]?.split("] as const")[0]||"";
 for(const old of ["/owner/editorial","/owner/presenter","/hybrid-output/prepare","/owner/x-wire","/articles","/whats-new","/data/macro"]){
   assert.ok(!privateNav.includes(old),old);
 }
 assert.doesNotMatch(home,/href="\/(dossier|regimes|hybrid-output\/prepare|whats-new|articles|presenter\/technical-checks)"/);
 assert.match(home,/Continue in Bluebelly/);
 assert.match(presenter,/redirect\("\/blue-desk\/presenter\/full-prep\?"/);
 assert.doesNotMatch(historical,/href="\/presenter"/);
 assert.match(workbench,/mode==="presenter" \? <>/);
 assert.match(article,/getArticleCreatorPerspectives/);
 assert.match(article,/projectArticleCloseScenarios/);
 assert.match(article,/not.*retroactive evidence/);
 assert.match(article,/No sufficiently attributed, transcript-ready creator view/);
 assert.doesNotMatch(article,/ChartWidget|<Chart|TradingView/);
});
