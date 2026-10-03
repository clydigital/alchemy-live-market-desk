import Link from "next/link";
import LiveDeskShell from "@/components/live-desk/LiveDeskShell";
import DailyAssetStateBoard from "@/components/live-desk/DailyAssetStateBoard";
import NarrativeSpine from "@/components/live-desk/NarrativeSpine";
import MarketMotionOverview from "@/components/live-desk/MarketMotionOverview";
import { Badge, DataState, formatDeskDate } from "@/components/live-desk/LiveDeskUi";
import { buildDailyAssetState } from "@/lib/daily-asset-state";
import { buildDivergenceLabPresentation } from "@/lib/divergence-lab-presentation";
import {
  getDossierV2HistoryIndex,
  getDossierV2PresentationSelection,
  getDossierV2PresentationSelectionById,
  selectExactDossierV2Presentation,
} from "@/lib/dossier-v2/presentation-reader";
import { isValidUuid } from "@/lib/dossier-v2/validation";
import { getMarketMonitor } from "@/lib/market-monitor-public";
import { getCurrentMarketMotion, marketMotionAttention } from "@/lib/market-motion";
import { selectPromotedMarketMotionForDossier } from "@/lib/market-motion-promotion";
import { getRegimeDefinition } from "@/lib/regimes";

import styles from "./dossier.module.css";

export const dynamic = "force-dynamic";

function noticeTone(tone: "ready" | "warn" | "error"): "ready" | "warn" | "risk" {
  return tone === "ready" ? "ready" : tone === "error" ? "risk" : "warn";
}

function severityTone(severity: string): "default" | "warn" | "risk" {
  const value = severity.toLowerCase();
  if (value === "critical" || value === "material" || value === "high") return "risk";
  if (value === "medium" || value === "warning") return "warn";
  return "default";
}

function divergenceTone(divergence: string): "default" | "ready" | "warn" | "risk" {
  if (divergence === "MATERIAL") return "risk";
  if (divergence === "PARTIAL" || divergence === "UNRESOLVED") return "warn";
  if (divergence === "NONE") return "ready";
  return "default";
}

function calibrationTone(outcome: string): "default" | "ready" | "warn" | "risk" {
  if (outcome === "DIVERGENT") return "risk";
  if (outcome === "MIXED" || outcome === "UNRESOLVED") return "warn";
  if (outcome === "ALIGNED") return "ready";
  return "default";
}

