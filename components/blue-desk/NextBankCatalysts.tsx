import DualTimestamp from "./DualTimestamp";
import type {sourceScheduledBankWatch} from "@/lib/bluebelly-next-bank-catalysts";
import s from "./NextBankCatalysts.module.css";
type Item=ReturnType<typeof sourceScheduledBankWatch>[number];
export default function NextBankCatalysts({items}:{items:readonly Item[]}){
 if(!items.length)return null;
 return <section className={s.panel} data-bank-preview="official-schedule-not-released" aria-label="Next central-bank decisions">
  <header><div><p className={s.kicker}>NEXT POLICY WATCH · ORIGINAL BANK SCHEDULES</p><h2>Not released yet. Here's the test.</h2></div>
   <span>{items.length} scheduled policy event{items.length===1?"":"s"}</span>
  </header>
  <div className={s.grid}>{items.map(item=><article key={item.id}>
    <strong className={s.phase}>{item.phase}</strong>
    <h3>{item.event}</h3>
    {item.scheduledAt?<DualTimestamp value={item.scheduledAt}/>:<p className={s.time}>{item.timeBasis}</p>}
    <p className={s.why}>{item.why}</p>
    <details><summary>How I'd prepare to explain it</summary><p>{item.nextTest}</p>
      <p>Current decision outcome, consensus surprise and price impact are not verified by the schedule.</p></details>
    <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">{item.bank} · official schedule ↗</a>
  </article>)}</div>
 </section>;
}
