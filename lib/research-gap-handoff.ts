export const RESEARCH_GAP_HANDOFF_KIND = "research_gap_gate" as const;
export const RESEARCH_GAP_HANDOFF_PREFIX = "gap-handoff:" as const;
export const RESEARCH_GAP_HANDOFF_VERSION = "research-gap-handoff/1" as const;

export type ResearchGapHandoffOutcome =
  | "CONFIRMING"
  | "CONTRADICTING"
  | "UNRESOLVED"
  | "NO_CHANGE";

export type ResearchGapHandoffInput = {
  kind: typeof RESEARCH_GAP_HANDOFF_KIND;
  gateRunId: string;
  gapId: string;
  investigationId?: string;
  pulseRefs?: string[];
  affectedStorySlugs?: string[];
  researchQuestion: string;
  priorExpectation?: string;
  finding: string;
  confidence: number;
  outcome: ResearchGapHandoffOutcome;
  remainsUnknown?: string[];
  liveImplication?: string;
  nextTest?: string;
};

export type ResearchGapHandoffContext = {
  version: typeof RESEARCH_GAP_HANDOFF_VERSION;
  kind: typeof RESEARCH_GAP_HANDOFF_KIND;
  gateRunId: string;
  gapId: string;
  investigationId: string | null;
  pulseRefs: string[];
  affectedStorySlugs: string[];
  researchQuestion: string;
  priorExpectation: string | null;
  finding: string;
  confidence: number;
  outcome: ResearchGapHandoffOutcome;
  remainsUnknown: string[];
  liveImplication: string | null;
  nextTest: string | null;
  itemNote: string | null;
};

type GapHandoffItemLike = {
  affectedStorySlugs?: string[];
  divergenceNote?: string;
  reviewReason?: string;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function uniqueStrings(value: unknown, limit = 24) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(clean).filter(Boolean))].slice(0, limit);
}

function validIdentifier(value: unknown, maxLength = 80) {
  const text = clean(value);
  return Boolean(text) && text.length <= maxLength && /^[A-Za-z0-9._:-]+$/.test(text);
}

function validOptionalText(value: unknown, maxLength: number) {
  return value === undefined || (typeof value === "string" && value.trim().length > 0 && value.trim().length <= maxLength);
}

export function isResearchGapHandoff(value: unknown): value is ResearchGapHandoffInput {
  return Boolean(
    value
    && typeof value === "object"
    && !Array.isArray(value)
    && (value as { kind?: unknown }).kind === RESEARCH_GAP_HANDOFF_KIND,
  );
}

export function validateResearchGapHandoff(handoff: ResearchGapHandoffInput) {
  const errors: string[] = [];
  if (!validIdentifier(handoff.gateRunId)) errors.push("handoff.gateRunId is required, must be at most 80 characters, and may contain only letters, numbers, '.', '_', ':', or '-'.");
  if (!validIdentifier(handoff.gapId)) errors.push("handoff.gapId is required, must be at most 80 characters, and may contain only letters, numbers, '.', '_', ':', or '-'.");
  if (handoff.investigationId !== undefined && !validIdentifier(handoff.investigationId)) errors.push("handoff.investigationId must be at most 80 characters and use identifier-safe characters.");
  if (!clean(handoff.researchQuestion) || clean(handoff.researchQuestion).length > 600) errors.push("handoff.researchQuestion is required and must be at most 600 characters.");
  if (!clean(handoff.finding) || clean(handoff.finding).length > 2_000) errors.push("handoff.finding is required and must be at most 2,000 characters.");
  if (!Number.isInteger(handoff.confidence) || handoff.confidence < 0 || handoff.confidence > 100) errors.push("handoff.confidence must be an integer from 0 to 100.");
  if (!["CONFIRMING", "CONTRADICTING", "UNRESOLVED", "NO_CHANGE"].includes(handoff.outcome)) errors.push("handoff.outcome is invalid.");
  if (!validOptionalText(handoff.priorExpectation, 1_200)) errors.push("handoff.priorExpectation must be non-empty and at most 1,200 characters when supplied.");
  if (!validOptionalText(handoff.liveImplication, 1_200)) errors.push("handoff.liveImplication must be non-empty and at most 1,200 characters when supplied.");
  if (!validOptionalText(handoff.nextTest, 1_200)) errors.push("handoff.nextTest must be non-empty and at most 1,200 characters when supplied.");
  if (handoff.pulseRefs !== undefined && (!Array.isArray(handoff.pulseRefs) || handoff.pulseRefs.some((value) => !validIdentifier(value, 120)))) {
    errors.push("handoff.pulseRefs must contain only non-empty identifier-safe strings up to 120 characters.");
  }
  if (handoff.affectedStorySlugs !== undefined && (!Array.isArray(handoff.affectedStorySlugs) || handoff.affectedStorySlugs.some((value) => !validIdentifier(value, 120)))) {
    errors.push("handoff.affectedStorySlugs must contain only non-empty Story slugs up to 120 characters.");
  }
  if (handoff.remainsUnknown !== undefined && (!Array.isArray(handoff.remainsUnknown) || handoff.remainsUnknown.some((value) => !clean(value) || clean(value).length > 600))) {
    errors.push("handoff.remainsUnknown must contain only non-empty strings up to 600 characters.");
  }
  const runKey = researchGapHandoffRunKey(handoff);
  if (runKey.length > 120) errors.push("The deterministic Research Gap handoff runKey exceeds the 120-character research-run limit.");
  return errors;
}

