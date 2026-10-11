import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { collectScheduledSec10q10k } from "../lib/scheduled-sec-10q10k-intake.ts";
import { SEC_D1_ISSUERS, type SecCashflowIssuerTicker } from "../lib/dossier-v2/issuer-sec-quarterly-cashflow.ts";

const NOW = new Date("2026-10-11T13:00:00Z");
const AGENT = "Alchemy Live Desk monitored-sec-contact@example.org";
const TICKERS = ["GOOGL", "MSFT", "AMZN", "META"] as const;
type Row = {
  id:string; external_evidence_id:string; normalised_observation_id:string;
  structured_payload:{ticker:SecCashflowIssuerTicker;secFilingAccession:string};
};
function accession(t:SecCashflowIssuerTicker) {
  return SEC_D1_ISSUERS[t].cik + "-26-000100";
}
function row(t:SecCashflowIssuerTicker,acc=accession(t)):Row{
  return {
    id:t+"-uuid",external_evidence_id:"sec-cashflow:"+SEC_D1_ISSUERS[t].cik+":2026:Q3",
    normalised_observation_id:t+"-observation",
    structured_payload:{ticker:t,secFilingAccession:acc},
  };
}
const discovery=async (ticker:SecCashflowIssuerTicker) => ({
  filing:{accessionNumber:accession(ticker),form:ticker==="MSFT"?"10-K" as const:"10-Q" as const,filingDate:"2026-10-08"},
  gap:null,
});

test("SEC ingestion requires a real application contact and never falls back to invented provider identity",async()=>{
  let called=false;
  const result=await collectScheduledSec10q10k(NOW,{
    userAgent:"",
    readEvidence:async()=>{called=true;return [];},
    discover:async()=>{called=true;return{filing:null,gap:null}},
  });
  assert.equal(result.status,"UNCONFIGURED");
  assert.equal(result.evidenceIds.length,0);
  assert.deepEqual(result.gaps,["SEC_USER_AGENT_NOT_CONFIGURED"]);
  assert.equal(called,false);
});

test("An already admitted exact 10-Q or 10-K accession skips SEC companyfacts and Evidence writer",async()=>{
  let writes=0,discoveries=0,reads=0;
  const result=await collectScheduledSec10q10k(NOW,{
    userAgent:AGENT,
    readEvidence:async()=>{reads++;return TICKERS.map(t=>row(t));},
    discover:async(t)=>{discoveries++;return discovery(t);},
    persist:async()=>{writes++;return{persisted:[],gaps:[]}},
  });
  assert.equal(result.status,"SKIPPED_UNCHANGED");
  assert.equal(reads,1);
  assert.equal(discoveries,4);
  assert.equal(writes,0);
  assert.equal(result.evidenceIds.length,0);
  assert.deepEqual(result.filings.map(x=>x.form),["10-Q","10-K","10-Q","10-Q"]);
});

test("Only genuinely new issuer accession runs existing canonical writer and verifies UUID by readback",async()=>{
  let rows:Row[]=TICKERS.filter(t=>t!=="META").map(t=>row(t));
  let writes=0;
  const result=await collectScheduledSec10q10k(NOW,{
    userAgent:AGENT,
    readEvidence:async()=>rows,
    discover:discovery,
    persist:async(t)=>{writes++;assert.equal(t,"META");rows=[...rows,row("META")];return{
      persisted:[{id:"original-claim",evidenceId:"META-uuid",observationId:"META-observation"}],
      gaps:[],
    }},
  });
  assert.equal(writes,1);
  assert.equal(result.status,"CANONICAL_WRITER_RAN");
  assert.deepEqual(result.evidenceIds,["META-uuid"]);
  assert.equal(result.filings.filter(x=>x.state==="ADMITTED").length,1);
  assert.equal(result.filings.filter(x=>x.state==="UNCHANGED").length,3);
});

