import Link from "next/link";
import {blueDeskPublicHref} from "@/lib/blue-desk-host";
import css from "./nov14-market-investigation.module.css";

/**
 * An immutable, manually source-reviewed editorial edition.
 * This module does not read private records, write canonical Story/Regime/Motion,
 * fabricate a current quote, or control an automatic market score.
 */
export const NOV14_RESEARCH_EDITION="2026-11-14";
type Source={name:string;url:string;date:string;kind:"PRIMARY"|"OFFICIAL"|"REPORTING"};
type Story={id:string;number:string;topic:string;title:string;deck:string;status:string;
  confirmed:string[];interpretation:string;countercase:string;watch:string;
  consequences:string[];sources:Source[]};
const STORIES:readonly Story[]=[
  {
    id:"nvidia-governance",number:"01",topic:"NVIDIA / EARNINGS",
    title:"NVIDIA's governance shock: can the business survive the valuation reset?",
    deck:"A leadership crisis is confirmed. An orders collapse is not. The 17 November earnings release becomes the cleanest test of whether the operating business and the equity risk premium are moving in opposite directions.",
    status:"CONFIRMED TRANSITION · REPORTED ALLEGATIONS",
    confirmed:[
      "12 November: NVIDIA announced Jensen Huang's immediate resignation. CFO Colette Kress is interim CEO and Harvey Jones chairs the board. The succession search remains open.",
      "The last reported Q2 FY2027 revenue was $96.221bn, with 75.0% non-GAAP gross margin. Its existing Q3 revenue outlook is $108bn ±2%, with 74.0% gross margin ±50bp.",
      "The company excluded China Data Center compute revenue from that Q3 outlook before the scandal. That does not make every indirect China exposure zero.",
      "Reuters reported questions about Huang's earlier explanations of his personal relationship to executives. Reported intelligence suspicions remain unproven publicly, and are not established findings of misconduct."
    ],
    interpretation:"The bear case requires more than a falling share price: actual damage to demand, export access, governance credibility, customer financing, margins or forward guidance. Conversely, unchanged operating guidance alone may not restore the prior valuation multiple.",
    countercase:"A near-term earnings beat could coexist with a prolonged governance discount, especially if the market demands a clearer successor and tighter oversight. An earnings miss would require distinguishing operational disruption from a high pre-event expectation bar.",
    watch:"17 November, approximately 1:20 p.m. PT results and 2 p.m. PT conference call: revenue versus the contemporaneous consensus and original $108bn guide; new outlook; gross margin; customer commitments; cash conversion; named board/governance action.",
    consequences:["NVIDIA / AI hardware: profit durability versus discount-rate and governance shocks","Cloud buyers: check actual procurement prices and chip deliveries before assuming a windfall","AI financing: compare paid demand, receivables and order cancellations; do not infer a credit crisis from stock prices"],
    sources:[
      {name:"NVIDIA CEO transition",url:"https://nvidianews.nvidia.com/news/nvidia-announces-ceo-transition",date:"12 Nov 2026",kind:"PRIMARY"},
      {name:"NVIDIA Q2 FY2027 results and Q3 guidance",url:"https://investor.nvidia.com/news/press-release-details/2026/NVIDIA-Announces-Financial-Results-for-Second-Quarter-Fiscal-2027/",date:"26 Aug 2026",kind:"PRIMARY"},
      {name:"NVIDIA 17 November earnings schedule",url:"https://investor.nvidia.com/news/press-release-details/2026/NVIDIA-Sets-Conference-Call-for-Third-Quarter-Financial-Results/",date:"28 Oct 2026",kind:"PRIMARY"},
      {name:"Reuters: executives' explanations and investigation",url:"https://www.reuters.com/world/china/ex-nvidia-ceo-misled-top-lawyer-affair-with-chinese-businesswoman-sources-say-2026-11-14/",date:"14 Nov 2026",kind:"REPORTING"}
    ]
  },
  {
    id:"chip-policy",number:"02",topic:"POLICY / CHINA",
    title:"A China-chip crackdown is not automatically a US-cloud windfall",
    deck:"The political question is which export decisions actually change order economics. Different actors may want tighter security, more US sales, cheaper computing capacity or faster domestic Chinese substitution.",
    status:"SCENARIO · NO NEW RULE ASSUMED",
    confirmed:[
      "NVIDIA's previous Q3 company outlook assumed no China Data Center compute revenue.",
      "The announced leadership transition does not itself constitute a new Commerce Department export rule or a finding that US intellectual property was compromised.",
      "AI export restrictions affect licensing, buyers, intermediaries and product classes differently; a blanket conclusion about all sales is not supported by a single allegation."
    ],
    interpretation:"A targeted blacklisting decision could mostly affect specific buyers and compliance costs. Broad restrictions could change longer-run market access. Reallocating unsold chips domestically might help US AI developers only if supply, allocation or effective procurement costs actually change.",
    countercase:"Strong global demand and NVIDIA's pricing power could preserve GPU prices even with tighter restrictions. US hyperscalers also need energy, networks, capital and profitable utilisation; more available chips are not inherently a margin improvement.",
    watch:"Watch official Commerce/BIS decisions, license revocations, Entity List changes, supplier delivery disclosures and cloud-customer capital spending. Compare their actual dates to subsequent price changes.",
    consequences:["NVIDIA: potential market-access and compliance effects, not a mathematically automatic loss of guided China compute sales","MSFT / GOOGL / AMZN: conditional supply-access advantage, not verified cheaper GPUs","AMD / AVGO / domestic Chinese chips: substitution outcomes depend on performance, software, fabrication and customer procurement"],
    sources:[
      {name:"NVIDIA company outlook excluding China compute",url:"https://investor.nvidia.com/news/press-release-details/2026/NVIDIA-Announces-Financial-Results-for-Second-Quarter-Fiscal-2027/",date:"26 Aug 2026",kind:"PRIMARY"},
      {name:"US BIS Entity List and regulatory notices",url:"https://www.bis.gov/entity-list",date:"Policy source, monitor",kind:"OFFICIAL"},
      {name:"NVIDIA CEO transition",url:"https://nvidianews.nvidia.com/news/nvidia-announces-ceo-transition",date:"12 Nov 2026",kind:"PRIMARY"}
    ]
  },
  {
    id:"ai-divergence",number:"03",topic:"SEMICONDUCTORS / CREDIT",
    title:"AI's split: strong hardware demand, weak equity tape and expensive financing",
    deck:"A resilient chip-order cycle and stressed AI-infrastructure equity values can coexist. Market breadth, financing costs and cash conversion decide whether this is a selective correction or broader contagion.",
    status:"MIXED EVIDENCE · NOT A SYSTEMIC-CRASH VERDICT",
    confirmed:[
      "Cisco reported $18.5bn Q1 FY2027 revenue (+24% YoY), non-GAAP EPS $1.40 (+40%) and raised full-year guidance, while investors still repriced its shares.",
      "CoreWeave reported Q3 2026 revenue of $3.661bn and $846m net interest expense; its updated full-year guidance includes $37bn–$39bn of capital spending.",
      "Nebius reported $980.8m Q3 revenue; some expected capacity is delayed and its initial 2027 outlook envisages $40bn–$45bn of capex. Those are forecasts, not spent cash.",
      "The broad equity, semiconductor and credit observations do not share identical source clocks; a weakness in chips is not enough to prove forced selling or credit contagion."
    ],
    interpretation:"Separate (1) earnings-backed hardware demand, (2) the economics of leveraged compute builders, (3) the valuation of AI users, and (4) broad market risk. Compare expected versus reported results rather than treating all AI tickers as one trade.",
    countercase:"An oversold rally can be short-covering. Conversely, narrowing broad credit spreads and healthy hyperscaler spending would challenge an immediate systemic-crash thesis even while several AI stocks stay under pressure.",
    watch:"Use matched-session SMH/QQQ and RSP/SPY returns, HY/CCC spread vintages, issuer interest and cash-flow disclosures, paid utilisation and next-quarter guidance. Technical RSI and EMA-band breaks are observations, not automatic bottom calls.",
    consequences:["NVDA / SMH: distinguish rebound from durable breadth participation","CSCO: raised guidance alongside a weaker tape requires a valuation-and-expectations test","CRWV / NBIS: refinancing, interest expense, project delays and customer prepayments may dominate equity outcomes"],
    sources:[
      {name:"Cisco fiscal Q1 2027 results",url:"https://investor.cisco.com/news/news-details/2026/CISCO-REPORTS-FIRST-QUARTER-EARNINGS/default.aspx",date:"12 Nov 2026",kind:"PRIMARY"},
      {name:"CoreWeave Q3 2026 SEC-filed results",url:"https://www.sec.gov/Archives/edgar/data/1769628/000176962826000461/coreweave3q26earningspress.htm",date:"10 Nov 2026",kind:"PRIMARY"},
      {name:"Nebius Q3 investor release",url:"https://nebius.com/investor-hub",date:"12 Nov 2026",kind:"PRIMARY"},
      {name:"FRED broad US HY credit spread",url:"https://fred.stlouisfed.org/series/BAMLH0A0HYM2",date:"Latest available observation; check date",kind:"OFFICIAL"}
    ]
  },
  {
    id:"faa-groundstop",number:"04",topic:"AVIATION / INFRASTRUCTURE",
    title:"The FAA reopened the skies. The precise network trigger remains open.",
    deck:"Officials attributed Friday's nationwide ground stop to data overload on ageing telecom routers and switches. A confirmed technical failure is not proof of cyberattack, AI-system failure or a funded contractor windfall.",
    status:"GROUND STOP LIFTED · ROOT CAUSE PENDING",
    confirmed:[
      "The US Department of Transportation says instability began at 3:36 p.m. ET on 13 November in radar-related and communication systems; old telecom equipment produced inconsistent data.",
      "The nationwide ground stop ended around 8:15 p.m. ET. Airlines still needed to reposition crews and aircraft after widespread cancellations.",
      "Officials said there was no evidence of a cyberattack at the briefing but did not claim a completed root-cause investigation. The new AI airspace tool was not established as the cause.",
      "The GAO documented a pre-existing FAA modernisation programme. Peraton's systems-integrator contract had a $1.5bn ceiling, while the subsequently negotiated price was approximately $876m; those amounts are not new Friday spending."
    ],
    interpretation:"The incident creates political leverage for infrastructure renewal, but a government funding request must pass an appropriation, procurement and recognised-revenue chain before it becomes investable cash flow.",
    countercase:"Normal operations may return without any new appropriations. Radar, surveillance and telecom contracts are different scopes; the presence of a contractor in the FAA programme does not establish its equipment caused the outage.",
    watch:"Seek the completed FAA root-cause analysis; distinguish an initial overload mechanism from its initiating trigger. Track airline cancellation recovery, congressional appropriations, new solicitations, actual awards and disclosed contract changes.",
    consequences:["UAL / DAL / AAL: near-term schedule recovery and disruption costs, not a proven oversold equity setup","RTX / Indra: existing January radar awards, not newly created by the outage","LHX: previously awarded surveillance-network work; identify only incremental orders","Peraton: private prime integrator; contract ceiling differs from negotiated price"],
    sources:[
      {name:"US DOT 13 November incident briefing",url:"https://www.transportation.gov/briefing-room/icymi-us-transportation-secretary-sean-p-duffy-announces-lifting-nationwide-ground",date:"13 Nov 2026",kind:"OFFICIAL"},
      {name:"GAO modernisation and contract economics",url:"https://files.gao.gov/reports/GAO-26-107992/index.html",date:"Sep 2026",kind:"OFFICIAL"},
      {name:"FAA radar awards to RTX and Indra",url:"https://www.faa.gov/newsroom/trumps-transportation-secretary-duffy-faa-administrator-bedford-announce-radar-contracts",date:"5 Jan 2026",kind:"OFFICIAL"},
      {name:"L3Harris aircraft-surveillance award",url:"https://www.l3harris.com/newsroom/press-release/2026/07/faa-awards-l3harris-airspace-surveillance-modernization-contract",date:"1 Jul 2026",kind:"PRIMARY"}
    ]
  },
  {
    id:"rates-credit",number:"05",topic:"INFLATION / RATES",
    title:"Softer monthly PPI does not erase the real-yield and credit test",
    deck:"October producer prices rose less rapidly than in September, yet annual inflation remained elevated and long Treasury yields climbed. Credit observations must be dated before they are used to argue either durable recovery or systemic stress.",
    status:"CONFIRMED MACRO ACTUALS · MIXED TRANSMISSION",
    confirmed:[
      "BLS: October final-demand PPI increased 0.3% month on month, versus 1.4% in September; annual final-demand PPI rose 6.5%.",
      "US Treasury: on 13 November, the indicative nominal par yields were 2Y 4.88%, 10Y 5.15% and 30Y 5.47%.",
      "A roughly 2.91% ten-year inflation-indexed real Treasury yield was separately reported for 13 November. Nominal-minus-real is a compensation measure, not a pure inflation forecast.",
      "The publicly reviewed HY OAS reading around 3.20% referred to 12 November; it must not be presented as a 13 November same-session credit reaction."
    ],
    interpretation:"Higher real yields raise the hurdle for long-duration cash flows and expensive debt-funded AI expansion. But a weaker semiconductor tape without matching credit deterioration does not establish system-wide financing seizure.",
    countercase:"A genuine fall in inflation and real yields, resilient corporate earnings and wider equity participation could support duration and growth equities. Conversely, renewed spread widening or refinancing failures would challenge the contained-selloff view.",
    watch:"Obtain matched post-event Treasury, TIPS and HY/CCC OAS dates; watch debt issuance, refinancing terms, DXY/JXY and SMH versus QQQ with RSP versus SPY over several completed sessions.",
    consequences:["Growth equity: real-yield compression could ease valuations; persistent high real yields work the other way","TLT/IEF/VGIT: distinguish duration price sensitivity from the yield level","Leveraged AI: compare borrowing costs and maturity ladders with project cash returns"],
    sources:[
      {name:"BLS October 2026 PPI release",url:"https://www.bls.gov/news.release/archives/ppi_11132026.htm",date:"13 Nov 2026",kind:"OFFICIAL"},
      {name:"US Treasury daily interest rate statistics",url:"https://home.treasury.gov/resource-center/data-chart-center/interest-rates",date:"13 Nov 2026 observation",kind:"OFFICIAL"},
      {name:"FRED high-yield option-adjusted spread",url:"https://fred.stlouisfed.org/series/BAMLH0A0HYM2",date:"Latest available observation; check date",kind:"OFFICIAL"}
    ]
  }
];

