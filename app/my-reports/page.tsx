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
 {id:"creators",title:"Creator batches",description:"One creator per report, bundling multiple eligible transcript-backed videos and explaining how their thesis changes."},
 {id:"audits",title:"Source audits",description:"Source-quality and handoff investigations; verified new events versus unverified leads and missing coverage."}
] as const;
type Categ=(typeof CATEGORIES)[number]["id"];
const EDITIONS=[
 {id:"1sgr-FQnXyHglh53hL1n06M88QpUWHGRz",kind:"market",edition:"27 Oct 2026 · Deep V3",title:"The AI Buildout Finds Its Bankers — Deep Edition",description:"Longform Broadcom credit waterfall, Meta's future-settlement cash economics, BOJ SPPI and Anthropic's SEC S-1. Approximately 4,100 words.",sourceState:"Primary SEC/issuer/BOJ sources; price reaction UNKNOWN; recommended deep edition"},
 {id:"15cggQ-TRb4W2Jy4vqjFaXCSJWLVbxbYX",kind:"angles",edition:"27 Oct 2026 · Deep V3",title:"Three Fully Commissioned OB/COTD Angles",description:"Approximately 5,000 words: ranked Broadcom, Meta and BOJ briefs plus the independently sourced Anthropic IPO challenger and comparative publish gates.",sourceState:"Original 09:00 slate retained; later issuer and S-1 source additions clearly distinguished"},
 {id:"15vGOFXyIU2pGCufoR8vR2EjLCfNI1hfI",kind:"creators",edition:"22–26 Oct 2026 · Deep V3",title:"StockedUp — Three Videos, One Evolving Thesis",description:"About 3,800 words: individual transcript context, credit and rate mechanisms, a claim-versus-SEC check, dated chart conditions and a three-path decision tree.",sourceState:"Supadata transcripts (3 video IDs); creator opinion versus original SEC proof separated"},
 {id:"1Ku7KBSLeIQwxB1plXXTrWmdy6YEmPks9",kind:"audits",edition:"27 Oct 2026 · Deep V3",title:"Where the News Selection Actually Broke",description:"About 2,600 words: original-source coverage, Anthropic S-1 handoff, 46/8/38 Gap overflow, five-candidate selection ledger and mechanical acceptance tests.",sourceState:"Fixed 27 Oct source/freshness audit; no synthetic market data"},
 {id:"16aWhqFWKZbglodASWyAUN2gkXDkCjKV1",kind:"market",edition:"27 Oct 2026 · V3 alternative",title:"Daily Market Brief — Alternate V3 Layout",description:"A second rebuilt presentation of the same historical event packet, retained for editing comparison.",sourceState:"Historical edition; same evidence snapshot, not new news"},
 {id:"1SEhaX-h-vSYGpLiHqlnGLKOlGO8f7kPe",kind:"angles",edition:"27 Oct 2026 · V3 alternative",title:"Writing Brain — Alternate V3 Layout",description:"Three original 09:00 slate angles plus the independently sourced SEC contender. Alternate editable layout.",sourceState:"Original three preserved; proposed new candidate not a fourth canonical slate idea"}
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
         <p>Four separate HTML collections. Choose one below to avoid mixing market stories,
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
     <p className={layout.driveNote}>These fixed links are 28 October V3 revisions of the dated 27 October source packet,
       not an automatically updating catalogue. The first four links are recommended deep editions. New files remain discoverable from the Drive
       folder until their edition metadata is indexed here. Drive preview may disable interactive
       embeds; download HTML and open it in a browser for the full report. Original PDFs remain
       under legacy reports below; new output is HTML-first.</p>
   </section>
  </div>

  <div className={styles.content}>
   <section className={layout.driveArchive} data-bluebelly-manual-research="2026-10-27" aria-label="Manual Asia and global bonds research">
     <div className={layout.driveHead}><div>
       <p className={styles.kicker}>MANUAL RESEARCH · SOURCE CHECKS · 27 OCTOBER 2026</p>
       <h2>Bonds, China and the Asian AI trade</h2>
       <p>These investigations are also available as two independent Bluebelly reader stories:
        <Link href="/features/asia-equities">Asia's AI markets</Link> ·
        <Link href="/features/global-bonds">Global Bonds: France and Greece</Link>.
        Their source-linked chapters and worksheet checklists are dated and do not publish a canonical verdict.</p>
       <p>Research notes alongside the private PDF and HTML library. These are dated analyst investigations, not canonical Dossier conclusions or live technical readings.</p>
     </div></div>
     <div className={layout.driveItems}>
      <article><p className={layout.editionType}>01 · CHINA</p>
       <strong>What if the sell-off is valuation, not collapsing industrial profit?</strong>
       <span>September industrial profits rose 14.4% year on year; electronics earnings grew rapidly while domestic-demand sectors diverged. Test STAR50 breadth, earnings revisions and policy support before selecting a cause.</span>
       <div><a href="https://www.xinhuanet.com/fortune/20261027/76a7397c615a47cc96e567ca3de6b964/c.html" target="_blank" rel="noopener noreferrer">Official NBS figures ↗</a></div>
      </article>
      <article><p className={layout.editionType}>02 · KOREA</p>
       <strong>Will the chip rebound survive SK Hynix and Samsung earnings?</strong>
       <span>Q3 GDP increased 1.0% quarter on quarter and 3.4% year on year. Verify memory prices, HBM backlog, 2027 margins and capacity investments in the 28–29 October results.</span>
       <div><a href="https://www.bok.or.kr/eng/bbs/E0000634/view.do?nttId=11065943" target="_blank" rel="noopener noreferrer">Bank of Korea GDP release ↗</a></div>
      </article>
      <article><p className={layout.editionType}>03 · TAIWAN / JAPAN</p>
       <strong>Distinguish realised chip profits from index concentration and FX</strong>
       <span>TSMC reported third-quarter revenue growth of 50.9% in local currency, yet Taiwan corrected from its early-October level. Japan's yen weakened on 27 October; cross-check Nikkei, TOPIX, exporters and JGB yields before blaming the currency.</span>
       <div><a href="https://pr.tsmc.com/schinese/news/3346" target="_blank" rel="noopener noreferrer">TSMC original earnings ↗</a>
        <a href="https://www.twse.com.tw/en/exchangeReport/FMTQIK?date=&amp;response=html" target="_blank" rel="noopener noreferrer">TWSE closing data ↗</a></div>
      </article>
     </div>
     <div className={layout.libraryIntro}>
      <h3>Manual rates evidence queue</h3>
      <p>Record as-of times for US02Y, US10Y, US30Y, real yields, breakevens, investment-grade and high-yield spreads, DXY and USD/JPY. Test the inflation/fiscal-stress explanation against the competing flight-to-safety explanation. Keep pre-event expectation, immediate reaction, close, next-session result and the falsifier separate.</p>
     </div>
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
