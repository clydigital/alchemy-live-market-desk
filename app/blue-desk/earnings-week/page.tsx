import Link from "next/link";
import {headers} from "next/headers";
import {blueDeskPublicHref} from "@/lib/blue-desk-host";
import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import styles from "./earnings-week.module.css";

export const metadata={
 title:"AI, Power and Robotaxi Earnings Week | Bluebelly",
 description:"Source-dated pre-earnings research for 2–6 November 2026: Apple, Palantir, AMD, Eaton, Super Micro, Navitas, Uber, Qualcomm and more.",
};

type Preview={
 ticker:string;name:string;time:string;business:string;test:string;counter:string;market:string;
 source:string;sourceName:string;confirmed?:boolean;
};
const week:readonly {day:string;label:string;companies:readonly Preview[]}[]=[
 {day:"Monday 2 November",label:"Consumer and enterprise AI",companies:[
  {ticker:"AAPL",name:"Apple",time:"After US close",business:"iPhone, devices and recurring services",
   test:"Does the iPhone upgrade cycle justify optimism about consumer AI? Separate device sales, services margin and China demand from the promise of future AI features.",
   counter:"A popular launch and supplier orders do not prove durable unit sell-through or incremental AI revenue.",
   market:"The consumer-demand test: AI needs paying customers, not only new chips.",
   source:"https://investor.apple.com/investor-relations/",sourceName:"Apple investor relations"},
  {ticker:"PLTR",name:"Palantir",time:"After US close · 17:00 ET webcast",business:"Enterprise and government operational AI software",
   test:"Compare US commercial customer growth and contract value against recognised revenue, margins, cash receipts and revised guidance.",
   counter:"Large contract awards may contain options; a very high valuation can demand more than another strong headline quarter.",
   market:"The enterprise AI test: are customers paying for operational usefulness at scale?",
   source:"https://investors.palantir.com/news-details/2026/Palantir-Announces-Date-of-Third-Quarter-2026-Earnings-Release-and-Webcast/",sourceName:"Palantir IR notice",confirmed:true},
 ]},
 {day:"Tuesday 3 November",label:"The AI hardware-to-power conversion chain",companies:[
  {ticker:"PFE",name:"Pfizer",time:"Before US open · 10:00 ET call",business:"Innovative medicines, oncology and vaccines",
   test:"Identify which new medicines and oncology products offset patent expiries and post-pandemic declines; compare adjusted profitability with operating cash, debt, interest and dividend coverage.",
   counter:"Cost savings can lift adjusted EPS without restoring sales or repairing the long-term exclusivity cliff.",
   market:"The healthcare test: can a pharmaceutical company finance its next growth engine from cash generation?",
   source:"https://www.pfizer.com/news/press-release/press-release-detail/pfizer-invites-public-view-and-listen-webcast-november-3",sourceName:"Pfizer IR announcement",confirmed:true},
 {ticker:"ETN",name:"Eaton",time:"Before US open · 11:00 ET call",business:"Electrical equipment and power-management systems",
   test:"The company previously guided to 13.5–15.5% Q3 organic growth, 24.6–25.0% segment margins and $3.46–3.56 adjusted EPS. Check order growth, Electrical Americas backlog and cash conversion against that issuer bar.",
   counter:"Backlog does not equal immediate profit: capacity, costs, acquisition effects and order timing can erode returns.",
   market:"The power bottleneck test: does data-centre spending turn into electrical orders and sustainable margins?",
   source:"https://www.eaton.com/us/en-us/company/news-insights/news-releases/2026/eaton-reports-record-second-quarter-2026-results.html",sourceName:"Eaton Q2 release and Q3 guidance",confirmed:true},
  {ticker:"AMD",name:"AMD",time:"After US close · 17:00 ET call",business:"CPUs and AI accelerator chips",
   test:"Examine data-centre accelerator growth, margin mix, cash generation, customer concentration and the economics of customer warrants.",
   counter:"Fast shipments can coexist with dilution, weaker incremental margins or expensive customer incentives.",
   market:"The Nvidia-alternative test: can the AI accelerator market sustain a second scaled profit pool?",
   source:"https://ir.amd.com/news-events/press-releases/detail/1300/amd-to-report-fiscal-third-quarter-2026-financial-results",sourceName:"AMD IR earnings notice",confirmed:true},
  {ticker:"SMCI",name:"Super Micro",time:"After US close · 17:00 ET call",business:"Rack-scale AI servers, integration and liquid cooling",
   test:"Its 20 October unaudited update estimated $18.5–19.5bn revenue and 12.0–12.5% gross margin, above prior guidance of $14.5–15.5bn and 10.4–10.8%. Verify final revenue, inventories, working capital and operating cash.",
   counter:"A revenue acceleration can consume cash through inventory and receivables; these are preliminary, not final audited results.",
   market:"The AI server test: does the order boom leave money after assembling and financing the hardware?",
   source:"https://ir.supermicro.com/news/news-details/2026/Supermicro-Provides-First-Quarter-of-Fiscal-Year-2027-Preliminary-Business-Update/default.aspx",sourceName:"Super Micro preliminary update",confirmed:true},
  {ticker:"ANET",name:"Arista Networks",time:"After US close · Earnings Whispers calendar",business:"High-speed data-centre networking",
   test:"Track cloud-titan demand, high-speed switching revenue, gross margin and forward order commentary.",
   counter:"Network upgrades may be lumpy, and customers can shift spending between hardware generations.",
   market:"The networking test: are AI clusters pulling through the switching and interconnect layer?",
   source:"https://www.arista.com/en/company/investors",sourceName:"Arista IR"},
  {ticker:"ALAB",name:"Astera Labs",time:"After US close · Earnings Whispers calendar",business:"Semiconductor connectivity for AI servers",
   test:"Examine connectivity revenue growth, customer concentration and the margin/volume trade-off as platform designs scale.",
   counter:"A large design win is not yet recurring cash and may depend on a handful of hyperscaler launches.",
   market:"The connectivity test: are advanced AI racks creating durable component franchises?",
   source:"https://ir.asteralabs.com/",sourceName:"Astera Labs IR"},
  {ticker:"NVTS",name:"Navitas",time:"After US close · 17:00 ET webcast",business:"GaN and SiC power semiconductors",
   test:"Look for AI data-centre power design wins converting into revenue, shipment volumes, gross margin, losses and cash runway.",
   counter:"A technically better power device is not proof of design adoption at commercial scale; financing and dilution also matter.",
   market:"The power-electronics test: can efficiency gains become an investable business?",
   source:"https://ir.navitassemi.com/events/event-details/navitas-semiconductor-q3-2026-earnings",sourceName:"Navitas IR event",confirmed:true},
 ]},
 {day:"Wednesday 4 November",label:"Robotaxis, edge AI and optical infrastructure",companies:[
  {ticker:"UBER",name:"Uber",time:"Before US open · 08:00 ET call",business:"Mobility and delivery marketplace",
   test:"Q2 management projected $58.25–60.25bn in Q3 gross bookings and $0.84–0.88 non-GAAP EPS. Compare growth and free cash flow with take-rate, insurance, driver economics and autonomous-vehicle partnership economics.",
   counter:"Robotaxis could lower fulfilment costs for Uber, but a fleet operator or competing app could capture economics instead. Partnerships alone do not establish unit profitability.",
   market:"The cybercab test: will autonomy make the marketplace more valuable, or weaken its middleman position?",
   source:"https://investor.uber.com/news-events/news/press-release-details/2026/Uber-Announces-Results-for-Second-Quarter-2026/default.aspx",sourceName:"Uber Q2 results and Q3 outlook",confirmed:true},
  {ticker:"QCOM",name:"Qualcomm",time:"After US close · 16:45 ET call",business:"Smartphone chips, licensing and automotive computing",
   test:"Track handset mix, licensing economics, automotive wins, edge-AI revenue and profitability beyond phones.",
   counter:"On-device AI features may raise silicon content without necessarily increasing end-user purchases or recurring software revenue.",
   market:"The edge-AI test: is AI spreading profitably from cloud infrastructure to devices?",
   source:"https://investor.qualcomm.com/news-events/press-releases/news-details/2026/Qualcomm-Schedules-Fourth-Quarter-and-Fiscal-2026-Earnings-Release-and-Conference-Call/default.aspx",sourceName:"Qualcomm IR notice",confirmed:true},
  {ticker:"ARM",name:"Arm",time:"After US close · Earnings Whispers calendar",business:"CPU architectures and chip intellectual-property royalties",
   test:"Separate licensing revenue, royalty rates, chip shipments and the AI/edge opportunity; monitor the timing of royalty recognition.",
   counter:"High AI adoption does not immediately convert into higher per-device royalties.",
   market:"The architecture test: which chip designers are capturing the value of AI compute?",
   source:"https://investors.arm.com/",sourceName:"Arm IR"},
  {ticker:"COHR",name:"Coherent",time:"After US close · Earnings Whispers calendar",business:"Optical components and data-centre photonics",
   test:"Watch datacentre optical orders, high-speed module margins, delivery capacity and reinvestment needs.",
   counter:"A capacity race can create cyclical oversupply or heavy investment ahead of shipment receipts.",
   market:"The optics test: are high-speed AI networks translating into optical revenue and cash?",
   source:"https://investor.coherent.com/",sourceName:"Coherent IR"},
 ]},
 {day:"Friday 6 November",label:"Healthcare cash burn and the electricity supply bet",companies:[
  {ticker:"MRNA",name:"Moderna",time:"Before US open · 08:00 ET call",business:"mRNA medicines and vaccine platform",
   test:"Compare respiratory franchise sales with R&D expense, product approvals, operating cash burn, liquidity and the time to sustainable non-COVID revenue.",
   counter:"A promising pipeline is not a sale, and trial successes can still require years of financing.",
   market:"The biotechnology capital test: can a platform sustain investment before repeatable earnings arrive?",
   source:"https://investors.modernatx.com/events-presentations",sourceName:"Moderna IR event",confirmed:true},
  {ticker:"OKLO",name:"Oklo",time:"Before US open · Earnings Whispers calendar",business:"Advanced nuclear power developer",
   test:"Separate binding power commitments, licensing milestones, project financing and expected generating capacity from operational electricity sales.",
   counter:"Power demand does not remove regulatory, construction, timing or dilution risk.",
   market:"The nuclear optionality test: who can actually supply baseload electricity to AI facilities?",
   source:"https://oklo.com/investors/",sourceName:"Oklo IR"},
  {ticker:"VST",name:"Vistra",time:"Before US open · Earnings Whispers calendar",business:"Power generation and electricity retail",
   test:"Look at contracted load demand, generation availability, hedging, free cash flow and the impact of power prices.",
   counter:"Higher electricity prices may help generators but can bring volatility, hedging losses and political scrutiny.",
   market:"The power-pricing test: is the AI electricity demand visible in contracted generator cash flows?",
   source:"https://investor.vistracorp.com/",sourceName:"Vistra IR"},
 ]},
];
const outlook=[{
 title:"The AI demand chain",text:"Apple tests the buyer; Palantir tests enterprise software budgets; AMD tests the chips; Super Micro assembles the racks; Arista, Astera and Coherent connect them. If orders rise throughout the chain but suppliers cannot generate incremental free cash flow, the spending cycle may be real while the investment returns remain questionable."
},{
 title:"The electricity bill",text:"Eaton and Navitas test near-term equipment spending, while Vistra and Oklo sit on very different sides of power generation: an operating fleet versus a development and permitting proposition. Do not confuse a data-centre memorandum of understanding with recurring delivered megawatt-hours."
},{
 title:"The autonomous-vehicle negotiation",text:"Uber can win if cheaper autonomous supply drives more trips through its marketplace. It can lose bargaining power if robotaxi operators own customer acquisition, dispatch and pricing. Watch who funds the vehicles, who insures them, and whether the platform captures the savings."
},{
 title:"The healthcare exception",text:"Pfizer and Moderna are useful counterweights to the AI story. Pfizer tests replacement-product profit and dividend coverage; Moderna tests cash runway and pipeline economics. The market's appetite for long-duration growth can be compared across sectors without pretending those businesses have the same risks."
}];
export default async function EarningsWeekPage(){
 const host=(await headers()).get("host");
 return <main className={styles.page} data-earnings-preview="source-dated-2026-11-02">
  <BlueDeskHeader activePath="/blue-desk/key-stories"/>
  <article className={styles.body}>
   <nav className={styles.back}><Link href={blueDeskPublicHref("/blue-desk/key-stories",host)}>← Key Stories</Link><Link href={blueDeskPublicHref("/blue-desk/calendar#earnings-hub",host)}>Earnings Hub</Link><Link href={blueDeskPublicHref("/blue-desk/newsroom",host)}>Newsroom</Link></nav>
   <header className={styles.hero}>
    <p className={styles.kicker}>BLUEBELLY / EARNINGS WEEK / 2–6 NOVEMBER 2026 · ET</p>
    <h1>The AI boom is reporting its numbers. Who actually keeps the cash?</h1>
    <p className={styles.lead}>Big Tech can keep promising an AI revolution. This week, the companies supplying the chips, servers, networking and electricity have to show how much money makes it through the chain. Uber adds a different question: could cybercabs enrich the platform—or make the middleman expendable?</p>
    <p className={styles.dated}><strong>PRE-EARNINGS EDITION · Research cut-off: 2 November 2026, before Monday's US close.</strong> This is a fixed preview, not automatically updated results. Check issuer releases when events occur. All times are US Eastern; after-close and before-open windows originate from Earnings Whispers unless an issuer call notice is linked.</p>
   </header>
   <section className={styles.section}>
    <p className={styles.kicker}>THE INVESTOR TEST</p>
    <h2>Demand is the pitch. Cash conversion is the deal.</h2>
    <p>The strongest earnings report will not necessarily be the one with the biggest revenue beat. A company can raise sales, build inventories, consume working capital or dilute shareholders and still leave owners with a disappointing return. The comparison that matters is <strong>what investors expected before the release versus what the company delivered—and what it now says comes next.</strong></p>
    <p>A beat without comparable consensus is not a verified beat. Company guidance, third-party consensus and an Earnings Whispers whisper estimate are separate measures. The latter is a market-expectation signal, not management guidance; no unverified whisper figures are reproduced here.</p>
   </section>
   <section className={styles.section}>
    <p className={styles.kicker}>THREE NUMBERS THAT CHANGE THE READ</p>
    <div className={styles.stats}>
     <div><strong>$18.5–19.5bn</strong><span>Super Micro's preliminary FY27 Q1 revenue estimate, raised from $14.5–15.5bn prior guidance</span></div>
     <div><strong>13.5–15.5%</strong><span>Eaton's earlier Q3 organic growth guidance; see its cash flow and 24.6–25.0% segment-margin target too</span></div>
     <div><strong>$58.25–60.25bn</strong><span>Uber's prior Q3 gross-bookings outlook: an activity measure, not Uber's net revenue</span></div>
    </div>
    <p className={styles.caveat}>These are company-stated preliminary estimates or prior guidance, not Q3 actual results. Source links appear in the company sections below.</p>
   </section>
   <section className={styles.section} id="week-ahead">
    <p className={styles.kicker}>EVENT-BY-EVENT / WHAT EACH RESULT SYMBOLISES</p>
    <h2>A single earnings week, four connected investment debates</h2>
    {week.map(group=><section key={group.day} className={styles.day}>
      <header className={styles.dayHead}><h3>{group.day}</h3><span>{group.label}</span></header>
      <div className={styles.cards}>{group.companies.map(c=><article className={styles.company} key={c.ticker} data-ticker={c.ticker}>
       <div className={styles.companyHead}><div><strong>{c.ticker}</strong><span>{c.name}</span></div><small>{c.time}</small></div>
       <p className={styles.kind}>{c.business}</p>
       <p><strong>The money question:</strong> {c.test}</p>
       <p><strong>The objection:</strong> {c.counter}</p>
       <p className={styles.spill}><strong>Why the rest of the market cares:</strong> {c.market}</p>
       <footer><a href={c.source} target="_blank" rel="noopener noreferrer">{c.sourceName} ↗</a><span>{c.confirmed?"Issuer event or prior guidance verified":"Earnings Whispers calendar timing; issuer date to confirm"}</span></footer>
      </article>)}</div>
    </section>)}
    <p className={styles.caveat}>Also reporting: Pfizer before Tuesday's open. Its main test is whether new drugs and oncology revenue can cover patent expiries, debt, cash needs and dividends. <a href="https://www.pfizer.com/news/press-release/press-release-detail/pfizer-invites-public-view-and-listen-webcast-november-3" target="_blank" rel="noopener noreferrer">Pfizer's 3 November analyst webcast ↗</a></p>
   </section>
   <section className={styles.section}>
    <p className={styles.kicker}>THE CROSS-COMPANY VERDICT</p><h2>What would change our view of the investment cycle?</h2>
    <div className={styles.themes}>{outlook.map(x=><section key={x.title}><h3>{x.title}</h3><p>{x.text}</p></section>)}</div>
    <p><strong>The constructive outcome:</strong> higher-quality orders translate into rising margins, operating cash and credible guidance without an outsized increase in debt or dilution. <strong>The adverse outcome:</strong> the supply chain records revenue growth but working-capital demands, capacity expenses and financing risks absorb the economic return.</p>
   </section>
   <section className={styles.section}>
    <p className={styles.kicker}>EVIDENCE RULES AND NEXT UPDATE</p><h2>What we still need before calling a beat</h2>
    <p>For each release compare fiscal-period-matched revenue and EPS, GAAP versus adjusted adjustments, like-for-like pre-release consensus, operating cash, cash capex, free cash flow, next-quarter guidance and stock reaction at a precisely observed time. Treat a share-price move as an observation, not proof of what caused it. A management statement is not an independent forecast.</p>
    <p><a href="https://www.earningswhispers.com/calweek/20261102" target="_blank" rel="noopener noreferrer">Earnings Whispers · week of 2 November · calendar and sentiment context ↗</a>. Company sources above determine official release details and results. No paid or login-gated whisper estimate has been assumed.</p>
    <p><Link href={blueDeskPublicHref("/blue-desk/calendar#earnings-hub",host)}>Follow the changing official calendar and verified results →</Link></p>
   </section>
  </article>
 </main>;
}
