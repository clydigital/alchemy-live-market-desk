import Link from "next/link";
import {headers} from "next/headers";
import {notFound} from "next/navigation";
import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import {blueDeskPublicHref} from "@/lib/blue-desk-host";
import {featureStories,getFeatureStory} from "@/lib/blue-desk-feature-stories";
import desk from "../../blue-desk.module.css";
import ui from "./feature.module.css";

export const metadata={title:"In-depth Market Features | Bluebelly",description:"Source-grounded editorial investigations of Asian equity markets and the global sovereign-bond market."};
export function generateStaticParams(){return Object.keys(featureStories).map(slug=>({slug}));}
export default async function FeatureStoryPage({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;
 const feature=getFeatureStory(slug);
 if(!feature)notFound();
 const host=(await headers()).get("host");
 const other=slug==="global-bonds"?featureStories["asia-equities"]:featureStories["global-bonds"];
 const featureUrl=(id:string)=>blueDeskPublicHref("/blue-desk/features/"+id,host);
 return <main className={desk.page} data-feature-story={feature.slug} data-evidence-status="independent-editorial-not-canonical">
  <BlueDeskHeader activePath="/blue-desk/key-stories"/>
  <div className={desk.content}>
   <div className={ui.breadcrumb}>
    <Link href={blueDeskPublicHref("/blue-desk",host)}>Live Market</Link>
    <span aria-hidden> / </span>
    <Link href={blueDeskPublicHref("/blue-desk/key-stories",host)}>Key Stories</Link>
    <span aria-hidden> / </span>
    <span>{feature.slug==="global-bonds"?"Global Bonds":"Asia Equities"}</span>
   </div>
   <header className={ui.hero}>
    <p className={ui.kicker}>{feature.tagline}</p>
    <h1>{feature.title}</h1>
    <p className={ui.deck}>{feature.deck}</p>
    <p className={ui.asof}>Research as of {feature.asOf} · Not live data · No automated canonical Story adjudication</p>
    <nav className={ui.heroActions} aria-label="Related features">
     <a href="#the-story">Read the investigation</a>
     <a href="#manual-research">Manual research</a>
     <Link href={featureUrl(other.slug)}>Other story: {other.slug==="global-bonds"?"Global Bonds":"Asia"}</Link>
    </nav>
   </header>
   <section className={ui.summary} aria-labelledby="editorial-thesis">
    <div><p className={ui.kicker}>THE QUESTION WE ARE TESTING</p><h2 id="editorial-thesis">The working interpretation</h2>
    <p>{feature.thesis}</p><small>{feature.confidence}</small></div>
   </section>
   <section className={ui.facts} aria-label="Source-dated market facts">
    {feature.facts.map(f=><article className={ui.fact} key={f.label+f.detail}>
      <span>{f.label}</span><strong>{f.value}</strong><small>{f.detail}</small>
      <div>{f.sourceIds.map(i=><a key={i} href={feature.sources[i].url} target="_blank" rel="noopener noreferrer">[{i+1}]</a>)}</div>
    </article>)}
   </section>
   <div className={ui.columns}>
    <article id="the-story" className={ui.reading}>
     <h2>How the story developed</h2>
     <p className={ui.intro}>The following acts follow the verified historical sequence or dated source observations. Explanations are hypotheses unless explicitly supported by the original release or market tape.</p>
     {feature.scenes.map((scene,i)=><section className={ui.scene} key={scene.title} id={"act-"+(i+1)}>
       <p className={ui.sceneClock}>{scene.time}</p>
       <h3>{scene.title}</h3>
       {scene.paragraphs.map((p,j)=><p key={j}>{p}</p>)}
       {scene.lesson?<aside className={ui.lesson} aria-label={"Learning moment: "+scene.lesson.question}>
        <span className={ui.lessonLabel}>THE LEARNING MOMENT</span>
        <h4>{scene.lesson.question}</h4>
        <p>{scene.lesson.answer}</p>
        <p><strong>The catch:</strong> {scene.lesson.counter}</p>
        <p><strong>Market test:</strong> {scene.lesson.check}</p>
       </aside>:null}
       <div className={ui.cites}>Sources: {scene.sourceIds.map(id=><a key={id} href={feature.sources[id].url} target="_blank" rel="noopener noreferrer">[{id+1}] {feature.sources[id].label}</a>)}</div>
     </section>)}
    </article>
    <aside className={ui.rail}>
      <div className={ui.railInner}><h2>Inside this story</h2>
       <nav aria-label="Story chapters">{feature.scenes.map((s,i)=><a href={"#act-"+(i+1)} key={s.title}>{s.title.replace(/Act \d+ — /,"")}</a>)}</nav>
       <a className={ui.railLink} href="#comparison">Comparison</a>
       <a className={ui.railLink} href="#scenarios">Three possible paths</a>
       <a className={ui.railLink} href="#manual-research">Manual research</a>
       <a className={ui.railLink} href="#sources">Source ledger</a>
      </div>
    </aside>
   </div>
   {feature.comparison?<section className={ui.chapter} id="comparison">
    <p className={ui.kicker}>EXPECTED VS ACTUAL · CONTRADICTIONS PRESERVED</p>
    <h2>{feature.comparison.heading}</h2>
    <div className={ui.tableScroll}><table><thead><tr>{feature.comparison.columns.map(x=><th key={x}>{x}</th>)}</tr></thead>
     <tbody>{feature.comparison.rows.map((r,i)=><tr key={i}>{r.map((x,j)=><td key={j}>{x}</td>)}</tr>)}</tbody></table></div>
   </section>:null}
   <section className={ui.chapter} id="scenarios">
    <p className={ui.kicker}>SCENARIO LAB · THESE ARE NOT FORECAST PROBABILITIES</p>
    <h2>What might happen next?</h2>
    <div className={ui.scenarios}>{feature.scenarios.map(s=><article key={s.name}>
      <h3>{s.name}</h3><p><strong>Condition:</strong> {s.condition}</p>
      <p><strong>Implication:</strong> {s.outcome}</p><p><strong>What disproves it:</strong> {s.against}</p>
    </article>)}</div>
   </section>
   <section className={ui.chapter} id="manual-research" data-manual-research="editable-offline-checklist">
     <p className={ui.kicker}>PRESENTER / ANALYST · MANUAL RESEARCH</p>
     <h2>The investigation worksheets</h2>
     <p>These are research prompts for a human analyst, not evidence that live data has been ingested. Copy them into your own research notes, attach official source timestamps, and record the result before changing any thesis.</p>
     <div className={ui.worksheets}>{feature.manual.map((w,i)=><details key={w.name} open={i===0} className={ui.sheet}>
       <summary><span>Investigation {i+1} · {w.name}</span></summary>
       <div className={ui.sheetBody}>
        <h3>{w.question}</h3>
        <ul>{w.tests.map(q=><li key={q}>{q}</li>)}</ul>
        <p><strong>Contradiction to resolve:</strong> {w.contradiction}</p>
        <div className={ui.template} aria-label="Manual note prompts">
          <p><b>Observation and as-of:</b> _____________________</p>
          <p><b>Original URL and publication time:</b> _____________________</p>
          <p><b>Explanation A / explanation B:</b> _____________________</p>
          <p><b>Evidence for / evidence against:</b> _____________________</p>
          <p><b>Current view / confidence / invalidation:</b> _____________________</p>
        </div>
       </div>
      </details>)}</div>
   </section>
   <section className={ui.chapter} id="sources">
    <p className={ui.kicker}>SOURCE LEDGER · DATES & AUTHORITIES</p>
    <h2>Where the observations came from</h2>
    <ol className={ui.sources}>{feature.sources.map((s,i)=><li key={i}>
      <a href={s.url} target="_blank" rel="noopener noreferrer">{s.label}</a>
      <span>{s.date} · {s.kind}</span>
    </li>)}</ol>
    <p className={ui.disclaimer}>This feature is a dated editorial research snapshot. It does not continuously refresh, does not overwrite historical source vintages, and is not equivalent to a System 2-accepted Story or evidence record. Confirm today's levels separately before acting on a technical or investment view.</p>
   </section>
   <nav className={ui.footerActions}><Link href={featureUrl(other.slug)}>Continue to {other.slug==="global-bonds"?"the Global Bonds story":"the Asia markets story"}</Link>
    <Link href={blueDeskPublicHref("/blue-desk/key-stories",host)}>Back to Key Stories</Link>
   </nav>
  </div>
 </main>;
}
