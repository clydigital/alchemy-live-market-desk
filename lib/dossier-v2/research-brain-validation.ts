import {
  isPlainObject,
  isValidIsoTimestamp,
  isValidUuid,
} from "./validation.ts";
import type {
  DossierV2InputPacket,
  ObservedEvidence,
  ResearchLead,
  ThesisState,
} from "./input-packet.ts";
import {
  MAX_CAUSAL_LINKS_PER_STORY,
  MAX_CHART_TASKS_PER_INVESTIGATION,
  MAX_CLAIMS_PER_STORY,
  MAX_CONTRADICTIONS,
  MAX_CREATOR_EXPANSIONS,
  MAX_DEVELOPING_THEMES,
  MAX_INVESTIGATIONS,
  MAX_MAJOR_STORIES,
  MAX_OUTPUT_BYTES,
  MAX_RESEARCH_GAPS,
  MAX_STOCK_RADAR_ITEMS,
  RESEARCH_BRAIN_CONTRACT_VERSION,
  RESEARCH_BRAIN_INPUT_CONTRACT_VERSION,
  THESIS_LEDGER_V2_CONTRACT_VERSION,
} from "./research-brain-contracts.ts";
import type {
  AnalyticalClaim,
  CausalLink,
  ChartInvestigation,
  ContradictionDetected,
  CreatorThemeExpansion,
  DevelopingTheme,
  EpistemicLabel,
  Investigation,
  MainThread,
  MajorStory,
  MarketVerdict,
  ResearchBrainInputV1,
  ResearchBrainOutputV1,
  ResearchNow,
  StockRadarItem,
  ThesisLedgerEntryV2,
  ThesisLedgerV2,
} from "./research-brain-contracts.ts";

export interface ValidationIndexes {
  validEvidenceIds: Set<string>;
  validLeadIds: Set<string>;
  validPriorClaimIds: Set<string>;
  validCreatorClaimIds: Set<string>;
  validConflictGroupIds: Set<string>;
  validPriorThesisIds: Set<string>;
  priorThesisMap: Map<string, { version: number; state: string }>;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  output?: ResearchBrainOutputV1;
}

const PROBABILITY_CLAIM_REGEX = /\b(\d+(\.\d+)?%?\s*probability|probability\s*(of|=|:)\s*\d+(\.\d+)?%?|\b\d{1,3}%\s*(chance|likelihood|probability)\b)/i;
const VAGUE_PLACEHOLDER_REGEX = /^(tbd|todo|n\/a|none|chart|unknown|placeholder|\?+)$/i;

