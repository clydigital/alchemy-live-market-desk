/**
 * Presenter Prep's read-only trust boundary. Nothing in this module writes to a
 * Dossier, a Story, Macro Pulse, Research Gap, or Hybrid Journey.
 *
 * All source items must come from the selected immutable Journey edition or
 * the exact Dossier frozen into that edition. An invalid request emits NO items.
 */
export const PRESENTER_PREP_SOURCE_VERSION = "presenter-prep-source/1" as const;

type EditionStatus = "current" | "historical" | "invalid_fallback_current";
type Focus = { story?: string | null; motion?: string | null; regime?: string | null; event?: string | null };
type DossierIdentity = { id: string; asOf: string };
type Item = Record<string, unknown>;

export type PresenterPrepSourceInput = {
  requestedEditionId: string | null;
  selectedEditionId: string | null;
  currentEditionId: string | null;
  editionSelectionStatus: EditionStatus;
  selectedEdition: { id: string; publishedAt: string; payload: Record<string, unknown> } | null;
  /** Exact-ID, exact-as-of Dossier read, never the nearest or latest Dossier. */
  exactDossier: DossierIdentity | null;
  /** Only statuses read for the exact frozen Dossier may be supplied. */
  researchGapStatus?: Record<string, unknown> | null;
  focus?: Focus;
};

export type PresenterPrepSourceProjection = {
  contractVersion: typeof PRESENTER_PREP_SOURCE_VERSION;
  status: "READY" | "UNAVAILABLE";
  reason: string | null;
  scope: "CURRENT" | "HISTORICAL" | null;
  pinned: { editionId: string; publishedAt: string; dossierId: string; dossierAsOf: string } | null;
  focus: Focus;
  journeyHref: string | null;
  stories: Array<{ storyId: string; slug: string | null; headline: string; publicationSnapshotId: string; thesisVersionId: string }>;
  motions: Array<{ motionId: string; headline: string; storyId: string; regimeSlug: string | null; verificationState: string; sourceName: string; sourceUrl: string }>;
  regimes: string[];
  events: Array<{ eventId: string; title: string }>;
  researchGaps: Array<{ gapKey: string; lifecycleStatus: string; researchOutcome: string | null; measurementVerification: "NOT_PROVEN" }>;
};

function obj(value: unknown): Item | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Item
    : null;
}

