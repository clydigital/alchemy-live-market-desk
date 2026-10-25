import Link from "next/link";
import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import {listPublishedReports} from "@/lib/editorial-publications-server";
import desk from "../blue-desk.module.css";
import css from "./reports.module.css";
export const dynamic="force-dynamic";
export const metadata={title:"Published Market Reports | Bluebelly",
 description:"Reviewed Opening Bell and Chart of the Day reports with linked PDF editions."};
export default async function ReportsLibrary(){
 const reports=await listPublishedReports(24);
 return <main className={desk.page}>
  <BlueDeskHeader activePath="/blue-desk/reports"/>
  <div className={desk.content}>
   <header className={css.hero}>
    <p className={desk.kicker}>EDITORIAL LIBRARY · IMMUTABLE EDITIONS</p>
    <h1>Market reports</h1>
    <p>Reviewed Opening Bell and Chart of the Day publications.
      Download a fixed PDF edition or read the same approved article online.
      These reports are editorial analyses, not automatic changes to the canonical Dossier.</p>
   </header>
   <section className={css.grid} aria-label="Published reports">
    {reports.length?reports.map(report=>
     <article className={css.card} key={report.id}>
      <span className={css.tag}>{report.kind==="OB"?"OPENING BELL":"CHART OF THE DAY"}</span>
      <h2><Link href={"/reports/"+report.id}>{report.title}</Link></h2>
      <p>{report.excerpt}</p>
      <time dateTime={report.published_at}>{new Date(report.published_at).toLocaleDateString("en-GB",{
       timeZone:"UTC",year:"numeric",month:"short",day:"numeric",
      })} UTC</time>
      <p className={css.links}><Link href={"/reports/"+report.id}>Read report</Link>
       <Link href={"/reports/"+report.id+"/pdf"} target="_blank">Open PDF</Link></p>
     </article>):<p className={css.empty}>
       No reviewed reports have been published yet. Unverified research drafts are not listed here.
     </p>}
   </section>
  </div>
 </main>;
}
