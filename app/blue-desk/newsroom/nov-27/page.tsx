import Link from "next/link";
import {headers} from "next/headers";
import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import {blueDeskPublicHref} from "@/lib/blue-desk-host";
import {NOV27_EDITORIAL} from "@/lib/bluebelly-nov27-newsroom";
import styles from "../../earnings-week/earnings-week.module.css";
export const dynamic="force-dynamic";
export const metadata={title:"Eight market tests | 27 November 2026 | Bluebelly Newsroom",description:"Dated analysis of AI credit and valuations, growth, Australia, copper, Brent, the yen and euro-area lending."};
export default async function Nov27Edition(){
 const host=(await headers()).get("host");
 return <main className={styles.page} data-newsroom-edition="2026-11-27">
 <BlueDeskHeader activePath="/blue-desk/newsroom"/>
 <article className={styles.body}>
 <nav className={styles.back}><Link href={blueDeskPublicHref("/blue-desk/newsroom",host)}>← Newsroom</Link></nav>
 <header className={styles.hero}><p className={styles.kicker}>BLUEBELLY NEWSROOM / 27 NOVEMBER 2026</p><h1>Eight stories. Eight market tests.</h1><p className={styles.lead}>What changed, why it matters and the levels to watch.</p><p className={styles.dated}>Frozen early 27 November MYT / 26 November ET editorial edition. Copper, yen and oil are pre-event previews, not results. Price references are dated cash, FX or futures observations, not live broker CFD quotes; editorial levels are illustrative, not verified EMA bands.</p></header>
 <nav aria-label="Edition contents" className={styles.themes}>{NOV27_EDITORIAL.map(e=><Link key={e.id} href={"#"+e.id}>{e.market} · {e.title}</Link>)}</nav>
 {NOV27_EDITORIAL.map(e=><section key={e.id} id={e.id} className={styles.section}>
 <p className={styles.kicker}>{e.market} · {["copper","yen","oil"].includes(e.id)?"FROZEN EVENT PREVIEW":"DATED ANALYSIS"}</p>
 <h2>{e.title}</h2><p>{e.summary}</p>
 <div className={styles.themes}>{e.stats.map(([value,label])=><section key={label}><h3>{value}</h3><p>{label}</p></section>)}</div>
 <h3>Why it matters</h3><p>{e.why}</p>
 <div className={styles.themes}><section><h3>Scenario 1</h3><p>{e.bull}</p></section><section><h3>Scenario 2</h3><p>{e.bear}</p></section></div>
 <p><strong>Our view:</strong> {e.view}</p><h3>Levels to watch</h3><p>{e.levels}</p><p><strong>Next test:</strong> {e.test}</p>
 <p><strong>Original sources:</strong> {e.urls.map(([label,url],i)=><span key={url}>{i?" · ":""}<a href={url} target="_blank" rel="noopener noreferrer">{label} ↗</a></span>)}</p>
 </section>)}
 </article></main>;
}
