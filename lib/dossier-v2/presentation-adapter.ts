import type { MarketDossierV2 } from "./contracts.ts";
import type { DossierPolicyOutlookItem } from "./policy-outlook.ts";
import type {
  PolicyLiquidityInteraction,
  System1DollarLiquiditySnapshot,
} from "./system1-dollar-liquidity.ts";
import type {
  ChartTask,
  CreatorThemeExpansion,
  DevelopingTheme,
  EpistemicLabel,
  Investigation,
  MajorStory,
  MarketLens,
  RegimeFamily,
  ResearchBrainOutputV1,
  ResearchNowAction,
  StockRadarItem,
  ThesisLedgerEntryV2,
} from "./research-brain-contracts.ts";

export const DOSSIER_PRESENTATION_V1 = "dossier-presentation/1" as const;

export type DossierPresentationHealth = {
  state: "healthy" | "degraded";
  degraded: boolean;
  repairUsed: boolean;
  freshnessWarnings: string[];
  researchGaps: Array<{
    id: string;
    category: string;
    severity: string;
    description: string;
  }>;
  missingInputCategories: string[];
};

export type DossierPresentationLens = {
  key: string;
  label: string;
  observed: boolean;
  reaction: string | null;
  interpretation: string;
  evidenceRefs: string[];
  unresolvedSignals: string[];
};

export type DossierRateRegime = {
  contractVersion?: string;
  asOf?: string;
  state: "HAWKISH" | "DOVISH" | "NEUTRAL" | "MIXED" | "UNRESOLVED";
  score?: number;
  confidence?: "HIGH" | "MEDIUM" | "LOW" | "UNRESOLVED";
  summary?: string;
  nextMeetingRateOutlook: "MORE_HAWKISH" | "MORE_DOVISH" | null;
  fedWatchExpectedDirection: "HIKE_ODDS_UP" | "HIKE_ODDS_DOWN" | null;
  trigger: string | null;
  observedRatePricing: string | null;
  observedConfirmation: string | null;
  usRatesReaction: string | null;
  usRatesInterpretation: string | null;
  fredBacked: boolean;
  curve?: {
    spreadBps: number | null;
    state: "INVERTED" | "FLAT" | "POSITIVE" | "UNRESOLVED";
    detail: string;
    evidenceRefs: string[];
  };
  signals?: Array<{
    key: string;
    label: string;
    state: "HAWKISH" | "DOVISH" | "NEUTRAL" | "MIXED" | "UNRESOLVED";
    score: number;
    detail: string;
    evidenceRefs: string[];
  }>;
  drivers?: string[];
  contradictions?: string[];
  coverage?: {
    present: number;
    total: number;
    missing: string[];
  };
  evidenceRefs: string[];
  gaps: string[];
};

export type DossierPresentationStory = {
  id: string;
  title: string;
  whatChanged: string;
  whyItMatters: string;
  mechanism: string;
  conclusion: string;
  whatWouldChangeMind: string;
  epistemicLabel: EpistemicLabel;
  evidenceRefs: string[];
  investigationIds: string[];
  chartIds: string[];
};

export type DossierPresentationInvestigation = {
  id: string;
  status: Investigation["status"];
  question: string;
  whyItMatters: string;
  currentExplanation: string;
  competingExplanations: string[];
  researchNext: string;
  confirmationCondition: string;
  invalidationCondition: string;
  evidenceRefs: string[];
  missingEvidence: string[];
  chartIds: string[];
  storyIds: string[];
};

export type DossierPresentationChart = ChartTask & {
  lane: "core" | "optional";
};

export type DossierPresentationThesisChange = {
  thesisId: string;
  title: string;
  statement: string;
  state: ThesisLedgerEntryV2["state"];
  previousState: ThesisLedgerEntryV2["state"] | null;
  version: number;
  previousVersion: number | null;
  change: "new" | "state_changed" | "version_changed";
  reason: string;
  nextCatalystOrTripwire: string;
  evidenceRefs: string[];
};

