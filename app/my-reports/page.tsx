import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import Link from "next/link";
import {redirect} from "next/navigation";
import OwnerPrivatePdfInputHealth from "@/components/blue-desk/OwnerPrivatePdfInputHealth";
import OwnerDailyIntelligenceHome from "@/components/blue-desk/OwnerDailyIntelligenceHome";
import OwnerDailyReportAttachments from "@/components/blue-desk/OwnerDailyReportAttachments";
import OwnerDailyTopicIdeas from "@/components/blue-desk/OwnerDailyTopicIdeas";
import styles from "@/app/blue-desk/blue-desk.module.css";
import layout from "./my-desk.module.css";

export const dynamic="force-dynamic";
export const revalidate=0;
export const metadata={title:"My Desk | Bluebelly",robots:{index:false,follow:false}};

/** My Desk is the owner editorial workspace: Daily Intelligence, report-led
 * OB/COTD directions and technical input health. Portfolio ownership and its
 * independent research live at the login-first Power Stack GitHub Pages site.
 * Older bookmarked ?view=portfolio links must not resurrect a parallel table. */
export default async function MyBluebellyReports({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const params=await searchParams;
 if(params.view==="portfolio")redirect("/my-reports");
 return <main className={styles.page} data-bluebelly-my-reports="owner-only"
  data-private-desk="daily-report-led-three-ideas">
  <BlueDeskHeader activePath="/my-reports"/>
  <div className={styles.content}>
   <header className={styles.calendarHero}>
    <div>
     <p className={styles.kicker}>PRIVATE / BLUEBELLY</p>
     <h1>My Desk</h1>
     <p className={styles.heroDeck}>One Daily Intelligence report and three research directions, grounded in sources and market conditions.</p>
    </div>
   </header>
   <OwnerDailyIntelligenceHome/>
   <OwnerDailyReportAttachments/>
   <p className={layout.myDeskRelated}><Link href="/owner/daily-report#macropulse-review">Review incoming MacroPulse dispatches →</Link> (owner-only, publication requires source checks)</p>
   <div data-my-desk-secondary="daily-report-to-ob-cotd"><OwnerDailyTopicIdeas/></div>
   <p className={layout.myDeskRelated}>Explore fresh source-linked developments in
    {" "}<Link href="/blue-desk/newsroom">Newsroom</Link>.
    The private report history below includes only Daily Intelligence editions saved after
    the My Desk archive cutover.</p>
  </div>
  <div className={layout.technical}>
   <details data-my-desk-technical="collapsed-by-default">
    <summary>Technical input health and missing evidence</summary>
    <OwnerPrivatePdfInputHealth/>
   </details>
  </div>
 </main>;
}