function journeyLabel(value: string) {
  return value.replaceAll("_", " ");
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

type DossierPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DossierPage({ searchParams }: DossierPageProps) {
  const query = await searchParams;
  const rawRequestedId = Array.isArray(query.id) ? query.id[0] : query.id;
  const requestedId = rawRequestedId?.trim() || null;
  const selectionPromise = requestedId
    ? isValidUuid(requestedId)
      ? getDossierV2PresentationSelectionById(requestedId)
      : Promise.resolve(selectExactDossierV2Presentation(null, null, requestedId))
    : getDossierV2PresentationSelection();

  const [selection, historyIndex] = await Promise.all([
    selectionPromise,
    getDossierV2HistoryIndex(18).catch(() => ({
      contractVersion: "dossier-history/1" as const,
      items: [],
      omittedInvalidCount: 0,
    })),
  ]);
  const historicalMode = selection.status === "historical_exact";
  const [monitor, motionRecords] = requestedId
    ? [null, []]
    : await Promise.all([
        getMarketMonitor().catch(() => null),
        getCurrentMarketMotion({ limit: 60 }).catch(() => []),
      ]);
  const dossier = selection.presentation;
  const dailyAssetState = monitor
    ? buildDailyAssetState({ monitor, presentation: dossier })
    : null;
  const notCarriedForward = dossier?.investigationJourney.filter(
    (item) => item.transition === "NOT_CARRIED_FORWARD",
  ) ?? [];
  const promotedMotion = selectPromotedMarketMotionForDossier(
    motionRecords,
  ).map((item) => {
    const regime = item.primary_regime_slug ? getRegimeDefinition(item.primary_regime_slug) : null;
    const attention = marketMotionAttention(item);
    return {
      attentionTier: attention.tier,
      attentionScore: attention.score,
      writingPotential: attention.writingPotential,
      attentionReasons: attention.reasons,
      id: item.id,
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
      storyTitle: null,
      storyHref: null,
      regimeLabel: regime?.shortTitle || null,
      regimeHref: regime ? `/regimes/${regime.slug}` : null,
    };
  });

  if (!dossier) {
    return (
      <LiveDeskShell
        activePath="/dossier"
        eyebrow="Canonical Dossier V2"
        title="Dossier"
        description="The current market interpretation will appear here only when a persisted Dossier V2 can be rendered safely."
        meta={<Badge tone="risk">Unavailable</Badge>}
      >
        <DataState
          state="risk"
          title={selection.notice.label}
          detail={selection.notice.detail}
        />
        {requestedId ? (
          <div className={styles.historyReturn}>
            <Link href="/dossier">Return to current Dossier</Link>
          </div>
        ) : null}
      </LiveDeskShell>
    );
  }

  return (
    <LiveDeskShell
      activePath="/dossier"
      eyebrow="Canonical Dossier V2"
      title="Dossier"
      description="One persisted market interpretation for Live and Hybrid: what matters now, what still needs proving, and the charts that resolve it."
      meta={
        <div className={styles.metaBlock}>
          <Badge tone={noticeTone(selection.notice.tone)}>{selection.notice.label}</Badge>
          <span>As of {formatDeskDate(dossier.asOf)}</span>
        </div>
      }
    >
      <div className={styles.workspace}>
        <section className={[styles.notice, selection.usingFallback ? styles.noticeWarn : ""].filter(Boolean).join(" ")}>
          <div>
            <span>DESK STATE</span>
            <strong>{selection.notice.label}</strong>
          </div>
          <aside className={styles.noticeCopy}>
            <p>{selection.notice.detail}</p>
            {selection.usingFallback && !historicalMode ? (
              <small>
                Canonical interpretation is frozen at {formatDeskDate(dossier.asOf)}. Current tape below may contain newer live observations.
              </small>
            ) : null}
            {historicalMode ? <Link href="/dossier">Return to current Dossier</Link> : null}
          </aside>
        </section>

        <section className={styles.hero}>
          <div className={styles.heroKicker}>
            <span>{historicalMode ? "HISTORICAL MARKET DOSSIER" : "CURRENT MARKET DOSSIER"}</span>
            <Badge tone={dossier.health.degraded ? "warn" : "ready"}>
              {dossier.health.degraded ? "Degraded" : dossier.header.epistemicLabel}
            </Badge>
          </div>
          <h2>{dossier.header.headline}</h2>
          <p className={styles.heroAnswer}>{dossier.header.answer}</p>
          <div className={styles.heroFooter}>
            <div>
              <small>REGIME IMPLICATION</small>
              <p>{dossier.header.regimeImplication}</p>
            </div>
            <div>
              <small>WHAT WOULD CHANGE THE VIEW</small>
              <p>{dossier.header.whatWouldChangeMind}</p>
            </div>
          </div>
        </section>

        <NarrativeSpine dossier={dossier} surface="dossier" />

        <section className={styles.primarySection}>
          <div className={styles.sectionHead}>
            <div>
              <span>01 / WHAT MATTERS NOW</span>
              <h3>The stories carrying the regime</h3>
            </div>
            <small>{dossier.whatMattersNow.stories.length} supported stories</small>
          </div>
          <div className={styles.storyList}>
            {dossier.whatMattersNow.stories.map((story, index) => (
              <article className={styles.story} key={story.id}>
                <div className={styles.storyIndex}>{String(index + 1).padStart(2, "0")}</div>
                <div className={styles.storyBody}>
                  <header>
                    <div>
                      <span>{story.epistemicLabel}</span>
                      <h4>{story.title}</h4>
                    </div>
                    <small>{story.evidenceRefs.length} evidence refs</small>
                  </header>
                  <div className={styles.storyColumns}>
                    <div>
                      <small>WHAT CHANGED</small>
                      <p>{story.whatChanged}</p>
                    </div>
                    <div>
                      <small>WHY IT MATTERS</small>
                      <p>{story.whyItMatters}</p>
                    </div>
                  </div>
                  <div className={styles.mechanism}>
                    <small>MECHANISM</small>
                    <p>{story.mechanism}</p>
                  </div>
                  <footer>
                    <span>Current read: {story.conclusion}</span>
                    <span>Change the view: {story.whatWouldChangeMind}</span>
                  </footer>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.primarySection}>
          <div className={styles.sectionHead}>
            <div>
              <span>02 / WATCH NEXT</span>
              <h3>Open investigations</h3>
            </div>
            <small>{dossier.watchNext.length} active questions</small>
          </div>
          <div className={styles.calibrationSummary}>
            <div>
              <small>SYSTEM 1 REACTION CALIBRATION</small>
              <strong>{dossier.reactionCalibration.evaluatedInvestigations} evaluated · {dossier.reactionCalibration.unresolvedInvestigations} unresolved</strong>
            </div>
            <div>
              <span>Aligned {dossier.reactionCalibration.alignedInvestigations}</span>
              <span>Divergent {dossier.reactionCalibration.divergentInvestigations}</span>
              <span>Mixed {dossier.reactionCalibration.mixedInvestigations}</span>
              <span>Intraday {dossier.reactionCalibration.intradayInvestigations}</span>
              <span>Expectation edits {dossier.reactionCalibration.expectationChangedInvestigations}</span>
            </div>
            <p>Investigation-level audit counts only. Correlated asset checks are not converted into a forecast-accuracy percentage.</p>
          </div>
          {dossier.watchNext.length ? (
            <div className={styles.investigationList}>
              {dossier.watchNext.map((item) => {
                const lab = buildDivergenceLabPresentation(item);
                return (
                <article className={styles.investigation} key={item.id}>
                  <header>
                    <Badge tone={item.status === "weakened" ? "warn" : "default"}>{item.status}</Badge>
                    <span className={styles.journeyBadge} data-transition={item.journey.transition.toLowerCase()}>
                      {journeyLabel(item.journey.transition)}
                    </span>
                    <h4>{item.question}</h4>
                  </header>
                  <div className={styles.divergenceCompare}>
                    <div>
                      <small>{item.journey.previousExpectedReaction ? "PRIOR DOSSIER EXPECTATION" : "EXPECTED / BEFORE TAPE"}</small>
                      <p>{item.journey.previousExpectedReaction || item.expectedReaction || "No canonical pre-event expectation is available for this investigation."}</p>
                      {item.journey.expectationChanged && item.expectedReaction ? (
                        <span className={styles.expectationRevision}>
                          Current Dossier wording: {item.expectedReaction}
                        </span>
                      ) : null}
                    </div>
                    <div>
                      <small>OBSERVED / ACTUAL TAPE</small>
                      <p>{item.observedReaction || "No comparable post-trigger reaction is available yet."}</p>
                    </div>
                    <div className={styles.divergenceStatus}>
                      <small>DIVERGENCE</small>
                      <Badge tone={divergenceTone(item.divergence)}>{item.divergence}</Badge>
                    </div>
                  </div>
                  <div className={styles.calibrationLine}>
                    <small>REACTION CALIBRATION</small>
                    <Badge tone={calibrationTone(item.reactionCalibration.outcome)}>{item.reactionCalibration.outcome}</Badge>
                    <span>
                      {item.reactionCalibration.checkCount} exact check(s) · {item.reactionCalibration.precision.toLowerCase().replaceAll("_", " ")}
                      {item.reactionCalibration.reactionWindows.length
                        ? " · " + item.reactionCalibration.reactionWindows.join(" / ")
                        : ""}
                    </span>
                    {item.reactionCalibration.requiresReview ? <strong>Review required</strong> : null}
                  </div>
                  {item.reactionChecks.length ? (
                    <div className={styles.reactionAudit}>
                      <small>SYSTEM 1 REACTION AUDIT</small>
                      <div>
                        {item.reactionChecks.map((check) => (
                          <span data-relation={check.relation.toLowerCase()} key={check.checkId}>
                            {check.isProxy ? `${check.instrument} via ${check.observedInstrument} proxy` : check.instrument} · {check.relation} · {check.reactionWindow ? `${check.reactionWindow} reaction` : check.timingPrecision === "INTRADAY" ? "intraday" : "later daily session"}{check.reactionPath.length ? ` · path ${check.reactionPath.map((point) => `${point.window} ${point.changePct >= 0 ? "+" : ""}${point.changePct.toFixed(2)}%`).join(" → ")}` : ""}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {item.reactionCalibration.requiresReview ? (
                    <small className={styles.postMortemLabel}>SYSTEM 2 POST-MORTEM / CURRENT HYPOTHESIS</small>
                  ) : null}
                  <p className={styles.explanation}>{item.currentExplanation}</p>
                  {lab.mode === "full" ? (
                    <div className={styles.competing}>
                      <small>DIVERGENCE LAB — CANDIDATE MECHANISMS</small>
                      <div className={styles.investigationGrid}>
                        {lab.candidates.map((candidate) => (
                          <div key={`${item.id}:candidate:${candidate.rank}`}>
                            <small>#{candidate.rank} · {candidate.confidence} CONFIDENCE</small>
                            <p>{candidate.explanation}</p>
                            {candidate.evidenceForRefs.length || candidate.evidenceAgainstRefs.length ? (
                              <span className={styles.candidateEvidence}>
                                {candidate.evidenceForRefs.length ? `Evidence for ${candidate.evidenceForRefs.length}` : ""}
                                {candidate.evidenceForRefs.length && candidate.evidenceAgainstRefs.length ? " · " : ""}
                                {candidate.evidenceAgainstRefs.length ? `Evidence against ${candidate.evidenceAgainstRefs.length}` : ""}
                              </span>
                            ) : (
                              <span className={styles.candidateEvidencePending}>Candidate-specific evidence not yet attached.</span>
                            )}
                            {candidate.displayDiscriminator ? (
                              <p><strong>Discriminator:</strong> {candidate.displayDiscriminator}</p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                      {lab.sharedDiscriminator !== item.researchNext ? (
                        <div className={styles.sharedDiscriminator}>
                          <small>SHARED DISCRIMINATOR</small>
                          <p>{lab.sharedDiscriminator}</p>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className={styles.compactMechanisms}>
                      <small>
                        {lab.mode === "compact_unresolved"
                          ? "MECHANISM UNRESOLVED"
                          : "Structured mechanism evidence was not preserved"}
                      </small>
                      <p>
                        {lab.mode === "compact_unresolved"
                          ? "Current evidence does not yet discriminate between the available explanations."
                          : "This Dossier vintage preserved compact competing explanations but not structured candidate evidence."}
                      </p>
                      {lab.alternatives.length ? (
                        <ul>
                          {lab.alternatives.map((alternative, index) => (
                            <li key={`${item.id}:alternative:${alternative.rank ?? index}`}>
                              {alternative.explanation}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span>No competing mechanism set was preserved for this investigation.</span>
                      )}
                    </div>
                  )}
                  <div className={styles.investigationGrid}>
                    <div>
                      <small>WHY IT MATTERS</small>
                      <p>{item.whyItMatters}</p>
                    </div>
                    <div>
                      <small>RESEARCH NEXT</small>
                      <p>{item.researchNext}</p>
                    </div>
                    <div>
                      <small>CONFIRM</small>
                      <p>{item.confirmationCondition}</p>
                    </div>
                    <div>
                      <small>INVALIDATE</small>
                      <p>{item.invalidationCondition}</p>
                    </div>
                  </div>

                </article>
                );
              })}
            </div>
          ) : (
            <DataState
              state="ready"
              title="No priority investigation is open"
              detail="The current Dossier has no unresolved investigation promoted into Watch Next."
            />
          )}
          {notCarriedForward.length ? (
            <div className={styles.journeyAudit}>
              <small>PRIOR INVESTIGATIONS NOT CARRIED FORWARD</small>
              {notCarriedForward.map((item) => (
                <div key={item.previousId ?? item.question}>
                  <strong>{item.question}</strong>
                  <span>
                    Prior state: {item.previousDivergence ?? "UNRESOLVED"} · {item.previousStatus ?? "unknown"} · absence is not treated as resolution
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <section className={styles.primarySection}>
          <div className={styles.sectionHead}>
            <div>
              <span>03 / RESEARCH NOW</span>
              <h3>Highest-information next actions</h3>
            </div>
            <small>{dossier.researchNow.length} actions</small>
          </div>
          <div className={styles.actionList}>
            {dossier.researchNow.map((item) => (
              <article className={styles.action} key={item.rank + "-" + item.action}>
                <b>{String(item.rank).padStart(2, "0")}</b>
                <div>
                  <h4>{item.action}</h4>
                  <p>{item.reason}</p>
                  <small>Information gain: {item.expected_information_gain}</small>
                </div>
              </article>
            ))}
          </div>
        </section>

        {!historicalMode ? (
          <section className={styles.currentTape}>
            <div className={styles.currentTapeHead}>
              <div>
                <span>CURRENT TAPE</span>
                <h3>What markets are doing now</h3>
              </div>
              <p>
                {selection.usingFallback
                  ? `Live observations may be newer than the accepted Dossier from ${formatDeskDate(dossier.asOf)}.`
                  : "Live-owned observations and deterministic checks shown as context beneath the accepted Dossier interpretation."}
              </p>
            </div>

        {dailyAssetState ? (
          <DailyAssetStateBoard
            state={dailyAssetState}
            dollarLiquidity={dossier.dollarLiquidity ?? null}
            policyLiquidityInteraction={dossier.policyLiquidityInteraction ?? null}
            compact
            showStockRadar={false}
            heading="Current market tape"
          />
        ) : null}

        {dossier.policyOutlook.length ? (
          <section className={styles.primarySection}>
            <div className={styles.sectionHead}>
              <div>
                <span>SYSTEM 1 / POLICY OUTLOOK</span>
                <h3>Macro surprise → rate path → market confirmation</h3>
              </div>
              <small>{dossier.policyOutlook.length} active deterministic check{dossier.policyOutlook.length === 1 ? "" : "s"}</small>
            </div>
            <div className={styles.investigationList}>
              {dossier.policyOutlook.map((item) => (
                <article className={styles.investigation} key={item.id}>
                  <header>
                    <Badge tone={item.policyImpulse === "HAWKISH" ? "warn" : "ready"}>{item.policyImpulse}</Badge>
                    <h4>{item.trigger}</h4>
                  </header>
                  <div className={styles.investigationGrid}>
                    <div>
                      <small>NEXT-MEETING OUTLOOK</small>
                      <p>{item.nextMeetingRateOutlook.replaceAll("_", " ")}</p>
                    </div>
                    <div>
                      <small>FEDWATCH EXPECTATION</small>
                      <p>{item.fedWatchExpectedDirection.replaceAll("_", " ")}</p>
                    </div>
                    <div>
                      <small>EXPECTED TAPE</small>
                      <p>{item.expectedMarketReactions.map((reaction) => `${reaction.instrument} ${reaction.direction === "UP" ? "↑" : "↓"}`).join(" · ")}</p>
                    </div>
                    <div>
                      <small>OBSERVED RATE PRICING</small>
                      <p>{item.observedRatePricing || "Current post-trigger probability not yet captured."}</p>
                    </div>
                  </div>
                  {item.observedConfirmation ? (
                    <div className={styles.mechanism}>
                      <small>OBSERVED CONFIRMATION</small>
                      <p>{item.observedConfirmation}</p>
                    </div>
                  ) : null}
                  {item.gaps.length ? (
                    <div className={styles.competing}>
                      <small>STILL MISSING</small>
                      <span>{item.gaps.join(" · ")}</span>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <section className={styles.regimeSection}>
          <div className={styles.sectionHead}>
            <div>
              <span>CONTEXT STRIP</span>
              <h3>Cross-asset regime</h3>
            </div>
            <small>{dossier.regimeStrip.filter((lens) => lens.observed).length} observed lenses</small>
          </div>
          <div className={styles.regimeGrid}>
            {dossier.regimeStrip.map((lens) => (
              <article className={styles.regimeItem} key={lens.key} data-observed={lens.observed}>
                <header>
                  <strong>{lens.label.replaceAll("_", " ")}</strong>
                  <span>{lens.observed ? "Observed" : "Unresolved"}</span>
                </header>
                {lens.reaction ? <p className={styles.reaction}>{lens.reaction}</p> : null}
                <p>{lens.interpretation}</p>
                {lens.unresolvedSignals.length ? (
                  <small>{lens.unresolvedSignals.join(" · ")}</small>
                ) : null}
              </article>
            ))}
          </div>
        </section>

        {promotedMotion.length ? (
          <MarketMotionOverview
            items={promotedMotion}
            eyebrow="PROMOTED MARKET MOTION"
            title="Fresh hooks attached to this Dossier"
            description="Only fresh Motion accepted by validated Dossier reasoning and promoted with an exact canonical Story link is admitted here; exact Regime links are shown when present. The full Primary/Secondary Motion tape stays in Journey, so Dossier does not become a second Motion feed, does not guess a fuzzy Story mapping, and does not rewrite the persisted thesis."
            showFullTapeLink
          />
        ) : null}
          </section>
        ) : null}

        <details className={styles.more}>
          <summary>
            <span>MORE / CHARTS, RADAR & THEMES</span>
            <strong>Supporting workbench</strong>
          </summary>

          <div className={styles.moreGrid}>
            <section className={styles.lowerSection}>
              <div className={styles.lowerHead}>
                <span>TRADINGVIEW INVESTIGATIONS</span>
                <strong>{dossier.charts.core.length} core charts</strong>
              </div>
              <div className={styles.lowerList}>
                {dossier.charts.core.map((chart) => (
                  <article key={chart.chart_id}>
                    <header>
                      <b>{chart.ticker_or_instrument}</b>
                      <span>{chart.timeframe}</span>
                    </header>
                    <p>{chart.exact_question}</p>
                    <small>Confirm: {chart.confirmation_condition}</small>
                    <small>Contradict: {chart.contradiction_condition}</small>
                  </article>
                ))}
              </div>
            </section>

            <section className={styles.lowerSection}>
              <div className={styles.lowerHead}>
                <span>STOCK RADAR</span>
                <strong>{dossier.stockRadar.length} linked instruments</strong>
              </div>
              <div className={styles.lowerList}>
                {dossier.stockRadar.map((item) => (
                  <article key={item.symbol}>
                    <header>
                      <b>{item.symbol}</b>
                      <span>{item.linkage_type.replaceAll("_", " ")}</span>
                    </header>
                    <p>{item.why_relevant}</p>
                    <small>Research: {item.research_question}</small>
                    <small>Invalidate: {item.invalidating_signal}</small>
                  </article>
                ))}
              </div>
            </section>

            <section className={styles.lowerSection}>
              <div className={styles.lowerHead}>
                <span>DEVELOPING THEMES</span>
                <strong>{dossier.themes.length}</strong>
              </div>
              <div className={styles.lowerList}>
                {dossier.themes.map((theme) => (
                  <article key={theme.theme_id}>
                    <header>
                      <b>{theme.title}</b>
                      <span>{theme.supporting_evidence_ids.length} refs</span>
                    </header>
                    <p>{theme.summary}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className={styles.lowerSection}>
              <div className={styles.lowerHead}>
                <span>THESIS CHANGES</span>
                <strong>{dossier.thesisChanges.length}</strong>
              </div>
              {dossier.thesisChanges.length ? (
                <div className={styles.lowerList}>
                  {dossier.thesisChanges.map((change) => (
                    <article key={change.thesisId}>
                      <header>
                        <b>{change.title}</b>
                        <span>{change.change.replaceAll("_", " ")}</span>
                      </header>
                      <p>{change.reason}</p>
                      <small>
                        {change.previousState ? change.previousState + " → " : ""}
                        {change.state} · v{change.version}
                      </small>
                    </article>
                  ))}
                </div>
              ) : (
                <p className={styles.emptyText}>No thesis state changed in this Dossier.</p>
              )}
            </section>
          </div>
        </details>

        <details className={styles.historyNav}>
          <summary className={styles.historyNavSummary}>
            <div>
              <span>DOSSIER MEMORY</span>
              <strong>{historicalMode ? "Exact historical replay" : `Current: ${formatDeskDate(dossier.asOf)}`}</strong>
            </div>
            <small>View {Math.min(historyIndex.items.length, 10)} vintage{Math.min(historyIndex.items.length, 10) === 1 ? "" : "s"}</small>
          </summary>
          {historicalMode ? (
            <div className={styles.historyReturn}>
              <Link href="/dossier">Return to current Dossier</Link>
            </div>
          ) : null}
          <div className={styles.historyNavList}>
            {historyIndex.items.slice(0, 10).map((item) => (
              <Link
                href={`/dossier?id=${item.id}`}
                className={[
                  styles.historyNavItem,
                  selection.selectedDossierId === item.id ? styles.historyNavItemActive : "",
                ].filter(Boolean).join(" ")}
                key={item.id}
              >
                <small>{formatDeskDate(item.asOf)}</small>
                <strong>{item.headline}</strong>
                <span>
                  {item.health} · {item.investigationCount} investigations · {item.divergentInvestigationCount} divergent
                </span>
              </Link>
            ))}
          </div>
          {historyIndex.omittedInvalidCount ? (
            <small className={styles.historyNavWarning}>
              {historyIndex.omittedInvalidCount} malformed vintage(s) omitted from replay navigation.
            </small>
          ) : null}
        </details>

        {selection.calibrationHistory.length ? (
          <section className={styles.primarySection}>
            <div className={styles.sectionHead}>
              <div>
                <span>AUDIT / REASONING HISTORY</span>
                <h3>Calibration cases by Dossier vintage</h3>
              </div>
              <small>{selection.calibrationHistory.length} measured vintage(s)</small>
            </div>
            <p className={styles.historyIntro}>
              Read-only reconstruction from immutable Dossiers. Each case keeps the expectation, measured tape and post-mortem hypothesis from that vintage; counts are not converted into an accuracy percentage.
            </p>
            {selection.calibrationLineages.length ? (
              <div className={styles.lineageList}>
                <div className={styles.lineageHead}>
                  <small>STRICT REPEATED CASES</small>
                  <span>Exact ID or unique Story/Thesis continuity only</span>
                </div>
                {selection.calibrationLineages.slice(0, 4).map((lineage) => (
                  <article className={styles.lineageCard} key={lineage.lineageId}>
                    <header>
                      <div>
                        <strong>{lineage.latestQuestion}</strong>
                        <small>
                          {lineage.caseVintages} case vintages · {lineage.evaluatedVintages} exact evaluated · {formatDeskDate(lineage.firstAsOf)} → {formatDeskDate(lineage.latestAsOf)}
                        </small>
                      </div>
                      <Badge tone={learningTone(lineage.learningState)}>{learningLabel(lineage.learningState)}</Badge>
                    </header>
                    <div className={styles.lineageSequence}>
                      {lineage.cases.map((item) => (
                        <span key={item.dossierId + "-" + item.investigationId} data-outcome={item.outcome.toLowerCase()}>
                          {formatDeskDate(item.asOf)} · {item.outcome}
                        </span>
                      ))}
                    </div>
                    <div className={styles.learningGrid}>
                      <div>
                        <small>MARKET VS EXPECTATION</small>
                        <strong>{reactionReadLabel(lineage.reactionRead)}</strong>
                      </div>
                      <div>
                        <small>WAS OUR MECHANISM WRONG?</small>
                        <strong>Not established by calibration</strong>
                        <span>{lineage.mechanismRead}</span>
                      </div>
                      <div>
                        <small>TRANSMISSION STATE</small>
                        <strong>{lineage.learningState === "TRANSMISSION_UNRESOLVED" ? "Still unresolved" : "Evidence updated"}</strong>
                        <span>{lineage.transmissionRead}</span>
                      </div>
                    </div>
                    <p className={styles.learningLesson}><strong>What did we learn?</strong> {lineage.learningSummary}</p>
                    <p><strong>Latest hypothesis:</strong> {lineage.latestPostMortemHypothesis}</p>
                    <small>
                      Next discriminator: {lineage.latestResearchNext}
                      {lineage.expectationRewriteCount ? " · " + lineage.expectationRewriteCount + " expectation rewrite(s) flagged" : ""}
                      {lineage.rewriteOnlyVintages ? " · " + lineage.rewriteOnlyVintages + " rewrite-only vintage(s)" : ""}
                    </small>
                  </article>
                ))}
              </div>
            ) : null}
            <div className={styles.historyList}>
              {selection.calibrationHistory.slice(0, 6).map((entry) => (
                <article className={styles.historyVintage} key={entry.dossierId}>
                  <header>
                    <div>
                      <small>{formatDeskDate(entry.asOf)}</small>
                      <strong>
                        {entry.summary.evaluatedInvestigations} evaluated · {entry.summary.unresolvedInvestigations} unresolved
                      </strong>
                    </div>
                    {entry.degraded ? <Badge tone="warn">Degraded vintage</Badge> : <Badge tone="default">Immutable vintage</Badge>}
                  </header>
                  <div className={styles.historyCases}>
                    {entry.cases.map((item) => (
                      <div className={styles.historyCase} key={entry.dossierId + "-" + item.investigationId}>
                        <div className={styles.historyCaseHead}>
                          <Badge tone={calibrationTone(item.outcome)}>{item.outcome}</Badge>
                          <span>{item.journeyTransition.replaceAll("_", " ")}</span>
                          <span>{item.precision.toLowerCase().replaceAll("_", " ")}</span>
                          {item.reactionWindows.length ? <span>{item.reactionWindows.join(" / ")}</span> : null}
                          {item.expectationChanged ? <strong>Expectation wording changed</strong> : null}
                        </div>
                        <h4>{item.question}</h4>
                        <div className={styles.historyCaseGrid}>
                          <div>
                            <small>PRIOR / PRE-TAPE EXPECTATION</small>
                            <p>{item.priorExpectedReaction ?? item.currentExpectedReaction ?? "No historical expectation was preserved."}</p>
                          </div>
                          <div>
                            <small>MEASURED TAPE</small>
                            <p>{item.observedReaction ?? "No reader-facing reaction summary was recorded."}</p>
                          </div>
                        </div>
                        <p className={styles.historyHypothesis}>
                          <strong>{item.requiresReview ? "Post-mortem hypothesis:" : "Vintage explanation:"}</strong>{" "}
                          {item.postMortemHypothesis}
                        </p>
                        {item.competingExplanations.length ? (
                          <p className={styles.historyAlternatives}>
                            <strong>Competing:</strong> {item.competingExplanations.join(" · ")}
                          </p>
                        ) : null}
                        <small className={styles.historyNext}>Next discriminator: {item.researchNext}</small>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <details className={styles.audit}>
          <summary>
            <span>RESEARCH HEALTH & GAPS</span>
            <strong>{dossier.health.researchGaps.length} gaps · {dossier.evidenceIndex.length} evidence refs</strong>
          </summary>
          <div className={styles.auditBody}>
            {dossier.health.freshnessWarnings.length ? (
              <div className={styles.auditBlock}>
                <h4>Freshness warnings</h4>
                {dossier.health.freshnessWarnings.map((warning) => <p key={warning}>{warning}</p>)}
              </div>
            ) : null}
            <div className={styles.gapList}>
              {dossier.health.researchGaps.map((gap) => (
                <article key={gap.id}>
                  <Badge tone={severityTone(gap.severity)}>{gap.severity}</Badge>
                  <div>
                    <strong>{gap.category}</strong>
                    <p>{gap.description}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </details>
      </div>
    </LiveDeskShell>
  );
}
