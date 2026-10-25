import Link from "next/link";
import {notFound} from "next/navigation";
import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import {getPublishedReport} from "@/lib/editorial-publications-server";
import {validPublicationId} from "@/lib/editorial-publications";
import desk from "../../blue-desk.module.css";
import css from "../reports.module.css";
export const dynamic="force-dynamic";
export async function generateMetadata({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 const report=validPublicationId(id)?await getPublishedReport(id):null;
 return {title:report?report.title+" | Bluebelly":"Report Not Found | Bluebelly",
  description:report?.meta_description||"Published Bluebelly editorial market report"};
}
export default async function PublishedReportPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 const report=validPublicationId(id)?await getPublishedReport(id):null;
 if(!report)notFound();
 const paragraphs=report.body.split(/\n\s*\n/).map(x=>x.trim()).filter(Boolean);
 return <main className={desk.page}>
  <BlueDeskHeader activePath="/blue-desk/reports"/>
  <article className={css.article}>
   <Link href={report.kind==="DAILY_REPORT"?"/daily-report":"/reports"} className={css.back}>
     ← {report.kind==="DAILY_REPORT"?"Daily Report":"All published reports"}</Link>
   <p className={css.tag}>{report.kind==="OB"?"OPENING BELL":report.kind==="COTD"?"CHART OF THE DAY":"DAILY MARKET REPORT"} · REVIEWED EDITION</p>
   <h1>{report.title}</h1>
   {report.meta_description?<p className={css.deck}>{report.meta_description}</p>:null}
   <p className={css.date}>Published <time dateTime={report.published_at}>
    {new Date(report.published_at).toLocaleString("en-GB",{timeZone:"UTC",dateStyle:"long",timeStyle:"short"})} UTC
   </time></p>
   <p className={css.links}><a href={"/reports/"+report.id+"/pdf"} target="_blank" rel="noopener noreferrer">
    View fixed PDF edition
   </a><a href={"/reports/"+report.id+"/pdf"} download>Download PDF</a></p>
   <div className={css.prose}>
    {paragraphs.map((part,i)=>/^#{1,3}\s/.test(part)?
      <h2 key={i}>{part.replace(/^#{1,3}\s+/,"")}</h2>:
      <p key={i}>{part}</p>)}
   </div>
   <section className={css.sources} aria-label="Original source links">
    <h2>Research references</h2>
    <p>Original publications reviewed by the editor. Interpretation remains distinct from reported facts.</p>
    <ul>{report.source_urls.map(url=>
     <li key={url}><a href={url} target="_blank" rel="noopener noreferrer">{new URL(url).hostname}</a></li>)}</ul>
   </section>
   <p className={css.disclaimer}>Editorial assessment at publication time, not an automatically
    updated market verdict. This page is not a canonical Story thesis-version mutation.</p>
  </article>
 </main>;
}
