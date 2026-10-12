/**
 * Presenter-owned state. It is not a canonical Story, Motion, Dossier,
 * Macro Pulse, Research Gap or market-verification record.
 */
export const PRESENTER_PREP_SESSION_VERSION = "presenter-prep-session/1" as const;

export const PRESENTER_SEGMENT_IDS = [
  "market-in-a-minute",
  "top-stories",
  "charts-and-disagreements",
  "what-happens-next",
  "talking-points-and-qa",
] as const;

export type PresenterSegmentId = typeof PRESENTER_SEGMENT_IDS[number];
export type PresenterSegment = {
  id: PresenterSegmentId;
  title: string;
  minutes: number;
  prepared: boolean;
  notes: string;
};

export type PresenterSessionDraft = {
  version: typeof PRESENTER_PREP_SESSION_VERSION;
  editionId: string;
  dossierId: string;
  segments: PresenterSegment[];
};

const DEFAULT_SEGMENTS: ReadonlyArray<Pick<PresenterSegment, "id" | "title" | "minutes">> = [
  { id: "market-in-a-minute", title: "Market in 60 seconds", minutes: 1 },
  { id: "top-stories", title: "3–5 Stories (or fewer when evidence is thin)", minutes: 20 },
  { id: "charts-and-disagreements", title: "Charts and disagreements", minutes: 15 },
  { id: "what-happens-next", title: "What happens next", minutes: 10 },
  { id: "talking-points-and-qa", title: "Talking points and Q&A", minutes: 14 },
];

export function defaultPresenterSegments(): PresenterSegment[] {
  return DEFAULT_SEGMENTS.map((part) => ({ ...part, prepared: false, notes: "" }));
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

export function readPresenterSessionDraft(
  saved: unknown,
  editionId: string,
  dossierId: string,
): PresenterSegment[] | null {
  const draft = record(saved);
  if (!draft || draft.version !== PRESENTER_PREP_SESSION_VERSION
    || draft.editionId !== editionId || draft.dossierId !== dossierId
    || !Array.isArray(draft.segments)
    || draft.segments.length !== DEFAULT_SEGMENTS.length) return null;
  const allowed = new Map(DEFAULT_SEGMENTS.map((part) => [part.id, part] as const));
  const seen = new Set<string>();
  const validated = draft.segments.flatMap((raw) => {
    const part = record(raw);
    const id = typeof part?.id === "string" ? part.id : "";
    const definition = allowed.get(id as PresenterSegmentId);
    const minutes = part?.minutes;
    if (!definition || seen.has(id) || !Number.isInteger(minutes)
      || (minutes as number) < 0 || (minutes as number) > 60
      || typeof part?.prepared !== "boolean" || typeof part?.notes !== "string") return [];
    seen.add(id);
    return [{
      id: definition.id,
      title: definition.title,
      minutes: minutes as number,
      prepared: part.prepared,
      notes: part.notes.slice(0, 4000),
    }];
  });
  return validated.length === DEFAULT_SEGMENTS.length ? validated : null;
}

export function presenterSessionReadiness(segments: PresenterSegment[]) {
  const totalMinutes = segments.reduce((sum, part) => sum + part.minutes, 0);
  const preparedCount = segments.filter((part) => part.prepared).length;
  return {
    totalMinutes,
    preparedCount,
    plannedFor60Minutes: totalMinutes === 60,
    // Presenter preparation completion does NOT assert evidence completeness.
    readyForOnAir: segments.length === DEFAULT_SEGMENTS.length
      && preparedCount === DEFAULT_SEGMENTS.length
      && totalMinutes === 60,
  };
}
