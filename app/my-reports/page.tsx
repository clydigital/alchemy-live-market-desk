import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import Link from "next/link";
import OwnerAutomaticReportReader from "@/components/blue-desk/OwnerAutomaticReportReader";
import OwnerEditorialSlatePdfReader from "@/components/blue-desk/OwnerEditorialSlatePdfReader";
import OwnerPrivatePdfInputHealth from "@/components/blue-desk/OwnerPrivatePdfInputHealth";
import styles from "@/app/blue-desk/blue-desk.module.css";
import layout from "./my-desk.module.css";

const DRIVE_FOLDER="https://drive.google.com/drive/folders/19r-RATOo0vn89FDzs4UZBptPpm1Z9w5L";
const PAGE_SIZE=2;
const CATEGORIES=[
 {id:"all",title:"All editions",description:"Latest editions across the three private report collections."},
 {id:"market",title:"Market briefs",description:"Verified events in chronological chapters, mechanics, market response or UNKNOWN, and what the next facts must show."},
 {id:"angles",title:"Article angles",description:"Three fully developed OB/COTD choices: proposed headline, narrative arc, worked mechanism, chart plan, countercase and editorial readiness."},
 {id:"creators",title:"Creator batches",description:"One creator per report, bundling multiple eligible transcript-backed videos and explaining how their thesis changes."}
] as const;
type Categ=(typeof CATEGORIES)[number]["id"];
const EDITIONS=[
 {id:"16CKyy1JOrBWHdl93uFo8_dOY2oiZ2f61",kind:"market",edition:"27 Oct 2026",title:"The AI Buildout Finds Its Bankers",description:"Broadcom–Anthropic financing, Meta issuance and BOJ services-price puzzle; source-checked pilot.",sourceState:"Issuer/central-bank primary sources · market reaction UNKNOWN"},
 {id:"1oWPq5wrhlpmaK2sP7tsBfAT000kmteaI",kind:"angles",edition:"27 Oct 2026",title:"Three OB/COTD angles — expanded",description:"Ranked Broadcom, Meta and BOJ writing opportunities with missing market-evidence gates.",sourceState:"Original 09:00 slate partial · later Meta pricing separately checked"},
 {id:"1oFv-vay4nlg85FgGWtbSOnxP4WrHbQVR",kind:"angles",edition:"27 Oct 2026",title:"What the live news audit found",description:"Source-first editorial shortlist, Anthropic SEC filing challenger, oil reversal and future-dated ingestion warnings.",sourceState:"Audit only; read-only live database/source checks"},
 {id:"1ca425cmHacpdGtlebVSAdjh3q_s9lOUd",kind:"creators",edition:"22–26 Oct 2026",title:"StockedUp: From Panic to the AI Funding Fork",description:"Three Supadata transcript-backed videos, same creator, chronological reasoning and unresolved claims.",sourceState:"Creator opinions attributed · no canonical market verification"}
] as const;
const pageHref=(type:Categ,page:number)=>"/my-reports?"+(type==="all"?"":"type="+type+"&")+"page="+page;

export const dynamic="force-dynamic";
export const revalidate=0;
export const metadata={title:"My Desk | Bluebelly",robots:{index:false,follow:false}};

/** Owner HTML-first Drive editions. Legacy private PDF endpoints remain available
 * only within the expandable compatibility area, retaining all auth checks. */
