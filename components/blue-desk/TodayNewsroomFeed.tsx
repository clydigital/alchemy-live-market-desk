import Link from "next/link";
import MarketTakeaway from "./MarketTakeaway";
import type {TodayNewsroomItem} from "@/lib/bluebelly-public-newsroom-feed";
import styles from "./TodayNewsroomFeed.module.css";

function sourceDate(value:string){
 if(/^\d{4}-\d{2}-\d{2}$/.test(value))return value+" · source date";
 const d=new Date(value);
 return Number.isFinite(+d)
  ?new Intl.DateTimeFormat("en-GB",{timeZone:"America/New_York",day:"2-digit",
     month:"short",year:"numeric",hour:"2-digit",minute:"2-digit",timeZoneName:"short"}).format(d)
  :"Original source time unavailable";
}
/** A live read-only view of the same publicly admitted stories as Newsroom.
 * Not an owner research feed and not an independent publication channel.
 */
export default function TodayNewsroomFeed({items,newsroomHref}:{
 items:readonly TodayNewsroomItem[];newsroomHref:string;
}){
 return <section className={styles.section} data-today-newsroom-sync="shared-public-newsroom-feed" aria-labelledby="today-newsroom-updates">
  <div className={styles.header}>
   <div>
    <p className={styles.eyebrow}>TODAY / PUBLISHED NEWSROOM</p>
    <h2 id="today-newsroom-updates">Latest from the Newsroom</h2>
    <p className={styles.subhead}>The same dated, publicly readable articles shown in Newsroom. New editorial updates appear here on page refresh; research drafts and unverified outcomes stay private.</p>
   </div>
   <Link className={styles.all} href={newsroomHref}>All Newsroom stories <span aria-hidden="true">↗</span></Link>
  </div>
  {items.length?<div className={styles.grid}>
   {items.map((entry,index)=><article className={index===0?styles.lead:styles.card} key={entry.id}>
    <div className={styles.meta}>
     <span>{entry.label}</span>
     <time dateTime={entry.sourceAt}>{sourceDate(entry.sourceAt)}</time>
    </div>
    <h3><Link href={entry.readerHref}>{entry.headline}</Link></h3>
    {entry.summary?<p>{entry.summary}</p>:null}
    <MarketTakeaway why={entry.takeawayWhy} nextTest={entry.takeawayTest}
      mode={entry.takeawayWhy&&entry.takeawayTest?"reviewed":entry.id.startsWith("archive:")?"archived":"source-only"} compact/>
    <div className={styles.foot}>
     <Link href={entry.readerHref}>Read analysis <span aria-hidden="true">→</span></Link>
     <a href={entry.sourceUrl} rel="noopener noreferrer" target="_blank">Original: {entry.sourceName} ↗</a>
    </div>
   </article>)}
  </div>:<p className={styles.empty}>No source-qualified Newsroom updates are available in the last seven days. This is a coverage gap, not proof that nothing has happened.</p>}
 </section>;
}
