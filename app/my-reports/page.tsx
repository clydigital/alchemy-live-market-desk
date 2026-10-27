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
