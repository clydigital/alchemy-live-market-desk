import Link from "next/link";
import PresenterPrepSession from "@/components/live-desk/PresenterPrepSession";
import PresenterTechnicalChecks from "@/components/live-desk/PresenterTechnicalChecks";

import LiveDeskShell, { styles } from "@/components/live-desk/LiveDeskShell";
import { Badge, DataState, formatDeskDate, Panel } from "@/components/live-desk/LiveDeskUi";
import { getDeskData } from "@/lib/data";
import { getDossierV2PresentationSelectionById } from "@/lib/dossier-v2/presentation-reader";
import { selectCanonicalEdition } from "@/lib/edition-replay";
import { buildPresenterPrepEditionIndex } from "@/lib/presenter-prep-edition-index";
import { getHybridPresenterEditionCandidates } from "@/lib/hybrid-publication";
import { loadHybridResearchGapStatus } from "@/lib/hybrid-research-gap-status";
import { presenterDossierEditionContextFromPayload } from "@/lib/presenter-dossier-edition-context";
import { buildPresenterPrepSourceProjection } from "@/lib/presenter-prep-source-projection";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function param(query: Record<string, string | string[] | undefined>, key: string) {
  if (!(key in query)) return null;
  const value = query[key];
  // An explicitly supplied blank or duplicated reference must not mean "current".
  if (Array.isArray(value)) return "__invalid_duplicate_parameter__";
  return typeof value === "string" && value.trim() ? value : "__invalid_empty_parameter__";
}

function blocked(reason: string | null) {
  const explanations: Record<string, string> = {
    INVALID_EDITION: "The requested historical edition was not selected. Prep will not replace it with the current edition.",
    EDITION_IDENTITY_UNAVAILABLE: "The selected immutable Journey edition cannot be read.",
    EDITION_SCOPE_MISMATCH: "Current and historical edition identities disagree.",
    FROZEN_DOSSIER_UNAVAILABLE: "This edition has no valid frozen Dossier identity.",
    EXACT_DOSSIER_READ_UNAVAILABLE: "The exact frozen Dossier could not be retrieved.",
    DOSSIER_IDENTITY_MISMATCH: "The Dossier ID or timestamp differs from the frozen edition.",
    INVALID_STORY_REFERENCE: "The requested Story is not proven by this edition.",
    INVALID_MOTION_REFERENCE: "The requested Motion is not part of this edition.",
    INVALID_REGIME_REFERENCE: "The requested Regime is not proven by this edition.",
    INVALID_EVENT_REFERENCE: "The requested Event is not part of this edition.",
    FOCUS_RELATIONSHIP_MISMATCH: "The focused Story, Motion and Regime contradict their frozen source relationships.",
    FOCUS_RELATIONSHIP_UNVERIFIED: "No unambiguous frozen source relationship proves this combination of Story and Regime.",
  };
  return explanations[reason || ""] || "Source context could not be verified.";
}

