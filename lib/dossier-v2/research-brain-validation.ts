import { Buffer } from "node:buffer";
import { isPlainObject, isValidIsoTimestamp } from "./validation.ts";
import { RESEARCH_BRAIN_MAX_CREATOR_EXPANSIONS, RESEARCH_BRAIN_MAX_DEVELOPING_THEMES, RESEARCH_BRAIN_MAX_INVESTIGATIONS, RESEARCH_BRAIN_MAX_MAJOR_STORIES, RESEARCH_BRAIN_MAX_OPTIONAL_CHARTS, RESEARCH_BRAIN_MAX_OUTPUT_BYTES, RESEARCH_BRAIN_MAX_RESEARCH_NOW, RESEARCH_BRAIN_MAX_STOCK_RADAR, RESEARCH_BRAIN_MAX_STORY_EVIDENCE, RESEARCH_BRAIN_MIN_DEVELOPING_THEMES, RESEARCH_BRAIN_CORE_CHARTS, RESEARCH_BRAIN_CONTRACT_VERSION, type AnalyticalClaim, type EvidenceRef, type ResearchBrainInputV1, type ResearchBrainOutputV1 } from "./research-brain-contracts.ts";

export interface ResearchBrainValidationResult { valid: boolean; errors: string[]; warnings: string[]; }
const LABELS = new Set(["OBSERVED", "SUPPORTED", "INFERRED", "SPECULATIVE"]);
const LENSES = new Set(["us_rates", "bonds", "tech_ai", "oil_war_inflation", "usd", "gold", "credit", "breadth"]);
const REFS = ["evidence_refs", "contradiction_refs", "observed_evidence_refs", "original_evidence_refs"];