test("Successful fetch or writer call without exact canonical filing proof is a GAP, never a fabricated observation",async()=>{
  let calls=0;
  const result=await collectScheduledSec10q10k(NOW,{
    userAgent:AGENT,
    readEvidence:async()=>[],
    discover:discovery,
    persist:async()=>{calls++;return{persisted:[],gaps:["PRIOR_FISCAL_YTD_NOT_VERIFIED"]}},
  });
  assert.equal(calls,4);
  assert.equal(result.status,"DEGRADED");
  assert.equal(result.evidenceIds.length,0);
  assert.ok(result.gaps.some(x=>x.includes("CURRENT_FILING_CASHFLOW_NOT_ADMITTED")));
  assert.ok(result.filings.every(x=>x.state==="GAP"));
});

test("SEC metadata discovery accepts only day-mature 10-Q/10-K, rejects later same-period amendment",async()=>{
  const payload=(cik:number,withAmendment=false)=>({
    cik, name:"SEC filer", filings:{recent:{
      accessionNumber:withAmendment?["0001234567-26-000200","0001234567-26-000100"]:["0001234567-26-000100"],
      filingDate:withAmendment?["2026-10-10","2026-10-08"]:["2026-10-08"],
      form:withAmendment?["10-Q/A","10-Q"]:["10-Q"],
      reportDate:withAmendment?["2026-09-30","2026-09-30"]:["2026-09-30"],
      acceptanceDateTime:withAmendment?["2026-10-10T16:00:00","2026-10-08T16:00:00"]:["2026-10-08T16:00:00"],
      primaryDocument:withAmendment?["amended.htm","original.htm"]:["original.htm"],
    }},
  });
  for(const amended of [false,true]) {
    let persisted=0;
    const result=await collectScheduledSec10q10k(NOW,{
      userAgent:AGENT,readEvidence:async()=>[],
      fetchImpl:async (url)=>{
        const match=String(url).match(/CIK(\d+)\.json/);
        const cik=Number(match?.[1]??0);
        return new Response(JSON.stringify(payload(cik,amended)),{status:200});
      },
      persist:async()=>{persisted++;return{persisted:[],gaps:[]}},
    });
    if(amended){
      assert.equal(persisted,0);
      assert.ok(result.gaps.some(x=>x.includes("AMENDMENT_REQUIRES_REVIEW")));
    }else{
      assert.equal(persisted,4);
      assert.ok(result.gaps.some(x=>x.includes("CURRENT_FILING_CASHFLOW_NOT_ADMITTED")));
    }
  }
});

test("SEC 10-Q/10-K collector uses existing scheduled Live slot, existing evidence writer; zero new cron or Story mutations",()=>{
  const cron=readFileSync(new URL("../lib/cron-research-handler.ts",import.meta.url),"utf8");
  const collector=readFileSync(new URL("../lib/scheduled-sec-10q10k-intake.ts",import.meta.url),"utf8");
  const writer=readFileSync(new URL("../lib/dossier-v2/persist-sec-quarterly-cashflow.ts",import.meta.url),"utf8");
  const vercel=readFileSync(new URL("../vercel.json",import.meta.url),"utf8");
  assert.match(cron,/collectScheduledSec10q10k/);
  assert.ok(cron.indexOf("secFilingsPromise")<cron.indexOf("const publication = await"));
  assert.match(cron,/secFilings,/);
  assert.match(collector,/buildSecSubmissionsUrl/);
  assert.match(collector,/parseSecSubmissionsPayload/);
  assert.match(collector,/persistSecIssuerCashflowEvidence/);
  assert.match(collector,/maxQuarters: 2/);
  assert.match(writer,/normalised_observation_id:obs\.id/);
  assert.doesNotMatch(collector,/story_thesis_versions|runIntelligenceEngine|executeResearchBrain/);
  assert.doesNotMatch(vercel,/\/api\/cron\/sec-10q10k/);
});
