import Link from "next/link";
import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import ResearchTriggerIntake from "@/components/blue-desk/ResearchTriggerIntake";
import styles from "./market-tools.module.css";

export const metadata = { title: "Market Tools | Bluebelly", description: "Research sources, correlation watchlists and trade-idea discovery." };

const sources = [
  { name:"TradingView Screener", group:"Trade discovery", tag:"SCREEN", desc:"Filter by trend, momentum, volume and market structure.", url:"https://www.tradingview.com/screener/" },
  { name:"Finviz", group:"Trade discovery", tag:"SCREEN", desc:"US equity technical and fundamental screening.", url:"https://finviz.com/screener.ashx" },
  { name:"Pineify Correlation", group:"Correlation", tag:"COMPARE", desc:"Explore rolling cross-asset correlation relationships.", url:"https://pineify.app/free-tools/volatility-correlation-tracker" },
  { name:"InfoLib Correlations", group:"Correlation", tag:"COMPARE", desc:"Compare ticker relationships and correlation matrices.", url:"https://infolib.org/market-dashboard/ticker-correlations" },
  { name:"FRED", group:"Macro evidence", tag:"OFFICIAL", desc:"Rates, spreads, real yields and macroeconomic time series.", url:"https://fred.stlouisfed.org/" },
  { name:"CME FedWatch", group:"Macro evidence", tag:"RATES", desc:"Market-implied US policy-rate probabilities.", url:"https://www.cmegroup.com/markets/interest-rates/cme-fedwatch-tool.html" },
  { name:"CFTC COT", group:"Positioning", tag:"OFFICIAL", desc:"Futures positioning and crowded-trade context.", url:"https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm" },
  { name:"SEC EDGAR", group:"Fundamentals", tag:"OFFICIAL", desc:"Primary-source filings, earnings and risk disclosures.", url:"https://www.sec.gov/edgar/search/" },
  { name:"EIA", group:"Energy", tag:"OFFICIAL", desc:"Oil and gas inventories, production and energy releases.", url:"https://www.eia.gov/" },
];
const pairs = [
  { pair:"DXY / Gold", reason:"Dollar strength versus precious-metal pricing", source:"FRED / market-price feed" },
  { pair:"DXY / EURUSD", reason:"Broad-dollar move versus major FX counterpart", source:"FX market-price feed" },
  { pair:"Nasdaq / Bitcoin", reason:"Risk appetite and liquidity sensitivity", source:"Equity / crypto feed" },
  { pair:"US 2Y / USDJPY", reason:"Front-end rates and FX sensitivity", source:"Treasury / FX feed" },
  { pair:"Gold / Real yields", reason:"Opportunity-cost relationship", source:"FRED / gold feed" },
  { pair:"Oil / Inflation expectations", reason:"Energy shocks versus inflation pricing", source:"EIA / FRED" },
  { pair:"SPX / VIX", reason:"Equity risk versus implied volatility", source:"Equity / volatility feed" },
];
const connectors = [
  { name:"Existing provider adapters", priority:"01 · Check first", desc:"Reuse live market-data feeds already deployed; avoid duplicate quotas.", url:"https://github.com/clydigital/alchemy-live-market-desk/issues/1118" },
  { name:"FRED API", priority:"02 · Recommended", desc:"Economic, Treasury and real-yield series. Key needed for API access.", url:"https://fred.stlouisfed.org/docs/api/api_key.html" },
  { name:"Alpha Vantage", priority:"03 · Evaluate", desc:"Potential price history for equities, FX and crypto. Check free-tier limits.", url:"https://www.alphavantage.co/support/#api-key" },
  { name:"Financial Modeling Prep", priority:"04 · Optional", desc:"Company fundamentals and screening; check current endpoint entitlements.", url:"https://site.financialmodelingprep.com/developer/docs" },
  { name:"EIA Open Data", priority:"05 · Reuse if present", desc:"Official energy data; connect only missing datasets.", url:"https://www.eia.gov/opendata/" },
];
export default function MarketToolsPage() {
  return <main className={styles.page}>
    <div className={styles.shell}>
      <BlueDeskHeader activePath="/market-tools" />
      <header className={styles.topbar}><Link href="/" className={styles.brand}><span className={styles.brandMark}>B</span> BLUEBELLY <span className={styles.brandSub}>/ RESEARCH WORKSPACE</span></Link><Link href="/blue-desk" className={styles.back}>← Back to desk</Link></header>
      <section className={styles.hero}><div><p className={styles.eyebrow}>RESEARCH TOOLKIT / BLUEBELLY</p><h1>Market tools<span>.</span><br/>Better signals, less noise.</h1><p className={styles.intro}>One workspace for finding trade candidates, checking cross-market relationships and opening primary-source evidence.</p></div><div className={styles.heroSide}><span className={styles.statusDot}/> Source directory ready <small>Live scanner pending market-data connection</small></div></section>
      <div className={styles.stats}><div><strong>{sources.length}</strong><span>Curated sources</span></div><div><strong>{pairs.length}</strong><span>Correlation pairs</span></div><div><strong>0</strong><span>Verified live signals</span></div><div><strong>—</strong><span>Last price observation</span></div></div>
      <section className={styles.workflow} aria-labelledby="workflow-title"><div><p className={styles.eyebrow}>RESEARCH HANDOFF / NOT AN AUTOMATIC SIGNAL</p><h2 id="workflow-title">Turn a screen into a sourced investigation</h2><p>Screen for an unusual move → compare cross-market relationships → check the original catalyst → verify price timestamps and invalidation → submit a candidate to Bluebelly research. Unverified observations must not appear as published ideas.</p></div><div className={styles.workflowActions}><Link href="/owner/research">Open Research Library →</Link><Link href="/owner/presenter">Presenter technical checks →</Link><Link href="/my-reports">Editorial reports →</Link></div></section>
      <ResearchTriggerIntake />
      <div className={styles.layout}>
        <div className={styles.primary}>
          <section className={styles.section}><div className={styles.sectionHead}><div><p className={styles.eyebrow}>01 / SOURCE DIRECTORY</p><h2>Research shortcuts</h2></div><span className={styles.hint}>External tools · open in new tab</span></div><div className={styles.sourceGrid}>{sources.map(s=><a className={styles.source} href={s.url} key={s.name} target="_blank" rel="noopener noreferrer"><div className={styles.sourceTop}><span className={styles.group}>{s.group}</span><span className={styles.tag}>{s.tag}</span></div><h3>{s.name}<span aria-hidden="true"> ↗</span></h3><p>{s.desc}</p></a>)}</div></section>
          <section className={styles.section}><div className={styles.sectionHead}><div><p className={styles.eyebrow}>02 / RELATIONSHIP WATCH</p><h2>Cross-asset correlations</h2></div><span className={styles.pending}>DATA NOT CONNECTED</span></div><p className={styles.sectionDesc}>These are relationships to investigate, not measured current correlations. Once price history is connected, display 20 / 60 / 120-session return correlations, rolling changes, sample counts and source timestamps.</p><div className={styles.pairs}>{pairs.map(p=><div className={styles.pair} key={p.pair}><div><strong>{p.pair}</strong><p>{p.reason}</p></div><div className={styles.pairRight}><span>Awaiting data</span><small>{p.source}</small></div></div>)}</div></section>
        </div>
        <aside className={styles.sidebar}>
          <section className={styles.sideCard}><p className={styles.eyebrow}>03 / IDEA RADAR</p><h2>Trade candidates</h2><div className={styles.empty}><span>◇</span><strong>No verified ideas yet</strong><p>Ideas will require a catalyst, direction, timeframe, confirmation, invalidation and evidence receipt before appearing as researched signals.</p></div><div className={styles.stage}><span>Candidate</span><span>Research</span><span>Verified</span></div></section>
          <section className={styles.sideCard}><p className={styles.eyebrow}>04 / CONNECTORS</p><h2>API setup hotlist</h2><p className={styles.muted}>Complete these when ready. No credentials should be entered into the public page.</p><div className={styles.connectors}>{connectors.map(c=><a href={c.url} target="_blank" rel="noopener noreferrer" key={c.name}><small>{c.priority}</small><strong>{c.name} ↗</strong><span>{c.desc}</span></a>)}</div></section>
          <section className={styles.note}><strong>Research standard</strong><p>A correlation is not a trading signal by itself. All proposed trades stay provisional until independently supported by market observations and the Bluebelly research workflow.</p></section>
        </aside>
      </div>
      <footer className={styles.footer}>BLUEBELLY / MARKET INTELLIGENCE <span>Source links are external · No live prices or correlations are implied</span></footer>
    </div>
  </main>;
}
