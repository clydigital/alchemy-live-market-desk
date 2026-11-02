import Link from "next/link";
import type {NewsBriefV1} from "@/lib/market-brief-news";
import type {NewsroomEditorialItem} from "@/lib/bluebelly-newsroom-editorial";
import styles from "./NewsroomReleaseRail.module.css";

const sourceTime=(s:string)=>/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(s)
 ?s+" · source date only":new Intl.DateTimeFormat("en-GB",{
   timeZone:"America/New_York",day:"2-digit",month:"short",year:"numeric",
   hour:"2-digit",minute:"2-digit",timeZoneName:"short",
 }).format(new Date(s));
export default function NewsroomReleaseRail({news,editorials,now,reportHref}:{
 news:readonly NewsBriefV1[];editorials:readonly NewsroomEditorialItem[];
 now:Date;reportHref:string;
}){
 const t=+now,window=48*3600000;
 const eligible=news.filter(x=>x.verification==="SOURCE_VERIFIED"&&
  Number.isFinite(Date.parse(x.occurredAt))&&t>=Date.parse(x.occurredAt)&&t-Date.parse(x.occurredAt)<=window);
 const releases=editorials.filter(e=>e.id.startsWith("earnings-release:")||
  e.id.startsWith("macro-release:")).filter(e=>Number.isFinite(Date.parse(e.occurredAt))&&Date.parse(e.occurredAt)<=t)
  .sort((a,b)=>Date.parse(b.occurredAt)-Date.parse(a.occurredAt)).slice(0,4);
 return <section className={styles.section} aria-labelledby="release-rail-heading"
  data-newsroom-release-rail="qualified-originals-and-reviewed-results">
  <div className={styles.head}>
   <div><p className={styles.kicker}>01 / THE RELEASE DESK</p>
    <h2 id="release-rail-heading">New original reports and verified results</h2>
    <p>Original announcements and independently source-reviewed company/economic results, with their real publication dates. No research lead is promoted here.</p></div>
   <Link href={reportHref}>Today's five-topic market report</Link>
  </div>
  <p className={styles.coverage} role="status">
   <strong>{eligible.length} new original-source announcements qualified within 48 hours.</strong>
   {eligible.length===0?" No newly verified original is currently in the rolling window; earlier reviewed results appear below. This is a coverage status, not proof that nothing happened.": " Open each original report before attributing market moves."}
  </p>
  <div className={styles.grid}>
   {releases.map(release=><article key={release.id}>
    <small>{release.verificationLabel} · {sourceTime(release.occurredAt)}</small>
    <h3><Link href={release.readerHref}>{release.headline}</Link></h3>
    <p>{release.summary}</p>
    <a href={release.sourceUrl} target="_blank" rel="noopener noreferrer">Original: {release.sourceName}</a>
   </article>)}
  </div>
 </section>;
}
