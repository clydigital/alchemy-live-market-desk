import type {
  DossierPresentationCalibrationSummary,
  DossierPresentationInvestigation,
} from "@/lib/dossier-v2/presentation-adapter";
import { buildDivergenceLabPresentation } from "@/lib/divergence-lab-presentation";
import type { PresenterCanonicalStoryCase } from "@/lib/presenter-canonical-story-bridge";
import type { PresenterHistoricalContextBoundary } from "@/lib/presenter-historical-context-boundary";
import { buildPresenterDivergenceJourney } from "@/lib/presenter-divergence-journey";

import { Badge, DataState } from "./LiveDeskUi";
import styles from "./presenter-divergence-journey.module.css";

type PresenterEditionContext = {
  selectedSnapshotId: string | null;
  currentSnapshotId: string | null;
  status: "current" | "historical" | "invalid_fallback_current";
  options: Array<{
    snapshotId: string;
    label: string;
    freshness: "current" | "historical";
    href: string;
  }>;
};

type Props = {
  investigations: DossierPresentationInvestigation[];
  calibration: DossierPresentationCalibrationSummary;
  canonicalCases?: PresenterCanonicalStoryCase[];
  editionContext?: PresenterEditionContext;
  historicalContextBoundary?: PresenterHistoricalContextBoundary;
};

function divergenceTone(value: string): "default" | "ready" | "warn" | "risk" {
  if (value === "MATERIAL") return "risk";
  if (value === "PARTIAL" || value === "UNRESOLVED") return "warn";
  if (value === "NONE") return "ready";
  return "default";
}

function calibrationTone(value: string): "default" | "ready" | "warn" | "risk" {
  if (value === "DIVERGENT") return "risk";
  if (value === "MIXED" || value === "UNRESOLVED") return "warn";
  if (value === "ALIGNED") return "ready";
  return "default";
}

function canonicalConfidenceTone(value: number): "default" | "ready" | "warn" {
  if (value >= 70) return "ready";
  if (value < 45) return "warn";
  return "default";
}

function directionGlyph(value: "UP" | "DOWN" | "FLAT") {
  if (value === "UP") return "↑";
  if (value === "DOWN") return "↓";
  return "→";
}

