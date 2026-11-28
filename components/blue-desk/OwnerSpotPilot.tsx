import type {SpotQuote} from "@/lib/bluebelly-spot-quote-core";
import {myt} from "@/lib/my-desk-health-core";
import s from "./AbsorptionHealth.module.css";
export default function OwnerSpotPilot({quotes}:{quotes:SpotQuote[]}){
 return <section className={s.panel} aria-label="Timestamped spot quote pilot" data-owner-spot-pilot="timestamped">
  <header className={s.head}><div><p className={s.kicker}>PRICE MONITOR · SPOT PILOT</p><h2>Current spot observations</h2></div></header>
  <div className={s.metrics}>{quotes.map(q=><div key={q.symbol} data-quote-state={q.state}>
   <span>{q.symbol} · {q.state==="fresh"?"Recent source quote":q.state==="stale"?"Stale / last known":"Unavailable"}</span>
   <strong>{q.price===null?"—":q.price.toLocaleString("en-GB",{maximumFractionDigits:2})}</strong>
   <span>{q.unit} · {myt(q.asOf)} · <a href={q.sourceUrl}>{q.source}</a></span>
  </div>)}</div>
  <p className={s.note}>Source timestamps, not retrieval clocks. Request-driven cached quotes, not streaming or execution prices. Stale values are not live. Crypto trades continuously; gold follows its own market hours. Closed-session equity histories and ETF proxies are separate. This pilot does not feed EMA or session returns; FX, other commodities and equity quote coverage are not included yet.</p>
 </section>;
}
