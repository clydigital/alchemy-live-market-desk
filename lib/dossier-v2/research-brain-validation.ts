import {
  isPlainObject,
  isValidIsoTimestamp,
} from "./validation.ts";
import type {
  DossierV2InputPacket,
} from "./input-packet.ts";
import {
  EXACT_CORE_CHARTS,
  MAX_CONTRADICTIONS,
  MAX_CREATOR_EXPANSIONS,
  MAX_DEVELOPING_THEMES,
  MAX_MAJOR_STORIES,
  MAX_OPTIONAL_CHARTS,
  MAX_OUTPUT_BYTES,
  MAX_PRIORITY_INVESTIGATIONS,
  MAX_RESEARCH_GAPS,
  MAX_RESEARCH_NOW_ACTIONS,
  MAX_STOCK_RADAR_ITEMS,
  RESEARCH_BRAIN_CONTRACT_VERSION,
  RESEARCH_BRAIN_INPUT_CONTRACT_VERSION,
  THESIS_LEDGER_V2_CONTRACT_VERSION,
} from "./research-brain-contracts.ts";
import type {
  EpistemicLabel,
  ResearchBrainInputV1,
  ResearchBrainOutputV1,
} from "./research-brain-contracts.ts";

export interface ValidationIndexes {
  validEvidenceIds: Set<string>;
  validLeadIds: Set<string>;
  validPriorClaimIds: Set<string>;
  validCreatorClaimIds: Set<string>;
  validConflictGroupIds: Set<string>;
  validPriorThesisIds: Set<string>;
  priorThesisMap: Map<
    string,
    {
      version: number;
      state: string;
      root_thesis_id: string;
      parent_thesis_id: string | null;
      successor_thesis_id: string | null;
    }
  >;
  priceDataAvailable: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  output?: ResearchBrainOutputV1;
}

const PROBABILITY_CLAIM_REGEX = /\b(\d+(\.\d+)?%?\s*probability|probability\s*(of|=|:)\s*\d+(\.\d+)?%?|\b\d{1,3}%\s*(chance|likelihood|probability)\b)/i;
const GENERIC_CHART_TASK_REGEX = /^(check|look at|review|chart|see|watch)\s+(s&p|spx|yields|rates|gold|oil|btc|stocks|market|crypto|fx|dollar)$/i;
const VAGUE_PLACEHOLDER_REGEX = /^(tbd|todo|n\/a|none|chart|unknown|placeholder|\?+)$/i;

const REQUIRED_VERDICT_LENSES = [
  "US_RATES",
  "BONDS",
  "TECH_AI",
  "OIL_WAR_INFLATION",
  "USD",
  "GOLD",
  "CREDIT",
  "BREADTH",
];

