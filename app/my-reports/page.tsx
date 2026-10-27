import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import OwnerAutomaticReportReader from "@/components/blue-desk/OwnerAutomaticReportReader";
import OwnerEditorialSlatePdfReader from "@/components/blue-desk/OwnerEditorialSlatePdfReader";
import OwnerPrivatePdfInputHealth from "@/components/blue-desk/OwnerPrivatePdfInputHealth";
import styles from "@/app/blue-desk/blue-desk.module.css";
import layout from "./my-desk.module.css";

export const dynamic="force-dynamic";
export const revalidate=0;
export const metadata={title:"My Desk | Bluebelly",robots:{index:false,follow:false}};

/** Single owner-only destination for the two existing PDF editions.
 * The route remains behind session and active allowlist middleware; every
 * PDF byte stream retains its independent per-request authorisation check. */
export default function MyBluebellyReports(){
 return <main className={styles.page} data-bluebelly-my-reports="owner-only"
   data-private-desk="two-pdf-deliverables">
  <BlueDeskHeader activePath="/my-reports"/>
  <div className={styles.content}>
   <header className={styles.calendarHero}>
    <div>
     <p className={styles.kicker}>PRIVATE / BLUEBELLY</p>
     <h1>My Desk</h1>
     <p className={styles.heroDeck}>Your two source-aware daily PDF deliverables.
       Open or save the latest verified edition below, or review previous editions.
       If evidence is incomplete, the missing report stays explicitly unavailable.</p>
    </div>
   </header>
   <section className={layout.driveArchive} data-drive-archive="kqdocuments88-private">
     <div className={layout.driveHead}>
       <div>
         <p className={styles.kicker}>GOOGLE DRIVE · YOUR FILES, NOT VERCEL STORAGE</p>
         <h2>Reports in KQ Documents</h2>
         <p>Open the dated PDF, or edit its Google Docs master. Future editions belong in the same private Drive folder. Sign in with the Google account that has access to this folder.</p>
       </div>
       <a href="https://drive.google.com/drive/folders/19r-RATOo0vn89FDzs4UZBptPpm1Z9w5L"
         target="_blank" rel="noopener noreferrer">Open all editions in Google Drive ↗</a>
     </div>
     <div className={layout.driveItems}>
       <article>
         <strong>27 Oct · Daily Market Brief</strong>
         <span>Source-checked pilot · story-driven market overview</span>
         <div>
           <a href="https://drive.google.com/file/d/1vrlz5BO25HNTDFsftQQNb_Q0wsysRhhm/view?usp=drivesdk"
             target="_blank" rel="noopener noreferrer">Read PDF ↗</a>
           <a href="https://docs.google.com/document/d/12ZTqOZn86wxuInqfscBAnDS3-u63ONPcKh-VsDxRfME/edit?usp=drivesdk"
             target="_blank" rel="noopener noreferrer">Edit master ↗</a>
         </div>
       </article>
       <article>
         <strong>27 Oct · Three OB/COTD Ideas</strong>
         <span>Writing Brain slate · source-verified updates distinguished</span>
         <div>
           <a href="https://drive.google.com/file/d/1eXurYRfogx7M88BRvpo8KZF6ycfh-8Ao/view?usp=drivesdk"
             target="_blank" rel="noopener noreferrer">Read PDF ↗</a>
           <a href="https://docs.google.com/document/d/1bFDxSyT8gSfwEiztfNHQZXL-8bCl8XQEd07jHV3Ksqc/edit?usp=drivesdk"
             target="_blank" rel="noopener noreferrer">Edit master ↗</a>
         </div>
       </article>
     </div>
     <p className={layout.driveNote}>These dated links are the 27 October pilot, not an automatically rolling “latest” feed. Use the folder link for new editions. A Drive file still requires its own Google account permissions.</p>
   </section>
   <div className={layout.focus} aria-label="The two private daily outputs">
     <article>
       <p className={layout.step}>REPORT 01 · DAILY MARKET BRIEFING</p>
       <h2>Market stories, explained</h2>
       <p>A chronological explanation of critical sourced events, the financial mechanisms,
         competing possibilities and the next test. Morning and evening editions where
         the existing source gate allows publication.</p>
     </article>
     <article>
       <p className={layout.step}>REPORT 02 · WRITING BRAIN</p>
       <h2>Three article opportunities</h2>
       <p>The three ranked OB / COTD angles from the existing scheduled research slate,
         with original URLs, chart questions and missing proof explicitly marked.
         These are ideas, not approved articles or trading calls.</p>
     </article>
   </div>
  </div>
  <OwnerAutomaticReportReader/>
  <OwnerEditorialSlatePdfReader/>
  <div className={layout.technical}>
   <details data-my-desk-technical="collapsed-by-default">
     <summary>Technical input health and missing evidence</summary>
     <OwnerPrivatePdfInputHealth/>
   </details>
  </div>
 </main>;
}