function array(value: unknown): value is unknown[] { return Array.isArray(value); }
function text(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0; }
function ids(packet: ResearchBrainInputV1) { return { evidence: new Set(packet.packet.observed_evidence.map((x) => x.evidence_id)), leads: new Set(packet.packet.research_leads.map((x) => x.lead_id)), prior: new Set(packet.packet.prior_analytical_state.prior_claims.map((x) => x.claim_id)), catalysts: new Set(packet.packet.catalysts.map((x) => x.catalyst_id)), theses: new Set((packet.packet.thesis_ledger?.entries ?? []).map((x) => x.thesis_id)) }; }
function refs(value: unknown): EvidenceRef[] { return array(value) ? value as EvidenceRef[] : []; }
function claimRefs(claim: unknown, path: string, errors: string[]) { if (!isPlainObject(claim)) { errors.push(`${path} must be an object`); return; } if (!text(claim.text) || !LABELS.has(String(claim.epistemic_label)) || !array(claim.evidence_refs)) errors.push(`${path} is not a valid analytical claim`); }
function scanRefs(value: unknown, path: string, index: ReturnType<typeof ids>, errors: string[]) {
  if (array(value)) { value.forEach((item, i) => scanRefs(item, `${path}[${i}]`, index, errors)); return; }
  if (!isPlainObject(value)) return;
  for (const key of REFS) if (key in value) for (const ref of refs(value[key])) {
    if (!isPlainObject(ref) || !text(ref.id) || !text(ref.kind)) { errors.push(`${path}.${key} contains malformed reference`); continue; }
    const allowed = ref.kind === "observed_evidence" ? index.evidence : ref.kind === "research_lead" ? index.leads : ref.kind === "prior_claim" ? index.prior : ref.kind === "catalyst" ? index.catalysts : ref.kind === "thesis" ? index.theses : new Set<string>();
    if (!allowed.has(ref.id)) errors.push(`${path}.${key} references unsupported ${ref.kind}:${ref.id}`);
  }
  for (const [key, child] of Object.entries(value)) scanRefs(child, `${path}.${key}`, index, errors);
}
function everyClaim(output: ResearchBrainOutputV1, errors: string[]) {
  const candidates: Array<[string, unknown]> = [["main_thread", output.main_thread], ["market_verdict", output.market_verdict], ["unresolved_contradictions", output.unresolved_contradictions]];
  output.major_stories.forEach((s, i) => { candidates.push([`major_stories[${i}].what_changed`, s.what_changed], [`major_stories[${i}].why_it_matters`, s.why_it_matters], [`major_stories[${i}].conclusion`, s.conclusion]); s.headline_decomposition.forEach((x, j) => candidates.push([`major_stories[${i}].headline_decomposition[${j}]`, x])); s.market_evidence.confirming.forEach((x, j) => candidates.push([`major_stories[${i}].market_evidence.confirming[${j}]`, x])); s.market_evidence.contradicting.forEach((x, j) => candidates.push([`major_stories[${i}].market_evidence.contradicting[${j}]`, x])); s.market_evidence.unresolved.forEach((x, j) => candidates.push([`major_stories[${i}].market_evidence.unresolved[${j}]`, x])); });
  candidates.forEach(([path, claim]) => claimRefs(claim, path, errors));
}
function validateLineage(output: ResearchBrainOutputV1, errors: string[]) { const entries = output.thesis_ledger.entries; const seen = new Set<string>(); const byId = new Map(entries.map((x) => [x.thesis_id, x])); for (const e of entries) { if (seen.has(`${e.thesis_id}:${e.version}`)) errors.push(`duplicate thesis version ${e.thesis_id}:${e.version}`); seen.add(`${e.thesis_id}:${e.version}`); if (!Number.isInteger(e.version) || e.version < 1) errors.push(`invalid thesis version ${e.thesis_id}`); if (!isValidIsoTimestamp(e.created_at) || !isValidIsoTimestamp(e.state_changed_at) || !isValidIsoTimestamp(e.updated_at)) errors.push(`invalid thesis timestamps ${e.thesis_id}`); if (e.lineage.parent_thesis_id === e.thesis_id || e.lineage.successor_thesis_id === e.thesis_id) errors.push(`self-linked thesis ${e.thesis_id}`); if (e.current_state === "evolved" && !e.lineage.successor_thesis_id) errors.push(`evolved thesis ${e.thesis_id} lacks successor`); if (e.lineage.successor_thesis_id && !byId.has(e.lineage.successor_thesis_id)) errors.push(`missing thesis successor ${e.lineage.successor_thesis_id}`); if (e.lineage.parent_thesis_id && !byId.has(e.lineage.parent_thesis_id)) errors.push(`missing thesis parent ${e.lineage.parent_thesis_id}`); } for (const e of entries) { let current: string | null = e.thesis_id; const visited = new Set<string>(); while (current) { if (visited.has(current)) { errors.push(`thesis lineage cycle at ${e.thesis_id}`); break; } visited.add(current); current = byId.get(current)?.lineage.parent_thesis_id ?? null; } } }

