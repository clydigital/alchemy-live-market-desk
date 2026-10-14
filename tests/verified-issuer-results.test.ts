import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { buildCandidateSnapshotFromCanonicalEvidence } from "../lib/dossier-v2/canonical-snapshot.ts";
import { assembleDossierV2InputPacket } from "../lib/dossier-v2/input-packet.ts";
import {
  handleVerifiedIssuerResults,
  validateIssuerResult,
} from "../lib/dossier-v2/verified-issuer-results.ts";

const NOW = new Date("2026-10-14T08:00:00Z");
const GOLDMAN = {
  issuer: "GS", fiscalQuarter: "2026Q3", reportDate: "2026-10-13",
  sourceUrl: "https://www.goldmansachs.com/pressroom/press-releases/2026/2026-10-13-q3-results",
  metric: "diluted_eps", value: 17.01,
};
const CITI = {
  issuer: "C", fiscalQuarter: "2026Q3", reportDate: "2026-10-13",
  sourceUrl: "https://www.citigroup.com/rcs/citigpa/storage/public/Earnings/Q32026/2026prqtr3rslt.pdf",
  metric: "net_revenue", value: 23.8,
};

test("issuer releases require exact company HTTPS ownership and bounded numeric metrics", () => {
  assert.equal(validateIssuerResult(GOLDMAN, NOW).value, 17.01);
  assert.equal(validateIssuerResult(CITI, NOW).metric, "net_revenue");
  assert.throws(() => validateIssuerResult({...GOLDMAN,sourceUrl:"https://goldmansachs.com.attacker.test/2026"},NOW), /matching/);
  assert.throws(() => validateIssuerResult({...CITI,sourceUrl:"http://www.citigroup.com/a"},NOW), /matching/);
  assert.throws(() => validateIssuerResult({...GOLDMAN,sourceUrl:CITI.sourceUrl},NOW), /matching/);
  assert.throws(() => validateIssuerResult({...GOLDMAN,value:NaN},NOW), /finite positive/);
  assert.throws(() => validateIssuerResult({...GOLDMAN,value:-1},NOW), /finite positive/);
  assert.throws(() => validateIssuerResult({...GOLDMAN,metric:"consensus_estimate"},NOW), /Unsupported issuer metric/);
  assert.throws(() => validateIssuerResult({...GOLDMAN,reportDate:"2026-10-15"},NOW), /recent, non-future/);
  assert.throws(() => validateIssuerResult({...GOLDMAN,reportDate:"2026-02-30"},NOW), /recent, non-future/);
  assert.throws(() => validateIssuerResult({...GOLDMAN,reportDate:"2026-01-13"},NOW), /recent, non-future/);
});

function request(results: unknown) {
  return new Request("https://example.org/api/admin/dossier-v2/verified-issuer-results",{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({results}),
  });
}

test("authenticated issuer batch is fully validated before writes, with exact availability", async () => {
  const seen: Array<{key:string;at:string}> = [];
  const deps = {
    authorize: async () => ({authorized:true as const,actor:"github-actions",githubRunId:"123",workflowSha:"abc"}),
    now: () => NOW,
    persist: async (item: {issuer:string;metric:string}, at:string) => {
      seen.push({key:`${item.issuer}:${item.metric}`,at});
      return {evidenceId:"ev:"+item.issuer+":"+item.metric, observationId:"obs:"+item.metric};
    },
  };
  const first = await handleVerifiedIssuerResults(request([GOLDMAN,CITI]),deps);
  assert.equal(first.status,200);
  const data = await first.json() as {availableAt:string;results:Array<{evidenceId:string}>};
  assert.equal(data.availableAt,NOW.toISOString());
  assert.deepEqual(seen,[
    {key:"GS:diluted_eps",at:NOW.toISOString()},
    {key:"C:net_revenue",at:NOW.toISOString()},
  ]);
  assert.equal(data.results.length,2);

  seen.length=0;
  const duplicate = await handleVerifiedIssuerResults(request([GOLDMAN,GOLDMAN]),deps);
  assert.equal(duplicate.status,400);
  assert.equal(seen.length,0);
  const invalid = await handleVerifiedIssuerResults(request([GOLDMAN,{...CITI,sourceUrl:"https://other.test"}]),deps);
  assert.equal(invalid.status,400);
  assert.equal(seen.length,0);
  const unauthorized = await handleVerifiedIssuerResults(request([GOLDMAN]),{
    ...deps,authorize:async()=>({authorized:false as const}),
  });
  assert.equal(unauthorized.status,401);
});

test("issuer primary facts map to protected canonical PRESS_RELEASE, not headline or Motion", () => {
  const rows = [GOLDMAN,CITI].map((item,i)=>({
    id:`issuer-row:${i}`,
    external_evidence_id:`verified-issuer:${item.issuer.toLowerCase()}:${item.fiscalQuarter.toLowerCase()}:${item.metric}`,
    claim_text:`${item.issuer} reported Q3 2026 ${item.metric} of ${item.value}`,
    evidence_class:"company_primary",
    published_at:NOW.toISOString(),
    available_at:NOW.toISOString(),
    affected_topics:["bank-earnings"],
    affected_assets:[item.issuer],
    observed_value:item.value,
    structured_payload:{evidenceNature:"verified_issuer_result",fiscalQuarter:item.fiscalQuarter,sourcePublishTime:"DAY_ONLY"},
    provenance_urls:[item.sourceUrl],
    source:{id:`source:${i}`,source_name:item.issuer,source_type:"issuer_release",
      source_url:item.sourceUrl,source_tier:1,reliability_score:95,provider_key:"verified_issuer_result"},
  }));
  const asOf="2026-10-14T08:01:00Z";
  const snapshot=buildCandidateSnapshotFromCanonicalEvidence(rows,{asOf,lookbackHours:24});
  assert.equal(snapshot.snapshot.observed_evidence?.length,2);
  assert.deepEqual(snapshot.snapshot.observed_evidence?.map(item=>item.source_type),["PRESS_RELEASE","PRESS_RELEASE"]);
  assert.ok(snapshot.snapshot.observed_evidence?.every(item=>item.canonical_record_backed===true));
  const packet=assembleDossierV2InputPacket({as_of:asOf},snapshot.snapshot);
  assert.equal(packet.observed_evidence.length,2);
  assert.equal(packet.research_leads.length,0);
});

test("workflow uses existing OIDC identity and no additional dispatch input", () => {
  const workflow=fs.readFileSync(new URL("../.github/workflows/run-live-research.yml",import.meta.url),"utf8");
  assert.match(workflow,/verified_issuer_results/);
  assert.match(workflow,/api\/admin\/dossier-v2\/verified-issuer-results/);
  assert.match(workflow,/OIDC_AUDIENCE/);
  assert.match(workflow,/VERIFIED_MACRO_SIGNALS_JSON/);
});
