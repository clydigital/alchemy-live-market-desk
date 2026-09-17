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

const MAX_DEVELOPMENT_CLUSTERS = 12;
const MAX_EVIDENCE_PER_CLUSTER = 6;
const MAX_LEADS_PER_CLUSTER = 3;
const MAX_TOTAL_OBSERVED_EVIDENCE = 72;
const MAX_CREATOR_THEMES = 5;
const MAX_CREATOR_EXPAND_LATER = 2;
const MAX_CREATOR_CLAIMS_PER_THEME = 3;
const MAX_CATALYSTS = 12;
const MAX_PRIOR_CLAIMS = 12;
const MAX_THESIS_LEDGER_ENTRIES = 12;
const MAX_RESEARCH_GAPS = 12;
const MAX_PROVENANCE_PER_ITEM = 5;
const MAX_CANONICAL_BYTES = 200000;

const VALID_THESIS_STATES = new Set<ThesisState>([
  "confirmed",
  "weakened",
  "invalidated",
  "unresolved",
  "evolved",
]);

function hashString(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex").slice(0, 16);
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

function sanitizeProvenance(rawProv?: unknown): ProvenanceRef[] {
  if (!Array.isArray(rawProv)) return [];
  const seen = new Set<string>();
  const result: ProvenanceRef[] = [];

  for (const p of rawProv) {
    if (!isPlainObject(p)) continue;
    const sourceType = String(p.source_type ?? "UNKNOWN");
    const sourceId = String(p.source_id ?? "UNKNOWN");
    const key = `${sourceType}:${sourceId}:${p.url ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const ref: ProvenanceRef = {
      source_type: sourceType,
      source_id: sourceId,
    };
    if (p.url) ref.url = String(p.url);
    if (p.published_at) ref.published_at = String(p.published_at);
    if (p.publisher) ref.publisher = String(p.publisher);
    if (p.title) ref.title = String(p.title);
    if (p.locator) ref.locator = String(p.locator);

    result.push(ref);
    if (result.length >= MAX_PROVENANCE_PER_ITEM) break;
  }

  return result;
}

function mergeProvenance(a: ProvenanceRef[], b: ProvenanceRef[]): ProvenanceRef[] {
  return sanitizeProvenance([...a, ...b]);
}

function computeGroupingKey(item: Record<string, unknown>): string {
  if (typeof item.grouping_key === "string" && item.grouping_key.trim()) return item.grouping_key.trim();
  if (typeof item.event_occurrence_key === "string" && item.event_occurrence_key.trim()) return item.event_occurrence_key.trim();
  if (typeof item.macro_release_id === "string" && item.macro_release_id.trim()) return item.macro_release_id.trim();
  if (typeof item.ticker_date_key === "string" && item.ticker_date_key.trim()) return item.ticker_date_key.trim();
  if (typeof item.subject_date_key === "string" && item.subject_date_key.trim()) return item.subject_date_key.trim();
  const text = String(item.claim_or_fact ?? item.claim_or_question ?? "");
  return `hash:${hashString(text.trim().toLowerCase())}`;
}

function validateThesisLedger(ledger: unknown): ThesisLedger {
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

    const entry: ThesisLedgerEntry = {
      thesis_id: e.thesis_id as string,
      contract_version: (e.contract_version as string) ?? THESIS_LEDGER_CONTRACT_VERSION,
      title: e.title as string,
      statement: e.statement as string,
      state: e.state as ThesisState,
      version: e.version as number,
      created_at: e.created_at as string,
      updated_at: e.updated_at as string,
      lineage: (e.lineage as string[]).map(String),
    };

    if (Array.isArray(e.arguments)) {
      entry.arguments = e.arguments.map((arg, argIdx) => {
        if (!isPlainObject(arg) || typeof arg.arg_id !== "string" || typeof arg.text !== "string" || (arg.type !== "supporting" && arg.type !== "counter")) {
          throw new Error(`Invalid thesis argument at entry ${idx}, arg ${argIdx}.`);
        }
        return {
          arg_id: arg.arg_id,
          type: arg.type,
          text: arg.text,
        };
      });
    }

    return entry;
  });

  return {
    contract_version: contractVersion as string,
    entries: validatedEntries,
  };
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

  const previousDossierId = request.previous_dossier_id ?? null;
  if (previousDossierId !== null && !isValidUuid(previousDossierId)) {
    throw new Error(`Invalid previous_dossier_id: expected UUID string or null, got "${String(previousDossierId)}".`);
  }

  const asOf = request.as_of;
  const asOfMs = Date.parse(asOf);
  const windowStartMs = asOfMs - 24 * 60 * 60 * 1000;

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

  // Check sources status / price / macro non-blocking errors
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
          source_name: srcName,
          last_available_at: statusObj.available_at,
          message: statusObj.message ?? `Source ${srcName} reported status ${statusObj.status}.`,
        });
      }
    }
  }

  // Handle prior dossier & first run
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

  // 1. Process candidate observed evidence
  const candidateEvidence = Array.isArray(snapshot.observed_evidence) ? snapshot.observed_evidence : [];
  const rawAdmittedEvidence: Array<ObservedEvidence & { grouping_key: string }> = [];

  for (const raw of candidateEvidence) {
    if (!isPlainObject(raw)) continue;
    if (!isValidIsoTimestamp(raw.available_at)) continue;

    const availMs = Date.parse(raw.available_at as string);
    if (availMs > asOfMs || availMs < windowStartMs) {
      omittedEvidenceCount++;
      continue;
    }

    const claimText = String(raw.claim_or_fact ?? "").trim();
    if (!claimText) continue;

    const groupingKey = computeGroupingKey(raw);
    const evId = typeof raw.evidence_id === "string" && raw.evidence_id ? raw.evidence_id : `ev:${hashString(`${groupingKey}:${claimText}`)}`;

    rawAdmittedEvidence.push({
      evidence_id: evId,
      epistemic_label: "OBSERVED",
      claim_or_fact: claimText,
      category: String(raw.category ?? "GENERAL"),
      source_type: String(raw.source_type ?? "FACT"),
      available_at: raw.available_at as string,
      occurrence_time: typeof raw.occurrence_time === "string" ? raw.occurrence_time : undefined,
      metrics: isPlainObject(raw.metrics) ? (JSON.parse(JSON.stringify(raw.metrics)) as Record<string, unknown>) : undefined,
      provenance: sanitizeProvenance(raw.provenance),
      rank: typeof raw.rank === "number" ? raw.rank : undefined,
      grouping_key: groupingKey,
    });
  }

  // Deduplicate and detect conflicts for evidence by grouping_key
  const evidenceByGroup = new Map<string, Array<ObservedEvidence & { grouping_key: string }>>();
  for (const ev of rawAdmittedEvidence) {
    const list = evidenceByGroup.get(ev.grouping_key) ?? [];
    list.push(ev);
    evidenceByGroup.set(ev.grouping_key, list);
  }

  const processedEvidenceByGroup = new Map<string, ObservedEvidence[]>();
  for (const [gKey, evList] of evidenceByGroup.entries()) {
    // Exact text dedupe
    const textMap = new Map<string, ObservedEvidence & { grouping_key: string }>();
    for (const item of evList) {
      const normText = item.claim_or_fact.trim().toLowerCase();
      const existing = textMap.get(normText);
      if (existing) {
        existing.provenance = mergeProvenance(existing.provenance, item.provenance);
      } else {
        textMap.set(normText, { ...item });
      }
    }

    const uniqueFacts = Array.from(textMap.values());
    if (uniqueFacts.length > 1) {
      const conflictGroupId = `conflict:${hashString(gKey)}`;
      for (const f of uniqueFacts) {
        f.conflict_group_id = conflictGroupId;
      }
    }

    const cleanFacts: ObservedEvidence[] = uniqueFacts.map((uf) => {
      const { grouping_key: _, ...rest } = uf;
      return rest;
    });

    processedEvidenceByGroup.set(gKey, cleanFacts);
  }

  // 2. Process candidate research leads
  const candidateLeads = Array.isArray(snapshot.research_leads) ? snapshot.research_leads : [];
  const rawAdmittedLeads: Array<ResearchLead & { grouping_key: string }> = [];

  for (const raw of candidateLeads) {
    if (!isPlainObject(raw)) continue;
    if (!isValidIsoTimestamp(raw.available_at)) continue;

    const availMs = Date.parse(raw.available_at as string);
    if (availMs > asOfMs || availMs < windowStartMs) {
      omittedLeadsCount++;
      continue;
    }

    const questionText = String(raw.claim_or_question ?? "").trim();
    if (!questionText) continue;

    const groupingKey = computeGroupingKey(raw);
    const leadId = typeof raw.lead_id === "string" && raw.lead_id ? raw.lead_id : `lead:${hashString(`${groupingKey}:${questionText}`)}`;

    rawAdmittedLeads.push({
      lead_id: leadId,
      claim_or_question: questionText,
      source_type: String(raw.source_type ?? "LEAD"),
      available_at: raw.available_at as string,
      urgency: raw.urgency === "HIGH" || raw.urgency === "MEDIUM" || raw.urgency === "LOW" ? raw.urgency : "MEDIUM",
      provenance: sanitizeProvenance(raw.provenance),
      rank: typeof raw.rank === "number" ? raw.rank : undefined,
      grouping_key: groupingKey,
    });
  }

  // Deduplicate and conflict detect research leads
  const leadsByGroup = new Map<string, Array<ResearchLead & { grouping_key: string }>>();
  for (const ld of rawAdmittedLeads) {
    const list = leadsByGroup.get(ld.grouping_key) ?? [];
    list.push(ld);
    leadsByGroup.set(ld.grouping_key, list);
  }

  const processedLeadsByGroup = new Map<string, ResearchLead[]>();
  for (const [gKey, ldList] of leadsByGroup.entries()) {
    const textMap = new Map<string, ResearchLead & { grouping_key: string }>();
    for (const item of ldList) {
      const normText = item.claim_or_question.trim().toLowerCase();
      const existing = textMap.get(normText);
      if (existing) {
        existing.provenance = mergeProvenance(existing.provenance, item.provenance);
      } else {
        textMap.set(normText, { ...item });
      }
    }

    const uniqueLeads = Array.from(textMap.values());
    if (uniqueLeads.length > 1) {
      const conflictGroupId = `conflict:${hashString(gKey)}`;
      for (const l of uniqueLeads) {
        l.conflict_group_id = conflictGroupId;
      }
    }

    const cleanLeads: ResearchLead[] = uniqueLeads.map((ul) => {
      const { grouping_key: _, ...rest } = ul;
      return rest;
    });

    processedLeadsByGroup.set(gKey, cleanLeads);
  }

  // 3. Form Development Clusters
  const allGroupingKeys = Array.from(new Set([...processedEvidenceByGroup.keys(), ...processedLeadsByGroup.keys()])).sort();

  const candidateClusters: DevelopmentCluster[] = allGroupingKeys.map((gKey) => {
    let evList = processedEvidenceByGroup.get(gKey) ?? [];
    let ldList = processedLeadsByGroup.get(gKey) ?? [];

    // Sort cluster items deterministically before capping
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

    const clusterTitle = evList[0]?.claim_or_fact ?? ldList[0]?.claim_or_question ?? `Cluster ${gKey}`;
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

  // Sort clusters deterministically
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
    omittedClustersCount += developmentClusters.length - MAX_DEVELOPMENT_CLUSTERS;
    const omittedClusters = developmentClusters.slice(MAX_DEVELOPMENT_CLUSTERS);
    for (const c of omittedClusters) {
      omittedEvidenceCount += c.evidence.length;
      omittedLeadsCount += c.leads.length;
    }
    developmentClusters = developmentClusters.slice(0, MAX_DEVELOPMENT_CLUSTERS);
  }

  // Gather overall evidence and leads arrays from retained clusters
  let observedEvidence: ObservedEvidence[] = [];
  let researchLeads: ResearchLead[] = [];

  for (const c of developmentClusters) {
    observedEvidence.push(...c.evidence);
    researchLeads.push(...c.leads);
  }

  // Deduplicate and cap total observed evidence
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

  // 4. Process Creator Themes
  const rawThemes = Array.isArray(snapshot.creator_themes) ? snapshot.creator_themes : [];
  const processedThemes: CreatorTheme[] = [];

  for (const t of rawThemes) {
    if (!isPlainObject(t)) continue;
    const themeName = String(t.theme_name ?? "").trim();
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

      const claimText = String(c.text ?? "").trim();
      if (!claimText) continue;

      const claimId = typeof c.claim_id === "string" && c.claim_id ? c.claim_id : `claim:${hashString(`${themeName}:${claimText}`)}`;
      validClaims.push({
        claim_id: claimId,
        text: claimText,
        creator_id: c.creator_id ? String(c.creator_id) : undefined,
        available_at: c.available_at as string,
        provenance: sanitizeProvenance(c.provenance),
      });
    }

    validClaims.sort((a, b) => b.available_at.localeCompare(a.available_at) || a.claim_id.localeCompare(b.claim_id));

    let themeClaims = validClaims;
    if (themeClaims.length > MAX_CREATOR_CLAIMS_PER_THEME) {
      omittedCreatorClaimsCount += themeClaims.length - MAX_CREATOR_CLAIMS_PER_THEME;
      themeClaims = themeClaims.slice(0, MAX_CREATOR_CLAIMS_PER_THEME);
    }

    processedThemes.push({
      theme_id: typeof t.theme_id === "string" && t.theme_id ? t.theme_id : `theme:${hashString(themeName)}`,
      theme_name: themeName,
      expand_later: Boolean(t.expand_later),
      claims: themeClaims,
    });
  }

  // Sort themes deterministically
  processedThemes.sort((a, b) => a.theme_name.localeCompare(b.theme_name));

  // Enforce max 2 expand_later
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

  // 5. Process Catalysts
  const rawCatalysts = Array.isArray(snapshot.catalysts) ? snapshot.catalysts : [];
  const validCatalysts: CatalystItem[] = [];

  for (const cat of rawCatalysts) {
    if (!isPlainObject(cat)) continue;
    if (!isValidIsoTimestamp(cat.available_at)) continue;
    const availMs = Date.parse(cat.available_at as string);
    if (availMs > asOfMs || availMs < windowStartMs) {
      omittedCatalystsCount++;
      continue;
    }

    const titleText = String(cat.title ?? "").trim();
    if (!titleText) continue;

    const catId = typeof cat.catalyst_id === "string" && cat.catalyst_id ? cat.catalyst_id : `cat:${hashString(titleText)}`;
    const eventTime = isValidIsoTimestamp(cat.event_time) ? (cat.event_time as string) : (cat.available_at as string);

    validCatalysts.push({
      catalyst_id: catId,
      title: titleText,
      event_time: eventTime,
      available_at: cat.available_at as string,
      impact_level: cat.impact_level === "HIGH" || cat.impact_level === "MEDIUM" || cat.impact_level === "LOW" ? cat.impact_level : "MEDIUM",
      provenance: sanitizeProvenance(cat.provenance),
      rank: typeof cat.rank === "number" ? cat.rank : undefined,
    });
  }

  validCatalysts.sort((a, b) => {
    const rankA = a.rank ?? 999;
    const rankB = b.rank ?? 999;
    if (rankA !== rankB) return rankA - rankB;
    const eComp = b.event_time.localeCompare(a.event_time);
    if (eComp !== 0) return eComp;
    return a.catalyst_id.localeCompare(b.catalyst_id);
  });

  let catalysts = validCatalysts;
  if (catalysts.length > MAX_CATALYSTS) {
    omittedCatalystsCount += catalysts.length - MAX_CATALYSTS;
    catalysts = catalysts.slice(0, MAX_CATALYSTS);
  }

  // 6. Process Prior Analytical State & Thesis Ledger
  let priorClaims: PriorAnalyticalClaim[] = [];
  let prevDossierAsOf: string | null = null;
  let activeThesisLedger: ThesisLedger | null = null;

  if (request.previous_dossier && isPlainObject(request.previous_dossier)) {
    prevDossierAsOf = isValidIsoTimestamp(request.previous_dossier.as_of) ? request.previous_dossier.as_of : null;

    if (Array.isArray(request.previous_dossier.prior_claims)) {
      for (const pc of request.previous_dossier.prior_claims) {
        if (!isPlainObject(pc)) continue;
        const claimText = String(pc.claim_text ?? "").trim();
        if (!claimText) continue;

        const epistemicLabel = pc.epistemic_label;
        if (epistemicLabel !== "OBSERVED" && epistemicLabel !== "SUPPORTED" && epistemicLabel !== "INFERRED" && epistemicLabel !== "SPECULATIVE") {
          continue;
        }

        priorClaims.push({
          claim_id: typeof pc.claim_id === "string" && pc.claim_id ? pc.claim_id : `pc:${hashString(claimText)}`,
          epistemic_label: epistemicLabel,
          claim_text: claimText,
          dossier_id: typeof pc.dossier_id === "string" && pc.dossier_id ? pc.dossier_id : (previousDossierId ?? "prior"),
          as_of: isValidIsoTimestamp(pc.as_of) ? (pc.as_of as string) : (prevDossierAsOf ?? asOf),
          provenance: sanitizeProvenance(pc.provenance),
        });
      }
    }

    if (request.previous_dossier.thesis_ledger) {
      activeThesisLedger = validateThesisLedger(request.previous_dossier.thesis_ledger);
    }
  }

  if (!activeThesisLedger && snapshot.thesis_ledger) {
    activeThesisLedger = validateThesisLedger(snapshot.thesis_ledger);
  }

  // Sort and cap prior claims
  priorClaims.sort((a, b) => a.claim_text.localeCompare(b.claim_text));
  if (priorClaims.length > MAX_PRIOR_CLAIMS) {
    omittedPriorClaimsCount += priorClaims.length - MAX_PRIOR_CLAIMS;
    priorClaims = priorClaims.slice(0, MAX_PRIOR_CLAIMS);
  }

  // Deep-copy and cap Thesis Ledger without modifying any state
  if (activeThesisLedger) {
    activeThesisLedger = JSON.parse(JSON.stringify(activeThesisLedger)) as ThesisLedger;
    if (activeThesisLedger.entries.length > MAX_THESIS_LEDGER_ENTRIES) {
      omittedThesisEntriesCount += activeThesisLedger.entries.length - MAX_THESIS_LEDGER_ENTRIES;
      activeThesisLedger.entries = activeThesisLedger.entries.slice(0, MAX_THESIS_LEDGER_ENTRIES);
    }
  }

  // Sort and cap research gaps
  researchGaps.sort((a, b) => a.gap_id.localeCompare(b.gap_id));
  let finalResearchGaps = researchGaps;
  if (finalResearchGaps.length > MAX_RESEARCH_GAPS) {
    omittedResearchGapsCount += finalResearchGaps.length - MAX_RESEARCH_GAPS;
    finalResearchGaps = finalResearchGaps.slice(0, MAX_RESEARCH_GAPS);
  }

  // Sort freshness warnings deterministically
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
    byte_limit_truncation_applied: false,
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

  // Enforce UTF-8 byte limit (<= 200,000 bytes)
  let canonicalJson = toCanonicalJson(packetWithoutId);
  let byteSize = Buffer.byteLength(canonicalJson, "utf8");

  if (byteSize > MAX_CANONICAL_BYTES) {
    packetWithoutId.diagnostics.byte_limit_truncation_applied = true;

    // First reduction pass: remove lowest-ranked research leads
    while (byteSize > MAX_CANONICAL_BYTES && packetWithoutId.research_leads.length > 0) {
      const removed = packetWithoutId.research_leads.pop();
      if (removed) {
        packetWithoutId.diagnostics.omitted_leads_count++;
        for (const c of packetWithoutId.development_clusters) {
          c.leads = c.leads.filter((l) => l.lead_id !== removed.lead_id);
        }
      }
      canonicalJson = toCanonicalJson(packetWithoutId);
      byteSize = Buffer.byteLength(canonicalJson, "utf8");
    }

    // Second reduction pass if still over limit: remove lowest-ranked evidence/clusters
    while (byteSize > MAX_CANONICAL_BYTES && packetWithoutId.development_clusters.length > 1) {
      const removedCluster = packetWithoutId.development_clusters.pop();
      if (removedCluster) {
        packetWithoutId.diagnostics.omitted_clusters_count++;
        packetWithoutId.diagnostics.omitted_evidence_count += removedCluster.evidence.length;
        packetWithoutId.diagnostics.omitted_leads_count += removedCluster.leads.length;

        const removedEvIds = new Set(removedCluster.evidence.map((e) => e.evidence_id));
        packetWithoutId.observed_evidence = packetWithoutId.observed_evidence.filter((e) => !removedEvIds.has(e.evidence_id));
      }
      canonicalJson = toCanonicalJson(packetWithoutId);
      byteSize = Buffer.byteLength(canonicalJson, "utf8");
    }
  }

  const packetId = createHash("sha256").update(canonicalJson, "utf8").digest("hex");

  return {
    packet_id: packetId,
    ...packetWithoutId,
  };
}
