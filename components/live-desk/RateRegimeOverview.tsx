import type { DossierPresentationSelection } from "@/lib/dossier-v2/presentation-reader";

import { styles } from "./LiveDeskShell";
import { Badge, DataState, Panel, formatDeskDate } from "./LiveDeskUi";

function readable(value: string | null | undefined) {
  return value ? value.replaceAll("_", " ") : "Unresolved";
}

function toneFor(state: string | null | undefined) {
  if (state === "HAWKISH") return "warn" as const;
  if (state === "DOVISH") return "ready" as const;
  if (state === "UNRESOLVED") return "risk" as const;
  return "default" as const;
}

export default function RateRegimeOverview({
  selection,
}: {
  selection: DossierPresentationSelection;
}) {
  const dossier = selection.presentation;
  const regime = dossier?.rateRegime;

  if (!dossier || !regime) {
    return (
      <DataState
        title="Rate regime unavailable"
        detail="The canonical Dossier has not published a safe rate-regime interpretation yet."
      />
    );
  }

  return (
    <Panel
      title="Rate Regime"
      description="Persistent deterministic rates state. Policy events are one input alongside the front end, real yields, breakevens and the curve."
      action={<Badge tone={toneFor(regime.state)}>{regime.state}</Badge>}
    >
      <div className={styles.recordList}>
        <article className={styles.record}>
          <div className={styles.recordHeader}>
            <div>
              <h3>{regime.summary || regime.trigger || "Persistent rate state is available."}</h3>
              <div className={styles.meta}>
                Dossier as of {formatDeskDate(dossier.asOf)}
                {typeof regime.score === "number" ? ` · score ${regime.score >= 0 ? "+" : ""}${regime.score}` : ""}
                {regime.confidence ? ` · ${regime.confidence.toLowerCase()} confidence` : ""}
                {regime.coverage ? ` · ${regime.coverage.present}/${regime.coverage.total} rate inputs` : ""}
              </div>
            </div>
            <Badge tone={regime.fredBacked ? "ready" : "warn"}>
              {regime.fredBacked ? "FRED RATE STACK" : "RATES GAP"}
            </Badge>
          </div>
        </article>

        {regime.signals?.map((signal) => (
          <article className={styles.record} key={signal.key}>
            <div className={styles.recordHeader}>
              <div>
                <h3>{signal.label}</h3>
                <p>{signal.detail}</p>
              </div>
              <Badge tone={toneFor(signal.state)}>{signal.state}</Badge>
            </div>
          </article>
        ))}

        {regime.curve ? (
          <article className={styles.record}>
            <div className={styles.recordHeader}>
              <div>
                <h3>2Y / 10Y curve</h3>
                <p>{regime.curve.detail}</p>
              </div>
              <Badge>{regime.curve.state}</Badge>
            </div>
          </article>
        ) : null}

        {(regime.trigger || regime.observedRatePricing || regime.observedConfirmation) ? (
          <article className={styles.record}>
            <h3>Latest event overlay</h3>
            {regime.trigger ? <p>{regime.trigger}</p> : null}
            <p>{readable(regime.nextMeetingRateOutlook)} · FedWatch direction: {readable(regime.fedWatchExpectedDirection)}</p>
            <p>{regime.observedRatePricing || "Post-trigger rate-pricing probability is not yet present in canonical evidence."}</p>
            {regime.observedConfirmation ? <p>Event tape: {regime.observedConfirmation}</p> : null}
          </article>
        ) : null}

        {regime.contradictions?.length ? (
          <article className={styles.record}>
            <h3>Internal contradiction</h3>
            <p>{regime.contradictions.join(" ")}</p>
          </article>
        ) : null}

        {regime.gaps.length ? (
          <article className={styles.record}>
            <h3>Still unresolved</h3>
            <p>{regime.gaps.join(" · ")}</p>
          </article>
        ) : null}
      </div>
    </Panel>
  );
}
