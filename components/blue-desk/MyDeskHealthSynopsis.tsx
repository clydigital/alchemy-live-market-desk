import {myt,type HealthLane} from "@/lib/my-desk-health-core";
import s from "./AbsorptionHealth.module.css";
const states={healthy:"Healthy",recovered:"Recovered",degraded:"Degraded",failed:"Failed",unknown:"Unknown"} as const;
export default function MyDeskHealthSynopsis({lanes,checkedAt}:{lanes:HealthLane[];checkedAt:string}){
 return <section className={s.panel} aria-label="Daily research health synopsis" data-my-desk-health="receipt-driven">
 <header className={s.head}><div><p className={s.kicker}>DAILY OPERATIONS · MYT</p><h2>Research health synopsis</h2><p>Checked {myt(checkedAt)} · Execution and coverage are independent. Unknown is not healthy.</p></div></header>
 <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%, 290px),1fr))",gap:12}}>
 {lanes.map(r=><article key={r.label} data-health-state={r.state} style={{border:"1px solid currentColor",borderRadius:10,padding:12,overflowWrap:"anywhere"}}>
 <h3 style={{margin:"0 0 6px",fontSize:"1rem"}}>{r.label} · {states[r.state]}</h3>
 <p style={{margin:"4px 0"}}><strong>Execution:</strong> {r.execution}</p>
 <p style={{margin:"4px 0"}}><strong>Coverage:</strong> {r.coverage}</p>
 <p style={{margin:"4px 0"}}><strong>Last attempt:</strong> {myt(r.attempt)}<br/><strong>Last success / receipt:</strong> {myt(r.success)}</p>
 <p style={{margin:"4px 0"}}><strong>Cause:</strong> {r.failure} · <strong>Budget:</strong> {r.budget}</p>
 <p style={{margin:"4px 0"}}><strong>Backup:</strong> {r.backup}</p>
 <p style={{margin:"4px 0"}}><strong>Gaps:</strong> {r.gaps}</p>
 <p style={{margin:"4px 0"}}><strong>Next retry:</strong> {myt(r.retry)}</p>
 </article>)}
 </div></section>;
}
