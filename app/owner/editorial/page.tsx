import Link from "next/link";
import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import EditorialWorkbench from "@/components/blue-desk/EditorialWorkbench";
import { projectEditorialPriceCards } from "@/lib/editorial-price-context";
import { getMarketMonitor } from "@/lib/market-monitor-public";
import styles from "@/app/blue-desk/blue-desk.module.css";

export const dynamic="force-dynamic";
export const revalidate=0;
export const metadata={title:"Editorial Studio | Private Blue Desk",
  description:"Owner-only OB/COTD composition, dated session comparisons and charts."};

export default async function EditorialStudioPage(){
  const monitor=await getMarketMonitor().catch(()=>null);
  const cards=projectEditorialPriceCards(monitor?.rows||[],new Date().toISOString());
  return <main className={styles.page} data-editorial-studio="owner-only">
    <BlueDeskHeader activePath="/owner/editorial"/>
    <div className={styles.content}>
      <header className={styles.calendarHero}>
        <div><p className={styles.kicker}>PRIVATE / EDITORIAL INTELLIGENCE</p>
          <h1>OB / COTD Writing Studio</h1>
          <p className={styles.heroDeck}>Start with the catalyst, follow the tape across one, three and five completed sessions, test the explanation, and choose the chart that settles the question.</p>
        </div>
        <div className={styles.calendarClock}>
          <span className={styles.kicker}>DAILY WRITING BRAIN</span>
          <strong>09:00 MYT</strong><small>Weekdays · existing scheduled task</small>
        </div>
      </header>
    </div>
    <EditorialWorkbench mode="editorial" priceCards={cards} readError={!monitor}/>
    <div className={styles.content}>
      <p className={styles.muted}>Research inputs: full <Link href="/whats-new">What's New</Link>, <Link href="/articles">Article memory</Link>, <Link href="/owner/x-wire">X leads</Link> and <Link href="/owner/presenter">Presenter view</Link>. Open and verify original sources before publication.</p>
    </div>
  </main>;
}
