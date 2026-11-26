import type {SecondaryQuote} from "@/lib/bluebelly-secondary-quote-core";
import type {SpotQuote} from "@/lib/bluebelly-spot-quote-core";
import {myt} from "@/lib/my-desk-health-core";
import s from "./AbsorptionHealth.module.css";
export default function OwnerSpotPilot({quotes,secondary,expectedUsClose}:{quotes:SpotQuote[];secondary:SecondaryQuote[];expectedUsClose:string|null}){
 return <section className={s.panel} aria-label="Timestamped spot quote pilot" data-owner-spot-pilot="timestamped">
  <header className={s.head}><div><p className={s.kicker}>PRICE MONITOR · SOURCE TIMESTAMPS</p><h2>Current market quotes</h2></div></header>
  <div className={s.metrics}>{quotes.map(q=><div key={q.symbol} data-quote-state={q.state}>
   <span>{q.symbol} · {q.state==="fresh"?"Recent source quote":q.state==="stale"?"Stale / last known":"Unavailable"}</span>
   <strong>{q.price===null?"—":q.price.toLocaleString("en-GB",{maximumFractionDigits:2})}</strong>
   <span>{q.unit} · {myt(q.asOf)} · <a href={q.sourceUrl}>{q.source}</a></span>
  </div>)}</div>
  <h3>Indicative secondary FX, index and futures quotes</h3>
  <div className={s.metrics}>{secondary.map(q=><div key={q.symbol} data-quote-state={q.state}>
   <span>{q.label} · {q.state==="recent"?"Recent / possibly delayed":q.state==="old"?"Older source quote":"Unavailable"}</span>
   <strong>{q.price===null?"—":q.price.toLocaleString("en-GB",{maximumFractionDigits:q.type==="CURRENCY"?5:3})}</strong>
   <span>{q.unit} · {myt(q.asOf)} · <a href={q.sourceUrl}>Yahoo Finance · secondary</a></span>
  </div>)}</div>
  <p className={s.note}>US cash-equity expected latest completed session: {expectedUsClose??"Unverified"} (exchange calendar; not proof of provider delivery). See Markets for actual observed sessions.</p>
  <p className={s.note}>Source timestamps, not retrieval clocks. Request-driven cached quotes, not streaming or execution prices. Stale values are not live. Crypto trades continuously; gold follows its own market hours. Closed-session equity histories and ETF proxies are separate. Futures are rolling provider tickers, not physical spot or broker CFD prices. Old quotes may reflect a closed session or a delayed source; venue status is not independently verified. These quotes do not feed EMA or session returns. Individual equity intraday quotes and remaining spot crosses are not included.</p>
 </section>;
}
