import Link from "next/link";
import {headers} from "next/headers";
import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import {blueDeskPublicHref} from "@/lib/blue-desk-host";
import {PILLARS} from "@/lib/bluebelly-recession-watch";
import {getRecessionWatch} from "@/lib/bluebelly-recession-watch-server";
import desk from "../../blue-desk.module.css";
import ui from "./recession.module.css";
export const dynamic="force-dynamic";
export const metadata={title:"Recession Watch | Bluebelly",description:"Source-dated economic contraction indicators, not a stock market crash prediction."};
export default async function RecessionWatch(){
 const host=(await headers()).get("host");
 const data=await getRecessionWatch();
 const fmt=(v:number)=>v.toLocaleString("en-US",{maximumFractionDigits:3});
 return <main className={desk.page}><BlueDeskHeader activePath="/blue-desk/regime-watch"/><div className={desk.content}>
 <header className={ui.hero}><p>REGIME WATCH / GROWTH RISK</p><h1>Recession Watch.</h1><p>Separate market deleveraging from broad economic contraction. A market sell-off or an inverted curve is not a recession verdict.</p></header>
 <section className={ui.summary}><div><strong>{data.coverage.observed}/{data.coverage.configured}</strong><small>Connected indicators inside provisional period-age window</small></div><div><strong>{data.core.eligible?data.core.negative+"/"+data.core.eligible:"Not verified"}</strong><small>Observed NBER core series declining over three months; {data.core.eligible}/{data.core.total} eligible</small></div><div><strong>Not assessed automatically</strong><small>No calibrated probability or official recession dating</small></div></section>
 <p>As of {data.asOf}. {data.coverage.registered} registered indicators; unconnected and aged series remain visible. Observation dates are not release timestamps. Current FRED vintage may contain revisions; not an ALFRED backtest. Period-age windows are provisional, not proof of latest release coverage.</p>
 <nav className={ui.nav}>{PILLARS.map((p,i)=><a key={p} href={"#pillar-"+i}>{p}</a>)}</nav>
 {PILLARS.map((pillar,i)=><section key={pillar} id={"pillar-"+i}><h2>{pillar}</h2><div className={ui.grid}>{data.rows.filter(r=>r.pillar===pillar).map(r=><article key={r.id} className={ui.card}><small>{r.role} · {r.frequency} · {r.state.replaceAll("_"," ")}</small><h3>{r.name}</h3><p className={ui.value}>{r.latest?fmt(r.latest.value)+" "+r.unit:"Not verified"}</p>{r.latest&&<><p>Period {r.latest.date}; previous {r.previous?fmt(r.previous.value)+" ("+r.previous.date+")":"not established"}</p><small>Vintage {r.latest.realtimeStart}–{r.latest.realtimeEnd}; retrieved {r.retrievedAt}</small>{r.threeMonthChange!==null&&<p>Three-month level change: {fmt(r.threeMonthChange)}%</p>}{r.threshold&&<p><strong>{r.threshold}</strong></p>}{r.history.length>1&&<details><summary>Recent dated observations ({r.history.length})</summary><table><tbody>{r.history.map(o=><tr key={o.date}><th scope="row">{o.date}</th><td>{fmt(o.value)}</td></tr>)}</tbody></table></details>}</>}<p>{r.note}</p>{r.missingReason&&<p><strong>{r.missingReason}</strong></p>}<a href={r.sourceUrl} rel="noreferrer">Original series / source</a></article>)}</div></section>)}
 <section className={ui.card}><h2>Competing scenarios</h2><p><strong>Equity deleveraging:</strong> compare broad labour and real activity against market weakness.</p><p><strong>Sector-specific contraction:</strong> compare issuer cash flows, funding and orders against broad credit.</p><p><strong>Broad recession risk:</strong> look for persistent, widespread declines in income, employment, spending, sales and production. The six-series count is descriptive, not an NBER rule.</p><p><a href="https://www.nber.org/research/business-cycle-dating">NBER dating methodology</a> · <a href="https://alfred.stlouisfed.org/">ALFRED vintage research</a> · <Link href={blueDeskPublicHref("/blue-desk/regime-watch",host)}>Back to Regime Watch</Link></p></section>
 </div></main>;
}
