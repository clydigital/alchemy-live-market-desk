"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import RegimeUnderstandLiveBridge from "./RegimeUnderstandLiveBridge";
import RegimeTriggerLadder from "./RegimeTriggerLadder";
import RateRegimeEducationalShell from "./RateRegimeEducationalShell";

 import { buildGlobalRatesFxBridge } from "@/lib/global-rates-fx-bridge";
import { buildRegimeDivergenceLabCases } from "@/lib/regime-divergence-lab";
import type { DossierPresentationMotionAdjudicationContext } from "@/lib/dossier-v2/presentation-adapter";
import type { RoutedDossierInvestigation } from "@/lib/regime-investigations";
import type { RegimeExplanation } from "@/lib/regime-explanations";
import { assessRegimeInterpretationFreshness } from "@/lib/regime-freshness";
import type { RegimeLiveStoryReasoning } from "@/lib/regime-live-reasoning";
import type { RateEducationalProjection } from "@/lib/rate-regime-educational-projection";
import { buildUnderstandLiveBridge } from "@/lib/regime-understand-live-bridge";
import type { ProjectedRegime } from "@/lib/regimes";
import styles from "./regime-workspace.module.css";

function displayDate(value: string | null) {
  if (!value) return "No current timestamp";
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kuala_Lumpur",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

export default function RegimeDetailWorkspace({
  regime,
  initialSubgroup,
  initialView = "understand",
  explanation,
  liveReasoning,
  investigations,
  dossierReadThrough,
  rateEducation,
}: {
  regime: ProjectedRegime;
  initialSubgroup?: string | null;
  initialView?: "understand" | "live";
  explanation: RegimeExplanation | null;
  liveReasoning: RegimeLiveStoryReasoning[];
  investigations: RoutedDossierInvestigation[];
  dossierReadThrough: DossierPresentationMotionAdjudicationContext[];
  rateEducation: RateEducationalProjection | null;
}) {
  const defaultKey = regime.subgroups.some((item) => item.key === initialSubgroup)
    ? initialSubgroup!
    : regime.subgroups[0]?.key || "";
  const [activeKey, setActiveKey] = useState(defaultKey);
  const [view, setView] = useState<"understand" | "live">(initialView);
  const subgroup = useMemo(
    () => regime.subgroups.find((item) => item.key === activeKey) || regime.subgroups[0],
    [activeKey, regime.subgroups],
  );
  const reasoningByStory = useMemo(
    () => new Map(liveReasoning.map((item) => [item.storyId, item])),
    [liveReasoning],
  );
  const subgroupReasoning = subgroup
    ? subgroup.durableStories.flatMap((story) => {
      const reasoning = reasoningByStory.get(story.id);
      return reasoning ? [{ story, reasoning }] : [];
    })
    : [];
  const subgroupDivergenceCases = useMemo(
    () => subgroup
      ? buildRegimeDivergenceLabCases({
          regime: regime.slug,
          subgroup: subgroup.key,
          persistentStoryIds: subgroup.durableStories.map((story) => story.id),
          investigations,
        })
      : [],
    [investigations, regime.slug, subgroup],
  );
  const subgroupInvestigations = useMemo(
    () => subgroupDivergenceCases.map((item) => item.investigation),
    [subgroupDivergenceCases],
  );
  const understandLiveBridge = useMemo(
    () => subgroup
      ? buildUnderstandLiveBridge({
          subgroup,
          liveReasoning,
          investigations: subgroupInvestigations,
        })
      : null,
    [liveReasoning, subgroup, subgroupInvestigations],
  );
  const freshness = subgroup
    ? assessRegimeInterpretationFreshness({
      telemetryAt: subgroup.telemetry.map((item) => item.asOf),
      interpretationAt: subgroupReasoning.map((item) => item.reasoning.updatedAt),
    })
    : null;
  const globalRatesFxBridge = useMemo(
    () => subgroup?.key === "global-rates"
      ? buildGlobalRatesFxBridge({ regime, investigations, liveReasoning })
      : null,
    [investigations, liveReasoning, regime, subgroup?.key],
  );

  const dossierContext = regime.dossierContext ?? [];

  return (
    <div className={styles.board}>
      <section className={styles.hero}>
        <header className={styles.heroHead}>
          <div>
            <span className={styles.kicker}>MARKET REGIME · {regime.stateKind === "system1" ? "SYSTEM 1 TELEMETRY + STORY INTERPRETATION" : regime.stateKind === "unresolved" ? "PARTIAL COVERAGE · SUBGROUP STATES BELOW" : "STORY-LED INTERPRETATION"}</span>
            <h1>{regime.title}</h1>
          </div>
          <span className={styles.state} data-kind={regime.stateKind}>{regime.state}</span>
        </header>
        <p className={styles.question}>{regime.coreQuestion}</p>
        <p className={styles.why}><strong>Why this matters:</strong> {regime.whyItMatters}</p>
        <p className={styles.mechanism}>{regime.mechanism}</p>
        <div className={styles.heroMeta}>
          <span>{regime.confidence}</span>
          <span>{regime.durableStories.length} durable Stories</span>
          <span>{regime.contextStories.length} context / coverage</span>
          <span>As of {displayDate(regime.asOf)}</span>
        </div>
        <div className={styles.assetRow}>
          {regime.affectedMarkets.map((asset) => <span key={asset}>{asset}</span>)}
        </div>
        <div className={styles.linkRow}>
          <Link href={regime.hybridHref}>Explain this Regime in Hybrid →</Link>
          <Link href="/whats-new">Open What’s New →</Link>
          <Link href="/stories">Open all Stories →</Link>
        </div>
      </section>

      {rateEducation ? <RateRegimeEducationalShell projection={rateEducation} /> : null}

      <nav className={styles.viewSwitch} aria-label="Regime workspace view">
        <button type="button" data-active={view === "understand"} onClick={() => setView("understand")}>
          <span>UNDERSTAND</span>
          <small>How the machine works</small>
        </button>
        <button type="button" data-active={view === "live"} onClick={() => setView("live")}>
          <span>LIVE</span>
          <small>What is moving it now</small>
        </button>
      </nav>

      {view === "understand" ? (
        <>
          <section className={styles.section}>
            <header className={styles.sectionHead}>
              <div>
                <span className={styles.kicker}>UNDERSTAND · STRUCTURAL MAP</span>
                <h2>How the machine works</h2>
              </div>
              <small>Stable mechanism, not a claim about today</small>
            </header>

            {explanation ? (
              <>
                <p className={styles.why}>{explanation.plainEnglish}</p>
                <div className={styles.chainGrid}>
                  {explanation.chains.map((chain) => (
                    <article className={styles.chainCard} key={chain.id}>
                      <div>
                        <span className={styles.kicker}>CAUSAL CHAIN</span>
                        <h3>{chain.title}</h3>
                        <p>{chain.summary}</p>
                      </div>
                      <div className={styles.chainSteps}>
                        {chain.steps.map((step, index) => (
                          <div className={styles.chainStep} key={`${chain.id}:${index}`}>
                            <b>{index + 1}</b>
                            <span>{step}</span>
                            {index < chain.steps.length - 1 ? <i>↓</i> : null}
                          </div>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              </>
            ) : (
              <div className={styles.empty}>No governed explanation has been published for this Regime yet.</div>
            )}
          </section>

          {explanation ? (
            <section className={styles.section}>
              <header className={styles.sectionHead}>
                <div>
                  <span className={styles.kicker}>UNDERSTAND · CONCEPTS</span>
                  <h2>Key concepts you need for this Regime</h2>
                </div>
                <small>What it is → why it matters → what to watch</small>
              </header>
              <div className={styles.conceptGrid}>
                {explanation.concepts.map((concept) => {
                  const returnPath = `/regimes/${regime.slug}?view=understand#concept-${concept.key}`;
                  return (
                    <article className={styles.conceptCard} id={`concept-${concept.key}`} key={concept.key}>
                      <h3>
                        <Link href={`/concepts/${concept.key}?from=${encodeURIComponent(returnPath)}`}>{concept.label}</Link>
                      </h3>
                      <p>{concept.definition}</p>
                      <p><strong>Why it matters here:</strong> {concept.whyItMatters}</p>
                      <div className={styles.watchRow}>
                        {concept.watch.map((item) => <span key={item}>{item}</span>)}
                      </div>
                      <Link className={styles.conceptLink} href={`/concepts/${concept.key}?from=${encodeURIComponent(returnPath)}`}>
                        Open Concept →
                      </Link>
                    </article>
                  );
                })}
              </div>
            </section>
          ) : null}

          <section className={styles.section}>
            <header className={styles.sectionHead}>
              <div>
                <span className={styles.kicker}>UNDERSTAND · SUBGROUPS</span>
                <h2>Where each moving part belongs</h2>
              </div>
              <small>Choose a branch before moving into LIVE</small>
            </header>
            <div className={styles.tabs}>
              {regime.subgroups.map((item) => (
                <button
                  type="button"
                  className={styles.tab}
                  data-accent={item.accent}
                  data-active={item.key === subgroup?.key}
                  onClick={() => setActiveKey(item.key)}
                  key={item.key}
                >
                  {item.label}
                </button>
              ))}
            </div>
            {subgroup ? (
              <div className={styles.subgroupExplain}>
                <div>
                  <span className={styles.kicker}>{subgroup.label}</span>
                  <p className={styles.why}>{subgroup.whyItMatters}</p>
                </div>
                <p className={styles.mechanism}>{subgroup.mechanism}</p>
              </div>
            ) : null}
          </section>

          {explanation ? (
            <section className={styles.counterfactual}>
              <span className={styles.kicker}>WHAT WOULD CHANGE THE STRUCTURAL READ?</span>
              <p>{explanation.counterfactual}</p>
            </section>
          ) : null}

          <button className={styles.toLiveButton} type="button" onClick={() => setView("live")}>
            Go to LIVE: what is moving this Regime now →
          </button>
        </>
      ) : null}

      {view === "live" ? (
        <>
          {dossierReadThrough.length ? (
            <section className={styles.section} id="dossier-story-readthrough" aria-label="Story-routed Dossier Regime read-through">
              <header className={styles.sectionHead}>
                <div>
                  <span className={styles.kicker}>SYSTEM 2 · STORY-ROUTED READ-THROUGH</span>
                  <h2>Dossier judgements that inform this Regime without routing into it</h2>
                </div>
                <small>Presentation-only · excluded from Regime projection</small>
              </header>
              <p className={styles.why}>
                These ACCEPT/REFINE judgements are backed by canonical evidence, but they route to
                a Story rather than directly to this Regime. They stay visible here so the Hybrid
                analytical trail is not lost. They do not change Regime state, confidence, as-of,
                latest contribution or subgroup state.
              </p>
              <div className={styles.liveGrid}>
                {dossierReadThrough.map((item) => (
                  <article className={styles.latest} id={`dossier-story-readthrough-${item.motionId}`} key={item.motionId}>
                    <small>
                      SYSTEM 2 · {item.decision} · STORY READ-THROUGH
                    </small>
                    <strong>{item.conclusion}</strong>
                    <p className={styles.summary}>{item.rationale}</p>
                    <div className={styles.heroMeta}>
                      <span>{displayDate(item.observedAt)}</span>
                      <span>{item.canonicalEvidenceRefs.length} canonical evidence ref{item.canonicalEvidenceRefs.length === 1 ? "" : "s"}</span>
                      <span>Non-state Regime read-through</span>
                    </div>
                    {item.nextTest ? (
                      <p className={styles.summary}><strong>Next test:</strong> {item.nextTest}</p>
                    ) : null}
                    <div className={styles.linkRow}>
                      <Link href={`/hybrid-output?regime=${encodeURIComponent(item.regimeSlug)}&motion=${encodeURIComponent(item.motionId)}#dossier-story-readthrough`}>
                        Open exact Hybrid judgement →
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {dossierContext.length ? (
            <section className={styles.section} id="dossier-regime-context" aria-label="Dossier System 2 Regime context">
              <header className={styles.sectionHead}>
                <div>
                  <span className={styles.kicker}>SYSTEM 2 · DOSSIER CONTEXT</span>
                  <h2>Accepted analytical context for this Regime</h2>
                </div>
                <small>Non-state · cannot change Regime state by itself</small>
              </header>
              <p className={styles.why}>
                These are evidence-backed Dossier judgements routed to this exact Regime. They remain context only:
                durable Stories and System 1 telemetry still determine the structural state.
              </p>
              <div className={styles.liveGrid}>
                {dossierContext.map((node) => (
                  <article
                    className={styles.latest}
                    id={node.motionId ? `dossier-regime-context-${node.motionId}` : undefined}
                    key={node.id}
                  >
                    <small>
                      {node.verification === "dossier-system2:refine"
                        ? "SYSTEM 2 · REFINE"
                        : "SYSTEM 2 · ACCEPT"}
                    </small>
                    <strong>{node.title}</strong>
                    <p className={styles.summary}>{node.detail}</p>
                    <div className={styles.heroMeta}>
                      <span>{displayDate(node.timestamp)}</span>
                      <span>Non-state Regime context</span>
                    </div>
                    {node.hybridHref ? (
                      <div className={styles.linkRow}>
                        <Link href={node.hybridHref}>Explain in Hybrid →</Link>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <RegimeTriggerLadder regimeSlug={regime.slug} />

          <section className={styles.section}>
            <header className={styles.sectionHead}>
              <div>
                <span className={styles.kicker}>LIVE · CHOOSE SUBGROUP</span>
                <h2>Current Regime branches</h2>
              </div>
              <button className={styles.backButton} type="button" onClick={() => setView("understand")}>← Back to UNDERSTAND</button>
            </header>
            <div className={styles.tabs}>
              {regime.subgroups.map((item) => (
                <button
                  type="button"
                  className={styles.tab}
                  data-accent={item.accent}
                  data-active={item.key === subgroup?.key}
                  onClick={() => setActiveKey(item.key)}
                  key={item.key}
                >
                  {item.label} · {item.state}
                </button>
              ))}
            </div>
          </section>

          {subgroup ? (
            <section className={styles.section}>
              <header className={styles.sectionHead}>
                <div>
                  <span className={styles.kicker}>LIVE · {subgroup.stateKind === "system1" ? "OBSERVED TELEMETRY + INTERPRETATION" : "INTERPRETED STATE"}</span>
                  <h2>{subgroup.label}</h2>
                </div>
                <span className={styles.state} data-kind={subgroup.stateKind}>{subgroup.state}</span>
              </header>

              {understandLiveBridge ? (
                <RegimeUnderstandLiveBridge bridge={understandLiveBridge} />
              ) : null}

              {globalRatesFxBridge ? (
                <section className={styles.fxBridge} aria-label="Global rates and FX sensor">
                  <header className={styles.fxBridgeHeader}>
                    <div>
                      <span className={styles.kicker}>GLOBAL RATES / FX SENSOR</span>
                      <h3>US rates → UST/JGB → USDJPY → Japan flows → risk/carry</h3>
                      <p>Evidence-gated chain. Observed means the desk has a current factual input; Supported means canonical reasoning backs the link; Unresolved means the system is still waiting for the specified evidence.</p>
                    </div>
                    <div className={styles.fxBridgeScore}>
                      <span data-state="observed">{globalRatesFxBridge.observedCount} observed</span>
                      <span data-state="supported">{globalRatesFxBridge.supportedCount} supported</span>
                      <span data-state="unresolved">{globalRatesFxBridge.unresolvedCount} unresolved</span>
                    </div>
                  </header>
                  <div className={styles.fxBridgeRail}>
                    {globalRatesFxBridge.steps.map((step, index) => (
                      <article className={styles.fxBridgeStep} data-state={step.state} key={step.key}>
                        <div className={styles.fxBridgeStepHead}>
                          <b>{String(index + 1).padStart(2, "0")}</b>
                          <span>{step.label}</span>
                          <strong>{step.state}</strong>
                        </div>
                        <h4>{step.title}</h4>
                        <p>{step.detail}</p>
                        <div className={styles.fxBridgeMeta}>
                          <span>{step.evidenceLabel}</span>
                          <span>{step.asOf ? displayDate(step.asOf) : "No timestamped evidence"}</span>
                        </div>
                        {step.nextTest ? (
                          <small><b>Next test:</b> {step.nextTest}</small>
                        ) : null}
                        {index < globalRatesFxBridge.steps.length - 1 ? <i aria-hidden="true">→</i> : null}
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}

              {freshness?.status === "new_telemetry" ? (
                <div className={styles.freshnessWarning}>
                  <strong>NEW TELEMETRY — INTERPRETATION PENDING</strong>
                  <span>
                    Observed telemetry: {displayDate(freshness.telemetryAt)} · latest canonical System 2 hypothesis: {displayDate(freshness.interpretationAt)} · telemetry is {freshness.lagMinutes} min newer.
                  </span>
                  <p>The causal read below predates the newest deterministic observation. Keep the last accepted interpretation visible, but do not present it as though it already explains the new telemetry.</p>
                </div>
              ) : freshness?.status === "no_interpretation" ? (
                <div className={styles.freshnessWarning}>
                  <strong>OBSERVED TELEMETRY — NO TIMESTAMPED SYSTEM 2 READ</strong>
                  <span>Observed telemetry: {displayDate(freshness.telemetryAt)}</span>
                  <p>No current persisted primary hypothesis is available for comparison. The interface will not manufacture an interpretation.</p>
                </div>
              ) : null}

              <div className={styles.liveGrid}>
                <div className={styles.column}>
                  <div>
                    <span className={styles.kicker}>SYSTEM 1 / OBSERVED</span>
                    {subgroup.telemetry.length ? (
                      <div className={styles.telemetryGrid}>
                        {subgroup.telemetry.map((item) => (
                          <article className={styles.telemetry} key={item.key}>
                            <span>{item.label}</span>
                            <strong>{item.state}</strong>
                            <p>{item.detail}</p>
                            <small>{item.source} · {displayDate(item.asOf)}</small>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <div className={styles.empty}>No deterministic System 1 sensor is wired for this subgroup yet. The state below is Story-led; it is not being presented as a measured score.</div>
                    )}
                  </div>

                  <div>
                    <span className={styles.kicker}>EXPECTED → ACTUAL / DIVERGENCE LAB</span>
                    {subgroupDivergenceCases.length ? (
                      <div className={styles.divergenceList}>
                        {subgroupDivergenceCases.map((routedCase) => {
                          const item = routedCase.investigation;
                          const lab = routedCase.lab;
                          return (
                          <article className={styles.divergenceCard} data-divergence={item.divergence.toLowerCase()} key={item.id}>
                            <div className={styles.divergenceMeta}>
                              <span>{item.status}</span>
                              <span className={styles.journeyState} data-transition={item.journey.transition.toLowerCase()}>
                                {item.journey.transition.replaceAll("_", " ")}
                              </span>
                              <span>
                                {routedCase.routeBasis === "PERSISTENT_STORY_ID"
                                  ? "exact Story route"
                                  : "linked Dossier Story route"}
                              </span>
                              <span>context only</span>
                              <strong>{item.divergence} DIVERGENCE</strong>
                            </div>
                            <h4>{item.question}</h4>
                            <div className={styles.reactionPair}>
                              <div>
                                <small>{item.journey.previousExpectedReaction ? "PRIOR DOSSIER EXPECTATION" : "EXPECTED / BEFORE TAPE"}</small>
                                <p>{item.journey.previousExpectedReaction || item.expectedReaction || "No canonical pre-event expectation is available."}</p>
                                {item.journey.expectationChanged && item.expectedReaction ? (
                                  <span className={styles.expectationRevision}>Current Dossier wording: {item.expectedReaction}</span>
                                ) : null}
                              </div>
                              <div>
                                <small>OBSERVED / ACTUAL TAPE</small>
                                <p>{item.observedReaction || "No comparable post-trigger reaction is available yet."}</p>
                              </div>
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
                            <p className={styles.divergenceExplanation}>
                              <strong>{item.reactionCalibration.requiresReview ? "Post-mortem hypothesis:" : "Current explanation:"}</strong> {item.currentExplanation}
                            </p>
                            {lab.mode === "full" ? (
                              <div className={styles.divergenceAlternatives}>
                                <strong>Divergence Lab — candidate mechanisms</strong>
                                {lab.candidates.map((candidate) => (
                                  <div key={`${item.id}:candidate:${candidate.rank}`}>
                                    <span>#{candidate.rank} · {candidate.confidence} confidence</span>
                                    <p>{candidate.explanation}</p>
                                    {candidate.evidenceForRefs.length || candidate.evidenceAgainstRefs.length ? (
                                      <small>
                                        Evidence for {candidate.evidenceForRefs.length} · against {candidate.evidenceAgainstRefs.length}
                                      </small>
                                    ) : (
                                      <small>Candidate-specific evidence not yet attached.</small>
                                    )}
                                    {candidate.displayDiscriminator ? (
                                      <p><strong>Discriminator:</strong> {candidate.displayDiscriminator}</p>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                            ) : lab.alternatives.length ? (
                              <div className={styles.divergenceAlternatives}>
                                <strong>{lab.mode === "compact_unresolved" ? "Mechanism unresolved" : "Competing explanations"}</strong>
                                <p>{lab.alternatives.map((alternative) => alternative.explanation).join(" · ")}</p>
                              </div>
                            ) : null}
                            <div className={styles.divergenceNext}>
                              <span>
                                <strong>Calibration:</strong> {item.reactionCalibration.outcome} · {item.reactionCalibration.checkCount} exact check(s) · {item.reactionCalibration.precision.toLowerCase().replaceAll("_", " ")}
                              </span>
                              <span><strong>Research next:</strong> {item.researchNext}</span>
                              <span><strong>Invalidate:</strong> {item.invalidationCondition}</span>
                            </div>
                          </article>
                          );
                        })}
                      </div>
                    ) : (
                      <div className={styles.empty}>No exact persistent-Story or linked analytical-Story investigation route reaches this subgroup. LIVE will not manufacture a divergence from investigation prose or missing/non-comparable tape.</div>
                    )}
                  </div>

                  <div>
                    <span className={styles.kicker}>CURRENT STORIES / SYSTEM 2</span>
                    <div className={styles.storyList}>
                      {subgroup.stories.length ? subgroup.stories.map((story) => (
                        <article className={styles.storyCard} data-maturity={story.maturity} key={story.id}>
                          <div className={styles.storyMeta}>
                            <span className={styles.storyMaturity}>{story.maturity}</span>
                            <span>{story.lifecycle}</span>
                            <span>{story.confidence}% thesis confidence</span>
                            {story.versionNumber ? <span>v{story.versionNumber}</span> : null}
                          </div>
                          <h4>{story.title}</h4>
                          <p>{story.thesis}</p>
                          {!story.contributesToState ? (
                            <p className={styles.maturityNote}><strong>Context only:</strong> {story.maturityReason}</p>
                          ) : null}
                          <div className={styles.linkRow}>
                            <Link href={`/stories/${story.slug}`}>Open Story →</Link>
                            <Link href={story.hybridHref}>Explain in Hybrid →</Link>
                          </div>
                        </article>
                      )) : <div className={styles.empty}>No mapped Story is available for this subgroup. Do not infer a thesis from the absence of a Story.</div>}
                    </div>
                    {subgroup.contextStories.length ? (
                      <div className={styles.empty}>{subgroup.contextStories.length} mapped Story{subgroup.contextStories.length === 1 ? "" : "ies"} are retained as seed, early or episode context and do not drive this subgroup state.</div>
                    ) : null}
                  </div>

                  <div>
                    <span className={styles.kicker}>CURRENT CAUSAL READ</span>
                    {subgroupReasoning.length ? (
                      <div className={styles.reasoningList}>
                        {subgroupReasoning.map(({ story, reasoning }) => (
                          <article className={styles.reasoningCard} key={reasoning.hypothesisId}>
                            <div className={styles.storyMeta}>
                              <span>{story.title}</span>
                              <span>{reasoning.decisionState}</span>
                              <span>{Math.round(reasoning.confidence)}% hypothesis confidence</span>
                              <span>updated {displayDate(reasoning.updatedAt)}</span>
                            </div>
                            <h4>{reasoning.question || reasoning.statement}</h4>
                            <p>{reasoning.mechanism}</p>
                            {reasoning.causalChain.length ? (
                              <div className={styles.liveChain}>
                                {reasoning.causalChain.map((edge, index) => (
                                  <div className={styles.liveEdge} data-evidence={edge.evidenceState} key={`${reasoning.hypothesisId}:${index}`}>
                                    <strong>{edge.from}</strong>
                                    <span>{edge.relationship}</span>
                                    <strong>{edge.to}</strong>
                                    <small>{edge.evidenceState.replaceAll("_", " ")} · {edge.evidenceCount} evidence ref{edge.evidenceCount === 1 ? "" : "s"}</small>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className={styles.empty}>The current hypothesis has no persisted canonical causal edges.</div>
                            )}
                          </article>
                        ))}
                      </div>
                    ) : (
                      <div className={styles.empty}>No current durable Story in this subgroup has a persisted primary hypothesis with canonical causal edges. The governed UNDERSTAND mechanism remains available, but LIVE does not manufacture missing evidence.</div>
                    )}
                  </div>
                </div>

                <div className={styles.column}>
                  <div>
                    <span className={styles.kicker}>WHAT IS CONTRIBUTING NOW</span>
                    <div className={styles.nodeList}>
                      {subgroup.nodes.length ? subgroup.nodes.map((node) => (
                        <article className={styles.node} data-state={node.state} key={node.id}>
                          <div className={styles.nodeMeta}>
                            <span className={styles.nodeState}>{node.state.replaceAll("_", " ")}</span>
                            <span>{node.sourceKind.replaceAll("_", " ")}</span>
                            <span>{displayDate(node.timestamp)}</span>
                          </div>
                          <h4>{node.title}</h4>
                          <p>{node.detail}</p>
                          <div className={styles.linkRow}>
                            {node.href ? <a href={node.href} target={node.sourceKind === "story_event" ? undefined : "_blank"} rel={node.sourceKind === "story_event" ? undefined : "noreferrer"}>Open source →</a> : null}
                            {node.hybridHref ? <Link href={node.hybridHref}>Explain in Hybrid →</Link> : null}
                          </div>
                        </article>
                      )) : <div className={styles.empty}>No recent contribution node is available for this subgroup.</div>}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
