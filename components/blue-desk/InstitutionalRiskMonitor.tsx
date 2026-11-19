import type { InstitutionalRiskRow } from "@/lib/bluebelly-institutional-risk";
import s from "./InstitutionalRiskMonitor.module.css";

const number = (v: number | null, digits = 2) => v === null ? "—" : v.toFixed(digits) + "%";
const signed = (v: number | null) => v === null ? "—" : (v > 0 ? "+" : "") + v.toFixed(1) + "%";

export default function InstitutionalRiskMonitor({ rows }: { rows: readonly InstitutionalRiskRow[] }) {
  return <section className={s.shell} aria-labelledby="institutional-risk-heading" data-institutional-risk="implied-var-v1">
    <header className={s.head}>
      <div><span className={s.kicker}>INSTITUTIONAL RISK · DAILY CLOSE</span><h2 id="institutional-risk-heading">Is risk pressure rising or easing?</h2></div>
      <span className={s.note}>1-day VaR · unhedged index exposure</span>
    </header>
    <div className={s.grid}>
      {rows.map(row => {
        const tone = row.state !== "current" || row.change5d === null ? "unknown" : row.change5d > 0 ? "pressure" : row.change5d < 0 ? "easing" : "flat";
        return <article key={row.symbol} className={s.card} data-risk-state={row.state} data-risk-tone={tone}>
          <div className={s.cardHead}><h3>{row.label} <small>· {row.symbol}</small></h3><span className={s.status}>{row.state === "behind" ? "SOURCE BEHIND" : row.state === "unavailable" ? "UNAVAILABLE" : tone === "pressure" ? "5D RISK RISING" : tone === "easing" ? "5D RISK EASING" : "5D RISK FLAT / UNKNOWN"}</span></div>
          <div className={s.primary}><strong>{number(row.var95)}</strong><span>95% implied VaR<br/>99%: {number(row.var99)}</span></div>
          <dl className={s.metrics}>
            <div><dt>1-session VaR change</dt><dd>{signed(row.change1d)}</dd></div>
            <div><dt>5-session VaR change</dt><dd>{signed(row.change5d)}</dd></div>
            <div><dt>252-observation risk percentile</dt><dd>{number(row.percentile, 0)}</dd></div>
            <div><dt>5D fixed-risk exposure capacity</dt><dd>{signed(row.capacity5d)}</dd></div>
            <div><dt>20-session realised VaR</dt><dd>{number(row.realised?.var95 ?? null)}</dd></div>
          </dl>
          <small className={s.source}><a href={row.sourceUrl} target="_blank" rel="noreferrer">Cboe via FRED</a> · {row.asOf ?? "No dated close"}{row.state !== "current" && row.expected ? ` · expected ${row.expected}` : ""}
            {row.realised && <> · realised: <a href={row.realised.sourceUrl} target="_blank" rel="noreferrer">{row.realisedLabel}</a> ({row.realised.day})</>}
          </small>
        </article>;
      })}
    </div>
    <details className={s.method}><summary>How to interpret this</summary><p>Implied VaR uses the 30-day option-implied annual volatility index × 1.645 (95%) or 2.326 (99%) ÷ √252. Realised VaR uses the standard deviation of 20 completed daily log returns × 1.645. Both are zero-drift normal-distribution approximations. The percentile ranks implied risk across the latest 252 available daily source observations (approximately one trading year), including the latest close.</p><p>Fixed-risk capacity = prior volatility ÷ latest volatility − 1. A negative number is the theoretical exposure reduction needed to maintain the same VaR budget with unchanged composition and hedging. A positive number is theoretical additional capacity, not an estimate of actual flows. Firm holdings, leverage, correlations, hedges and risk limits are unknown; this is not any firm's reported VaR, a maximum loss, or a trade signal.</p></details>
  </section>;
}
