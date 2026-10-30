import Link from "next/link";
import DualTimestamp from "./DualTimestamp";
import EditorialStoryArt from "./EditorialStoryArt";
import BankCountryBall from "./BankCountryBall";
import type {BankDecisionSnapshot} from "@/lib/bluebelly-bank-decision-snapshots";
import type {ReportedEditorial} from "@/lib/bluebelly-reported-editorial";
import s from "./Newsroom48hTimeline.module.css";

export default function Newsroom48hTimeline({
 banks,reports,readerHref
}:{banks:readonly BankDecisionSnapshot[];reports:readonly ReportedEditorial[];readerHref:string}){
 const items=[
 ...banks.map(b=>({id:b.id,at:b.releaseAt,title:b.headline,
  label:"BANK DECISION · OFFICIAL STATEMENT",topic:"CENTRAL BANK",
  detail:b.observedStatement,why:b.financialMechanism,question:b.nextTest,
  sourceName:b.sourceName,sourceUrl:b.sourceUrl,
  href:readerHref+"?policy="+encodeURIComponent(b.id),
  countryCode:b.countryCode as string|null,verified:true})),
 ...reports.map(r=>({id:r.id,at:r.publishedAt,title:r.headline,
  label:r.kind==="VERIFIED_INCIDENT"?"EXCHANGE INCIDENT · OFFICIAL STATEMENT":"REPORTED TALKS · NOT CONFIRMED",topic:r.kind==="VERIFIED_INCIDENT"?"CRYPTO / MARKET REACTION":"DEVELOPING / RUMOUR",
  detail:r.reporting,why:r.why,question:r.nextTest,
  sourceName:r.publisher,sourceUrl:r.sourceUrl,
  href:readerHref+"?reported="+encodeURIComponent(r.id),countryCode:null as string|null,verified:r.kind==="VERIFIED_INCIDENT"}))
 ].sort((a,b)=>Date.parse(b.at)-Date.parse(a.at));
 return <section className={s.section} aria-label="Previous 48 hours market developments" data-newsroom-window="48h">
  <header className={s.heading}><div><p className={s.eyebrow}>THE LAST 48 HOURS · RELEASE-CLOCK ORDER</p>
   <h2>What actually happened</h2>
   <p>Dated source statements and attributed reporting, with market implications clearly separated. A reported price move is not automatically proof of its cause.</p></div>
   <span className={s.count}>{banks.length} official bank decision{banks.length===1?"":"s"} · {reports.length} developing report{reports.length===1?"":"s"}</span>
  </header>
  {items.length?<div className={s.grid}>
   {items.map((item,i)=><article className={s.card} key={item.id}>
    <div className={s.image}><EditorialStoryArt headline={item.title} summary={item.detail} compact/>
     {item.countryCode?<span className={s.countryBadge} data-news-countryball={item.countryCode}>
       <BankCountryBall code={item.countryCode as "US"|"CA"|"NZ"} size="sm"/>
     </span>:null}</div>
    <div className={s.content}>
     <div className={s.labels}><strong className={item.verified?s.verified:s.unconfirmed}>{item.label}</strong><small>{item.topic}</small></div>
     <h3><Link href={item.href}>{item.title}</Link></h3>
     <DualTimestamp value={item.at} className={s.clock}/>
     <p className={s.fact}>{item.detail}</p>
     <p className={s.mechanism}><strong>Why a trader cares:</strong> {item.why}</p>
     <div className={s.actions}><Link href={item.href}>Read the short Bluebelly breakdown →</Link>
      <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">{item.sourceName} ↗</a></div>
    </div>
   </article>)}
  </div>:<p className={s.empty}>No source-qualified bank decisions or attributable developing reports in the rolling 48-hour window. Older dated records remain below; absence of a card is not evidence that nothing happened.</p>}
  <p className={s.footer}>Editorially checked first-party statements and attributed reporting; these are distinct from the canonical, original-RSS-admitted news wire below. Event times are in US Eastern time first. No price reaction or consensus surprise is inferred.</p>
 </section>;
}
