import {getRecentVerifiedEarningsScorecards} from "@/lib/blue-desk-earnings-results";
import Link from 'next/link';
import type {NewsBriefV1} from '@/lib/market-brief-news';
import type {PresenterCalendar,PresenterCalendarEvent} from '@/lib/presenter-calendar';
import {decisionTopics,decisionCalendar,calendarOutcome} from '@/lib/bluebelly-decision-brief';
import {selectCrossBankPolicyBridge} from '@/lib/bluebelly-cross-bank-policy-bridge';
import {blueDeskPublicHref} from '@/lib/blue-desk-host';
import DualTimestamp from './DualTimestamp';
import EditorialStoryArt from './EditorialStoryArt';
import EarningsEvidenceGraphic from './EarningsEvidenceGraphic';
import PresenterOneMinute from './PresenterOneMinute';
import {buildPresenterOneMinute} from '@/lib/bluebelly-presenter-one-minute';
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
export default function DecisionBrief({news,recentNews=[],calendar,now,host,report=false}:{news:readonly NewsBriefV1[];recentNews?:readonly NewsBriefV1[];calendar:PresenterCalendar;now:Date;host:string|null;report?:boolean}){
 const topics=decisionTopics(news,calendar,now), lanes=decisionCalendar(calendar,now);
 const crossBank=selectCrossBankPolicyBridge(news,calendar,now);
 const onAir=buildPresenterOneMinute(news,calendar,now);
 const reader=blueDeskPublicHref('/blue-desk/key-stories',host), calendarHref=blueDeskPublicHref('/blue-desk/calendar',host);
 const lead=topics[0];
 const earningsResults=getRecentVerifiedEarningsScorecards(now,7);
 const additional=recentNews.filter(n=>!topics.some(t=>t.href==='?news='+encodeURIComponent(n.id))).slice(0,8);
 return <section className={s.brief} data-decision-first="public-v1">
  <header className={s.header}>
   <div className={s.headlineRow}>
    <div>
     <p className={s.kicker}>{report?'DAILY REPORT':'TODAY'} / SOURCE-QUALIFIED BRIEFING</p>
     <h1>{report?'Today’s decisions, explained.':'Market in 30 seconds'}</h1>
    </div>
    <small className={s.cutoff}>Read cutoff <DualTimestamp value={now.toISOString()}/></small>
   </div>
   <p className={s.verdict}>{lead ? <><strong>{lead.status==='UPCOMING'?'Next decision':'Verified development'}: {lead.title}.</strong> <span>{lead.status==='UPCOMING'?'The outcome is pending. Check the release against expectations before assigning a market reaction.':lead.why}</span></> : 'Current verified coverage is insufficient for a market verdict.'}</p>
   <p className={s.next}><strong>What would change the reading:</strong> {lead ? lead.test : 'Check the source-listed calendar below.'}</p>
   {crossBank?<p className={s.next} data-cross-bank-bridge="source-qualified"><strong>Cross-bank question:</strong> {crossBank.question} <span>Next decision <DualTimestamp value={crossBank.nextEvent.scheduledAt}/>.</span></p>:null}
   <details className={s.evidence}><summary>Evidence limits and edition changes</summary>
    <p>Announcements establish events, not investment returns. Independently matched asset prices and contrary evidence may change the interpretation.</p>
    <p>Since the last edition: no verified claim-level delta available.</p>
    {crossBank?<><p data-cross-bank-evidence="source-qualified"><strong>{crossBank.sharedEnergyStatus==='SOURCE_SUMMARIES'?'Shared energy-inflation evidence:':'Policy contrast, cause unverified:'}</strong> {crossBank.explanation}</p><p>{crossBank.nextTest} <DualTimestamp value={crossBank.nextEvent.scheduledAt}/></p><p>Original policy decisions: {crossBank.sources.map(source=><span key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.bank} ({source.action})</a>{" · "}</span>)}</p></>:null}
   </details>
  </header>
  <PresenterOneMinute brief={onAir} marketsHref={blueDeskPublicHref('/blue-desk/markets',host)}/>
  <div className={s.topics}>{topics.map((t,i)=><article className={i===0?s.lead:s.topic} key={t.id}>
    <p className={s.kicker}>{String(i+1).padStart(2,'0')} / {t.status}</p>
    <div className={s.art}><EditorialStoryArt headline={t.title} summary={t.fact} compact/></div>
    <h2><Link href={reader+t.href}>{t.title}</Link></h2>
    <p>{t.status==='UPCOMING'?t.why:t.fact}</p>
    <small>{t.status==='UPCOMING'?'Scheduled':t.status==='FEATURE'?'Dated editorial feature':'Source event'} <DualTimestamp value={t.at.includes('T')?t.at:null} sourceDate={t.at}/></small>
    {t.assets.length?<small>{t.assets.join(' · ')}</small>:null}
    <a className={s.source} href={t.sourceUrl} target="_blank" rel="noreferrer">{t.sourceName} ↗</a>
  </article>)}</div>
  <div className={s.lanes} aria-label="Results and forward catalysts">
   {[{title:'Released · last 7 days',rows:lanes.released},{title:'Next policy & macro · 72h / 7d',rows:lanes.policy},{title:'Upcoming earnings · 7 days',rows:lanes.earnings}].map(l=><section key={l.title}><h2>{l.title}</h2>
    {l.title.startsWith('Released')?earningsResults.map(r=><article className={s.event} key={r.id}><strong>{r.company} · {r.fiscalPeriod}</strong><small>{r.releaseDay} · source date only · {r.basis}</small><p>{r.metrics.filter(m=>m.state==='measured').map(m=>m.name+': '+m.value).join(' · ')}</p><small>ACTUAL REPORTED · CONSENSUS COMPARISON UNAVAILABLE</small><EarningsEvidenceGraphic scorecard={r}/><details><summary>Cash flow, spending and outlook</summary><p>{r.beatMiss}</p>{r.metrics.map(m=><p key={m.name}><strong>{m.name}:</strong> {m.value||'Not yet verified'} · {m.comparison||'Comparison unavailable'} {m.note}</p>)}<p>{r.conclusion}</p><p>{r.nextTest}</p><a href={r.sourceUrl}>{r.sourceName} ↗</a></details></article>):null}
    {l.rows.length?l.rows.slice(0,3).map(e=><Event key={e.id} event={e}/>):l.title.startsWith('Released')&&earningsResults.length?null:<p>No qualifying records available. Coverage may be incomplete.</p>}
    {l.rows.length>3?<details><summary>{l.rows.length-3} more events</summary>{l.rows.slice(3).map(e=><Event key={e.id} event={e}/>)}</details>:null}
   </section>)}
  </div>
  {additional.length ? <section className={s.latest} aria-label="More recent verified reports">
   <div className={s.latestHead}><div><p className={s.kicker}>RECENT ORIGINAL SOURCES / SEVEN-DAY WINDOW</p><h2>More news, with a quick explanation</h2></div><small>Earlier releases are dated, not presented as breaking news.</small></div>
   <div className={s.latestGrid}>{additional.map(n=><article key={n.id} className={s.latestCard}>
    <div className={s.latestArt}><EditorialStoryArt headline={n.headline} summary={n.summary} compact/></div>
    <div><p className={s.kicker}>{+now-Date.parse(n.occurredAt)>48*3600000?'EARLIER THIS WEEK':'VERIFIED NEWS'}</p>
    <h3><Link href={reader+'?news='+encodeURIComponent(n.id)}>{n.headline}</Link></h3>
    <small><DualTimestamp value={n.occurredAt}/></small>
    <p><Link href={reader+'?news='+encodeURIComponent(n.id)}>Read Bluebelly recap →</Link></p>
    <small>Source: {n.sourceName}</small></div>
   </article>)}</div>
  </section>:null}
  {report?<div className={s.explainers}>{topics.map(t=><article key={t.id} id={'topic-'+t.id}><p className={s.kicker}>{t.status} / THE DECIDING QUESTION</p><h2>{t.title}</h2><p>{t.fact}</p><p>{t.mechanism}</p><p><strong>What would change the reading:</strong> {t.test}</p><p>Consensus comparison and independently attributable price reaction are not established by this source summary.</p><details><summary>Source and event clock</summary><DualTimestamp value={t.at.includes('T')?t.at:null} sourceDate={t.at}/><p><a href={t.sourceUrl}>{t.sourceName}</a></p></details></article>)}</div>:<p><Link href={blueDeskPublicHref('/blue-desk/daily-report',host)}>Read the Daily Report →</Link> · <Link href={reader}>Browse Key Stories →</Link></p>}
 </section>;
}