export function buildValidationIndexes(packet: DossierV2InputPacket): ValidationIndexes {
  const validEvidenceIds = new Set<string>();
  const validLeadIds = new Set<string>();
  const validPriorClaimIds = new Set<string>();
  const validCreatorClaimIds = new Set<string>();
  const validConflictGroupIds = new Set<string>();
  const validPriorThesisIds = new Set<string>();
  const priorThesisMap = new Map<string, { version: number; state: string }>();

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
          version: entry.version,
          state: entry.state,
        });
      }
    }
  }

  return {
    validEvidenceIds,
    validLeadIds,
    validPriorClaimIds,
    validCreatorClaimIds,
    validConflictGroupIds,
    validPriorThesisIds,
    priorThesisMap,
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

  const packet = input.packet as DossierV2InputPacket;
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

  // Check contract_version
  if (brainOutput.contract_version !== RESEARCH_BRAIN_CONTRACT_VERSION) {
    errors.push(`Invalid contract_version: expected "${RESEARCH_BRAIN_CONTRACT_VERSION}", got "${String(brainOutput.contract_version)}".`);
  }

  // Check as_of
  if (!isValidIsoTimestamp(brainOutput.as_of)) {
    errors.push(`Invalid as_of timestamp: "${String(brainOutput.as_of)}".`);
  } else if (packet.as_of && brainOutput.as_of !== packet.as_of) {
    errors.push(`as_of mismatch: output as_of "${String(brainOutput.as_of)}" does not match packet as_of "${packet.as_of}".`);
  }

  // Check output byte cap
  let jsonBytes = 0;
  try {
    const jsonStr = JSON.stringify(brainOutput);
    jsonBytes = Buffer.byteLength(jsonStr, "utf8");
    if (jsonBytes > MAX_OUTPUT_BYTES) {
      errors.push(`Output JSON size (${jsonBytes} bytes) exceeds limit of ${MAX_OUTPUT_BYTES} bytes.`);
    }
  } catch {
    errors.push("Output is not JSON serializable.");
  }

  const indexes = buildValidationIndexes(packet);
  const outputClaimIds = new Set<string>();

  // Collect all claim IDs in stories for cross-referencing
  const majorStories = Array.isArray(brainOutput.major_stories) ? brainOutput.major_stories : [];
  for (const story of majorStories) {
    if (isPlainObject(story) && Array.isArray(story.core_claims)) {
      for (const claim of story.core_claims) {
        if (isPlainObject(claim) && typeof claim.claim_id === "string") {
          outputClaimIds.add(claim.claim_id);
        }
      }
    }
  }

  // Check 1: Attention Caps
  if (majorStories.length > MAX_MAJOR_STORIES) {
    errors.push(`major_stories count (${majorStories.length}) exceeds attention limit of ${MAX_MAJOR_STORIES}.`);
  }

  const investigations = Array.isArray(brainOutput.investigations) ? brainOutput.investigations : [];
  if (investigations.length > MAX_INVESTIGATIONS) {
    errors.push(`investigations count (${investigations.length}) exceeds attention limit of ${MAX_INVESTIGATIONS}.`);
  }

  const stockRadar = Array.isArray(brainOutput.stock_radar) ? brainOutput.stock_radar : [];
  if (stockRadar.length > MAX_STOCK_RADAR_ITEMS) {
    errors.push(`stock_radar count (${stockRadar.length}) exceeds attention limit of ${MAX_STOCK_RADAR_ITEMS}.`);
  }

  const developingThemes = Array.isArray(brainOutput.developing_themes) ? brainOutput.developing_themes : [];
  if (developingThemes.length > MAX_DEVELOPING_THEMES) {
    errors.push(`developing_themes count (${developingThemes.length}) exceeds attention limit of ${MAX_DEVELOPING_THEMES}.`);
  }

  const creatorThemeExpansions = Array.isArray(brainOutput.creator_theme_expansions) ? brainOutput.creator_theme_expansions : [];
  if (creatorThemeExpansions.length > MAX_CREATOR_EXPANSIONS) {
    errors.push(`creator_theme_expansions count (${creatorThemeExpansions.length}) exceeds attention limit of ${MAX_CREATOR_EXPANSIONS}.`);
  }

  const contradictions = Array.isArray(brainOutput.contradictions_detected) ? brainOutput.contradictions_detected : [];
  if (contradictions.length > MAX_CONTRADICTIONS) {
    errors.push(`contradictions_detected count (${contradictions.length}) exceeds limit of ${MAX_CONTRADICTIONS}.`);
  }

  const researchGaps = Array.isArray(brainOutput.research_gaps) ? brainOutput.research_gaps : [];
  if (researchGaps.length > MAX_RESEARCH_GAPS) {
    errors.push(`research_gaps count (${researchGaps.length}) exceeds limit of ${MAX_RESEARCH_GAPS}.`);
  }

  // Check 2: Major Stories & Claims Validation (Firewall + Epistemic Separation + Evidence Integrity)
  for (let sIdx = 0; sIdx < majorStories.length; sIdx++) {
    const story = majorStories[sIdx];
    if (!isPlainObject(story)) {
      errors.push(`major_stories[${sIdx}] is not a plain object.`);
      continue;
    }

    const storyTitle = typeof story.title === "string" ? story.title.trim() : "";
    const storySummary = typeof story.summary === "string" ? story.summary.trim() : "";
    const storyId = typeof story.story_id === "string" ? story.story_id.trim() : `story-${sIdx}`;

    if (!storyTitle) {
      errors.push(`major_stories[${sIdx}] missing required title.`);
    }
    if (!storySummary) {
      errors.push(`major_stories[${sIdx}] (${storyId}) missing required summary.`);
    }

    if (PROBABILITY_CLAIM_REGEX.test(storyTitle) || PROBABILITY_CLAIM_REGEX.test(storySummary)) {
      errors.push(`major_stories[${sIdx}] (${storyId}) contains explicit numerical probability claim.`);
    }

    const storyEvidenceIds = Array.isArray(story.evidence_ids) ? story.evidence_ids : [];
    if (storyEvidenceIds.length === 0) {
      errors.push(`major_stories[${sIdx}] (${storyId}) fails Firewall: no evidence_ids supplied.`);
    }
    for (const evId of storyEvidenceIds) {
      if (typeof evId !== "string" || !indexes.validEvidenceIds.has(evId)) {
        errors.push(`major_stories[${sIdx}] (${storyId}) references unsupported evidence_id "${String(evId)}".`);
      }
    }

    const coreClaims = Array.isArray(story.core_claims) ? story.core_claims : [];
    if (coreClaims.length === 0) {
      errors.push(`major_stories[${sIdx}] (${storyId}) fails Firewall: no core_claims provided.`);
    } else if (coreClaims.length > MAX_CLAIMS_PER_STORY) {
      errors.push(`major_stories[${sIdx}] (${storyId}) core_claims count (${coreClaims.length}) exceeds limit of ${MAX_CLAIMS_PER_STORY}.`);
    }

    const storyClaimIds = new Set<string>();

    for (let cIdx = 0; cIdx < coreClaims.length; cIdx++) {
      const claim = coreClaims[cIdx];
      if (!isPlainObject(claim)) {
        errors.push(`major_stories[${sIdx}].core_claims[${cIdx}] is not a plain object.`);
        continue;
      }

      const claimId = typeof claim.claim_id === "string" ? claim.claim_id.trim() : `claim-${cIdx}`;
      storyClaimIds.add(claimId);

      const claimText = typeof claim.claim_text === "string" ? claim.claim_text.trim() : "";
      if (!claimText) {
        errors.push(`major_stories[${sIdx}].core_claims[${cIdx}] (${claimId}) missing claim_text.`);
      }

      if (PROBABILITY_CLAIM_REGEX.test(claimText)) {
        errors.push(`major_stories[${sIdx}].core_claims[${cIdx}] (${claimId}) contains forbidden numerical probability claim: "${claimText}".`);
      }

      const epistemicLabel = claim.epistemic_label as EpistemicLabel;
      if (epistemicLabel !== "OBSERVED" && epistemicLabel !== "SUPPORTED" && epistemicLabel !== "INFERRED" && epistemicLabel !== "SPECULATIVE") {
        errors.push(`major_stories[${sIdx}].core_claims[${cIdx}] (${claimId}) invalid epistemic_label "${String(claim.epistemic_label)}".`);
      }

      const claimEvIds = Array.isArray(claim.evidence_ids) ? claim.evidence_ids : [];
      for (const evId of claimEvIds) {
        if (typeof evId !== "string" || !indexes.validEvidenceIds.has(evId)) {
          errors.push(`major_stories[${sIdx}].core_claims[${cIdx}] (${claimId}) references unsupported evidence_id "${String(evId)}".`);
        }
        if (indexes.validLeadIds.has(evId as string)) {
          errors.push(`major_stories[${sIdx}].core_claims[${cIdx}] (${claimId}) invalidly references research lead "${String(evId)}" in evidence_ids.`);
        }
      }

      const priorClaimIds = Array.isArray(claim.prior_claim_ids) ? claim.prior_claim_ids : [];
      for (const pcId of priorClaimIds) {
        if (typeof pcId !== "string" || !indexes.validPriorClaimIds.has(pcId)) {
          errors.push(`major_stories[${sIdx}].core_claims[${cIdx}] (${claimId}) references unsupported prior_claim_id "${String(pcId)}".`);
        }
      }

      // Epistemic separation rules:
      if (epistemicLabel === "OBSERVED") {
        if (claimEvIds.length === 0) {
          errors.push(`OBSERVED claim (${claimId}) must cite at least one current observed evidence_id.`);
        }
        if (priorClaimIds.length > 0) {
          errors.push(`OBSERVED claim (${claimId}) cannot cite prior_claim_ids; prior state is historical analytical state.`);
        }
      }
    }

    const causalLinks = Array.isArray(story.causal_links) ? story.causal_links : [];
    if (causalLinks.length > MAX_CAUSAL_LINKS_PER_STORY) {
      errors.push(`major_stories[${sIdx}] (${storyId}) causal_links count (${causalLinks.length}) exceeds limit of ${MAX_CAUSAL_LINKS_PER_STORY}.`);
    }

    for (let lIdx = 0; lIdx < causalLinks.length; lIdx++) {
      const link = causalLinks[lIdx];
      if (!isPlainObject(link)) {
        errors.push(`major_stories[${sIdx}].causal_links[${lIdx}] is not a plain object.`);
        continue;
      }
      const causeId = typeof link.cause_claim_id === "string" ? link.cause_claim_id : "";
      const effectId = typeof link.effect_claim_id === "string" ? link.effect_claim_id : "";

      if (!causeId || (!storyClaimIds.has(causeId) && !outputClaimIds.has(causeId))) {
        errors.push(`major_stories[${sIdx}].causal_links[${lIdx}] references unknown cause_claim_id "${causeId}".`);
      }
      if (!effectId || (!storyClaimIds.has(effectId) && !outputClaimIds.has(effectId))) {
        errors.push(`major_stories[${sIdx}].causal_links[${lIdx}] references unknown effect_claim_id "${effectId}".`);
      }

      const linkEvIds = Array.isArray(link.evidence_ids) ? link.evidence_ids : [];
      for (const evId of linkEvIds) {
        if (typeof evId !== "string" || !indexes.validEvidenceIds.has(evId)) {
          errors.push(`major_stories[${sIdx}].causal_links[${lIdx}] references unsupported evidence_id "${String(evId)}".`);
        }
      }
    }
  }

  // Check 3: Investigations & Chart Task Specificity
  for (let iIdx = 0; iIdx < investigations.length; iIdx++) {
    const inv = investigations[iIdx];
    if (!isPlainObject(inv)) {
      errors.push(`investigations[${iIdx}] is not a plain object.`);
      continue;
    }

    const invTitle = typeof inv.title === "string" ? inv.title.trim() : "";
    const invId = typeof inv.investigation_id === "string" ? inv.investigation_id.trim() : `inv-${iIdx}`;

    if (!invTitle) {
      errors.push(`investigations[${iIdx}] missing required title.`);
    }

    const invEvIds = Array.isArray(inv.evidence_ids) ? inv.evidence_ids : [];
    for (const evId of invEvIds) {
      if (typeof evId !== "string" || !indexes.validEvidenceIds.has(evId)) {
        errors.push(`investigations[${iIdx}] (${invId}) references unsupported evidence_id "${String(evId)}".`);
      }
    }

    const leadsRef = Array.isArray(inv.leads_referenced) ? inv.leads_referenced : [];
    for (const lId of leadsRef) {
      if (typeof lId !== "string" || !indexes.validLeadIds.has(lId)) {
        errors.push(`investigations[${iIdx}] (${invId}) references unsupported lead_id "${String(lId)}".`);
      }
    }

    const chartTasks = Array.isArray(inv.chart_tasks) ? inv.chart_tasks : [];
    if (chartTasks.length > MAX_CHART_TASKS_PER_INVESTIGATION) {
      errors.push(`investigations[${iIdx}] (${invId}) chart_tasks count (${chartTasks.length}) exceeds limit of ${MAX_CHART_TASKS_PER_INVESTIGATION}.`);
    }

    for (let ctIdx = 0; ctIdx < chartTasks.length; ctIdx++) {
      const ct = chartTasks[ctIdx];
      if (!isPlainObject(ct)) {
        errors.push(`investigations[${iIdx}].chart_tasks[${ctIdx}] is not a plain object.`);
        continue;
      }

      const symbol = typeof ct.symbol_or_instrument === "string" ? ct.symbol_or_instrument.trim() : "";
      const timeframe = typeof ct.timeframe === "string" ? ct.timeframe.trim() : "";
      const metric = typeof ct.metric_or_relationship === "string" ? ct.metric_or_relationship.trim() : "";
      const hypothesis = typeof ct.hypothesis_to_test === "string" ? ct.hypothesis_to_test.trim() : "";

      if (!symbol || VAGUE_PLACEHOLDER_REGEX.test(symbol)) {
        errors.push(`investigations[${iIdx}] chart_task[${ctIdx}] has vague or missing symbol_or_instrument: "${symbol}".`);
      }
      if (!timeframe || VAGUE_PLACEHOLDER_REGEX.test(timeframe)) {
        errors.push(`investigations[${iIdx}] chart_task[${ctIdx}] has vague or missing timeframe: "${timeframe}".`);
      }
      if (!metric || VAGUE_PLACEHOLDER_REGEX.test(metric)) {
        errors.push(`investigations[${iIdx}] chart_task[${ctIdx}] has vague or missing metric_or_relationship: "${metric}".`);
      }
      if (!hypothesis || VAGUE_PLACEHOLDER_REGEX.test(hypothesis)) {
        errors.push(`investigations[${iIdx}] chart_task[${ctIdx}] has vague or missing hypothesis_to_test: "${hypothesis}".`);
      }
    }
  }

  // Check 4: Stock Radar Linkage
  for (let rIdx = 0; rIdx < stockRadar.length; rIdx++) {
    const item = stockRadar[rIdx];
    if (!isPlainObject(item)) {
      errors.push(`stock_radar[${rIdx}] is not a plain object.`);
      continue;
    }

    const symbol = typeof item.symbol === "string" ? item.symbol.trim() : "";
    const company = typeof item.company_or_asset === "string" ? item.company_or_asset.trim() : "";

    if (!symbol || !company) {
      errors.push(`stock_radar[${rIdx}] missing symbol or company_or_asset.`);
    }

    const itemEvIds = Array.isArray(item.evidence_ids) ? item.evidence_ids : [];
    const itemClaimIds = Array.isArray(item.supporting_claim_ids) ? item.supporting_claim_ids : [];

    if (itemEvIds.length === 0 && itemClaimIds.length === 0) {
      errors.push(`stock_radar[${rIdx}] (${symbol}) must link to at least one supporting_claim_id or evidence_id.`);
    }

    for (const evId of itemEvIds) {
      if (typeof evId !== "string" || !indexes.validEvidenceIds.has(evId)) {
        errors.push(`stock_radar[${rIdx}] (${symbol}) references unsupported evidence_id "${String(evId)}".`);
      }
    }

    for (const cId of itemClaimIds) {
      if (typeof cId !== "string" || !outputClaimIds.has(cId)) {
        errors.push(`stock_radar[${rIdx}] (${symbol}) references unknown supporting_claim_id "${String(cId)}".`);
      }
    }
  }

  // Check 5: Developing Themes Validation
  for (let tIdx = 0; tIdx < developingThemes.length; tIdx++) {
    const theme = developingThemes[tIdx];
    if (!isPlainObject(theme)) {
      errors.push(`developing_themes[${tIdx}] is not a plain object.`);
      continue;
    }
    const themeEvIds = Array.isArray(theme.supporting_evidence_ids) ? theme.supporting_evidence_ids : [];
    for (const evId of themeEvIds) {
      if (typeof evId !== "string" || !indexes.validEvidenceIds.has(evId)) {
        errors.push(`developing_themes[${tIdx}] references unsupported supporting_evidence_id "${String(evId)}".`);
      }
    }
  }

  // Check 6: Creator Theme Expansions Validation
  for (let eIdx = 0; eIdx < creatorThemeExpansions.length; eIdx++) {
    const exp = creatorThemeExpansions[eIdx];
    if (!isPlainObject(exp)) {
      errors.push(`creator_theme_expansions[${eIdx}] is not a plain object.`);
      continue;
    }
    const claimsRef = Array.isArray(exp.creator_claims_referenced) ? exp.creator_claims_referenced : [];
    for (const claimId of claimsRef) {
      if (typeof claimId !== "string" || !indexes.validCreatorClaimIds.has(claimId)) {
        errors.push(`creator_theme_expansions[${eIdx}] references unsupported creator_claim_id "${String(claimId)}".`);
      }
    }
  }

  // Check 7: Contradiction Preservation
  for (let cIdx = 0; cIdx < contradictions.length; cIdx++) {
    const contradiction = contradictions[cIdx];
    if (!isPlainObject(contradiction)) {
      errors.push(`contradictions_detected[${cIdx}] is not a plain object.`);
      continue;
    }
    const confEvIds = Array.isArray(contradiction.conflicting_evidence_ids) ? contradiction.conflicting_evidence_ids : [];
    for (const evId of confEvIds) {
      if (typeof evId !== "string" || !indexes.validEvidenceIds.has(evId)) {
        errors.push(`contradictions_detected[${cIdx}] references unsupported conflicting_evidence_id "${String(evId)}".`);
      }
    }
  }

  // Verify that all input packet conflict groups are preserved / exposed
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

  // Check 8: Thesis Ledger V2 Lineage and Versioning
  if (!isPlainObject(brainOutput.thesis_ledger)) {
    errors.push("thesis_ledger is missing or not a plain object.");
  } else {
    const ledger = brainOutput.thesis_ledger as Record<string, unknown>;
    if (ledger.contract_version !== THESIS_LEDGER_V2_CONTRACT_VERSION) {
      errors.push(`thesis_ledger invalid contract_version: expected "${THESIS_LEDGER_V2_CONTRACT_VERSION}", got "${String(ledger.contract_version)}".`);
    }

    const entries = Array.isArray(ledger.entries) ? ledger.entries : [];
    const ledgerThesisIds = new Set<string>();

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
      ledgerThesisIds.add(thesisId);

      const title = typeof entry.title === "string" ? entry.title.trim() : "";
      const statement = typeof entry.statement === "string" ? entry.statement.trim() : "";

      if (!title || !statement) {
        errors.push(`thesis_ledger.entries[${eIdx}] (${thesisId}) missing title or statement.`);
      }

      if (PROBABILITY_CLAIM_REGEX.test(title) || PROBABILITY_CLAIM_REGEX.test(statement)) {
        errors.push(`thesis_ledger.entries[${eIdx}] (${thesisId}) contains explicit numerical probability claim.`);
      }

      const lineage = Array.isArray(entry.lineage) ? entry.lineage : [];

      // Lineage check 1: Self-reference
      if (lineage.includes(thesisId)) {
        errors.push(`thesis_ledger entry (${thesisId}) contains self-reference in lineage.`);
      }

      // Lineage check 2: Cycle detection
      const visited = new Set<string>([thesisId]);
      for (const lin of lineage) {
        if (typeof lin === "string" && visited.has(lin)) {
          errors.push(`thesis_ledger entry (${thesisId}) contains cycle in lineage involving "${lin}".`);
        }
      }

      // Versioning and Evolved state check
      const version = typeof entry.version === "number" ? entry.version : 0;
      if (version < 1) {
        errors.push(`thesis_ledger entry (${thesisId}) version must be >= 1.`);
      }

      const priorInfo = indexes.priorThesisMap.get(thesisId);
      if (priorInfo) {
        if (entry.state === "evolved" && version <= priorInfo.version) {
          errors.push(`thesis_ledger entry (${thesisId}) evolved state requires version (${version}) > prior version (${priorInfo.version}).`);
        }
      } else if (entry.state === "evolved") {
        if (lineage.length === 0) {
          errors.push(`thesis_ledger evolved entry (${thesisId}) must reference parent thesis in lineage.`);
        }
      }

      const supClaimIds = Array.isArray(entry.supporting_claim_ids) ? entry.supporting_claim_ids : [];
      for (const cId of supClaimIds) {
        if (typeof cId !== "string" || !outputClaimIds.has(cId)) {
          errors.push(`thesis_ledger entry (${thesisId}) references unknown supporting_claim_id "${String(cId)}".`);
        }
      }

      const countClaimIds = Array.isArray(entry.counter_claim_ids) ? entry.counter_claim_ids : [];
      for (const cId of countClaimIds) {
        if (typeof cId !== "string" || !outputClaimIds.has(cId)) {
          errors.push(`thesis_ledger entry (${thesisId}) references unknown counter_claim_id "${String(cId)}".`);
        }
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
