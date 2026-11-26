/** Persist issuer-original release detections from the existing scheduled
 * research run. This does not validate EPS, cash flow or analyst consensus.
 * No separate scheduler or public publication is introduced here.
 */
import { createSupabaseAdminClient } from "./supabase/admin.ts";
import {canonicalIssuerQuarter,selectExistingIssuerQuarter} from "./earnings/issuer-quarter-identity.ts";
import type { ResearchRunInput } from "./research-update.ts";

export async function persistIssuerReleaseDetections(
  before: ResearchRunInput, after: ResearchRunInput, now: Date,
): Promise<number> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return 0;
  const prior = new Set(before.items.map(item => item.itemKey));
  const detected = after.items.filter(item =>
    item.itemKey.startsWith("issuer-press:") && !prior.has(item.itemKey)
  ).slice(0, 12);
  if (!detected.length) return 0;
  const db = createSupabaseAdminClient();
  let saved = 0;
  for (const item of detected) {
    const match = /^Issuer confirms (.+?) financial results — ([A-Z0-9.]+)$/.exec(item.title);
    if (!match) continue;
    const ticker = match[2];
    const sourcePeriod = canonicalIssuerQuarter(match[1]);
    if(!sourcePeriod)continue;
    const {data: known,error:readError} = await db.from("issuer_earnings_ingestion_state")
      .select("fiscal_period,state,event_at").eq("ticker",ticker).order("event_at",{ascending:false}).limit(80);
    if(readError)throw new Error("issuer_detection_read_failed: "+readError.code);
    // "FY2027 Q3" and "Q3 FY27" must resolve to the SAME issuer-quarter.
    const existing=selectExistingIssuerQuarter(known??[],sourcePeriod);
    const fiscalPeriod=existing?.fiscal_period??sourcePeriod;
    if (existing && ["verified","published","review_required","partial"].includes(existing.state)) continue;
    const { error: stateError } = await db.from("issuer_earnings_ingestion_state")
      .upsert({
        ticker, fiscal_period: fiscalPeriod, source_url: item.url,
        state: "source_detected", next_retry_at: now.toISOString(),
        event_at: existing?.event_at??now.toISOString(),
        gap_reason: "Original release found; financial metrics and consensus not reconciled",
        updated_at: now.toISOString(),
      }, { onConflict: "ticker,fiscal_period" });
    if (stateError) throw new Error("issuer_detection_state_failed: " + stateError.code);
    const resultId = ticker + "|" + fiscalPeriod;
    const { error: resultError } = await db.from("issuer_earnings_results")
      .upsert({
        id: resultId, ticker, fiscal_period: fiscalPeriod,
        company_name: ticker, source_url: item.url,
        source_retrieved_at: now.toISOString(), verification_status: "source_detected",
        verification_notes: "Issuer original source detected by scheduled intake; financial facts not yet reconciled.",
        updated_at: now.toISOString(),
      }, { onConflict: "id", ignoreDuplicates: true });
    if (resultError) throw new Error("issuer_detection_result_failed: " + resultError.code);
    saved++;
  }
  return saved;
}