export default async function MyBluebellyReports({searchParams}:{searchParams?:Promise<{type?:string;page?:string}>}){
 const params=await searchParams;
 const activeType:Categ= CATEGORIES.some(c=>c.id===params?.type)?params!.type as Categ:"all";
 const filtered=activeType==="all"?EDITIONS:EDITIONS.filter(e=>e.kind===activeType);
 const pageCount=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));
 const desired=Number(params?.page);
 const currentPage=Number.isInteger(desired)&&desired>=1?Math.min(desired,pageCount):1;
 const selected=filtered.slice((currentPage-1)*PAGE_SIZE,currentPage*PAGE_SIZE);
 return <main className={styles.page} data-bluebelly-my-reports="owner-only"
   data-private-desk="html-first-three-formats">
  <BlueDeskHeader activePath="/my-reports"/>
  <div className={styles.content}>
   <header className={styles.calendarHero}>
    <div>
     <p className={styles.kicker}>PRIVATE / BLUEBELLY</p>
     <h1>My Desk</h1>
     <p className={styles.heroDeck}>HTML-first reading room: longer market stories,
       expanded ranked article decisions, and one grouped narrative per eligible creator.
       Editions live in your private Google Drive, not Vercel file storage.
       Source provenance and missing evidence stay visible.</p>
    </div>
   </header>
   <section className={layout.driveArchive} data-drive-archive="kqdocuments88-html-primary">
     <div className={layout.driveHead}>
       <div>
         <p className={styles.kicker}>PRIVATE EDITIONS · CATEGORY LIBRARY</p>
         <h2>Read, research, reuse</h2>
         <p>Three separate HTML collections. Choose one below to avoid mixing market stories,
           editorial decisions and creator narratives. The documents live in your KQ Google Drive.</p>
       </div>
       <a href={DRIVE_FOLDER} target="_blank" rel="noopener noreferrer">Browse complete Drive archive ↗</a>
     </div>
     <nav className={layout.editionTabs} aria-label="HTML edition categories">
       {CATEGORIES.map(category=><Link key={category.id}
         href={category.id==="all"?"/my-reports":"/my-reports?type="+category.id}
         className={category.id===activeType?layout.editionTabSelected:layout.editionTab}
         aria-current={category.id===activeType?"page":undefined}>
           <span>{category.title}</span><small>{category.id==="all"?EDITIONS.length:EDITIONS.filter(e=>e.kind===category.id).length} editions</small>
         </Link>)}
     </nav>
     <div className={layout.libraryIntro}>
       <h3>{CATEGORIES.find(c=>c.id===activeType)?.title}</h3>
       <p>{CATEGORIES.find(c=>c.id===activeType)?.description}</p>
     </div>
     <div className={layout.driveItems} data-library-kind={activeType}>
       {selected.map(item=><article key={item.id} data-edition-type={item.kind}>
         <p className={layout.editionType}>{CATEGORIES.find(c=>c.id===item.kind)?.title} · {item.edition}</p>
         <strong>{item.title}</strong>
         <span>{item.description}</span>
         <div className={layout.editionMeta}>Source state: {item.sourceState}</div>
         <div>
           <a href={"https://drive.google.com/file/d/"+item.id+"/view?usp=drivesdk"}
             target="_blank" rel="noopener noreferrer">Open HTML ↗</a>
           <a href={"https://drive.google.com/uc?export=download&id="+item.id}
             target="_blank" rel="noopener noreferrer">Download HTML ↗</a>
         </div>
       </article>)}
     </div>
     <nav className={layout.pagination} aria-label="HTML edition pages" data-library-page={currentPage}>
       <span>Page {currentPage} of {pageCount} · {filtered.length} matching editions</span>
       {currentPage>1?<Link href={pageHref(activeType,currentPage-1)}>← Previous</Link>:<span>Beginning</span>}
       {currentPage<pageCount?<Link href={pageHref(activeType,currentPage+1)}>Next →</Link>:<span>Latest available</span>}
     </nav>
     <p className={layout.driveNote}>These fixed links are real dated 27 October pilot and expanded editions,
       not an automatically updating catalogue. New files remain discoverable from the Drive
       folder until their edition metadata is indexed here. Drive preview may disable interactive
       embeds; download HTML and open it in a browser for the full report. Original PDFs remain
       under legacy reports below; new output is HTML-first.</p>
   </section>
  </div>
  <div className={layout.technical}>
   <details data-my-desk-pdf-legacy="hidden-by-default">
     <summary>Previous PDF editions (legacy)</summary>
     <OwnerAutomaticReportReader/>
     <OwnerEditorialSlatePdfReader/>
   </details>
  </div>
  <div className={layout.technical}>
   <details data-my-desk-technical="collapsed-by-default">
     <summary>Technical input health and missing evidence</summary>
     <OwnerPrivatePdfInputHealth/>
   </details>
  </div>
 </main>;
}
