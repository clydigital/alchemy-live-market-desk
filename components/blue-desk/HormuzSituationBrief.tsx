import Link from "next/link";
import type {PublicResearchFocus} from "@/lib/blue-desk-published-research-focus";
import type {HormuzWireRead} from "@/lib/bluebelly-hormuz-x-wire-server";
import s from "./HormuzSituationBrief.module.css";

type Props={
  reviewed:readonly PublicResearchFocus[];
  wire:HormuzWireRead;
  crossingState:"current"|"stale"|"unavailable";
  crossings:number|null;
  crossingAt:string|null;
  incidentState:"recent"|"stale"|"unavailable";
  reportedIncidents:number|null;
  incidentAt:string|null;
};
const NEGOTIATIONS=/\b(?:iran|iranian|tehran|hormuz|doha|qatar|ceasefire|diplomac|negotiat|peace talks)\b/i;

/** Source-dated situation quick read, not a frozen geopolitical Key Story. */
export default function HormuzSituationBrief({
  reviewed,wire,crossingState,crossings,crossingAt,
  incidentState,reportedIncidents,incidentAt,
}:Props){
  const latest=reviewed.find(item=>NEGOTIATIONS.test(
    [item.headline,item.standfirst,item.whatChanged].join(" ")));
  return <section id="mediation" className={s.brief}
    aria-label="Iran conflict, negotiations and Hormuz situation quick read"
    data-hormuz-situation="source-dated-quick-read">
    <div className={s.heading}>
      <div><p className={s.eyebrow}>IRAN CONFLICT / DIPLOMACY / PHYSICAL EVIDENCE</p>
        <h2>Hormuz situation — quick read</h2>
        <p className={s.intro}>Negotiations and conflict developments first. Shipping flows and X Wire are supporting signals, not proof that a deal has been reached.</p></div>
      <Link href="/newsroom?q=hormuz">More verified news and research →</Link>
    </div>
    <div className={s.columns}>
      <article>
        <h3>Negotiations & conflict</h3>
        {latest ? <>
          <strong>{latest.headline}</strong>
          <p>{latest.standfirst}</p>
          <p className={s.caution}>Owner-reviewed research, not independently confirmed breaking news. Source edition: <time dateTime={latest.sourcePublishedAt}>{latest.sourcePublishedAt.slice(0,10)}</time>.</p>
          <a href={latest.sourcePageUrl} target="_blank" rel="noopener noreferrer">Read dated research and sources ↗</a>
        </> : <>
          <strong>Current negotiation outcome not established here</strong>
          <p>No recent, public-reviewed Iran/Hormuz negotiation update is available in the connected research window. Older proposals must not be reported as today's diplomatic position.</p>
          <Link href="/newsroom?q=iran">Check recent Iran reporting →</Link>
        </>}
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
      <article>
        <h3>X Wire — emerging claims</h3>
        <p className={s.caution}>Unverified public posts from the existing X Wire. A social post does not confirm a ceasefire, diplomatic agreement, attack or supply change.</p>
        {wire.status==="available"?wire.leads.map(lead=><div key={lead.id} className={s.post}>
          <div className={s.postMeta}>@{lead.handle} · <time dateTime={lead.publishedAt}>{lead.publishedAt.slice(0,16).replace("T"," ")} UTC</time></div>
          <p>{lead.excerpt}</p>
          <a href={lead.url} target="_blank" rel="noopener noreferrer">Original X post ↗</a>
        </div>):<p>{wire.status==="unavailable"
          ?"X Wire source unavailable; no claim about recent social activity can be made."
          :"No relevant posts in the available 48-hour discovery window. This does not establish calm."}</p>}
      </article>
    </div>
  </section>;
}
