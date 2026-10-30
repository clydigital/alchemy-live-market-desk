import {getRecentVerifiedEarningsScorecards} from "@/lib/blue-desk-earnings-results";
import {getRecentOfficialMacroResults} from "@/lib/blue-desk-official-macro-results";
import {getUnreconciledPublicEarnings} from "@/lib/bluebelly-earnings-coverage";
import type {PostEventRecap} from "@/lib/bluebelly-post-event-recap";
import Link from 'next/link';
import type {NewsBriefV1} from '@/lib/market-brief-news';
import type {PresenterCalendar,PresenterCalendarEvent} from '@/lib/presenter-calendar';
import {decisionTopics,decisionCalendar,calendarOutcome} from '@/lib/bluebelly-decision-brief';
import {selectCrossBankPolicyBridge} from '@/lib/bluebelly-cross-bank-policy-bridge';
import {blueDeskPublicHref} from '@/lib/blue-desk-host';
import DualTimestamp from './DualTimestamp';
import EditorialStoryArt from './EditorialStoryArt';
import PresenterOneMinute from './PresenterOneMinute';
import {buildPresenterOneMinute} from '@/lib/bluebelly-presenter-one-minute';
import s from './DecisionBrief.module.css';
import {identitiesFromAssets} from '@/lib/bluebelly-entity-identity';
import {ScopeStrip,EntityChip} from './EntityIdentity';

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
export default function DecisionBrief({news,recentNews=[],calendar,now,host,report=false,postEventRecaps=[]}:{news:readonly NewsBriefV1[];recentNews?:readonly NewsBriefV1[];calendar:PresenterCalendar;now:Date;host:string|null;report?:boolean;postEventRecaps?:readonly PostEventRecap[]}){
 const topics=decisionTopics(news,calendar,now), lanes=decisionCalendar(calendar,now);
 const crossBank=selectCrossBankPolicyBridge(news,calendar,now);
 const onAir=buildPresenterOneMinute(news,calendar,now);
 const reader=blueDeskPublicHref('/blue-desk/key-stories',host), calendarHref=blueDeskPublicHref('/blue-desk/calendar',host);
 const lead=topics[0];
 const releasedEarnings=getRecentVerifiedEarningsScorecards(now,7);
 const releasedMacro=getRecentOfficialMacroResults(now);
 const missingIssuerResults=report?getUnreconciledPublicEarnings(now):[];
 // Reuse existing public article routes. Prefer approved post-event readers and
 // suppress the duplicate issuer scorecard when the same result is in both feeds.
 const releasedRows=[
  ...postEventRecaps.map(r=>({
   id:"recap:"+r.id,title:r.headline,href:reader+r.detailsHref,at:r.releaseAt,
  })),
  ...releasedMacro.filter(r=>!postEventRecaps.some(post=>post.id===r.id)).map(r=>({
   id:"macro:"+r.id,title:r.title,href:reader+'?brief='+encodeURIComponent(r.id),at:r.releaseAt,
  })),
  ...releasedEarnings.filter(r=>!postEventRecaps.some(post=>post.id===r.id)).map(r=>({
   id:"earnings:"+r.id,title:r.company+' · '+r.fiscalPeriod+' results',
   href:reader+'?brief='+encodeURIComponent(r.id),at:r.releaseDay,
  })),
 ].sort((a,b)=>Date.parse(b.at)-Date.parse(a.at));
 const additional=recentNews.filter(n=>!topics.some(t=>t.href==='?news='+encodeURIComponent(n.id))).slice(0,8);
 // Previously published outcomes were missing from the rolling original-press
 // reader, so show their approved, source-dated Bluebelly articles here too.
 const moreCards=[
  ...postEventRecaps.slice(1).map(r=>({
   id:"recap-"+r.id,headline:r.headline,summary:r.standfirst,occurredAt:r.releaseAt,
   sourceName:r.sourceUrls[0]?.label||r.eventName,href:reader+r.detailsHref,
  })),
  ...additional.map(n=>({
   id:n.id,headline:n.headline,summary:n.summary,occurredAt:n.occurredAt,
   sourceName:n.sourceName,href:reader+'?news='+encodeURIComponent(n.id),
  })),
 ].slice(0,6);
 return <section className={s.brief} data-decision-first="public-v1">
  {!report?<header className={s.homeHero} aria-label="Lead story and decision test">
   <div className={s.homeLead}>
    <svg className={s.homeCircuit} viewBox="0 0 720 420" aria-hidden="true"><path d="M260 363h95l44-44h88l65-65h145M350 390h120l72-72h160M440 190h76l48-48h150M520 52h115l47-47M240 297h105l46-46h90M130 395h163l72-72h95"/><path d="M570 92h40v40h-40zM444 256h36v36h-36zM380 310h31v31h-31z"/><circle cx="563" cy="255" r="6"/><circle cx="455" cy="190" r="6"/></svg>
    <div className={s.homeLabel}><span>01 / THE LEAD STORY</span><span>{lead?.status||'SOURCE COVERAGE'}</span></div>
    <h1>{lead?.title||'What can we verify today?'}</h1>
    <p className={s.homeDeck}>{lead?(lead.status==='UPCOMING'?lead.why:lead.fact):'Current verified coverage is insufficient for a market verdict. Check the source-listed calendar for the next decision.'}</p>
    {lead?<div data-featured-story-sequence="recap-effects-outlook" aria-label="Featured story: recap, market effects and outlook">
     <section><h2>What happened</h2><p>{lead.status==='UPCOMING'?'The event is scheduled; no outcome has been reported.':lead.fact}</p></section>
     <section><h2>What it means for markets</h2><p>{lead.mechanism}</p><small>{lead.id==="ai-cash-selloff-2026-10-30"?"AP's intraday prices are reported observations, not final closing prices or a proven single-cause attribution.":"Market mechanism, not a verified price reaction. Check timestamped market data before attributing a move."}</small></section>
     <section><h2>What comes next</h2><p>{lead.test}</p><small>Conditional test · {lead.status==='UPCOMING'?'Outcome pending':'Reassess as new evidence arrives'} · <DualTimestamp value={lead.at.includes('T')?lead.at:null} sourceDate={lead.at}/></small></section>
    </div>:null}
    <div className={s.homeActions}>{lead?<Link className={s.homePrimary} href={reader+lead.href}>Read the story <span aria-hidden="true">↗</span></Link>:<Link className={s.homePrimary} href={calendarHref}>Check the calendar ↗</Link>}<Link className={s.homeSecondary} href={blueDeskPublicHref('/blue-desk/daily-report',host)}>Read the Daily Report ↗</Link></div>
    <div className={s.homeFoot}>{lead?<span>{lead.status==='UPCOMING'?'SCHEDULED':'SOURCE EVENT'} <DualTimestamp value={lead.at.includes('T')?lead.at:null} sourceDate={lead.at}/></span>:null}<span>Read cutoff <DualTimestamp value={now.toISOString()}/></span></div>
   </div>
   <aside className={s.homeAside} aria-label="Decision and evidence">
    <p className={s.homeOverline}>// THE 60-SECOND MARKET READ</p>
    {lead&&identitiesFromAssets(lead.assets,2).length?<div className={s.homeCast} aria-label="Source-qualified story actors">{identitiesFromAssets(lead.assets,2).map(identity=><EntityChip key={identity.kind+identity.code} identity={identity} size="lg"/>)}<small>Identity markers · not financial evidence</small></div>:null}
    <h2>{lead?.status==='UPCOMING'?'The outcome is still ahead.':'The announcement is the starting point.'}</h2>
    <p className={s.verdict}>{lead?.status==='UPCOMING'?'The outcome is pending. Compare the release with expectations before assigning a market reaction.':lead?.why||'No qualifying lead is available.'}</p>
    <div className={s.homeTest}><p className={s.homeOverline}>WHAT WOULD CHANGE THE VIEW?</p><p className={s.next}>{lead?.test||'Check the source-listed calendar.'}</p></div>
    <details className={s.evidence}><summary>Evidence &amp; limitations</summary><p>Announcements establish events, not investment returns. Independently matched prices and contrary evidence may change the interpretation.</p>{lead?<p>{lead.mechanism}</p>:null}</details>
    {lead?<a className={s.homeSource} href={lead.sourceUrl} target="_blank" rel="noreferrer">{lead.sourceName} ↗</a>:null}
   </aside>
  </header>:<header className={s.header}>
   <div className={s.headlineRow}><svg className={s.circuit} viewBox="0 0 600 400" aria-hidden="true"><path d="M35 320h170l70-70h130l90-90h105M100 370h155l55-55h140l50-50h100M240 200h90l70-70h100l65-65M300 50h100l40 40h160"/><circle cx="275" cy="250" r="7"/><circle cx="400" cy="130" r="7"/><path d="M320 180h40v40h-40zM450 290h35v35h-35z"/></svg>
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
  </header>}
  <PresenterOneMinute brief={onAir} marketsHref={blueDeskPublicHref('/blue-desk/markets',host)}/>
  <div className={s.topics}>{topics.map((t,i)=><article className={i===0?s.lead:s.topic} key={t.id}>
    <p className={s.kicker}>{String(i+1).padStart(2,'0')} / {t.status}</p>
    <div className={s.art}><EditorialStoryArt headline={t.title} summary={t.fact} compact/></div>
    <ScopeStrip assets={t.assets} max={2} label="In focus"/><h2><Link href={reader+t.href}>{t.title}</Link></h2>
    <p>{t.status==='UPCOMING'?t.why:t.fact}</p>
    <small>{t.status==='UPCOMING'?'Scheduled':t.status==='FEATURE'?'Dated editorial feature':'Source event'} <DualTimestamp value={t.at.includes('T')?t.at:null} sourceDate={t.at}/></small>
    {t.assets.length?<small>{t.assets.join(' · ')}</small>:null}
    <a className={s.source} href={t.sourceUrl} target="_blank" rel="noreferrer">{t.sourceName} ↗</a>
  </article>)}</div>
  <div className={s.lanes} aria-label="Results and forward catalysts">
   <section data-bluebelly-released-reading="links-only">
    <h2>Released · last 7 days</h2>
    {releasedRows.length ? <ul className={s.releasedList}>
      {releasedRows.map(r=><li className={s.releasedRow} key={r.id}>
        <Link className={s.releasedLink} href={r.href} title={r.title}>{r.title}</Link>
      </li>)}
    </ul>:<p>No qualifying published results in the last seven days.</p>}
   </section>
   {[{title:"Next policy & macro · 72h / 7d",rows:lanes.policy},{title:"Upcoming earnings · 7 days",rows:lanes.earnings}].map(l=><section key={l.title}><h2>{l.title}</h2>
    {l.rows.length?l.rows.slice(0,3).map(e=><Event key={e.id} event={e}/>):<p>No qualifying records available. Coverage may be incomplete.</p>}
    {l.rows.length>3?<details><summary>{l.rows.length-3} more events</summary>{l.rows.slice(3).map(e=><Event key={e.id} event={e}/>)}</details>:null}
   </section>)}
  </div>
  {report&&missingIssuerResults.length?<details className={s.evidence} data-earnings-coverage-gap="issuer-schedule-reconciliation">
    <summary>Unreconciled issuer results · {missingIssuerResults.map(r=>r.ticker).join(", ")}</summary>
    <p>These issuer-announced reporting dates have passed, but their source-reviewed public result is not yet confirmed. This is a coverage gap, not evidence of an earnings miss.</p>
    {missingIssuerResults.map(r=><p key={r.ticker+r.quarter}>{r.company} · {r.quarter} · <a href={r.originalScheduleUrl} target="_blank" rel="noopener noreferrer">Original issuer announcement</a></p>)}
   </details>:null}
  {moreCards.length ? <section className={s.latest} aria-label="More recent verified reports">
   <div className={s.latestHead}><div><p className={s.kicker}>RECENT ORIGINAL SOURCES / SEVEN-DAY WINDOW</p><h2>More news, with a quick explanation</h2></div><small>Earlier releases are dated, not presented as breaking news.</small></div>
   <div className={s.latestGrid}>{moreCards.map(n=><article key={n.id} className={s.latestCard}>
    <div className={s.latestArt}><EditorialStoryArt headline={n.headline} summary={n.summary} compact/></div>
    <div><p className={s.kicker}>{+now-Date.parse(n.occurredAt)>48*3600000?'EARLIER THIS WEEK':'VERIFIED NEWS'}</p>
    <h3><Link href={n.href}>{n.headline}</Link></h3>
    <small><DualTimestamp value={n.occurredAt.includes("T")?n.occurredAt:null} sourceDate={n.occurredAt}/></small>
    <p><Link href={n.href}>Read Bluebelly recap →</Link></p>
    <small>Source: {n.sourceName}</small></div>
   </article>)}</div>
  </section>:null}
  {report?<div className={s.explainers}>{topics.map(t=><article key={t.id} id={'topic-'+t.id}><p className={s.kicker}>{t.status} / THE DECIDING QUESTION</p><h2>{t.title}</h2><p>{t.fact}</p><p>{t.mechanism}</p><p><strong>What would change the reading:</strong> {t.test}</p><p>Consensus comparison and independently attributable price reaction are not established by this source summary.</p><details><summary>Source and event clock</summary><DualTimestamp value={t.at.includes('T')?t.at:null} sourceDate={t.at}/><p><a href={t.sourceUrl}>{t.sourceName}</a></p></details></article>)}</div>:<p><Link href={blueDeskPublicHref('/blue-desk/daily-report',host)}>Read the Daily Report →</Link> · <Link href={reader}>Browse Key Stories →</Link></p>}
 </section>;
}
