import Link from "next/link";
import DualTimestamp from "./DualTimestamp";
import EditorialStoryArt from "./EditorialStoryArt";
import type {BankDecisionSnapshot} from "@/lib/bluebelly-bank-decision-snapshots";
import type {ReportedEditorial} from "@/lib/bluebelly-reported-editorial";
import s from "./NewsroomEventReader.module.css";
type Event=
 |{kind:"bank";value:BankDecisionSnapshot}
 |{kind:"reported";value:ReportedEditorial};
export default function NewsroomEventReader({event,backHref}:{event:Event;backHref:string}){
 const bank=event.kind==="bank"?event.value:null;
 const story=event.kind==="reported"?event.value:null;
 const title=bank?.headline||story?.headline||"Source-qualified market story";
 const url=bank?.sourceUrl||story?.sourceUrl||"";
 const source=bank?.sourceName||story?.publisher||"";
 const date=bank?.releaseAt||story?.publishedAt||"";
 return <article className={s.page} data-source-gated-reader={bank?"editorial-official-bank":"attributed-unconfirmed-report"}>
  <Link href={backHref} className={s.back}>← Back to the Newsroom</Link>
  <div className={s.hero}>
   <div><p className={bank?s.verified:s.reported}>{bank?"ORIGINAL CENTRAL-BANK STATEMENT · OFFICIAL OUTCOME":"SECONDARY REPORTING · NOT INDEPENDENTLY CONFIRMED"}</p>
    <h1>{title}</h1><DualTimestamp value={date}/>
    <p className={s.lead}>{bank?.observedStatement||story?.reporting}</p></div>
   <div className={s.art}><EditorialStoryArt headline={title} summary={bank?.observedStatement||story?.reporting||""}/></div>
  </div>
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
  <p className={s.disclaimer}>No verified pre-release consensus comparison, event-window market move or causal price attribution is supplied by this short reader. Recheck the original release and market timestamps before broadcasting a trading conclusion.</p>
 </article>;
}
