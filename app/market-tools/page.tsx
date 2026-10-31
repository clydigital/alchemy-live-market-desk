import Link from "next/link";
import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import ResearchTriggerIntake from "@/components/blue-desk/ResearchTriggerIntake";
import { getMarketData } from "@/lib/market";
import { getMarketMonitor } from "@/lib/market-monitor-public";
import { loadExtras } from "@/lib/market-monitor";
import { buildMarketToolsCorrelations, CORRELATION_WINDOWS } from "@/lib/market-tools-correlations";
import { getMarketToolsProviderReadiness } from "@/lib/market-tools-provider-readiness";
import styles from "./market-tools.module.css";

export const metadata = { title: "Market Tools | Bluebelly", description: "Research sources, correlation watchlists and trade-idea discovery." };

const sources = [
  { name:"TradingView Screener", group:"Trade discovery", tag:"SCREEN", desc:"Filter by trend, momentum, volume and market structure.", url:"https://www.tradingview.com/screener/" },
  { name:"Finviz", group:"Trade discovery", tag:"SCREEN", desc:"US equity technical and fundamental screening.", url:"https://finviz.com/screener.ashx" },
  { name:"Pineify Correlation", group:"Correlation", tag:"COMPARE", desc:"Explore rolling cross-asset correlation relationships.", url:"https://pineify.app/free-tools/volatility-correlation-tracker" },
  { name:"InfoLib Correlations", group:"Correlation", tag:"COMPARE", desc:"Compare ticker relationships and correlation matrices.", url:"https://infolib.org/market-dashboard/ticker-correlations" },
  { name:"FRED", group:"Macro evidence", tag:"OFFICIAL", desc:"Rates, spreads, real yields and macroeconomic time series.", url:"https://fred.stlouisfed.org/" },
  { name:"CME FedWatch", group:"Macro evidence", tag:"RATES", desc:"Market-implied US policy-rate probabilities.", url:"https://www.cmegroup.com/markets/interest-rates/cme-fedwatch-tool.html" },
  { name:"COT Signal", group:"Positioning", tag:"ANALYTICS", desc:"Weekly CFTC Legacy positioning heatmap and crowding context; not a trade signal.", url:"https://www.cotsignal.com" },
  { name:"SEC EDGAR", group:"Fundamentals", tag:"OFFICIAL", desc:"Primary-source filings, earnings and risk disclosures.", url:"https://www.sec.gov/edgar/search/" },
  { name:"EIA", group:"Energy", tag:"OFFICIAL", desc:"Oil and gas inventories, production and energy releases.", url:"https://www.eia.gov/" },
];
const connectors = [
  { name:"Existing provider adapters", priority:"01 · Check first", desc:"Reuse live market-data feeds already deployed; avoid duplicate quotas.", url:"https://github.com/clydigital/alchemy-live-market-desk/issues/1118" },
  { name:"FRED API", priority:"02 · Recommended", desc:"Economic, Treasury and real-yield series. Key needed for API access.", url:"https://fred.stlouisfed.org/docs/api/api_key.html" },
  { name:"Alpha Vantage", priority:"03 · Evaluate", desc:"Potential price history for equities, FX and crypto. Check free-tier limits.", url:"https://www.alphavantage.co/support/#api-key" },
  { name:"Financial Modeling Prep", priority:"04 · Optional", desc:"Company fundamentals and screening; check current endpoint entitlements.", url:"https://site.financialmodelingprep.com/developer/docs" },
  { name:"EIA Open Data", priority:"05 · Reuse if present", desc:"Official energy data; connect only missing datasets.", url:"https://www.eia.gov/opendata/" },
];
export const dynamic = "force-dynamic";

