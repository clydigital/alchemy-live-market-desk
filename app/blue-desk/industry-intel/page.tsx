import Link from "next/link";
import {headers} from "next/headers";
import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import {blueDeskPublicHref} from "@/lib/blue-desk-host";
import {readBluebellyQualifiedNews} from "@/lib/bluebelly-verified-event-server";
import {INDUSTRY_LENSES,MATERIAL_RESEARCH_QUESTIONS,industryNews,questionNews} from "@/lib/bluebelly-industry-intel";
import layout from "../blue-desk.module.css";
import ui from "./industry.module.css";
export const dynamic="force-dynamic";
export const metadata={title:"Industry Intel | Bluebelly",description:"Industry research questions and related source-qualified news."};
export default async function IndustryIntel({searchParams}:{searchParams?:Promise<{lens?:string}>}){
 const host=(await headers()).get("host");
 const params=await searchParams;
 const active=INDUSTRY_LENSES.find(l=>l.id===params?.lens);
 const data=await readBluebellyQualifiedNews(new Date(),18).catch(()=>null);
 const news=data?.news??[];
 const href=blueDeskPublicHref("/blue-desk/industry-intel",host);
 const partial=!data||Object.values(data.sourceReads).some(s=>s!=="READABLE");
 const questions=MATERIAL_RESEARCH_QUESTIONS.filter(q=>!active||q.lenses.some(id=>id===active.id));
 return <main className={layout.page}><BlueDeskHeader activePath="/blue-desk/industry-intel"/><div className={layout.content}>
 <header className={ui.hero}><p>BLUEBELLY / INDUSTRY INTELLIGENCE</p><h1>Industry Intel.</h1><p>What is changing beneath the market? Follow commercial relationships, industry economics and enduring research questions.</p></header>
 <aside className={ui.notice}><strong>Research watch · {partial?"Partial source availability":"Bounded qualified-news view"}</strong><p>Research questions are not confirmed events or recommendations. Related headlines are drawn from the existing bounded news reader; an empty match does not establish that no developments occurred. Historical event continuity and financial comparisons are not yet implemented.</p></aside>
 <nav className={ui.filters} aria-label="Industries"><Link href={href} aria-current={!active?"page":undefined}>All industries</Link>{INDUSTRY_LENSES.map(l=><Link key={l.id} href={href+"?lens="+l.id} aria-current={active?.id===l.id?"page":undefined}>{l.title}</Link>)}</nav>
 <h2>Material research questions</h2><section className={ui.grid}>{questions.map(q=>{const related=questionNews(q.id,news);return <article key={q.id} id={q.id} className={ui.card}><small>MONITORING QUESTION · {q.companies.join(" / ")}</small><h3>{q.title}</h3><p>{q.question}</p><p><strong>Next test:</strong> {q.next}</p><h4>Related qualified headlines</h4>{related.length?related.slice(0,3).map(n=><div key={n.id} className={ui.news}><a href={n.sourceUrl} rel="noreferrer">{n.headline}</a><small>{n.sourceName} · {n.occurredAt}</small></div>):<p className={ui.muted}>No matching headline in this bounded reader window.</p>}</article>})}</section>
 <h2>Industry lenses</h2><section className={ui.grid}>{(active?[active]:INDUSTRY_LENSES).map(l=><article key={l.id} className={ui.card}><small>{l.companies.join(" / ")}</small><h3><Link href={href+"?lens="+l.id}>{l.title}</Link></h3><p>{l.question}</p><p><strong>Monitor:</strong> {l.metrics}</p>{industryNews(l.id,news).slice(0,3).map(n=><div key={n.id} className={ui.news}><a href={n.sourceUrl} rel="noreferrer">{n.headline}</a><small>{n.sourceName} · {n.occurredAt}</small></div>)}</article>)}</section>
 <p><Link href={blueDeskPublicHref("/blue-desk/regime-watch",host)}>Regime Watch →</Link> · <Link href={blueDeskPublicHref("/blue-desk/research",host)}>Research Archive →</Link></p>
 </div></main>;
}
