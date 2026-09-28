import Link from "next/link";

import type { DossierPresentationSelection } from "@/lib/dossier-v2/presentation-reader";

import { Badge, DataState, Panel, formatDeskDate } from "./LiveDeskUi";
import styles from "./rate-regime-overview.module.css";

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
      title="US Rate Regime"
      description="Primary US rates view: Fed policy, front-end pricing, real yields, breakevens, Treasury supply and the long end. This is the high-frequency rates sensor inside the broader Cost-of-Capital Regime."
      action={<Badge tone={toneFor(regime.state)}>{regime.state}</Badge>}
    >
      <div className={styles.wrap}>
        <article className={styles.summary}>
          <div className={styles.summaryHead}>
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
              {regime.contractVersion === "rate-regime/1"
                ? (regime.fredBacked ? "SYSTEM 1 RATE STACK" : "RATES GAP")
                : (regime.fredBacked ? "FRED LEGACY" : "RATES GAP")}
            </Badge>
          </div>
        </article>

        <div className={styles.signalGrid}>
          {(regime.signals || []).map((signal) => (
            <article className={styles.signal} data-key={signal.key} key={signal.key}>
              <span>{signal.label}</span>
              <strong>{readable(signal.state)}</strong>
              <p>{signal.detail}</p>
            </article>
          ))}
        </div>

        <div className={styles.lower}>
          {regime.curve ? (
            <article className={styles.compact}>
              <strong>2Y / 10Y curve · {regime.curve.state}</strong>
              <p>{regime.curve.detail}</p>
            </article>
          ) : null}

          {(regime.trigger || regime.observedRatePricing || regime.observedConfirmation) ? (
            <article className={styles.compact}>
              <strong>Latest event overlay</strong>
              {regime.trigger ? <p>{regime.trigger}</p> : null}
              <p>{readable(regime.nextMeetingRateOutlook)} · FedWatch direction: {readable(regime.fedWatchExpectedDirection)}</p>
              {regime.observedConfirmation ? <p>{regime.observedConfirmation}</p> : null}
            </article>
          ) : null}

          {regime.contradictions?.length ? (
            <article className={styles.compact}>
              <strong>Internal contradiction</strong>
              <p>{regime.contradictions.join(" ")}</p>
            </article>
          ) : null}

          {regime.gaps.length ? (
            <article className={styles.compact}>
              <strong>Coverage gaps</strong>
              <p>{regime.gaps.join(" · ")}</p>
            </article>
          ) : null}
        </div>

        <footer className={styles.footer}>
          <span>US Rate Regime is the high-frequency rates layer, not the whole global Cost-of-Capital Regime.</span>
          <Link href="/regimes/global-cost-of-capital">Open full Cost-of-Capital Regime →</Link>
        </footer>
      </div>
    </Panel>
  );
}
