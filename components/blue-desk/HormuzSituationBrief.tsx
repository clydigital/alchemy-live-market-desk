import Link from "next/link";
import type {PublicResearchFocus} from "@/lib/blue-desk-published-research-focus";
import type {NewsBriefV1} from "@/lib/market-brief-news";
import type {TopicInfluenceRead} from "@/lib/bluebelly-topic-influence";
import TopicInfluencePanel from "./TopicInfluencePanel";
import s from "./HormuzSituationBrief.module.css";
import DirectionQuickRead from "./DirectionQuickRead";
import QuestionVerdictCard from "./QuestionVerdictCard";
import {getReviewedQuestions} from "@/lib/bluebelly-question-assessment-reviewed";
import {buildDirectionQuickRead,type DirectionEvidence} from "@/lib/bluebelly-direction-quick-read";
import directionData from "@/data/bluebelly-hormuz-peace-signals.json";
import {isHormuzRelevant} from "@/lib/bluebelly-hormuz-relevance";

type Props={
  newsroomHref:string;
  reviewed:readonly PublicResearchFocus[];
  news:readonly NewsBriefV1[];
  newsCoverageDegraded:boolean;
  wire:TopicInfluenceRead;
  crossingState:"current"|"stale"|"unavailable";
  crossings:number|null;
  crossingAt:string|null;
  incidentState:"recent"|"stale"|"unavailable";
  reportedIncidents:number|null;
  incidentAt:string|null;
};
const RECENT_MS=48*60*60*1000;
const stamp=(value:string)=>value.slice(0,16).replace("T"," ")+" UTC";