export type DossierPresentationEvidenceRef = {
  evidenceId: string;
  usedIn: string[];
};

export type DossierPresentationV1 = {
  contractVersion: typeof DOSSIER_PRESENTATION_V1;
  dossierId: string;
  previousDossierId: string | null;
  asOf: string;
  createdAt: string;

  health: DossierPresentationHealth;

  header: {
    headline: string;
    answer: string;
    regimeImplication: string;
    regimeFamily: RegimeFamily;
    epistemicLabel: EpistemicLabel;
    whatWouldChangeMind: string;
  };

  regimeStrip: DossierPresentationLens[];
  policyOutlook: DossierPolicyOutlookItem[];
  rateRegime: DossierRateRegime;
  dollarLiquidity: System1DollarLiquiditySnapshot | null;
  policyLiquidityInteraction: PolicyLiquidityInteraction | null;

  whatMattersNow: {
    leadThreadId: string;
    supportingStoryIds: string[];
    stories: DossierPresentationStory[];
  };

  watchNext: DossierPresentationInvestigation[];
  researchNow: ResearchNowAction[];

  charts: {
    core: DossierPresentationChart[];
    optional: DossierPresentationChart[];
  };

  stockRadar: StockRadarItem[];
  themes: DevelopingTheme[];
  creatorThemes: CreatorThemeExpansion[];
  thesisChanges: DossierPresentationThesisChange[];

  evidenceIndex: DossierPresentationEvidenceRef[];

  diagnostics: {
    modelRepairUsed: boolean;
    notes: string[];
    omittedOrDemotedItems: string[];
  };
};

const REGIME_LENS_ORDER = [
  "US_RATES",
  "BONDS",
  "USD",
  "GOLD",
  "CREDIT",
  "TECH_AI",
  "BREADTH",
  "OIL_WAR_INFLATION",
] as const;

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function analyticalOutput(dossier: MarketDossierV2): ResearchBrainOutputV1 {
  const value = dossier.payload.analytical_output;
  if (!isObject(value)) {
    throw new Error(`Dossier ${dossier.id} has no analytical_output payload.`);
  }

  const mainThread = value.main_thread;
  if (!isObject(mainThread) || typeof mainThread.headline !== "string") {
    throw new Error(`Dossier ${dossier.id} has an invalid analytical_output payload.`);
  }

  return value as unknown as ResearchBrainOutputV1;
}

function freshnessWarnings(dossier: MarketDossierV2): string[] {
  const warnings = Array.isArray(dossier.freshness.warnings)
    ? dossier.freshness.warnings
    : [];

  return warnings.flatMap((warning) => {
    if (typeof warning === "string" && warning.trim()) return [warning.trim()];
    if (!isObject(warning)) return [];
    const message = typeof warning.message === "string" ? warning.message.trim() : "";
    return message ? [message] : [];
  });
}

function policyOutlook(dossier: MarketDossierV2): DossierPolicyOutlookItem[] {
  const value = dossier.payload.system1_policy_outlook;
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isObject(item) || typeof item.id !== "string" || typeof item.trigger !== "string") return [];
    return [item as unknown as DossierPolicyOutlookItem];
  }).slice(0, 3);
}

