import Link from "next/link";
import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import ResearchTriggerIntake from "@/components/blue-desk/ResearchTriggerIntake";
import { getMarketData } from "@/lib/market";
import { getMarketMonitor } from "@/lib/market-monitor-public";
import { loadExtras } from "@/lib/market-monitor";
import { buildMarketToolsCorrelations, CORRELATION_WINDOWS } from "@/lib/market-tools-correlations";
import { getMarketToolsProviderReadiness } from "@/lib/market-tools-provider-readiness";
import styles from "./market-tools.module.css";
import TechnicalMarketScanner from "@/components/blue-desk/TechnicalMarketScanner";
import {projectPublicEquityCoverage} from "@/lib/bluebelly-equity-coverage";
import {buildScannerAssets,projectPrivateSymbols,scannerGroup,matchesScannerGroup,fourHBandCells,type PrivateSymbol} from "@/lib/technical-market-scanner";
import OwnerTechnicalLevels from "@/components/blue-desk/OwnerTechnicalLevels";
import {readTechnicalSnapshot,readFourH,readFourHWatch,TECHNICAL_UNIVERSE} from "@/lib/providers/twelve-data-ema-history";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {authorizeVerifiedEventOwner} from "@/lib/bluebelly-verified-event-owner-auth";

export const metadata = { title: "Market Tools | Bluebelly", description: "Research sources, correlation watchlists and trade-idea discovery." };