export function buildValidationIndexes(packet: DossierV2InputPacket): ValidationIndexes {
  const validEvidenceIds = new Set<string>();
  const validLeadIds = new Set<string>();
  const validPriorClaimIds = new Set<string>();
  const validCreatorClaimIds = new Set<string>();
  const validConflictGroupIds = new Set<string>();
  const validPriorThesisIds = new Set<string>();
  const priorThesisMap = new Map<
    string,
    {
      version: number;
      state: string;
      root_thesis_id: string;
      parent_thesis_id: string | null;
      successor_thesis_id: string | null;
    }
  >();

  if (Array.isArray(packet.observed_evidence)) {
    for (const ev of packet.observed_evidence) {
      if (ev && typeof ev.evidence_id === "string") {
        validEvidenceIds.add(ev.evidence_id);
      }
      if (ev && typeof ev.conflict_group_id === "string") {
        validConflictGroupIds.add(ev.conflict_group_id);
      }
    }
  }

  if (Array.isArray(packet.research_leads)) {
    for (const ld of packet.research_leads) {
      if (ld && typeof ld.lead_id === "string") {
        validLeadIds.add(ld.lead_id);
      }
      if (ld && typeof ld.conflict_group_id === "string") {
        validConflictGroupIds.add(ld.conflict_group_id);
      }
    }
  }

  if (Array.isArray(packet.development_clusters)) {
    for (const cl of packet.development_clusters) {
      if (cl && typeof cl.conflict_group_id === "string") {
        validConflictGroupIds.add(cl.conflict_group_id);
      }
    }
  }

  if (packet.prior_analytical_state && Array.isArray(packet.prior_analytical_state.prior_claims)) {
    for (const pc of packet.prior_analytical_state.prior_claims) {
      if (pc && typeof pc.claim_id === "string") {
        validPriorClaimIds.add(pc.claim_id);
      }
    }
  }

  if (Array.isArray(packet.creator_themes)) {
    for (const theme of packet.creator_themes) {
      if (theme && Array.isArray(theme.claims)) {
        for (const claim of theme.claims) {
          if (claim && typeof claim.claim_id === "string") {
            validCreatorClaimIds.add(claim.claim_id);
          }
        }
      }
    }
  }

  const activeLedger = packet.thesis_ledger || packet.prior_analytical_state?.thesis_ledger;
  if (activeLedger && Array.isArray(activeLedger.entries)) {
    for (const entry of activeLedger.entries) {
      if (entry && typeof entry.thesis_id === "string") {
        validPriorThesisIds.add(entry.thesis_id);
        priorThesisMap.set(entry.thesis_id, {
          version: entry.version ?? 1,
          state: (entry as { state?: string }).state ?? "unresolved",
          root_thesis_id: (entry as { root_thesis_id?: string }).root_thesis_id ?? entry.thesis_id,
          parent_thesis_id: (entry as { parent_thesis_id?: string | null }).parent_thesis_id ?? null,
          successor_thesis_id: (entry as { successor_thesis_id?: string | null }).successor_thesis_id ?? null,
        });
      }
    }
  }

  const priceGap = Array.isArray(packet.research_gaps) && packet.research_gaps.some((g) => g.category === "PRICE_DATA");
  const priceDataAvailable = !priceGap;

  return {
    validEvidenceIds,
    validLeadIds,
    validPriorClaimIds,
    validCreatorClaimIds,
    validConflictGroupIds,
    validPriorThesisIds,
    priorThesisMap,
    priceDataAvailable,
  };
}

export function validateResearchBrainInput(input: unknown): ResearchBrainInputV1 {
  if (!isPlainObject(input)) {
    throw new Error("Invalid ResearchBrainInput: expected plain object.");
  }

  if (input.contract_version && input.contract_version !== RESEARCH_BRAIN_INPUT_CONTRACT_VERSION) {
    throw new Error(`Invalid contract_version: expected "${RESEARCH_BRAIN_INPUT_CONTRACT_VERSION}", got "${String(input.contract_version)}".`);
  }

  if (!isValidIsoTimestamp(input.as_of)) {
    throw new Error(`Invalid as_of timestamp: expected valid ISO string, got "${String(input.as_of)}".`);
  }

  if (!isPlainObject(input.packet)) {
    throw new Error("Invalid packet: expected plain object DossierV2InputPacket.");
  }

  const packet = (input.packet as unknown) as DossierV2InputPacket;
  if (packet.contract_version !== "dossier-v2-input/1") {
    throw new Error(`Invalid packet contract_version: expected "dossier-v2-input/1", got "${String(packet.contract_version)}".`);
  }

  return {
    contract_version: RESEARCH_BRAIN_INPUT_CONTRACT_VERSION,
    as_of: input.as_of as string,
    packet,
  };
}

