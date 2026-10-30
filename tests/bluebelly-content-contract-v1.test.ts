import test from "node:test";
import assert from "node:assert/strict";
import {
 CONTENT_CONTRACT_VERSION,EVENT_TYPES,CONTENT_TOPICS,VERIFICATION_STATES,
 PUBLICATION_STATES,BLUEBELLY_CONTENT_JSON_SCHEMA,
 publicationTransitionAllowed,validateContentRecord,canAppearInPublicIndex,
 type BluebellyContentRecord,
} from "../lib/bluebelly-content-contract.ts";

const sourceId="official-source-20261029";
function fixture():BluebellyContentRecord{
 return {
  contractVersion:CONTENT_CONTRACT_VERSION,
  eventId:"amazon-2026q3",headline:"Amazon reports its third-quarter 2026 earnings",
  eventType:"EARNINGS",topics:["AI_TECHNOLOGY","EQUITIES"],
  entityKeys:["AMZN"],eventTime:{precision:"DATE_ONLY",eventDate:"2026-10-29"},
  verification:"ORIGINAL_VERIFIED",
  sources:[{sourceId,sourceUrl:"https://example.com/official/amazon-q3",sourceKind:"ISSUER",
   publisher:"Amazon Investor Relations",verifiedAt:"2026-10-30T01:00:00.000Z"}],
  publication:{status:"UNREGISTERED",articleId:null,revisionId:null,
   permalink:null,publishedAt:null,reviewReceiptId:null,supersedesRevisionId:null},
  consensus:"UNAVAILABLE",consensusSourceId:null,consensusAsOf:null,
  reaction:"NOT_MEASURED",marketObservationIds:[],reactionWindow:null,regimeLinks:[
   {regimeId:"us-china-ai",regimeKind:"CANONICAL",relationship:"NAVIGATION_ONLY",
    evidenceId:null,reviewReceiptId:null,thesisVersionId:null},
  ],
 };
}
const problems=(edit:(r:BluebellyContentRecord)=>void)=>{
 const r=fixture();edit(r);return validateContentRecord(r);
};
test("v1 baseline: an unregistered issuer fact validates, but is not a published article",()=>{
 const r=fixture();assert.deepEqual(validateContentRecord(r),[]);
 assert.equal(canAppearInPublicIndex(r),false);
});
test("date-only events cannot silently acquire an invented midnight timestamp",()=>{
 assert.ok(problems(r=>{r.eventTime={precision:"DATE_ONLY",eventDate:"2026-02-30"};}).includes("eventTime"));
 assert.ok(problems(r=>{r.eventTime={precision:"INSTANT",occurredAt:"2026-10-29T00:00:00+08:00"};}).includes("eventTime"));
 assert.deepEqual(problems(r=>{r.eventTime={precision:"INSTANT",occurredAt:"2026-10-29T12:30:00.000Z"};}),[]);
});
test("taxonomy rejects free-text labels, duplicate tags and OTHER plus a real topic",()=>{
 assert.ok(problems(r=>{r.eventType="earnings" as never;}).includes("eventType"));
 assert.ok(problems(r=>{r.topics=["AI_TECHNOLOGY","AI_TECHNOLOGY"];}).includes("topics"));
 assert.ok(problems(r=>{r.topics=["OTHER","EQUITIES"];}).includes("topics"));
 assert.ok(problems(r=>{r.entityKeys=["AMZN","AMZN"];}).includes("entityKeys"));
});
test("original verified requires a checked official, issuer or filing source",()=>{
 assert.ok(problems(r=>{r.sources[0].verifiedAt=null;}).includes("verification.originalSource"));
 assert.ok(problems(r=>{r.sources[0].sourceKind="CREATOR";}).includes("verification.originalSource"));
 assert.ok(problems(r=>{r.sources[0].sourceUrl="http://example.com/report";}).includes("sources"));
});
test("corroborated reporting requires distinct publishers",()=>{
 assert.ok(problems(r=>{r.verification="CORROBORATED_REPORT";}).includes("verification.corroboration"));
 const r=fixture();r.verification="CORROBORATED_REPORT";
 r.sources.push({sourceId:"source-02",sourceUrl:"https://example.net/another-report",
  sourceKind:"ATTRIBUTED_REPORTING",publisher:"Second Publisher",verifiedAt:null});
 assert.deepEqual(validateContentRecord(r),[]);
});
test("source verification, publication approval and observed reaction remain independent",()=>{
 const r=fixture();
 r.publication={status:"PUBLISHED",articleId:"article-001",revisionId:"revision-001",
  permalink:"/key-stories?postEvent=amazon-2026q3",publishedAt:"2026-10-30T01:05:00.000Z",
  reviewReceiptId:"review-001",supersedesRevisionId:null};
 assert.deepEqual(validateContentRecord(r),[]);
 assert.equal(canAppearInPublicIndex(r),true);
 assert.equal(r.consensus,"UNAVAILABLE");assert.equal(r.reaction,"NOT_MEASURED");
 assert.equal(r.regimeLinks[0].relationship,"NAVIGATION_ONLY");
});
test("a public URL requires a review receipt, revision, article ID and on-site permalink",()=>{
 assert.ok(problems(r=>{r.publication.status="PUBLISHED";}).includes("publication.receipt"));
 const r=fixture();
 r.publication={status:"PUBLISHED",articleId:"article-001",revisionId:"rev-001",
  permalink:"https://external.example.com/article",publishedAt:"2026-10-30T01:01:00.000Z",
  reviewReceiptId:"review-001",supersedesRevisionId:null};
 assert.ok(validateContentRecord(r).includes("publication.receipt"));
});
test("corrected versions preserve the superseded revision, not a silent rewrite",()=>{
 const r=fixture();r.publication={status:"CORRECTED",articleId:"article-001",
  revisionId:"rev-002",permalink:"/key-stories?brief=amazon-2026q3",
  publishedAt:"2026-10-30T05:00:00.000Z",reviewReceiptId:"review-002",
  supersedesRevisionId:null};
 assert.ok(validateContentRecord(r).includes("publication.supersedesRevisionId"));
 r.publication.supersedesRevisionId="rev-001";
 assert.deepEqual(validateContentRecord(r),[]);
});
test("approved to published is allowed; draft straight to published and retracted to published are not",()=>{
 assert.equal(publicationTransitionAllowed("APPROVED","PUBLISHED"),true);
 assert.equal(publicationTransitionAllowed("DRAFT","PUBLISHED"),false);
 assert.equal(publicationTransitionAllowed("RETRACTED","PUBLISHED"),false);
 assert.equal(publicationTransitionAllowed("PUBLISHED","CORRECTED"),true);
 assert.equal(publicationTransitionAllowed("CORRECTED","ARCHIVED"),true);
});
test("verified consensus needs a dated pre-release third-party snapshot",()=>{
 assert.ok(problems(r=>{r.consensus="SOURCE_VERIFIED";r.consensusSourceId=sourceId;
  r.consensusAsOf="2026-10-28T12:00:00.000Z";}).includes("consensus.source"));
 const r=fixture();r.consensus="SOURCE_VERIFIED";r.consensusSourceId="consensus-001";
 r.consensusAsOf="2026-10-28T12:00:00.000Z";
 r.sources.push({sourceId:"consensus-001",sourceUrl:"https://example.net/consensus/amazon",
  sourceKind:"ATTRIBUTED_REPORTING",publisher:"Publisher",verifiedAt:"2026-10-28T12:00:00.000Z"});
 assert.deepEqual(validateContentRecord(r),[]);
 r.consensusAsOf="2026-10-30T12:00:00.000Z";
 assert.ok(validateContentRecord(r).includes("consensus.source"));
});
test("price-change labels require observations; causal attribution is never inferred",()=>{
 assert.ok(problems(r=>{r.reaction="DATED_OBSERVATION_ONLY";}).includes("reaction.observations"));
 assert.ok(problems(r=>{r.reaction="EVENT_WINDOW_MEASURED";
  r.marketObservationIds=["pre-001","post-001"];}).includes("reaction.eventWindow"));
 const r=fixture();r.eventTime={precision:"INSTANT",occurredAt:"2026-10-29T20:00:00.000Z"};
 r.reaction="EVENT_WINDOW_MEASURED";r.marketObservationIds=["pre-001","post-001"];
 r.reactionWindow={startAt:"2026-10-29T19:45:00.000Z",endAt:"2026-10-29T20:15:00.000Z"};
 assert.deepEqual(validateContentRecord(r),[]);
});
test("topic matches do not create canonical regime evidence or thesis revisions",()=>{
 assert.ok(problems(r=>{r.regimeLinks[0].relationship="EVIDENCE_ACCEPTED";}).includes("regimeLinks"));
 assert.ok(problems(r=>{r.regimeLinks[0].relationship="THESIS_UPDATED";
  r.regimeLinks[0].evidenceId="evidence-001";
  r.regimeLinks[0].reviewReceiptId="review-001";}).includes("regimeLinks"));
 const r=fixture();r.regimeLinks[0].relationship="THESIS_UPDATED";
 r.regimeLinks[0].evidenceId="evidence-001";
 r.regimeLinks[0].reviewReceiptId="review-001";
 r.regimeLinks[0].thesisVersionId="version-003";
 assert.deepEqual(validateContentRecord(r),[]);
});
test("editorial lenses cannot impersonate canonical reviewed regime state",()=>{
 assert.ok(problems(r=>{r.regimeLinks[0].regimeKind="EDITORIAL_LENS";
  r.regimeLinks[0].relationship="EVIDENCE_ACCEPTED";
  r.regimeLinks[0].evidenceId="evidence-001";
  r.regimeLinks[0].reviewReceiptId="review-001";}).includes("regimeLinks"));
});
test("schema enums are derived directly from the same canonical vocabulary",()=>{
 assert.deepEqual(BLUEBELLY_CONTENT_JSON_SCHEMA.properties.eventType.enum,EVENT_TYPES);
 assert.deepEqual(BLUEBELLY_CONTENT_JSON_SCHEMA.properties.topics.items.enum,CONTENT_TOPICS);
 assert.deepEqual(BLUEBELLY_CONTENT_JSON_SCHEMA.properties.verification.enum,VERIFICATION_STATES);
 assert.deepEqual(BLUEBELLY_CONTENT_JSON_SCHEMA.properties.publication.properties.status.enum,PUBLICATION_STATES);
 const required=BLUEBELLY_CONTENT_JSON_SCHEMA.required;
 assert.ok(required.includes("consensusAsOf"));
 assert.ok(required.includes("reactionWindow"));
});
