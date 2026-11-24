import Link from "next/link";
import {headers} from "next/headers";
import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import EarningsFundamentals from "@/components/blue-desk/EarningsFundamentals";
import EarningsInvestorDeepDive from "@/components/blue-desk/EarningsInvestorDeepDive";
import EarningsWeekGrid from "@/components/blue-desk/EarningsWeekGrid";
import IssuerEarningsBoard from "@/components/blue-desk/IssuerEarningsBoard";
import RecentEarningsScorecards from "@/components/blue-desk/RecentEarningsScorecards";
import {getEarningsCase} from "@/lib/bluebelly-earnings-investor-stories";
import {getCalendarEarningsScorecards} from "@/lib/earnings/calendar-read-model";
import {getIssuerEarningsCoverageHealth} from "@/lib/earnings/coverage-health";
import {getForwardEarningsEvents,type ForwardEarningsResult} from "@/lib/forward-earnings-sources";
import {buildPresenterCalendar} from "@/lib/presenter-calendar";
import {selectBlueDeskEarningsWeek,selectBlueDeskUpcoming} from "@/lib/blue-desk-calendar";
import {blueDeskPublicHref} from "@/lib/blue-desk-host";
import DualTimestamp from "@/components/blue-desk/DualTimestamp";
import styles from "../blue-desk.module.css";

export const dynamic="force-dynamic";
export const metadata={title:"Earnings | Bluebelly",description:"Company results, guidance, upcoming earnings, cash flow and investor research."};
export default async function EarningsPage({searchParams}:{searchParams:Promise<{view?:string|string[];ticker?:string|string[]}>}){
 const query=await searchParams;
 const host=(await headers()).get("host");
 const base=blueDeskPublicHref("/blue-desk/earnings",host);
 const detail=query.view==="earnings"&&typeof query.ticker==="string"?getEarningsCase(query.ticker):null;
 if(detail)return <main className={styles.page} data-bluebelly-markets-view="earnings-investor-dossier">
  <BlueDeskHeader activePath="/blue-desk/earnings"/><div className={styles.content}>
  <EarningsInvestorDeepDive ticker={detail.ticker} backHref={base}/></div></main>;
 const now=new Date();
 const [results,health,forward]=await Promise.all([
  getCalendarEarningsScorecards(now),getIssuerEarningsCoverageHealth(now),
  getForwardEarningsEvents({now}).catch(():ForwardEarningsResult=>({events:[],coverage:"unavailable",warning:"Earnings source could not be reached."})),
 ]);
 const calendar=buildPresenterCalendar([],forward,now,true);
 const week=selectBlueDeskEarningsWeek(calendar,now);
 const weekIds=new Set(week.map(event=>event.id));
 const later=selectBlueDeskUpcoming(calendar,now,30).filter(event=>event.kind==="earnings"&&!weekIds.has(event.id)).slice(0,24);
 return <main className={styles.page} data-bluebelly-earnings="standalone">
  <BlueDeskHeader activePath="/blue-desk/earnings"/>
  <div className={styles.content}>
   <header className={styles.calendarHero}><div><p className={styles.kicker}>COMPANY INTELLIGENCE</p><h1>Earnings</h1>
   <p className={styles.heroDeck}>Who beat expectations, what management expects next, and who actually keeps the cash.</p></div></header>
   <nav className={styles.publicMarketGroups} aria-label="Earnings sections">
    <a className={styles.calendarTab} href="#earnings-issuers">Results &amp; guidance</a>
    <a className={styles.calendarTab} href="#earnings-hub">Upcoming earnings</a>
    <a className={styles.calendarTab} href="#earnings-fundamentals">Company research</a>
    <a className={styles.calendarTab} href="#coreweave-credit-watch">Financing &amp; credit</a>
   </nav>
   <IssuerEarningsBoard now={now} host={host} reviewedResults={results} automationHealth={health}/>
   <RecentEarningsScorecards records={results}/>
   <section id="earnings-hub" className={styles.section}>
    <p className={styles.kicker}>NEXT 30 DAYS / US EASTERN TIME</p><h2>Upcoming earnings</h2>
    <p>Issuer-announced dates are confirmed; provider estimates require verification. No invented release times.</p>
    <p className={styles.muted}>Coverage: {calendar.sourceHealth.earnings.replaceAll("_"," ")} · {week.length} this week · {later.length} later.</p>
    {week.length?<EarningsWeekGrid records={week} now={now}/>:<p>No source-listed earnings for this week in the available coverage.</p>}
    {later.length?<details className={styles.secondaryPanel}><summary>Later in the next 30 days ({later.length})</summary>{later.map(event=><article key={event.id} className={styles.eventRow}>
     <h3>{event.title}</h3><DualTimestamp value={event.scheduledAt} sourceDate={event.localDate} className={styles.eventTime}/>
     <p>{event.verificationState==="official"?"Issuer-announced":"Provider-reported · verify with issuer"} · {event.affectedAssets.join(" · ")}</p>
     {event.consensus?<p>Reported expectations: {event.consensus}</p>:null}
     {/^https:\/\//i.test(event.sourceUrl||"")?<a href={event.sourceUrl} target="_blank" rel="noreferrer">{event.sourceName} ↗</a>:null}
    </article>)}</details>:null}
    <p><Link href={blueDeskPublicHref("/blue-desk/calendar",host)}>Full economic and earnings calendar →</Link></p>
   </section>
   <section className={styles.section} id="earnings-research" data-earnings-reader-entry="seven-company">
    <p className={styles.kicker}>SOURCE-DATED INVESTOR RESEARCH</p><h2>Company fundamentals and financing</h2>
    <p>Preserved investor investigations, not automatically refreshed results. Read the dated business, valuation, cash-flow and financing evidence.</p>
    <EarningsFundamentals amazonFeatureHref={blueDeskPublicHref("/blue-desk/key-stories",host)+"?feature=amazon-cash-test-october-2026"} deepBaseHref={base}/>
   </section>
   <section className={styles.secondaryPanel}><h2>Research archive</h2><p>Original 2–6 November pre-results research, preserved in its historical context.</p><Link href={blueDeskPublicHref("/blue-desk/earnings-week",host)}>Read the full earnings-week investigation →</Link></section>
   <footer className={styles.footer}><span>Bluebelly</span></footer>
  </div>
 </main>;
}
