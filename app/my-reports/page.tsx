import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import OwnerAutomaticReportReader from "@/components/blue-desk/OwnerAutomaticReportReader";
import OwnerEditorialSlatePdfReader from "@/components/blue-desk/OwnerEditorialSlatePdfReader";
import OwnerPrivatePdfInputHealth from "@/components/blue-desk/OwnerPrivatePdfInputHealth";
import styles from "@/app/blue-desk/blue-desk.module.css";
import layout from "./my-desk.module.css";

export const dynamic="force-dynamic";
export const revalidate=0;
export const metadata={title:"My Desk | Bluebelly",robots:{index:false,follow:false}};

/** Owner HTML-first Drive editions. Legacy private PDF endpoints remain available
 * only within the expandable compatibility area, retaining all auth checks. */
export default function MyBluebellyReports(){
 return <main className={styles.page} data-bluebelly-my-reports="owner-only"
   data-private-desk="html-first-three-formats">
  <BlueDeskHeader activePath="/my-reports"/>
  <div className={styles.content}>
   <header className={styles.calendarHero}>
    <div>
     <p className={styles.kicker}>PRIVATE / BLUEBELLY</p>
     <h1>My Desk</h1>
     <p className={styles.heroDeck}>HTML-first reading room: longer market stories,
       ranked writing ideas, and one creator-batch explainer for every eligible creator.
       Editions live in your private Google Drive, not Vercel file storage.
       Source provenance and missing evidence stay visible.</p>
    </div>
   </header>
   <section className={layout.driveArchive} data-drive-archive="kqdocuments88-html-primary">
     <div className={layout.driveHead}>
       <div>
         <p className={styles.kicker}>HTML FIRST · GOOGLE DRIVE · PRIVATE</p>
         <h2>Bluebelly Editions</h2>
         <p>Open and download the HTML file from Drive to use its interactive reader,
            charts, expandable explanations, source cards and optional video or X embeds.
            The links below are fixed pilot editions. Sign in with your authorised KQ Google account.</p>
       </div>
       <a href="https://drive.google.com/drive/folders/19r-RATOo0vn89FDzs4UZBptPpm1Z9w5L"
          target="_blank" rel="noopener noreferrer">Browse dated HTML editions ↗</a>
     </div>
     <div className={layout.driveItems}>
       <article>
         <strong>27 Oct · Daily Market Brief</strong>
         <span>Story-driven · Broadcom, Meta and BOJ · original-source charts and explanations</span>
         <div>
           <a href="https://drive.google.com/file/d/1J3Ay7wxQQYC7BMzAv7nvxYAN9H6_Bzhk/view?usp=drivesdk"
              target="_blank" rel="noopener noreferrer">Open HTML ↗</a>
           <a href="https://drive.google.com/uc?export=download&id=1J3Ay7wxQQYC7BMzAv7nvxYAN9H6_Bzhk"
              target="_blank" rel="noopener noreferrer">Download HTML ↗</a>
         </div>
       </article>
       <article>
         <strong>27 Oct · Three OB/COTD Ideas</strong>
         <span>Three ranked article angles · interactive source and missing-proof panels</span>
         <div>
           <a href="https://drive.google.com/file/d/1kiTU5XOuGCGOWy7RoLQVMoCYEUDR9vPN/view?usp=drivesdk"
              target="_blank" rel="noopener noreferrer">Open HTML ↗</a>
           <a href="https://drive.google.com/uc?export=download&id=1kiTU5XOuGCGOWy7RoLQVMoCYEUDR9vPN"
              target="_blank" rel="noopener noreferrer">Download HTML ↗</a>
         </div>
       </article>
       <article>
         <strong>StockedUp · Three-Video Batch</strong>
         <span>22–26 Oct · creator-thesis timeline, transcript provenance and video embeds</span>
         <div>
           <a href="https://drive.google.com/file/d/1ca425cmHacpdGtlebVSAdjh3q_s9lOUd/view?usp=drivesdk"
              target="_blank" rel="noopener noreferrer">Open HTML ↗</a>
           <a href="https://drive.google.com/uc?export=download&id=1ca425cmHacpdGtlebVSAdjh3q_s9lOUd"
              target="_blank" rel="noopener noreferrer">Download HTML ↗</a>
         </div>
       </article>
     </div>
     <p className={layout.driveNote}>These dated HTML files were created from real source-linked Bluebelly research.
       Creator assertions are attributed, not canonical market evidence. Google Drive's preview may
       block interactive scripts: download and open the HTML in your browser for the complete experience.
       The linked folder is the durable archive for future editions; automatic HTML uploads are not yet verified by a scheduled run.</p>
   </section>
   <div className={layout.focus} aria-label="The three private HTML report types">
     <article>
       <p className={layout.step}>HTML 01 · DAILY MARKET BRIEFING</p>
       <h2>Market stories, explained</h2>
       <p>A chronological explanation of critical sourced events, the financial mechanisms,
         competing possibilities and the next test. Morning and evening editions where
         the existing source gate allows publication.</p>
     </article>
     <article>
       <p className={layout.step}>HTML 02 · WRITING BRAIN</p>
       <h2>Three article opportunities</h2>
       <p>The three ranked OB / COTD angles from the existing scheduled research slate,
         with original URLs, chart questions and missing proof explicitly marked.
         These are ideas, not approved articles or trading calls.</p>
     </article>
     <article>
       <p className={layout.step}>HTML 03 · CREATOR INTELLIGENCE</p>
       <h2>One batch per creator</h2>
       <p>When a creator has several eligible videos, combine them into a single chronological
         Shark Tank-style argument breakdown. Preserve each transcript's original video link,
         what changed, disagreements, verification status and next market test.</p>
     </article>
   </div>
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
