"use client";

import { getDossierTriggerDefinitions, type DossierTriggerLevel } from "@/lib/regime-trigger-taxonomy";
import type { RegimeSlug } from "@/lib/regimes";
import styles from "./regime-trigger-ladder.module.css";

const LABELS: Record<DossierTriggerLevel, string> = {
  ACTIVE: "ACTIVE THRESHOLD",
  WATCH: "WATCH",
  ACCELERATION: "ACCELERATION",
  CREDIT_TRANSMISSION: "CREDIT TRANSMISSION",
  SYSTEMIC: "SYSTEMIC",
  US_CONFIDENCE_TAIL: "US-CONFIDENCE TAIL",
};

export default function RegimeTriggerLadder({ regimeSlug }: { regimeSlug: RegimeSlug }) {
  const triggers = getDossierTriggerDefinitions(regimeSlug);
  if (!triggers.length) return null;

  return (
    <section className={styles.section} aria-label="Regime trigger ladder">
      <header className={styles.header}>
        <div>
          <span>LIVE · TRIGGER LADDER</span>
          <h2>What would move the Regime?</h2>
        </div>
        <p>Research tripwires, NOT live triggered readings or probabilities. No threshold is marked passed without current canonical data and Dossier reasoning.</p>
      </header>
      <div className={styles.grid}>
        {triggers.map((trigger) => (
          <article className={styles.card} key={trigger.id}>
            <div className={styles.cardHead}>
              <span data-level={trigger.level}>{LABELS[trigger.level]}</span>
              <h3>{trigger.label}</h3>
            </div>
            <p>{trigger.condition}</p>
            <dl>
              <div><dt>Why it matters</dt><dd>{trigger.whyItMatters}</dd></div>
              <div><dt>Scenario effect</dt><dd>{trigger.scenarioEffect}</dd></div>
              <div><dt>Evidence gate</dt><dd>{trigger.evidenceRequirement}</dd></div>
              {trigger.quantitativeTest && <div><dt>Measurable test · proposed</dt><dd>{trigger.quantitativeTest}</dd></div>}
              {trigger.bullishFalsifier && <div><dt>What would invalidate the warning?</dt><dd>{trigger.bullishFalsifier}</dd></div>}
              {trigger.missingEvidence && <div><dt>If data are missing</dt><dd>{trigger.missingEvidence}</dd></div>}
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}
