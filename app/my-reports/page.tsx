import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import Link from "next/link";
import OwnerPrivatePdfInputHealth from "@/components/blue-desk/OwnerPrivatePdfInputHealth";
import OwnerDailyIntelligenceHome from "@/components/blue-desk/OwnerDailyIntelligenceHome";
import OwnerDailyTopicIdeas from "@/components/blue-desk/OwnerDailyTopicIdeas";
import OwnerPortfolioHome from "@/components/blue-desk/OwnerPortfolioHome";
import styles from "@/app/blue-desk/blue-desk.module.css";
import layout from "./my-desk.module.css";

export const dynamic="force-dynamic";
export const revalidate=0;
export const metadata={title:"My Desk | Bluebelly",robots:{index:false,follow:false}};

/** Private decision desk: one live Daily Intelligence edition and exactly
 * three report-dependent writing directions. Older article archives are not
 * presented here; immutable source records remain retained downstream. */
export default async function MyBluebellyReports({searchParams}:{searchParams:Promise<{view?:string|string[]}>}){
 const view=(await searchParams).view==="portfolio"?"portfolio":"intelligence";
 return <main className={styles.page} data-bluebelly-my-reports="owner-only"
  data-private-desk={view==="portfolio"?"portfolio-home":"daily-report-led-three-ideas"}>
  <BlueDeskHeader activePath="/my-reports"/>
  <div className={styles.content}>
   <header className={styles.calendarHero}>
    <div>
     <p className={styles.kicker}>PRIVATE / BLUEBELLY</p>
     <h1>My Desk</h1>
     <p className={styles.heroDeck}>{view==="portfolio"
       ?"Your source-dated investment research and recorded holdings, within the same private desk."
       :"One Daily Intelligence report and three research directions, grounded in sources and market conditions."}</p>
    </div>
   </header>
   <nav className={layout.deskViews} aria-label="My Desk workspace">
    <Link href="/my-reports" className={view==="intelligence"?layout.deskViewSelected:layout.deskView}
      aria-current={view==="intelligence"?"page":undefined}>Daily intelligence</Link>
    <Link href="/my-reports?view=portfolio" className={view==="portfolio"?layout.deskViewSelected:layout.deskView}
      aria-current={view==="portfolio"?"page":undefined}>My Portfolio</Link>
   </nav>
   {view==="portfolio"?<OwnerPortfolioHome/>:<>
    <OwnerDailyIntelligenceHome/>
    <div data-my-desk-secondary="daily-report-to-ob-cotd"><OwnerDailyTopicIdeas/></div>
    <p className={layout.myDeskRelated}>Explore fresh source-linked developments in
     {" "}<Link href="/blue-desk/newsroom">Newsroom</Link>.
     The private report history below includes only Daily Intelligence editions saved after
     the My Desk archive cutover.</p>
   </>}
  </div>
  {view==="intelligence"?<div className={layout.technical}>
   <details data-my-desk-technical="collapsed-by-default">
    <summary>Technical input health and missing evidence</summary>
    <OwnerPrivatePdfInputHealth/>
   </details>
  </div>:null}
 </main>;
}