/** Source-dated situation quick read, not a frozen geopolitical Key Story. */
export default function HormuzSituationBrief({
  newsroomHref,reviewed,news,newsCoverageDegraded,wire,crossingState,crossings,crossingAt,
  incidentState,reportedIncidents,incidentAt,
}:Props){
  const now=new Date();
  const peace=buildDirectionQuickRead(directionData.signals as DirectionEvidence[],now);
  const verdicts=getReviewedQuestions(["hormuz-peace","hormuz-shipping"],now);
  const verified=news.filter(item=>isHormuzRelevant(item.headline+" "+item.summary))
   .filter(item=>Date.parse(item.occurredAt)<=+now&&+now-Date.parse(item.occurredAt)<RECENT_MS)
   .sort((a,b)=>Date.parse(b.occurredAt)-Date.parse(a.occurredAt));
  const latest=reviewed.find(item=>isHormuzRelevant(
    [item.headline,item.standfirst,item.whatChanged,item.whyItMatters].join(" ")));
  const latestX=wire.x.filter(item=>isHormuzRelevant(item.excerpt))
   .sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt))[0];
  const latestResearchIsRecent=!!latest&&Date.parse(latest.sourcePublishedAt)<=+now&&+now-Date.parse(latest.sourcePublishedAt)<RECENT_MS;
  return <section id="mediation" className={s.brief}
    aria-label="Iran conflict, negotiations and Hormuz situation quick read"
    data-hormuz-situation="source-dated-quick-read">
    <div className={s.heading}>
      <div><p className={s.eyebrow}>IRAN CONFLICT / DIPLOMACY / PHYSICAL EVIDENCE</p>
        <h2>Hormuz situation — quick read</h2>
        <p className={s.intro}>Negotiations and conflict developments first. Verify against vessel crossings and original-source reports.</p></div>
      <Link href={newsroomHref+"?q=hormuz"}>More verified news and research →</Link>
    </div>
    <div className={s.columns}>
      <article>
        <h3>Negotiations & conflict</h3>
        <p className={s.caution} data-hormuz-research-freshness={verified.length?"recent-verified":latestResearchIsRecent?"recent-reviewed":"no-recent-qualified"}>
          {verified.length?`${verified.length} recent source-qualified update(s)` : latestResearchIsRecent?"Recent published research; no recent verified news receipt":"No recent source-qualified update · assessment requires fresh review"} · checked {stamp(wire.checkedAt)}.
          {newsCoverageDegraded?" Verified-news coverage degraded.":""}</p>
        {verified.slice(0,3).map(item=><div key={item.id} className={s.post}>
          <strong>{item.headline}</strong>
          <p>{item.summary}</p>
          <p className={s.caution}>Source-verified reporting · Event time <time dateTime={item.occurredAt}>{stamp(item.occurredAt)}</time>. Does not establish an implemented agreement or verified shipping recovery.</p>
          <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">{item.sourceName} · Original report ↗</a>
        </div>)}
        {latest ? <div className={s.post}>
          <p className={s.caution}>{latestResearchIsRecent?"Published research context":"Older published research · not a current assessment"}</p>
          <strong>{latest.headline}</strong>
          <p>{latest.standfirst}</p>
          <p className={s.caution}>Owner-reviewed research, not independently confirmed breaking news. Source edition: <time dateTime={latest.sourcePublishedAt}>{latest.sourcePublishedAt.slice(0,10)}</time>.</p>
          <a href={latest.sourcePageUrl} target="_blank" rel="noopener noreferrer">Read dated research and sources ↗</a>
        </div> : !verified.length ? <>
          <strong>Current negotiation outcome not established here</strong>
          <p>{newsCoverageDegraded?"Current verified-news coverage is degraded. ":""}No recent source-qualified Iran/Hormuz update was found in the available public reading window. Older proposals must not be reported as today's diplomatic position.</p>
          <Link href={newsroomHref+"?q=iran"}>Check recent Iran reporting →</Link>
        </> : null}
        {latestX?<div className={s.post} data-hormuz-latest-lead="unverified"><p className={s.postMeta}>LATEST X LEAD · UNVERIFIED · {stamp(latestX.publishedAt)}</p>
          <p>{latestX.excerpt}</p><a href={latestX.url} target="_blank" rel="noopener noreferrer">{latestX.sourceName} · Original post ↗</a>
          <p className={s.caution}>A research lead, not an established event or diplomatic position.</p></div>:<p className={s.caution}>X lead coverage: {wire.xState.toLowerCase()}; absence is not proof of no events.</p>}
      </article>
      <article>
        <h3>What is moving?</h3>
        <strong>{crossingState==="current"&&crossings!==null
          ?crossings+" recorded vessel crossings / rolling 24h"
          :crossingState==="stale"?"Shipping reading is stale":"Current vessel crossings unavailable"}</strong>
        <p>{crossingAt?"AIS observation: "+crossingAt+". ":""}Vessel crossings are not verified barrels of oil or proof of safe passage.</p>
        <strong>{incidentState==="recent"&&reportedIncidents!==null
          ?reportedIncidents+" UKMTO-attributed reports / 14d"
          :incidentState==="stale"?"Incident compilation is stale":"Current incident compilation unavailable"}</strong>
        <p className={s.caution}>{incidentAt?"Compiled "+incidentAt+". ":""}Provider-reported incidents require original-notice checks.</p>
        <div className={s.links}><a href="#shipping">Crossings ↗</a><a href="#incidents">Security notices ↗</a><a href="#fuels">Crude & fuels ↗</a></div>
      </article>
      <details className={s.wireDisclosure} data-hormuz-source-detail="collapsed-by-default">
        <summary>
          <strong>X Wire — emerging claims and creator research</strong>
          <span>Source leads and reviewed transcripts · Expand evidence</span>
        </summary>
        <div className={s.wireBody}>
          <p className={s.caution}>Unverified public posts and creator claims can suggest what to check. Neither confirms a ceasefire, diplomatic agreement, attack, supply change or Regime verdict.</p>
          <TopicInfluencePanel input={wire} compact/>
        </div>
      </details>
    </div>
    <details className={s.wireDisclosure} data-hormuz-reviewed-history="dated-only">
      <summary><strong>Reviewed peace and shipping assessments</strong><span>Last source-reviewed judgement; not automatically inferred from headlines · Expand</span></summary>
      <div className={s.wireBody}>
        <div data-hormuz-question-verdicts="peace-and-shipping" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,320px),1fr))",gap:12}}>
          {verdicts.map(item=><QuestionVerdictCard key={item.id} read={item} compact/>)}
        </div>
        <DirectionQuickRead question="Are we getting closer to peace?"
          summary="Reviewed public positions and restraint signals, grouped by 1/3/5 source-publication days. Stale reviews expire; live source receipts above are separate."
          read={peace}/>
      </div>
    </details>
  </section>;
}