function nonempty(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function iso(value: unknown): string | null {
  const text = nonempty(value);
  return text && Number.isFinite(Date.parse(text)) ? text : null;
}

function normalizedFocus(value: Focus | undefined): Focus {
  return Object.fromEntries(
    (["story", "motion", "regime", "event"] as const)
      .map((key) => [key, nonempty(value?.[key])])
      .filter(([, item]) => item !== null),
  ) as Focus;
}

function unavailable(reason: string, focus: Focus): PresenterPrepSourceProjection {
  return {
    contractVersion: PRESENTER_PREP_SOURCE_VERSION,
    status: "UNAVAILABLE",
    reason,
    scope: null,
    pinned: null,
    focus,
    journeyHref: null,
    stories: [],
    motions: [],
    regimes: [],
    events: [],
    researchGaps: [],
  };
}

function storiesFromPayload(payload: Item): PresenterPrepSourceProjection["stories"] {
  const entries = payload.canonicalStoryManifest;
  if (!Array.isArray(entries)) return [];
  const stories = entries.flatMap((value) => {
    const entry = obj(value);
    const reasoning = obj(entry?.reasoning);
    const state = obj(entry?.state);
    const storyId = nonempty(entry?.storyId);
    const snapshotId = nonempty(entry?.snapshotId);
    const thesisVersionId = nonempty(entry?.thesisVersionId);
    const headline = nonempty(reasoning?.title);
    if (!storyId || !snapshotId || !thesisVersionId || !headline
      || reasoning?.contractVersion !== "canonical-story-reasoning/v1"
      || reasoning?.storyId !== storyId
      || reasoning?.storyVersionId !== thesisVersionId) return [];
    return [{
      storyId,
      slug: nonempty(state?.slug),
      headline,
      publicationSnapshotId: snapshotId,
      thesisVersionId,
    }];
  });
  // Conflicting immutable identities must never be silently resolved by order.
  return stories.filter((story, index) =>
    stories.findIndex((other) => other.storyId === story.storyId) === index
    && stories.filter((other) => other.storyId === story.storyId).length === 1);
}

function motionsFromPayload(payload: Item): PresenterPrepSourceProjection["motions"] {
  const attachment = obj(payload.marketMotion);
  if (attachment?.contractVersion !== "market-motion-edition/v1" || !Array.isArray(attachment.items)) return [];
  return attachment.items.flatMap((value) => {
    const item = obj(value);
    const motionId = nonempty(item?.id);
    const headline = nonempty(item?.headline);
    const storyId = nonempty(item?.storyId);
    const sourceName = nonempty(item?.sourceName);
    const sourceUrl = nonempty(item?.sourceUrl);
    const verificationState = nonempty(item?.verificationState);
    if (!motionId || !headline || !storyId || !sourceName || !sourceUrl
      || !verificationState || item?.lifecycleState !== "PROMOTED") return [];
    return {
      motionId,
      headline,
      storyId,
      regimeSlug: nonempty(item?.regimeSlug),
      verificationState,
      sourceName,
      sourceUrl,
    };
  });
}

function eventsFromPayload(payload: Item): PresenterPrepSourceProjection["events"] {
  const journey = obj(payload.journey);
  if (journey?.contractVersion !== "journey-briefing/v1") return [];
  const horizon = obj(journey.horizon);
  const candidates = [
    ...(Array.isArray(journey.chronology) ? journey.chronology : []),
    ...(["today", "tonight", "later"] as const).flatMap((key) =>
      Array.isArray(horizon?.[key]) ? horizon[key] as unknown[] : []),
  ];
  const events = candidates.flatMap((value) => {
    const item = obj(value);
    const eventId = nonempty(item?.eventId);
    const title = nonempty(item?.title);
    return eventId && title ? [{ eventId, title }] : [];
  });
  return events.filter((event, index) => events.findIndex((other) => other.eventId === event.eventId) === index);
}

/** Source records remain immutable; only the presenter display order is focused. */
function focusedFirst<T>(items: T[], matches: (item: T) => boolean): T[] {
  return [...items.filter(matches), ...items.filter((item) => !matches(item))];
}

function gapsFromExactDossier(value: Record<string, unknown> | null | undefined, dossier: DossierIdentity) {
  const projection = obj(value);
  if (!projection
    || projection.contractVersion !== "hybrid-research-gap-status/2"
    || projection.dossierId !== dossier.id
    || projection.dossierAsOf !== dossier.asOf
    || !Array.isArray(projection.items)) return [];
  return projection.items.flatMap((value) => {
    const gap = obj(value);
    const gapKey = nonempty(gap?.gapKey);
    const lifecycleStatus = nonempty(gap?.lifecycleStatus);
    if (!gapKey || !lifecycleStatus || gap?.caseMatchesSelectedDossier !== true) return [];
    return [{
      gapKey,
      lifecycleStatus,
      researchOutcome: nonempty(gap?.researchOutcome),
      measurementVerification: "NOT_PROVEN" as const,
    }];
  });
}

export function buildPresenterPrepSourceProjection(input: PresenterPrepSourceInput): PresenterPrepSourceProjection {
  const focus = normalizedFocus(input.focus);
  const selectedId = nonempty(input.selectedEditionId);
  const currentId = nonempty(input.currentEditionId);
  const requestedId = nonempty(input.requestedEditionId);
  const edition = input.selectedEdition;

  // The regular Journey picker may fall back to current. Prep must not.
  if (input.editionSelectionStatus === "invalid_fallback_current"
    || (requestedId && requestedId !== selectedId)) return unavailable("INVALID_EDITION", focus);
  if (!selectedId || !currentId || !edition || edition.id !== selectedId || !iso(edition.publishedAt)) {
    return unavailable("EDITION_IDENTITY_UNAVAILABLE", focus);
  }

  const historical = selectedId !== currentId;
  if (historical !== (input.editionSelectionStatus === "historical")) {
    return unavailable("EDITION_SCOPE_MISMATCH", focus);
  }
  const frozen = obj(edition.payload.presenterDossierContext);
  const frozenId = nonempty(frozen?.dossierId);
  const frozenAsOf = iso(frozen?.dossierAsOf);
  if (!frozenId || !frozenAsOf || frozen?.status !== "BOUND"
    || frozen?.contractVersion !== "presenter-dossier-edition-context/1") {
    return unavailable("FROZEN_DOSSIER_UNAVAILABLE", focus);
  }
  if (!input.exactDossier) return unavailable("EXACT_DOSSIER_READ_UNAVAILABLE", focus);
  if (frozenId !== input.exactDossier.id || frozenAsOf !== input.exactDossier.asOf) {
    return unavailable("DOSSIER_IDENTITY_MISMATCH", focus);
  }

  const stories = storiesFromPayload(edition.payload);
  const motions = motionsFromPayload(edition.payload);
  const events = eventsFromPayload(edition.payload);
  const regimes = [...new Set(motions.map((item) => item.regimeSlug).filter((slug): slug is string => Boolean(slug)))];
  const storySlugs = new Set([
    ...stories.flatMap((story) => story.slug ? [story.slug] : []),
    ...motions.filter((motion) => stories.some((story) => story.storyId === motion.storyId))
      .flatMap((motion) => {
        const attachment = obj(edition.payload.marketMotion);
        const matching = (Array.isArray(attachment?.items) ? attachment.items : [])
          .map(obj).find((item) => item?.id === motion.motionId);
        const slug = nonempty(matching?.storySlug);
        return slug ? [slug] : [];
      }),
  ]);

  if (focus.story && !storySlugs.has(focus.story)) return unavailable("INVALID_STORY_REFERENCE", focus);
  if (focus.motion && !motions.some((item) => item.motionId === focus.motion)) {
    return unavailable("INVALID_MOTION_REFERENCE", focus);
  }
  if (focus.regime && !regimes.includes(focus.regime)) return unavailable("INVALID_REGIME_REFERENCE", focus);
  if (focus.event && !events.some((item) => item.eventId === focus.event)) {
    return unavailable("INVALID_EVENT_REFERENCE", focus);
  }

  // An individually valid Story/Regime/Motion is not necessarily the same
  // market development. Require an explicit frozen edition lineage witness.
  const motionInFocus = focus.motion
    ? motions.find((item) => item.motionId === focus.motion)!
    : null;
  const storyIdsInFocus = new Set(
    stories.filter((story) => story.slug === focus.story).map((story) => story.storyId),
  );
  if (focus.story) {
    const attachment = obj(edition.payload.marketMotion);
    for (const item of Array.isArray(attachment?.items) ? attachment.items : []) {
      const row = obj(item);
      if (nonempty(row?.storySlug) !== focus.story) continue;
      const matchingMotion = motions.find((motion) => motion.motionId === row?.id);
      if (matchingMotion && stories.some((story) => story.storyId === matchingMotion.storyId)) {
        storyIdsInFocus.add(matchingMotion.storyId);
      }
    }
    // An ambiguous alias is not a usable cross-reference.
    if (storyIdsInFocus.size !== 1) return unavailable("FOCUS_RELATIONSHIP_UNVERIFIED", focus);
  }
  const storyIdInFocus = [...storyIdsInFocus][0] ?? motionInFocus?.storyId ?? null;
  if (focus.story && motionInFocus && motionInFocus.storyId !== storyIdInFocus) {
    return unavailable("FOCUS_RELATIONSHIP_MISMATCH", focus);
  }
  if (focus.regime && motionInFocus && motionInFocus.regimeSlug !== focus.regime) {
    return unavailable("FOCUS_RELATIONSHIP_MISMATCH", focus);
  }
  if (focus.story && focus.regime && !motions.some((motion) =>
    motion.storyId === storyIdInFocus && motion.regimeSlug === focus.regime
    && (!motionInFocus || motion.motionId === motionInFocus.motionId))) {
    return unavailable("FOCUS_RELATIONSHIP_UNVERIFIED", focus);
  }
  // Events lack a reliable Story/Motion relation in journey-briefing/v1.
  // Event identity is validated independently; never infer a relationship.
  const priorityMotionId = motionInFocus?.motionId
    ?? (storyIdInFocus ? motions.find((motion) => motion.storyId === storyIdInFocus)?.motionId : null)
    ?? (focus.regime ? motions.find((motion) => motion.regimeSlug === focus.regime)?.motionId : null);

  const params = new URLSearchParams({ edition: selectedId });
  for (const key of ["story", "motion", "regime", "event"] as const) {
    if (focus[key]) params.set(key, focus[key]!);
  }
  return {
    contractVersion: PRESENTER_PREP_SOURCE_VERSION,
    status: "READY",
    reason: null,
    scope: historical ? "HISTORICAL" : "CURRENT",
    pinned: { editionId: selectedId, publishedAt: edition.publishedAt, dossierId: frozenId, dossierAsOf: frozenAsOf },
    focus,
    journeyHref: "/hybrid-output?" + params.toString() + "#presenter-reasoning",
    stories: focusedFirst(stories, (story) => story.storyId === storyIdInFocus),
    motions: focusedFirst(motions, (motion) => motion.motionId === priorityMotionId),
    regimes,
    events,
    researchGaps: gapsFromExactDossier(input.researchGapStatus, input.exactDossier),
  };
}