const sources = [
  { name:"Gekko stock research", group:"Trade discovery", tag:"SECONDARY", desc:"Public US stock research: positioning, proprietary fair value, earnings and seasonal context; verify material facts independently.", url:"https://www.gekko.app/stocks" },
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

export default async function MarketToolsPage({searchParams}:{searchParams:Promise<{check?:string;technical?:string;view?:string;fourh?:string;scope?:string;group?:string;batch?:string}>}) {
  const options = await searchParams;
  const view=options?.check==="providers"?"diagnostics":typeof options?.technical==="string"||typeof options?.fourh==="string"?"technical":options?.view==="relationships"?"relationships":options?.view==="technical"?"technical":options?.view==="technical-scan"?"technical-scan":options?.view==="intake"?"intake":options?.view==="diagnostics"?"diagnostics":"sources";
  const scannerView=view==="technical-scan";
  const relationshipView=view==="relationships";
  const intakeView=view==="intake";
  const diagnosticsView=view==="diagnostics";
  const ticker=typeof options.technical==="string"?options.technical.toUpperCase():"MAA";
  const session=await createSupabaseServerClient();
  const access=await authorizeVerifiedEventOwner({getUser:()=>session.auth.getUser(),readActiveAllowlist:email=>session.from("app_access_allowlist").select("email").eq("email",email).eq("active",true).maybeSingle()});
  if(!access.ok)return <main className={styles.page}><div className={styles.shell}><h1>Owner access required</h1><Link href="/my-reports">Return to My Desk →</Link></div></main>;
  let privateSymbols:PrivateSymbol[]=[],privateStatus="Private scope not checked";
  if(scannerView){
    // Never share or cache membership across owners; same verified session,
    // explicit owner filter and retired legacy-source fence as PowerStack.
    const identity=await session.auth.getUser();
    const user=identity.data.user;
    if(!identity.error&&user?.id&&user.email?.trim().toLowerCase()===access.email){
      const {data:record,error}=await session.from("power_stack_owner_snapshots").select("snapshot_as_of,legacy_source_retired,snapshot").eq("owner_user_id",user.id).order("snapshot_as_of",{ascending:false}).limit(1).maybeSingle();
      const stamp=record?Date.parse(record.snapshot_as_of+"T00:00:00Z"):NaN;
      if(!error&&record?.legacy_source_retired===true&&Number.isFinite(stamp)&&stamp<=Date.now()){
        const ideas=await session.from("power_stack_idea_tracker").select("ticker,name").eq("owner_user_id",user.id).eq("idea_type","INVESTMENT").limit(250);
        privateSymbols=projectPrivateSymbols(record.snapshot,ideas.error?[]:ideas.data??[]);
        privateStatus="Recorded snapshot "+record.snapshot_as_of+(ideas.error?" · saved ideas unavailable":" · saved ideas read");
      }else privateStatus="Owner snapshot unavailable or legacy privacy fence not satisfied";
    }else privateStatus="Verified owner identity unavailable";
  }
  const scannerMonitor=scannerView?await getMarketMonitor().catch(()=>null):null;
  const scannerAssets=scannerView?buildScannerAssets(projectPublicEquityCoverage(scannerMonitor?.rows??[]).rows,scannerMonitor?.rows??[],privateSymbols):[];
  const scanGroup=scannerGroup(options.group??(options.scope==="ps"?"PowerStack":"All Markets"));
  const allowed4H=new Set(TECHNICAL_UNIVERSE.map(x=>x.ticker));
  const scanSymbols=scannerView?[...new Set([...(scanGroup==="All Markets"?["XAU/USD","USD/JPY","BTC/USD","SPY","QQQ","SMH"]:scanGroup==="Metals"?["XAU/USD"]:scanGroup==="FX"?["USD/JPY"]:scanGroup==="Crypto"?["BTC/USD"]:[]),...scannerAssets.filter(a=>matchesScannerGroup(a,scanGroup)&&allowed4H.has(a.ticker)&&!(scanGroup==="PowerStack"&&matchesScannerGroup(a,"Real estate"))).sort((a,b)=>Number(b.memberships.includes("Holding"))-Number(a.memberships.includes("Holding"))).map(a=>a.ticker)])]:[];
  const batchCount=Math.ceil(scanSymbols.length/6);
  const requestedBatch=typeof options.batch==="string"&&/^\d{1,4}$/.test(options.batch)?Number(options.batch):1;
  const activeBatch=requestedBatch>=1&&requestedBatch<=batchCount?requestedBatch:0;
  const fourHScan=activeBatch?await readFourHWatch(new Date(),scanSymbols.slice((activeBatch-1)*6,activeBatch*6)):[];
  const fourHCells=Object.fromEntries(fourHScan.map(r=>[r.symbol,{status:r.status,asOf:r.asOf,cells:fourHBandCells(r)}]));
  const checkProviders=access.ok&&diagnosticsView&&options?.check==="providers";
  const technical=access.ok&&view==="technical"&&options.technical&&!options.fourh?await readTechnicalSnapshot(ticker):null;
  const fourH=access.ok&&view==="technical"&&typeof options.fourh==="string"?await readFourH(options.fourh):access.ok&&view==="technical"&&typeof options.technical==="string"?await readFourH(ticker):null;
  const [market, monitor, readiness, extendedHistory] = await Promise.all([
    relationshipView ? getMarketData().catch(() => null) : Promise.resolve(null),
    relationshipView||intakeView ? getMarketMonitor().catch(() => null) : Promise.resolve(null),
    checkProviders ? getMarketToolsProviderReadiness().catch(() => null) : Promise.resolve(null),
    relationshipView ? loadExtras().catch(() => []) : Promise.resolve([]),
  ]);
  const pairs = relationshipView ? buildMarketToolsCorrelations(market?.series ?? [], monitor?.rows ?? [], new Date(), extendedHistory) : [];
  const measuredCount = pairs.filter(p => p.status === "measured").length;
  const newestCommonDate = pairs.filter(p => p.status === "measured").map(p => p.asOf).filter((v): v is string => Boolean(v)).sort().at(-1) ?? null;
  return <main className={styles.page}>
    {view==="technical"||scannerView?<BlueDeskHeader activePath="/market-tools?view=technical" />:null}
    <div className={styles.shell}>
      {view!=="technical"&&!scannerView?<BlueDeskHeader activePath="/market-tools" />:null}
      {view!=="technical"&&!scannerView?<>
      <header className={styles.topbar}><Link href="/" className={styles.brand}><span className={styles.brandMark}>B</span> BLUEBELLY <span className={styles.brandSub}>/ RESEARCH WORKSPACE</span></Link><Link href="/blue-desk" className={styles.back}>← Back to desk</Link></header>
      <section className={styles.hero}><div><p className={styles.eyebrow}>RESEARCH TOOLKIT / BLUEBELLY</p><h1>Market tools<span>.</span></h1><p className={styles.intro}>Focused owner-only utilities for source discovery, relationships, technical research, candidate intake and provider checks.</p></div><div className={styles.heroSide}>Owner research tools <small>Choose a focused view. Provider readiness and market observations are shown only where measured; no streaming quote claim.</small></div></section>
      </>:null}
      <nav aria-label="Private market tools views" className={view==="technical"||scannerView?styles.technicalViewNav:undefined} style={view==="technical"||scannerView?undefined:{display:"flex",flexWrap:"wrap",gap:10,marginBottom:24}}>
        {([["sources","Source directory"],["relationships","Relationships"],["technical","Technical Watch"],["technical-scan","EMA Scanner"],["intake","Research intake"],["diagnostics","Provider diagnostics"]] as const).map(([id,label])=><Link key={id} href={id==="sources"?"/market-tools":"/market-tools?view="+id} aria-current={view===id?"page":undefined} className={styles.providerCheckLink} style={view===id?{outline:"2px solid currentColor"}:undefined}>{label}</Link>)}
      </nav>
      {view==="sources"?<section className={styles.workflow} aria-label="Canonical workspace shortcuts"><div><p className={styles.eyebrow}>ONE DATA SOURCE / FOCUSED WORKSPACES</p><h2>Find the right analytical view</h2><p>Markets owns observations; Research Library owns hypotheses and evidence; My Desk owns operational health. These private utilities reuse existing readers.</p></div><div className={styles.workflowActions}><Link href="/markets?mode=risk">Risk &amp; Positioning →</Link><Link href="/markets?mode=compare">Rotation &amp; breadth →</Link><Link href="/markets?mode=watch">Divergence Watch →</Link><Link id="ema-sd-levels" href="/market-tools?view=technical">Technical Watch →</Link><Link href="/owner/research">Research Library →</Link><Link href="/my-reports">My Desk / research health →</Link></div></section>:null}
      {diagnosticsView?<section className={styles.providerCheck} aria-label="Owner provider connection test">
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
      </section>:null}
      {relationshipView?<div className={styles.stats}><div><strong>{sources.length}</strong><span>Curated sources</span></div><div><strong>{measuredCount}/{pairs.length}</strong><span>Current dated correlation pairs</span></div><div><strong>—</strong><span>Not a trade-signal count</span></div><div><strong>{newestCommonDate ?? "—"}</strong><span>Newest aligned observation date</span></div></div>:null}
      {intakeView?<section className={styles.workflow} aria-labelledby="workflow-title"><div><p className={styles.eyebrow}>RESEARCH HANDOFF / NOT AN AUTOMATIC SIGNAL</p><h2 id="workflow-title">Turn a screen into a sourced investigation</h2><p>Screen for an unusual move → compare cross-market relationships → check the original catalyst → verify price timestamps and invalidation → submit a candidate to Bluebelly research. Unverified observations must not appear as published ideas.</p></div><div className={styles.workflowActions}><Link href="/owner/research">Open Research Library →</Link><Link href="/owner/presenter">Presenter technical checks →</Link><Link href="/my-reports">Editorial reports →</Link></div></section>:null}
      {scannerView?<TechnicalMarketScanner assets={scannerAssets} initialGroup={scanGroup} fourHCells={fourHCells} batchCount={batchCount} activeBatch={activeBatch} batchSymbols={activeBatch?scanSymbols.slice((activeBatch-1)*6,activeBatch*6):[]} sourceDate={scannerMonitor?.updatedAt??null} privateStatus={privateStatus}/>:null}
      {view==="technical"?<OwnerTechnicalLevels snapshot={technical} ticker={ticker} fourH={fourH}/>:null}
      {intakeView?<ResearchTriggerIntake monitor={monitor} />:null}
      {view!=="technical"&&!scannerView?<div className={styles.layout} style={view==="sources"||relationshipView?undefined:{gridTemplateColumns:"minmax(0,1fr)"}}>
        {view==="sources"||relationshipView?<div className={styles.primary}>
          {view==="sources"?<section className={styles.section}><div className={styles.sectionHead}><div><p className={styles.eyebrow}>01 / SOURCE DIRECTORY</p><h2>Research shortcuts</h2></div><span className={styles.hint}>External tools · open in new tab</span></div><div className={styles.sourceGrid}>{sources.map(s=><a className={styles.source} href={s.url} key={s.name} target="_blank" rel="noopener noreferrer"><div className={styles.sourceTop}><span className={styles.group}>{s.group}</span><span className={styles.tag}>{s.tag}</span></div><h3>{s.name}<span aria-hidden="true"> ↗</span></h3><p>{s.desc}</p></a>)}</div></section>:null}
          {relationshipView?<section className={styles.section}>
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
          </section>:null}
        </div>:null}
        <aside className={styles.sidebar}>
          {intakeView?<section className={styles.sideCard}><p className={styles.eyebrow}>RESEARCH HANDOFF</p><h2>Trade candidates</h2><p className={styles.muted}>Review current hypothesis and evidence status in Research Library. No independent verified-idea count is maintained here.</p><Link href="/owner/research">Open canonical Research Library →</Link></section>:null}
          {diagnosticsView?<section className={styles.sideCard}><p className={styles.eyebrow}>04 / CONNECTORS</p><h2>API setup hotlist</h2><p className={styles.muted}>Complete these when ready. No credentials should be entered into the public page.</p><div className={styles.connectors}>{connectors.map(c=><a href={c.url} target="_blank" rel="noopener noreferrer" key={c.name}><small>{c.priority}</small><strong>{c.name} ↗</strong><span>{c.desc}</span></a>)}</div></section>:null}
          <section className={styles.note}><strong>Research standard</strong><p>A correlation is not a trading signal by itself. All proposed trades stay provisional until independently supported by market observations and the Bluebelly research workflow.</p></section>
        </aside>
      </div>:null}
      <footer className={styles.footer}>BLUEBELLY / MARKET INTELLIGENCE <span>Source links are external · No live prices or correlations are implied</span></footer>
    </div>
  </main>;
}
