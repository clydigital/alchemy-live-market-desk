import type { InstitutionalRiskRow } from "@/lib/bluebelly-institutional-risk";
import { FEDWATCH_URL, FOMC_URL, type buildFedRateWatch, type nextFomcDecision } from "@/lib/bluebelly-next-rate-decision";
import DualTimestamp from "./DualTimestamp";
import s from "./InstitutionalRiskMonitor.module.css";

const number = (v: number | null, digits = 2) => v === null ? "—" : v.toFixed(digits) + "%";
const signed = (v: number | null) => v === null ? "—" : (v > 0 ? "+" : "") + v.toFixed(1) + "%";

const points = (v: number | null, unit: string) => v === null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(2)} ${unit}`;

export default function InstitutionalRiskMonitor({ rows, rates, nextDecision }: {
  rows: readonly InstitutionalRiskRow[]; rates: ReturnType<typeof buildFedRateWatch>; nextDecision: ReturnType<typeof nextFomcDecision>;
}) {
  return <section className={s.shell} aria-labelledby="institutional-risk-heading" data-institutional-risk="implied-var-v1">
    <header className={s.head}>
      <div><span className={s.kicker}>RISK RADAR / SOURCE-DATED CLOSE</span><h2 id="institutional-risk-heading">How much risk is the market pricing?</h2></div>
      <span className={s.note}><i/> AUTOMATIC · DAILY SOURCE OBSERVATIONS</span>
    </header>
    <div className={s.grid}>
      {rows.map(row => {
        const tone = row.state !== "current" || row.change5d === null ? "unknown" : row.change5d > 0 ? "pressure" : row.change5d < 0 ? "easing" : "flat";
        return <article key={row.symbol} className={s.card} data-risk-state={row.state} data-risk-tone={tone}>
          <div className={s.cardHead}><h3>{row.label} <small>· {row.symbol}</small></h3><span className={s.status}>{row.state === "behind" ? "SOURCE BEHIND" : row.state === "unavailable" ? "UNAVAILABLE" : tone === "pressure" ? "5D RISK RISING" : tone === "easing" ? "5D RISK EASING" : "5D RISK FLAT / UNKNOWN"}</span></div>
          <div className={s.primary}>
            <div className={s.dial}>
              <svg viewBox="0 0 144 144" aria-hidden="true">
                <circle className={s.ticks} cx="72" cy="72" r="68" pathLength="100"/>
                <circle className={s.track} cx="72" cy="72" r="58"/>
                {row.percentile !== null && <circle className={s.arc} cx="72" cy="72" r="58" pathLength="100" strokeDasharray={`${row.percentile} 100`} transform="rotate(-90 72 72)"/>}
              </svg>
              <div className={s.dialValue}><strong>{number(row.var95)}</strong><span>95% VaR · 1D</span></div>
            </div>
            <div className={s.reading}>
              <div className={s.percentile}><strong>{number(row.percentile, 0)}</strong> <span>risk percentile<br/>Ring = rank vs 252 closes</span></div>
              <p>{row.var95 === null ? "No eligible volatility close. Risk estimate unavailable." : `Estimated one-day loss threshold: ${number(row.var95)}. About 1 in 20 sessions may exceed it under the model.`}</p>
              <p className={s.take}>{row.state !== "current" ? "Wait for the latest source close before interpreting current risk direction." : row.change5d === null ? "Five-session direction unavailable." : tone === "pressure" ? `Risk has risen ${Math.abs(row.change5d).toFixed(1)}% in five sessions.` : tone === "easing" ? `Risk has eased ${Math.abs(row.change5d).toFixed(1)}% in five sessions.` : "Risk is unchanged over five sessions."}</p>
            </div>
          </div>
          <div className={s.volatility}><a href={row.sourceUrl} target="_blank" rel="noreferrer">{row.symbol} close ↗</a><strong>{row.volatility === null ? "—" : row.volatility.toFixed(2)}</strong><span>1D {points(row.volatilityChange1d,"pts")} ({signed(row.change1d)})</span></div>
          <dl className={s.metrics}>
            <div><dt>99% implied VaR</dt><dd>{number(row.var99)}</dd></div>
            <div><dt>5-session VaR change</dt><dd>{signed(row.change5d)}</dd></div>
            <div><dt>5D fixed-risk exposure capacity</dt><dd>{signed(row.capacity5d)}</dd></div>
            <div><dt>20-session realised VaR</dt><dd>{number(row.realised?.var95 ?? null)}</dd></div>
          </dl>
          <small className={s.source}><a href={row.sourceUrl} target="_blank" rel="noreferrer">Cboe via FRED</a> · {row.asOf ?? "No dated close"}{row.state !== "current" && row.expected ? ` · expected ${row.expected}` : ""}
            {row.realised && <> · realised: <a href={row.realised.sourceUrl} target="_blank" rel="noreferrer">{row.realisedLabel}</a> ({row.realised.day})</>}
          </small>
        </article>;
      })}
    </div>
    <section className={s.policy} aria-labelledby="next-rate-heading">
      <div className={s.policyHead}><div><span className={s.kicker}>POLICY WATCH / NEXT DECISION</span><h3 id="next-rate-heading">{nextDecision ? <DualTimestamp value={nextDecision.scheduledAt} sourceDate={nextDecision.localDate}/> : "Next FOMC date not verified"}</h3><a href={FOMC_URL} target="_blank" rel="noreferrer">Federal Reserve calendar ↗</a></div><a className={s.fedwatch} href={FEDWATCH_URL} target="_blank" rel="noreferrer">CME FedWatch · next-meeting odds ↗</a></div>
      <div className={s.rateGrid}>{rates.map(rate => <div className={s.rate} key={rate.symbol}><a href={rate.sourceUrl} target="_blank" rel="noreferrer">{rate.label} · {rate.sourceName} ↗</a><div><strong>{number(rate.level)}</strong><span>1D {points(rate.changeBp,"bp")}</span></div><small>{rate.description} · {rate.asOf ?? "No dated observation"}{rate.priorDate ? ` vs ${rate.priorDate}` : ""}{rate.sourceName!=="FRED" && <> · <a href={rate.fredUrl} target="_blank" rel="noreferrer">FRED series ↗</a></>}</small></div>)}</div>
      <p className={s.policyNote}>Rate changes are between published observations, not next-meeting odds. For hike / hold / cut probabilities and their prior-day changes, open CME FedWatch; its probability feed is not connected.</p>
    </section>
    <details className={s.method}><summary>How to interpret this</summary><p>Implied VaR uses the 30-day option-implied annual volatility index × 1.645 (95%) or 2.326 (99%) ÷ √252. Realised VaR uses the standard deviation of 20 completed daily log returns × 1.645. Both are zero-drift normal-distribution approximations. The percentile ranks implied risk across the latest 252 available daily source observations (approximately one trading year), including the latest close.</p><p>Fixed-risk capacity = prior volatility ÷ latest volatility − 1. A negative number is the theoretical exposure reduction needed to maintain the same VaR budget with unchanged composition and hedging. A positive number is theoretical additional capacity, not an estimate of actual flows. Firm holdings, leverage, correlations, hedges and risk limits are unknown; this is not any firm's reported VaR, a maximum loss, or a trade signal.</p></details>
  </section>;
}
