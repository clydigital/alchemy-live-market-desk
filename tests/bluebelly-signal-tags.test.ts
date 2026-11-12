import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {SIGNAL_TAGS,suggestSignalTags} from "../lib/bluebelly-signal-tags.ts";
import {buildSignalRadar} from "../lib/bluebelly-signal-radar.ts";
import type {TopicInfluenceRead} from "../lib/bluebelly-topic-influence.ts";
const read=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const ids=(input:Parameters<typeof suggestSignalTags>[0])=>suggestSignalTags(input).map(t=>t.id);

test("six finite, question-first signal categories have an explicit comparison meaning",()=>{
 assert.deepEqual(SIGNAL_TAGS.map(x=>x.id),["divergence","mispricing","catalyst","regime","supply","counter"]);
 assert.ok(SIGNAL_TAGS.every(tag=>tag.question.endsWith("?")));
});
test("divergence can be proposed from a concrete disagreement, but never becomes proven mispricing",()=>{
 const t=ids({title:"Cloud revenue rises while interest costs and losses climb",
  detail:"Revenue grew but debt financing remained elevated.",evidence:"AUTOMATED_LEAD"});
 assert.ok(t.includes("divergence"));
 assert.ok(t.includes("regime"));
 assert.ok(!t.includes("mispricing"));
 const cheap=ids({title:"Stocks fell 70%, likely undervalued, buy the dip",
  detail:"A creator claims market price is disconnected from value",evidence:"AUTOMATED_LEAD"});
 assert.ok(!cheap.includes("mispricing"));
});
test("mispricing candidate demands independent price and fundamentals receipts plus qualified review",()=>{
 const base={title:"A valuation disconnect to investigate",detail:"Shares priced below fundamental valuation",
  reviewedValuation:{marketPrice:17,priceObservedOn:"2026-11-12",priceSourceUrl:"https://exchange.example/close",
    fundamentalValue:28,fundamentalBasis:"Issuer cash flow per share comparison",
    fundamentalSourceUrl:"https://issuer.example/reports/q3",
    comparisonExplanation:"Market quote and verified per-share operating cash flow differ on a comparable valuation basis."}};
 assert.ok(!ids({...base,evidence:"SOURCE_ONLY_NEWS"}).includes("mispricing"));
 assert.ok(ids({...base,evidence:"SOURCE_CORROBORATED"}).includes("mispricing"));
 assert.ok(!ids({...base,evidence:"SOURCE_CORROBORATED",reviewedValuation:{...base.reviewedValuation,priceSourceUrl:"javascript:alert(1)"}}).includes("mispricing"));
 assert.ok(!ids({...base,evidence:"SOURCE_CORROBORATED",reviewedValuation:{...base.reviewedValuation,fundamentalBasis:""}}).includes("mispricing"));
});
test("single context-free market headline never proves a divergence or mispricing",()=>{
 assert.deepEqual(ids({title:"AI stock moves higher",detail:"A stock rose on a busy session.",evidence:"SOURCE_ONLY_NEWS"}),[]);
 const tags=ids({title:"Upcoming Federal Reserve rate decision",
  detail:"The FOMC meets with inflation pressure still elevated.",evidence:"SOURCE_ONLY_NEWS"});
 assert.ok(tags.includes("catalyst"));
 assert.ok(!tags.includes("mispricing"));
});
test("Regime signal radar recycles source-qualified manual notes and unverified leads, no writers",()=>{
 const now=new Date("2026-11-13T01:00:00Z");
 const feed:TopicInfluenceRead={topic:"ai",checkedAt:now.toISOString(),xState:"AVAILABLE",creatorState:"EMPTY",
 x:[{id:"x:source",source:"X",sourceName:"Tracked creator",url:"https://x.com/example/status/1234567890",
 title:"AI revenue grows but funding costs rise",excerpt:"Revenue rose while data-centre financing becomes more costly",
 reason:"Is AI cash conversion getting worse?",publishedAt:"2026-11-12T22:00:00Z",reviewedAt:null,
 nextCheck:"Check cash flow and matched bond yield data.",verification:"UNVERIFIED_LEAD"}],
 creators:[]};
 const radar=buildSignalRadar([feed],now,12);
 assert.ok(radar.some(item=>item.verification==="AUTOMATED LEAD"));
 assert.ok(radar.some(item=>item.verification==="SOURCE-CORROBORATED EVENT"));
 assert.ok(radar.every(item=>item.tags.length>0&&item.tags.length<=3));
 assert.ok(radar.every(item=>!item.tags.some(tag=>tag.id==="mispricing")));
 assert.ok(radar.every(item=>item.href.includes("#influence-")));
});
test("Newsroom and Regime and source panels actually render tags and working filters",()=>{
 const hub=read("app/blue-desk/regime-watch/page.tsx");
 const panel=read("components/blue-desk/TopicInfluencePanel.tsx");
 const room=read("app/blue-desk/newsroom/page.tsx");
 const wire=read("components/blue-desk/BluebellyNewsWire.tsx");
 const radar=read("components/blue-desk/RegimeSignalRadar.tsx");
 assert.match(hub,/<RegimeSignalRadar entries=\{signalRadar\}\/>/);
 assert.match(hub,/buildSignalRadar\(topicReasons,now,12\)/);
 assert.match(panel,/SignalTags tags=\{suggestSignalTags/);
 assert.match(room,/SignalTags tags=\{suggestSignalTags/);
 assert.match(wire,/SignalTags tags=\{suggestSignalTags/);
 assert.match(radar,/aria-pressed=\{tag===t.id\}/);
 assert.match(radar,/data-signal-radar/);
 assert.doesNotMatch(hub+radar+panel+room,/\.upsert\(|\.insert\(|supabase\.rpc\(/);
});
