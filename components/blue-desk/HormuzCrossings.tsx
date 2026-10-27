'use client';
import { useEffect, useState } from 'react';
import { HORMUZ_SOURCE, crossingTrend, hormuzFreshness, type HormuzMonitor } from '@/lib/hormuz-monitor-core';
import styles from './hormuz-crossings.module.css';
import { EntityMark } from './EntityIdentity';

export default function HormuzCrossings({ monitor }: { monitor: HormuzMonitor }) {
  const [now, setNow] = useState(() => Date.parse(monitor.checkedAt));
  useEffect(() => {
    setNow(Date.now());
    // Only ages the displayed snapshot. Does not poll the provider or route.
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, [monitor.checkedAt]);
  const status = hormuzFreshness(monitor, now), snapshot = monitor.snapshot;
  const trend = snapshot ? crossingTrend(snapshot) : null;
  const max = Math.max(1, ...(snapshot?.daily.flatMap(d => [d.inbound || 0, d.outbound || 0]) || []));
  return <section className={styles.panel} aria-label="Hormuz crossing trends">
    <header className={styles.header}><div><p>OIL · PHYSICAL SHIPPING</p><h2><EntityMark kind="asset" code="OIL" size="sm" /> Hormuz crossings</h2></div><strong role="status" className={styles[status]}>{status === 'current' ? 'Recent observation' : status === 'stale' ? 'Stale · last available data' : 'Data unavailable'}</strong></header>
    {snapshot ? <>
      <p className={styles.totals}><b>{snapshot.total}</b> completed crossings over the source’s rolling 24 hours: <b>{snapshot.inbound}</b> inbound · <b>{snapshot.outbound}</b> outbound.</p>
      <p>{trend ? <>Last 7 complete UTC days: <b>{trend.latest}</b> vs <b>{trend.previous}</b> in the preceding 7 ({trend.delta > 0 ? '+' : ''}{trend.delta} crossings{trend.percent === null ? '; percentage unavailable from zero baseline' : `; ${trend.percent > 0 ? '+' : ''}${trend.percent.toFixed(1)}%`}).</> : 'Weekly comparison unavailable: 14 consecutive complete days are required.'}</p>
      <p className={styles.legend}><span>● Inbound</span><span>● Outbound</span> · crossings/day · UTC · hatched = partial</p>
      <div className={styles.chart} role="img" aria-label="Daily inbound and outbound crossings; exact values in the table below. Missing directions are not plotted.">
        {snapshot.daily.map(d => <div key={d.day} className={styles.day} title={`${d.day}: inbound ${d.inbound ?? 'unknown'}, outbound ${d.outbound ?? 'unknown'}${d.partial ? ' (partial)' : ''}`}>
          <div className={styles.bars} data-partial={d.partial}>
            {(['inbound', 'outbound'] as const).map(direction => <i key={direction} className={styles[direction]} style={{ height: d[direction] === null ? 0 : `${d[direction]! / max * 100}%` }} />)}
          </div><small>{d.day.slice(8)}</small>
        </div>)}
      </div>
      <details><summary>Daily values and missing data</summary><div className={styles.scroll}><table><thead><tr><th>UTC date</th><th>Inbound</th><th>Outbound</th><th>Coverage</th></tr></thead><tbody>{snapshot.daily.map(d => <tr key={d.day}><th>{d.day}</th><td>{d.inbound ?? 'Unknown'}</td><td>{d.outbound ?? 'Unknown'}</td><td>{d.partial ? 'Partial / window boundary' : d.inbound === null || d.outbound === null ? 'Incomplete' : 'Reported day'}</td></tr>)}</tbody></table></div></details>
      <p className={styles.meta}>Source observation: <time dateTime={snapshot.observedAt}>{snapshot.observedAt.replace('T', ' ').replace('.000Z', ' UTC')}</time><br/>Retrieved: <time dateTime={snapshot.retrievedAt}>{snapshot.retrievedAt.replace('T', ' ').replace('Z', ' UTC')}</time></p>
    </> : <p>Crossing observations are temporarily unavailable. Missing data does not mean zero traffic.</p>}
    {monitor.refreshFailed && snapshot ? <p>Refresh failed. The last valid observation is retained.</p> : null}
    <p className={styles.meta}>Stale after 90 minutes or a failed refresh. Upstream requests are shared and at least 30 minutes apart. Reload to request an eligible update.</p>
    <p className={styles.meta}><a href={`${HORMUZ_SOURCE}/api-docs`} target="_blank" rel="noreferrer">Source: Strait of Hormuz Ship Monitor · CC BY 4.0 ↗</a><br/>AIS-detected crossings of all tracked vessel types, not measured oil volumes. Jamming and missing signals can obscure traffic. Ships still in the strait are excluded. Supply-change interpretations require independent verification.</p>
  </section>;
}
