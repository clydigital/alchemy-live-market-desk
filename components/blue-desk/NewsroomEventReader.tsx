import Link from "next/link";
import DualTimestamp from "./DualTimestamp";
import EditorialStoryArt from "./EditorialStoryArt";
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
 const title=bank?.headline||story?.headline||"Source-qualified market story";
 const url=bank?.sourceUrl||story?.sourceUrl||"";
 const source=bank?.sourceName||story?.publisher||"";
 const date=bank?.releaseAt||story?.publishedAt||"";
 return <article className={s.page} data-source-gated-reader={bank?"editorial-official-bank":"attributed-unconfirmed-report"}>
  <nav className={s.crumb} aria-label="Article location">
   <Link href={backHref} className={s.back}>← Newsroom</Link>
   <span aria-hidden="true">/</span><span>{bank?"Central banks":"Developing reports"}</span>
  </nav>
  <header className={s.hero}>
   <div className={s.heroCopy}>
    <div className={s.topicLine}>
     {bank?<BankCountryBall code={bank.countryCode} size="lg" className={s.countryBall}/>
       :<span className={s.reportIcon} aria-label="Unconfirmed cross-border deal" role="img">?</span>}
     <div className={s.topicInfo}>
      <p className={bank?s.verified:s.reported}>{bank?"ORIGINAL CENTRAL-BANK STATEMENT · OFFICIAL OUTCOME":"SECONDARY REPORTING · NOT INDEPENDENTLY CONFIRMED"}</p>
      <strong>{bank?.bank||"Reported transaction talks"}</strong>
     </div>
    </div>
    <h1>{title}</h1>
    <div className={s.heroClock}><DualTimestamp value={date}/></div>
    <p className={s.lead}>{bank?.observedStatement||story?.reporting}</p>
    {bank?<div className={s.rateStrip} role="group" aria-label="Policy decision">
      <div><span>POLICY ACTION</span><strong>{bank.decision}</strong></div>
      <div><span>POLICY RATE</span><strong>{bank.rateLabel}</strong></div>
      <div><span>SOURCE STATUS</span><strong>Official statement</strong></div>
     </div>:<div className={s.reportStrip}>Talks reported · Agreement not confirmed · Valuation indicative</div>}
   </div>
   <div className={s.art}>
    <EditorialStoryArt headline={title} summary={bank?.observedStatement||story?.reporting||""}/>
    <p>Bluebelly vector illustration · not a price chart</p>
   </div>
  </header>
  {bank?<div className={s.assetLine}><ScopeStrip assets={bank.affectedAssets} label="Markets to monitor"/></div>:null}
  <div className={s.layout}>
   <div className={s.story}>
    <section><span>01 / THE SCENE</span><h2>What was the question?</h2>
     <p>{bank?"Traders were watching whether policymakers would keep borrowing costs steady or change rates. A decision needs to be compared with expectations; the headline action is only the starting point.":"A possible acquisition was being discussed in financial reporting, but deal talks, a signed agreement, regulatory approval and a completed acquisition are four different milestones."}</p></section>
    <section><span>02 / THE NEW INFORMATION</span><h2>What the evidence actually says</h2>
     <p>{bank?.observedStatement||story?.reporting}</p>
     <p className={s.boundary}>{bank?.expectedStatus||"This is a reported, unconfirmed transaction discussion. No signed purchase agreement, completion, official valuation or deal certainty is established."}</p></section>
    <section><span>03 / THE MONEY QUESTION</span><h2>Who wins or loses if this changes?</h2>
     <p>{bank?.financialMechanism||story?.why}</p>
     <p>Related markets and issuers are observation candidates, not instructions to trade and not evidence that prices reacted to this particular report.</p></section>
    <section><span>04 / THE CATCH</span><h2>What would prove this interpretation wrong?</h2>
     <p>{bank?.alternative||story?.countercase}</p></section>
    <section><span>05 / THE NEXT TEST</span><h2>What do I check before presenting?</h2>
     <p>{bank?.nextTest||story?.nextTest}</p>
     <p className={s.source}><a href={url} target="_blank" rel="noopener noreferrer">Read the dated {bank?"original bank statement":"attributed reporter account"} · {source} ↗</a></p>
    </section>
   </div>
   <aside className={s.sidebar} aria-label="Supporting source and social context">
    <div className={s.sourceCard}>
     <span>REPORTING STANDARD</span>
     <h3>{bank?"Official action confirmed":"Deal talks not confirmed"}</h3>
     <p>{bank?"The policy action and statement are sourced from the bank itself. This does not establish whether the market expected it or how prices moved.":"The original reporting describes discussions, not a signed or completed transaction. The headline valuation is not a confirmed purchase price."}</p>
     <a href={url} target="_blank" rel="noopener noreferrer">Read dated original evidence ↗</a>
    </div>
    {bank?<SourceTweetEmbeds posts={socialPosts} sourceLink={bank.sourceUrl}/>:null}
   </aside>
  </div>
  <p className={s.disclaimer}>No verified pre-release consensus comparison, event-window market move or causal price attribution is supplied by this short reader. Recheck the original release and market timestamps before broadcasting a trading conclusion.</p>
 </article>;
}