export default async function PresenterPrepPage({ searchParams }: Props) {
  const [query, editions, desk] = await Promise.all([
    searchParams, getHybridPresenterEditionCandidates(), getDeskData(),
  ]);
  const requestedEditionId = param(query, "edition");
  const index = buildPresenterPrepEditionIndex(editions, desk.researchRuns);
  const selection = selectCanonicalEdition(index, requestedEditionId);
  const selectedEditionId = selection.selected?.snapshotId ?? null;
  const selectedSnapshot = editions.find((item) => item.id === selectedEditionId) ?? null;

  const frozen = presenterDossierEditionContextFromPayload(selectedSnapshot?.payload);
  const frozenDossierId = frozen?.dossierId ?? null;
  const dossierSelection = frozenDossierId
    ? await getDossierV2PresentationSelectionById(frozenDossierId).catch(() => null)
    : null;
  const selectedDossierId = dossierSelection?.selectedDossierId ?? null;
  const selectedDossierAsOf = dossierSelection?.selectedAsOf ?? null;
  const exactDossier = dossierSelection?.status === "historical_exact"
    && dossierSelection.presentation
    && selectedDossierId
    && selectedDossierAsOf
    && selectedDossierId === frozen?.dossierId
    && selectedDossierAsOf === frozen?.dossierAsOf
    ? { id: selectedDossierId, asOf: selectedDossierAsOf }
    : null;
  const gaps = exactDossier ? await loadHybridResearchGapStatus(exactDossier.id).catch(() => null) : null;
  const status = selection.status === "invalid_fallback_current"
    ? "invalid_fallback_current" as const
    : selectedEditionId && selectedEditionId !== selection.current?.snapshotId
      ? "historical" as const : "current" as const;
  const projection = buildPresenterPrepSourceProjection({
    requestedEditionId,
    selectedEditionId,
    currentEditionId: selection.current?.snapshotId ?? null,
    editionSelectionStatus: status,
    selectedEdition: selectedSnapshot
      ? { id: selectedSnapshot.id, publishedAt: selectedSnapshot.published_at, payload: selectedSnapshot.payload }
      : null,
    exactDossier,
    researchGapStatus: gaps as unknown as Record<string, unknown> | null,
    focus: {
      story: param(query, "story"), motion: param(query, "motion"),
      regime: param(query, "regime"), event: param(query, "event"),
    },
  });

  const focusedStory = projection.stories.find((story) => story.slug === projection.focus.story) ?? null;
  const explicitFocusedMotion = projection.motions.find(
    (motion) => motion.motionId === projection.focus.motion,
  ) ?? null;
  const focusedStoryId = focusedStory?.storyId ?? explicitFocusedMotion?.storyId ?? null;
  const focusedMotionId = explicitFocusedMotion?.motionId ?? (focusedStoryId
    ? projection.motions.find((motion) => motion.storyId === focusedStoryId)?.motionId ?? null
    : null);

  return (
    <LiveDeskShell activePath="/hybrid-output/prepare"
      eyebrow="Optional presenter companion" title="Presenter Prep"
      description="Choose what to discuss from an immutable Journey edition. This page does not replace the original analysis."
      meta={<Badge tone={projection.status === "READY" ? "ready" : "risk"}>{projection.status}</Badge>}>
      <PresenterTechnicalChecks compact />
      {projection.status !== "READY" || !projection.pinned ? (
        <Panel title="Exact source unavailable"
          description="Invalid or mismatched references must not show another edition's market analysis."
          action={<Badge tone="risk">FAIL CLOSED</Badge>}>
          <DataState title={projection.reason || "Unavailable"} detail={blocked(projection.reason)} state="risk" />
          <p><Link className={styles.link} href="/hybrid-output">Open existing Hybrid Journey</Link></p>
        </Panel>
      ) : (
        <div className={styles.grid}>
          <Panel title="Pinned research"
            description="These source identities will not change while you prepare this edition."
            action={<Badge tone="ready">{projection.scope}</Badge>}>
            <div className={styles.recordList}>
              <article className={styles.record}>
                <span className={styles.kicker}>IMMUTABLE EDITION</span>
                <h3>{projection.pinned.editionId}</h3>
                <p className={styles.meta}>{formatDeskDate(projection.pinned.publishedAt)}</p>
              </article>
              <article className={styles.record}>
                <span className={styles.kicker}>EXACT FROZEN DOSSIER</span>
                <h3>{projection.pinned.dossierId}</h3>
                <p className={styles.meta}>{formatDeskDate(projection.pinned.dossierAsOf)}</p>
              </article>
            </div>
            {Object.entries(projection.focus).length ? (
              <p className={styles.meta}>
                <strong>Selected focus:</strong>{" "}
                {Object.entries(projection.focus).map(([key, value]) => key + " " + value).join(" · ")}
                {" · "}Matching source records are shown first below.
              </p>
            ) : null}
            <p><Link className={styles.link} href={projection.journeyHref!}>Open this edition in Hybrid Journey →</Link></p>
          </Panel>

          <Panel title="What to cover"
            description="Headlines from frozen edition sources only. Legacy Story-state titles do not imply an accepted Dossier interpretation."
            action={<Badge>{projection.stories.length} STORIES · {projection.motions.length} MOTION</Badge>}>
            {projection.stories.length || projection.motions.length ? (
              <div className={styles.recordList}>
                {projection.stories.slice(0, 6).map((story) => (
                  <article key={story.storyId} className={styles.record}>
                    <span className={styles.kicker}>
                      {focusedStoryId === story.storyId ? "FOCUSED STORY · " : ""}
                      {story.sourceKind === "FROZEN_STORY_STATE"
                        ? "FROZEN STORY STATE · REASONING UNAVAILABLE"
                        : "CANONICAL STORY REASONING"} · {story.thesisVersionId}
                    </span>
                    <h3>{story.headline}</h3>
                    <p className={styles.meta}>Frozen snapshot: {story.publicationSnapshotId}</p>
                  </article>
                ))}
                {projection.motions.slice(0, 6).map((motion) => (
                  <article key={motion.motionId} className={styles.record}>
                    <div className={styles.recordHeader}>
                      <div>
                        <span className={styles.kicker}>
                          {focusedMotionId === motion.motionId ? "FOCUSED MOTION · " : ""}
                          MARKET MOTION · {motion.verificationState}
                        </span>
                        <h3>{motion.headline}</h3>
                      </div>
                      {focusedMotionId === motion.motionId ? <Badge>FOCUS</Badge> : null}
                      <Badge tone={motion.verificationState === "VERIFIED" ? "ready" : "warn"}>
                        {motion.verificationState === "VERIFIED" ? "SOURCE VERIFIED" : "UNVERIFIED"}
                      </Badge>
                    </div>
                    <p className={styles.meta}>
                      Source: <a href={motion.sourceUrl} target="_blank" rel="noopener noreferrer">{motion.sourceName}</a>
                    </p>
                    <p className={styles.meta}>
                      Story {motion.storyId}{motion.regimeSlug ? " · Regime " + motion.regimeSlug : ""}
                      {" · "}Source verification does not imply Dossier acceptance.
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <DataState state="ready" title="Quiet edition"
                detail="There is no material Story or Motion to add. Nothing has been invented to fill airtime." />
            )}
          </Panel>

          <Panel title="What needs checking"
            description="Exact-Dossier Research Gap lifecycle only; research handoff is not measurement verification."
            action={<Badge tone={projection.researchGaps.length ? "warn" : "default"}>{projection.researchGaps.length} GAPS</Badge>}>
            {projection.researchGaps.length ? (
              <div className={styles.recordList}>
                {projection.researchGaps.slice(0, 8).map((gap) => (
                  <article key={gap.gapKey} className={styles.record}>
                    <span className={styles.kicker}>RESEARCH GAP · {gap.lifecycleStatus}</span>
                    <h3>{gap.gapKey}</h3>
                    <p className={styles.meta}>Research {gap.researchOutcome || "unresolved"} · Measurement NOT PROVEN</p>
                  </article>
                ))}
              </div>
            ) : (
              <DataState title="No exact research-status items"
                detail="Missing statuses do not prove that outstanding questions are resolved." />
            )}
          </Panel>

          <Panel title="What could move next"
            description="Event references frozen into the selected Journey. Historical editions never borrow today's calendar."
            action={<Badge>{projection.events.length} EVENTS</Badge>}>
            {projection.events.length ? (
              <div className={styles.recordList}>
                {projection.events.slice(0, 8).map((event) => (
                  <article key={event.eventId} className={styles.record}>
                    <span className={styles.kicker}>
                      {projection.focus.event === event.eventId ? "FOCUSED EVENT · " : ""}
                      EDITION EVENT · {event.eventId}
                    </span>
                    <h3>{event.title}</h3>
                  </article>
                ))}
              </div>
            ) : (
              <DataState title="No dated catalysts in this edition" detail="No events have been guessed." />
            )}
          </Panel>
          <PresenterPrepSession
            editionId={projection.pinned.editionId}
            dossierId={projection.pinned.dossierId}
            sourceCounts={{
              stories: projection.stories.length,
              motions: projection.motions.length,
              events: projection.events.length,
              researchGaps: projection.researchGaps.length,
            }}
          />
        </div>
      )}
    </LiveDeskShell>
  );
}