export default async function MarketToolsPage({searchParams}:{searchParams:Promise<{check?:string}>}) {
  const options = await searchParams;
  const checkProviders=options?.check==="providers";
  const [market, monitor, readiness, extendedHistory] = await Promise.all([
    getMarketData().catch(() => null),
    getMarketMonitor().catch(() => null),
    checkProviders ? getMarketToolsProviderReadiness().catch(() => null) : Promise.resolve(null),
    loadExtras().catch(() => []),
  ]);
  const pairs = buildMarketToolsCorrelations(market?.series ?? [], monitor?.rows ?? [], new Date(), extendedHistory);
  const measuredCount = pairs.filter(p => p.status === "measured").length;
  const newestCommonDate = pairs.filter(p => p.status === "measured").map(p => p.asOf).filter((v): v is string => Boolean(v)).sort().at(-1) ?? null;
  return <main className={styles.page}>
    <div className={styles.shell}>
      <BlueDeskHeader activePath="/market-tools" />
      <header className={styles.topbar}><Link href="/" className={styles.brand}><span className={styles.brandMark}>B</span> BLUEBELLY <span className={styles.brandSub}>/ RESEARCH WORKSPACE</span></Link><Link href="/blue-desk" className={styles.back}>← Back to desk</Link></header>
      <section className={styles.hero}><div><p className={styles.eyebrow}>RESEARCH TOOLKIT / BLUEBELLY</p><h1>Market tools<span>.</span><br/>Better signals, less noise.</h1><p className={styles.intro}>One workspace for finding trade candidates, checking cross-market relationships and opening primary-source evidence.</p></div><div className={styles.heroSide}><span className={styles.statusDot}/> Research feeds connected <small>Historical correlations where data passes date, sample and freshness checks; no streaming quote claim</small></div></section>
      <section className={styles.providerCheck} aria-label="Owner provider connection test">
        <div>
          <p className={styles.eyebrow}>PROVIDER CONNECTIVITY / MANUAL CHECK</p>
          <h2>Are the API keys actually working?</h2>
          <p>Check FRED, EIA, Alpha Vantage, FMP and BEA against the running server. This read-only check does not expose keys, activate a scheduled poll, publish market claims or prove canonical ingestion. Missing runtime credentials do not establish absence from Vercel Team Shared Variables.</p>
        </div>
        <Link href="/market-tools?check=providers" className={styles.providerCheckLink}>Check connected APIs ↗</Link>
        {checkProviders && <div className={styles.providerResults}>
          <small className={styles.providerCheckedAt}>Last checked: {readiness?.checkedAt ?? "Unavailable"} · cached up to 60 minutes · Team Shared Variable presence, project attachments and environment targets are not inspected here.</small>
          {readiness?.providers.map(provider=><article key={provider.provider} className={styles.providerStatus}>
            <div><strong>{provider.provider}</strong><p>{provider.note}</p>
              <a href={provider.sourceUrl} target="_blank" rel="noopener noreferrer">Official provider documentation ↗</a></div>
            <div className={styles.providerStatusRight}>
              <span className={provider.state === "ready" ? styles.providerReady : styles.providerPending}>{provider.state.toUpperCase()}</span>
              <small>Source observation/event: {provider.asOf ?? "—"}</small>
              <small>Runtime credential: {provider.runtimeCredential === "visible_at_runtime" ? "visible" : "not visible"}</small>
              <small>Vercel Shared scope: unverified</small>
              <small>Valid rows/metrics: {provider.observationCount}</small>
            </div>
          </article>) ?? <p>Provider check could not be completed; existing market data is unaffected.</p>}
        </div>}
      </section>
      <div className={styles.stats}><div><strong>{sources.length}</strong><span>Curated sources</span></div><div><strong>{measuredCount}/{pairs.length}</strong><span>Current dated correlation pairs</span></div><div><strong>0</strong><span>Verified trade signals</span></div><div><strong>{newestCommonDate ?? "—"}</strong><span>Newest aligned observation date</span></div></div>
      <section className={styles.workflow} aria-labelledby="workflow-title"><div><p className={styles.eyebrow}>RESEARCH HANDOFF / NOT AN AUTOMATIC SIGNAL</p><h2 id="workflow-title">Turn a screen into a sourced investigation</h2><p>Screen for an unusual move → compare cross-market relationships → check the original catalyst → verify price timestamps and invalidation → submit a candidate to Bluebelly research. Unverified observations must not appear as published ideas.</p></div><div className={styles.workflowActions}><Link href="/owner/research">Open Research Library →</Link><Link href="/owner/presenter">Presenter technical checks →</Link><Link href="/my-reports">Editorial reports →</Link></div></section>
      <ResearchTriggerIntake monitor={monitor} />
      <div className={styles.layout}>
        <div className={styles.primary}>
          <section className={styles.section}><div className={styles.sectionHead}><div><p className={styles.eyebrow}>01 / SOURCE DIRECTORY</p><h2>Research shortcuts</h2></div><span className={styles.hint}>External tools · open in new tab</span></div><div className={styles.sourceGrid}>{sources.map(s=><a className={styles.source} href={s.url} key={s.name} target="_blank" rel="noopener noreferrer"><div className={styles.sourceTop}><span className={styles.group}>{s.group}</span><span className={styles.tag}>{s.tag}</span></div><h3>{s.name}<span aria-hidden="true"> ↗</span></h3><p>{s.desc}</p></a>)}</div></section>
          <section className={styles.section}>
            <div className={styles.sectionHead}><div><p className={styles.eyebrow}>02 / RELATIONSHIP WATCH</p><h2>Cross-asset correlations</h2></div><span className={styles.pending}>DAILY HISTORY · NOT LIVE QUOTES</span></div>
            <p className={styles.sectionDesc}>Measured 20 / 60 / 120 matched-session relationships from existing Bluebelly sources, using the longer cached provider histories when available. Price and ETF series use log returns; Treasury yields and breakevens use basis-point changes. Data gaps, missing windows and older source dates remain visible. Proxies do not equal the named cash index or spot market.</p>
            <div className={styles.pairs}>{pairs.map(p=><article className={`${styles.pair} ${styles.pairCorrelation}`} key={p.id}>
              <div className={styles.pairInfo}>
                <strong>{p.label}</strong><p>{p.relationship}</p>
                <small className={styles.pairFootnote}>{p.proxyNote}</small>
                <div className={styles.pairSources}>
                  {p.urlLeft ? <a href={p.urlLeft} target="_blank" rel="noopener noreferrer">{p.labelLeft || p.sourceLeft} ↗</a> : <span>First source unavailable</span>}
                  {p.urlRight ? <a href={p.urlRight} target="_blank" rel="noopener noreferrer">{p.labelRight || p.sourceRight} ↗</a> : <span>Second source unavailable</span>}
                </div>
                <small className={styles.pairDates}>Source dates: {p.dateLeft ?? "—"} / {p.dateRight ?? "—"}</small>
              </div>
              <div className={styles.correlationBlock}>
                <span className={`${styles.pairState} ${p.status === "measured" ? styles.stateMeasured : ""}`}>{p.status === "measured" ? "DATED MEASUREMENT" : p.status === "stale" ? "STALE SOURCE" : p.status === "insufficient" ? "INSUFFICIENT HISTORY" : "SOURCE UNAVAILABLE"}</span>
                <div className={styles.correlationValues}>
                  {CORRELATION_WINDOWS.map(w=><div key={w}>
                    <small>{w} matched moves</small>
                    <strong>{p.values[w].coefficient === null ? "—" : p.values[w].coefficient!.toFixed(2)}</strong>
                    <small>{p.values[w].observations ? `n=${p.values[w].observations}` : "not enough data"}</small>
                  </div>)}
                </div>
                <small className={styles.correlationAsOf}>Common as-of: {p.asOf ?? "unavailable"} · {p.matchedReturns} aligned daily moves</small>
              </div>
            </article>)}</div>
            <p className={styles.sectionDesc} style={{marginTop:12}}>A correlation describes historical co-movement, not causation or a trade recommendation. Dated price-provider series may lag today's session. Market hours, ETF tracking/roll effects and differently timed official observations limit comparability.</p>
          </section>
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
