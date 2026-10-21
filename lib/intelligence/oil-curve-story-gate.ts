import { createSupabaseAdminClient } from "../supabase/admin.ts";
import {
  verifiedCanonicalOilPair,
  type CanonicalOilProofInput,
  type OilBenchmark,
} from "../research-gap-exact-oil-proof.ts";

/**
 * A canonical Evidence UUID attached to a news/context page is not a measured
 * futures curve. Only the existing exchange-original, readback-verified source
 * chain can support an observed Brent/WTI settlement direction in a Story.
 * This check runs BEFORE the existing immutable Story writer.
 */
export type VerifiedStoryOilPair = {
  evidenceId: string;
  benchmark: OilBenchmark;
  tradeDate: string;
  frontSettle: number;
  nextSettle: number;
};

const DATE = /\b20\d{2}-\d{2}-\d{2}\b/;
const CURVE = /\b(?:backwardat(?:ion|ed)|contango|front[\s/–-]*(?:month|next)\s+(?:premium|discount|spread)|F1[\s/–-]*F2|calendar[- ]spread|roll[- ]yield|positive\s+(?:roll|spread)|negative\s+(?:roll|spread))\b/i;
const UNCERTAIN = /\b(?:if|would|could|might|may|potential(?:ly)?|hypothetical|scenario|unverified|unconfirmed|unresolved|awaiting|not (?:established|verified|confirmed|observed|proven)|no confirmed|cannot (?:confirm|conclude)|need(?:s)? to verify|reportedly|reported|allegedly|according to|third[- ]party(?: report)?|research (?:lead|question)|check whether|test whether|monitor(?:ing)?|watch(?:ing)?)\b/i;

function curveDirection(sentence: string): -1 | 0 | 1 {
  if (/\b(?:backwardat(?:ion|ed)|front[\s/–-]*(?:month|next)\s+premium|positive\s+(?:roll|spread))\b/i.test(sentence)) return 1;
  if (/\b(?:contango|front[\s/–-]*(?:month|next)\s+discount|negative\s+(?:roll|spread))\b/i.test(sentence)) return -1;
  return 0;
}

function benchmarks(sentence: string, assets: readonly string[]): OilBenchmark[] {
  const found: OilBenchmark[] = [];
  if (/\b(?:WTI|West Texas Intermediate|NYMEX\s+CL)\b/i.test(sentence)) found.push("WTI");
  if (/\b(?:Brent|ICE\s+B(?:rent)?)\b/i.test(sentence)) found.push("BRENT");
  if (!found.length && /\b(?:crude|oil|futures|front.month|roll.yield)\b/i.test(sentence)) {
    if (assets.includes("WTI")) found.push("WTI");
    if (assets.includes("BRENT")) found.push("BRENT");
  }
  return found;
}
function impliedTradeDate(sentence: string): string | null {
  const iso = sentence.match(DATE)?.[0];
  if (iso) return iso;
  const m = sentence.match(/\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})\b/i);
  if (!m) return null;
  const names = "january february march april may june july august september october november december".split(" ");
  const month = names.indexOf(m[2]!.toLowerCase());
  const day = Number(m[1]);
  const d = new Date(Date.UTC(Number(m[3]), month, day));
  return d.getUTCDate() === day && d.getUTCMonth() === month
    ? d.toISOString().slice(0, 10) : null;
}

export function measuredOilCurveAssertionErrors(input: {
  texts: readonly string[];
  assets: readonly string[];
  evidenceIds: readonly string[];
  receipts: readonly VerifiedStoryOilPair[];
  asOf: string;
}): string[] {
  const asOf = Date.parse(input.asOf);
  const authorised = new Set(input.evidenceIds);
  const errors: string[] = [];
  for (const text of input.texts) {
    for (const sentence of text.replace(/U\.S\./gi, "US").split(/(?<=[.!?])\s+|\n+/)) {
      if (!CURVE.test(sentence) || UNCERTAIN.test(sentence)) continue;
      const required = benchmarks(sentence, input.assets);
      for (const benchmark of required) {
        const expected = curveDirection(sentence);
        const tradeDate = impliedTradeDate(sentence);
        const match = input.receipts.some(receipt => {
          if (receipt.benchmark !== benchmark || !authorised.has(receipt.evidenceId)) return false;
          if (!Number.isFinite(receipt.frontSettle) || !Number.isFinite(receipt.nextSettle)) return false;
          if (tradeDate && receipt.tradeDate !== tradeDate) return false;
          if (!tradeDate) {
            const close = Date.parse(receipt.tradeDate + "T23:59:59Z");
            if (!Number.isFinite(asOf) || !Number.isFinite(close) || asOf < close || asOf - close > 259_200_000) return false;
          }
          const spread = receipt.frontSettle - receipt.nextSettle;
          if (expected !== 0 && Math.sign(spread) !== expected) return false;
          // A quoted spread must equal the verified front minus next settle.
          // Do not let a legitimate archive receipt bless an invented number.
          if (/\\$\\s*-?\\d/.test(sentence)) {
            const quoted = sentence.match(
              /(?:F1[\\s/–-]*F2|spread|premium|discount)\\s+(?:of\\s+|was\\s+|at\\s+|is\\s+)?\\$\\s*(-?\\d+(?:\\.\\d+)?)/i,
            );
            if (!quoted || Math.abs(Number(quoted[1]) - spread) > 0.005) return false;
          }
          return true;
        });
        if (!match) errors.push(
          benchmark + " curve direction is stated as an observed fact without a source-linked, " +
          "date-matched verified original FINAL F1/F2 settlement pair. " +
          "Keep a hypothetical, reported lead or unresolved finding instead.",
        );
      }
    }
  }
  return [...new Set(errors)];
}

