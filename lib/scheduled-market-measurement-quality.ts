/**
 * Zero-LLM, scheduled market-measurement clock and freshness contract.
 * Do not assert a US exchange holiday or FRED publication hour from weekdays.
 * At 09:30/21:30 MYT, the last eligible US close may be the previous date.
 */
export const SCHEDULED_MARKET_MEASUREMENT_CONTRACT = "scheduled-market-measurements/1" as const;
export type MarketMetricKey =
  | "hy_oas_20s" | "ig_oas_20s"
  | "smh_qqq_20s" | "xlf_spx_20s" | "rsp_spx_20s";
export type MarketMeasurementState =
  | "CURRENT" | "UNCHANGED_EXPECTED" | "EXPECTED_UPDATE" | "LATE"
  | "MISSING" | "DEFINITION_MISMATCH" | "PROVIDER_ERROR";
export type ExistingMarketEvidence = {
  id: string;
  external_evidence_id: string | null;
  event_at: string | null;
  measurement_unit: string | null;
};
export type MarketMeasurementCheck = {
  key: MarketMetricKey;
  status: MarketMeasurementState;
  lastObservationDay: string | null;
  requiredObservationDay: string;
  canonicalEvidenceUuid: string | null;
  expectedUnit: "basis_points" | "percentage_points";
  reason: string;
};
const KEYS: MarketMetricKey[] = ["hy_oas_20s", "ig_oas_20s", "smh_qqq_20s", "xlf_spx_20s", "rsp_spx_20s"];
const OAS = new Set<MarketMetricKey>(["hy_oas_20s", "ig_oas_20s"]);
const DAY_MS = 86_400_000;

function utcDay(date: Date) { return date.toISOString().slice(0,10); }
function previousBusinessDay(day: string) {
  const date = new Date(day + "T12:00:00Z");
  do { date.setUTCDate(date.getUTCDate()-1); } while (date.getUTCDay()===0 || date.getUTCDay()===6);
  return utcDay(date);
}
function lastCompletedUsWeekday(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit",
    hour:"2-digit",hourCycle:"h23",weekday:"short",
  }).formatToParts(now);
  const p = Object.fromEntries(parts.map(x=>[x.type,x.value]));
  const today = p.year+"-"+p.month+"-"+p.day;
  const dow = new Date(today+"T12:00:00Z").getUTCDay();
  return dow===0 || dow===6 || Number(p.hour)<16 ? previousBusinessDay(today) : today;
}
/**
 * FRED daily OAS often appears after the underlying US equity close.
 * Allow one whole prior business session, and do not pretend this is
 * a verified release schedule or a US-exchange holiday calendar.
 */
export function expectedMarketMeasurementDays(now: Date) {
  const usClose = lastCompletedUsWeekday(now);
  return {usClose,creditDue:previousBusinessDay(usClose)};
}
export function assessScheduledMarketMeasurements(
  now: Date,
  existing: ExistingMarketEvidence[],
): MarketMeasurementCheck[] {
  const {usClose,creditDue} = expectedMarketMeasurementDays(now);
  return KEYS.map(key=>{
    const due = OAS.has(key)?creditDue:usClose;
    const unit = OAS.has(key)?"basis_points" as const:"percentage_points" as const;
    const records = existing.filter(row=>row.external_evidence_id?.startsWith("market-crack:"+key+":"));
    const today = records.filter(row=>row.event_at && Number.isFinite(Date.parse(row.event_at)))
      .sort((a,b)=>Date.parse(b.event_at!)-Date.parse(a.event_at!));
    const latest=today[0]??null;
    const last = latest?.event_at?.slice(0,10)??null;
    const nowNyParts = new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",weekday:"short",hour:"2-digit",hourCycle:"h23"}).formatToParts(now);
    const ny=Object.fromEntries(nowNyParts.map(x=>[x.type,x.value]));
    const noNewClose = ny.weekday==="Sat" || ny.weekday==="Sun" || Number(ny.hour)<16;
    let status:MarketMeasurementState = "EXPECTED_UPDATE", reason="Last due completed US market session not in canonical Evidence.";
    if (latest && latest.measurement_unit!==unit) {
      status="DEFINITION_MISMATCH";reason="Canonical unit differs from the fixed 20-session metric definition.";
    } else if (last && last>=due) {
      status=noNewClose?"UNCHANGED_EXPECTED":"CURRENT";
      reason=noNewClose?"No new completed US market close is due; preserve original market observation day.":"Canonical observation covers the conservative due session.";
    } else if (!last) {
      status="MISSING";reason="No admitted canonical observation exists for this metric.";
    } else {
      const difference=(Date.parse(due+"T12:00:00Z")-Date.parse(last+"T12:00:00Z"))/DAY_MS;
      if (difference>5) {
        status="LATE";reason="Admitted market observation is multiple calendar days behind the conservative due business session; holiday calendar has not been independently verified.";
      } else {
        status="EXPECTED_UPDATE";reason="A newer matched completed session should be checked against the primary provider before claiming it is missing.";
      }
    }
    return {key,status,lastObservationDay:last,requiredObservationDay:due,canonicalEvidenceUuid:latest?.id??null,expectedUnit:unit,reason};
  });
}
export function allQuantifiedMarketInputsCurrent(checks: MarketMeasurementCheck[]) {
  return checks.length===KEYS.length && checks.every(x=>x.status==="CURRENT"||x.status==="UNCHANGED_EXPECTED");
}
