import {takeawayExcerpt} from "@/lib/bluebelly-market-takeaway-excerpt";
import styles from "./StorySummaryBoxes.module.css";

export type StorySummaryBox={label:string;text:string};

/** Read-only display of already reviewed editorial fields, never a new claim. */
export default function StorySummaryBoxes({items,sourceNote}:{
 items:readonly StorySummaryBox[];sourceNote?:string;
}){
 const visible=items.filter(item=>item.label.trim()&&item.text.trim()).slice(0,4);
 if(visible.length===0)return null;
 return <section className={styles.summary} aria-label="Story at a glance"
  data-story-summary="boxes-before-full-prose">
   <header className={styles.heading}>
    <div><span>THE SHORT VERSION</span><h2>At a glance</h2></div>
    <p>The essentials first. Detailed evidence and the complete story follow below.</p>
   </header>
   <div className={styles.grid}>
    {visible.map(item=><div key={item.label} className={styles.box}>
     <h3>{item.label}</h3>
     <p>{takeawayExcerpt(item.text,240).preview}</p>
    </div>)}
   </div>
   {sourceNote?<p className={styles.note}>{sourceNote}</p>:null}
  </section>;
}
