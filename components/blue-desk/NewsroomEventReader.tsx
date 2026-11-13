import StorySummaryBoxes from "./StorySummaryBoxes";
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
  <StorySummaryBoxes items={[
   {label:"What changed",text:bank?.observedStatement||story?.reporting||""},
   {label:"How it spreads",text:bank?.financialMechanism||story?.why||""},
   {label:"Market check",text:bank?
    "The official policy outcome is confirmed. This source alone does not establish a price reaction or its cause.":
    serviceIncident?"No outage-specific MSFT market reaction is established without matched-price and benchmark observations.":incident?"Market quotes are dated observations, not a controlled price-causality test.":
    "The reported discussions are not an agreement, and their market effect has not been independently established."},
   {label:"What comes next",text:bank?.nextTest||story?.nextTest||""},
  ]} sourceNote="Original-source facts and conditional interpretations are distinct. The full account and direct evidence links follow."/>
  <h2 className={s.fullStoryTitle}>The full story</h2>
  <div className={s.layout}>
   <div className={s.story}>
    <section><span>01 / THE SCENE</span><h2>What was the question?</h2>
     <p>{bank?"Traders were watching whether policymakers would keep borrowing costs steady or change rates. A decision needs to be compared with expectations; the headline action is only the starting point.":serviceIncident?"When many organisations depend on the same hosted mailbox service, one shared routing failure can disrupt work across regions. The disruption is confirmed, but its precise triggering change and lasting commercial cost are not yet established.":incident?"An exchange security incident can trigger immediate worries over customer funds and forced selling. That is different from proving that every Bitcoin move was caused by the breach.": "A possible acquisition was being discussed in financial reporting, but deal talks, a signed agreement, regulatory approval and a completed acquisition are four different milestones."}</p></section>
    <section><span>02 / THE NEW INFORMATION</span><h2>What the evidence actually says</h2>
     <p>{bank?.observedStatement||story?.reporting}</p>
     <p className={s.boundary}>{bank?.expectedStatus||(serviceIncident?"Microsoft’s EX1550543 service-health notices confirm the incident and describe mitigation, but not a final root-cause determination. The institutional mirror reproduces the notices. No malicious cause, chip expiry, certificate expiry, lost revenue or outage-driven share-price attribution has been established.":incident?"Binance is the primary source for its initial impact estimate and assurance to customers; Reuters is the source for the dated market quotes. The final net loss, full forensic account, actual recoveries and event-window price causation are not yet established.":"This is a reported, unconfirmed transaction discussion. No signed purchase agreement, completion, official valuation or deal certainty is established.")}</p></section>
    <section><span>03 / THE MONEY QUESTION</span><h2>Who wins or loses if this changes?</h2>
     <p>{bank?.financialMechanism||story?.why}</p>
     <p>Related markets and issuers are observation candidates, not instructions to trade and not evidence that prices reacted to this particular report.</p></section>
    <section><span>04 / THE CATCH</span><h2>What would prove this interpretation wrong?</h2>
     <p>{bank?.alternative||story?.countercase}</p></section>
    <section><span>05 / THE NEXT TEST</span><h2>What do I check before presenting?</h2>
     <p>{bank?.nextTest||story?.nextTest}</p>
     <p className={s.source}><a href={url} target="_blank" rel="noopener noreferrer">Read the dated {bank?"original bank statement":serviceIncident?"Microsoft service-health advisory":incident?"official exchange statement":"attributed reporter account"} · {source} ↗</a>{incident&&story?.secondarySourceUrl?<a href={story.secondarySourceUrl} target="_blank" rel="noopener noreferrer"> · {story.secondarySourceName||"Independent reporting"} ↗</a>:null}</p>
    </section>
   </div>
   <aside className={s.sidebar} aria-label="Supporting source and social context">
    <div className={s.sourceCard}>
     <span>REPORTING STANDARD</span>
     <h3>{bank?"Official action confirmed":serviceIncident?"Service incident confirmed; root cause pending":incident?"Initial incident statement confirmed":"Deal talks not confirmed"}</h3>
     <p>{bank?"The policy action and statement are sourced from the bank itself. This does not establish whether the market expected it or how prices moved.":serviceIncident?"Microsoft confirmed the outage and reported mitigation progress. A post-incident analysis, full service restoration and any customer or financial consequences require new evidence.":incident?"Binance confirms its own initial investigation and estimated impact; Reuters separately reports the crypto price snapshot. Neither establishes the precise causal contribution of this incident or the final money recovered.":"The original reporting describes discussions, not a signed or completed transaction. The headline valuation is not a confirmed purchase price."}</p>
     <a href={url} target="_blank" rel="noopener noreferrer">Read dated original evidence ↗</a>
    </div>
    {bank?<SourceTweetEmbeds posts={socialPosts} sourceLink={bank.sourceUrl}/>:null}
   </aside>
  </div>
  <p className={s.disclaimer}>{serviceIncident?"Microsoft service updates are dated, and a full post-incident report is pending. This editorial does not establish an outage-driven stock-price move or a buy recommendation.":incident?"Binance figures are initial company statements; Reuters prices are dated observations, not live quotes or a controlled event study. Do not confuse frozen funds with fully recovered funds.":"No verified pre-release consensus comparison, event-window market move or causal price attribution is supplied by this short reader. Recheck the original release and market timestamps before broadcasting a trading conclusion."}</p>
 </article>;
}
