import { createHash } from "node:crypto";
import {
  isValidIsoTimestamp,
  isValidUuid,
  isPlainObject,
} from "./validation.ts";

export const INPUT_PACKET_CONTRACT_VERSION = "dossier-v2-input/1";
export const THESIS_LEDGER_CONTRACT_VERSION = "thesis-ledger/1";

export type ThesisState =
  | "confirmed"
  | "weakened"
  | "invalidated"
  | "unresolved"
  | "evolved";

export interface ProvenanceRef {
  source_type: string;
  source_id: string;
  url?: string;
  published_at?: string;
  publisher?: string;
  title?: string;
  locator?: string;
}

export interface ObservedEvidence {
  evidence_id: string;
  epistemic_label: "OBSERVED";
  claim_or_fact: string;
  category: string;
  source_type: string;
  available_at: string;
  occurrence_time?: string;
  metrics?: Record<string, unknown>;
  conflict_group_id?: string;
  superseded_evidence_ids?: string[];
  provenance: ProvenanceRef[];
  rank?: number;
}

export interface ResearchLead {
  lead_id: string;
  epistemic_label?: never;
  claim_or_question: string;
  source_type: string;
  available_at: string;
  urgency?: "HIGH" | "MEDIUM" | "LOW";
  conflict_group_id?: string;
  provenance: ProvenanceRef[];
  rank?: number;
}

export interface PriorAnalyticalClaim {
  claim_id: string;
  epistemic_label: "OBSERVED" | "SUPPORTED" | "INFERRED" | "SPECULATIVE";
  claim_text: string;
  dossier_id: string;
  as_of: string;
  provenance: ProvenanceRef[];
}

export interface ThesisArgument {
  arg_id: string;
  type: "supporting" | "counter";
  text: string;
}

export interface ThesisLedgerEntry {
  thesis_id: string;
  contract_version: typeof THESIS_LEDGER_CONTRACT_VERSION | string;
  title: string;
  statement: string;
  state: ThesisState;
  version: number;
  created_at: string;
  updated_at: string;
  lineage: string[];
  arguments?: ThesisArgument[];
}

export interface ThesisLedger {
  contract_version: typeof THESIS_LEDGER_CONTRACT_VERSION | string;
  entries: ThesisLedgerEntry[];
}

export interface DevelopmentCluster {
  cluster_id: string;
  grouping_key: string;
  title: string;
  summary?: string;
  evidence: ObservedEvidence[];
  leads: ResearchLead[];
  conflict_group_id?: string;
}

export interface CreatorThemeClaim {
  claim_id: string;
  text: string;
  creator_id?: string;
  available_at: string;
  provenance: ProvenanceRef[];
}

export interface CreatorTheme {
  theme_id: string;
  theme_name: string;
  expand_later: boolean;
  claims: CreatorThemeClaim[];
}

export interface CatalystItem {
  catalyst_id: string;
  title: string;
  event_time: string;
  available_at: string;
  impact_level?: "HIGH" | "MEDIUM" | "LOW";
  provenance: ProvenanceRef[];
  rank?: number;
}

export interface ResearchGap {
  gap_id: string;
  category: string;
  description: string;
  severity: "MATERIAL" | "INFORMATIONAL";
}

export interface FreshnessWarning {
  source_name: string;
  last_available_at?: string;
  message: string;
}

export interface OmissionDiagnostics {
  omitted_clusters_count: number;
  omitted_evidence_count: number;
  omitted_leads_count: number;
  omitted_creator_themes_count: number;
  omitted_creator_claims_count: number;
  omitted_catalysts_count: number;
  omitted_prior_claims_count: number;
  omitted_thesis_entries_count: number;
  omitted_research_gaps_count: number;
  byte_limit_truncation_applied: boolean;
  notes: string[];
}

export interface DossierV2InputRequest {
  contract_version?: string;
  as_of: string;
  previous_dossier_id?: string | null;
  previous_dossier?: {
    id: string;
    as_of: string;
    prior_claims?: PriorAnalyticalClaim[];
    thesis_ledger?: ThesisLedger;
    [key: string]: unknown;
  } | null;
}

export interface SourceDataStatus {
  available_at?: string;
  status?: "OK" | "STALE" | "MISSING" | "FAILED" | string;
  items?: unknown[];
}

export interface CandidateSnapshot {
  observed_evidence?: Array<Record<string, unknown>>;
  research_leads?: Array<Record<string, unknown>>;
  creator_themes?: Array<Record<string, unknown>>;
  catalysts?: Array<Record<string, unknown>>;
  thesis_ledger?: ThesisLedger;
  price_data?: SourceDataStatus;
  macro_data?: SourceDataStatus;
  sources_status?: Record<string, { status?: string; message?: string; available_at?: string }>;
}

export interface DossierV2InputPacket {
  packet_id: string;
  contract_version: typeof INPUT_PACKET_CONTRACT_VERSION;
  as_of: string;
  previous_dossier_id: string | null;

  observed_evidence: ObservedEvidence[];
  research_leads: ResearchLead[];
  prior_analytical_state: {
    previous_dossier_id: string | null;
    as_of: string | null;
    prior_claims: PriorAnalyticalClaim[];
    thesis_ledger: ThesisLedger | null;
  };

  development_clusters: DevelopmentCluster[];
  creator_themes: CreatorTheme[];
  catalysts: CatalystItem[];
  thesis_ledger: ThesisLedger | null;

  freshness_warnings: FreshnessWarning[];
  research_gaps: ResearchGap[];
  diagnostics: OmissionDiagnostics;
}

const MAX_DEVELOPMENT_CLUSTERS = 24;
const MAX_MARKET_MONITOR_CLUSTERS = 14;
const TARGET_NON_MONITOR_CLUSTERS = 10;
const MAX_EVIDENCE_PER_CLUSTER = 6;
const MAX_LEADS_PER_CLUSTER = 3;
const MAX_TOTAL_OBSERVED_EVIDENCE = 72;
const MAX_CREATOR_THEMES = 5;
const MAX_CREATOR_EXPAND_LATER = 2;
const MAX_CREATOR_CLAIMS_PER_THEME = 3;
const MAX_CATALYSTS = 12;
const MAX_PRIOR_CLAIMS = 12;
const MAX_THESIS_LEDGER_ENTRIES = 12;
const MAX_THESIS_LINEAGE_ITEMS = 10;
const MAX_THESIS_ARGUMENTS = 10;
const MAX_RESEARCH_GAPS = 12;
const MAX_PROVENANCE_PER_ITEM = 5;
const MAX_CANONICAL_BYTES = 200000;
const CATALYST_FORWARD_HORIZON_MS = 14 * 24 * 60 * 60 * 1000; // 14 days


const MACRO_SPINE_GROUPING_KEYS = [
  "market-monitor:us2y",
  "market-monitor:us10y",
  "market-monitor:spx",
  "market-monitor:smh",
  "market-monitor:dxy",
  "market-monitor:usdjpy",
  "market-monitor:nikkei",
  "market-monitor:kospi",
  "market-monitor:hang-seng",
  "market-monitor:gold",
  "market-monitor:wti",
  "market-monitor:distillate",
  "market-monitor:crack-distillate",
  "market-monitor:hyg",
] as const;

function isMarketMonitorCluster(cluster: DevelopmentCluster) {
  return cluster.grouping_key.startsWith("market-monitor:");
}

