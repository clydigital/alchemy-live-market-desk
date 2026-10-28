import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {buildPresenterCalendar} from "../lib/presenter-calendar.ts";
import {decisionTopics} from "../lib/bluebelly-decision-brief.ts";
import {buildPresenterOneMinute} from "../lib/bluebelly-presenter-one-minute.ts";
import type {PresenterCalendarEvent} from "../lib/presenter-calendar.ts";

const code=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const now=new Date("2026-10-28T16:00:00.000Z");
const empty=buildPresenterCalendar([],{events:[],coverage:"unavailable",warning:"No provider"},now);
const make=(id:string,title:string,when:string,kind:"economic"|"earnings",assets:string[]):PresenterCalendarEvent=>({
 id,kind,title,status:"scheduled",localDate:"2026-10-29",scheduledAt:when,
 timeLabel:"official ET source time",timePrecision:"exact",
 actual:null,consensus:null,previous:null,revisedPrevious:null,releasedAt:null,
 sourceName:"Original issuer / central bank",sourceUrl:"https://www.federalreserve.gov/newsevents/pressreleases/monetary20260916a.htm",
 sourceRecordRefs:[id],verificationState:"official",affectedAssets:assets,
 decidingQuestion:"Will the official statement change rate expectations?"
});
const fed=make("macro:us-fomc-2026-10-28","FOMC rate decision","2026-10-28T18:00:00Z","economic",["USD","US02Y","SPX","GOLD"]);
const google=make("earnings:google","Alphabet Q3 earnings","2026-10-28T20:30:00Z","earnings",["GOOGL"]);
test("nearest FOMC is editorially ranked above alphabetically first Alphabet earnings",()=>{
 const calendar={...empty,events:[google,fed]};
 const topics=decisionTopics([],calendar,now);
 assert.equal(topics[0]?.id,fed.id);
 assert.equal(topics[1]?.id,google.id);
 const summary=buildPresenterOneMinute([],calendar,now);
 assert.equal(summary.eventTitle,"FOMC rate decision");
 assert.match(summary.opening,/FOMC rate decision/);
 assert.match(summary.opening,/outcome has not been verified/);
 assert.match(summary.time,/Wed, 28 Oct 2026, 14:00 EDT/);
 assert.deepEqual(summary.watch,["USD","US02Y","SPX","GOLD"]);
 assert.match(summary.stop,/Do not call the outcome, consensus surprise or asset reaction confirmed/);
 assert.doesNotMatch(summary.opening,/Fed (held|hiked|cut) today/i);
});
test("no qualifying event does not invent price levels or assert a market reaction",()=>{
 const summary=buildPresenterOneMinute([],empty,now);
 assert.equal(summary.state,"SOURCE COVERAGE GAP");
 assert.equal(summary.eventTitle,null);
 assert.deepEqual(summary.watch,[]);
 assert.match(summary.script,/No current source-qualified lead/);
});
test("copyable presenter card and source-backed comparison SVG are public read-only",()=>{
 const brief=code("components/blue-desk/DecisionBrief.tsx");
 const ui=code("components/blue-desk/PresenterOneMinute.tsx");
 const graphic=code("components/blue-desk/EarningsEvidenceGraphic.tsx");
 assert.match(brief,/<PresenterOneMinute brief=\{onAir\}/);
 assert.match(ui,/navigator.clipboard.writeText/);
 assert.match(ui,/role="status"/);
 assert.match(ui,/Open source-dated markets/);
 assert.match(code("lib/bluebelly-presenter-one-minute.ts"),/My next test:/);
 assert.match(graphic,/79\.3187/);
 assert.match(graphic,/104\.6155/);
 assert.match(graphic,/60\.5426/);
 assert.match(graphic,/83\.3338/);
 assert.match(graphic,/not a verified forecast or share-price reaction/);
 assert.match(brief,/<EarningsEvidenceGraphic scorecard=\{r\}/);
 assert.doesNotMatch(ui,/createSupabaseAdminClient|fetch\(|service_role|story_thesis_versions/);
});
