import Link from "next/link";
import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import EditorialWorkbench from "@/components/blue-desk/EditorialWorkbench";
import PresenterTechnicalChecks from "@/components/live-desk/PresenterTechnicalChecks";
import OwnerTodayTalk from "@/components/blue-desk/OwnerTodayTalk";
import { projectEditorialPriceCards } from "@/lib/editorial-price-context";
import { getLatestEditorialSlate } from "@/lib/editorial-slate-server";
import { getMarketMonitor } from "@/lib/market-monitor-public";
import { getCurrentVerifiedMarketMotion } from "@/lib/market-motion";
import { selectVerifiedNewsBriefs } from "@/lib/market-brief-news";
import { buildOwnerTodayTalk } from "@/lib/bluebelly-todays-talk";
import { getDossierV2PresentationSelection } from "@/lib/dossier-v2/presentation-reader";
import { projectPresenterDossierSelection } from "@/lib/presenter-technical-reconciliation";
import styles from "@/app/blue-desk/blue-desk.module.css";

export const dynamic="force-dynamic";
export const revalidate=0;
export const metadata={title:"Presenter Studio | Private Blue Desk",
  description:"Owner-only presenter run of show, market checks and technical overlays.",robots:{index:false,follow:false}};

export default async function PresenterStudioPage(){
  const [monitor,editorialSlate,dossierSelection,motionRecords]=await Promise.all([
    getMarketMonitor().catch(()=>null),
    getLatestEditorialSlate(),
    getDossierV2PresentationSelection().catch(()=>null),
    getCurrentVerifiedMarketMotion({limit:24}).catch(()=>[]),
  ]);
  // Server-only admin Dossier read on a middleware/allowlist-protected owner page.
  // Send only selected identity + source-linked Regime lens summaries to the client.
  const dossierContext=projectPresenterDossierSelection(dossierSelection);
  const nowIso=new Date().toISOString();
  const cards=projectEditorialPriceCards(monitor?.rows||[],nowIso);
  const news=selectVerifiedNewsBriefs(motionRecords,new Date(nowIso),18);
  const talk=buildOwnerTodayTalk({news,motionRecords,dossierSelection,priceCards:cards,nowIso});
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
          <small><Link href="/my-reports">Open my source-qualified PDFs ↗</Link></small>
          <small><Link href="/market-tools">Market tools · correlation and trade-idea research ↗</Link></small>
          <small><Link href="/owner/presenter/editions">Browse exact historical editions ↗</Link></small>
          <small><a href="#todays-talk">Read today’s source-ranked talk ↗</a></small>
        </div>
      </header>
    </div>
    <OwnerTodayTalk brief={talk}/>
    <EditorialWorkbench mode="presenter" priceCards={cards} readError={!monitor} slate={editorialSlate.slate} slateStatus={editorialSlate.status}/>
    <div className={styles.content}>
      <section id="technical-checks" className={styles.section}>
        <div className={styles.sectionHead}>
          <div><p className={styles.kicker}>MANUAL TECHNICAL RECONCILIATION</p>
            <h2>Technical checks</h2>
            <p>All 14 saved monitor keys are available: seven core checks first, then seven additional cross-asset checks under Show additional. Review chart dates and linked sources; presenter notes never change canonical evidence.</p>
          </div>
        </div>
        <PresenterTechnicalChecks dossierContext={dossierContext}/>
      </section>
    </div>
  </main>;
}
