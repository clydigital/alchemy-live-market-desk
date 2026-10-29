import Link from "next/link";
import {headers} from "next/headers";
import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import EditorialStoryArt from "@/components/blue-desk/EditorialStoryArt";
import DualTimestamp from "@/components/blue-desk/DualTimestamp";
import {getPublicThesisLedger} from "@/lib/blue-desk-thesis-ledger-server";
import {groupPublicResearch} from "@/lib/bluebelly-editorial-architecture";
import {blueDeskPublicHref} from "@/lib/blue-desk-host";
import type {EditorialMotif} from "@/lib/bluebelly-editorial-visuals";
import desk from "../blue-desk.module.css";
import styles from "./regime-watch.module.css";

export const dynamic="force-dynamic";
export const metadata={
 title:"Regime Watch | Bluebelly",
 description:"Nine dedicated research areas, each with historical public Story context and testable questions."
};

export default async function RegimeWatchPage(){
 const now=new Date(),host=(await headers()).get("host");
 const theses=await getPublicThesisLedger(now,38).catch(()=>null);
 const lenses=groupPublicResearch(theses||[]);
 return <main className={desk.page} data-public-regime-watch="historical-story-research-no-verdict">
  <BlueDeskHeader activePath="/blue-desk/regime-watch"/>
  <div className={desk.content}>
   <header className={styles.intro}><span>ONGOING RESEARCH / NOT DAILY REPORTS</span>
    <h1>The market&apos;s bigger stories.</h1>
    <p>Nine persistent research questions, each with a dedicated workspace for recorded hypotheses, conflicting views and the evidence that could change the argument. Public Story snapshots are historical working views, not today&apos;s regime-engine verdicts.</p>
   </header>
   <div className={styles.heading}>
    <h2>Explore a research lens</h2>
    <span>{theses===null?"Public Story coverage unavailable":theses.length+" public Story snapshots"} · Viewed <DualTimestamp value={now.toISOString()}/></span>
   </div>
   <div className={styles.cards}>{lenses.map(lens=>
    <Link key={lens.id} className={styles.card} data-research-lens={lens.id}
     href={blueDeskPublicHref("/blue-desk/regime-watch/"+lens.id,host)}
     aria-label={"Explore "+lens.name+" research"}>
      <div className={styles.art}><EditorialStoryArt headline={lens.name} motif={lens.motif as EditorialMotif} compact/></div>
      <div className={styles.content}>
       <span className={styles.kicker}>{lens.code} · RESEARCH LENS</span>
       <h3>{lens.name}</h3><p>{lens.question}</p>
       <div className={styles.coverage}>{theses===null?"Story coverage unavailable":lens.stories.length+" associated public Story snapshot"+(lens.stories.length===1?"":"s")}</div>
       <span className={styles.open}>Explore research and deciding tests <span aria-hidden="true">→</span></span>
      </div>
    </Link>
   )}</div>
   <section className={styles.transmission}><h2>Cross-regime transmission</h2>
    <p>These research questions often overlap. Follow the mechanism into its own research page, then check the dated observations.</p>
    <div className={styles.pathGrid}>{([
     ["fed","FED → DURATION → CREDIT","Lower policy rates do not necessarily mean cheaper long-term borrowing."],
     ["ai","AI ADOPTION → FINANCING","Growing model usage does not automatically create sufficient free cash flow."],
     ["energy","ENERGY → PRICES → RATES","Crude prices cannot stand in for delivered diesel, LNG or transport costs."],
     ["yen","JAPAN → FUNDING → EQUITIES","Yen funding repricing could transmit across borders; evidence is still needed."]
    ] as const).map(([id,label,copy])=><Link className={styles.path} key={id}
     href={blueDeskPublicHref("/blue-desk/regime-watch/"+id,host)}>
      <span>{label}</span><strong>{copy}</strong><small>Explore lens →</small>
    </Link>)}</div>
   </section>
  </div>
 </main>;
}
