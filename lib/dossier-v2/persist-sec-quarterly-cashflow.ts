import { createSupabaseAdminClient } from "../supabase/admin.ts";
import {
  extractAlphabetSecQuarterCashFlows, SEC_CASHFLOW_METHOD, SEC_CASHFLOW_SOURCE,
  SEC_D1A_ISSUER,
} from "./issuer-sec-quarterly-cashflow.ts";

/**
 * D1a only. The SEC publishing date is day-precision; next UTC midnight is a
 * conservative available-at bound, NOT a claim about the actual SEC release hour.
 * This can populate canonical Evidence, but cannot mutate a Story or auto-fire
 * a provisional capex/CFO Regime rule.
 */
export async function persistAlphabetSecCashflowEvidence(
  asOf: string,
  options: { now?: string; userAgent?: string; fetchImpl?: typeof fetch } = {},
) {
  const now = options.now ?? new Date().toISOString();
  const asOfMs = Date.parse(asOf), nowMs = Date.parse(now);
  const gaps: string[] = [], persisted: Array<{ id: string; evidenceId: string; observationId: string }> = [];
  if (!Number.isFinite(asOfMs) || !Number.isFinite(nowMs)
    || asOfMs > nowMs+300_000 || nowMs-asOfMs > 86_400_000) {
    return { persisted, gaps: ["HISTORICAL_OR_FUTURE_REPLAY"] };
  }
  const userAgent = options.userAgent ?? process.env.SEC_USER_AGENT?.trim();
  if (!userAgent || !/^[^\n\r]{12,200}$/.test(userAgent)) {
    return { persisted, gaps: ["SEC_USER_AGENT_NOT_CONFIGURED"] };
  }
  const response = await (options.fetchImpl ?? fetch)(SEC_D1A_ISSUER.secUrl, {
    headers: { accept: "application/json", "user-agent": userAgent },
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) return { persisted, gaps: ["SEC_PRIMARY_FACTS_HTTP_"+response.status] };
  const payload = await response.json();
  const candidates = extractAlphabetSecQuarterCashFlows(payload, asOf);
  gaps.push(...candidates.gaps);
  const client = createSupabaseAdminClient();
  const { persistSensorMemory } = await import("../providers/sensor-memory-supabase.ts");
  for (const item of candidates.items) {
    const externalId = item.observationIdentity;
    const { data: existing, error: existsError } = await client.from("intelligence_evidence")
      .select("id,content_hash,normalised_observation_id,external_evidence_id")
      .like("external_evidence_id", "sec-cashflow:"+item.issuerCik+":%")
      .gte("event_at", item.periodEnd+"T00:00:00Z")
      .lte("event_at", item.periodEnd+"T23:59:59.999Z")
      .limit(10);
    if (existsError) throw new Error("SEC cashflow idempotency lookup failed: "+existsError.message);
    const older = existing ?? [];
    if (older.some((row)=>row.content_hash !== item.contentHash
      || row.external_evidence_id !== externalId)) {
      gaps.push(externalId+":CONFLICTING_FILING_REVISION_REQUIRES_ADJUDICATION");
      continue;
    }
    if (older.length) {
      if (!older[0].normalised_observation_id) {
        gaps.push(externalId+":EXISTING_EVIDENCE_LACKS_NORMALISED_OBSERVATION");
        continue;
      }
      persisted.push({ id:externalId,evidenceId:older[0].id,observationId:older[0].normalised_observation_id });
      continue;
    }
    // Provider identities are fixed, never accepted from fetched JSON or Notion.
    const { data: source, error: sourceError } = await client
      .from("intelligence_evidence_sources")
      .upsert({
        provider_key:"sec_xbrl_consolidated_cashflow",
        external_source_id:"CIK"+item.issuerCik,
        source_name:SEC_CASHFLOW_SOURCE,
        source_type:"regulatory_filing",
        source_url:item.sourceUrl,
        source_tier:1,
        reliability_score:95,
        methodology_notes:"SEC primary XBRL: same filing accession for CFO/cash PP&E YTD; adjacent fiscal year-to-date difference, not combined lease-inclusive capex or AI-specific revenue. Published clock is conservatively bounded by next UTC midnight after SEC filed day.",
        metadata:{ verificationRole:"canonical", filingBasis:SEC_CASHFLOW_METHOD, entityScope:"CONSOLIDATED", issuer:"GOOGL" },
        last_seen_at:now,updated_at:now,
      },{onConflict:"provider_key,external_source_id"})
      .select("id").single<{id:string}>();
    if (sourceError || !source) throw new Error("SEC cashflow source registration failed: "+(sourceError?.message??"missing source"));
    const claim = "Alphabet consolidated FY"+item.fiscalYear+" Q"+item.fiscalQuarter+
      " CFO $"+item.cfoUsd+"; cash PP&E $"+item.cashPpeUsd+
      "; simple FCF (CFO minus cash PP&E) $"+item.simpleFcfUsd+
      " (USD; quarter ended "+item.periodEnd+"). SEC XBRL values use filed "+item.filedDate+
      " and "+(item.predecessorAccession?"prior-quarter fiscal-YTD subtraction.":"direct Q1 quarter.")+
      " Excludes separately disclosed finance-lease principal; NOT AI-only cash flow or Story causality.";
    const memory = await persistSensorMemory({
      provider:"sec_xbrl_consolidated_cashflow",
      sourceUrl:item.sourceUrl,
      sourceType:"regulatory_filing",
      contentType:"application/json",
      rawPayload:{
        observationIdentity:item.observationIdentity,
        financialPeriod:[item.periodStart,item.periodEnd],
        publishedDate:item.filedDate,
        accession:item.currentAccession,
        predecessorAccession:item.predecessorAccession,
        observedComponents:{
          cfoYtd:item.componentCfoYtdUsd,capexYtd:item.componentCashPpeYtdUsd,
          predecessorCfoYtd:item.predecessorCfoYtdUsd,
          predecessorCapexYtd:item.predecessorCashPpeYtdUsd,
        },derivedQuarter:{
          cfo:item.cfoUsd,capex:item.cashPpeUsd,fcf:item.simpleFcfUsd,
        },
      },
      contentText:claim, publishedAt:item.availableAt, observedAt:now,
      ingestionKey:externalId,
      observations:[{
        observationType:"issuer_quarterly_cashflow",
        subjectType:"public_company_consolidated",
        subjectKey:item.issuerCik,
        observedAt:item.periodEnd+"T23:59:59.999Z",
        effectiveAt:item.availableAt,
        value:{cfoUsd:item.cfoUsd,cashPpeUsd:item.cashPpeUsd,simpleFcfUsd:item.simpleFcfUsd,positiveCfoCapexRatio:item.capexToPositiveCfo,periodStart:item.periodStart,periodEnd:item.periodEnd,accession:item.currentAccession,predecessorAccession:item.predecessorAccession},
        unit:"USD",confidence:95,methodologyVersion:SEC_CASHFLOW_METHOD,
      }],
    });
    const {data:obs,error:obsError} = await client.from("normalised_observations")
      .select("id")
      .eq("raw_record_id",memory.rawRecordId)
      .eq("observation_type","issuer_quarterly_cashflow")
      .eq("subject_type","public_company_consolidated")
      .eq("subject_key",item.issuerCik)
      .eq("observed_at",item.periodEnd+"T23:59:59.999Z")
      .eq("methodology_version",SEC_CASHFLOW_METHOD)
      .limit(1).single<{id:string}>();
    if (obsError || !obs) throw new Error("SEC quarterly normalized observation ID missing: "+(obsError?.message??"missing row"));
    const {data:evidence,error:evidenceError} = await client.from("intelligence_evidence")
      .upsert({
        source_id:source.id,
        external_evidence_id:externalId,
        evidence_class:"regulatory_filing",
        support_direction:"context",
        claim_text:claim,summary:null,
        event_at:item.periodEnd+"T23:59:59.999Z",
        published_at:item.availableAt,
        available_at:item.availableAt,
        affected_assets:["GOOGL","GOOG"],
        affected_topics:["us-china-ai","ai-capex-cash-conversion"],
        measurement_unit:"USD",
        observed_value:item.simpleFcfUsd,expected_value:null,previous_value:null,
        confidence:95,
        freshness_status:"current",
        content_hash:item.contentHash,
        provenance_urls:[item.sourceUrl,item.filingIndexUrl],
        structured_payload:{
          title:"Alphabet SEC quarter FY"+item.fiscalYear+" Q"+item.fiscalQuarter,
          evidenceNature:"issuer_sec_consolidated_cashflow",
          methodologyVersion:SEC_CASHFLOW_METHOD,
          entityScope:"CONSOLIDATED",
          issuerCik:item.issuerCik,ticker:"GOOGL",
          accountingBasis:"US_GAAP",fiscalYear:item.fiscalYear,fiscalQuarter:item.fiscalQuarter,
          periodStart:item.periodStart,periodEnd:item.periodEnd,secFilingDate:item.filedDate,
          secFilingAccession:item.currentAccession,previousFilingAccession:item.predecessorAccession,
          cfoUsd:item.cfoUsd,cashPpeUsd:item.cashPpeUsd,simpleFcfUsd:item.simpleFcfUsd,
          capexToPositiveCfo:item.capexToPositiveCfo,
          scopeCaveat:"NOT_AI_ONLY; CASH_PP&E_EXCLUDES_FINANCE_LEASE_PRINCIPAL",
          interpretationAuthority:"context_only_requires_dossier_adjudication",
          actualReleaseTime:"UNVERIFIED_DAY_ONLY",
        },
        raw_payload:{},normalizer_version:SEC_CASHFLOW_METHOD,
        normalised_observation_id:obs.id,updated_at:now,
      },{onConflict:"source_id,content_hash"})
      .select("id").single<{id:string}>();
    if (evidenceError || !evidence) throw new Error("SEC cashflow Evidence UUID missing: "+(evidenceError?.message??"missing ID"));
    persisted.push({id:externalId,evidenceId:evidence.id,observationId:obs.id});
  }
  return {persisted,gaps};
}
