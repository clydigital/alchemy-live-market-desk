import Link from "next/link";
import {headers} from "next/headers";
import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import {blueDeskPublicHref} from "@/lib/blue-desk-host";
import {NEWSROOM_NOVEMBER_SOURCES as S} from "@/lib/bluebelly-week-ahead-newsroom";
import styles from "../../earnings-week/earnings-week.module.css";

export const metadata={
 title:"Midterms, ISM and US Jobs: The Investor Test | Bluebelly Newsroom",
 description:"A frozen 2 November 2026 pre-event investigation of US congressional elections, ISM manufacturing and services, jobs, Treasury yields and the earnings cycle.",
};
export const dynamic="force-dynamic";

function Source({href,children}:{href:string;children:React.ReactNode}){
 return <a href={href} target="_blank" rel="noopener noreferrer">{children} ↗</a>;
}
export default async function WeekAheadNewsroom(){
 const host=(await headers()).get("host");
 const link=(url:string)=>blueDeskPublicHref(url,host);
 const events=[
  {day:"Mon 2 Nov",when:"10:00 ET",name:"ISM October Manufacturing",test:"New orders and prices versus the September baseline; no October actual before release"},
  {day:"Tue 3 Nov",when:"10:00 ET",name:"September JOLTS",test:"Openings, hires and quits versus employment and wage pressure"},
  {day:"Tue 3 Nov",when:"US election day",name:"US congressional midterms",test:"House/Senate control, not presumed winners; proposed policy versus enacted law"},
  {day:"Wed 4 Nov",when:"08:15 ET",name:"ADP private employment",test:"A different survey from Friday's official nonfarm payrolls"},
  {day:"Wed 4 Nov",when:"10:00 ET",name:"ISM October Services",test:"Demand, employment and prices: inflation versus growth"},
  {day:"Thu 5 Nov",when:"08:30 ET",name:"Productivity and Costs (preliminary)",test:"Output per hour and unit labour costs; watch wages versus productivity"},
  {day:"Fri 6 Nov",when:"08:30 ET",name:"October US Employment Situation",test:"Payrolls, unemployment, hours, earnings and prior-month revisions"},
 ];
 return <main className={styles.page} data-newsroom-week-ahead="frozen-preview-2026-11-02">
  <BlueDeskHeader activePath="/blue-desk/newsroom"/>
  <article className={styles.body}>
   <nav className={styles.back}>
    <Link href={link("/blue-desk/newsroom")}>← Newsroom</Link>
    <Link href={link("/blue-desk/earnings-week")}>Earnings Investor Test</Link>
    <Link href={link("/blue-desk/calendar")}>Economic Calendar</Link>
    <Link href={link("/blue-desk/daily-report")}>Daily Report</Link>
   </nav>
   <header className={styles.hero}>
    <p className={styles.kicker}>BLUEBELLY NEWSROOM / MACRO & POLICY / 2–6 NOVEMBER 2026</p>
    <h1>Factories are growing, hiring is weak. Can Washington add another surprise?</h1>
    <p className={styles.lead}>A new Congress, stubborn factory costs and a quiet jobs market are about to collide with the AI earnings boom. One strong number will not settle the argument. The question is which companies, borrowers and markets actually benefit when the details arrive.</p>
    <p className={styles.dated}><strong>FROZEN PRE-EVENT EDITION · 2 November 2026, before the US releases.</strong> Election results, October ISM numbers and October payrolls are not known in this edition. Previously reported figures are labelled by month, and no post-release market reaction is invented. Read the official sources for later results.</p>
   </header>
   <section className={styles.section} id="midterms">
    <p className={styles.kicker}>01 / US MIDTERMS · 3 NOVEMBER / POLICY INVESTOR TEST</p>
    <h2>Washington could change hands. That doesn't mean the money moves immediately.</h2>
    <p>All <strong>435 House seats</strong> are at stake on Tuesday, 3 November. The Senate has <strong>33 regular contests and two special elections</strong>. Those elections will affect control of Congress, but they are not a presidential election or a referendum on one specific market policy. The date comes from the <Source href={S.election}>Federal Election Commission</Source>; the institutional distinction is explained by <Source href={S.congress}>USAGov</Source>.</p>
    <p>The first temptation is to turn the result into a simple “good for stocks” or “bad for stocks” headline. The more useful question is what new legislation could actually pass. Congress affects taxation, federal spending and appropriations. A changed majority does not itself cut a company's taxes, approve a nuclear reactor or remove a tariff.</p>
    <p>There are two different kinds of market risk here. A unified government could make it easier to advance a legislative programme, but the economic effect depends on whether that programme expands deficits, changes corporate taxes or redirects spending. A divided government may reduce the probability of major legislation, but can bring budget confrontations or prolonged negotiations.</p>
    <div className={styles.themes}>
     <section><h3>Scenario: divided government</h3><p>New tax or spending laws may face a harder path. A smaller chance of fiscal expansion could be supportive for duration, but fiscal standoffs can increase uncertainty. Watch the Treasury curve and the exact proposals rather than assuming gridlock means lower yields.</p></section>
     <section><h3>Scenario: unified government</h3><p>Legislative capacity could rise, yet the market still needs a specific bill, funding mechanism and enactment timeline. An infrastructure benefit for industrial suppliers is not the same as a near-term increase in profits.</p></section>
    </div>
    <p>What should we watch? Start with <strong>2-, 10- and 30-year Treasury yields</strong> and the dollar. Then look at banks, defence, healthcare, utilities, energy and domestic industrial firms. A shift toward more federal spending may support some order books but could increase borrowing needs. Higher long-end yields could offset that benefit by making expensive financing even harder.</p>
    <p>The strongest objection to any election-night trading thesis is that markets may have anticipated the likely outcome. A result can be politically important but financially unsurprising. Equally, sharp moves on election night may reflect another simultaneous news event or thin trading rather than the vote itself.</p>
    <p><strong>The next test:</strong> identify actual chamber control from authoritative results, then connect named policy proposals to their legislative prospects. Compare before/after Treasury, DXY and sector prices over identical windows. Until then, any claim that the election “changed the Fed” or “unlocked” company revenue is premature.</p>
   </section>
   <section className={styles.section} id="ism">
    <p className={styles.kicker}>02 / ISM MANUFACTURING & SERVICES · 2 AND 4 NOVEMBER</p>
    <h2>The factory orders are there. Why are input prices still so high?</h2>
    <p>September's US Manufacturing PMI was <strong>54.5</strong>, barely lower than August's <strong>54.6</strong>. New orders improved to <strong>55.3 from 53.7</strong>. But the prices index jumped to <strong>77.9 from 71.1</strong>. Companies were still reporting growth while paying substantially more for inputs. <Source href={S.manufacturing}>ISM's original September manufacturing report</Source>.</p>
    <p>That is the tension behind Monday's October release. A factory can receive more orders and still have a weaker quarter if materials, transport and energy cost more than it can recover from customers. Record demand and better profitability are not interchangeable.</p>
    <p>There is another catch. ISM's headline PMI includes supplier deliveries. If parts take longer to arrive, that can lift the index even when the underlying reason is a supply bottleneck. An apparent beat is less persuasive when new orders fall and delivery delays do most of the work.</p>
    <div className={styles.stats}>
     <div><strong>54.5</strong><span>September Manufacturing PMI, down 0.1 percentage point from August</span></div>
     <div><strong>77.9</strong><span>September manufacturing prices, up 6.8 points from August</span></div>
     <div><strong>55.3</strong><span>September manufacturing new orders, up from 53.7</span></div>
    </div>
    <p>The services side has a similar problem. September Services PMI was <strong>54.9</strong>, down from <strong>55.4</strong> in August. Its prices index nevertheless rose to <strong>74.0 from 72.6</strong>. Services new orders were still high at <strong>59.8</strong>, while employment was only just in expansion at <strong>50.1</strong>. <Source href={S.services}>ISM's September services figures</Source>.</p>
    <p>The <Source href={S.ismCalendar}>ISM release calendar</Source> schedules October Manufacturing for <strong>Monday 2 November at 10:00 ET</strong> and October Services for <strong>Wednesday 4 November at 10:00 ET</strong>. The upcoming numbers are not included in this frozen preview.</p>
    <h3>What would make the new ISM report convincing?</h3>
    <div className={styles.themes}>
     <section><h3>A high-quality growth reading</h3><p>New orders and production improve together, employment follows, and prices moderate. That would suggest demand is holding up without an equally large cost shock. Compare actual values with a dated like-for-like consensus before calling it a beat.</p></section>
     <section><h3>A misleading headline beat</h3><p>Supplier deliveries slow sharply, lifting the headline, while new orders and employment weaken. If prices stay high, companies could face both softer demand and expensive inputs. The headline number alone would conceal the trade-off.</p></section>
    </div>
    <p>Why does the bond market care? Firm prices can make rapid interest-rate relief less likely. Weak orders, meanwhile, can imply lower growth and eventual easing. Those forces may pull Treasury yields in opposite directions. A rising 2-year yield alongside weak orders would deserve a genuine divergence investigation rather than an invented one-line explanation.</p>
    <p><strong>The next test:</strong> record <em>actual, comparable consensus, previous, revisions, new orders, production, employment, prices and deliveries</em>. Then check 2-year and 10-year Treasury yields, DXY, S&amp;P 500 and semiconductors at matched 5-minute, 30-minute and closing windows, where reliable observations exist. Missing data must remain unknown.</p>
   </section>
   <section className={styles.section} id="labour">
    <p className={styles.kicker}>03 / US JOBS · 3–6 NOVEMBER / FED REPRICING TEST</p>
    <h2>Payroll growth is barely moving. That doesn't automatically mean a rate cut is coming.</h2>
    <p>September produced just <strong>29,000 new nonfarm jobs</strong>, with the unemployment rate at <strong>4.2%</strong>. The two prior months were also revised down by a combined <strong>60,000 jobs</strong>. That is a much thinner hiring backdrop than an economy with accelerating factory orders might suggest. <Source href={S.bls}>BLS September Employment Situation</Source>.</p>
    <p>Here is the awkward part. If businesses are still facing high input costs, weak hiring may not bring immediate inflation relief. A company might be reluctant to add staff while having little room to reduce prices. So lower jobs growth and sticky prices can coexist, complicating the market's neat “weak payrolls equals lower yields equals higher stocks” equation.</p>
    <p>Tuesday's JOLTS report can tell us whether job openings, hires and voluntary quits are weakening before layoffs spike. Wednesday's ADP measure is useful context but follows a different methodology and does <strong>not</strong> replace the BLS payroll survey. Thursday's productivity figures help distinguish wage growth from the cost of labour per unit of output.</p>
    <p>Friday's October Employment Situation is the principal test. But a stronger-than-expected payroll number could still be less bullish if hours worked fall or prior months are sharply revised lower. A weaker number might be less alarming if the unemployment rate holds, participation improves and revisions turn positive. The quality of the release matters more than the headline surprise.</p>
    <p>All release times in the table below are Eastern, from the <Source href={S.blsCalendar}>BLS calendar</Source> and <Source href={S.fedCalendar}>New York Fed calendar</Source>.</p>
    <div className={styles.cards}>
     {events.map(e=><div className={styles.company} key={e.day+e.name}>
      <div className={styles.companyHead}><div><strong>{e.day}</strong><span>{e.name}</span></div><small>{e.when}</small></div>
      <p>{e.test}</p>
     </div>)}
    </div>
    <p><strong>The next test:</strong> compare Friday's actual payrolls, unemployment, earnings, participation, hours and revisions against a source-dated pre-release consensus. Check whether short-dated yields move as expected, whether the move persists, and whether equities agree. Do not call a market reaction measured until the time window and instrument are documented.</p>
   </section>
   <section className={styles.section} id="earnings">
    <p className={styles.kicker}>04 / THE CONNECTING STORY / AI & POWER EARNINGS</p>
    <h2>Macro numbers can change the price investors are willing to pay for AI growth.</h2>
    <p>The same week brings Apple, Palantir, AMD, Super Micro, Eaton, Navitas, Uber, Qualcomm and other AI and electrical-infrastructure reporting. Those results will test separate businesses, but the wider negotiation is shared: how much revenue becomes profit and how much profit becomes actual free cash flow.</p>
    <p>Rising factory costs may squeeze supplier margins even while AI-related orders accelerate. Higher Treasury yields can also reduce the present value investors attach to profits expected many years from now. Both can be true without disproving the demand for artificial intelligence.</p>
    <p>Uber gives the autonomous-vehicle version of the argument. Robotaxis could expand its ride marketplace if cheaper supply attracts more passengers, but they could also reduce its bargaining power if fleet owners control the customer relationship. The deciding figures are contribution margins, gross bookings versus recognised revenue, insurance costs and cash generation—not merely a partnership announcement.</p>
    <p><Link href={link("/blue-desk/earnings-week")}>Read the full 16-company earnings investor test →</Link></p>
   </section>
   <section className={styles.section} id="verdict">
    <p className={styles.kicker}>05 / CONDITIONAL MARKET VERDICT</p>
    <h2>Three surprises are possible. The tape has to decide which dominates.</h2>
    <p><strong>Constructive:</strong> orders and earnings remain resilient, input-price pressure eases, payroll growth stabilises, and the election does not materially worsen the expected financing environment. That would support a better earnings-to-cash conversion case, but a stronger share-price trend still needs a dated breakout or relative-strength confirmation.</p>
    <p><strong>Adverse:</strong> AI revenue rises while supplier cash deteriorates, prices stay elevated despite slowing hiring, and long-end borrowing costs increase. That would put pressure on long-duration valuations and capital-intensive power projects, although companies with large cash balances could hold up better.</p>
    <p><strong>The competing explanation:</strong> the market may already have priced the likely election and earnings paths. Sharp initial moves could reflect positioning or options flows rather than a lasting regime change. Test the actual financial evidence against market reactions, then look for confirmation in yields, dollar strength and breadth.</p>
    <p className={styles.caveat}>This is the frozen research position before the events, not hindsight. Upcoming actuals, election results, whisper estimates, live valuation multiples and event-window price reactions are intentionally not invented. Source-qualified post-event analysis must carry a new timestamp and preserve this preview.</p>
    <p><Link href={link("/blue-desk/newsroom")}>Return to the live Newsroom wire →</Link></p>
   </section>
  </article>
 </main>;
}
