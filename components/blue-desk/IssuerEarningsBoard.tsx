import Link from "next/link";
import DualTimestamp from "./DualTimestamp";
import {getIssuerEarningsSchedule,type OfficialEarning} from "@/lib/forward-earnings-sources";
import {getRecentVerifiedEarningsScorecards} from "@/lib/blue-desk-earnings-results";
import {recentOriginalIssuerReleases} from "@/lib/bluebelly-issuer-release-receipts";
import {blueDeskPublicHref} from "@/lib/blue-desk-host";
import css from "./IssuerEarningsBoard.module.css";

function easternDay(now:Date){
 const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now);
 const value=(type:string)=>parts.find(p=>p.type===type)?.value||"";
 return value("year")+"-"+value("month")+"-"+value("day");
}
function prettyDay(day:string){
 const at=new Date(day+"T12:00:00Z");
 return Number.isFinite(+at)?new Intl.DateTimeFormat("en-GB",{weekday:"short",day:"numeric",month:"short",timeZone:"UTC"}).format(at):day;
}
function isFuture(row:OfficialEarning,now:Date,etToday:string){
 if(row.at.length===10)return row.at>=etToday;
 const at=Date.parse(row.at);
 return Number.isFinite(at)&&at>=+now;
}
export default function IssuerEarningsBoard({now,host}:{now:Date;host:string|null}){
 const etDay=easternDay(now);
 const official=getIssuerEarningsSchedule(now,3,30);
 const originals=recentOriginalIssuerReleases(now,8);
 const resultTickers=new Set(originals.map(item=>item.ticker));
 const results=[
  ...originals.map(item=>({ticker:item.ticker,name:item.company,period:item.fiscalPeriod,
   day:item.sourceDay,fact:item.confirmed,test:item.nextTest,sourceUrl:item.sourceUrl,
   sourceName:item.sourceName,kind:"original" as const})),
  ...getRecentVerifiedEarningsScorecards(now,7).filter(item=>!resultTickers.has(item.ticker))
   .map(item=>({ticker:item.ticker,name:item.company,period:item.fiscalPeriod,day:item.releaseDay,
    fact:item.headline+" "+item.conclusion,test:item.nextTest,sourceUrl:item.sourceUrl,
    sourceName:item.sourceName,kind:"scorecard" as const})),
 ].sort((a,b)=>b.day.localeCompare(a.day)||a.ticker.localeCompare(b.ticker)).slice(0,9);
 const posted=new Set(results.map(item=>item.ticker));
 const upcoming=official.filter(item=>!posted.has(item.ticker)&&isFuture(item,now,etDay));
 const groups=new Map<string,OfficialEarning[]>();
 for(const item of upcoming){
  const day=item.at.slice(0,10);
  groups.set(day,[...(groups.get(day)||[]),item]);
 }
 const elapsed=official.filter(item=>!posted.has(item.ticker)&&!isFuture(item,now,etDay));
 const href=blueDeskPublicHref("/blue-desk/earnings-week",host);
 return <section className={css.hub} id="earnings-issuers" data-issuer-earnings-hub="source-confirmed-2026-11-04" aria-labelledby="earnings-issuers-title">
  <header className={css.heading}>
   <div>
    <p className={css.eyebrow}>EARNINGS / ISSUER RELATIONS · ORIGINAL SOURCES</p>
    <h2 id="earnings-issuers-title">Who has reported, and who is next?</h2>
    <p>Issuer-confirmed dates and company-released results, separated by evidence status. Date and call time are not interchangeable. No estimated EPS, fabricated beats or inferred share-price reactions.</p>
   </div>
   <Link href={href} className={css.headLink}>Earlier earnings investigations →</Link>
  </header>
  <div className={css.summary} aria-label="Earnings coverage">
   <span>{results.length} original-source results / reviews</span>
   <span>{upcoming.length} upcoming issuer-confirmed events</span>
   <span>Source review: 4 Nov 2026 · displayed in ET / MYT</span>
  </div>
  <div className={css.lanes}>
   <section className={css.section} aria-label="Verified recent issuer releases">
    <h3 className={css.sectionTitle}>Already reported</h3>
    <p className={css.hint}>Original issuer releases are checked separately from expected reporting appointments. Archived metrics keep their actual accounting period.</p>
    <div className={css.results}>
     {results.map(item=><article className={css.result} key={item.ticker+item.period} data-issuer-result={item.ticker}>
      <div className={css.mini}><span className={css.ticker}>{item.ticker} · {item.name}</span>
       <span className={css.status}>RESULT PUBLISHED · {item.day}</span></div>
      <h4>{item.period}</h4>
      <p>{item.fact}</p>
      <p><strong>Next test:</strong> {item.test}</p>
      <a className={css.source} href={item.sourceUrl} target="_blank" rel="noopener noreferrer">{item.sourceName} ↗</a>
     </article>)}
     {!results.length?<p className={css.empty}>No recent original-release reviews available; this is not evidence that no issuers reported.</p>:null}
    </div>
   </section>
   <section className={css.section} aria-label="Upcoming issuer-confirmed earnings calendar">
    <h3 className={css.sectionTitle}>Upcoming — confirmed by issuer IR</h3>
    <p className={css.hint}>Dates and call times from issuer announcements. A call ending or starting does not itself establish that figures have been reviewed.</p>
    {[...groups.entries()].map(([day,records])=><div className={css.day} key={day} data-issuer-day={day}>
     <h4>{prettyDay(day)} · {day} · {records.length} issuer{records.length===1?"":"s"}</h4>
     <div className={css.issuerGrid}>
      {records.map(row=><article className={css.card} key={row.ticker+row.quarter} data-issuer-upcoming={row.ticker}>
       <div className={css.mini}><span className={css.ticker}>{row.ticker}</span>
        <span className={css.status}>{row.releaseSession==="AMC"?"RESULTS AFTER CLOSE":
          row.releaseSession==="BMO"?"RESULTS BEFORE OPEN":"RELEASE MINUTE NOT CONFIRMED"}</span></div>
       <h5>{row.company} · {row.quarter}</h5>
       <p className={css.clock}><strong>Call / webcast:</strong> {row.at.length===10?"Time unconfirmed":<DualTimestamp value={row.at}/>}</p>
       <p className={css.detail}>{row.stage}</p>
       <p className={css.test}><strong>Investor test:</strong> {row.decisive}</p>
       <a className={css.source} href={row.source} target="_blank" rel="noopener noreferrer">Original issuer schedule ↗</a>
      </article>)}
     </div>
    </div>)}
    {!upcoming.length?<p className={css.empty}>No further issuer-confirmed appointments in this window. Provider calendars can be incomplete.</p>:null}
    {elapsed.length?<details className={css.caveat} data-issuer-elapsed-unverified>
     <summary>{elapsed.length} recent scheduled calls have passed without a matching reviewed issuer result</summary>
     <p>{elapsed.map(x=>x.ticker+" ("+x.at.slice(0,10)+")").join(", ")}. Check original issuer IR; no earnings outcome is inferred from the elapsed call time.</p>
    </details>:null}
   </section>
  </div>
  <p className={css.caveat}>Corrections: DoorDash moved its Q3 release from 4 Nov to 29 Oct and is listed as reported, not upcoming. NVIDIA's next FY27 Q3 call is 17 Nov ET, not 18 Nov. Events without an issuer-confirmed release session are left unclassified. These are selected tracked issuers, not every listed company.</p>
 </section>;
}