function rateRegime(
  dossier: MarketDossierV2,
  outlook: DossierPolicyOutlookItem[],
  lenses: DossierPresentationLens[],
): DossierRateRegime {
  const stored = dossier.payload.system1_rate_regime;
  if (
    isObject(stored) &&
    typeof stored.state === "string" &&
    Array.isArray(stored.evidenceRefs) &&
    Array.isArray(stored.gaps)
  ) {
    return stored as unknown as DossierRateRegime;
  }

  const ratesLens = lenses.find((lens) => lens.key === "US_RATES") ?? null;
  const primary = outlook[0] ?? null;
  const impulses = new Set(outlook.map((item) => item.policyImpulse));
  const state: DossierRateRegime["state"] = impulses.size === 0
    ? "UNRESOLVED"
    : impulses.size === 1
      ? ([...impulses][0] as "HAWKISH" | "DOVISH")
      : "MIXED";

  const evidenceRefs = [...new Set([
    ...(ratesLens?.evidenceRefs ?? []),
    ...(primary ? [
      primary.triggerEvidenceRef,
      primary.observedRatePricingEvidenceRef,
      primary.observedConfirmationEvidenceRef,
    ] : []),
  ].filter((value): value is string => typeof value === "string" && Boolean(value)))];

  const gaps = [...new Set([
    ...(primary?.gaps ?? []),
    ...(ratesLens?.unresolvedSignals ?? []),
  ].filter((value) => Boolean(value)))];

  return {
    state,
    nextMeetingRateOutlook: primary?.nextMeetingRateOutlook ?? null,
    fedWatchExpectedDirection: primary?.fedWatchExpectedDirection ?? null,
    trigger: primary?.trigger ?? null,
    observedRatePricing: primary?.observedRatePricing ?? null,
    observedConfirmation: primary?.observedConfirmation ?? null,
    usRatesReaction: ratesLens?.reaction ?? null,
    usRatesInterpretation: ratesLens?.interpretation ?? null,
    fredBacked: evidenceRefs.some((id) => /^market-monitor:us2y(?::|$)/i.test(id)),
    evidenceRefs,
    gaps,
  };
}

function dollarLiquidity(dossier: MarketDossierV2): System1DollarLiquiditySnapshot | null {
  const value = dossier.payload.system1_dollar_liquidity;
  if (
    !isObject(value)
    || value.contractVersion !== "system1-dollar-liquidity/1"
    || typeof value.state !== "string"
    || !Array.isArray(value.components)
  ) return null;
  return value as unknown as System1DollarLiquiditySnapshot;
}

function policyLiquidityInteraction(dossier: MarketDossierV2): PolicyLiquidityInteraction | null {
  const value = dossier.payload.system1_policy_liquidity_interaction;
  if (
    !isObject(value)
    || typeof value.policyState !== "string"
    || typeof value.liquidityState !== "string"
    || typeof value.alignment !== "string"
  ) return null;
  return value as unknown as PolicyLiquidityInteraction;
}

function researchGaps(dossier: MarketDossierV2) {
  return dossier.research_gaps.flatMap((gap, index) => {
    if (!isObject(gap)) return [];
    const severity = typeof gap.severity === "string" ? gap.severity.trim().toUpperCase() : "";
    // Edition-level health is reserved for conclusion-blocking MATERIAL gaps.
    // Older nonblocking refinement gaps remain available in the persisted audit
    // record but are not promoted into the reader-facing Live/Hybrid count.
    if (severity !== "MATERIAL") return [];
    const description = typeof gap.description === "string" ? gap.description.trim() : "";
    if (!description) return [];
    return [{
      id: typeof gap.gap_id === "string" && gap.gap_id.trim() ? gap.gap_id : `gap-${index + 1}`,
      category: typeof gap.category === "string" ? gap.category : "Uncategorised",
      severity,
      description,
    }];
  });
}

function presentationStory(story: MajorStory): DossierPresentationStory {
  return {
    id: story.story_id,
    title: story.title,
    whatChanged: story.what_changed,
    whyItMatters: story.why_it_matters,
    mechanism: story.causal_mechanism,
    conclusion: story.conclusion,
    whatWouldChangeMind: story.what_would_change_mind,
    epistemicLabel: story.epistemic_label,
    evidenceRefs: [...story.evidence_ids],
    investigationIds: [...story.linked_investigation_ids],
    chartIds: [...story.linked_chart_task_ids],
  };
}

