import type { VerifiedEarningsScorecard } from "@/lib/blue-desk-earnings-results";
import {getDatedEarningsReaction} from "@/lib/bluebelly-earnings-reaction";
import styles from "./RecentEarningsScorecards.module.css";

function Metric({metric}:{metric:VerifiedEarningsScorecard["metrics"][number]}) {
  return <div className={styles.metric} data-metric={metric.name}>
    <span className={styles.metricName}>{metric.name}</span>
    <div className={styles.metricBody}>
      <strong className={metric.state==="not_verified"?styles.unknown:styles.value}>
        {metric.value??"Not yet verified"}
      </strong>
      {metric.comparison?<span className={styles.comparison}>{metric.comparison}</span>:null}
      {metric.note?<small className={styles.note}>{metric.note}</small>:null}
    </div>
  </div>;
}

function MarketReaction({id}:{id:string}) {
 const reaction=getDatedEarningsReaction(id);
 return reaction?<div className={styles.why} data-calendar-earnings-reaction="attributed-source-dated">
  <strong>Why did this share sell off?</strong>
  <p>{reaction.ticker} fell {Math.abs(reaction.regularClose.changePct).toFixed(2)}% in regular trading BEFORE earnings (US$ {reaction.regularClose.usd.toFixed(2)} at 4 PM ET). It then traded at US$ {reaction.extended.usd.toFixed(2)}, {reaction.extendedChangePct.toFixed(2)}% from that SAME close, as of {reaction.extended.at}.</p>
  <p><strong>Company facts:</strong> {reaction.companyFact}</p>
  <p><strong>Expectations:</strong> {reaction.expectation}</p>
  <p><strong>Investor interpretation:</strong> {reaction.interpretation}</p>
  <p><strong>Best alternative:</strong> {reaction.countercase}</p>
  <p><strong>Next check:</strong> {reaction.nextTest}</p>
  <p><a href={reaction.issuerUrl} target="_blank" rel="noopener noreferrer">Issuer statement</a>{" · "}
   <a href={reaction.reportingUrl} target="_blank" rel="noopener noreferrer">Reported context</a>{" · "}
   <a href={reaction.extended.sourceUrl} target="_blank" rel="noopener noreferrer">Price snapshot</a>. Interpretation is not confirmed causation.</p>
 </div>:<p data-calendar-earnings-reaction="REACTION_ANALYSIS_INCOMPLETE">A source-matched stock-price explanation has not been established for this result. Do not infer one from earnings alone.</p>;
}

/** Existing Calendar's source-qualified released results, not upcoming calls,
 * an automatic earnings-beat service, a forecast, or canonical thesis update.
 */
export default function RecentEarningsScorecards({
  records,
}:{records:readonly VerifiedEarningsScorecard[]}) {
  if(!records.length)return null;
  return <section className={styles.wrap} id="earnings-results" aria-labelledby="earnings-results-title"
    data-bluebelly-released-earnings="issuer-source-verified">
    <header className={styles.heading}>
      <div>
        <p className={styles.kicker}>EARNINGS / SIMPLE BREAKDOWN</p>
        <h2 id="earnings-results-title">Who beat expectations, and who kept the cash?</h2>
        <p className={styles.description}>Selected released results from original issuer sources. We separate analyst expectations from year-on-year growth, actual cash flow and spending plans.</p>
      </div>
      <span className={styles.sample}>{records.length} source-reviewed results · rolling 30 days</span>
    </header>
    <div className={styles.results}>
      {records.map(record=><article className={styles.result} key={record.id} data-earnings-result-id={record.id}>
        <div className={styles.topline}>
          <div>
            <span className={styles.fiscal}>{record.ticker} · {record.fiscalPeriod} · {record.releaseDay}</span>
            <h3>{record.company}</h3>
            <p className={styles.headline}>{record.headline}</p>
          </div>
          <span className={styles.sourceTag}>{record.preliminary?"Preliminary issuer results":"Issuer results"}</span>
        </div>
        <div className={styles.beat} data-beat-comparator={record.beatSource}>
          <strong>Beat or miss?</strong>
          <p>{record.beatMiss}</p>
        </div>
        <MarketReaction id={record.id}/>
        <div className={styles.metrics}>
          {record.metrics.map(m=><Metric key={m.name} metric={m}/>)}
        </div>
        <div className={styles.why}>
          <strong>What changed in the outlook?</strong>
          <p>{record.outlook}</p>
          <strong>What does it mean?</strong>
          <p>{record.conclusion}</p>
        </div>
        <p className={styles.next}><strong>Next check:</strong> {record.nextTest}</p>
        <footer className={styles.footer}>
          <span>{record.basis}</span>
          <span className={styles.sourceLinks}>
            <a href={record.sourceUrl} target="_blank" rel="noopener noreferrer">{record.sourceName} ↗</a>
            {record.additionalSourceUrl?<a href={record.additionalSourceUrl} target="_blank" rel="noopener noreferrer">Issuer cash-flow slides ↗</a>:null}
          </span>
        </footer>
      </article>)}
    </div>
    <p className={styles.footnote}>Not a complete earnings feed. “Not yet verified” means that this sourced snapshot does not establish the figure; it does not mean zero or that the company has never disclosed it. Estimates, guidance and reported results are different comparisons. Older snapshots disappear automatically.</p>
  </section>;
}
