import StoryHeroAside from "./StoryHeroAside";
import {ScopeStrip} from "./EntityIdentity";
import BankCountryBall from "./BankCountryBall";
import SourceTweetEmbeds from "./SourceTweetEmbeds";
import type {EmbeddedSocialContext} from "@/lib/bluebelly-event-social";
import type {BankDecisionSnapshot} from "@/lib/bluebelly-bank-decision-snapshots";
import type {ReportedEditorial} from "@/lib/bluebelly-reported-editorial";
import s from "./NewsroomEventReader.module.css";
type Event=
 |{kind:"bank";value:BankDecisionSnapshot}
 |{kind:"reported";value:ReportedEditorial};
export default function NewsroomEventReader({event,backHref,socialPosts=[]}:{
 event:Event;backHref:string;socialPosts?:readonly EmbeddedSocialContext[]
}){
 const bank=event.kind==="bank"?event.value:null;
 const story=event.kind==="reported"?event.value:null;
 const cryptoIncident=story?.kind==="VERIFIED_INCIDENT";
 const serviceIncident=story?.kind==="SERVICE_INCIDENT";
 const incident=cryptoIncident||serviceIncident;
 const title=bank?.headline||story?.headline||"Source-qualified market story";
 const url=bank?.sourceUrl||story?.sourceUrl||"";
 const source=bank?.sourceName||story?.publisher||"";
 const date=bank?.releaseAt||story?.publishedAt||"";
 return <article className={s.page} data-source-gated-reader={bank?"editorial-official-bank":serviceIncident?"official-cloud-service-incident":incident?"official-exchange-incident":"attributed-unconfirmed-report"}>
  <header className={s.hero}>
   <div className={s.heroCopy}>
    <h1>{title}</h1>
    <p className={s.lead}>{bank?.observedStatement||story?.reporting}</p>
    {bank?<div className={s.rateStrip} role="group" aria-label="Policy decision">
      <div><span>POLICY ACTION</span><strong>{bank.decision}</strong></div>
      <div><span>POLICY RATE</span><strong>{bank.rateLabel}</strong></div>
      <div><span>SOURCE STATUS</span><strong>Official statement</strong></div>
     </div>:<div className={s.reportStrip}>{serviceIncident?"Microsoft 365 disruption confirmed · recovery being verified · root cause pending":incident?"Exchange incident confirmed · $6.3bn estimated impact · final net loss unresolved":"Talks reported · Agreement not confirmed · Valuation indicative"}</div>}
   </div>
   <StoryHeroAside
    headline={title} summary={bank?.observedStatement||story?.reporting||""}
    category={bank?"ORIGINAL CENTRAL-BANK STATEMENT · OFFICIAL OUTCOME":serviceIncident?"MICROSOFT SERVICE ADVISORY · RECOVERY IN PROGRESS":incident?"BINANCE ORIGINAL STATEMENT · REUTERS PRICE REPORT":"SECONDARY REPORTING · NOT INDEPENDENTLY CONFIRMED"}
    sourceName={bank?.bank||(serviceIncident?"Microsoft 365 / Exchange Online":incident?"Bitcoin / Binance security":"Reported transaction talks")}
    icon={bank?<BankCountryBall code={bank.countryCode} size="lg" className={s.countryBall}/>:null}
    eventAt={date}
    secondary={bank?"Official statement · price response requires separate evidence":serviceIncident?"Official incident updates; final root cause and full recovery require verification":incident?"Initial company statement; final net loss unresolved":"Reporting only; agreement not confirmed"}
    backHref={backHref} backLabel="Newsroom"
   />
  </header>
  {bank||incident?<div className={s.assetLine}><ScopeStrip assets={bank?bank.affectedAssets:story?.assetNames||[]} label="Markets to monitor"/></div>:null}
  <div className={s.pageSummary} aria-label="Short market explanation">
   <p className={s.readingHint}>THE SHORT VERSION</p>
   <div className={s.story}>
    <section>
     <h2>What happened?</h2>
     <p>{bank?.observedStatement||story?.reporting}</p>
    </section>
    <section>
     <h2>Why does it matter?</h2>
     <p>{bank?.financialMechanism||story?.why}</p>
     <p className={s.boundary}>This is a possible market impact, not proof that prices moved because of this news.</p>
    </section>
    <section>
     <h2>What should I watch next?</h2>
     <p>{bank?.nextTest||story?.nextTest}</p>
    </section>
   </div>
  </div>
  <details className={s.moreDetails}>
   <summary>Read more: risks, evidence and original sources</summary>
   <div className={s.moreBody}>
    <h3>What might change the picture?</h3>
    <p>{bank?.alternative||story?.countercase}</p>
    <h3>What has not been confirmed?</h3>
    <p>{bank?.expectedStatus||(serviceIncident?
     "Microsoft confirms the service disruption and its mitigation updates, but the final root cause, full restoration and financial effects remain unverified.":
     incident?
     "Binance gives its initial estimate; Reuters supplies dated prices. The final net loss, recoveries and the reason for any market move are not established.":
     "The acquisition discussions are reported, not a signed or completed agreement. The purchase price and outcome remain unconfirmed.")}</p>
    <aside className={s.sourceCard}>
     <h3>{bank?"Official bank decision":serviceIncident?"Official service advisory":incident?"Official incident report":"Attributed transaction report"}</h3>
     <p>Use the dated original report below for the figures and wording. Any reaction in stocks, bonds or crypto requires separate price and timing checks.</p>
     <p className={s.source}>
      <a href={url} target="_blank" rel="noopener noreferrer">Original report · {source} ↗</a>
      {incident&&story?.secondarySourceUrl?<a href={story.secondarySourceUrl} target="_blank" rel="noopener noreferrer"> · {story.secondarySourceName||"Independent reporting"} ↗</a>:null}
     </p>
    </aside>
    {bank?<SourceTweetEmbeds posts={socialPosts} sourceLink={bank.sourceUrl}/>:null}
    <p className={s.disclaimer}>This page separates confirmed reports from possible effects. It does not verify that markets reacted because of this event or provide a trading recommendation.</p>
   </div>
  </details>
 </article>;
}