export function Nov14ResearchTeaser({host,compact=false}:{host:string|null;compact?:boolean}){
  const href=blueDeskPublicHref("/blue-desk/key-stories",host)+"?feature=nov14-market-reset";
  return <section className={css.teaser} data-bluebelly-editorial-teaser="nov14-reviewed" aria-label="November 14 market research update">
    <div>
      <p className={css.eyebrow}>NEW RESEARCH EDITION · 14 NOV 2026 · SOURCE-REVIEWED</p>
      <h2>NVIDIA's earnings test. FAA's legacy network failure. The AI funding divide.</h2>
      {!compact?<p>Five linked investigations: confirmed events, contested interpretations, winners and losers, and the next evidence that could change the market view.</p>:null}
      <small>Not a canonical Regime vote or a live trade signal.</small>
    </div>
    <Link className={css.open} href={href}>Read the five investigations <span aria-hidden="true">→</span></Link>
  </section>;
}

export default function Nov14MarketInvestigation({host}:{host:string|null}){
  const root=blueDeskPublicHref("/blue-desk/key-stories",host);
  return <article className={css.sheet} data-bluebelly-research-edition="2026-11-14" data-source-posture="source-reviewed-not-canonical">
    <nav className={css.crumb} aria-label="Reader breadcrumb"><Link href={root}>Key Stories</Link><span aria-hidden="true">/</span><span>14 November research edition</span></nav>
    <header className={css.masthead}>
      <p className={css.eyebrow}>BLUEBELLY / RESEARCH INTELLIGENCE · FROZEN 14 NOVEMBER 2026 MYT</p>
      <h1>Five developments. One question: what changes next?</h1>
      <p className={css.lead}>NVIDIA faces a governance crisis ahead of earnings; Washington may revisit AI-chip access; semiconductor selling is diverging from some corporate fundamentals; the FAA has exposed ageing infrastructure; and inflation-adjusted borrowing costs remain high.</p>
      <div className={css.mastNotes}><span>Last completed US equity session: 13 Nov</span><span>Event dates and source clocks shown separately</span><span>Evidence before inference</span></div>
    </header>
    <div className={css.topline} aria-label="Research conclusions">
      <div><b>01 / NVIDIA</b><p>Leadership change confirmed; demand collapse unproven.</p></div>
      <div><b>02 / FAA</b><p>Ground stop lifted; exact initiating cause unknown.</p></div>
      <div><b>03 / MARKET</b><p>AI dispersion and credit demand a matched-date test.</p></div>
    </div>
    <nav className={css.jump} aria-label="Jump to investigations">
      {STORIES.map(x=><a href={"#"+x.id} key={x.id}><span>{x.number}</span>{x.topic}</a>)}
    </nav>
    {STORIES.map(story=><section id={story.id} className={css.story} key={story.id} aria-labelledby={story.id+"-title"}>
      <header className={css.storyHead}>
        <p className={css.eyebrow}>{story.number} / {story.topic}</p>
        <h2 id={story.id+"-title"}>{story.title}</h2>
        <p>{story.deck}</p><small>{story.status}</small>
      </header>
      <div className={css.storyBody}>
        <div className={css.sourceFacts}>
          <h3>What is established</h3>
          <ul>{story.confirmed.map((f,i)=><li key={i}>{f}</li>)}</ul>
        </div>
        <div className={css.analysis}>
          <section><h3>Why it matters</h3><p>{story.interpretation}</p></section>
          <section><h3>Strongest countercase</h3><p>{story.countercase}</p></section>
          <section className={css.next}><h3>The next deciding evidence</h3><p>{story.watch}</p></section>
        </div>
      </div>
      <div className={css.effect}><h3>Transmission into markets</h3><ul>{story.consequences.map((x,i)=><li key={i}>{x}</li>)}</ul></div>
      <div className={css.receipts}>
        <h3>Original receipts and attributed reporting</h3>
        {story.sources.map((source,i)=><a key={i} href={source.url} target="_blank" rel="noopener noreferrer"><span>{source.kind} · {source.date}</span><strong>{source.name} ↗</strong></a>)}
      </div>
    </section>)}
    <section className={css.editorNote}>
      <p className={css.eyebrow}>EDITORIAL RULE / WHAT WOULD CHANGE THIS EDITION</p>
      <h2>Story research does not overwrite a canonical Regime.</h2>
      <p>This is a manually reviewed narrative edition. Original company statements, government observations, independent reporting and analyst hypotheses have different evidentiary weight. Reported personal allegations are not findings of guilt. A dated price or spread is not a live quote; a scenario is not a calibrated probability.</p>
      <p>Update the market view only after an independently dated change in policy, issuer results, the FAA's root-cause findings, credit conditions or breadth becomes available and passes the existing canonical research and editorial controls.</p>
      <nav className={css.bottomLinks}>
        <Link href={blueDeskPublicHref("/blue-desk/regime-watch",host)}>Regime Watch</Link>
        <Link href={blueDeskPublicHref("/blue-desk/crash-opportunity",host)}>Crash vs Opportunity</Link>
        <Link href={blueDeskPublicHref("/blue-desk/markets",host)}>Source-dated Markets</Link>
      </nav>
    </section>
  </article>;
}
