import Link from "next/link";
import {headers} from "next/headers";
import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import {blueDeskPublicHref} from "@/lib/blue-desk-host";
import {readBluebellyQualifiedNews} from "@/lib/bluebelly-verified-event-server";
import {INDUSTRY_LENSES,industryNews} from "@/lib/bluebelly-industry-intel";
import {projectIndustryEventThreads} from "@/lib/bluebelly-industry-evidence";
import {COMPARISON_METRICS,selectIndustryPeers} from "@/lib/bluebelly-industry-comparison";
import {readIndustryComparison} from "@/lib/bluebelly-industry-comparison-server";
import layout from "../blue-desk.module.css";
import ui from "./industry.module.css";
export const dynamic="force-dynamic";
export const metadata={title:"Industry Intel | Bluebelly",description:"Industry research questions and related source-qualified news."};
export default async function IndustryIntel({searchParams}:{searchParams?:Promise<{lens?:string;peer?:string|string[]}>}){
 const host=(await headers()).get("host");
 const params=await searchParams;
 const active=INDUSTRY_LENSES.find(l=>l.id===params?.lens);
 const now=new Date();
 const allowed=active?.companies??INDUSTRY_LENSES[0].companies;
 const peers=selectIndustryPeers(allowed,params?.peer);
 const [data,comparison]=await Promise.all([readBluebellyQualifiedNews(now,18).catch(()=>null),readIndustryComparison(peers,now)]);
 const news=data?.news??[];
 const href=blueDeskPublicHref("/blue-desk/industry-intel",host);
 const partial=!data||Object.values(data.sourceReads).some(s=>s!=="READABLE");
 const questions=projectIndustryEventThreads(news,now).filter(q=>!active||q.lenses.some(id=>id===active.id));
 return <main className={layout.page}><BlueDeskHeader activePath="/blue-desk/industry-intel"/><div className={layout.content}>
 <header className={ui.hero}><p>BLUEBELLY / INDUSTRY INTELLIGENCE</p><h1>Industry Intel.</h1><p>What is changing beneath the market? Follow commercial relationships, industry economics and enduring research questions.</p></header>
 <aside className={ui.notice}><strong>Research watch · {partial?"Partial source availability":"Bounded qualified-news view"}</strong><p>Research questions are not confirmed events or recommendations. Related headlines are drawn from the existing bounded news reader; an empty match does not establish that no developments occurred. The private investigation register retains lifecycle history. This public view shows related qualified sources from a bounded seven-day window, not the private register or a complete event history.</p></aside>
 <nav className={ui.filters} aria-label="Industries"><Link href={href} aria-current={!active?"page":undefined}>All industries</Link>{INDUSTRY_LENSES.map(l=><Link key={l.id} href={href+"?lens="+l.id} aria-current={active?.id===l.id?"page":undefined}>{l.title}</Link>)}</nav>
 <h2>Material event research threads</h2><section className={ui.grid}>{questions.map(q=><article key={q.id} id={q.id} className={ui.card}><small>MONITORING QUESTION · {q.companies.join(" / ")}</small><h3>{q.title}</h3><p>{q.question}</p><p><strong>Next test:</strong> {q.next}</p><h4>Companies &amp; relationship hypotheses</h4><ul className={ui.roles}>{q.relationships.map(r=><li key={r.company+"-"+r.role}><strong>{r.company}</strong> · {r.role.replaceAll("_"," ")}<small>{r.qualification}</small></li>)}</ul><h4>Related qualified sources</h4>{q.sources.length?<><small>Latest related source event: {q.latestRelatedEventAt}</small>{q.sources.slice(0,5).map(n=><div key={n.eventKey} className={ui.news}><a href={n.originalUrl} rel="noreferrer">{n.title}</a><small>{n.publisher} · event {n.occurredAt} · source observed {n.sourceObservedAt}</small></div>)}</>:<p className={ui.muted}>No matching source in this bounded window. The research question remains open.</p>}</article>)}</section>
 <section aria-labelledby="fundamental-comparison"><h2 id="fundamental-comparison">Company fundamentals</h2><p>Choose up to six companies from {active?.title??"Semiconductors"}. Each column uses one source-dated fiscal report. Numbers and issuer-reviewed text retain their original units and definitions; no cross-company ranking or implied comparability of adjusted measures.</p>
 <form action={href} method="get" className={ui.peerForm}>{active&&<input type="hidden" name="lens" value={active.id}/>}<fieldset><legend>Company selection</legend><div className={ui.filters}>{allowed.map(t=><label key={t}><input type="checkbox" name="peer" value={t} defaultChecked={peers.includes(t)}/> {t}</label>)}</div></fieldset><button type="submit">Compare selected companies</button></form>
 <aside className={ui.notice}><strong>{comparison.columns.filter(c=>c.state!=="UNAVAILABLE").length}/{comparison.columns.length} with eligible facts or reviewed scorecards</strong><p>{comparison.status==="UNAVAILABLE"?"Persisted issuer data unavailable; dated reviewed scorecards only.":"Existing issuer store read completed; missing fields and companies remain unverified."} Report window: up to 90 days. Read at {comparison.asOf}. No live quotes, peer multiples or valuation estimates established by this reader.</p></aside>
 <div className={ui.tableScroll}><table className={ui.comparisonTable}><thead><tr><th scope="col">Metric</th>{comparison.columns.map(c=><th scope="col" key={c.ticker}><strong>{c.ticker}</strong><small>{c.company}</small><small>{c.fiscalPeriod??"Period unavailable"}</small><small>{c.releaseDay?"Filed/released "+c.releaseDay:"No eligible report"}</small><small>{c.state.replaceAll("_"," ")}</small>{c.sourceUrl&&<a href={c.sourceUrl} rel="noreferrer">Original source</a>}</th>)}</tr></thead><tbody>{COMPARISON_METRICS.map(m=><tr key={m.key}><th scope="row">{m.label}</th>{comparison.columns.map(c=>{const cell=c.cells[m.key];return <td key={c.ticker}>{cell.display??"Not verified"}{cell.basis&&<small>{cell.basis}</small>}{cell.note&&<small>{cell.note}</small>}{cell.sourceUrl&&cell.sourceUrl!==c.sourceUrl&&<a href={cell.sourceUrl} rel="noreferrer">Metric source</a>}</td>;})}</tr>)}<tr><th scope="row">Management outlook</th>{comparison.columns.map(c=><td key={c.ticker}>{c.guidance??"Not verified"}</td>)}</tr><tr><th scope="row">Next research test</th>{comparison.columns.map(c=><td key={c.ticker}>{c.nextTest??"Not verified"}</td>)}</tr></tbody></table></div></section>
 <h2>Industry lenses</h2><section className={ui.grid}>{(active?[active]:INDUSTRY_LENSES).map(l=><article key={l.id} className={ui.card}><small>{l.companies.join(" / ")}</small><h3><Link href={href+"?lens="+l.id}>{l.title}</Link></h3><p>{l.question}</p><p><strong>Monitor:</strong> {l.metrics}</p>{industryNews(l.id,news).slice(0,3).map(n=><div key={n.id} className={ui.news}><a href={n.sourceUrl} rel="noreferrer">{n.headline}</a><small>{n.sourceName} · {n.occurredAt}</small></div>)}</article>)}</section>
 <p><Link href={blueDeskPublicHref("/blue-desk/regime-watch",host)}>Regime Watch →</Link> · <Link href={blueDeskPublicHref("/blue-desk/research",host)}>Research Archive →</Link></p>
 </div></main>;
}
