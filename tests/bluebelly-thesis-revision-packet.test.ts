import test from "node:test";
import assert from "node:assert/strict";
import {parseThesisRevisionPacket,parseThesisPacketHtml,groupThesisPacketReceipts,THESIS_PACKET_VERSION} from "../lib/bluebelly-thesis-revision-packet.ts";
const now=new Date("2026-11-27T09:00:00Z"),when="2026-11-27T08:00:00Z";
const packet={version:THESIS_PACKET_VERSION,producer:"manual",visibility:"PRIVATE_ONLY",hypothesisId:"RG-AI-FINANCING",eventKey:"funding-2026-11-27",reviewedAt:when,sourceThrough:"2026-11-27",marketSession:"2026-11-25",priorThesis:"Prior cash conversion thesis",currentCondition:"Financing remains selective",mechanism:"Higher costs affect net cash",countercase:"Secured finance remains accessible",nextTest:"Check actual funding draw",horizon:"Next financing cycle",assessment:"MIXED",coverage:"PARTIAL",materiality:"HIGH",lenses:["ai","bonds"],references:[{kind:"ORIGINAL_LINK",id:null,lane:null,url:"https://example.com/a",sourceAt:"2026-11-27",role:"SUPPORT",claim:"Prior source-linked observation",qualification:"RETAINED_REVIEW"},{kind:"ORIGINAL_LINK",id:null,lane:null,url:"https://example.com/b",sourceAt:"2026-11-26",role:"CHALLENGE",claim:"Countercase linked observation",qualification:"RETAINED_REVIEW"}]};
test("valid private review packet; dates and countercase are mandatory",()=>{
 assert.ok(parseThesisRevisionPacket(packet,now));
 assert.equal(parseThesisRevisionPacket({...packet,visibility:"PUBLIC"},now),null);
 assert.equal(parseThesisRevisionPacket({...packet,sourceThrough:"2026-11-28"},now),null);
 assert.equal(parseThesisRevisionPacket({...packet,references:[packet.references[0]]},now),null);
 assert.equal(parseThesisRevisionPacket({...packet,references:[packet.references[0],packet.references[0]]},now),null);
});
test("HTML carries one inert escaped structured packet",()=>{
 const body=JSON.stringify({...packet,mechanism:"Cash costs > net income & financing"}).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
 const html='<pre id="bb-thesis-revision-v1">'+body+'</pre>';
 assert.equal(parseThesisPacketHtml(html,now)?.mechanism,"Cash costs > net income & financing");
 assert.equal(parseThesisPacketHtml(html+html,now),null);
});
test("same hypothesis/event grouped; conflicting versions never public",()=>{
 const p=parseThesisRevisionPacket(packet,now)!;
 const groups=groupThesisPacketReceipts([{editionId:"a",storedAt:when,packet:p,referenceStates:[]},{editionId:"b",storedAt:when,packet:{...p,assessment:"CHALLENGED",reviewedAt:"2026-11-27T08:30:00Z"},referenceStates:[]}]);
 assert.equal(groups.length,1);assert.equal(groups[0].conflicting,true);assert.equal(groups[0].latest.editionId,"b");assert.equal(groups[0].publicReadback,"NOT_ADMITTED");
});
