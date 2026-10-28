import {getRecentVerifiedEarningsScorecards} from "@/lib/blue-desk-earnings-results";
import Link from 'next/link';
import type {NewsBriefV1} from '@/lib/market-brief-news';
import type {PresenterCalendar,PresenterCalendarEvent} from '@/lib/presenter-calendar';
import {decisionTopics,decisionCalendar,calendarOutcome} from '@/lib/bluebelly-decision-brief';
import {blueDeskPublicHref} from '@/lib/blue-desk-host';
import DualTimestamp from './DualTimestamp';
import s from './DecisionBrief.module.css';

function Event({event}:{event:PresenterCalendarEvent}){
 return <article className={s.event}><strong>{event.title}</strong>
   <small>{event.status==='scheduled'?'SCHEDULED':'REPORTED · COMPARISON UNAVAILABLE'} · {event.verificationState}</small>
   <DualTimestamp value={event.scheduledAt} sourceDate={event.localDate}/>
   <p>{event.status==='scheduled' ? event.decidingQuestion : calendarOutcome(event)}</p>
   <details><summary>Expectations, test and source</summary>
    <p>Actual: {event.status==='scheduled'?'pending':event.actual||'unavailable'} · Consensus: {event.consensus||'unavailable'} · Prior: {event.previous||'unavailable'}</p>
    <p>Metric, period, comparable basis and consensus as-of: unavailable in this calendar projection. Numerical surprise and attributable price reaction: unavailable.</p>
    <p>{event.affectedAssets.join(' · ')}. {event.decidingQuestion}</p>
    <p>Scenario test: compare stronger and weaker results against the sourced expectation; then check a matched post-release asset observation. No directional reaction is assumed.</p>
    <a href={event.sourceUrl} target="_blank" rel="noreferrer">{event.sourceName} ↗</a>
   </details>
 </article>;
}
export default function DecisionBrief({news,calendar,now,host,report=false}:{news:readonly NewsBriefV1[];calendar:PresenterCalendar;now:Date;host:string|null;report?:boolean}){
 const topics=decisionTopics(news,calendar,now), lanes=decisionCalendar(calendar,now);
 const reader=blueDeskPublicHref('/blue-desk/key-stories',host), calendarHref=blueDeskPublicHref('/blue-desk/calendar',host);
 const lead=topics[0];
 const earningsResults=getRecentVerifiedEarningsScorecards(now,7);
 return <section className={s.brief} data-decision-first="public-v1">
  <header className={s.header}><p className={s.kicker}>{report?'DAILY REPORT':'TODAY'} / SOURCE-QUALIFIED BRIEFING</p>
   <h1>{report?'Today’s decisions, explained.':'Market in 30 seconds'}</h1>
   <p className={s.verdict}>{lead ? <>{lead.title} <span>{lead.why}</span></> : 'Current verified coverage is insufficient for a market verdict.'}</p>
   <p className={s.limit}>Working interpretation: announcements establish events, not investment returns. A matched price reaction or contrary evidence may change the reading. {lead ? 'Next test: '+lead.test : 'Check the source-listed calendar below.'}</p>
   <small>Read cutoff <DualTimestamp value={now.toISOString()}/> · ET first; secondary clock UTC+8.</small>
   <p className={s.delta}>Since the last edition: no verified claim-level delta available.</p>
  </header>
  <div className={s.topics}>{topics.map((t,i)=><article className={i===0?s.lead:s.topic} key={t.id}>
    <p className={s.kicker}>{String(i+1).padStart(2,'0')} / {t.status}</p>
    <h2><Link href={t.href?reader+t.href:t.sourceUrl}>{t.title}</Link></h2>
    <p>{t.status==='NEW'?t.fact:t.why}</p>
    <small>{t.status==='NEW'?'Source event':'Scheduled'} <DualTimestamp value={t.at.includes('T')?t.at:null} sourceDate={t.at}/></small>
    {t.assets.length?<small>{t.assets.join(' · ')}</small>:null}
    <a className={s.source} href={t.sourceUrl} target="_blank" rel="noreferrer">{t.sourceName} ↗</a>
  </article>)}</div>
  <div className={s.lanes} aria-label="Results and forward catalysts">
   {[{title:'Released · last 7 days',rows:lanes.released},{title:'Next policy & macro · 72h / 7d',rows:lanes.policy},{title:'Upcoming earnings · 7 days',rows:lanes.earnings}].map(l=><section key={l.title}><h2>{l.title}</h2>
    {l.title.startsWith('Released')?earningsResults.map(r=><article className={s.event} key={r.id}><strong>{r.company} · {r.fiscalPeriod}</strong><small>{r.releaseDay} · source date only · {r.basis}</small><p>{r.metrics.filter(m=>m.state==='measured').map(m=>m.name+': '+m.value).join(' · ')}</p><small>ACTUAL REPORTED · CONSENSUS COMPARISON UNAVAILABLE</small><details><summary>Cash flow, spending and outlook</summary><p>{r.beatMiss}</p>{r.metrics.map(m=><p key={m.name}><strong>{m.name}:</strong> {m.value||'Not yet verified'} · {m.comparison||'Comparison unavailable'} {m.note}</p>)}<p>{r.conclusion}</p><p>{r.nextTest}</p><a href={r.sourceUrl}>{r.sourceName} ↗</a></details></article>):null}
    {l.rows.length?l.rows.slice(0,3).map(e=><Event key={e.id} event={e}/>):l.title.startsWith('Released')&&earningsResults.length?null:<p>No qualifying records available. Coverage may be incomplete.</p>}
    {l.rows.length>3?<details><summary>{l.rows.length-3} more events</summary>{l.rows.slice(3).map(e=><Event key={e.id} event={e}/>)}</details>:null}
   </section>)}
  </div>
  {report?<div className={s.explainers}>{topics.map(t=><article key={t.id} id={'topic-'+t.id}><p className={s.kicker}>{t.status} / THE DECIDING QUESTION</p><h2>{t.title}</h2><p>{t.fact}</p><p>{t.mechanism}</p><p><strong>What would change the reading:</strong> {t.test}</p><p>Consensus comparison and independently attributable price reaction are not established by this source summary.</p><details><summary>Source and event clock</summary><DualTimestamp value={t.at.includes('T')?t.at:null} sourceDate={t.at}/><p><a href={t.sourceUrl}>{t.sourceName}</a></p></details></article>)}</div>:<p><Link href={blueDeskPublicHref('/blue-desk/daily-report',host)}>Read the Daily Report →</Link> · <Link href={reader}>Browse Key Stories →</Link></p>}
 </section>;
}