function selectBalancedDevelopmentClusters(candidateClusters: DevelopmentCluster[]) {
  if (candidateClusters.length <= MAX_DEVELOPMENT_CLUSTERS) {
    return candidateClusters;
  }

  const byGroupingKey = new Map(candidateClusters.map((cluster) => [cluster.grouping_key, cluster]));
  const selected: DevelopmentCluster[] = [];
  const selectedIds = new Set<string>();

  const add = (cluster: DevelopmentCluster | undefined) => {
    if (!cluster || selectedIds.has(cluster.cluster_id) || selected.length >= MAX_DEVELOPMENT_CLUSTERS) return;
    selected.push(cluster);
    selectedIds.add(cluster.cluster_id);
  };

  for (const groupingKey of MACRO_SPINE_GROUPING_KEYS) {
    add(byGroupingKey.get(groupingKey));
  }

  const nonMonitor = candidateClusters.filter((cluster) => !isMarketMonitorCluster(cluster));
  for (const cluster of nonMonitor.slice(0, TARGET_NON_MONITOR_CLUSTERS)) {
    add(cluster);
  }

  let selectedMonitorCount = selected.filter(isMarketMonitorCluster).length;
  for (const cluster of candidateClusters) {
    if (selected.length >= MAX_DEVELOPMENT_CLUSTERS) break;
    if (selectedIds.has(cluster.cluster_id)) continue;
    if (isMarketMonitorCluster(cluster)) {
      if (selectedMonitorCount >= MAX_MARKET_MONITOR_CLUSTERS) continue;
      add(cluster);
      selectedMonitorCount += 1;
    }
  }

  for (const cluster of candidateClusters) {
    if (selected.length >= MAX_DEVELOPMENT_CLUSTERS) break;
    add(cluster);
  }

  return selected;
}

// Metrics Sanitizer Bounds
const METRICS_MAX_DEPTH = 4;
const METRICS_MAX_OBJECT_KEYS = 20;
const METRICS_MAX_ARRAY_ITEMS = 20;
const METRICS_MAX_KEY_LENGTH = 50;
const METRICS_MAX_STRING_LENGTH = 200;

// Sensible initial string bounds to prevent huge source strings from blowing up initial memory
const LIMIT_CLAIM_TEXT = 1000;
const LIMIT_TITLE_TEXT = 300;
const LIMIT_URL_TEXT = 500;
const LIMIT_GENERAL_TEXT = 500;

const VALID_THESIS_STATES = new Set<ThesisState>([
  "confirmed",
  "weakened",
  "invalidated",
  "unresolved",
  "evolved",
]);

const FORBIDDEN_EVIDENCE_SOURCES = new Set([
  "TRANSCRIPT",
  "CREATOR",
  "CREATOR_TRANSCRIPT",
  "YOUTUBE",
  "PODCAST",
  "ANALYSIS",
  "RESEARCH_ANALYSIS",
  "SYNTHESIS",
  "OPINION",
  "DISCOVERY",
  "NEWS_DISCOVERY",
  "FEED_DISCOVERY",
  "SCHEDULED_EVENT",
  "CALENDAR_EVENT",
  "UPCOMING_EVENT",
]);

const PRIMARY_DIRECT_FACTUAL_SOURCES = new Set([
  "VERIFIED_MACRO_DATA",
  "SEC_FILING",
  "EXCHANGE_FEED",
  "PRESS_RELEASE",
  "STATISTICAL_AGENCY",
  "FACT",
  "PRICING_FEED",
  "REGULATORY_FILING",
  "OFFICIAL_DATA",
  "COMPANY_FILING",
  "MARKET_DATA",
]);

function hashString(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex").slice(0, 16);
}

function truncateString(str: string, maxLen: number, onTruncate?: () => void): string {
  if (str.length <= maxLen) return str;
  if (onTruncate) onTruncate();
  return `${str.slice(0, maxLen - 3)}...`;
}

function sanitizeMetrics(
  val: unknown,
  depth = 1,
  onTruncate?: () => void,
): Record<string, unknown> | undefined {
  if (!isPlainObject(val)) return undefined;

  const node = sanitizeMetricsNode(val, depth, onTruncate);
  if (isPlainObject(node) && Object.keys(node).length > 0) {
    return node as Record<string, unknown>;
  }
  return undefined;
}

function sanitizeMetricsNode(
  val: unknown,
  depth: number,
  onTruncate?: () => void,
): unknown {
  if (val === null || typeof val === "boolean" || typeof val === "number") {
    if (typeof val === "number" && !Number.isFinite(val)) {
      if (onTruncate) onTruncate();
      return undefined;
    }
    return val;
  }

  if (typeof val === "string") {
    return truncateString(val, METRICS_MAX_STRING_LENGTH, onTruncate);
  }

  if (depth >= METRICS_MAX_DEPTH) {
    if (onTruncate) onTruncate();
    return undefined;
  }

  if (Array.isArray(val)) {
    if (val.length > METRICS_MAX_ARRAY_ITEMS) {
      if (onTruncate) onTruncate();
    }
    const boundedArray = val.slice(0, METRICS_MAX_ARRAY_ITEMS);
    const resultArr: unknown[] = [];
    for (const item of boundedArray) {
      const node = sanitizeMetricsNode(item, depth + 1, onTruncate);
      if (node !== undefined) {
        resultArr.push(node);
      }
    }
    return resultArr;
  }

  if (isPlainObject(val)) {
    // 1. Sort object entries alphabetically by original key first
    const sortedRawEntries = Object.entries(val).sort(([k1], [k2]) => k1.localeCompare(k2));

    if (sortedRawEntries.length > METRICS_MAX_OBJECT_KEYS) {
      if (onTruncate) onTruncate();
    }

    // 2. Slice to METRICS_MAX_OBJECT_KEYS AFTER deterministic sorting
    const boundedEntries = sortedRawEntries.slice(0, METRICS_MAX_OBJECT_KEYS);

    const resultObj: Record<string, unknown> = {};
    const usedKeys = new Set<string>();

    for (const [rawKey, rawValue] of boundedEntries) {
      let safeKey = truncateString(rawKey, METRICS_MAX_KEY_LENGTH, onTruncate);

      // Handle truncated key collisions deterministically
      if (usedKeys.has(safeKey)) {
        if (onTruncate) onTruncate();
        const hashSuffix = `:h${hashString(rawKey).slice(0, 6)}`;
        const baseLen = METRICS_MAX_KEY_LENGTH - hashSuffix.length;
        safeKey = `${rawKey.slice(0, baseLen)}${hashSuffix}`;
      }

      usedKeys.add(safeKey);

      const sanitizedVal = sanitizeMetricsNode(rawValue, depth + 1, onTruncate);
      if (sanitizedVal !== undefined) {
        resultObj[safeKey] = sanitizedVal;
      }
    }
    return resultObj;
  }

  // Omit unsupported/non-serializable types (functions, symbols, undefined)
  if (onTruncate) onTruncate();
  return undefined;
}

function truncateMetricsStrings(metrics: Record<string, unknown>, maxStrLen: number): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(metrics)) {
    if (typeof v === "string") {
      result[k] = truncateString(v, maxStrLen);
    } else if (isPlainObject(v)) {
      result[k] = truncateMetricsStrings(v as Record<string, unknown>, maxStrLen);
    } else if (Array.isArray(v)) {
      result[k] = v.map((item) => (typeof item === "string" ? truncateString(item, maxStrLen) : item));
    } else {
      result[k] = v;
    }
  }
  return result;
}

function sortObjectKeys(obj: unknown): unknown {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys);
  }
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  const sortedObj: Record<string, unknown> = {};
  for (const key of keys) {
    const val = (obj as Record<string, unknown>)[key];
    if (val !== undefined) {
      sortedObj[key] = sortObjectKeys(val);
    }
  }
  return sortedObj;
}

export function toCanonicalJson(obj: unknown): string {
  return JSON.stringify(sortObjectKeys(obj));
}

