import Link from "next/link";
import {getManualSweeps} from "@/lib/bluebelly-manual-sweeps";
import {NVIDIA_EARNINGS_WATCH as nvidia,nvidiaEventState} from "@/lib/bluebelly-nvidia-earnings-watch";
import {blueDeskPublicHref} from "@/lib/blue-desk-host";
import css from "./CurrentKeyStoriesShelf.module.css";

const feature="nvidia-ceo-earnings-november-2026";
const funding="ai-compute-financing-november-2026";
type Topic="ai"|"breadth"|"energy"|"fed"|"housing";
const selected=[
 {topic:"ai" as Topic,match:"nebius",href:funding,label:"AI CLOUD · CAPACITY"},
 {topic:"ai" as Topic,match:"coreweave",href:funding,label:"AI CLOUD · FINANCING"},
 {topic:"energy" as Topic,match:"siemens-power",href:null,label:"PHYSICAL AI INFRASTRUCTURE"},
 {topic:"breadth" as Topic,match:"msci-november",href:null,label:"INDEX-RELATED SHARE FLOWS"},
 {topic:"fed" as Topic,match:"weekly-initial-claims",href:null,label:"LABOUR · FED"}
] as const;

/** Only editorially committed, source-dated research. This does NOT expose
 * owner Notion, unpublished research, or canonical Regime conclusions. */
export default function CurrentKeyStoriesShelf({now,host}:{now:Date;host:string|null}){
 const root=blueDeskPublicHref("/blue-desk/key-stories",host);
 const notes=selected.flatMap(item=>{
  const found=getManualSweeps(item.topic,now,6).find(s=>s.id.includes(item.match));
  const evidence=found?.findings.find(f=>f.status==="SOURCE_CORROBORATED");
  return found&&evidence?[{...item,id:found.id,title:found.title,date:found.date,finding:evidence}]:[];
 });
 const state=nvidiaEventState(now);
 return <section className={css.shelf} id="key-stories-current" data-key-stories-current="source-reviewed-featured-not-canonical"
  aria-labelledby="current-key-stories-heading">
   <header className={css.heading}>
    <div><span className={css.kicker}>01 / WHAT CHANGED · SOURCE-DATED</span>
     <h2 id="current-key-stories-heading">The stories the market is trying to price</h2>
     <p>Decision first. What it signals, whether uncertainty rises or falls, the effect on supply and demand, and what the tape must confirm.</p>
    </div>
    <Link href={blueDeskPublicHref("/blue-desk/newsroom",host)}>Browse verified Newsroom →</Link>
   </header>
   <article className={css.lead} data-key-story-lead="nvidia-leadership-q3">
    <div>
     <span className={css.kicker}>LEAD / NVIDIA · 12 NOV 2026 ISSUER STATEMENT</span>
     <h3><Link href={root+"?feature="+feature}>Jensen Huang has resigned. Does NVIDIA's AI growth still justify buying the panic?</Link></h3>
     <p>Colette Kress is interim CEO. The leadership decision is now known, but the successor and any changes to customer commitments remain uncertain. NVIDIA's next results must test demand, margin and financing—not just headline EPS.</p>
     <div className={css.leadFacts}>
      <span><strong>$108B ±2%</strong><small>Company Q3 sales guide · not actual</small></span>
      <span><strong>74% ±0.5pp</strong><small>Company Q3 gross margin guide</small></span>
      <span><strong>{state==="UPCOMING"?"17 NOV · US":"RESULTS CHECK DUE"}</strong><small>{state==="UPCOMING"?"Earnings release expected":"Verify original issuer actuals"}</small></span>
     </div>
     <div className={css.actions}>
      <Link className={css.primary} href={root+"?feature="+feature}>Read full NVIDIA Key Story →</Link>
      <Link href={blueDeskPublicHref("/blue-desk/regime-watch/ai",host)+"#nvidia-earnings-decision"}>AI Regime decision view →</Link>
      <a href={nvidia.transition.originalUrl} target="_blank" rel="noopener noreferrer">Original CEO announcement ↗</a>
     </div>
    </div>
    <aside className={css.leadAside}>
     <span>MARKET INTERPRETATION</span>
     <strong>Uncertainty: mixed</strong>
     <p>CEO status resolved. Succession and customer-financing risk remain. No confirmed fall in GPU demand follows from the resignation alone.</p>
     <span>KEY QUESTION</span>
     <p>Can strong actual earnings reduce the governance discount, or will weaker funding economics keep the stock under pressure?</p>
    </aside>
   </article>
   <div className={css.grid} data-key-stories-reviewed-research="labelled-not-promoted">
    {notes.map(item=><article key={item.id} className={css.card}>
      <span className={css.cardMeta}>{item.date} · {item.label} · SOURCE CORROBORATED</span>
      <h3>{item.href?<Link href={root+"?feature="+item.href}>{item.title}</Link>:item.title}</h3>
      <p>{item.finding.reason}</p>
      <p className={css.next}><strong>What changes the view?</strong> {item.finding.nextCheck}</p>
      <div className={css.cardActions}>
       {item.href?<Link href={root+"?feature="+item.href}>Read market mechanism →</Link>:
        <Link href={blueDeskPublicHref("/blue-desk/regime-watch/"+(item.topic==="energy"?"energy":item.topic==="breadth"?"breadth":"fed"),host)}>Explore relevant Regime →</Link>}
       <a href={item.finding.sourceUrl} target="_blank" rel="noopener noreferrer">{item.finding.sourceName} ↗</a>
      </div>
    </article>)}
   </div>
   <nav className={css.deepDive} aria-label="Previously reviewed original-source Key Stories">
     <strong>ALSO RESEARCHED / ORIGINAL-SOURCE DEEP DIVES</strong>
     <Link href={root+"?news=1acd67c7-e804-48bf-9ee7-97a2f96be283"}>EIA: cheaper US gas versus diesel inflation →</Link>
     <Link href={root+"?news=fdddf542-68f9-4576-9fde-812af424c724"}>NVIDIA NVLink Fusion: custom AI chips and networking demand →</Link>
   </nav>
   <p className={css.note}>Research checks here do not constitute published canonical Story or Regime changes. They remain separately sourced from the historical thesis list below. A missing matched market reaction is unmeasured, not a positive or negative surprise.</p>
  </section>;
}