function presentationInvestigation(item: Investigation): DossierPresentationInvestigation {
  return {
    id: item.investigation_id,
    status: item.status,
    question: item.question,
    whyItMatters: item.why_it_matters,
    currentExplanation: item.current_explanation,
    competingExplanations: [...item.competing_explanations],
    researchNext: item.research_next,
    confirmationCondition: item.confirmation_condition,
    invalidationCondition: item.invalidation_condition,
    evidenceRefs: [...item.observed_evidence],
    missingEvidence: [...item.missing_evidence],
    chartIds: [...item.chart_task_links],
    storyIds: [...item.linked_story_ids],
  };
}

function lensEntries(output: ResearchBrainOutputV1): DossierPresentationLens[] {
  const source = output.market_verdict.lenses ?? {};
  const known = new Set<string>();
  const result: DossierPresentationLens[] = [];

  const pushLens = (key: string, lens: MarketLens | undefined) => {
    if (!lens) return;
    known.add(key);
    result.push({
      key,
      label: lens.lens_name || key,
      observed: Boolean(lens.observed_reaction),
      reaction: lens.observed_reaction,
      interpretation: lens.interpretation,
      evidenceRefs: [...lens.observed_reaction_evidence_refs],
      unresolvedSignals: [...lens.unresolved_signals],
    });
  };

  for (const key of REGIME_LENS_ORDER) {
    pushLens(key, source[key]);
  }

  for (const key of Object.keys(source).sort()) {
    if (!known.has(key)) pushLens(key, source[key]);
  }

  return result;
}

function thesisMap(output: ResearchBrainOutputV1 | null) {
  return new Map(
    (output?.thesis_ledger?.entries ?? []).map((entry) => [entry.thesis_id, entry]),
  );
}

function thesisChanges(
  current: ResearchBrainOutputV1,
  previous: ResearchBrainOutputV1 | null,
): DossierPresentationThesisChange[] {
  const prior = thesisMap(previous);
  const result: DossierPresentationThesisChange[] = [];

  for (const entry of current.thesis_ledger.entries) {
    const before = prior.get(entry.thesis_id) ?? null;
    let change: DossierPresentationThesisChange["change"] | null = null;

    if (!before) change = "new";
    else if (before.state !== entry.state) change = "state_changed";
    else if (before.version !== entry.version) change = "version_changed";

    if (!change) continue;

    result.push({
      thesisId: entry.thesis_id,
      title: entry.title,
      statement: entry.statement,
      state: entry.state,
      previousState: before?.state ?? null,
      version: entry.version,
      previousVersion: before?.version ?? null,
      change,
      reason: entry.state_reason,
      nextCatalystOrTripwire: entry.next_catalyst_or_tripwire,
      evidenceRefs: [...entry.current_evidence_refs],
    });
  }

  return result.sort((a, b) =>
    b.version - a.version || a.thesisId.localeCompare(b.thesisId)
  );
}

function evidenceIndex(output: ResearchBrainOutputV1): DossierPresentationEvidenceRef[] {
  const usage = new Map<string, Set<string>>();
  const add = (ids: string[], section: string) => {
    for (const id of ids) {
      if (!id) continue;
      const sections = usage.get(id) ?? new Set<string>();
      sections.add(section);
      usage.set(id, sections);
    }
  };

  add(output.main_thread.evidence_references, "main_thread");

  for (const story of output.major_stories) {
    add(story.evidence_ids, `story:${story.story_id}`);
  }

  for (const [key, lens] of Object.entries(output.market_verdict.lenses)) {
    add(lens.observed_reaction_evidence_refs, `lens:${key}`);
  }

  for (const item of output.investigations) {
    add(item.observed_evidence, `investigation:${item.investigation_id}`);
  }

  for (const item of output.stock_radar) {
    add(item.evidence_references, `stock:${item.symbol}`);
  }

  for (const theme of output.developing_themes) {
    add(theme.supporting_evidence_ids, `theme:${theme.theme_id}`);
  }

  for (const thesis of output.thesis_ledger.entries) {
    add(thesis.current_evidence_refs, `thesis:${thesis.thesis_id}`);
  }

  for (const contradiction of output.contradictions_detected) {
    add(contradiction.conflicting_evidence_ids, `contradiction:${contradiction.conflict_group_id}`);
  }

  return [...usage.entries()]
    .map(([evidenceId, sections]) => ({
      evidenceId,
      usedIn: [...sections].sort(),
    }))
    .sort((a, b) => a.evidenceId.localeCompare(b.evidenceId));
}

