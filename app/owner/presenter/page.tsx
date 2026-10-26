import Link from "next/link";
import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import EditorialWorkbench from "@/components/blue-desk/EditorialWorkbench";
import PresenterTechnicalChecks from "@/components/live-desk/PresenterTechnicalChecks";
import { projectEditorialPriceCards } from "@/lib/editorial-price-context";
import { getLatestEditorialSlate } from "@/lib/editorial-slate-server";
import { getMarketMonitor } from "@/lib/market-monitor-public";
import styles from "@/app/blue-desk/blue-desk.module.css";

export const dynamic="force-dynamic";
export const revalidate=0;
export const metadata={title:"Presenter Studio | Private Blue Desk",
  description:"Owner-only presenter run of show, market checks and technical overlays."};

export default async function PresenterStudioPage(){
  const [monitor,editorialSlate]=await Promise.all([getMarketMonitor().catch(()=>null),getLatestEditorialSlate()]);
  const cards=projectEditorialPriceCards(monitor?.rows||[],new Date().toISOString());
  return <main className={styles.page} data-presenter-studio="owner-only">
    <BlueDeskHeader activePath="/owner/presenter"/>
    <div className={styles.content}>
      <header className={styles.calendarHero}>
        <div><p className={styles.kicker}>PRIVATE / ON AIR PREPARATION</p>
          <h1>Presenter Studio</h1>
          <p className={styles.heroDeck}>Follow the news, check the price reaction across one, three and five completed sessions, then explain the mechanism and the condition that changes the view.</p>
        </div>
        <div className={styles.calendarClock}>
          <span className={styles.kicker}>RESEARCH CONNECTION</span>
          <strong>Daily briefing</strong>
          <small><Link href="/owner/daily-report">Open my automatic PDF and research context ↗</Link></small>
        </div>
      </header>
    </div>
    <EditorialWorkbench mode="presenter" priceCards={cards} readError={!monitor} slate={editorialSlate.slate} slateStatus={editorialSlate.status}/>
    <div className={styles.content}>
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <div><p className={styles.kicker}>MANUAL TECHNICAL RECONCILIATION</p>
            <h2>Technical checks</h2>
            <p>Actual chart inspection and observation dates required. These notes do not change canonical evidence.</p>
          </div>
        </div>
        <PresenterTechnicalChecks compact/>
      </section>
    </div>
  </main>;
}
