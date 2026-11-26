import "server-only";
import Link from "next/link";
import type {FourHRead} from "@/lib/bluebelly-4h-levels";
import s from "@/app/power-stack/private-power-stack.module.css";
export default function PowerStackFourHWatch({reads}:{reads:readonly FourHRead[]|null}){
 return <section id="power-stack-4h" className={s.section}>
 <h2>4H tactical watch · Bluebelly shared history</h2>
 <p>One bounded scan of gold, USDJPY, BTCUSD, SPY, QQQ and SMH; an equity selected in the technical deep dive is added automatically. No duplicate feed or scheduled polling. 4H is indicative until exchange-session and chart parity are verified; daily/weekly context remains primary.</p>
 <Link href="/power-stack?fourh=scan#power-stack-4h">Run 4H sweep for all six →</Link>
 {reads?<><p>{reads.filter(r=>r.status==="INDICATIVE").length}/{reads.length} indicative histories · {reads.reduce((n,r)=>n+r.events.length,0)} qualifying indicative events. Approach threshold 1% to the EMA or either edge, with narrowing distance and matching price direction. Break = one completed crossing; hold = three consecutive closes. No events across missing windows.</p>
 {reads.map(r=><details key={r.symbol} open={r.events.length>0}><summary>{r.symbol} · {r.status} · {r.asOf??"No completed window"} · {r.events.length} events</summary><p>Close {r.close?.toFixed(2)??"—"} · {r.sampleCount} bars · {r.gapCount} gaps. {r.reason}</p>{r.events.map(e=><p key={e.period+e.boundary}><strong>{e.kind} · EMA{e.period} {e.boundary} · {e.direction==="up"?"above / upward":"below / downward"}</strong> · level {e.level.toFixed(2)} · distance {e.distancePct.toFixed(2)}% · {e.asOf}</p>)}</details>)}</>:<p>Not checked in this view. Run the shared sweep or select an equity below; a missing read is not a no-signal finding.</p>}
 <Link href="/market-tools?view=technical">Full Technical Watch →</Link></section>;
}
