import LiveDeskShell, { styles } from "@/components/live-desk/LiveDeskShell";
import MarketMotionOverview from "@/components/live-desk/MarketMotionOverview";
import PresenterDivergenceJourney from "@/components/live-desk/PresenterDivergenceJourney";
import HybridReasoningPanel from "@/components/live-desk/HybridReasoningPanel";
import RateRegimeEducationalShell from "@/components/live-desk/RateRegimeEducationalShell";
import { Badge, DataState, formatDeskDate, MetricGrid, Panel } from "@/components/live-desk/LiveDeskUi";
import { getDeskData } from "@/lib/data";
import { buildD7CrossLayerDivergence } from "@/lib/dossier-v2/cross-layer-divergence";
import { getDossierV2PresentationSelection } from "@/lib/dossier-v2/presentation-reader";
import { buildCanonicalEditionIndex, selectCanonicalEdition } from "@/lib/edition-replay";
import { withinTimeout } from "@/lib/async-timeout";
import type { EditionUpcoming } from "@/lib/intelligence/edition";
import { sortUpcomingByTime } from "@/lib/intelligence/upcoming-order";
import { getHybridPresenterEditionCandidates } from "@/lib/hybrid-publication";
import { loadHybridResearchGapStatus } from "@/lib/hybrid-research-gap-status";
import {
  buildPresenterCanonicalStoryCases,
  presenterStorySourcesFromEditionPayload,
} from "@/lib/presenter-canonical-story-bridge";
import { buildPresenterHistoricalContextBoundary } from "@/lib/presenter-historical-context-boundary";
import { loadPresenterHistoricalDossierReplay } from "@/lib/presenter-historical-dossier-replay";
import { getStoryRecordLayer } from "@/lib/persistence/read";
import {
  marketMotionFromEditionPayload,
  selectMarketMotionEditionContext,
} from "@/lib/market-motion-edition";
import {
  deriveMarketMotionAttention,
  getCurrentMarketMotion,
  marketMotionAttention,
  MARKET_MOTION_DISPLAY_SAFETY_LIMIT,
  selectMarketMotionForOverview,
} from "@/lib/market-motion";
import { getRegimeExplanation } from "@/lib/regime-explanations";
import { routeDossierInvestigations } from "@/lib/regime-investigations";
import { buildRateEducationalProjection } from "@/lib/rate-regime-educational-projection";
import { buildRegimeProjection, getRegimeDefinition } from "@/lib/regimes";
import { buildHybridReasoningProjection } from "@/lib/hybrid-reasoning-projection";

export const dynamic = "force-dynamic";

type HybridOutputPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function calibrationTone(outcome: string): "default" | "ready" | "warn" | "risk" {
  if (outcome === "DIVERGENT") return "risk";
  if (outcome === "MIXED" || outcome === "UNRESOLVED") return "warn";
  if (outcome === "ALIGNED") return "ready";
  return "default";
}

function learningTone(state: string): "default" | "ready" | "warn" | "risk" {
  if (state === "DIVERGENCE_REVIEW") return "risk";
  if (state === "MIXED_REACTION_REVIEW" || state === "TRANSMISSION_UNRESOLVED") return "warn";
  if (state === "REACTION_RULE_SUPPORTED") return "ready";
  return "default";
}

function learningLabel(state: string) {
  if (state === "DIVERGENCE_REVIEW") return "REACTION DIVERGED";
  if (state === "MIXED_REACTION_REVIEW") return "MIXED REACTION";
  if (state === "REACTION_RULE_SUPPORTED") return "REACTION RULE SUPPORTED";
  if (state === "CLOSED_WITHOUT_MECHANISM_VERDICT") return "CLOSED · NO MECHANISM VERDICT";
  return "TRANSMISSION UNRESOLVED";
}

function reactionReadLabel(value: string) {
  if (value === "FOLLOWED_EXPECTATION") return "Followed expectation";
  if (value === "DID_NOT_FOLLOW_EXPECTATION") return "Did not follow expectation";
  if (value === "MIXED_REACTION") return "Mixed reaction";
  return "Not exactly measured";
}

function researchGapLifecycleDetail(status: string) {
  if (status === "COMPLETED") return "Research complete; canonical handoff pending";
  if (status === "HANDED_OFF") return "Returned to canonical research; current Dossier remains authoritative";
  if (status === "RESEARCHING") return "Research in progress";
  if (status === "CLAIMED") return "Claimed by the Research Gap worker";
  if (status === "QUEUED") return "Waiting for research";
  if (status === "NEW") return "Materialised research item";
  if (status === "CLOSED") return "Lifecycle case closed";
  return "Research lifecycle status unavailable";
}

function currentUpcoming(value: unknown): EditionUpcoming {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { economicCalendar: [], earnings: [], geopoliticalClock: [] };
  }
  const candidate = value as Partial<EditionUpcoming>;
  return {
    economicCalendar: sortUpcomingByTime(Array.isArray(candidate.economicCalendar) ? candidate.economicCalendar : []),
    earnings: sortUpcomingByTime(Array.isArray(candidate.earnings) ? candidate.earnings : []),
    geopoliticalClock: sortUpcomingByTime(Array.isArray(candidate.geopoliticalClock) ? candidate.geopoliticalClock : []),
  };
}

function upcomingTime(value: string | null | undefined) {
  if (!value) return "Time TBC";
  return Number.isFinite(Date.parse(value)) ? formatDeskDate(value) : value;
}

