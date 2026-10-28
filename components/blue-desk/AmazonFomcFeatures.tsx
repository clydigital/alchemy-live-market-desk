import s from "./RbnzDecisionFeature.module.css";
import EditorialFeatureTweets from "./EditorialFeatureTweets";
const amzn="https://ir.aboutamazon.com/news-release/news-release-details/2026/Amazon-com-Announces-Second-Quarter-Results/default.aspx";
const fed="https://www.federalreserve.gov/newsevents/pressreleases/monetary20261028a.htm";
const treasury="https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve&field_tdr_date_value_month=202610";
function Source({href,children}:{href:string;children:React.ReactNode}){return <a href={href} target="_blank" rel="noopener noreferrer">{children} ↗</a>;}
export const EDITORIAL_FEATURES=[
 {id:"amazon-cash-test-october-2026",title:"Amazon must show what the AI build-out earns",summary:"Ahead of its 29 October earnings: the cash, capacity and commitment questions sharpened by its rivals' reports."},
 {id:"fomc-october-2026",title:"Fed holds, but the borrowing bill stays high",summary:"What the split vote, Warsh's reported remarks and a steeper yield curve mean for the next decision."},
] as const;
export default function AmazonFomcFeatures({kind}:{kind:"amazon"|"fomc"}){
 const amazon=kind==="amazon";
 return <article className={s.feature} data-editorial-feature={amazon?EDITORIAL_FEATURES[0].id:EDITORIAL_FEATURES[1].id}>
  <header className={s.hero} style={{gridTemplateColumns:"1fr"}}><div className={s.heroMain}>
   <p className={s.eyebrow}>BLUEBELLY / {amazon?"AMAZON EARNINGS PREVIEW":"FOMC EXPLAINED"}</p>
   <p className={s.edition}>DATED EDITORIAL ANALYSIS · 29 OCTOBER 2026</p>
   <h1 style={{fontSize:"clamp(32px,4.6vw,60px)",lineHeight:1.1,letterSpacing:"-.035em",maxWidth:"22ch",margin:"0 0 20px"}}>{EDITORIAL_FEATURES[amazon?0:1].title}</h1>
   <p className={s.deck}>{amazon?"A full order book gets Amazon into the room. Investors still need to know what the expansion costs, who funds it and when the cash comes back.":"The Fed left rates alone. Two officials wanted a hike, while longer-term borrowing costs rose. The decision bought time without settling the inflation argument."}</p>
   <p className={s.heroTime}>{amazon?"PRE-RESULTS EDITION · Call scheduled 29 Oct 2026, 17:00 ET. This is not a Q3 results report.":"Decision: 28 Oct 2026, 14:00 ET · Treasury observations near 15:30 ET. These are dated observations, not live quotes."}</p>
  </div></header>
  <div className={s.bodyGrid}><div className={s.storyColumn}>
  {amazon?<>
   <section className={s.articleSection}><h2>First, listen to the pitch</h2>
    <p>Imagine an entrepreneur arriving with a growing list of customers and asking for another enormous investment. The opportunity may be real. But the investor's next question is what each additional sale earns after paying for the equipment needed to deliver it.</p>
    <p>That is the useful way to approach Amazon's next report. A strong AWS number would support demand. It would not, by itself, answer whether the expanding infrastructure is producing enough cash.</p>
    <p>In its July release, Amazon reported AWS quarterly sales of $42.2bn and operating income of $16.6bn. It guided third-quarter group sales to $197–202bn and operating income to $22.5–26.5bn. These are the company's prior figures and guidance, not new results. <Source href={amzn}>Original Amazon release</Source></p>
   </section>
   <section className={s.articleSection}><h2>Then ask what kind of profit it is</h2>
    <p>Amazon's second-quarter net income included $53.4bn of non-operating pre-tax other income, primarily from Anthropic investments. Meanwhile, trailing-year operating cash reached $161.4bn but free cash flow was a $7.6bn outflow as infrastructure spending grew. <Source href={amzn}>Profit and cash-flow disclosures</Source></p>
    <div className={s.learning}><strong>Learning moment · A higher investment value is not a customer payment</strong><p>A stake in another company can become more valuable and lift reported earnings without sending cash into the business. It can be a real asset. It still needs to be separated from the recurring earnings that pay salaries, interest and construction bills.</p></div>
    <p>So a headline EPS beat needs a second look. Did AWS, advertising and retail operations earn more, or did investments account for the surprise? Before comparing EPS with consensus, establish whether the estimate and reported result use the same accounting basis.</p>
   </section>
   <section className={s.articleSection}><h2>The other earnings sharpen the questions</h2>
    <p>Alphabet's release showed strong Cloud growth alongside negative quarterly free cash flow. Its Cloud revenue also includes TPU system sales, and shared AI research costs sit outside the segment. The lesson for Amazon is to distinguish product mix, segment profit and the full investment bill. <Source href="https://www.sec.gov/Archives/edgar/data/1652044/000165204426000080/googexhibit991q32026.htm">Alphabet Q3 release</Source></p>
    <p>Microsoft's statements show positive cash generation after cash equipment purchases. But it previously explained that changing building lives shifts more new leases into operating classification, outside reported capex. A lower spending headline therefore needs a like-for-like comparison. <Source href="https://www.microsoft.com/en-us/investor/events/fy-2026/earnings-fy-2026-q4">Microsoft's July explanation</Source></p>
    <p>Meta's latest filing discloses substantial leases that have not begun and other contractual commitments. That makes Amazon's future bills relevant alongside today's cash balance. These commitments are spread over years; they must not be added indiscriminately or described as debt due immediately. <Source href="https://www.sec.gov/Archives/edgar/data/1326801/000162828026066773/meta-20260930.htm">Meta September filing</Source></p>
   </section>
   <section className={s.articleSection}><h2>What would reassure investors—and what could scare them?</h2>
    <p>These are analytical tests, not a poll of investors. Reassuring evidence would connect rising paid usage with operating profit, collections and a clearer route to cash left over after investment.</p>
    <p>The uncomfortable combination would be slower AWS growth, weaker margins and another spending increase without quantified returns. More bookings would offer little comfort if customers were slow to use or pay for the capacity.</p>
    <p>Watch the funding explanation too. New leases, purchase commitments or financing are not automatically bad. They become more concerning when they reduce flexibility while returns remain uncertain.</p>
    <p>Retail and advertising also belong in the story: a stronger existing business can help finance the expansion. Fuel, delivery costs, discounting or weaker consumers could narrow that cushion.</p>
    <div className={s.learning}><strong>Learning moment · Sold out is not the same as paid back</strong><p>A booking describes future delivery. An investment return depends on price, utilisation, running costs and collections over time. Lower cost per task helps, but rising usage can still increase the total bill.</p></div>
   </section>
   <section className={s.articleSection}><h2>The verdict waits for the cash and the guidance</h2>
    <p>The strongest outcome would be growth accompanied by improving cash conversion and credible future spending discipline. A small revenue beat could disappoint if the forward funding bill worsens. Lower capex with stronger profit and cash could be healthy digestion rather than a failed AI strategy.</p>
    <p>Amazon's call is scheduled for 29 October at 17:00 ET. This edition contains no Q3 actuals, claimed surprise or post-release price reaction. Read the release, cash-flow reconciliation and call together before reaching a judgement. <Source href="https://www.aboutamazon.com/news/company-news/amazon-earnings-q3-2026-report">Official event announcement</Source></p>
   </section>
  </>:<>
   <section className={s.articleSection}><h2>The quiet headline has a disagreement underneath</h2>
    <p>The Fed kept its target range at 3.75–4.00% by a 10–2 vote. Lisa Cook and Beth Hammack preferred a quarter-point increase. The statement described strong activity and investment while inflation remained elevated. <Source href={fed}>Official statement, 14:00 ET</Source></p>
    <p>For someone deciding whether to borrow for a business, a hold is not a promise that cheaper money is coming. It means the committee chose not to change the price today.</p>
    <p>The important line was “The Committee will deliver price stability.” It expresses resolve without promising a particular December decision. The two dissents show that the argument about further tightening is already inside the room.</p>
    <div className={s.learning}><strong>Learning moment · The decision and the next decision are different questions</strong><p>Markets care about the path of rates, not only today's setting. A hold can coexist with a greater risk of a later hike. Calling it automatically dovish would skip that distinction.</p></div>
   </section>
   <section className={s.articleSection}><h2>Warsh offers a reason to wait</h2>
    <p>Reuters reports that Warsh did not judge the economy to be running too hot and pointed to improved productivity, while acknowledging that it is difficult to measure precisely. This is attributed reporting; the full official press-conference transcript was not available at this edition's source check. <Source href="https://www.investing.com/news/economy-news/feds-warsh-says-us-economy-not-running-too-hot-4980529">Reuters, 28 October, 15:30 ET</Source></p>
    <p>Here is the economic distinction: output can grow because spending outruns supply, or because businesses become capable of producing more. The first can intensify inflation. The second can support growth without the same pressure on prices.</p>
    <p>That leaves a real judgement call. Waiting allows more evidence to arrive. Acting sooner could help prevent persistent price pressure. Neither argument establishes that AI has solved inflation or that further hikes are inevitable.</p>
   </section>
   <section className={s.articleSection}><h2>The market does not give one simple verdict</h2>
    <p>Reuters' later reaction snapshot described modest equity gains, a softer dollar and a lower two-year yield alongside higher long yields. Its interviews also captured disagreement: Facet's Tom Graff favoured earlier tightening; Luttner Financial's Ronald Gestiehr supported waiting to avoid excessive pressure on consumers. These are named opinions, not a sentiment survey. <Source href="https://au.investing.com/news/economy-news/fomc-holds-rates-steady-markets-mostly-follow-suit-4722684">Reuters reaction roundup</Source></p>
    <p>That is why the first statement reaction and the later press conference should be kept separate. New information and positioning can change the response during the afternoon. We do not have a synchronised five-minute event study establishing what caused each move.</p>
   </section>
   <section className={s.articleSection}><h2>The catch: long-term money became more expensive</h2>
    <p>Treasury's indicative par yields near 15:30 ET on 28 October put the two-year at 4.67%, down 3 basis points from the prior day; the ten-year at 5.05%, up 6; and the thirty-year at 5.37%, up 7. The thirty-year-minus-two-year gap widened from 60 to 70 basis points. <Source href={treasury}>Official named-tenor observations</Source></p>
    <div className={s.learning}><strong>Learning moment · A Fed hold does not freeze your borrowing bill</strong><p>Long-term yields incorporate expectations of future policy, inflation and compensation for holding risk. Corporate borrowing also includes credit risk. The Fed controls its short-rate target, not every loan's rate.</p></div>
    <p>The daily curve confirms steepening. It does not isolate inflation, issuance, term premium or the Fed as the cause. For the AI builders, the practical implication is conditional: strong operating cash provides flexibility when long-term finance remains expensive.</p>
   </section>
   <section className={s.articleSection}><h2>What would make the next answer different?</h2>
    <p>The working interpretation is that the Fed bought time without removing inflation risk. Persistent price pressure would strengthen the case for action. Broad disinflation alongside resilient output would make waiting easier to defend.</p>
    <p>Watch incoming inflation, employment and activity data, then compare short rates with longer yields and corporate credit. A fall in yields driven by recession fears would tell a different story from a fall driven by benign disinflation.</p>
    <p>The same test applies as in an investment pitch: which new observation would change the judgement? Neither a confident speech nor one afternoon's stock gains settles the case. This feature records the October meeting; it is not live guidance or a guaranteed trading outcome.</p>
   </section>
  </>}
  <EditorialFeatureTweets kind={kind}/>
  </div><aside className={s.rail} aria-label="Reading guide"><div className={s.railCard}>
   <p className={s.railEyebrow}>{amazon?"THE INVESTOR'S QUESTION":"THE POLICY QUESTION"}</p>
   <h3>{amazon?"Does growth leave cash over?":"Can inflation fall without another hike?"}</h3>
   <p>{amazon?"Separate operating earnings, investment gains, cash capex and future commitments. This is a dated preview, not a result.":"Separate the official decision, attributed remarks, measured market observations and our interpretation."}</p>
   <Source href={amazon?amzn:fed}>Read original evidence</Source>
  </div></aside></div>
 </article>;
}
