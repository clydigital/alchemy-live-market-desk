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
        <p>Threshold definitions only. LIVE activates a state only when canonical evidence and accepted Story reasoning support it.</p>
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
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}