function sanitizeProvenance(rawProv?: unknown, onTruncate?: () => void): ProvenanceRef[] {
  if (!Array.isArray(rawProv)) return [];
  const seen = new Set<string>();
  const result: ProvenanceRef[] = [];

  for (const p of rawProv) {
    if (!isPlainObject(p)) continue;
    const sourceType = truncateString(String(p.source_type ?? "UNKNOWN"), 100, onTruncate);
    const sourceId = truncateString(String(p.source_id ?? "UNKNOWN"), 100, onTruncate);
    const url = p.url ? truncateString(String(p.url), LIMIT_URL_TEXT, onTruncate) : "";
    const key = `${sourceType}:${sourceId}:${url}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const ref: ProvenanceRef = {
      source_type: sourceType,
      source_id: sourceId,
    };
    if (url) ref.url = url;
    if (p.published_at) ref.published_at = truncateString(String(p.published_at), 100, onTruncate);
    if (p.publisher) ref.publisher = truncateString(String(p.publisher), LIMIT_GENERAL_TEXT, onTruncate);
    if (p.title) ref.title = truncateString(String(p.title), LIMIT_TITLE_TEXT, onTruncate);
    if (p.locator) ref.locator = truncateString(String(p.locator), LIMIT_GENERAL_TEXT, onTruncate);

    result.push(ref);
  }

  // Sort provenance deterministically with stable tie-breaks
  result.sort((a, b) => {
    const s1 = `${a.source_type}:${a.source_id}:${a.url ?? ""}:${a.title ?? ""}`;
    const s2 = `${b.source_type}:${b.source_id}:${b.url ?? ""}:${b.title ?? ""}`;
    return s1.localeCompare(s2);
  });

  return result.slice(0, MAX_PROVENANCE_PER_ITEM);
}

function mergeProvenance(a: ProvenanceRef[], b: ProvenanceRef[], onTruncate?: () => void): ProvenanceRef[] {
  return sanitizeProvenance([...a, ...b], onTruncate);
}

function computeGroupingKey(item: Record<string, unknown>, onTruncate?: () => void): string {
  if (typeof item.grouping_key === "string" && item.grouping_key.trim()) return truncateString(item.grouping_key.trim(), 200, onTruncate);
  if (typeof item.event_occurrence_key === "string" && item.event_occurrence_key.trim()) return truncateString(item.event_occurrence_key.trim(), 200, onTruncate);
  if (typeof item.macro_release_id === "string" && item.macro_release_id.trim()) return truncateString(item.macro_release_id.trim(), 200, onTruncate);
  if (typeof item.ticker_date_key === "string" && item.ticker_date_key.trim()) return truncateString(item.ticker_date_key.trim(), 200, onTruncate);
  if (typeof item.subject_date_key === "string" && item.subject_date_key.trim()) return truncateString(item.subject_date_key.trim(), 200, onTruncate);
  const text = String(item.claim_or_fact ?? item.claim_or_question ?? "");
  return `hash:${hashString(text.trim().toLowerCase())}`;
}

function validateThesisLedger(ledger: unknown, onTruncate?: () => void): ThesisLedger {
  if (!isPlainObject(ledger)) {
    throw new Error("Invalid thesis_ledger: expected plain object.");
  }
  const contractVersion = ledger.contract_version ?? THESIS_LEDGER_CONTRACT_VERSION;
  if (contractVersion !== THESIS_LEDGER_CONTRACT_VERSION) {
    throw new Error(`Invalid thesis_ledger contract_version: expected "${THESIS_LEDGER_CONTRACT_VERSION}", got "${String(contractVersion)}".`);
  }
  if (!Array.isArray(ledger.entries)) {
    throw new Error("Invalid thesis_ledger: entries must be an array.");
  }

  const validatedEntries: ThesisLedgerEntry[] = ledger.entries.map((e, idx) => {
    if (!isPlainObject(e)) {
      throw new Error(`Invalid thesis_ledger entry at index ${idx}: expected plain object.`);
    }
    if (typeof e.thesis_id !== "string" || !e.thesis_id.trim()) {
      throw new Error(`Invalid thesis_id at index ${idx}.`);
    }
    if (typeof e.title !== "string" || typeof e.statement !== "string") {
      throw new Error(`Invalid title or statement at index ${idx}.`);
    }
    if (!VALID_THESIS_STATES.has(e.state as ThesisState)) {
      throw new Error(`Invalid thesis state "${String(e.state)}" at index ${idx}.`);
    }
    if (typeof e.version !== "number" || e.version < 1) {
      throw new Error(`Invalid version number at index ${idx}.`);
    }
    if (!isValidIsoTimestamp(e.created_at) || !isValidIsoTimestamp(e.updated_at)) {
      throw new Error(`Invalid created_at or updated_at timestamp at index ${idx}.`);
    }
    if (!Array.isArray(e.lineage)) {
      throw new Error(`Invalid lineage array at index ${idx}.`);
    }

    if (e.lineage.length > MAX_THESIS_LINEAGE_ITEMS) {
      if (onTruncate) onTruncate();
    }
    const boundedLineage = e.lineage.slice(0, MAX_THESIS_LINEAGE_ITEMS).map((lin) => truncateString(String(lin), 100, onTruncate));

    const entry: ThesisLedgerEntry = {
      thesis_id: truncateString(e.thesis_id as string, 100, onTruncate),
      contract_version: (e.contract_version as string) ?? THESIS_LEDGER_CONTRACT_VERSION,
      title: truncateString(e.title as string, LIMIT_TITLE_TEXT, onTruncate),
      statement: truncateString(e.statement as string, LIMIT_CLAIM_TEXT, onTruncate),
      state: e.state as ThesisState,
      version: e.version as number,
      created_at: e.created_at as string,
      updated_at: e.updated_at as string,
      lineage: boundedLineage,
    };

    if (Array.isArray(e.arguments)) {
      const allArgs: ThesisArgument[] = [];
      for (let argIdx = 0; argIdx < e.arguments.length; argIdx++) {
        const arg = e.arguments[argIdx];
        if (!isPlainObject(arg) || typeof arg.arg_id !== "string" || typeof arg.text !== "string" || (arg.type !== "supporting" && arg.type !== "counter")) {
          throw new Error(`Invalid thesis argument at entry ${idx}, arg ${argIdx}.`);
        }
        allArgs.push({
          arg_id: truncateString(arg.arg_id, 100, onTruncate),
          type: arg.type,
          text: truncateString(arg.text, LIMIT_CLAIM_TEXT, onTruncate),
        });
      }

      // Sort ALL arguments deterministically BEFORE capping to MAX_THESIS_ARGUMENTS
      allArgs.sort((a, b) => a.arg_id.localeCompare(b.arg_id) || a.type.localeCompare(b.type) || a.text.localeCompare(b.text));

      if (allArgs.length > MAX_THESIS_ARGUMENTS) {
        if (onTruncate) onTruncate();
      }

      entry.arguments = allArgs.slice(0, MAX_THESIS_ARGUMENTS);
    }

    return entry;
  });

  validatedEntries.sort((a, b) => a.thesis_id.localeCompare(b.thesis_id) || a.title.localeCompare(b.title));

  return {
    contract_version: contractVersion as string,
    entries: validatedEntries,
  };
}

function isAdmissibleEvidence(raw: Record<string, unknown>): boolean {
  const prov = sanitizeProvenance(raw.provenance);
  if (prov.length === 0) return false;

  const sourceType = String(raw.source_type ?? "").trim().toUpperCase();
  const category = String(raw.category ?? "").trim().toUpperCase();

  if (FORBIDDEN_EVIDENCE_SOURCES.has(sourceType) || FORBIDDEN_EVIDENCE_SOURCES.has(category)) {
    return false;
  }

  if (raw.is_admitted_fact === false) return false;

  if (PRIMARY_DIRECT_FACTUAL_SOURCES.has(sourceType) || PRIMARY_DIRECT_FACTUAL_SOURCES.has(category)) {
    return true;
  }

  if (raw.is_admitted_fact === true) return true;

  const ancestryCount = typeof raw.independent_ancestry_count === "number" ? raw.independent_ancestry_count : 0;
  if (ancestryCount >= 2) return true;

  return false;
}

export function assembleDossierV2InputPacket(
  rawRequest: DossierV2InputRequest,
  rawSnapshot: CandidateSnapshot,
): DossierV2InputPacket {
  if (!isPlainObject(rawRequest)) {
    throw new Error("Invalid request: expected plain object.");
  }
  if (!isPlainObject(rawSnapshot)) {
    throw new Error("Invalid snapshot: expected plain object.");
  }

  const request = rawRequest;
  const snapshot = rawSnapshot;

  if (request.contract_version && request.contract_version !== INPUT_PACKET_CONTRACT_VERSION) {
    throw new Error(`Invalid contract_version: expected "${INPUT_PACKET_CONTRACT_VERSION}", got "${String(request.contract_version)}".`);
  }

  if (!isValidIsoTimestamp(request.as_of)) {
    throw new Error(`Invalid as_of timestamp: expected ISO string, got "${String(request.as_of)}".`);
  }

  const asOf = request.as_of;
  const asOfMs = Date.parse(asOf);
  const windowStartMs = asOfMs - 24 * 60 * 60 * 1000;

  const previousDossierId = request.previous_dossier_id ?? null;
  if (previousDossierId !== null && !isValidUuid(previousDossierId)) {
    throw new Error(`Invalid previous_dossier_id: expected UUID string or null, got "${String(previousDossierId)}".`);
  }

  if (previousDossierId === null) {
    if (request.previous_dossier) {
      throw new Error("Invalid request: previous_dossier state supplied when previous_dossier_id is null.");
    }
  } else {
    if (request.previous_dossier && isPlainObject(request.previous_dossier)) {
      if (request.previous_dossier.id !== previousDossierId) {
        throw new Error(`Invalid request: previous_dossier.id "${request.previous_dossier.id}" does not match previous_dossier_id "${previousDossierId}".`);
      }
      if (!isValidIsoTimestamp(request.previous_dossier.as_of)) {
        throw new Error(`Invalid prior dossier: as_of timestamp is invalid.`);
      }
      if (Date.parse(request.previous_dossier.as_of) > asOfMs) {
        throw new Error(`Invalid prior dossier: as_of "${request.previous_dossier.as_of}" is future-dated relative to request as_of "${asOf}".`);
      }
    }
  }

  let truncationOccurred = false;
  const markTruncated = () => {
    truncationOccurred = true;
  };

  const notes: string[] = [];
  const freshnessWarnings: FreshnessWarning[] = [];
  const researchGaps: ResearchGap[] = [];

  let omittedClustersCount = 0;
  let omittedEvidenceCount = 0;
  let omittedLeadsCount = 0;
  let omittedCreatorThemesCount = 0;
  let omittedCreatorClaimsCount = 0;
  let omittedCatalystsCount = 0;
  let omittedPriorClaimsCount = 0;
  let omittedThesisEntriesCount = 0;
  let omittedResearchGapsCount = 0;

  const priceData = snapshot.price_data as SourceDataStatus | undefined;
  if (priceData) {
    if (priceData.status === "STALE") {
      freshnessWarnings.push({
        source_name: "price_data",
        last_available_at: priceData.available_at,
        message: "Price data is stale.",
      });
    } else if (priceData.status === "MISSING" || priceData.status === "FAILED") {
      researchGaps.push({
        gap_id: `gap:price_data:${hashString(asOf)}`,
        category: "PRICE_DATA",
        description: "Price data unavailable or failed for this run window.",
        severity: "MATERIAL",
      });
    }
  } else {
    researchGaps.push({
      gap_id: `gap:price_data:${hashString(asOf)}`,
      category: "PRICE_DATA",
      description: "Price data not provided in candidate snapshot.",
      severity: "INFORMATIONAL",
    });
  }

  const macroData = snapshot.macro_data as SourceDataStatus | undefined;
  if (macroData) {
    if (macroData.status === "STALE") {
      freshnessWarnings.push({
        source_name: "macro_data",
        last_available_at: macroData.available_at,
        message: "Macro data is stale.",
      });
    } else if (macroData.status === "MISSING" || macroData.status === "FAILED") {
      researchGaps.push({
        gap_id: `gap:macro_data:${hashString(asOf)}`,
        category: "MACRO_DATA",
        description: "Macro data unavailable or failed for this run window.",
        severity: "MATERIAL",
      });
    }
  } else {
    researchGaps.push({
      gap_id: `gap:macro_data:${hashString(asOf)}`,
      category: "MACRO_DATA",
      description: "Macro data not provided in candidate snapshot.",
      severity: "INFORMATIONAL",
    });
  }

  if (snapshot.sources_status) {
    for (const [srcName, statusObj] of Object.entries(snapshot.sources_status)) {
      if (statusObj && (statusObj.status === "STALE" || statusObj.status === "WARNING")) {
        freshnessWarnings.push({
          source_name: truncateString(srcName, 100, markTruncated),
          last_available_at: statusObj.available_at,
          message: truncateString(statusObj.message ?? `Source ${srcName} reported status ${statusObj.status}.`, LIMIT_GENERAL_TEXT, markTruncated),
        });
      }
    }
  }

  if (previousDossierId === null) {
    notes.push("First run initialized: previous_dossier_id is explicitly null.");
  } else {
    if (!request.previous_dossier || typeof request.previous_dossier !== "object") {
      researchGaps.push({
        gap_id: `gap:previous_dossier:${previousDossierId}`,
        category: "PRIOR_DOSSIER",
        description: `Previous dossier ${previousDossierId} requested but decoded state was unavailable.`,
        severity: "MATERIAL",
      });
    }
  }

  const candidateEvidence = Array.isArray(snapshot.observed_evidence) ? snapshot.observed_evidence : [];
  const candidateLeadsList = Array.isArray(snapshot.research_leads) ? [...snapshot.research_leads] : [];

  const eligibleCandidateEvidence: Array<{
    raw: Record<string, unknown>;
    ev: ObservedEvidence & { grouping_key: string; conflict_key?: string; supersedes_id?: string };
  }> = [];

  for (const raw of candidateEvidence) {
    if (!isPlainObject(raw)) continue;
    if (!isValidIsoTimestamp(raw.available_at)) continue;

    const availMs = Date.parse(raw.available_at as string);
    if (availMs > asOfMs || availMs < windowStartMs) {
      omittedEvidenceCount++;
      continue;
    }

    const claimText = truncateString(String(raw.claim_or_fact ?? raw.text ?? "").trim(), LIMIT_CLAIM_TEXT, markTruncated);
    if (!claimText) continue;

    if (!isAdmissibleEvidence(raw)) {
      if (raw.claim_or_question || raw.is_lead) {
        candidateLeadsList.push({
          ...raw,
          claim_or_question: String(raw.claim_or_question ?? claimText),
        });
      } else {
        omittedEvidenceCount++;
        notes.push(`Candidate item "${claimText.slice(0, 30)}..." omitted from observed_evidence due to strict admission rules.`);
      }
      continue;
    }

    const groupingKey = computeGroupingKey(raw, markTruncated);
    const evId = typeof raw.evidence_id === "string" && raw.evidence_id ? truncateString(raw.evidence_id, 100, markTruncated) : `ev:${hashString(`${groupingKey}:${claimText}`)}`;
    const conflictKey = typeof raw.conflict_key === "string" && raw.conflict_key.trim() ? truncateString(raw.conflict_key.trim(), 100, markTruncated) : (typeof raw.comparable_observation_key === "string" && raw.comparable_observation_key.trim() ? truncateString(raw.comparable_observation_key.trim(), 100, markTruncated) : undefined);
    const supersedesId = typeof raw.supersedes_evidence_id === "string" && raw.supersedes_evidence_id ? truncateString(raw.supersedes_evidence_id, 100, markTruncated) : (typeof raw.supersedes_id === "string" && raw.supersedes_id ? truncateString(raw.supersedes_id, 100, markTruncated) : undefined);
    const sanitizedMetrics = sanitizeMetrics(raw.metrics, 1, markTruncated);

    eligibleCandidateEvidence.push({
      raw,
      ev: {
        evidence_id: evId,
        epistemic_label: "OBSERVED",
        claim_or_fact: claimText,
        category: truncateString(String(raw.category ?? "GENERAL"), 100, markTruncated),
        source_type: truncateString(String(raw.source_type ?? "FACT"), 100, markTruncated),
        available_at: raw.available_at as string,
        occurrence_time: typeof raw.occurrence_time === "string" ? raw.occurrence_time : undefined,
        metrics: sanitizedMetrics,
        provenance: sanitizeProvenance(raw.provenance, markTruncated),
        rank: typeof raw.rank === "number" ? raw.rank : undefined,
        grouping_key: groupingKey,
        conflict_key: conflictKey,
        supersedes_id: supersedesId,
      },
    });
  }

  const directSupersedesMap = new Map<string, string>();
  for (const { ev } of eligibleCandidateEvidence) {
    if (ev.supersedes_id) {
      if (ev.supersedes_id === ev.evidence_id) {
        notes.push(`Self-supersession detected for item "${ev.evidence_id}"; ignored.`);
      } else {
        directSupersedesMap.set(ev.evidence_id, ev.supersedes_id);
      }
    }
  }

  const validSupersedesMap = new Map<string, string>();
  for (const [childId, parentId] of directSupersedesMap.entries()) {
    let curr: string | undefined = parentId;
    const visited = new Set<string>([childId]);
    let hasCycle = false;

    while (curr) {
      if (visited.has(curr)) {
        hasCycle = true;
        break;
      }
      visited.add(curr);
      curr = directSupersedesMap.get(curr);
    }

    if (hasCycle) {
      notes.push(`Supersession cycle detected involving "${childId}"; supersession link ignored.`);
    } else {
      validSupersedesMap.set(childId, parentId);
    }
  }

  const suppressedIds = new Set<string>();
  const transitiveAncestryMap = new Map<string, string[]>();

  for (const [childId] of validSupersedesMap.entries()) {
    const ancestors: string[] = [];
    let curr: string | undefined = validSupersedesMap.get(childId);
    while (curr) {
      suppressedIds.add(curr);
      ancestors.push(curr);
      curr = validSupersedesMap.get(curr);
    }
    transitiveAncestryMap.set(childId, ancestors);
  }

  const activeAdmittedEvidence = eligibleCandidateEvidence
    .map(({ ev }) => ev)
    .filter((ev) => !suppressedIds.has(ev.evidence_id));

  for (const ev of activeAdmittedEvidence) {
    const ancestors = transitiveAncestryMap.get(ev.evidence_id);
    if (ancestors && ancestors.length > 0) {
      ev.superseded_evidence_ids = Array.from(new Set(ancestors)).sort();
    }
  }

  const evidenceByGroup = new Map<string, Array<ObservedEvidence & { grouping_key: string; conflict_key?: string }>>();
  for (const ev of activeAdmittedEvidence) {
    const list = evidenceByGroup.get(ev.grouping_key) ?? [];
    list.push(ev);
    evidenceByGroup.set(ev.grouping_key, list);
  }

  const processedEvidenceByGroup = new Map<string, ObservedEvidence[]>();
  for (const [gKey, evList] of evidenceByGroup.entries()) {
    const textMap = new Map<string, ObservedEvidence & { grouping_key: string; conflict_key?: string }>();
    for (const item of evList) {
      const normText = item.claim_or_fact.trim().toLowerCase();
      const existing = textMap.get(normText);
      if (existing) {
        existing.provenance = mergeProvenance(existing.provenance, item.provenance, markTruncated);
      } else {
        textMap.set(normText, { ...item });
      }
    }

    const uniqueFacts = Array.from(textMap.values());

    const conflictKeyMap = new Map<string, Array<ObservedEvidence & { grouping_key: string; conflict_key?: string }>>();
    for (const f of uniqueFacts) {
      if (f.conflict_key) {
        const list = conflictKeyMap.get(f.conflict_key) ?? [];
        list.push(f);
        conflictKeyMap.set(f.conflict_key, list);
      }
    }

    for (const [cKey, confList] of conflictKeyMap.entries()) {
      if (confList.length > 1) {
        const conflictGroupId = `conflict:${hashString(`${gKey}:${cKey}`)}`;
        for (const f of confList) {
          f.conflict_group_id = conflictGroupId;
        }
      }
    }

    const cleanFacts: ObservedEvidence[] = uniqueFacts.map((uf) => {
      const { grouping_key: _, conflict_key: __, supersedes_id: ___, ...rest } = uf as ObservedEvidence & { grouping_key?: unknown; conflict_key?: unknown; supersedes_id?: unknown };
      return rest;
    });

    processedEvidenceByGroup.set(gKey, cleanFacts);
  }

  const rawAdmittedLeads: Array<ResearchLead & { grouping_key: string; conflict_key?: string }> = [];

  for (const raw of candidateLeadsList) {
    if (!isPlainObject(raw)) continue;
    if (!isValidIsoTimestamp(raw.available_at)) continue;

    const availMs = Date.parse(raw.available_at as string);
    if (availMs > asOfMs || availMs < windowStartMs) {
      omittedLeadsCount++;
      continue;
    }

    const questionText = truncateString(String(raw.claim_or_question ?? "").trim(), LIMIT_CLAIM_TEXT, markTruncated);
    if (!questionText) continue;

    const groupingKey = computeGroupingKey(raw, markTruncated);
    const leadId = typeof raw.lead_id === "string" && raw.lead_id ? truncateString(raw.lead_id, 100, markTruncated) : `lead:${hashString(`${groupingKey}:${questionText}`)}`;
    const conflictKey = typeof raw.conflict_key === "string" && raw.conflict_key.trim() ? truncateString(raw.conflict_key.trim(), 100, markTruncated) : undefined;

    rawAdmittedLeads.push({
      lead_id: leadId,
      claim_or_question: questionText,
      source_type: truncateString(String(raw.source_type ?? "LEAD"), 100, markTruncated),
      available_at: raw.available_at as string,
      urgency: raw.urgency === "HIGH" || raw.urgency === "MEDIUM" || raw.urgency === "LOW" ? raw.urgency : "MEDIUM",
      provenance: sanitizeProvenance(raw.provenance, markTruncated),
      rank: typeof raw.rank === "number" ? raw.rank : undefined,
      grouping_key: groupingKey,
      conflict_key: conflictKey,
    });
  }

  const leadsByGroup = new Map<string, Array<ResearchLead & { grouping_key: string; conflict_key?: string }>>();
  for (const ld of rawAdmittedLeads) {
    const list = leadsByGroup.get(ld.grouping_key) ?? [];
    list.push(ld);
    leadsByGroup.set(ld.grouping_key, list);
  }

  const processedLeadsByGroup = new Map<string, ResearchLead[]>();
  for (const [gKey, ldList] of leadsByGroup.entries()) {
    const textMap = new Map<string, ResearchLead & { grouping_key: string; conflict_key?: string }>();
    for (const item of ldList) {
      const normText = item.claim_or_question.trim().toLowerCase();
      const existing = textMap.get(normText);
      if (existing) {
        existing.provenance = mergeProvenance(existing.provenance, item.provenance, markTruncated);
      } else {
        textMap.set(normText, { ...item });
      }
    }

    const uniqueLeads = Array.from(textMap.values());

    const conflictKeyMap = new Map<string, Array<ResearchLead & { grouping_key: string; conflict_key?: string }>>();
    for (const l of uniqueLeads) {
      if (l.conflict_key) {
        const list = conflictKeyMap.get(l.conflict_key) ?? [];
        list.push(l);
        conflictKeyMap.set(l.conflict_key, list);
      }
    }

    for (const [cKey, confList] of conflictKeyMap.entries()) {
      if (confList.length > 1) {
        const conflictGroupId = `conflict:${hashString(`${gKey}:${cKey}`)}`;
        for (const l of confList) {
          l.conflict_group_id = conflictGroupId;
        }
      }
    }

    const cleanLeads: ResearchLead[] = uniqueLeads.map((ul) => {
      const { grouping_key: _, conflict_key: __, ...rest } = ul as ResearchLead & { grouping_key?: unknown; conflict_key?: unknown };
      return rest;
    });

    processedLeadsByGroup.set(gKey, cleanLeads);
  }

  const allGroupingKeys = Array.from(new Set([...processedEvidenceByGroup.keys(), ...processedLeadsByGroup.keys()])).sort();

  const candidateClusters: DevelopmentCluster[] = allGroupingKeys.map((gKey) => {
    let evList = processedEvidenceByGroup.get(gKey) ?? [];
    let ldList = processedLeadsByGroup.get(gKey) ?? [];

    evList = evList.sort((a, b) => {
      const rankA = a.rank ?? 999;
      const rankB = b.rank ?? 999;
      if (rankA !== rankB) return rankA - rankB;
      const tComp = b.available_at.localeCompare(a.available_at);
      if (tComp !== 0) return tComp;
      return a.evidence_id.localeCompare(b.evidence_id);
    });

    if (evList.length > MAX_EVIDENCE_PER_CLUSTER) {
      omittedEvidenceCount += evList.length - MAX_EVIDENCE_PER_CLUSTER;
      evList = evList.slice(0, MAX_EVIDENCE_PER_CLUSTER);
    }

    ldList = ldList.sort((a, b) => {
      const rankA = a.rank ?? 999;
      const rankB = b.rank ?? 999;
      if (rankA !== rankB) return rankA - rankB;
      const tComp = b.available_at.localeCompare(a.available_at);
      if (tComp !== 0) return tComp;
      return a.lead_id.localeCompare(b.lead_id);
    });

    if (ldList.length > MAX_LEADS_PER_CLUSTER) {
      omittedLeadsCount += ldList.length - MAX_LEADS_PER_CLUSTER;
      ldList = ldList.slice(0, MAX_LEADS_PER_CLUSTER);
    }

    const clusterTitle = truncateString(evList[0]?.claim_or_fact ?? ldList[0]?.claim_or_question ?? `Cluster ${gKey}`, LIMIT_TITLE_TEXT, markTruncated);
    const conflictId = evList.find((e) => e.conflict_group_id)?.conflict_group_id ?? ldList.find((l) => l.conflict_group_id)?.conflict_group_id;

    return {
      cluster_id: `cluster:${hashString(gKey)}`,
      grouping_key: gKey,
      title: clusterTitle,
      evidence: evList,
      leads: ldList,
      conflict_group_id: conflictId,
    };
  });

  candidateClusters.sort((a, b) => {
    const minRankA = Math.min(...a.evidence.map((e) => e.rank ?? 999), ...a.leads.map((l) => l.rank ?? 999), 999);
    const minRankB = Math.min(...b.evidence.map((e) => e.rank ?? 999), ...b.leads.map((l) => l.rank ?? 999), 999);
    if (minRankA !== minRankB) return minRankA - minRankB;

    const maxTimeA = a.evidence[0]?.available_at ?? a.leads[0]?.available_at ?? "";
    const maxTimeB = b.evidence[0]?.available_at ?? b.leads[0]?.available_at ?? "";
    const tComp = maxTimeB.localeCompare(maxTimeA);
    if (tComp !== 0) return tComp;

    return a.grouping_key.localeCompare(b.grouping_key);
  });

  let developmentClusters = candidateClusters;
  if (developmentClusters.length > MAX_DEVELOPMENT_CLUSTERS) {
    developmentClusters = selectBalancedDevelopmentClusters(candidateClusters);
    const selectedClusterIds = new Set(developmentClusters.map((cluster) => cluster.cluster_id));
    const omittedClusters = candidateClusters.filter((cluster) => !selectedClusterIds.has(cluster.cluster_id));
    omittedClustersCount += omittedClusters.length;
    for (const omittedCluster of omittedClusters) {
      omittedEvidenceCount += omittedCluster.evidence.length;
      omittedLeadsCount += omittedCluster.leads.length;
    }
    notes.push(
      `Balanced cluster selection retained ${developmentClusters.filter(isMarketMonitorCluster).length} market-monitor clusters and ${developmentClusters.filter((cluster) => !isMarketMonitorCluster(cluster)).length} non-monitor research clusters.`,
    );
  }

  let observedEvidence: ObservedEvidence[] = [];
  let researchLeads: ResearchLead[] = [];

  for (const c of developmentClusters) {
    observedEvidence.push(...c.evidence);
    researchLeads.push(...c.leads);
  }

  observedEvidence = Array.from(new Map(observedEvidence.map((e) => [e.evidence_id, e])).values()).sort((a, b) => {
    const rankA = a.rank ?? 999;
    const rankB = b.rank ?? 999;
    if (rankA !== rankB) return rankA - rankB;
    const tComp = b.available_at.localeCompare(a.available_at);
    if (tComp !== 0) return tComp;
    return a.evidence_id.localeCompare(b.evidence_id);
  });

  if (observedEvidence.length > MAX_TOTAL_OBSERVED_EVIDENCE) {
    omittedEvidenceCount += observedEvidence.length - MAX_TOTAL_OBSERVED_EVIDENCE;
    observedEvidence = observedEvidence.slice(0, MAX_TOTAL_OBSERVED_EVIDENCE);
  }

  researchLeads = Array.from(new Map(researchLeads.map((l) => [l.lead_id, l])).values()).sort((a, b) => {
    const rankA = a.rank ?? 999;
    const rankB = b.rank ?? 999;
    if (rankA !== rankB) return rankA - rankB;
    const tComp = b.available_at.localeCompare(a.available_at);
    if (tComp !== 0) return tComp;
    return a.lead_id.localeCompare(b.lead_id);
  });

  const rawThemes = Array.isArray(snapshot.creator_themes) ? snapshot.creator_themes : [];
  const processedThemes: CreatorTheme[] = [];

  for (const t of rawThemes) {
    if (!isPlainObject(t)) continue;
    const themeName = truncateString(String(t.theme_name ?? "").trim(), LIMIT_TITLE_TEXT, markTruncated);
    if (!themeName) continue;

    const rawClaims = Array.isArray(t.claims) ? t.claims : [];
    const validClaims: CreatorThemeClaim[] = [];

    for (const c of rawClaims) {
      if (!isPlainObject(c)) continue;
      if (!isValidIsoTimestamp(c.available_at)) continue;
      const availMs = Date.parse(c.available_at as string);
      if (availMs > asOfMs || availMs < windowStartMs) {
        omittedCreatorClaimsCount++;
        continue;
      }

      const claimText = truncateString(String(c.text ?? "").trim(), LIMIT_CLAIM_TEXT, markTruncated);
      if (!claimText) continue;

      const claimId = typeof c.claim_id === "string" && c.claim_id ? truncateString(c.claim_id, 100, markTruncated) : `claim:${hashString(`${themeName}:${claimText}`)}`;
      validClaims.push({
        claim_id: claimId,
        text: claimText,
        creator_id: c.creator_id ? truncateString(String(c.creator_id), 100, markTruncated) : undefined,
        available_at: c.available_at as string,
        provenance: sanitizeProvenance(c.provenance, markTruncated),
      });
    }

    validClaims.sort((a, b) => b.available_at.localeCompare(a.available_at) || a.claim_id.localeCompare(b.claim_id) || a.text.localeCompare(b.text));

    let themeClaims = validClaims;
    if (themeClaims.length > MAX_CREATOR_CLAIMS_PER_THEME) {
      omittedCreatorClaimsCount += themeClaims.length - MAX_CREATOR_CLAIMS_PER_THEME;
      themeClaims = themeClaims.slice(0, MAX_CREATOR_CLAIMS_PER_THEME);
    }

    processedThemes.push({
      theme_id: typeof t.theme_id === "string" && t.theme_id ? truncateString(t.theme_id, 100, markTruncated) : `theme:${hashString(themeName)}`,
      theme_name: themeName,
      expand_later: Boolean(t.expand_later),
      claims: themeClaims,
    });
  }

  processedThemes.sort((a, b) => a.theme_name.localeCompare(b.theme_name) || a.theme_id.localeCompare(b.theme_id));

  let expandLaterCount = 0;
  for (const th of processedThemes) {
    if (th.expand_later) {
      if (expandLaterCount >= MAX_CREATOR_EXPAND_LATER) {
        th.expand_later = false;
        notes.push(`Creator theme "${th.theme_name}" expand_later flag demoted due to max limit of ${MAX_CREATOR_EXPAND_LATER}.`);
      } else {
        expandLaterCount++;
      }
    }
  }

  let creatorThemes = processedThemes;
  if (creatorThemes.length > MAX_CREATOR_THEMES) {
    omittedCreatorThemesCount += creatorThemes.length - MAX_CREATOR_THEMES;
    const omitted = creatorThemes.slice(MAX_CREATOR_THEMES);
    for (const ot of omitted) {
      omittedCreatorClaimsCount += ot.claims.length;
    }
    creatorThemes = creatorThemes.slice(0, MAX_CREATOR_THEMES);
  }

  const rawCatalysts = Array.isArray(snapshot.catalysts) ? snapshot.catalysts : [];
  const validCatalysts: CatalystItem[] = [];

  for (const cat of rawCatalysts) {
    if (!isPlainObject(cat)) continue;
    if (!isValidIsoTimestamp(cat.available_at)) continue;

    const availMs = Date.parse(cat.available_at as string);
    if (availMs > asOfMs) {
      omittedCatalystsCount++;
      continue;
    }

    if (!isValidIsoTimestamp(cat.event_time)) {
      omittedCatalystsCount++;
      notes.push(`Catalyst "${String(cat.title ?? "").slice(0, 30)}..." omitted due to missing or invalid event_time.`);
      continue;
    }

    const eventTimeStr = cat.event_time as string;
    const eventTimeMs = Date.parse(eventTimeStr);

    if (eventTimeMs < asOfMs || eventTimeMs > asOfMs + CATALYST_FORWARD_HORIZON_MS) {
      omittedCatalystsCount++;
      continue;
    }

    const titleText = truncateString(String(cat.title ?? "").trim(), LIMIT_TITLE_TEXT, markTruncated);
    if (!titleText) continue;

    const catId = typeof cat.catalyst_id === "string" && cat.catalyst_id ? truncateString(cat.catalyst_id, 100, markTruncated) : `cat:${hashString(titleText)}`;

    validCatalysts.push({
      catalyst_id: catId,
      title: titleText,
      event_time: eventTimeStr,
      available_at: cat.available_at as string,
      impact_level: cat.impact_level === "HIGH" || cat.impact_level === "MEDIUM" || cat.impact_level === "LOW" ? cat.impact_level : "MEDIUM",
      provenance: sanitizeProvenance(cat.provenance, markTruncated),
      rank: typeof cat.rank === "number" ? cat.rank : undefined,
    });
  }

  validCatalysts.sort((a, b) => {
    const eComp = a.event_time.localeCompare(b.event_time);
    if (eComp !== 0) return eComp;
    const rankA = a.rank ?? 999;
    const rankB = b.rank ?? 999;
    if (rankA !== rankB) return rankA - rankB;
    return a.catalyst_id.localeCompare(b.catalyst_id);
  });

  let catalysts = validCatalysts;
  if (catalysts.length > MAX_CATALYSTS) {
    omittedCatalystsCount += catalysts.length - MAX_CATALYSTS;
    catalysts = catalysts.slice(0, MAX_CATALYSTS);
  }

  let priorClaims: PriorAnalyticalClaim[] = [];
  let prevDossierAsOf: string | null = null;
  let activeThesisLedger: ThesisLedger | null = null;

  if (request.previous_dossier && isPlainObject(request.previous_dossier)) {
    prevDossierAsOf = isValidIsoTimestamp(request.previous_dossier.as_of) ? request.previous_dossier.as_of : null;

    if (Array.isArray(request.previous_dossier.prior_claims)) {
      for (const pc of request.previous_dossier.prior_claims) {
        if (!isPlainObject(pc)) continue;
        const claimText = truncateString(String(pc.claim_text ?? "").trim(), LIMIT_CLAIM_TEXT, markTruncated);
        if (!claimText) continue;

        const claimAsOf = isValidIsoTimestamp(pc.as_of) ? (pc.as_of as string) : (prevDossierAsOf ?? asOf);
        if (Date.parse(claimAsOf) > asOfMs) {
          omittedPriorClaimsCount++;
          continue;
        }

        const epistemicLabel = pc.epistemic_label;
        if (epistemicLabel !== "OBSERVED" && epistemicLabel !== "SUPPORTED" && epistemicLabel !== "INFERRED" && epistemicLabel !== "SPECULATIVE") {
          continue;
        }

        priorClaims.push({
          claim_id: typeof pc.claim_id === "string" && pc.claim_id ? truncateString(pc.claim_id, 100, markTruncated) : `pc:${hashString(claimText)}`,
          epistemic_label: epistemicLabel,
          claim_text: claimText,
          dossier_id: typeof pc.dossier_id === "string" && pc.dossier_id ? truncateString(pc.dossier_id, 100, markTruncated) : (previousDossierId ?? "prior"),
          as_of: claimAsOf,
          provenance: sanitizeProvenance(pc.provenance, markTruncated),
        });
      }
    }

    if (request.previous_dossier.thesis_ledger) {
      activeThesisLedger = validateThesisLedger(request.previous_dossier.thesis_ledger, markTruncated);
    }
  }

  if (!activeThesisLedger && snapshot.thesis_ledger) {
    activeThesisLedger = validateThesisLedger(snapshot.thesis_ledger, markTruncated);
  }

  priorClaims.sort((a, b) => a.claim_text.localeCompare(b.claim_text) || a.claim_id.localeCompare(b.claim_id));
  if (priorClaims.length > MAX_PRIOR_CLAIMS) {
    omittedPriorClaimsCount += priorClaims.length - MAX_PRIOR_CLAIMS;
    priorClaims = priorClaims.slice(0, MAX_PRIOR_CLAIMS);
  }

  if (activeThesisLedger) {
    activeThesisLedger = JSON.parse(JSON.stringify(activeThesisLedger)) as ThesisLedger;
    if (activeThesisLedger.entries.length > MAX_THESIS_LEDGER_ENTRIES) {
      omittedThesisEntriesCount += activeThesisLedger.entries.length - MAX_THESIS_LEDGER_ENTRIES;
      activeThesisLedger.entries = activeThesisLedger.entries.slice(0, MAX_THESIS_LEDGER_ENTRIES);
    }
  }

  for (const gap of researchGaps) {
    gap.category = truncateString(gap.category, 100, markTruncated);
    gap.description = truncateString(gap.description, LIMIT_GENERAL_TEXT, markTruncated);
  }

  researchGaps.sort((a, b) => a.gap_id.localeCompare(b.gap_id));
  let finalResearchGaps = researchGaps;
  if (finalResearchGaps.length > MAX_RESEARCH_GAPS) {
    omittedResearchGapsCount += finalResearchGaps.length - MAX_RESEARCH_GAPS;
    finalResearchGaps = finalResearchGaps.slice(0, MAX_RESEARCH_GAPS);
  }

  freshnessWarnings.sort((a, b) => a.source_name.localeCompare(b.source_name));

  const initialDiagnostics: OmissionDiagnostics = {
    omitted_clusters_count: omittedClustersCount,
    omitted_evidence_count: omittedEvidenceCount,
    omitted_leads_count: omittedLeadsCount,
    omitted_creator_themes_count: omittedCreatorThemesCount,
    omitted_creator_claims_count: omittedCreatorClaimsCount,
    omitted_catalysts_count: omittedCatalystsCount,
    omitted_prior_claims_count: omittedPriorClaimsCount,
    omitted_thesis_entries_count: omittedThesisEntriesCount,
    omitted_research_gaps_count: omittedResearchGapsCount,
    byte_limit_truncation_applied: truncationOccurred,
    notes,
  };

  const packetWithoutId: Omit<DossierV2InputPacket, "packet_id"> = {
    contract_version: INPUT_PACKET_CONTRACT_VERSION,
    as_of: asOf,
    previous_dossier_id: previousDossierId,

    observed_evidence: observedEvidence,
    research_leads: researchLeads,
    prior_analytical_state: {
      previous_dossier_id: previousDossierId,
      as_of: prevDossierAsOf,
      prior_claims: priorClaims,
      thesis_ledger: activeThesisLedger,
    },

    development_clusters: developmentClusters,
    creator_themes: creatorThemes,
    catalysts,
    thesis_ledger: activeThesisLedger,

    freshness_warnings: freshnessWarnings,
    research_gaps: finalResearchGaps,
    diagnostics: initialDiagnostics,
  };

  // MULTI-PASS GRACEFUL REDUCTION LOOP (Ensures 200,000-byte ceiling is graceful, NOT fatal)
  const dummyPacketForSizeCheck: DossierV2InputPacket = {
    packet_id: "0".repeat(64), // 64 hex chars for SHA-256
    ...packetWithoutId,
  };

  let canonicalJson = toCanonicalJson(dummyPacketForSizeCheck);
  let byteSize = Buffer.byteLength(canonicalJson, "utf8");

  if (byteSize > MAX_CANONICAL_BYTES) {
    packetWithoutId.diagnostics.byte_limit_truncation_applied = true;

    // Truncation Pass 1: Remove research leads
    while (byteSize > MAX_CANONICAL_BYTES && packetWithoutId.research_leads.length > 0) {
      const removed = packetWithoutId.research_leads.pop();
      if (removed) {
        packetWithoutId.diagnostics.omitted_leads_count++;
        for (const c of packetWithoutId.development_clusters) {
          c.leads = c.leads.filter((l) => l.lead_id !== removed.lead_id);
        }
      }
      dummyPacketForSizeCheck.research_leads = packetWithoutId.research_leads;
      dummyPacketForSizeCheck.development_clusters = packetWithoutId.development_clusters;
      canonicalJson = toCanonicalJson(dummyPacketForSizeCheck);
      byteSize = Buffer.byteLength(canonicalJson, "utf8");
    }

    // Truncation Pass 2: Remove creator theme claims & themes
    while (byteSize > MAX_CANONICAL_BYTES && packetWithoutId.creator_themes.length > 0) {
      const lastTheme = packetWithoutId.creator_themes[packetWithoutId.creator_themes.length - 1];
      if (lastTheme.claims.length > 0) {
        lastTheme.claims.pop();
        packetWithoutId.diagnostics.omitted_creator_claims_count++;
      } else {
        packetWithoutId.creator_themes.pop();
        packetWithoutId.diagnostics.omitted_creator_themes_count++;
      }
      dummyPacketForSizeCheck.creator_themes = packetWithoutId.creator_themes;
      canonicalJson = toCanonicalJson(dummyPacketForSizeCheck);
      byteSize = Buffer.byteLength(canonicalJson, "utf8");
    }

    // Truncation Pass 3: Remove catalysts
    while (byteSize > MAX_CANONICAL_BYTES && packetWithoutId.catalysts.length > 0) {
      packetWithoutId.catalysts.pop();
      packetWithoutId.diagnostics.omitted_catalysts_count++;
      dummyPacketForSizeCheck.catalysts = packetWithoutId.catalysts;
      canonicalJson = toCanonicalJson(dummyPacketForSizeCheck);
      byteSize = Buffer.byteLength(canonicalJson, "utf8");
    }

    // Truncation Pass 4: Remove development clusters and evidence (leave at least 1 cluster)
    while (byteSize > MAX_CANONICAL_BYTES && packetWithoutId.development_clusters.length > 1) {
      const removedCluster = packetWithoutId.development_clusters.pop();
      if (removedCluster) {
        packetWithoutId.diagnostics.omitted_clusters_count++;
        packetWithoutId.diagnostics.omitted_evidence_count += removedCluster.evidence.length;
        packetWithoutId.diagnostics.omitted_leads_count += removedCluster.leads.length;

        const removedEvIds = new Set(removedCluster.evidence.map((e) => e.evidence_id));
        packetWithoutId.observed_evidence = packetWithoutId.observed_evidence.filter((e) => !removedEvIds.has(e.evidence_id));
      }
      dummyPacketForSizeCheck.development_clusters = packetWithoutId.development_clusters;
      dummyPacketForSizeCheck.observed_evidence = packetWithoutId.observed_evidence;
      canonicalJson = toCanonicalJson(dummyPacketForSizeCheck);
      byteSize = Buffer.byteLength(canonicalJson, "utf8");
    }

    // Truncation Pass 5: Progressively reduce long text strings in remaining evidence, metrics, prior claims, thesis ledger, research gaps, warnings, and notes
    if (byteSize > MAX_CANONICAL_BYTES) {
      const stringLimits = [150, 100, 60, 30];
      for (const maxTextLen of stringLimits) {
        if (byteSize <= MAX_CANONICAL_BYTES) break;

        for (const ev of packetWithoutId.observed_evidence) {
          ev.claim_or_fact = truncateString(ev.claim_or_fact, maxTextLen);
          if (ev.metrics) {
            ev.metrics = truncateMetricsStrings(ev.metrics, maxTextLen);
          }
        }
        for (const c of packetWithoutId.development_clusters) {
          c.title = truncateString(c.title, maxTextLen);
          for (const ev of c.evidence) {
            ev.claim_or_fact = truncateString(ev.claim_or_fact, maxTextLen);
            if (ev.metrics) {
              ev.metrics = truncateMetricsStrings(ev.metrics, maxTextLen);
            }
          }
        }
        for (const pc of packetWithoutId.prior_analytical_state.prior_claims) {
          pc.claim_text = truncateString(pc.claim_text, maxTextLen);
        }
        if (packetWithoutId.thesis_ledger) {
          for (const entry of packetWithoutId.thesis_ledger.entries) {
            entry.title = truncateString(entry.title, maxTextLen);
            entry.statement = truncateString(entry.statement, maxTextLen);
            if (entry.arguments) {
              for (const arg of entry.arguments) {
                arg.text = truncateString(arg.text, maxTextLen);
              }
            }
          }
        }
        for (const gap of packetWithoutId.research_gaps) {
          gap.description = truncateString(gap.description, maxTextLen);
        }
        for (const warn of packetWithoutId.freshness_warnings) {
          warn.message = truncateString(warn.message, maxTextLen);
        }
        packetWithoutId.diagnostics.notes = packetWithoutId.diagnostics.notes.map((n) => truncateString(n, maxTextLen));

        dummyPacketForSizeCheck.observed_evidence = packetWithoutId.observed_evidence;
        dummyPacketForSizeCheck.development_clusters = packetWithoutId.development_clusters;
        dummyPacketForSizeCheck.prior_analytical_state = packetWithoutId.prior_analytical_state;
        dummyPacketForSizeCheck.thesis_ledger = packetWithoutId.thesis_ledger;
        dummyPacketForSizeCheck.research_gaps = packetWithoutId.research_gaps;
        dummyPacketForSizeCheck.freshness_warnings = packetWithoutId.freshness_warnings;
        dummyPacketForSizeCheck.diagnostics = packetWithoutId.diagnostics;

        canonicalJson = toCanonicalJson(dummyPacketForSizeCheck);
        byteSize = Buffer.byteLength(canonicalJson, "utf8");
      }
    }
  }

  // Compute packet_id from canonical JSON of packetWithoutId
  const canonicalWithoutId = toCanonicalJson(packetWithoutId);
  const packetId = createHash("sha256").update(canonicalWithoutId, "utf8").digest("hex");

  const finalPacket: DossierV2InputPacket = {
    packet_id: packetId,
    ...packetWithoutId,
  };

  // Final defensive check
  const finalCanonicalJson = toCanonicalJson(finalPacket);
  const finalByteSize = Buffer.byteLength(finalCanonicalJson, "utf8");

  if (finalByteSize > MAX_CANONICAL_BYTES) {
    throw new Error(`Unreachable defensive assertion: Complete returned packet JSON size (${finalByteSize} bytes) exceeds limit of ${MAX_CANONICAL_BYTES} UTF-8 bytes after all reduction passes.`);
  }

  return finalPacket;
}