export function researchGapHandoffRunKey(handoff: Pick<ResearchGapHandoffInput, "gateRunId" | "gapId">) {
  return `gap-gate:${clean(handoff.gateRunId)}:${clean(handoff.gapId)}`;
}

export function gapHandoffSourceIsCarrier(publisher: string, url: string) {
  const publisherName = clean(publisher).toLowerCase();
  if (/^(research gap( gate)?|macropulse|macro pulse|notion)$/.test(publisherName)) return true;
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return host === "notion.so"
      || host.endsWith(".notion.site")
      || host === "chatgpt.com";
  } catch {
    return false;
  }
}

export function encodeResearchGapHandoffContext(
  handoff: ResearchGapHandoffInput,
  itemNote?: string | null,
) {
  const context: ResearchGapHandoffContext = {
    version: RESEARCH_GAP_HANDOFF_VERSION,
    kind: RESEARCH_GAP_HANDOFF_KIND,
    gateRunId: clean(handoff.gateRunId),
    gapId: clean(handoff.gapId),
    investigationId: clean(handoff.investigationId) || null,
    pulseRefs: uniqueStrings(handoff.pulseRefs, 24),
    affectedStorySlugs: uniqueStrings(handoff.affectedStorySlugs, 24),
    researchQuestion: clean(handoff.researchQuestion),
    priorExpectation: clean(handoff.priorExpectation) || null,
    finding: clean(handoff.finding),
    confidence: handoff.confidence,
    outcome: handoff.outcome,
    remainsUnknown: uniqueStrings(handoff.remainsUnknown, 24),
    liveImplication: clean(handoff.liveImplication) || null,
    nextTest: clean(handoff.nextTest) || null,
    itemNote: clean(itemNote) || null,
  };
  return `${RESEARCH_GAP_HANDOFF_PREFIX}${JSON.stringify(context)}`;
}

export function parseResearchGapHandoffContext(value: string | null | undefined): ResearchGapHandoffContext | null {
  if (!value?.startsWith(RESEARCH_GAP_HANDOFF_PREFIX)) return null;
  try {
    const parsed = JSON.parse(value.slice(RESEARCH_GAP_HANDOFF_PREFIX.length)) as Partial<ResearchGapHandoffContext>;
    if (
      parsed.version !== RESEARCH_GAP_HANDOFF_VERSION
      || parsed.kind !== RESEARCH_GAP_HANDOFF_KIND
      || !validIdentifier(parsed.gateRunId)
      || !validIdentifier(parsed.gapId)
      || !clean(parsed.researchQuestion)
      || !clean(parsed.finding)
      || !Number.isInteger(parsed.confidence)
      || typeof parsed.outcome !== "string"
      || !["CONFIRMING", "CONTRADICTING", "UNRESOLVED", "NO_CHANGE"].includes(parsed.outcome)
    ) return null;
    return {
      version: RESEARCH_GAP_HANDOFF_VERSION,
      kind: RESEARCH_GAP_HANDOFF_KIND,
      gateRunId: clean(parsed.gateRunId),
      gapId: clean(parsed.gapId),
      investigationId: clean(parsed.investigationId) || null,
      pulseRefs: uniqueStrings(parsed.pulseRefs, 24),
      affectedStorySlugs: uniqueStrings(parsed.affectedStorySlugs, 24),
      researchQuestion: clean(parsed.researchQuestion),
      priorExpectation: clean(parsed.priorExpectation) || null,
      finding: clean(parsed.finding),
      confidence: parsed.confidence as number,
      outcome: parsed.outcome as ResearchGapHandoffOutcome,
      remainsUnknown: uniqueStrings(parsed.remainsUnknown, 24),
      liveImplication: clean(parsed.liveImplication) || null,
      nextTest: clean(parsed.nextTest) || null,
      itemNote: clean(parsed.itemNote) || null,
    };
  } catch {
    return null;
  }
}

export function attachResearchGapHandoffToItems<T extends GapHandoffItemLike>(
  handoff: ResearchGapHandoffInput,
  items: T[],
): T[] {
  const handoffStories = uniqueStrings(handoff.affectedStorySlugs, 24);
  return items.map((item) => {
    const existingContext = parseResearchGapHandoffContext(item.divergenceNote);
    const itemNote = existingContext?.itemNote ?? item.divergenceNote ?? null;
    return {
      ...item,
      affectedStorySlugs: [...new Set([...handoffStories, ...uniqueStrings(item.affectedStorySlugs, 24)])],
      divergenceNote: encodeResearchGapHandoffContext(handoff, itemNote),
      reviewReason: clean(item.reviewReason)
        || `Research Gap Gate outcome: ${handoff.outcome.replaceAll("_", " ").toLowerCase()}.`,
    };
  });
}
