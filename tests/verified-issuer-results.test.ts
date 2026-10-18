import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { buildCandidateSnapshotFromCanonicalEvidence } from "../lib/dossier-v2/canonical-snapshot.ts";
import { assembleDossierV2InputPacket } from "../lib/dossier-v2/input-packet.ts";
import {
  handleVerifiedIssuerResults,
  issuerResultIdentity,
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

const TSMC_REVENUE = {
  issuer: "TSM", fiscalQuarter: "2026Q3", reportDate: "2026-10-15",
  sourceUrl: "https://pr.tsmc.com/english/news/3346",
  metric: "net_revenue", value: 46.72,
};
const TSMC_MARGIN = { ...TSMC_REVENUE, metric: "operating_margin_pct", value: 58.7 };
const COREWEAVE_CFO = {
  issuer: "CRWV", fiscalQuarter: "2026Q2", reportDate: "2026-08-11",
  sourceUrl: "https://investors.coreweave.com/news/news-details/2026/CoreWeave-Reports-Strong-Second-Quarter-2026-Results/default.aspx",
  metric: "operating_cash_flow", value: 0.679,
};
const COREWEAVE_PP_AND_E = { ...COREWEAVE_CFO, metric: "cash_ppe", value: 6.422 };

test("TSMC and CoreWeave original-source issuer metrics are whitelisted with exact units and safe scope", () => {
  const at = new Date("2026-10-18T00:00:00Z");
  assert.equal(validateIssuerResult(TSMC_REVENUE, at).value, 46.72);
  assert.equal(validateIssuerResult(TSMC_MARGIN, at).value, 58.7);
  assert.equal(validateIssuerResult(COREWEAVE_CFO, at).value, 0.679);
  assert.equal(validateIssuerResult(COREWEAVE_PP_AND_E, at).value, 6.422);

  // The original investor page must be issuer-owned or the *matching* SEC CIK.
  assert.throws(() => validateIssuerResult({
    ...COREWEAVE_CFO, sourceUrl: "https://www.sec.gov/Archives/edgar/data/9999999/other.htm",
  }, at), /matching/);
  assert.equal(validateIssuerResult({
    ...COREWEAVE_CFO,
    sourceUrl: "https://www.sec.gov/Archives/edgar/data/1769628/000176962826000366/crwv-20260630.htm",
  }, at).issuer, "CRWV");
  assert.throws(() => validateIssuerResult({...COREWEAVE_CFO, metric: "operating_margin_pct"}, at), /Unsupported issuer metric/);
  assert.throws(() => validateIssuerResult({...TSMC_REVENUE, metric: "cash_ppe"}, at), /Unsupported issuer metric/);
  assert.throws(() => validateIssuerResult({...TSMC_MARGIN, value: 123}, at), /finite positive/);
  assert.throws(() => validateIssuerResult({...COREWEAVE_PP_AND_E, value: -6.422}, at), /finite positive/);
  assert.equal(validateIssuerResult({...COREWEAVE_CFO, value: -0.679}, at).value, -0.679);
  assert.throws(() => validateIssuerResult({
    ...TSMC_REVENUE, sourceUrl: "https://pr.tsmc.com.attacker.test/english/news/3346"
  }, at), /matching/);
});

test("AI issuer metrics enter the same guarded canonical results path, never Story writes", async () => {
  const now = new Date("2026-10-18T00:00:00Z");
  const saved: Array<{ issuer: string; metric: string; at: string }> = [];
  const result = await handleVerifiedIssuerResults(request([
    TSMC_REVENUE, TSMC_MARGIN, COREWEAVE_CFO, COREWEAVE_PP_AND_E,
  ]), {
    authorize: async () => ({authorized:true as const,actor:"github-actions",githubRunId:"p0",workflowSha:"test"}),
    now: () => now,
    persist: async (item, at) => {
      saved.push({issuer:item.issuer,metric:item.metric,at});
      return {evidenceId:"canonical-uuid-"+item.issuer+"-"+item.metric,observationId:"original-observation"};
    },
  });
  assert.equal(result.status, 200);
  assert.equal(saved.length, 4);
  assert.deepEqual(saved.map(x=>x.metric), ["net_revenue","operating_margin_pct","operating_cash_flow","cash_ppe"]);
  assert.ok(saved.every(item=>item.at===now.toISOString()));
  assert.notEqual(issuerResultIdentity(TSMC_REVENUE).evidenceId,issuerResultIdentity(COREWEAVE_CFO).evidenceId);
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

test("issuer-quarter-metric identity distinguishes corrections without changing the key", () => {
  const first=issuerResultIdentity(validateIssuerResult(GOLDMAN,NOW));
  const replay=issuerResultIdentity(validateIssuerResult({...GOLDMAN},NOW));
  const revision=issuerResultIdentity(validateIssuerResult({...GOLDMAN,value:17.02},NOW));
  assert.deepEqual(replay,first);
  assert.equal(revision.evidenceId,first.evidenceId);
  assert.notEqual(revision.contentHash,first.contentHash);
  const nextMetric=issuerResultIdentity(validateIssuerResult({...GOLDMAN,metric:"net_revenue",value:18.68},NOW));
  assert.notEqual(nextMetric.evidenceId,first.evidenceId);
});