export function buildResearchBrainReferenceIndex(input: ResearchBrainInputV1) { return ids(input); }
export function validateResearchBrainInput(input: unknown): ResearchBrainInputV1 { if (!isPlainObject(input) || input.contract_version !== RESEARCH_BRAIN_CONTRACT_VERSION || !isPlainObject(input.packet)) throw new Error("Invalid ResearchBrainInputV1."); return input as unknown as ResearchBrainInputV1; }
export function validateResearchBrainOutput(input: unknown, brainInput: ResearchBrainInputV1): ResearchBrainValidationResult {
  const errors: string[] = []; const warnings: string[] = [];
  if (!isPlainObject(input)) return { valid: false, errors: ["output must be an object"], warnings };
  const output = input as ResearchBrainOutputV1;
  if (output.contract_version !== RESEARCH_BRAIN_CONTRACT_VERSION) errors.push("invalid contract_version");
  if (output.packet_id !== brainInput.packet.packet_id) errors.push("packet_id does not match input packet");
  if (output.as_of !== brainInput.packet.as_of) errors.push("as_of does not match input packet");
  if (!isPlainObject(output.main_thread) || !text(output.main_thread.answer)) errors.push("exactly one valid main_thread is required");
  if (!array(output.major_stories) || output.major_stories.length > RESEARCH_BRAIN_MAX_MAJOR_STORIES) errors.push("major_stories exceeds maximum");
  if (!array(output.investigations) || output.investigations.length > RESEARCH_BRAIN_MAX_INVESTIGATIONS) errors.push("investigations exceeds maximum");
  if (!array(output.research_now) || output.research_now.length > RESEARCH_BRAIN_MAX_RESEARCH_NOW) errors.push("research_now exceeds maximum");
  if (!isPlainObject(output.chart_investigation_queue) || !array(output.chart_investigation_queue?.core) || output.chart_investigation_queue.core.length > RESEARCH_BRAIN_CORE_CHARTS || !array(output.chart_investigation_queue?.optional) || output.chart_investigation_queue.optional.length > RESEARCH_BRAIN_MAX_OPTIONAL_CHARTS) errors.push("chart queue exceeds maximum");
  if (!array(output.stock_radar) || output.stock_radar.length > RESEARCH_BRAIN_MAX_STOCK_RADAR) errors.push("stock_radar exceeds maximum");
  if (!array(output.developing_themes) || output.developing_themes.length > RESEARCH_BRAIN_MAX_DEVELOPING_THEMES) errors.push("developing_themes exceeds maximum");
  if (!array(output.creator_theme_expansions) || output.creator_theme_expansions.length > RESEARCH_BRAIN_MAX_CREATOR_EXPANSIONS) errors.push("creator_theme_expansions exceeds maximum");
  if (!isPlainObject(output.thesis_ledger) || output.thesis_ledger.contract_version !== "thesis-ledger/2" || !array(output.thesis_ledger.entries)) errors.push("invalid thesis ledger");
  const index = ids(brainInput); scanRefs(output, "output", index, errors); everyClaim(output, errors);
  for (const story of output.major_stories ?? []) { if (story.market_evidence.confirming.length + story.market_evidence.contradicting.length + story.market_evidence.unresolved.length > RESEARCH_BRAIN_MAX_STORY_EVIDENCE) errors.push(`story ${story.story_id} exceeds evidence budget`); if (!text(story.what_would_change_mind) || !story.causal_mechanism.length) errors.push(`story ${story.story_id} fails research quality firewall`); }
  for (const chart of output.chart_investigation_queue?.core ?? []) if (!text(chart.instrument) || !text(chart.timeframe) || !text(chart.exact_question) || chart.instrument.length < 2) errors.push(`chart ${chart.chart_task_id} is not specific`);
  for (const radar of output.stock_radar ?? []) if (!text(radar.linked_thread_or_story_id) || radar.recommendation_disclaimer !== "research_watch_candidate_not_trade_recommendation") errors.push(`stock radar ${radar.radar_id} is not linked or is a recommendation`);
  if (array(output.market_verdict?.lenses)) for (const lens of output.market_verdict.lenses) { if (!LENSES.has(lens.lens)) errors.push(`invalid market lens ${lens.lens}`); if (lens.observed_reaction && lens.observed_reaction.evidence_refs.every((r) => r.kind !== "observed_evidence")) errors.push(`market reaction ${lens.lens} lacks observed evidence`); }
  const serialized = JSON.stringify(output); if (Buffer.byteLength(serialized, "utf8") > RESEARCH_BRAIN_MAX_OUTPUT_BYTES) errors.push("output exceeds byte limit"); if (/\b(probability|probabilities|odds)\s*[:=]?\s*\d+%?/i.test(serialized)) errors.push("numerical probability claims are prohibited");
  if (isPlainObject(output.thesis_ledger)) validateLineage(output, errors);
  if (!output.diagnostics?.degraded && (brainInput.packet.research_gaps.length > 0)) warnings.push("input packet contains research gaps");
  return { valid: errors.length === 0, errors, warnings };
}