export function validateResearchBrainOutput(
  output: unknown,
  packet: DossierV2InputPacket,
): ValidationResult {
  const errors: string[] = [];

  if (!isPlainObject(output)) {
    return {
      isValid: false,
      errors: ["ResearchBrainOutput must be a plain JSON object."],
    };
  }

  const brainOutput = output as Record<string, unknown>;

  // Contract version check
  if (brainOutput.contract_version !== RESEARCH_BRAIN_CONTRACT_VERSION) {
    errors.push(`Invalid contract_version: expected "${RESEARCH_BRAIN_CONTRACT_VERSION}", got "${String(brainOutput.contract_version)}".`);
  }

  // Traceability check
  if (brainOutput.packet_id !== packet.packet_id) {
    errors.push(`packet_id mismatch: expected "${packet.packet_id}", got "${String(brainOutput.packet_id)}".`);
  }

  // as_of check
  if (!isValidIsoTimestamp(brainOutput.as_of)) {
    errors.push(`Invalid as_of timestamp: "${String(brainOutput.as_of)}".`);
  } else if (packet.as_of && brainOutput.as_of !== packet.as_of) {
    errors.push(`as_of mismatch: output as_of "${String(brainOutput.as_of)}" does not match packet as_of "${packet.as_of}".`);
  }

  // Byte cap check
  try {
    const jsonStr = JSON.stringify(brainOutput);
    const bytes = Buffer.byteLength(jsonStr, "utf8");
    if (bytes > MAX_OUTPUT_BYTES) {
      errors.push(`Output JSON size (${bytes} bytes) exceeds limit of ${MAX_OUTPUT_BYTES} bytes.`);
    }
  } catch {
    errors.push("Output is not JSON serializable.");
  }

  const indexes = buildValidationIndexes(packet);

  // Collect valid Major Story IDs and Chart Task IDs for cross-referencing
  const majorStories = Array.isArray(brainOutput.major_stories) ? brainOutput.major_stories : [];
  const validStoryIds = new Set<string>();
  for (const story of majorStories) {
    if (isPlainObject(story) && typeof story.story_id === "string") {
      validStoryIds.add(story.story_id);
    }
  }

  const chartQueue = isPlainObject(brainOutput.chart_investigation_queue) ? (brainOutput.chart_investigation_queue as Record<string, unknown>) : {};
  const coreCharts = Array.isArray(chartQueue.core) ? chartQueue.core : [];
  const optionalCharts = Array.isArray(chartQueue.optional) ? chartQueue.optional : [];
  const validChartTaskIds = new Set<string>();
  for (const ct of [...coreCharts, ...optionalCharts]) {
    if (isPlainObject(ct) && typeof ct.chart_id === "string") {
      validChartTaskIds.add(ct.chart_id);
    }
  }

  const investigations = Array.isArray(brainOutput.investigations) ? brainOutput.investigations : [];
  const validInvestigationIds = new Set<string>();
  for (const inv of investigations) {
    if (isPlainObject(inv) && typeof inv.investigation_id === "string") {
      validInvestigationIds.add(inv.investigation_id);
    }
  }

  const thesisLedgerObj = isPlainObject(brainOutput.thesis_ledger) ? (brainOutput.thesis_ledger as Record<string, unknown>) : {};
  const thesisEntries = Array.isArray(thesisLedgerObj.entries) ? thesisLedgerObj.entries : [];
  const validThesisIds = new Set<string>();
  for (const te of thesisEntries) {
    if (isPlainObject(te) && typeof te.thesis_id === "string") {
      validThesisIds.add(te.thesis_id);
    }
  }

  // 1. Main Thread Validation
  if (!isPlainObject(brainOutput.main_thread)) {
    errors.push("main_thread is missing or null in non-degraded output.");
  } else {
    const mt = brainOutput.main_thread as Record<string, unknown>;
    const headline = typeof mt.headline === "string" ? mt.headline.trim() : "";
    const answer = typeof mt.answer === "string" ? mt.answer.trim() : "";
    const regime = typeof mt.regime_implication === "string" ? mt.regime_implication.trim() : "";
    const changeMind = typeof mt.what_would_change_mind === "string" ? mt.what_would_change_mind.trim() : "";

    if (!headline || !answer || !regime || !changeMind) {
      errors.push("main_thread missing required headline, answer, regime_implication, or what_would_change_mind.");
    }

    if (PROBABILITY_CLAIM_REGEX.test(headline) || PROBABILITY_CLAIM_REGEX.test(answer)) {
      errors.push("main_thread contains forbidden explicit numerical probability claim.");
    }

    const mtEvRefs = Array.isArray(mt.evidence_references) ? mt.evidence_references : [];
    if (mtEvRefs.length === 0) {
      errors.push("main_thread evidence_references must not be empty.");
    }
    for (const evId of mtEvRefs) {
      if (typeof evId !== "string" || !indexes.validEvidenceIds.has(evId)) {
        errors.push(`main_thread references unsupported evidence_id "${String(evId)}".`);
      }
    }

    const suppStoryIds = Array.isArray(mt.supporting_story_ids) ? mt.supporting_story_ids : [];
    for (const sId of suppStoryIds) {
      if (typeof sId !== "string" || !validStoryIds.has(sId)) {
        errors.push(`main_thread supporting_story_ids references unknown story_id "${String(sId)}".`);
      }
    }
  }

  // 2. Attention Caps Validation
  if (majorStories.length > MAX_MAJOR_STORIES) {
    errors.push(`major_stories count (${majorStories.length}) exceeds maximum limit of ${MAX_MAJOR_STORIES}.`);
  }

  if (investigations.length > MAX_PRIORITY_INVESTIGATIONS) {
    errors.push(`investigations count (${investigations.length}) exceeds priority limit of ${MAX_PRIORITY_INVESTIGATIONS}.`);
  }

  const researchNow = Array.isArray(brainOutput.research_now) ? brainOutput.research_now : [];
  if (researchNow.length > MAX_RESEARCH_NOW_ACTIONS) {
    errors.push(`research_now count (${researchNow.length}) exceeds limit of ${MAX_RESEARCH_NOW_ACTIONS}.`);
  }

  const stockRadar = Array.isArray(brainOutput.stock_radar) ? brainOutput.stock_radar : [];
  if (stockRadar.length > MAX_STOCK_RADAR_ITEMS) {
    errors.push(`stock_radar count (${stockRadar.length}) exceeds limit of ${MAX_STOCK_RADAR_ITEMS}.`);
  }

  const developingThemes = Array.isArray(brainOutput.developing_themes) ? brainOutput.developing_themes : [];
  if (developingThemes.length > MAX_DEVELOPING_THEMES) {
    errors.push(`developing_themes count (${developingThemes.length}) exceeds limit of ${MAX_DEVELOPING_THEMES}.`);
  }

  const creatorThemeExpansions = Array.isArray(brainOutput.creator_theme_expansions) ? brainOutput.creator_theme_expansions : [];
  if (creatorThemeExpansions.length > MAX_CREATOR_EXPANSIONS) {
    errors.push(`creator_theme_expansions count (${creatorThemeExpansions.length}) exceeds limit of ${MAX_CREATOR_EXPANSIONS}.`);
  }

  const contradictions = Array.isArray(brainOutput.contradictions_detected) ? brainOutput.contradictions_detected : [];
  if (contradictions.length > MAX_CONTRADICTIONS) {
    errors.push(`contradictions_detected count (${contradictions.length}) exceeds limit of ${MAX_CONTRADICTIONS}.`);
  }

  const researchGaps = Array.isArray(brainOutput.research_gaps) ? brainOutput.research_gaps : [];
  if (researchGaps.length > MAX_RESEARCH_GAPS) {
    errors.push(`research_gaps count (${researchGaps.length}) exceeds limit of ${MAX_RESEARCH_GAPS}.`);
  }

  // 3. Major Story Quality Firewall Validation
  for (let sIdx = 0; sIdx < majorStories.length; sIdx++) {
    const story = majorStories[sIdx];
    if (!isPlainObject(story)) {
      errors.push(`major_stories[${sIdx}] is not a plain object.`);
      continue;
    }

    const storyId = typeof story.story_id === "string" ? story.story_id.trim() : `story-${sIdx}`;

    // Explicit Firewall Checks
    const title = typeof story.title === "string" ? story.title.trim() : "";
    const whatChanged = typeof story.what_changed === "string" ? story.what_changed.trim() : "";
    const whyItMatters = typeof story.why_it_matters === "string" ? story.why_it_matters.trim() : "";
    const causalMechanism = typeof story.causal_mechanism === "string" ? story.causal_mechanism.trim() : "";
    const conclusion = typeof story.conclusion === "string" ? story.conclusion.trim() : "";
    const whatWouldChangeMind = typeof story.what_would_change_mind === "string" ? story.what_would_change_mind.trim() : "";

    if (!title || !whatChanged || !whyItMatters || !causalMechanism || !conclusion || !whatWouldChangeMind) {
      errors.push(`major_stories[${sIdx}] (${storyId}) fails Firewall: missing required explicit fields (title, what_changed, why_it_matters, causal_mechanism, conclusion, or what_would_change_mind).`);
    }

    if (PROBABILITY_CLAIM_REGEX.test(title) || PROBABILITY_CLAIM_REGEX.test(whatChanged) || PROBABILITY_CLAIM_REGEX.test(causalMechanism)) {
      errors.push(`major_stories[${sIdx}] (${storyId}) contains forbidden explicit numerical probability claim.`);
    }

    // Check market evidence decomposition
    if (!isPlainObject(story.market_evidence)) {
      errors.push(`major_stories[${sIdx}] (${storyId}) fails Firewall: market_evidence is missing or not a plain object.`);
    } else {
      const me = story.market_evidence as Record<string, unknown>;
      const confirming = Array.isArray(me.confirming) ? me.confirming : [];
      const contradicting = Array.isArray(me.contradicting) ? me.contradicting : [];
      const unresolved = Array.isArray(me.unresolved) ? me.unresolved : [];

      if (confirming.length === 0) {
        errors.push(`major_stories[${sIdx}] (${storyId}) fails Firewall: market_evidence.confirming must not be empty.`);
      }

      for (const evId of [...confirming, ...contradicting]) {
        if (typeof evId !== "string" || !indexes.validEvidenceIds.has(evId)) {
          errors.push(`major_stories[${sIdx}] (${storyId}) market_evidence references unsupported evidence_id "${String(evId)}".`);
        }
      }

      for (const unresId of unresolved) {
        if (typeof unresId !== "string" || (!indexes.validEvidenceIds.has(unresId) && !indexes.validLeadIds.has(unresId))) {
          errors.push(`major_stories[${sIdx}] (${storyId}) market_evidence.unresolved references unsupported ID "${String(unresId)}".`);
        }
      }
    }

    // Epistemic label check
    const epistemicLabel = story.epistemic_label as EpistemicLabel;
    if (epistemicLabel !== "OBSERVED" && epistemicLabel !== "SUPPORTED" && epistemicLabel !== "INFERRED" && epistemicLabel !== "SPECULATIVE") {
      errors.push(`major_stories[${sIdx}] (${storyId}) invalid epistemic_label "${String(story.epistemic_label)}".`);
    }

    const storyEvIds = Array.isArray(story.evidence_ids) ? story.evidence_ids : [];
    if (storyEvIds.length === 0) {
      errors.push(`major_stories[${sIdx}] (${storyId}) evidence_ids must not be empty.`);
    }
    for (const evId of storyEvIds) {
      if (typeof evId !== "string" || !indexes.validEvidenceIds.has(evId)) {
        errors.push(`major_stories[${sIdx}] (${storyId}) references unsupported evidence_id "${String(evId)}".`);
      }
    }

    // Epistemic label rules:
    if (epistemicLabel === "OBSERVED") {
      for (const evId of storyEvIds) {
        if (indexes.validLeadIds.has(evId) || indexes.validPriorClaimIds.has(evId)) {
          errors.push(`major_stories[${sIdx}] OBSERVED story cannot be based on research lead or prior claim "${evId}".`);
        }
      }
    } else if (epistemicLabel === "SUPPORTED") {
      if (storyEvIds.length < 2) {
        errors.push(`major_stories[${sIdx}] SUPPORTED story requires at least two supporting evidence references.`);
      }
    }
  }

  // 4. Dedicated TradingView Chart Queue Validation
  if (!isPlainObject(brainOutput.chart_investigation_queue)) {
    errors.push("chart_investigation_queue is missing or not a plain object.");
  } else {
    const queue = brainOutput.chart_investigation_queue as Record<string, unknown>;
    const core = Array.isArray(queue.core) ? queue.core : [];
    const optional = Array.isArray(queue.optional) ? queue.optional : [];

    if (core.length > EXACT_CORE_CHARTS) {
      errors.push(`chart_investigation_queue.core count (${core.length}) exceeds limit of ${EXACT_CORE_CHARTS}.`);
    }
    if (optional.length > MAX_OPTIONAL_CHARTS) {
      errors.push(`chart_investigation_queue.optional count (${optional.length}) exceeds limit of ${MAX_OPTIONAL_CHARTS}.`);
    }

    const allCharts = [...core, ...optional];
    for (let cIdx = 0; cIdx < allCharts.length; cIdx++) {
      const task = allCharts[cIdx];
      if (!isPlainObject(task)) {
        errors.push(`chart_investigation_queue task[${cIdx}] is not a plain object.`);
        continue;
      }

      const ticker = typeof task.ticker_or_instrument === "string" ? task.ticker_or_instrument.trim() : "";
      const question = typeof task.exact_question === "string" ? task.exact_question.trim() : "";
      const confirmCond = typeof task.confirmation_condition === "string" ? task.confirmation_condition.trim() : "";
      const contradictCond = typeof task.contradiction_condition === "string" ? task.contradiction_condition.trim() : "";

      if (!ticker || VAGUE_PLACEHOLDER_REGEX.test(ticker)) {
        errors.push(`chart task[${cIdx}] missing or vague ticker_or_instrument: "${ticker}".`);
      }
      if (!question || GENERIC_CHART_TASK_REGEX.test(question) || VAGUE_PLACEHOLDER_REGEX.test(question)) {
        errors.push(`chart task[${cIdx}] contains generic or vague exact_question: "${question}".`);
      }
      if (!confirmCond || !contradictCond) {
        errors.push(`chart task[${cIdx}] missing confirmation_condition or contradiction_condition.`);
      }
    }
  }

  // 5. Market Verdict Lenses Validation
  if (!isPlainObject(brainOutput.market_verdict)) {
    errors.push("market_verdict is missing or not a plain object.");
  } else {
    const mv = brainOutput.market_verdict as Record<string, unknown>;
    const lenses = isPlainObject(mv.lenses) ? (mv.lenses as Record<string, Record<string, unknown>>) : {};

    for (const lensName of REQUIRED_VERDICT_LENSES) {
      const lens = lenses[lensName];
      if (!lens || !isPlainObject(lens)) {
        errors.push(`market_verdict missing required lens "${lensName}".`);
        continue;
      }

      if (!indexes.priceDataAvailable && lens.observed_reaction !== null) {
        errors.push(`market_verdict lens "${lensName}" must have null observed_reaction when price evidence is absent.`);
      }
    }

    if (typeof mv.cross_asset_readthrough !== "string" || !(mv.cross_asset_readthrough as string).trim()) {
      errors.push("market_verdict missing required cross_asset_readthrough.");
    }
  }

  // 6. Priority Investigations Validation
  for (let iIdx = 0; iIdx < investigations.length; iIdx++) {
    const inv = investigations[iIdx];
    if (!isPlainObject(inv)) {
      errors.push(`investigations[${iIdx}] is not a plain object.`);
      continue;
    }

    const invId = typeof inv.investigation_id === "string" ? inv.investigation_id.trim() : `inv-${iIdx}`;

    const question = typeof inv.question === "string" ? inv.question.trim() : "";
    const whyItMatters = typeof inv.why_it_matters === "string" ? inv.why_it_matters.trim() : "";
    const currentExplanation = typeof inv.current_explanation === "string" ? inv.current_explanation.trim() : "";
    const researchNext = typeof inv.research_next === "string" ? inv.research_next.trim() : "";

    if (!question || !whyItMatters || !currentExplanation || !researchNext) {
      errors.push(`investigations[${iIdx}] (${invId}) missing required question, why_it_matters, current_explanation, or research_next.`);
    }

    const obsEv = Array.isArray(inv.observed_evidence) ? inv.observed_evidence : [];
    for (const evId of obsEv) {
      if (typeof evId !== "string" || !indexes.validEvidenceIds.has(evId)) {
        errors.push(`investigations[${iIdx}] (${invId}) references unsupported observed_evidence ID "${String(evId)}".`);
      }
    }
  }

  // 7. Stock Radar Semantics Validation
  for (let rIdx = 0; rIdx < stockRadar.length; rIdx++) {
    const item = stockRadar[rIdx];
    if (!isPlainObject(item)) {
      errors.push(`stock_radar[${rIdx}] is not a plain object.`);
      continue;
    }

    const symbol = typeof item.symbol === "string" ? item.symbol.trim() : "";
    const company = typeof item.company_name === "string" ? item.company_name.trim() : "";
    const linkedId = typeof item.linked_main_thread_or_story_id === "string" ? item.linked_main_thread_or_story_id.trim() : "";
    const linkageType = item.linkage_type;

    if (!symbol || !company) {
      errors.push(`stock_radar[${rIdx}] missing symbol or company_name.`);
    }

    if (linkageType !== "LINKED_MAIN_THREAD" && linkageType !== "LINKED_MAJOR_STORY") {
      errors.push(`stock_radar[${rIdx}] (${symbol}) invalid linkage_type "${String(linkageType)}".`);
    } else if (linkageType === "LINKED_MAJOR_STORY" && !validStoryIds.has(linkedId)) {
      errors.push(`stock_radar[${rIdx}] (${symbol}) linked_main_thread_or_story_id "${linkedId}" does not exist in major_stories.`);
    }

    // Check forbidden automatic trading fields
    if ("position_size" in item || "entry_price" in item || "target_price" in item) {
      errors.push(`stock_radar[${rIdx}] (${symbol}) contains forbidden automatic trade execution fields.`);
    }

    const radarEvRefs = Array.isArray(item.evidence_references) ? item.evidence_references : [];
    for (const evId of radarEvRefs) {
      if (typeof evId !== "string" || !indexes.validEvidenceIds.has(evId)) {
        errors.push(`stock_radar[${rIdx}] (${symbol}) references unsupported evidence_reference ID "${String(evId)}".`);
      }
    }
  }

  // 8. Thesis Ledger V2 Evolution Semantics Validation
  if (!isPlainObject(brainOutput.thesis_ledger)) {
    errors.push("thesis_ledger is missing or not a plain object.");
  } else {
    const ledger = brainOutput.thesis_ledger as Record<string, unknown>;
    if (ledger.contract_version !== THESIS_LEDGER_V2_CONTRACT_VERSION) {
      errors.push(`thesis_ledger invalid contract_version: expected "${THESIS_LEDGER_V2_CONTRACT_VERSION}", got "${String(ledger.contract_version)}".`);
    }

    const entries = Array.isArray(ledger.entries) ? ledger.entries : [];
    const entryMap = new Map<string, Record<string, unknown>>();

    for (const e of entries) {
      if (isPlainObject(e) && typeof e.thesis_id === "string") {
        entryMap.set(e.thesis_id, e);
      }
    }

    for (let eIdx = 0; eIdx < entries.length; eIdx++) {
      const entry = entries[eIdx];
      if (!isPlainObject(entry)) {
        errors.push(`thesis_ledger.entries[${eIdx}] is not a plain object.`);
        continue;
      }

      const thesisId = typeof entry.thesis_id === "string" ? entry.thesis_id.trim() : "";
      if (!thesisId) {
        errors.push(`thesis_ledger.entries[${eIdx}] missing required thesis_id.`);
        continue;
      }

      const rootThesisId = typeof entry.root_thesis_id === "string" ? entry.root_thesis_id.trim() : "";
      if (!rootThesisId) {
        errors.push(`thesis_ledger entry (${thesisId}) missing required root_thesis_id.`);
      }

      const parentId = typeof entry.parent_thesis_id === "string" && entry.parent_thesis_id.trim() ? entry.parent_thesis_id.trim() : null;
      const successorId = typeof entry.successor_thesis_id === "string" && entry.successor_thesis_id.trim() ? entry.successor_thesis_id.trim() : null;

      // Reconciled EVOLVED semantics checks:
      if (entry.state === "evolved") {
        if (!successorId) {
          errors.push(`thesis_ledger evolved entry (${thesisId}) must specify successor_thesis_id.`);
        } else {
          if (successorId === thesisId) {
            errors.push(`thesis_ledger evolved entry (${thesisId}) successor_thesis_id cannot be itself; evolved thesis requires a NEW successor thesis ID.`);
          }
          const successorEntry = entryMap.get(successorId);
          if (successorEntry) {
            if (successorEntry.parent_thesis_id !== thesisId) {
              errors.push(`thesis_ledger evolved successor (${successorId}) parent_thesis_id must point back to predecessor (${thesisId}).`);
            }
            if (successorEntry.root_thesis_id !== rootThesisId) {
              errors.push(`thesis_ledger evolved successor (${successorId}) root_thesis_id must match predecessor root_thesis_id (${rootThesisId}).`);
            }
            const predecessorVer = typeof entry.version === "number" ? entry.version : 1;
            const successorVer = typeof successorEntry.version === "number" ? successorEntry.version : 1;
            if (successorVer <= predecessorVer) {
              errors.push(`thesis_ledger evolved successor (${successorId}) version (${successorVer}) must be > predecessor version (${predecessorVer}).`);
            }
          }
        }
      }

      if (parentId === thesisId) {
        errors.push(`thesis_ledger entry (${thesisId}) parent_thesis_id cannot be itself.`);
      }

      const evRefs = Array.isArray(entry.current_evidence_refs) ? entry.current_evidence_refs : [];
      for (const evId of evRefs) {
        if (typeof evId !== "string" || !indexes.validEvidenceIds.has(evId)) {
          errors.push(`thesis_ledger entry (${thesisId}) references unsupported current_evidence_ref "${String(evId)}".`);
        }
      }
    }
  }

  // 9. Contradictions Preservation Check
  if (indexes.validConflictGroupIds.size > 0) {
    const exposedConflictGroups = new Set(
      contradictions
        .map((c) => (isPlainObject(c) && typeof c.conflict_group_id === "string" ? c.conflict_group_id : ""))
        .filter(Boolean),
    );
    for (const packetConflictGroup of indexes.validConflictGroupIds) {
      if (!exposedConflictGroups.has(packetConflictGroup)) {
        errors.push(`Input packet conflict group "${packetConflictGroup}" was not preserved in contradictions_detected.`);
      }
    }
  }

  const isValid = errors.length === 0;

  return {
    isValid,
    errors,
    output: isValid ? (brainOutput as unknown as ResearchBrainOutputV1) : undefined,
  };
}