/**
 * Look up ONLY the Story's actual cited Evidence UUIDs. Join to normalized
 * observations, original raw records and publisher identity, then reuse the
 * strict server-side Research Gap verifier. Fail closed on read errors.
 */
export async function loadVerifiedStoryOilPairs(
  evidenceIds: readonly string[], asOf: string,
): Promise<VerifiedStoryOilPair[]> {
  const ids = [...new Set(evidenceIds)].filter(id => /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id)).slice(0, 30);
  if (!ids.length) return [];
  const asOfDate = new Date(asOf);
  if (!Number.isFinite(asOfDate.getTime())) return [];
  const db = createSupabaseAdminClient();
  const { data: evidence, error } = await db.from("intelligence_evidence")
    .select("id,normalised_observation_id,source_id,measurement_unit,event_at,available_at,affected_assets,provenance_urls,structured_payload")
    .in("id", ids)
    .contains("structured_payload", { signalKind: "official_futures_settlement_pair" });
  if (error) throw new Error("Oil Story official evidence provenance lookup failed: " + error.message);
  if (!evidence?.length) return [];
  const observationIds = [...new Set(evidence.map(x => x.normalised_observation_id).filter((x): x is string => Boolean(x)))];
  const sourceIds = [...new Set(evidence.map(x => x.source_id).filter((x): x is string => Boolean(x)))];
  if (!observationIds.length || !sourceIds.length) return [];
  const [obs, sources] = await Promise.all([
    db.from("normalised_observations").select("id,raw_record_id,value").in("id", observationIds),
    db.from("intelligence_evidence_sources").select("id,source_tier,source_url").in("id", sourceIds),
  ]);
  if (obs.error || sources.error) throw new Error("Oil Story original source lineage lookup failed.");
  const rawIds = [...new Set((obs.data ?? []).map(x => x.raw_record_id).filter((x): x is string => Boolean(x)))];
  if (!rawIds.length) return [];
  const raw = await db.from("raw_source_records")
    .select("id,source_url,content_type,content_hash,provider,payload").in("id", rawIds);
  if (raw.error) throw new Error("Oil Story original archive lookup failed: " + raw.error.message);
  const byObs = new Map((obs.data ?? []).map(x => [x.id, x]));
  const bySource = new Map((sources.data ?? []).map(x => [x.id, x]));
  const byRaw = new Map((raw.data ?? []).map(x => [x.id, x]));
  const pairs: VerifiedStoryOilPair[] = [];
  for (const e of evidence) {
    const observation = e.normalised_observation_id ? byObs.get(e.normalised_observation_id) : null;
    const source = e.source_id ? bySource.get(e.source_id) : null;
    const original = observation?.raw_record_id ? byRaw.get(observation.raw_record_id) : null;
    if (!observation || !source || !original) continue;
    const proof = { evidence: e, observation, raw: original, source } as CanonicalOilProofInput;
    for (const benchmark of ["WTI", "BRENT"] as const) {
      if (!verifiedCanonicalOilPair(proof, benchmark, asOfDate)) continue;
      const value = observation.value as Record<string, unknown> | null;
      if (typeof value?.tradeDate !== "string"
        || typeof value.frontSettle !== "number"
        || typeof value.nextSettle !== "number") continue;
      pairs.push({
        evidenceId: e.id, benchmark,
        tradeDate: value.tradeDate, frontSettle: value.frontSettle, nextSettle: value.nextSettle,
      });
    }
  }
  return pairs;
}
