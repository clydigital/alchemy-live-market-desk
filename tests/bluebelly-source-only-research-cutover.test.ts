import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  SOURCE_ONLY_RESEARCH_MARKER,
  scheduledSourceOnlyEnabled,
  sourceOnlyCompletionDecision,
} from "../lib/bluebelly-source-only-research.ts";

const read=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("new scheduled acquisition runs source-only by default with an explicit rollback",()=>{
  assert.equal(scheduledSourceOnlyEnabled({}),true);
  assert.equal(scheduledSourceOnlyEnabled({BLUEBELLY_SOURCE_ONLY_RESEARCH_DISABLED:"false"}),true);
  assert.equal(scheduledSourceOnlyEnabled({BLUEBELLY_SOURCE_ONLY_RESEARCH_DISABLED:"true"}),false);
  const wrapper=read("lib/cron-research-acquisition-handler.ts");
  assert.match(wrapper,/scheduledSourceOnlyEnabled\(process\.env\)/);
  assert.match(wrapper,/headers\.set\("x-alchemy-source-only", "1"\)/);
  assert.match(wrapper,/headers\.set\("x-alchemy-defer-intelligence", "1"\)/);
  assert.match(wrapper,/else \{\s*headers\.set\("x-alchemy-defer-intelligence"/);
});

test("source-only completion is evidence-led and never equates a check with verified claims",()=>{
  assert.equal(SOURCE_ONLY_RESEARCH_MARKER,"BLUEBELLY_SOURCE_ONLY_V1");
  assert.deepEqual(sourceOnlyCompletionDecision({accuracyGate:"open",sourceChecks:[{source:"official",itemCount:0}]}),{
    status:"completed",sourceChecksPresent:true,
    warning:"SOURCE_ONLY_ACQUISITION_COMPLETE: dated source receipts persisted; no automatic intelligence, Story publication or Daily Intelligence edition requested.",
  });
  assert.equal(sourceOnlyCompletionDecision({accuracyGate:"review",sourceChecks:[1]}).status,"completed");
  assert.equal(sourceOnlyCompletionDecision({accuracyGate:"blocked",sourceChecks:[1]}).status,"blocked");
  assert.equal(sourceOnlyCompletionDecision({accuracyGate:"open",sourceChecks:[]}).status,"blocked");
  assert.equal(sourceOnlyCompletionDecision({accuracyGate:"open",sourceChecks:null}).status,"blocked");
});

test("authenticated scheduled publisher completes only AFTER original intake and Market Motion persist",()=>{
  const publisher=read("app/api/research-update/route.ts");
  assert.match(publisher,/scheduledSourceOnly = isScheduledInternalRequest/);
  assert.match(publisher,/acceptsResearchAuthorization\(request\.headers\.get\("authorization"\), \[cronSecret\]\)/);
  assert.match(publisher,/const deferScheduledIntelligence = !scheduledSourceOnly/);
  assert.match(publisher,/intelligenceEnabled \|\| scheduledSourceOnly/);
  const intake=publisher.indexOf("await persistResearchIntakeBatches(");
  const motion=publisher.indexOf("await persistMarketMotionFromResearchRun(");
  const terminal=publisher.indexOf("if (scheduledSourceOnly) {");
  const writer=publisher.indexOf("await runIntelligenceEngine(");
  assert.ok(intake>0&&intake<motion&&motion<terminal&&terminal<writer);
  const portion=publisher.slice(terminal,writer);
  assert.match(portion,/SOURCE_ONLY_RESEARCH_MARKER/);
  assert.match(portion,/sourceOnlyCompletionDecision/);
  assert.match(portion,/status=eq\.running/);
  assert.match(portion,/Prefer: "return=representation"/);
  assert.match(portion,/sourceOnlyCompletionDecision/);
  assert.match(portion,/updates_published: 0/);
  assert.match(portion,/mode: "SOURCE_ONLY"/);
  assert.doesNotMatch(portion,/persistCanonicalJourneyEditionForResearchRun\(/);
  assert.doesNotMatch(portion,/runIntelligenceEngine\(/);
  assert.doesNotMatch(portion,/story_updates|recalibration|createSupabaseAdminClient/);
});

test("database triggers never backfill legacy Story or daily_brief for the source-only marker",()=>{
  const sql=read("supabase/migrations/20261107080500_bluebelly_source_only_publication_fence.sql");
  assert.match(sql,/create or replace function public\.sync_research_slot_run\(\)/i);
  assert.match(sql,/create or replace function public\.publish_hybrid_snapshots_for_run\(\)/i);
  assert.match(sql,/array_position\(new\.warnings,'BLUEBELLY_SOURCE_ONLY_V1'\)/);
  assert.match(sql,/if array_position\(new\.warnings,'BLUEBELLY_SOURCE_ONLY_V1'\) is not null then return new;/);
  assert.match(sql,/case when source_only then 'not_required'/);
  assert.match(sql,/'source_only',source_only/);
  assert.match(sql,/when new\.status = 'completed' then 'complete'/);
  assert.match(sql,/legacy/i);
  assert.doesNotMatch(sql,/drop table|truncate table|delete from public|create policy|grant .* to anon/i);
  const file=read("lib/research-gap-cron.ts");
  assert.match(file,/\.in\("slot_key", \["morning", "evening"\]\)/);
  assert.match(file,/if \(row\.completed_at\) return false/);
  assert.match(file,/\["scheduled", "running", "partial"\]/);
});

test("source-only phase neither alters the existing cron schedule nor opens private data routes",()=>{
  const manifest=JSON.parse(read("vercel.json")) as {crons:Array<{path:string;schedule:string}>};
  assert.equal(manifest.crons.filter(x=>x.path.endsWith("/morning")).length,1);
  assert.equal(manifest.crons.filter(x=>x.path.endsWith("/evening")).length,1);
  assert.equal(manifest.crons.filter(x=>x.path.includes("intelligence")).length,16);
  const routing=read("lib/blue-desk-host.ts");
  assert.match(routing,/blueDeskHostAccess/);
  const human=read("app/my-reports/page.tsx");
  assert.doesNotMatch(human,/runIntelligenceEngine|generateContent|runAutomatedDailyPdfReport/);
});
