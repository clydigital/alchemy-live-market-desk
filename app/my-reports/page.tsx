import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import OwnerAutomaticReportReader from "@/components/blue-desk/OwnerAutomaticReportReader";
import OwnerEditorialSlatePdfReader from "@/components/blue-desk/OwnerEditorialSlatePdfReader";
import OwnerPrivatePdfInputHealth from "@/components/blue-desk/OwnerPrivatePdfInputHealth";
import styles from "@/app/blue-desk/blue-desk.module.css";

export const dynamic="force-dynamic";
export const revalidate=0;
export const metadata={title:"My Reports | Bluebelly",robots:{index:false,follow:false}};

/** The user-facing Bluebelly report library. Middleware requires Supabase
 * Google sign-in and the active allowlist before rendering the component.
 * A separate per-request check protects every PDF stream. */
export default function MyBluebellyReports(){
 return <main className={styles.page} data-bluebelly-my-reports="owner-only">
  <BlueDeskHeader activePath="/my-reports"/>
  <div className={styles.content}>
   <header className={styles.calendarHero}>
    <div>
     <p className={styles.kicker}>MY PRIVATE REPORTS / BLUEBELLY</p>
     <h1>Market intelligence library</h1>
     <p className={styles.heroDeck}>Your personal source-qualified PDF editions.
      Nothing here is publicly published. The automatic report currently has
      morning and evening editions. The separate Writing Brain research-slate PDF
      is generated from a valid persisted slate; Presenter and Regime PDFs remain unimplemented.</p>
    </div>
   </header>
  </div>
  <OwnerAutomaticReportReader/>
  <OwnerEditorialSlatePdfReader/>
  <OwnerPrivatePdfInputHealth/>
 </main>;
}
