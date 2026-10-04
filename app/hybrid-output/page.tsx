import LiveDeskShell, { styles } from "@/components/live-desk/LiveDeskShell";
import MarketMotionOverview from "@/components/live-desk/MarketMotionOverview";
import PresenterDivergenceJourney from "@/components/live-desk/PresenterDivergenceJourney";
import RateRegimeEducationalShell from "@/components/live-desk/RateRegimeEducationalShell";
import { Badge, DataState, formatDeskDate, MetricGrid, Panel } from "@/components/live-desk/LiveDeskUi";
import { getDeskData } from "@/lib/data";
import { getDossierV2PresentationSelection } from "@/lib/dossier-v2/presentation-reader";
import { buildCanonicalEditionIndex } from "@/lib/edition-replay";
import { getHybridPresenterEditionCandidates } from "@/lib/hybrid-publication";
import { getStoryRecordLayer } from "@/lib/persistence/read";
import {
  marketMotionFromEditionPayload,
  selectMarketMotionEditionContext,
} from "@/lib/market-motion-edition";
import {
  deriveMarketMotionAttention,
  marketMotionInvestigationEligibility,
  MARKET_MOTION_DISPLAY_SAFETY_LIMIT,
} from "@/lib/market-motion";
import { getRegimeExplanation } from "@/lib/regime-explanations";
import { findResearchGapCasesForMotionIds } from "@/lib/research-gap-lifecycle";
import { routeDossierInvestigations } from "@/lib/regime-investigations";
import { buildRateEducationalProjection } from "@/lib/rate-regime-educational-projection";
import { buildRegimeProjection } from "@/lib/regimes";

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
  const gapId = typeof query.gap === "string" ? query.gap : null;
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
  const unresolvedMotionIds = dossier.motionAttention
    .filter((item) => item.decision === "UNRESOLVED")
    .map((item) => item.motionId);
  const motionGapCases = unresolvedMotionIds.length
    ? await findResearchGapCasesForMotionIds({
        motionIds: unresolvedMotionIds,
        dossierId: dossier.dossierId,
      })
    : [];
  const gapCasesByMotionId = new Map<string, typeof motionGapCases>();
  for (const gapCase of motionGapCases) {
    const rows = gapCasesByMotionId.get(gapCase.source_ref) ?? [];
    rows.push(gapCase);
    gapCasesByMotionId.set(gapCase.source_ref, rows);
  }
  const focusedGapCase = gapId
    ? motionGapCases.find((gapCase) => gapCase.id === gapId) || null
    : null;

  const dossierMotionDecisions = dossier.motionAttention
    .filter((item) => item.decision === "ACCEPT" || item.decision === "REFINE" || item.decision === "UNRESOLVED")
    .map((item) => {
      const story = item.storyId ? data.stories.find((candidate) => candidate.id === item.storyId) || null : null;
      const regime = item.regimeSlug ? regimes.find((candidate) => candidate.slug === item.regimeSlug) || null : null;
      return {
        ...item,
        storyTitle: story?.title || null,
        storyHref: story ? `/stories/${story.slug}` : null,
        regimeLabel: regime?.shortTitle || null,
        regimeHref: regime ? `/regimes/${regime.slug}` : null,
        researchGapCases: gapCasesByMotionId.get(item.motionId) ?? [],
      };
    });

  const currentEditionPointer = buildCanonicalEditionIndex(
    presenterEditions,
    data.researchRuns,
  )[0] || null;
  const currentEdition = currentEditionPointer
    ? presenterEditions.find((item) => item.id === currentEditionPointer.snapshotId) || null
    : null;
  const marketMotionAttachment = marketMotionFromEditionPayload(currentEdition?.payload);
  const motionJourney = selectMarketMotionEditionContext({
    attachment: marketMotionAttachment,
    preferredStoryId,
    preferredRegimeSlug,
    limit: MARKET_MOTION_DISPLAY_SAFETY_LIMIT,
  }).map((item) => {
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
    const investigation = marketMotionInvestigationEligibility({
      lifecycleState: item.lifecycleState,
      verificationState: item.verificationState,
      expiresAt: item.expiresAt,
      nextTest: item.nextTest,
      storyId: item.storyId,
      regimeSlug: item.regimeSlug,
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
      regimeSlug: item.regimeSlug,
      regimeLabel: item.regimeLabel,
      regimeHref: item.regimeSlug ? `/regimes/${item.regimeSlug}` : null,
      investigationEligible: investigation.eligible,
      investigationReason: investigation.reason,
      investigationHref: investigation.eligible
        ? `/hybrid-output?motion=${encodeURIComponent(item.id)}#motion-investigation`
        : null,
    };
  });
  const primaryMotionCount = motionJourney.filter((item) => item.attentionTier === "PRIMARY").length;
  const secondaryMotionCount = motionJourney.filter((item) => item.attentionTier === "SECONDARY").length;
  const focusedMotion = motionId ? motionJourney.find((item) => item.id === motionId) || null : null;
  const unresolvedPolicyChecks = dossier.policyOutlook.filter(
    (item) => item.gaps.length > 0,
  ).length;
  const openInvestigations = dossier.watchNext.length;
  const requiredCharts = dossier.charts.core.length;

  return (
    <LiveDeskShell
      activePath="/hybrid-output"
      title="Hybrid Output"
      description="Start from fresh Market Motion, follow the implication into the linked Story or Regime, then use the canonical Dossier only when deeper reasoning is needed."
      meta={`${motionJourney.length} fresh Motion · ${primaryMotionCount} primary · ${secondaryMotionCount} secondary · Dossier ${selection.selectedDossierId ? "linked" : "unavailable"}`}
    >
      <div className={styles.grid}>
        <MetricGrid
          items={[
            { value: motionJourney.length, label: "Fresh Motion" },
            { value: primaryMotionCount, label: "Primary Motion" },
            { value: secondaryMotionCount, label: "Secondary Motion" },
            { value: openInvestigations, label: "Open investigations" },
          ]}
        />

        <DataState
          title={selection.notice.label}
          detail={selection.notice.detail}
        />

        {motionJourney.length ? (
          <MarketMotionOverview
            items={motionJourney}
            eyebrow="MARKET MOTION JOURNEY"
            title="What moved, why it matters, and what to do next"
            description="The 48-hour Motion stream is the opening layer: event → why interesting → market reaction → Story/Regime bridge → what to investigate or write. Motion can direct attention, but it cannot create an independent regime or thesis."
            showFullTapeLink
            journeyMode
          />
        ) : (
          <DataState
            title="No fresh Market Motion"
            detail="Hybrid will not manufacture an opening from stale headlines. Open the canonical Dossier below for the latest durable market state."
          />
        )}

        {dossierMotionDecisions.length ? (
          <Panel
            title="Dossier Motion decisions"
            description="Latest accepted, refined, or unresolved Motion reasoning from the persisted Dossier. ACCEPT/REFINE may become promoted context; UNRESOLVED stays explicitly research-pending. This can appear before the next immutable Journey edition freezes promoted Motion and never reads the mutable current Motion view."
            action={<Badge tone={dossierMotionDecisions.some((item) => item.decision === "UNRESOLVED") ? "warn" : "ready"}>{dossierMotionDecisions.length} DOSSIER DECISION{dossierMotionDecisions.length === 1 ? "" : "S"}</Badge>}
          >
            <div className={styles.recordList}>
              {dossierMotionDecisions.map((item) => (
                <article className={styles.record} key={item.motionId}>
                  <div className={styles.recordHeader}>
                    <div>
                      <span className={styles.kicker}>{item.decision === "UNRESOLVED" ? "RESEARCH PENDING" : item.decision} · {item.scope}</span>
                      <h3>{item.headline}</h3>
                    </div>
                    <Badge tone={item.decision === "ACCEPT" ? "ready" : "warn"}>
                      {item.decision === "UNRESOLVED" ? "RESEARCH PENDING" : item.decision}
                    </Badge>
                  </div>
                  <p><strong>What happened:</strong> {item.whatHappened}</p>
                  <p><strong>Dossier read:</strong> {item.whyInteresting}</p>
                  {item.marketReaction ? <p><strong>Market reaction:</strong> {item.marketReaction}</p> : null}
                  <p><strong>Bridge:</strong> {item.bigPictureBridge}</p>
                  {item.nextTest ? <p><strong>{item.decision === "UNRESOLVED" ? "Research next" : "Next test"}:</strong> {item.nextTest}</p> : null}
                  <p><strong>Assessment:</strong> {item.reason}</p>
                  {item.decision === "UNRESOLVED" ? (
                    <>
                      <p><strong>Status:</strong> Research pending. No Motion promotion or canonical Story/Regime conclusion has been inferred from this unresolved assessment.</p>
                      {item.researchGapCases.length ? (
                        <p>
                          <strong>Research Gap:</strong>{" "}
                          {item.researchGapCases.map((gapCase, index) => (
                            <span key={gapCase.id}>
                              {index ? " · " : ""}
                              <a className={styles.link} href={`/hybrid-output?gap=${encodeURIComponent(gapCase.id)}#research-gap-case`}>
                                {gapCase.status} · {gapCase.id.slice(0, 8)}
                              </a>
                            </span>
                          ))}
                        </p>
                      ) : (
                        <p><strong>Research Gap:</strong> Materialisation pending; no durable case is linked to this Motion and Dossier yet.</p>
                      )}
                    </>
                  ) : null}
                  <p>
                    {item.storyHref && item.storyTitle ? (
                      <>
                        <a className={styles.link} href={item.storyHref}>Story · {item.storyTitle}</a>
                        {" · "}
                      </>
                    ) : null}
                    {item.regimeHref && item.regimeLabel ? (
                      <a className={styles.link} href={item.regimeHref}>Regime · {item.regimeLabel}</a>
                    ) : item.scope === "REGIME" ? "Exact Regime route unavailable in current projection." : null}
                  </p>
                </article>
              ))}
            </div>
          </Panel>
        ) : null}

        {gapId ? (
          focusedGapCase ? (
            <Panel
              title="Research Gap case"
              description="Exact durable research case matched by Market Motion source_ref and the current Dossier identity. Hybrid reads status only; it does not claim, execute, resolve, or hand off the case."
              action={<Badge tone={focusedGapCase.status === "COMPLETED" || focusedGapCase.status === "HANDED_OFF" ? "ready" : "warn"}>{focusedGapCase.status}</Badge>}
            >
              <article className={styles.record} id="research-gap-case">
                <div className={styles.recordHeader}>
                  <div>
                    <span className={styles.kicker}>RESEARCH GAP · {focusedGapCase.source_kind.replaceAll("_", " ")}</span>
                    <h3>{focusedGapCase.question || focusedGapCase.action}</h3>
                  </div>
                  <Badge>{focusedGapCase.research_outcome || "PENDING"}</Badge>
                </div>
                <p><strong>Case:</strong> {focusedGapCase.id}</p>
                <p><strong>Motion:</strong> {focusedGapCase.source_ref}</p>
                <p><strong>Action:</strong> {focusedGapCase.action}</p>
                {focusedGapCase.reason ? <p><strong>Why funded:</strong> {focusedGapCase.reason}</p> : null}
                <p><strong>Priority:</strong> {focusedGapCase.latest_priority_rank ?? "—"} · score {focusedGapCase.latest_priority_score ?? "—"}</p>
                <p><strong>Current Dossier:</strong> {focusedGapCase.latest_dossier_id}</p>
              </article>
            </Panel>
          ) : (
            <DataState
              title="Research Gap case is not linked to this Dossier"
              detail="Hybrid will not recover a stale or fuzzy Gap match. Open the current unresolved Motion decision and wait for exact lifecycle materialisation."
            />
          )
        ) : null}

        {motionId ? (
          focusedMotion ? (
            <Panel
              title="Motion investigation path"
              description="Exact Journey handoff for one immutable Motion item. The operational Research Gap worker uses the same eligibility gate; this surface does not create a new thesis or regime."
              action={<Badge tone={focusedMotion.investigationEligible ? "ready" : "warn"}>{focusedMotion.investigationEligible ? "INVESTIGATION ELIGIBLE" : "CONTEXT ONLY"}</Badge>}
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
                  <strong>Routing:</strong> Motion → exact accepted Story and/or Regime context. Story-scoped and regime-only promoted Motion may enter Research Gap when they carry a concrete next test and clear the same freshness/verification gate.
                  Research remains operational context; Dossier/Regime state changes only through their canonical reasoning paths.
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
              title="Motion is not in the current Journey edition"
              detail="Hybrid only opens investigation paths from the exact immutable Motion snapshot attached to the current canonical edition. It will not recover a stale or fuzzy match."
            />
          )
        ) : null}

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
              investigations={dossier.watchNext}
              calibration={dossier.reactionCalibration}
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