export default async function HybridOutputPage({ searchParams }: HybridOutputPageProps) {
  const [selection, data, recordLayer, presenterEditions, query] = await Promise.all([
    getDossierV2PresentationSelection(),
    getDeskData(),
    getStoryRecordLayer(),
    getHybridPresenterEditionCandidates(),
    searchParams,
  ]);
  const dossier = selection.presentation;

  if (!dossier) {
    return (
      <LiveDeskShell
        activePath="/hybrid-output"
        title="Hybrid Output"
        description="Review the handoff from canonical Live research records to the interpretative Hybrid experience."
        meta="Canonical Dossier unavailable"
      >
        <DataState
          title={selection.notice.label}
          detail={selection.notice.detail}
        />
      </LiveDeskShell>
    );
  }

  let researchGapStatus = null;
  if (selection.selectedDossierId) {
    try {
      researchGapStatus = await loadHybridResearchGapStatus(selection.selectedDossierId);
    } catch {
      researchGapStatus = null;
    }
  }

  const regimes = buildRegimeProjection({
    stories: data.stories,
    events: recordLayer.events,
    versions: recordLayer.thesisVersions,
    newsThreads: data.newsThreads,
    statements: data.statements,
    dossier,
  });
  const storySlug = typeof query.story === "string" ? query.story : null;
  const regimeSlug = typeof query.regime === "string" ? query.regime : null;
  const eventId = typeof query.event === "string" ? query.event : null;
  const motionId = typeof query.motion === "string" ? query.motion : null;
  const requestedEditionId = typeof query.edition === "string" ? query.edition : null;
  const focusedStory = storySlug ? data.stories.find((story) => story.slug === storySlug) || null : null;
  const focusedEvent = eventId ? recordLayer.events.find((event) => event.id === eventId) || null : null;
  const focusedEventStory = focusedEvent ? data.stories.find((story) => story.id === focusedEvent.story_id) || null : null;
  const focusedRegime = regimeSlug ? regimes.find((regime) => regime.slug === regimeSlug) || null : null;
  const routedInvestigations = routeDossierInvestigations(
    dossier.watchNext,
    dossier.whatMattersNow.stories,
  );
  const focusedRateEducation = focusedRegime
    ? buildRateEducationalProjection({
        regime: focusedRegime,
        explanation: getRegimeExplanation(focusedRegime.slug),
        investigations: routedInvestigations,
        dossier: { dossierId: dossier.dossierId, asOf: dossier.asOf, rateRegime: dossier.rateRegime },
      })
    : null;
  const preferredStoryId = (focusedStory || focusedEventStory)?.id || null;
  const preferredRegimeSlug = focusedRegime?.slug || null;
  const dossierStory = (focusedStory || focusedEventStory)
    ? dossier.whatMattersNow.stories.find((story) => story.id === (focusedStory || focusedEventStory)?.id) || null
    : null;

  const presenterEditionIndex = buildCanonicalEditionIndex(
    presenterEditions,
    data.researchRuns,
  );
  const presenterEditionSelection = selectCanonicalEdition(
    presenterEditionIndex,
    requestedEditionId,
  );
  const currentEditionPointer = presenterEditionSelection.current;
  const currentEdition = currentEditionPointer
    ? presenterEditions.find((item) => item.id === currentEditionPointer.snapshotId) || null
    : null;
  const upcoming = currentUpcoming(currentEdition?.payload.upcoming);
  const upcomingCount = upcoming.economicCalendar.length + upcoming.earnings.length + upcoming.geopoliticalClock.length;
  const selectedPresenterEdition = presenterEditionSelection.selected
    ? presenterEditions.find((item) => item.id === presenterEditionSelection.selected?.snapshotId) || null
    : null;
  const presenterEditionStatus = presenterEditionSelection.status === "invalid_fallback_current"
    ? "invalid_fallback_current" as const
    : presenterEditionSelection.selected?.snapshotId
      && presenterEditionSelection.selected.snapshotId !== presenterEditionSelection.current?.snapshotId
        ? "historical" as const
        : "current" as const;
  const presenterHistoricalDossierReplay = presenterEditionStatus === "historical"
    ? await loadPresenterHistoricalDossierReplay(selectedPresenterEdition?.payload)
    : null;
  const presenterDossier = presenterHistoricalDossierReplay?.status === "BOUND"
    && presenterHistoricalDossierReplay.selection?.presentation
      ? presenterHistoricalDossierReplay.selection.presentation
      : dossier;
  const presenterHistoricalContextBoundary = buildPresenterHistoricalContextBoundary({
    editionSelectionStatus: presenterEditionStatus,
    selectedEditionId: presenterEditionSelection.selected?.snapshotId ?? null,
    currentEditionId: presenterEditionSelection.current?.snapshotId ?? null,
    dossierId: selection.selectedDossierId,
    dossierAsOf: selection.selectedAsOf,
    exactHistoricalDossier: presenterHistoricalDossierReplay?.status === "BOUND"
      && presenterHistoricalDossierReplay.selection
      ? {
          dossierId: presenterHistoricalDossierReplay.selection.selectedDossierId!,
          dossierAsOf: presenterHistoricalDossierReplay.selection.selectedAsOf!,
        }
      : null,
  });
  const presenterStorySources = presenterStorySourcesFromEditionPayload(selectedPresenterEdition?.payload);
  const presenterCanonicalCases = buildPresenterCanonicalStoryCases({
    investigations: presenterDossier.watchNext,
    storySources: presenterStorySources,
  });
  const presenterEditionOptions = presenterEditionIndex.slice(0, 8).map((edition) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (key === "edition" || value === undefined) continue;
      if (Array.isArray(value)) {
        for (const item of value) params.append(key, item);
      } else {
        params.set(key, value);
      }
    }
    if (edition.snapshotId !== currentEditionPointer?.snapshotId) {
      params.set("edition", edition.snapshotId);
    }
    const search = params.toString();
    return {
      snapshotId: edition.snapshotId,
      label: `${edition.slot || "Journey"} · ${formatDeskDate(edition.scheduledFor || edition.publishedAt)}`,
      freshness: edition.freshness,
      href: `/hybrid-output${search ? `?${search}` : ""}#presenter-reasoning`,
    };
  });
  const motionRegimeContext =
    presenterEditionStatus === "historical"
      && presenterHistoricalDossierReplay?.status !== "BOUND"
      ? []
      : presenterDossier.motionRegimeContext ?? [];
  const motionRegimeContextById = new Map(
    motionRegimeContext.map((item) => [item.motionId, item] as const),
  );
  const motionAdjudicationContext =
    presenterEditionStatus === "historical"
      && presenterHistoricalDossierReplay?.status !== "BOUND"
      ? []
      : presenterDossier.motionAdjudicationContext ?? [];
  const motionAdjudicationContextById = new Map(
    motionAdjudicationContext.map((item) => [item.motionId, item] as const),
  );
  const motionEdition = presenterEditionStatus === "historical"
    ? selectedPresenterEdition
    : currentEdition;
  const marketMotionAttachment = marketMotionFromEditionPayload(motionEdition?.payload);
  const editionMotionJourney = selectMarketMotionEditionContext({
    attachment: marketMotionAttachment,
    preferredStoryId,
    preferredRegimeSlug,
    limit: MARKET_MOTION_DISPLAY_SAFETY_LIMIT,
  }).map((item) => {
    const directRegimeContribution = motionRegimeContextById.get(item.id) ?? null;
    const dossierAdjudication = motionAdjudicationContextById.get(item.id) ?? null;
    const regimeContribution = directRegimeContribution ?? dossierAdjudication;
    const regimeSlug = regimeContribution?.regimeSlug ?? item.regimeSlug;
    const regime = regimeSlug ? getRegimeDefinition(regimeSlug) : null;
    const attention = deriveMarketMotionAttention({
      materiality: item.materiality,
      relevance: item.relevance,
      novelty: item.novelty,
      verificationState: item.verificationState,
      lifecycleState: item.lifecycleState,
      category: item.category,
      tickers: item.tickers,
      marketReaction: item.marketReaction,
    });
    return {
      id: item.id,
      attentionTier: attention.tier,
      attentionScore: attention.score,
      writingPotential: attention.writingPotential,
      attentionReasons: attention.reasons,
      headline: item.headline,
      category: item.category,
      lifecycleState: item.lifecycleState,
      verificationState: item.verificationState,
      whatHappened: item.whatHappened,
      marketReaction: item.marketReaction,
      whyInteresting: item.whyInteresting,
      bigPictureBridge: item.bigPictureBridge,
      nextTest: item.nextTest,
      tickers: item.tickers,
      occurredAt: item.occurredAt,
      sourceName: item.sourceName,
      sourceUrl: item.sourceUrl,
      storyId: item.storyId,
      storySlug: item.storySlug,
      storyTitle: item.storyTitle,
      storyHref: item.storySlug ? `/stories/${item.storySlug}` : null,
      regimeSlug,
      regimeLabel: regime?.shortTitle || item.regimeLabel,
      regimeHref: regimeSlug
        ? presenterEditionStatus === "current" && regimeContribution
          ? `/regimes/${regimeSlug}?view=live#${directRegimeContribution ? "dossier-regime-context" : "dossier-story-readthrough"}`
          : `/regimes/${regimeSlug}`
        : null,
      regimeContributionState: regimeContribution?.decision ?? (regimeSlug ? "PENDING" as const : null),
      regimeContributionMode: directRegimeContribution
        ? "DIRECT" as const
        : dossierAdjudication
          ? "READ_THROUGH" as const
          : null,
      regimeContribution: regimeContribution?.conclusion ?? null,
      regimeContributionRationale: regimeContribution?.rationale ?? null,
      regimeContributionNextTest: regimeContribution?.nextTest ?? null,
      regimeContributionEvidenceCount: regimeContribution?.canonicalEvidenceRefs.length ?? 0,
    };
  });
  const liveMotionRows = presenterEditionStatus === "current"
    ? await withinTimeout(
        "Hybrid Market Motion",
        () => getCurrentMarketMotion({ limit: 60 }),
        1_800,
      ).catch(() => [])
    : [];
  const liveMotionJourney = selectMarketMotionForOverview(
    liveMotionRows,
    new Date(),
    MARKET_MOTION_DISPLAY_SAFETY_LIMIT,
  ).map((item) => {
    const directRegimeContribution = motionRegimeContextById.get(item.id) ?? null;
    const dossierAdjudication = motionAdjudicationContextById.get(item.id) ?? null;
    const regimeContribution = directRegimeContribution ?? dossierAdjudication;
    const regimeSlug = regimeContribution?.regimeSlug ?? item.primary_regime_slug;
    const attention = marketMotionAttention(item);
    const story = item.primary_story_id
      ? data.stories.find((candidate) => candidate.id === item.primary_story_id) || null
      : null;
    const regime = regimeSlug ? getRegimeDefinition(regimeSlug) : null;
    return {
      id: item.id,
      attentionTier: attention.tier,
      attentionScore: attention.score,
      writingPotential: attention.writingPotential,
      attentionReasons: attention.reasons,
      headline: item.headline,
      category: item.category,
      lifecycleState: item.lifecycle_state,
      verificationState: item.verification_state,
      whatHappened: item.what_happened,
      marketReaction: item.market_reaction,
      whyInteresting: item.why_interesting,
      bigPictureBridge: item.big_picture_bridge,
      nextTest: item.next_test,
      tickers: item.tickers,
      occurredAt: item.occurred_at,
      sourceName: item.source_name,
      sourceUrl: item.source_url,
      storyId: story?.id || null,
      storySlug: story?.slug || null,
      storyTitle: story?.title || null,
      storyHref: story ? `/stories/${story.slug}` : null,
      regimeSlug,
      regimeLabel: regime?.shortTitle || null,
      regimeHref: regimeSlug
        ? regimeContribution
          ? `/regimes/${regimeSlug}?view=live#${directRegimeContribution ? "dossier-regime-context" : "dossier-story-readthrough"}`
          : `/regimes/${regimeSlug}`
        : null,
      regimeContributionState: regimeContribution?.decision ?? (regimeSlug ? "PENDING" as const : null),
      regimeContributionMode: directRegimeContribution
        ? "DIRECT" as const
        : dossierAdjudication
          ? "READ_THROUGH" as const
          : null,
      regimeContribution: regimeContribution?.conclusion ?? null,
      regimeContributionRationale: regimeContribution?.rationale ?? null,
      regimeContributionNextTest: regimeContribution?.nextTest ?? null,
      regimeContributionEvidenceCount: regimeContribution?.canonicalEvidenceRefs.length ?? 0,
    };
  });
  const motionJourney = presenterEditionStatus === "historical"
    ? editionMotionJourney
    : liveMotionJourney.length
      ? liveMotionJourney
      : editionMotionJourney;
  const primaryMotionCount = motionJourney.filter((item) => item.attentionTier === "PRIMARY").length;
  const secondaryMotionCount = motionJourney.filter((item) => item.attentionTier === "SECONDARY").length;
  const focusedMotion = motionId ? motionJourney.find((item) => item.id === motionId) || null : null;
  const focusedDossierRegimeContext = motionId
    ? motionRegimeContextById.get(motionId) ?? null
    : null;
  const unresolvedPolicyChecks = dossier.policyOutlook.filter(
    (item) => item.gaps.length > 0,
  ).length;
  const requiredCharts = dossier.charts.core.length;
  const hybridReasoning = buildHybridReasoningProjection({
    dossier,
    stories: data.stories,
    events: recordLayer.events,
    versions: recordLayer.thesisVersions,
  });
  const crossLayerDivergence = buildD7CrossLayerDivergence({
    dossier,
    hybrid: hybridReasoning,
    regimes,
  });
  const crossLayerAttention = crossLayerDivergence.cases.filter(
    (item) => item.state !== "ALIGNMENT",
  );
  const crossLayerRiskCount = crossLayerDivergence.summary.CONTRADICTION;
  const crossLayerLagCount = crossLayerDivergence.summary.LAG;

  return (
    <LiveDeskShell
      activePath="/hybrid-output"
      title="Hybrid Output"
      description="Start from fresh Market Motion and the next scheduled catalysts. Use the canonical Dossier underneath for durable reasoning and regime context."
      meta={`${motionJourney.length} fresh Motion · ${upcomingCount} upcoming · ${primaryMotionCount} primary · ${secondaryMotionCount} secondary`}
    >
      <div className={styles.grid}>
        <MetricGrid
          items={[
            { value: motionJourney.length, label: "Fresh Motion" },
            { value: primaryMotionCount, label: "Primary Motion" },
            { value: secondaryMotionCount, label: "Secondary Motion" },
            { value: upcomingCount, label: "Upcoming catalysts" },
          ]}
        />

        {motionJourney.length ? (
          <MarketMotionOverview
            items={motionJourney}
            eyebrow="MARKET MOTION JOURNEY"
            title="What moved, why it matters, and what to do next"
            description={presenterEditionStatus === "historical"
              ? "Historical replay uses the exact immutable Motion snapshot captured with that Journey edition."
              : "The live 48-hour Motion stream is the opening layer: event → why interesting → market reaction → Story/Regime bridge → what to investigate or write. Motion can direct attention, but it cannot create an independent regime or thesis."}
            showFullTapeLink
            journeyMode
          />
        ) : (
          <DataState
            title="No fresh Market Motion"
            detail="Hybrid will not manufacture an opening from stale headlines. The next scheduled catalysts are shown below, while the canonical Dossier remains the durable market state."
          />
        )}

        <Panel
          title="Upcoming news & catalysts"
          description="What could move next. These scheduled macro, earnings and geopolitical events come from the current immutable Journey edition rather than being inferred from the Dossier."
          action={<Badge tone={upcomingCount ? "ready" : "default"}>{upcomingCount ? `${upcomingCount} UPCOMING` : "NO UPCOMING EVENTS"}</Badge>}
        >
          {upcomingCount ? (
            <div className={styles.recordList}>
              {upcoming.economicCalendar.slice(0, 6).map((item, index) => (
                <article className={styles.record} key={`macro:${item.event}:${item.time}:${index}`}>
                  <div className={styles.recordHeader}>
                    <div>
                      <span className={styles.kicker}>MACRO / POLICY · {upcomingTime(item.time)}</span>
                      <h3>{item.event}</h3>
                    </div>
                    <Badge>UPCOMING</Badge>
                  </div>
                  <p><strong>Why it matters:</strong> {item.whyItMatters}</p>
                  <p className={styles.meta}>
                    Consensus {item.consensus || "—"} · Prior {item.prior || "—"}
                    {item.exposedAssets.length ? ` · ${item.exposedAssets.join(" · ")}` : ""}
                  </p>
                </article>
              ))}
              {upcoming.earnings.slice(0, 4).map((item, index) => (
                <article className={styles.record} key={`earnings:${item.company}:${item.time}:${index}`}>
                  <div className={styles.recordHeader}>
                    <div>
                      <span className={styles.kicker}>EARNINGS · {upcomingTime(item.time)}</span>
                      <h3>{item.company}</h3>
                    </div>
                    <Badge>UPCOMING</Badge>
                  </div>
                  <p><strong>Decisive variable:</strong> {item.decisiveVariable}</p>
                  <p><strong>Theme:</strong> {item.linkedTheme}</p>
                  <p className={styles.meta}>Confirm: {item.confirmationCase} · Risk: {item.disappointmentCase}</p>
                </article>
              ))}
              {upcoming.geopoliticalClock.slice(0, 4).map((item, index) => (
                <article className={styles.record} key={`geopolitical:${item.event}:${item.time || "tbc"}:${index}`}>
                  <div className={styles.recordHeader}>
                    <div>
                      <span className={styles.kicker}>GEOPOLITICAL CLOCK · {upcomingTime(item.time)}</span>
                      <h3>{item.event}</h3>
                    </div>
                    <Badge>{item.verificationState?.toUpperCase() || "SCHEDULED"}</Badge>
                  </div>
                  <p><strong>Transmission:</strong> {item.transmission}</p>
                  <p><strong>Decisive outcome:</strong> {item.decisiveOutcome}</p>
                  <p className={styles.meta}>
                    {item.participants.length ? item.participants.join(" · ") : "Participants unresolved"}
                    {item.affectedAssets?.length ? ` · ${item.affectedAssets.join(" · ")}` : ""}
                  </p>
                  {item.sourceUrl && item.sourceName ? (
                    <a className={styles.link} href={item.sourceUrl} target="_blank" rel="noreferrer">
                      Source · {item.sourceName} ↗
                    </a>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <DataState
              title="No scheduled catalyst in the current Journey edition"
              detail="Hybrid will stay focused on fresh Market Motion until the canonical event horizon supplies the next macro, earnings or geopolitical event."
            />
          )}
        </Panel>

        <DataState
          title={selection.notice.label}
          detail={selection.notice.detail}
        />

        {focusedDossierRegimeContext ? (
          <Panel
            title="Dossier System 2 Regime context"
            description="Immutable accepted/refined Dossier judgement for this exact Motion and Regime. This is analytical context only; it does not change Regime state by itself."
            action={<Badge>{focusedDossierRegimeContext.decision}</Badge>}
          >
            <article className={styles.record} id="dossier-regime-context">
              <div className={styles.recordHeader}>
                <div>
                  <span className={styles.kicker}>SYSTEM 2 · {focusedDossierRegimeContext.decision}</span>
                  <h3>{focusedDossierRegimeContext.conclusion}</h3>
                </div>
                <Badge>NON-STATE</Badge>
              </div>
              <p><strong>Why System 2 kept it:</strong> {focusedDossierRegimeContext.rationale}</p>
              <p><strong>Next test:</strong> {focusedDossierRegimeContext.nextTest || "No additional discriminator was persisted."}</p>
              <p>
                <strong>Authority:</strong> the conclusion above is the persisted Dossier judgement. The original Motion remains discovery context and cannot become Regime state or evidence by itself.
              </p>
              <p className={styles.meta}>
                Regime {focusedDossierRegimeContext.regimeSlug}
                {focusedDossierRegimeContext.storyId ? ` · Story ${focusedDossierRegimeContext.storyId}` : ""}
                {focusedDossierRegimeContext.canonicalEvidenceRefs.length
                  ? ` · ${focusedDossierRegimeContext.canonicalEvidenceRefs.length} canonical evidence ref${focusedDossierRegimeContext.canonicalEvidenceRefs.length === 1 ? "" : "s"}`
                  : ""}
              </p>
              <p>
                <a className={styles.link} href={`/regimes/${focusedDossierRegimeContext.regimeSlug}`}>
                  Open exact Regime →
                </a>
              </p>
            </article>
          </Panel>
        ) : null}

        {motionId ? (
          focusedMotion ? (
            <Panel
              title="Motion context path"
              description={presenterEditionStatus === "historical"
                ? "Exact immutable Motion context from the selected historical Journey edition. Operational Research Gap work begins only from canonical Dossier research and investigation outputs."
                : "Exact context from the live 48-hour Motion stream. Operational Research Gap work begins only from canonical Dossier research and investigation outputs."}
              action={<Badge>DISCOVERY CONTEXT</Badge>}
            >
              <article className={styles.record} id="motion-investigation">
                <div className={styles.recordHeader}>
                  <div>
                    <span className={styles.kicker}>{focusedMotion.attentionTier} MOTION · {focusedMotion.category.replaceAll("_", " ")}</span>
                    <h3>{focusedMotion.headline}</h3>
                  </div>
                  <Badge>{focusedMotion.verificationState}</Badge>
                </div>
                <p><strong>What happened:</strong> {focusedMotion.whatHappened}</p>
                <p><strong>Why it matters:</strong> {focusedMotion.whyInteresting}</p>
                {focusedMotion.marketReaction ? <p><strong>Market reaction:</strong> {focusedMotion.marketReaction}</p> : null}
                <p><strong>Big-picture bridge:</strong> {focusedMotion.bigPictureBridge}</p>
                <p><strong>Investigation next:</strong> {focusedMotion.nextTest || "No exact next test is persisted; this Motion stays context-only."}</p>
                <p>
                  <strong>Routing:</strong> Motion → canonical Dossier System 2 → Dossier research/investigation output → Research Gap lifecycle.
                  Raw Motion does not create Research Gap work directly; Dossier/regime state changes only if later canonical evidence changes the accepted interpretation.
                </p>
                <p>
                  {focusedMotion.storyHref && focusedMotion.storyTitle ? (
                    <>
                      <a className={styles.link} href={focusedMotion.storyHref}>Story · {focusedMotion.storyTitle}</a>
                      {" · "}
                    </>
                  ) : null}
                  {focusedMotion.regimeHref && focusedMotion.regimeLabel ? (
                    <>
                      <a className={styles.link} href={focusedMotion.regimeHref}>Regime · {focusedMotion.regimeLabel}</a>
                      {" · "}
                    </>
                  ) : null}
                  <a className={styles.link} href={focusedMotion.sourceUrl} target="_blank" rel="noreferrer">Source · {focusedMotion.sourceName} ↗</a>
                </p>
              </article>
            </Panel>
          ) : (
            <DataState
              title={presenterEditionStatus === "historical" ? "Motion is not in the selected Journey edition" : "Motion is not in the live 48-hour stream"}
              detail={focusedDossierRegimeContext
                ? "The raw discovery Motion is no longer in the selected Motion context. The immutable Dossier System 2 judgement above remains the authoritative explanation for this link."
                : presenterEditionStatus === "historical"
                  ? "Historical replay only opens context from the exact immutable Motion snapshot attached to that Journey edition."
                  : "The current Hybrid only opens context from fresh Market Motion. It will not recover an expired or fuzzy match."}
            />
          )
        ) : null}

        <HybridReasoningPanel projection={hybridReasoning} />

        <Panel
          title="Cross-layer checks"
          description="Deterministic D7 comparison of the current Dossier, exact persistent Stories, Regimes, Hybrid scenario transitions and measured market reactions. This panel is read-only; operational research is materialised by the backend Research Gap lifecycle."
          action={
            <Badge tone={crossLayerRiskCount > 0 ? "risk" : crossLayerLagCount > 0 ? "warn" : "ready"}>
              {crossLayerRiskCount > 0
                ? `${crossLayerRiskCount} CONTRADICTION`
                : crossLayerLagCount > 0
                  ? `${crossLayerLagCount} LAG`
                  : "ALIGNED"}
            </Badge>
          }
        >
          <MetricGrid
            items={[
              { value: crossLayerDivergence.summary.ALIGNMENT, label: "Aligned" },
              { value: crossLayerDivergence.summary.CONTRADICTION, label: "Contradiction" },
              { value: crossLayerDivergence.summary.LAG, label: "Lag" },
              { value: crossLayerDivergence.summary.UNRESOLVED, label: "Unresolved" },
            ]}
          />
          {crossLayerAttention.length ? (
            <div className={styles.recordList}>
              {crossLayerAttention.slice(0, 8).map((item) => (
                <article className={styles.record} key={item.id}>
                  <div className={styles.recordHeader}>
                    <div>
                      <span className={styles.kicker}>{item.pair.replaceAll("_", " ")}</span>
                      <h3>{item.state}</h3>
                    </div>
                    <Badge tone={item.state === "CONTRADICTION" ? "risk" : item.state === "LAG" ? "warn" : "default"}>
                      {item.severity}
                    </Badge>
                  </div>
                  <p>{item.reason}</p>
                  <div className={styles.meta}>
                    {item.persistentStoryId ? `Story ${item.persistentStoryId}` : "No persistent Story"}
                    {item.investigationId ? ` · Investigation ${item.investigationId}` : ""}
                    {item.regimeSlug ? ` · Regime ${item.regimeSlug}` : ""}
                    {item.researchEligible ? " · Research eligible" : ""}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <DataState
              title="No cross-layer mismatch"
              detail="The governed Dossier, Story, Regime, Hybrid and measured-reaction comparisons are aligned for the current snapshot."
            />
          )}
        </Panel>

        <Panel
          title="Canonical context"
          description="The Dossier remains the analytical authority. Hybrid links Motion back to that record instead of duplicating the Presenter, causal storyline, or creating a second regime."
          action={<Badge tone={selection.selectedDossierId ? "ready" : "warn"}>{selection.selectedDossierId ? "DOSSIER LINKED" : "DOSSIER UNAVAILABLE"}</Badge>}
        >
          <div className={styles.recordList}>
            <article className={styles.record}>
              <div className={styles.recordHeader}>
                <div>
                  <span className={styles.kicker}>Durable market state</span>
                  <h3>{dossier.header.headline}</h3>
                </div>
                <Badge>{selection.status.replaceAll("_", " ").toUpperCase()}</Badge>
              </div>
              <p>
                Canonical Dossier ID: {selection.selectedDossierId || "Unavailable"}.
                Motion is the event-led discovery layer; the Dossier owns the deeper accepted reasoning and regime state.
              </p>
              <a className={styles.link} href="/dossier">Open canonical Dossier →</a>
            </article>
          </div>
        </Panel>

        {(focusedRegime || focusedStory || focusedEvent) ? (
          <Panel
            title={focusedRegime ? `Focused Regime · ${focusedRegime.shortTitle}` : focusedEvent ? "Focused Event" : "Focused Story"}
            description="This view is anchored to the exact Live object that opened Hybrid. Hybrid explains the canonical state; it does not create a second thesis."
            action={<Badge tone="ready">Deep linked</Badge>}
          >
            <div className={styles.recordList}>
              {focusedRegime ? (
                <>
                  {focusedRateEducation ? (
                    <RateRegimeEducationalShell projection={focusedRateEducation} compact />
                  ) : null}
                  <article className={styles.record}>
                    <div className={styles.recordHeader}>
                      <div>
                        <h3>{focusedRegime.title}</h3>
                        <div className={styles.meta}>{focusedRegime.state} · {focusedRegime.confidence} · {focusedRegime.durableStories.length} durable · {focusedRegime.contextStories.length} context</div>
                      </div>
                      <Badge>{focusedRegime.stateKind === "system1" ? "SYSTEM 1 + SYSTEM 2" : "STORY-LED"}</Badge>
                    </div>
                    <p><strong>Why it matters:</strong> {focusedRegime.whyItMatters}</p>
                    <p><strong>Mechanism:</strong> {focusedRegime.mechanism}</p>
                    <p><strong>Current question:</strong> {focusedRegime.coreQuestion}</p>
                  </article>
                  {focusedRegime.latestNode ? (
                    <article className={styles.record}>
                      <h3>Latest contribution</h3>
                      <p>{focusedRegime.latestNode.title}</p>
                      <p>{focusedRegime.latestNode.detail}</p>
                    </article>
                  ) : null}
                  <a className={styles.link} href={`/regimes/${focusedRegime.slug}`}>Back to Live Regime →</a>
                </>
              ) : focusedEvent ? (
                <>
                  <article className={styles.record}>
                    <div className={styles.recordHeader}>
                      <div>
                        <h3>{focusedEvent.headline}</h3>
                        <div className={styles.meta}>{focusedEvent.event_type} · {focusedEvent.impact || "unresolved"}</div>
                      </div>
                      <Badge>{focusedEvent.impact || "EVENT"}</Badge>
                    </div>
                    <p>{focusedEvent.detail || "No additional Story-event detail was persisted."}</p>
                    {focusedEventStory ? <p><strong>Story:</strong> {focusedEventStory.title}</p> : null}
                  </article>
                  {dossierStory ? (
                    <article className={styles.record}>
                      <h3>Why this matters now</h3>
                      <p>{dossierStory.whyItMatters}</p>
                      <p><strong>Mechanism:</strong> {dossierStory.mechanism}</p>
                      <p><strong>Current read:</strong> {dossierStory.conclusion}</p>
                    </article>
                  ) : (
                    <DataState title="Not promoted into the current Dossier" detail="The event remains canonical Live history, but the current Dossier did not promote its parent Story into What Matters Now. Hybrid will not invent a new explanation." />
                  )}
                  {focusedEventStory ? <a className={styles.link} href={`/stories/${focusedEventStory.slug}#event-${focusedEvent.id}`}>Back to exact Live event →</a> : null}
                </>
              ) : focusedStory ? (
                <>
                  <article className={styles.record}>
                    <h3>{dossierStory?.title || focusedStory.title}</h3>
                    <p>{dossierStory?.whyItMatters || focusedStory.thesis}</p>
                    {dossierStory ? <p><strong>Mechanism:</strong> {dossierStory.mechanism}</p> : null}
                    {dossierStory ? <p><strong>Current read:</strong> {dossierStory.conclusion}</p> : <p>This Story is not promoted in the current Dossier; no extra interpretation is manufactured here.</p>}
                  </article>
                  <a className={styles.link} href={`/stories/${focusedStory.slug}`}>Back to Live Story →</a>
                </>
              ) : null}
            </div>
          </Panel>
        ) : null}

        <div className={styles.gridTwo}>
          <Panel
            title="Expectation → tape"
            description="Deterministic pre-event expectations and the canonical post-trigger observations passed to Hybrid."
          >
            <div className={styles.recordList}>
              {dossier.policyOutlook.length ? dossier.policyOutlook.map((item) => (
                <article className={styles.record} key={item.id}>
                  <div className={styles.recordHeader}>
                    <div>
                      <h3>{item.trigger}</h3>
                      <div className={styles.meta}>
                        {item.ruleId} · {item.nextMeetingRateOutlook.replaceAll("_", " ")}
                      </div>
                    </div>
                    <Badge tone={item.policyImpulse === "HAWKISH" ? "warn" : "ready"}>
                      {item.policyImpulse}
                    </Badge>
                  </div>

                  <p>
                    Expected tape: {item.expectedMarketReactions
                      .map((reaction) => `${reaction.instrument} ${reaction.direction === "UP" ? "↑" : "↓"}`)
                      .join(" · ")}
                  </p>

                  <p>
                    Rate pricing: {item.observedRatePricing ?? "Not yet observed in canonical evidence."}
                  </p>

                  <p>
                    Tape confirmation: {item.observedConfirmation ?? "Not yet observed in canonical evidence."}
                  </p>

                  {item.gaps.length ? (
                    <p>
                      Missing: {item.gaps.join(" · ")}
                    </p>
                  ) : null}
                </article>
              )) : (
                <DataState
                  title="No deterministic policy checks in this Dossier"
                  detail="Hybrid should not manufacture an expectation or divergence when the canonical Dossier has none."
                />
              )}
            </div>
          </Panel>

          <Panel
            title="Presenter Divergence Lab"
            description="A read-only reasoning journey from the preserved expectation to measured tape, competing mechanisms and the next discriminator. Hybrid presents canonical reasoning; it does not create a new explanation."
          >
            <PresenterDivergenceJourney
              investigations={presenterDossier.watchNext}
              calibration={presenterDossier.reactionCalibration}
              canonicalCases={presenterCanonicalCases}
              editionContext={{
                selectedSnapshotId: presenterEditionSelection.selected?.snapshotId ?? null,
                currentSnapshotId: presenterEditionSelection.current?.snapshotId ?? null,
                status: presenterEditionStatus,
                options: presenterEditionOptions,
              }}
              historicalContextBoundary={presenterHistoricalContextBoundary}
            />

            {dossier.investigationJourney.some((item) => item.transition === "NOT_CARRIED_FORWARD") ? (
              <div className={styles.recordList}>
                {dossier.investigationJourney
                  .filter((item) => item.transition === "NOT_CARRIED_FORWARD")
                  .map((item) => (
                    <article className={styles.record} key={item.previousId ?? item.question}>
                      <div className={styles.recordHeader}>
                        <div>
                          <h3>{item.question}</h3>
                          <div className={styles.meta}>Prior investigation audit</div>
                        </div>
                        <Badge tone="default">NOT CARRIED FORWARD</Badge>
                      </div>
                      <p>
                        Previous state: {item.previousDivergence ?? "UNRESOLVED"} · {item.previousStatus ?? "unknown"}.
                        Absence from the current Dossier is not treated as resolution.
                      </p>
                    </article>
                  ))}
              </div>
            ) : null}
          </Panel>
        </div>

        {selection.calibrationLineages.length ? (
          <Panel
            title="Repeated calibration cases"
            description="Strict continuity only: exact investigation identity or unique Story/Thesis linkage."
          >
            <div className={styles.recordList}>
              {selection.calibrationLineages.slice(0, 4).map((lineage) => (
                <article className={styles.record} key={lineage.lineageId}>
                  <div className={styles.recordHeader}>
                    <div>
                      <h3>{lineage.latestQuestion}</h3>
                      <div className={styles.meta}>
                        {lineage.caseVintages} case vintages · {lineage.evaluatedVintages} exact evaluated · {formatDeskDate(lineage.firstAsOf)} → {formatDeskDate(lineage.latestAsOf)}
                      </div>
                    </div>
                    <Badge tone={learningTone(lineage.learningState)}>
                      {learningLabel(lineage.learningState)}
                    </Badge>
                  </div>
                  <p><strong>Reaction read:</strong> {reactionReadLabel(lineage.reactionRead)}</p>
                  <p><strong>Mechanism verdict:</strong> Not established by calibration. {lineage.mechanismRead}</p>
                  <p><strong>Transmission:</strong> {lineage.transmissionRead}</p>
                  <p><strong>What did we learn?</strong> {lineage.learningSummary}</p>
                  <p>
                    <strong>Sequence:</strong>{" "}
                    {lineage.cases.map((item) => item.outcome).join(" → ")}
                  </p>
                  <p><strong>Latest hypothesis:</strong> {lineage.latestPostMortemHypothesis}</p>
                  <p><strong>Next discriminator:</strong> {lineage.latestResearchNext}</p>
                  {lineage.expectationRewriteCount ? (
                    <p>
                      <strong>Expectation rewrites flagged:</strong> {lineage.expectationRewriteCount}
                      {lineage.rewriteOnlyVintages ? " · " + lineage.rewriteOnlyVintages + " without exact reaction audit" : ""}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          </Panel>
        ) : null}

        {selection.calibrationHistory.length ? (
          <Panel
            title="Reasoning history"
            description="Read-only prior Dossier calibration cases. Hybrid may teach from these records but must not rewrite them."
          >
            <div className={styles.recordList}>
              {selection.calibrationHistory.slice(0, 4).flatMap((entry) =>
                entry.cases.map((item) => (
                  <article className={styles.record} key={entry.dossierId + "-" + item.investigationId}>
                    <div className={styles.recordHeader}>
                      <div>
                        <h3>{item.question}</h3>
                        <div className={styles.meta}>
                          {formatDeskDate(entry.asOf)} · {item.checkCount} exact check(s) · {item.precision.toLowerCase().replaceAll("_", " ")}
                        </div>
                      </div>
                      <Badge tone={calibrationTone(item.outcome)}>{item.outcome}</Badge>
                    </div>
                    <p><strong>Pre-tape expectation:</strong> {item.priorExpectedReaction ?? item.currentExpectedReaction ?? "Not preserved."}</p>
                    <p><strong>Measured tape:</strong> {item.observedReaction ?? "No reader-facing reaction summary."}</p>
                    <p><strong>{item.requiresReview ? "Post-mortem hypothesis:" : "Vintage explanation:"}</strong> {item.postMortemHypothesis}</p>
                    {item.competingExplanations.length ? (
                      <p><strong>Competing:</strong> {item.competingExplanations.join(" · ")}</p>
                    ) : null}
                    <p><strong>Next discriminator:</strong> {item.researchNext}</p>
                  </article>
                ))
              )}
            </div>
          </Panel>
        ) : null}

        <div className={styles.gridTwo}>
          <Panel
            title="Hybrid handoff integrity"
            description="What must remain unchanged when Hybrid turns the Dossier into a guided journey."
          >
            <div className={styles.recordList}>
              <article className={styles.record}>
                <h3>Preserve the prior expectation</h3>
                <p>Do not rewrite the expected reaction after seeing the tape.</p>
              </article>
              <article className={styles.record}>
                <h3>Keep unknown mechanisms unresolved</h3>
                <p>Candidate explanations remain hypotheses until supporting evidence is present.</p>
              </article>
              <article className={styles.record}>
                <h3>Carry invalidation forward</h3>
                <p>Each investigation keeps its confirmation and invalidation conditions visible to Hybrid.</p>
              </article>
            </div>
          </Panel>

          <Panel
            title="Current handoff status"
            description="Bounded canonical state available to the Hybrid presentation layer."
          >
            <div className={styles.recordList}>
              <article className={styles.record}>
                <h3>Dossier</h3>
                <p>{dossier.header.headline}</p>
              </article>
              <article className={styles.record}>
                <h3>Unresolved policy checks</h3>
                <p>{unresolvedPolicyChecks} check(s) still have missing canonical confirmation data.</p>
              </article>
              <article className={styles.record}>
                <h3>Required chart work</h3>
                <p>{requiredCharts} core chart investigation(s) are attached to the current Dossier.</p>
              </article>
              <article className={styles.record}>
                <h3>Research Gap lifecycle</h3>
                {researchGapStatus?.items.length ? (
                  <div className={styles.recordList}>
                    {researchGapStatus.items.map((item) => (
                      <div key={item.gapKey}>
                        <div className={styles.recordHeader}>
                          <strong>{item.sourceKind.replaceAll("_", " ")}</strong>
                          <Badge>{item.lifecycleStatus}</Badge>
                        </div>
                        <p>{researchGapLifecycleDetail(item.lifecycleStatus)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p>No materialised Research Gap lifecycle for this Dossier.</p>
                )}
              </article>
            </div>
          </Panel>
        </div>

        <a
          className={styles.primaryButton}
          href="https://alchemy-hybrid-market-desk.vercel.app/overview"
          target="_blank"
          rel="noreferrer"
        >
          Open current Hybrid Desk ↗
        </a>
      </div>
    </LiveDeskShell>
  );
}
