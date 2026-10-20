import type { DossierV2InputPacket, ObservedEvidence } from "./input-packet.ts";

type Benchmark = "WTI" | "BRENT";
type Coverage = { evidenceId: string; tradeDate: string; spreadUsdPerBarrel: number };
export type EnergyClaimCoverage = {
  wti: Coverage | null;
  brent: Coverage | null;
  usRussianDieselDeliveryEvidenceId: string | null;
  unresolvedRequirements: string[];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SHA256 = /^[0-9a-f]{64}$/i;

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function validOriginalSource(item: ObservedEvidence, host: string): boolean {
  return item.provenance.some(ref => {
    if (!ref.url) return false;
    try {
      const url = new URL(ref.url);
      return url.protocol === "https:"
        && (url.hostname === host || url.hostname.endsWith("." + host))
        && url.pathname !== "/" && url.pathname.length > 5;
    } catch { return false; }
  });
}
function admissible(item: ObservedEvidence, asOf: number): boolean {
  const available = Date.parse(item.available_at);
  const occurred = Date.parse(item.occurrence_time ?? "");
  return item.canonical_record_backed === true
    && UUID.test(item.evidence_id)
    && Number.isFinite(available) && Number.isFinite(occurred)
    && available <= asOf && occurred <= asOf
    && item.metrics?.source_tier === 1;
}

/** Single-month closing prices and rolling current exchange PDFs do NOT prove F1-F2. */
function settlement(item: ObservedEvidence, benchmark: Benchmark): Coverage | null {
  const m = item.metrics ?? {};
  const front = num(m.front_settle);
  const next = num(m.next_settle);
  const date = typeof m.trade_date === "string" ? m.trade_date : "";
  const frontContract = typeof m.front_contract === "string" ? m.front_contract : "";
  const nextContract = typeof m.next_contract === "string" ? m.next_contract : "";
  const host = benchmark === "WTI" ? "cmegroup.com" : "ice.com";
  if (m.signal_kind !== "official_futures_settlement_pair"
    || m.benchmark !== benchmark
    || m.exchange !== (benchmark === "WTI" ? "NYMEX" : "ICE")
    || m.final !== true || m.unit !== "USD_per_barrel"
    || !DATE.test(date) || date !== item.occurrence_time?.slice(0, 10)
    || typeof m.source_sha256 !== "string" || !SHA256.test(m.source_sha256)
    || !validOriginalSource(item, host)
    || !frontContract || !nextContract || frontContract === nextContract
    || front === null || next === null || front <= 0 || next <= 0
    || front > 1000 || next > 1000
    || /\/(?:current|latest)\//i.test(item.provenance.map(p => p.url ?? "").join(" "))) return null;
  return { evidenceId: item.evidence_id, tradeDate: date,
    spreadUsdPerBarrel: Math.round((front - next) * 10000) / 10000 };
}
function confirmedArrival(item: ObservedEvidence): boolean {
  const m = item.metrics ?? {};
  return m.signal_kind === "official_import_arrival"
    && m.final === true && m.fuel === "DIESEL"
    && m.origin_country === "RU" && m.destination_country === "US"
    && typeof m.port === "string" && m.port.trim().length >= 3
    && typeof m.vessel_imo === "string" && /^\d{7}$/.test(m.vessel_imo)
    && typeof m.arrival_date === "string" && DATE.test(m.arrival_date)
    && m.arrival_date === item.occurrence_time?.slice(0, 10)
    && validOriginalSource(item, "cbp.gov");
}
export function buildEnergyClaimCoverage(packet: DossierV2InputPacket): EnergyClaimCoverage {
  const asOf = Date.parse(packet.as_of);
  const rows = [...new Map([...packet.observed_evidence, ...(packet.rate_context?.evidence ?? [])]
    .map(item => [item.evidence_id, item] as const)).values()]
    .filter(item => admissible(item, asOf));
  const wti = rows.map(item => settlement(item, "WTI")).find(Boolean) ?? null;
  const brent = rows.map(item => settlement(item, "BRENT")).find(Boolean) ?? null;
  const shipment = rows.find(confirmedArrival)?.evidence_id ?? null;
  const unresolvedRequirements = [
    ...(!wti ? ["WTI: dated FINAL NYMEX F1/F2 settles, exact contract IDs, immutable original PDF hash"] : []),
    ...(!brent ? ["Brent: dated FINAL ICE F1/F2 settles, exact contract IDs, immutable original source hash"] : []),
    ...(!shipment ? ["Russian-origin diesel US arrival: verified US customs/port vessel and date; OFAC permission is not proof of a delivery"] : []),
  ];
  return { wti, brent, usRussianDieselDeliveryEvidenceId: shipment, unresolvedRequirements };
}
function uncertain(text: string): boolean {
  return /\b(?:if|would|could|might|may|possible|potential|hypothetical|scenario|monitor|watch|check|unverified|unconfirmed|unresolved|awaiting|not established|not verified|no confirmed|cannot confirm|cannot conclude|reportedly|reported|allegedly|need to verify)\b/i.test(text);
}

/** Existing Research Brain validation owns repair/fail-closed; no new writer. */
export function energyClaimProvenanceErrors(text: string, packet: DossierV2InputPacket): string[] {
  const coverage = buildEnergyClaimCoverage(packet);
  const errors: string[] = [];
  for (const sentence of text.replace(/U\.S\./gi, "US").split(/(?<=[.!?])\s+/)) {
    if (uncertain(sentence)) continue;
    for (const benchmark of ["WTI", "BRENT"] as const) {
      const names = benchmark === "WTI" ? /\b(?:WTI|West Texas Intermediate)\b/i : /\bBrent\b/i;
      if (!names.test(sentence)) continue;
      if (/\b(?:backwardat(?:ion|ed)|front[- ]month premium|positive (?:front[- ]month |calendar )?spread|F1[\s\-–−]*F2)\b/i.test(sentence)) {
        const receipt = benchmark === "WTI" ? coverage.wti : coverage.brent;
        if (!receipt || receipt.spreadUsdPerBarrel <= 0) errors.push(
          benchmark + " backwardation stated as fact without a positive exchange-original " +
          "same-day F1-F2 settlement pair. Cite an accepted exact evidence UUID or mark " +
          "the curve unverified and request dated contracts.");
      }
    }
    if (/\bRussian(?:[- ]origin)?\b/i.test(sentence)
      && /\bdiesel\b/i.test(sentence)
      && /\b(?:U\.S\.|US|United States|American)\b/i.test(sentence)
      && /\b(?:arrived|landed|offloaded|delivered|imported|shipments?\s+(?:reached|entered)|cargoes?\s+(?:reached|entered))\b/i.test(sentence)
      && !/\b(?:authoris(?:ed|ation|ing)|authoriz(?:ed|ation|ing)|licen[cs]e|permit|waiver)\b/i.test(sentence)
      && !coverage.usRussianDieselDeliveryEvidenceId) {
      errors.push("Russian-origin diesel US delivery asserted without original verified arrival evidence. " +
        "OFAC authorisation is legal permission only; require a dated customs/port vessel receipt.");
    }
  }
  return [...new Set(errors)];
}