export function buildDossierV2Presentation(
  dossier: MarketDossierV2,
  previousDossier?: MarketDossierV2 | null,
): DossierPresentationV1 {
  const output = analyticalOutput(dossier);
  const previousOutput = previousDossier ? analyticalOutput(previousDossier) : null;

  const warnings = freshnessWarnings(dossier);
  const gaps = researchGaps(dossier);
  const degraded = Boolean(output.diagnostics.degraded);
  const lenses = lensEntries(output);
  const outlook = policyOutlook(dossier);

  return {
    contractVersion: DOSSIER_PRESENTATION_V1,
    dossierId: dossier.id,
    previousDossierId: dossier.previous_dossier_id,
    asOf: dossier.as_of,
    createdAt: dossier.created_at,

    health: {
      state: degraded ? "degraded" : "healthy",
      degraded,
      repairUsed: Boolean(output.diagnostics.model_repair_used),
      freshnessWarnings: warnings,
      researchGaps: gaps,
      missingInputCategories: [...output.diagnostics.missing_input_categories],
    },

    header: {
      headline: output.main_thread.headline,
      answer: output.main_thread.answer,
      regimeImplication: output.main_thread.regime_implication,
      regimeFamily: output.main_thread.regime_family,
      epistemicLabel: output.main_thread.epistemic_label,
      whatWouldChangeMind: output.main_thread.what_would_change_mind,
    },

    regimeStrip: lenses,
    policyOutlook: outlook,
    rateRegime: rateRegime(dossier, outlook, lenses),
    dollarLiquidity: dollarLiquidity(dossier),
    policyLiquidityInteraction: policyLiquidityInteraction(dossier),

    whatMattersNow: {
      leadThreadId: output.main_thread.thread_id,
      supportingStoryIds: [...output.main_thread.supporting_story_ids],
      stories: output.major_stories.map(presentationStory),
    },

    watchNext: output.investigations
      .filter((item) => item.status !== "resolved" && item.status !== "parked")
      .map(presentationInvestigation),

    researchNow: output.research_now.map((item) => ({
      ...item,
      linked_investigations: [...item.linked_investigations],
      linked_stories: [...item.linked_stories],
      blocking_evidence: [...item.blocking_evidence],
    })),

    charts: {
      core: output.chart_investigation_queue.core.map((item) => ({
        ...item,
        linked_story_ids: [...item.linked_story_ids],
        linked_investigation_ids: [...item.linked_investigation_ids],
        lane: "core" as const,
      })),
      optional: output.chart_investigation_queue.optional.map((item) => ({
        ...item,
        linked_story_ids: [...item.linked_story_ids],
        linked_investigation_ids: [...item.linked_investigation_ids],
        lane: "optional" as const,
      })),
    },

    stockRadar: output.stock_radar.map((item) => ({
      ...item,
      evidence_references: [...item.evidence_references],
    })),

    themes: output.developing_themes.map((item) => ({
      ...item,
      supporting_evidence_ids: [...item.supporting_evidence_ids],
    })),

    creatorThemes: output.creator_theme_expansions.map((item) => ({
      ...item,
      creator_claims_referenced: [...item.creator_claims_referenced],
    })),

    thesisChanges: thesisChanges(output, previousOutput),

    evidenceIndex: evidenceIndex(output),

    diagnostics: {
      modelRepairUsed: Boolean(output.diagnostics.model_repair_used),
      notes: [...output.diagnostics.notes],
      omittedOrDemotedItems: [...output.diagnostics.omitted_or_demoted_items],
    },
  };
}
