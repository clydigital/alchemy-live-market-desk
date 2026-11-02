import Link from "next/link";
import type {ReactNode} from "react";
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

function Source({href,children}:{href:string;children:ReactNode}){
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
    <div id="midterm-views">
     <p className={styles.kicker}>CREATOR VS INSTITUTIONS / TWO DATED MEET KEVIN TRANSCRIPTS</p>
     <h3>Is every form of gridlock really the same?</h3>
     <p>Meet Kevin revisited the midterms in two videos: <Source href="https://www.youtube.com/watch?v=H1xVMX__KNc">7 October: How Midterms will F**K Up the Stock Market</Source> and <Source href="https://www.youtube.com/watch?v=7KqjagCM80I">1 November: How the Election will Damage Stocks: Prepare</Source>. These are creator commentary and scenarios, not verified election forecasts. Kevin also promotes a sponsored prediction-market platform in both videos. Its quoted odds are dated marketing-context data, not proof of a future result.</p>
     <p>His latest argument makes a distinction worth testing: <strong>a split House and Senate could produce three-way bargaining between the White House and two differently controlled chambers</strong>, whereas a Democratic sweep of Congress could reduce the number of negotiating parties to two. That does not mean Democrats and the president would agree on taxes, appropriations or appointments. It also does not remove Senate procedures or presidential veto power. Kevin describes his bargaining hypothesis at <strong>9:55–11:13</strong> in the 1 November video; it is an interpretation, not an observed agreement.</p>
     <div className={styles.cards}>
      <div className={styles.company}>
       <div className={styles.companyHead}><div><strong>Democratic sweep</strong></div><small>Democrats hold House + Senate; Republican president</small></div>
       <p><strong>Kevin:</strong> Fewer negotiating groups might permit cross-party funding bargains. His 7 October discussion also links reduced tax-cut capacity with a possible moderation in Treasury supply, and mentions healthcare, consumer spending and renewables. He distinguishes those from potential restrictions on data-centre construction.</p>
       <p className={styles.spill}><strong>Institutional countercase:</strong> <Source href="https://www.morganstanley.com/insights/articles/midterm-election-market-implications-institute-2026">Morgan Stanley Institute</Source> and <Source href="https://privatebank.jpmorgan.com/nam/en/insights/markets-and-investing/ideas-and-insights/the-midterms-can-change-spending-but-not-americas-fiscal-path">J.P. Morgan Private Bank</Source> do not assume major deficit repair. Spending deals can add borrowing, while vetoes and the Senate can block legislation. <strong>Test:</strong> actual spending agreements, Treasury issuance and the long-end yield response.</p>
      </div>
      <div className={styles.company}>
       <div className={styles.companyHead}><div><strong>Split Congress</strong></div><small>Democratic House + Republican Senate</small></div>
       <p><strong>Kevin:</strong> A budget dispute could involve more competing groups, lifting government-shutdown and debt-ceiling bargaining risks; disputes over data centres might persist into the next political cycle.</p>
       <p className={styles.spill}><strong>Institutional countercase:</strong> <Source href="https://am.gs.com/en-us/institutions/insights/article/2026/elections-policy-and-portfolio-implications">Goldman Sachs Asset Management</Source> expects divided government to restrict large fiscal changes. <Source href="https://www.ssga.com/us/en/institutional/insights/midterm-elections-policy-playbook-for-divided-government">State Street</Source> also sees fewer legislative surprises, though shutdowns and debt-ceiling disputes remain risks. A shutdown is possible, not automatic. <strong>Test:</strong> funding deadlines, legislative negotiations, Treasury term premium and sector-specific rules.</p>
      </div>
      <div className={styles.company}>
       <div className={styles.companyHead}><div><strong>Republican retention</strong></div><small>Republicans hold House + Senate and White House</small></div>
       <p><strong>Kevin:</strong> Continuing control could keep tax, defence and industrial-policy spending in play, while additional borrowing or inflation pressure could push yields higher. His suggested stimulus-cheque scenario is an unpassed policy proposal, not cash already owed to households.</p>
       <p className={styles.spill}><strong>Institutional countercase:</strong> <Source href="https://www.jpmorgan.com/insights/global-research/outlook/mid-year-outlook">J.P. Morgan Global Research</Source> and <Source href="https://am.gs.com/en-us/institutions/insights/article/2026/elections-policy-and-portfolio-implications">Goldman Sachs Asset Management</Source> highlight more fiscal policy latitude, not certainty about enacted spending or the sign of asset returns. Fiscal conservatives can still oppose new costs. <strong>Test:</strong> proposed bill text, funding, Treasury supply and US02Y/US10Y/US30Y reactions.</p>
      </div>
     </div>
     <h3>The AI twist: less construction could mean more cloud pricing power</h3>
     <p>Kevin's 7 October hypothesis is that permitting or financing delays can hold back smaller data-centre developers, leaving existing cloud giants more room to charge for scarce compute. But the same slowdown can postpone orders for electrical suppliers, networking equipment and power projects. Hyperscaler pricing power, new server shipments and the wider AI supply-chain economy can therefore move differently. No single congressional result establishes that outcome.</p>
     <p><Source href="https://www.morganstanley.com/insights/podcasts/thoughts-on-the-market/ai-investment-cycle-midterm-elections-ai-infrastructure-spending-ariana-salvatore">Morgan Stanley's 7 October original AI-policy analysis</Source> distinguishes the party-control signal for infrastructure investor sentiment from the project approvals controlled by states, utilities and local authorities. Zoning, electricity interconnection, power costs and water permits can delay a specific project regardless of who holds Congress. This is a more immediate observable test than Kevin's speculative trillion-dollar spending multiplier.</p>
     <p><strong>Bluebelly evidence boundary:</strong> Kevin's claim about bilateral bargaining is not Morgan Stanley's official position; his historical post-midterm return claim is not admitted without the exact sample and index-return method; his multitrillion-dollar AI construction arithmetic is not an approved GDP forecast. <Source href="https://www.morganstanley.com/insights/articles/2026-election-market-impact-investor-guide">Morgan Stanley Wealth Management</Source> and <Source href="https://privatebank.jpmorgan.com/nam/en/insights/markets-and-investing/ideas-and-insights/the-midterms-can-change-spending-but-not-americas-fiscal-path">J.P. Morgan Private Bank</Source> both emphasise corporate earnings, rates and existing fiscal pressures over automatic post-election rallies.</p>
     <p><strong>What would settle the argument?</strong> First, separate actual chamber-control declarations from media projections. Then look for agreed funding legislation and dated Treasury moves; later, inspect named data-centre permits, utility tariffs, grid connection dates and issuer capex/cash-flow guidance. Oil or ISM surprises occurring at the same time must not be retroactively attributed to the election.</p>
    </div>
   </section>
   <section className={styles.section} id="midterm-asset-views" data-midterm-crossasset="creator-attributed-frozen-2026-11-02">
    <p className={styles.kicker}>02 / MIDTERM BASE RATES MEET THE TAPE · STOCKEDUP &amp; FX EVOLUTION</p>
    <h2>The post-election rally happened every time. What if the chips and bonds are saying something else?</h2>
    <p><strong>A historical statistic is not a trade signal.</strong> StockedUp and FX Evolution independently point to a remarkable record: in <Source href="https://am.jpmorgan.com/us/en/asset-management/institutional/insights/market-insights/market-updates/on-the-minds-of-investors/how-do-markets-perform-post-midterms/">J.P. Morgan's study</Source>, the S&amp;P 500 advanced in the twelve months after each of the 19 US midterm elections from 1950 through 2022. <Source href="https://www.capitalgroup.com/institutions/lu/en/insights/articles/how-us-midterm-elections-affect-the-markets.html">Capital Group</Source> reports an approximately <strong>15.4% average twelve-month gain</strong>. But a widely quoted <Source href="https://www.schaeffersresearch.com/content/analysis/2022/10/26/what-election-day-means-for-the-s-p-500">2022 study</Source> finds approximately <strong>13.89% over six months</strong>, not twelve. The alleged universal <strong>13.80%</strong> lacks a fixed method and should not be published as a guaranteed return.</p>
    <p>These samples are small, start/end dates and price-versus-total-return conventions can differ, and broader histories do contain negative election-period results. Stocks have generally tended to rise over time even outside election windows. The 2026 set-up is also unlike a textbook pre-election correction: mega-cap AI investment, credit pricing, interest rates, oil disruptions and state-level data-centre regulation could outweigh the seasonal tendency. <Source href="https://www.msci.com/research-and-insights/quick-take/scenario-analysis-rates-ai-and-oil-may-matter-more-than-us-midterms">MSCI's 22 October scenario analysis</Source> finds no consistent historical post-midterm dollar or Treasury-yield direction.</p>
    <p><strong>Source distinction:</strong> the following are attributed market views from <Source href="https://www.youtube.com/watch?v=QT82i3qsHjs">StockedUp's 1 November, 17-minute video</Source> and <Source href="https://www.youtube.com/watch?v=vYAAtuF8_Cs">FX Evolution's 31 October, 34-minute video</Source>. English captions were checked on 2 November. Chart levels and suspected large trades are their recorded observations, not independently confirmed live readings. No creator claim is canonical Bluebelly market evidence.</p>
    <div className={styles.cards}>
     <div className={styles.company}>
      <div className={styles.companyHead}><div><strong>US equities: SPY, QQQ, volatility</strong></div><small>Seasonal bull / immediate bear conflict</small></div>
      <p><strong>StockedUp <Source href="https://www.youtube.com/watch?v=QT82i3qsHjs&t=371s">6:11–9:26</Source>:</strong> SPY has lower highs; $750 is a near-term support, and reclaiming $760 would improve the upside argument. UVXY and inverse leveraged SPXS are short-duration bearish expressions if support gives way. Yet the creator remains constructive on the six-to-twelve-month post-midterm record. A short-term downside trade and a long-horizon bullish base rate are not logically incompatible.</p>
      <p><strong>FX Evolution <Source href="https://www.youtube.com/watch?v=vYAAtuF8_Cs&t=1804s">30:04</Source>:</strong> QQQ $680 and SPY $750 were modelled as key 200-day/put-support zones; a break could amplify selling in a negative-gamma market. <strong>The catch:</strong> gamma levels are vendor-model estimates, not exchange-certified floors; volatility products have daily-reset or futures-roll risk. <strong>Next test:</strong> exact instrument and dated 4H/daily 200-day prices, ETF versus index, 5/30-minute reaction, equal-weight breadth and follow-through rather than a touch of a round number.</p>
     </div>
     <div className={styles.company}>
      <div className={styles.companyHead}><div><strong>Semiconductors, hyperscalers &amp; AI credit</strong></div><small>SMH / SOXX / NVDA / GOOG / AMZN / MSFT / AMD</small></div>
      <p><strong>FX Evolution <Source href="https://www.youtube.com/watch?v=vYAAtuF8_Cs&t=316s">5:16–8:50</Source>:</strong> a failed semiconductor 200-day moving-average reclaim can turn a correction into persistent lower highs. Its historical greater-than-30% decline comparisons are <em>selected analogies</em>, not a matched backtest or a forecast. FXE also questions whether expensive data-centre expansion will generate cash quickly enough to justify investment and refinancing costs.</p>
      <p><strong>Independent check:</strong> <Source href="https://www.sec.gov/Archives/edgar/data/1652044/000165204426000080/googexhibit991q32026.htm">Alphabet's Q3 issuer filing</Source> reports Cloud revenue up 103% to $30.7bn: AI-related demand can be strong even when investors dislike future spending and cash conversion. <strong>Next test:</strong> semiconductor index daily 200-day hold/retest, cash capex versus operating cash flow and GAAP basis, credit spreads/CDS on matched dates, AMD earnings, guidance, and underlying actual cloud customer demand.</p>
     </div>
     <div className={styles.company}>
      <div className={styles.companyHead}><div><strong>Credit, US yields, dollar &amp; breadth</strong></div><small>CCC debt / US02Y / US10Y / DXY / RSP</small></div>
      <p><strong>FX Evolution <Source href="https://www.youtube.com/watch?v=vYAAtuF8_Cs&t=1154s">19:14–21:23</Source>:</strong> high-risk corporate yields reportedly near 18% and elevated CDS may be a warning before broader equities crack; healthcare, equal-weight and some discretionary shares simultaneously look resilient. That rotation is an important <em>counterargument</em> to an immediate economy-wide collapse.</p>
      <p><strong>Evidence caution:</strong> a CCC <em>effective yield</em> is not its option-adjusted <em>credit spread</em>, and a high yield alone does not establish a new credit freeze. <strong>Next test:</strong> match FRED/ICE broad HY and CCC spreads by date, verified financing/issuance, 2Y/10Y Treasury moves, DXY daily 20 EMA and RSP-versus-cap-weight relative strength. The election itself does not predetermine the dollar or Treasury outcome.</p>
     </div>
     <div className={styles.company}>
      <div className={styles.companyHead}><div><strong>Energy, commodities &amp; international shares</strong></div><small>XLE / XOM / CVX / Brent / VGK / gold / copper</small></div>
      <p><strong>StockedUp <Source href="https://www.youtube.com/watch?v=QT82i3qsHjs&t=566s">9:26</Source>:</strong> XLE remains a preferred relative-strength exposure while Hormuz shipping risk and refinery outages support producer economics. <Source href="https://www.youtube.com/watch?v=QT82i3qsHjs&t=713s">At 11:53</Source> the same creator argues for downside in VGK, European equities, on a broken uptrend. These are two separate market hypotheses.</p>
      <p><strong>FX Evolution <Source href="https://www.youtube.com/watch?v=vYAAtuF8_Cs&t=1610s">26:50–29:49</Source>:</strong> gold has struggled, copper's reversal might flag slower AI infrastructure orders, while oil services remain relatively strong. <strong>Countercase:</strong> a drop in gold can be temporary liquidity selling; copper demand and price also depend on mine supply and China, and stronger crude does not ensure every oil equity gains. <strong>Next test:</strong> verified Brent and diesel crack spreads, UKMTO shipping updates, relative-strength closes, DXY/real yields and European FX effects. Claims of multiple mine-struck ships remain incident-specific and must be checked against original maritime notices.</p>
     </div>
     <div className={styles.company}>
      <div className={styles.companyHead}><div><strong>Stock-specific opportunities &amp; risks</strong></div><small>PLTR / TSLA / AAPL / BA / RDDT / INTC</small></div>
      <p><strong>StockedUp <Source href="https://www.youtube.com/watch?v=QT82i3qsHjs&t=649s">10:49</Source>:</strong> PLTR under creator-chart $183 supports a short-lived pre-earnings downside idea, <em>not</em> a recommendation to hold options through earnings. The creator also mentions TSLA relative strength and an alleged $3.3m Boeing September 2027 $195 call <Source href="https://www.youtube.com/watch?v=QT82i3qsHjs&t=825s">at 13:45</Source>. Neither a prediction-market Tesla–SpaceX merger percentage nor a single reported option block proves a merger or informed buying.</p>
      <p><strong>FX Evolution <Source href="https://www.youtube.com/watch?v=vYAAtuF8_Cs&t=1380s">23:00–26:00</Source>:</strong> TSLA $400, AAPL daily 20, Amazon $227 bounce and semiconductor/Google support are dated chart observations; Reddit's reported Google referral losses illustrate another AI revenue channel beyond chip sales. <strong>Next test:</strong> original issuer results, comparable expectations and guidance, option opening/closing data, actual market price clock and an invalidation level. <Source href="https://investors.palantir.com/news-details/2026/Palantir-Announces-Date-of-Third-Quarter-2026-Earnings-Release-and-Webcast/">PLTR issuer</Source> schedules 2 November after-close results, 5:00 p.m. ET webcast.</p>
     </div>
     <div className={styles.company}>
      <div className={styles.companyHead}><div><strong>Crypto &amp; broader liquidity</strong></div><small>BTC / IBIT / Binance / speculative assets</small></div>
      <p><strong>FX Evolution <Source href="https://www.youtube.com/watch?v=vYAAtuF8_Cs&t=945s">15:45</Source>:</strong> Bitcoin seemed relatively resilient despite a reported major Binance security event and rising cross-asset stress. A large <em>potential exposure</em> is not proof the full amount was stolen or lost. <strong>Next test:</strong> Binance's dated incident bulletins and customer-withdrawal status, independently observed exchange flows, BTC/IBIT prices and volatility, together with real yields and dollar liquidity. A credit-driven sell-off could weigh on speculative assets without changing Bitcoin's long-term thesis.</p>
     </div>
    </div>
    <h3>The next fork: election relief or a broken seasonal pattern?</h3>
    <div className={styles.themes}>
     <section><h3>Relief: risk clears before damage spreads</h3><p>Election results are near expectations, oil shipping stabilises, job data do not reprice yields higher, and semiconductors reclaim and hold their daily 200-day moving average. QQQ/SPY improve with RSP breadth and credit spreads stabilise. Historical post-midterm strength is context, not the cause of the move.</p></section>
     <section><h3>Stress: earnings and financing overwhelm seasonality</h3><p>Hormuz risk raises energy costs, rate repricing lifts financing pressure, chipmakers fail the 200-day reclaim, AI capex guidance disappoints and high-yield spreads rise while SPY/QQQ lose support with worsening breadth. A historical 19/19 sample offers no protection from a fresh earnings or credit shock.</p></section>
    </div>
    <p><strong>An election risk that doesn't show up in the S&amp;P statistic:</strong> data-centre development is contested at state and local levels. <Source href="https://www.spglobal.com/energy/en/news-research/latest-news/electric-power/100126-data-center-backlash-shapes-midterm-ballots-campaigns-across-us">S&amp;P Global</Source> identified 34 data-centre-related ballot measures across eight states for this election, including 20 in Ohio. Local electricity cost allocation, planning and grid connections may affect cloud developers, utilities and construction suppliers differently, even if the index rallies.</p>
    <p><strong>What happens next:</strong> Tuesday <strong>3 November</strong> midterms and September JOLTS at <strong>10:00 ET</strong>; Friday <strong>6 November</strong> October payrolls at <strong>08:30 ET</strong>; Tuesday <strong>10 November</strong> October CPI at <strong>08:30 ET</strong> (<Source href="https://www.bls.gov/schedule/2026/11_sched_list.htm">BLS official calendar</Source>). Palantir reports after Monday's US close. Record the frozen expectations before each event; only then compare actual rates, credit, sectors and stock reactions. Both <strong>crash and durable rebound remain unconfirmed</strong>.</p>
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
    <p><strong>The next test:</strong> record <em>actual, comparable consensus, previous, revisions, new orders, production, employment, prices and deliveries</em>. Then check 2-year and 10-year Treasury yields, DXY, S&amp;P 500 and semiconductors using time-matched 5-minute, 30-minute and closing windows, where reliable observations exist. Missing data must remain unknown.</p>
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
