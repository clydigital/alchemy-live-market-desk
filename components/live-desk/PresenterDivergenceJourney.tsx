import type {
  DossierPresentationCalibrationSummary,
  DossierPresentationInvestigation,
} from "@/lib/dossier-v2/presentation-adapter";
import { buildDivergenceLabPresentation } from "@/lib/divergence-lab-presentation";
import { buildPresenterDivergenceJourney } from "@/lib/presenter-divergence-journey";

import { Badge, DataState } from "./LiveDeskUi";
import styles from "./presenter-divergence-journey.module.css";

type Props = {
  investigations: DossierPresentationInvestigation[];
  calibration: DossierPresentationCalibrationSummary;
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

function directionGlyph(value: "UP" | "DOWN" | "FLAT") {
  if (value === "UP") return "↑";
  if (value === "DOWN") return "↓";
  return "→";
}

function signed(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export default function PresenterDivergenceJourney({
  investigations,
  calibration,
}: Props) {
  const cases = buildPresenterDivergenceJourney(investigations);

  if (!cases.length) {
    return (
      <DataState
        title="No open divergence investigations"
        detail="The current canonical Dossier has no unresolved investigation promoted into the Presenter journey."
      />
    );
  }

  return (
    <section className={styles.workspace}>
      <div className={styles.summary}>
        <div>
          <small>PRESENTER REASONING</small>
          <strong>Expected → tape → divergence → mechanisms → next test</strong>
        </div>
        <span>
          {calibration.evaluatedInvestigations} evaluated · {calibration.divergentInvestigations} divergent · {calibration.mixedInvestigations} mixed · {calibration.unresolvedInvestigations} unresolved
        </span>
      </div>

      <div className={styles.stageRail} aria-label="Presenter divergence reasoning stages">
        {["01 EXPECTATION", "02 TAPE", "03 DIVERGENCE", "04 MECHANISMS", "05 NEXT TEST"].map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>

      <div className={styles.caseList}>
        {cases.map((item) => {
          const source = investigations.find((investigation) => investigation.id === item.id);
          if (!source) return null;
          const lab = buildDivergenceLabPresentation(source);

          return (
          <article className={styles.caseCard} key={item.id}>
            <header className={styles.caseHeader}>
              <div>
                <small>{item.status.toUpperCase()} INVESTIGATION</small>
                <h3>{item.question}</h3>
                <p>{item.whyItMatters}</p>
              </div>
              <div className={styles.badges}>
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
                <div className={styles.metaLine}>
                  {item.calibrationPrecision.toLowerCase().replaceAll("_", " ")}
                  {item.reactionWindows.length ? ` · ${item.reactionWindows.join(" → ")}` : ""}
                </div>
              </section>

              <section>
                <small>03 / DIVERGENCE</small>
                <p>{item.provisionalConclusion}</p>
                <div className={styles.metaLine}>
                  Calibration: {item.calibrationOutcome.toLowerCase()}
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
                    {lab.mode === "full"
                      ? "Evidence-linked hypotheses"
                      : lab.mode === "compact_unresolved"
                        ? "MECHANISM UNRESOLVED"
                        : "Structured mechanism evidence was not preserved"}
                  </strong>
                </div>
                {item.missingEvidence.length ? (
                  <span>{item.missingEvidence.length} missing input(s)</span>
                ) : null}
              </div>

              {lab.mode === "full" ? (
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
                  The canonical Dossier has not established competing mechanisms. Hybrid does not invent one.
                </p>
              )}
            </section>

            <section className={styles.nextTest}>
              <div>
                <small>05 / NEXT DISCRIMINATOR</small>
                <strong>{lab.sharedDiscriminator}</strong>
              </div>
              <div>
                <small>CONFIRM</small>
                <span>{item.confirmationCondition}</span>
              </div>
              <div>
                <small>INVALIDATE</small>
                <span>{item.invalidationCondition}</span>
              </div>
            </section>
          </article>
          );
        })}
      </div>
    </section>
  );
}
