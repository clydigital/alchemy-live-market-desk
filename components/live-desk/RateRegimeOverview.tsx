import type { DossierPresentationSelection } from "@/lib/dossier-v2/presentation-reader";

import { styles } from "./LiveDeskShell";
import { Badge, DataState, Panel, formatDeskDate } from "./LiveDeskUi";

function readable(value: string | null | undefined) {
  return value ? value.replaceAll("_", " ") : "Unresolved";
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

  const tone = regime.state === "HAWKISH"
    ? "warn" as const
    : regime.state === "DOVISH"
      ? "ready" as const
      : "default" as const;

  return (
    <Panel
      title="Rate Regime"
      description="Canonical System 1 policy logic, using the same Dossier state consumed by Hybrid."
      action={<Badge tone={tone}>{regime.state}</Badge>}
    >
      <div className={styles.recordList}>
        <article className={styles.record}>
          <div className={styles.recordHeader}>
            <div>
              <h3>{regime.trigger || "No active macro-policy trigger"}</h3>
              <div className={styles.meta}>
                Dossier as of {formatDeskDate(dossier.asOf)} · {regime.fredBacked ? "FRED-backed US 2Y context present" : "FRED-backed US 2Y context not present in selected Dossier"}
              </div>
            </div>
            <Badge tone={regime.fredBacked ? "ready" : "warn"}>
              {regime.fredBacked ? "FRED / DGS2" : "RATES GAP"}
            </Badge>
          </div>
        </article>

        <article className={styles.record}>
          <h3>Next meeting</h3>
          <p>{readable(regime.nextMeetingRateOutlook)} · FedWatch direction: {readable(regime.fedWatchExpectedDirection)}</p>
          <p>{regime.observedRatePricing || "Post-trigger rate-pricing probability is not yet present in canonical evidence."}</p>
        </article>

        <article className={styles.record}>
          <h3>US rates confirmation</h3>
          <p>{regime.usRatesReaction ? `Observed reaction: ${regime.usRatesReaction}` : "Direct US-rates reaction remains unresolved."}</p>
          <p>{regime.usRatesInterpretation || "No canonical US-rates interpretation is available."}</p>
          {regime.observedConfirmation ? <p>Event tape: {regime.observedConfirmation}</p> : null}
        </article>

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