function signed(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function joined(values: string[]) {
  return values.filter(Boolean).join("; ");
}

export default function PresenterDivergenceJourney({
  investigations,
  calibration,
  canonicalCases = [],
  editionContext,
  historicalContextBoundary,
}: Props) {
  const cases = buildPresenterDivergenceJourney(investigations);
  const labById = new Map(
    investigations.map((investigation) => [
      investigation.id,
      buildDivergenceLabPresentation(investigation),
    ]),
  );
  const canonicalByInvestigationId = new Map(
    canonicalCases.map((item) => [item.investigationId, item] as const),
  );

  if (!cases.length) {
    return (
      <DataState
        title="No open divergence investigations"
        detail="The current canonical Dossier has no unresolved investigation promoted into the Presenter journey."
      />
    );
  }

  return (
    <section className={styles.workspace} id="presenter-reasoning">
      <div className={styles.summary}>
        <div>
          <small>PRESENTER REASONING</small>
          <strong>Expected → tape → divergence → mechanisms → next test</strong>
          {historicalContextBoundary?.scope === "HISTORICAL_STORY_REASONING_ONLY" ? (
            <p className={styles.editionNotice}>
              {historicalContextBoundary.reason}
              {historicalContextBoundary.dossierId
                ? ` Current Dossier: ${historicalContextBoundary.dossierId}${historicalContextBoundary.dossierAsOf ? ` · as of ${historicalContextBoundary.dossierAsOf}` : ""}.`
                : ""}
            </p>
          ) : historicalContextBoundary?.editionSelectionStatus === "invalid_fallback_current" ? (
            <p className={styles.editionNotice}>{historicalContextBoundary.reason}</p>
          ) : null}
        </div>
        <span>
          {calibration.evaluatedInvestigations} evaluated · {calibration.divergentInvestigations} divergent · {calibration.mixedInvestigations} mixed · {calibration.unresolvedInvestigations} unresolved
        </span>
      </div>

      {editionContext?.options.length ? (
        <nav className={styles.editionRail} aria-label="Presenter reasoning edition">
          {editionContext.options.map((edition) => {
            const selected = edition.snapshotId === editionContext.selectedSnapshotId;
            return (
              <a
                href={edition.href}
                key={edition.snapshotId}
                aria-current={selected ? "page" : undefined}
                className={selected ? styles.editionSelected : undefined}
              >
                <span>{edition.freshness === "current" ? "CURRENT" : "HISTORICAL"}</span>
                <strong>{edition.label}</strong>
              </a>
            );
          })}
        </nav>
      ) : null}

      <div className={styles.stageRail} aria-label="Presenter divergence reasoning stages">
        {["01 EXPECTATION", "02 TAPE", "03 DIVERGENCE", "04 MECHANISMS", "05 NEXT TEST"].map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>

      <div className={styles.caseList}>
        {cases.map((item) => {
          const lab = labById.get(item.id);
          if (!lab) return null;
          const canonical = canonicalByInvestigationId.get(item.id) ?? null;

          const explanation = canonical?.currentExplanation ?? item.provisionalConclusion;
          const nextDiscriminator = canonical
            ? canonical.whatToInspectNext.canonical
              ?? canonical.whatToInspectNext.dossierFallback
              ?? lab.sharedDiscriminator
            : lab.sharedDiscriminator;
          const confirmation = canonical
            ? joined(canonical.confirmation.canonical)
              || canonical.confirmation.dossierFallback
              || item.confirmationCondition
            : item.confirmationCondition;
          const invalidation = canonical
            ? joined(canonical.invalidation.canonical)
              || canonical.invalidation.dossierFallback
              || item.invalidationCondition
            : item.invalidationCondition;

          return (
          <article className={styles.caseCard} key={item.id}>
            <header className={styles.caseHeader}>
              <div>
                <small>{item.status.toUpperCase()} INVESTIGATION</small>
                <h3>{item.question}</h3>
                <p>{item.whyItMatters}</p>
              </div>
              <div className={styles.badges}>
                {canonical ? (
                  <>
                    <Badge tone={historicalContextBoundary?.historicalStoryReasoning ? "warn" : "ready"}>
                      {historicalContextBoundary?.historicalStoryReasoning ? "HISTORICAL STORY" : "CANONICAL STORY"}
                    </Badge>
                    {historicalContextBoundary?.historicalStoryReasoning ? (
                      <Badge tone="warn">STORY REASONING ONLY</Badge>
                    ) : null}
                  </>
                ) : <Badge>DOSSIER FALLBACK</Badge>}
                <Badge tone={divergenceTone(item.divergence)}>{item.divergence}</Badge>
                <Badge tone={calibrationTone(item.calibrationOutcome)}>{item.calibrationOutcome}</Badge>
              </div>
            </header>

            <div className={styles.reasoningGrid}>
              <section>
                <small>01 / PRE-TAPE EXPECTATION</small>
                <p>{item.priorExpectedReaction ?? "No canonical pre-tape expectation was preserved."}</p>
                {item.expectationChanged && item.currentExpectedReaction ? (
                  <div className={styles.annotation}>
                    Current wording changed after the prior Dossier: {item.currentExpectedReaction}
                  </div>
                ) : null}
              </section>

              <section>
                <small>02 / MEASURED TAPE</small>
                <p>{item.observedReaction ?? "No comparable post-trigger reaction is available yet."}</p>
                {canonical?.canonicalMarketReaction
                  && canonical.canonicalMarketReaction !== item.observedReaction ? (
                  <div className={styles.annotation}>
                    Canonical Story reaction summary: {canonical.canonicalMarketReaction}
                  </div>
                ) : null}
                <div className={styles.metaLine}>
                  {item.calibrationPrecision.toLowerCase().replaceAll("_", " ")}
                  {item.reactionWindows.length ? ` · ${item.reactionWindows.join(" → ")}` : ""}
                </div>
              </section>

              <section>
                <small>03 / CURRENT EXPLANATION</small>
                <p>{explanation}</p>
                <div className={styles.metaLine}>
                  {canonical
                    ? `Canonical Story · thesis version ${canonical.thesisVersionId}`
                    : `Dossier fallback · calibration ${item.calibrationOutcome.toLowerCase()}`}
                </div>
              </section>
            </div>

            {item.reactionPaths.length ? (
              <div className={styles.tapeBoard}>
                <small>REACTION PATH</small>
                {item.reactionPaths.map((path) => (
                  <div className={styles.tapeRow} key={path.checkId}>
                    <div className={styles.tapeIdentity}>
                      <strong>
                        {path.instrument}
                        {path.isProxy ? ` via ${path.observedInstrument}` : ""}
                      </strong>
                      <span>
                        expected {directionGlyph(path.expectedDirection)} · observed {directionGlyph(path.observedDirection)} · {path.relation.toLowerCase()}
                      </span>
                    </div>
                    <div className={styles.tapePoints}>
                      {path.points.length ? path.points.map((point) => (
                        <span key={`${path.checkId}:${point.window}`}>
                          <b>{point.window}</b> {directionGlyph(point.observedDirection)} {signed(point.changePct)}
                        </span>
                      )) : (
                        <span>
                          <b>{path.timingPrecision.toLowerCase().replaceAll("_", " ")}</b> exact path not preserved
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            <section className={styles.mechanismSection}>
              <div className={styles.sectionHeading}>
                <div>
                  <small>04 / COMPETING MECHANISMS</small>
                  <strong>
                    {canonical
                      ? canonical.competingExplanations.length
                        ? "Canonical Story competing hypotheses"
                        : "No non-leading canonical hypothesis is preserved"
                      : lab.mode === "full"
                        ? "Dossier evidence-linked hypotheses"
                        : lab.mode === "compact_unresolved"
                          ? "MECHANISM UNRESOLVED"
                          : "Structured mechanism evidence was not preserved"}
                  </strong>
                </div>
                {item.missingEvidence.length ? (
                  <span>{item.missingEvidence.length} missing input(s)</span>
                ) : null}
              </div>

              {canonical ? (
                canonical.competingExplanations.length ? (
                  <div className={styles.mechanismGrid}>
                    {canonical.competingExplanations.map((candidate, index) => (
                      <article className={styles.mechanismCard} key={candidate.hypothesisId}>
                        <header>
                          <span>#{index + 1} · {candidate.mechanismCode.replaceAll("_", " ")}</span>
                          <Badge tone={canonicalConfidenceTone(candidate.confidence)}>
                            {Math.round(candidate.confidence)}%
                          </Badge>
                        </header>
                        <p>{candidate.statement}</p>
                        {candidate.evidenceForIds.length || candidate.evidenceAgainstIds.length ? (
                          <div className={styles.evidenceGrid}>
                            {candidate.evidenceForIds.length ? (
                              <div>
                                <small>EVIDENCE FOR</small>
                                <span>{candidate.evidenceForIds.join(" · ")}</span>
                              </div>
                            ) : null}
                            {candidate.evidenceAgainstIds.length ? (
                              <div>
                                <small>EVIDENCE AGAINST</small>
                                <span>{candidate.evidenceAgainstIds.join(" · ")}</span>
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <small className={styles.evidencePending}>Canonical candidate-specific evidence is not attached.</small>
                        )}
                        <div className={styles.discriminator}>
                          <small>CAUSAL MECHANISM</small>
                          <strong>{candidate.causalMechanism}</strong>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className={styles.emptyMechanism}>
                    The exact canonical Story version has no non-leading competing hypothesis. Hybrid does not revive older Dossier candidates.
                  </p>
                )
              ) : lab.mode === "full" ? (
                <div className={styles.mechanismGrid}>
                  {lab.candidates.map((candidate) => (
                    <article className={styles.mechanismCard} key={`${item.id}:mechanism:${candidate.rank}`}>
                      <header>
                        <span>#{candidate.rank}</span>
                        <Badge tone={candidate.confidence === "HIGH" ? "ready" : candidate.confidence === "LOW" || candidate.confidence === "UNRESOLVED" ? "warn" : "default"}>
                          {candidate.confidence}
                        </Badge>
                      </header>
                      <p>{candidate.explanation}</p>
                      {candidate.evidenceForRefs.length || candidate.evidenceAgainstRefs.length ? (
                        <div className={styles.evidenceGrid}>
                          {candidate.evidenceForRefs.length ? (
                            <div>
                              <small>EVIDENCE FOR</small>
                              <span>{candidate.evidenceForRefs.join(" · ")}</span>
                            </div>
                          ) : null}
                          {candidate.evidenceAgainstRefs.length ? (
                            <div>
                              <small>EVIDENCE AGAINST</small>
                              <span>{candidate.evidenceAgainstRefs.join(" · ")}</span>
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <small className={styles.evidencePending}>Candidate-specific evidence not yet attached.</small>
                      )}
                      {candidate.displayDiscriminator ? (
                        <div className={styles.discriminator}>
                          <small>DISCRIMINATING TEST</small>
                          <strong>{candidate.displayDiscriminator}</strong>
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              ) : lab.alternatives.length ? (
                <div className={styles.compactMechanisms}>
                  <p>
                    {lab.mode === "compact_unresolved"
                      ? "Current evidence does not yet discriminate between the available explanations."
                      : "This Dossier vintage preserved compact competing explanations but not structured candidate evidence."}
                  </p>
                  <ul>
                    {lab.alternatives.map((alternative, index) => (
                      <li key={`${item.id}:alternative:${alternative.rank ?? index}`}>
                        {alternative.explanation}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className={styles.emptyMechanism}>
                  The Dossier has not established competing mechanisms. Hybrid does not invent one.
                </p>
              )}
            </section>

            <section className={styles.nextTest}>
              <div>
                <small>05 / NEXT DISCRIMINATOR</small>
                <strong>{nextDiscriminator}</strong>
              </div>
              <div>
                <small>CONFIRM</small>
                <span>{confirmation}</span>
              </div>
              <div>
                <small>INVALIDATE</small>
                <span>{invalidation}</span>
              </div>
            </section>
          </article>
          );
        })}
      </div>
    </section>
  );
}
