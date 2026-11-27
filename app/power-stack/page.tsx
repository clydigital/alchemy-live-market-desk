import "server-only";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import styles from "@/app/blue-desk/blue-desk.module.css";
import portfolio from "./private-power-stack.module.css";
import {repricePegResearch,type PegResearchObservation,type RebasedPegResearchEvaluation} from "@/lib/power-stack-peg-research";
import PowerStackResearchFocus from "@/components/blue-desk/PowerStackResearchFocus";
import {getTopicInfluences} from "@/lib/bluebelly-topic-influence-server";
import {powerStackResearchTopics,projectPowerStackResearch,type PowerStackTracked} from "@/lib/power-stack-research-links";
import PowerStackResearchImpact from "@/components/blue-desk/PowerStackResearchImpact";
import { getReboundCapitalResearchLeads } from "@/lib/power-stack-rebound-research";
import NvidiaEarningsDecisionWatch from "@/components/blue-desk/NvidiaEarningsDecisionWatch";
import PowerStackDecisionHub from "@/components/blue-desk/PowerStackDecisionHub";
import PowerStackMeasuredSignals from "@/components/blue-desk/PowerStackMeasuredSignals";
import PowerStackValuationWorkbench,{type ValuationResearchAsset} from "@/components/blue-desk/PowerStackValuationWorkbench";
import {projectIssuerValuationReviews} from "@/lib/power-stack-issuer-valuation";
import {getMarketMonitor} from "@/lib/market-monitor-public";
import {readLongEquityHistory} from "@/lib/bluebelly-equity-long-history";
import {BLUEBELLY_STOCK_UNIVERSE,findStockIdentity} from "@/lib/bluebelly-equity-universe";
import {readPublicFundamentalComparison} from "@/lib/bluebelly-fundamental-comparison-server";
import {projectPublicEquityCoverage} from "@/lib/bluebelly-equity-coverage";
import PowerStackBBMarketSweep from "@/components/blue-desk/PowerStackBBMarketSweep";
import {projectOpportunityQueue,isNonIssuerInstrument} from "@/lib/power-stack-opportunity-queue";
import PowerStackOpportunityQueue from "@/components/blue-desk/PowerStackOpportunityQueue";
import PowerStackDecisionOverview from "@/components/blue-desk/PowerStackDecisionOverview";
import {readFourHWatch,readTechnicalSnapshot,TECHNICAL_UNIVERSE} from "@/lib/providers/twelve-data-ema-history";
import {planFourHWatch} from "@/lib/bluebelly-4h-levels";
import PowerStackFourHWatch from "@/components/blue-desk/PowerStackFourHWatch";
import {buildCompareResearch,compareBreadthObservations} from "@/lib/bluebelly-compare-research";
import {getSourceDatedBreadth} from "@/lib/bluebelly-breadth-reader";
import {publicMarketObservations} from "@/lib/blue-desk-public-markets";
import {buildMarketDivergenceWatch} from "@/lib/bluebelly-market-divergence-watch";
import {selectMeasuredMarketSignals} from "@/lib/bluebelly-measured-market-signals";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = {
  title: "Private Power Stack | Bluebelly",
  robots: { index: false, follow: false },
};

type Holding = {
  ticker: string;
  name: string;
  quantity: number | null;
  currency: string;
  lastPrice: number | null;
  priceAsOf: string | null;
  quantityAsOf: string | null;
};
type WatchAsset = {
  ticker: string;
  name: string;
  rank: number | null;
  score: number | null;
  bucket: string;
  action: string;
  theme: string;
  entry: string;
  invalidation: string;
};
type SnapshotRow = {
  snapshot_as_of: string;
  legacy_source_retired: boolean;
  snapshot: unknown;
};

const aliases:Record<string,string>={MNHLDG:"0245.KL",UUE:"0310.KL",HEGROUP:"0296.KL",GAMUDA:"5398.KL",TENAGA:"5347.KL",MISC:"3816.KL",HIBISCS:"5199.KL",YTLPOWR:"6742.KL",DAYANG:"5141.KL" ,"688825":"688825.SS"};
const marketTicker=(ticker:string)=>aliases[ticker]??ticker;
function cleanString(v: unknown, max = 90): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}
function finiteOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Only a verified private snapshot may be rendered. No GitHub Pages fallback. */
function parseOwnerHoldings(snapshot: unknown): Holding[] {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return [];
  const rows = (snapshot as { holdings?: unknown }).holdings;
  if (!Array.isArray(rows)) return [];
  return rows.slice(0, 100).flatMap((raw: unknown) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
    const obj = raw as Record<string, unknown>;
    const ticker = cleanString(obj.ticker, 20).toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9.\-]{0,17}$/.test(ticker)) return [];
    const pos = obj.position && typeof obj.position === "object"
      && !Array.isArray(obj.position) ? obj.position as Record<string, unknown> : {};
    return [{
      ticker,
      name: cleanString(obj.name) || ticker,
      quantity: finiteOrNull(pos.quantity),
      currency: cleanString(pos.currency, 8),
      lastPrice: finiteOrNull(pos.latestPrice),
      priceAsOf: cleanString(pos.priceAsOf, 30) || null,
      quantityAsOf: cleanString(pos.quantityAsOf, 30) || null,
    }];
  });
}

/** Archived research queue, not a live order or an independently updated rating. */
function parseOwnerWatchlist(snapshot: unknown): WatchAsset[] {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return [];
  const rows = (snapshot as { watchlist?: unknown }).watchlist;
  if (!Array.isArray(rows)) return [];
  return rows.slice(0, 200).flatMap((raw: unknown) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
    const obj = raw as Record<string,unknown>;
    const ticker=cleanString(obj.ticker,20).toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9.\-]{0,17}$/.test(ticker)) return [];
    return [{
      ticker,name:cleanString(obj.name)||ticker,rank:finiteOrNull(obj.rank),
      score:finiteOrNull(obj.score),bucket:cleanString(obj.bucket,30),
      action:cleanString(obj.action,180),theme:cleanString(obj.theme,180),
      entry:cleanString(obj.entry,600),invalidation:cleanString(obj.invalidation,600),
    }];
  }).sort((a,b)=>(a.rank??999)-(b.rank??999));
}

export default async function PrivatePowerStack({searchParams}:{searchParams:Promise<{technical?:string|string[];fourh?:string}>}) {
  // This page enforces owner identity itself, even if a preview/alias is
  // misconfigured to disable the general middleware dashboard gate.
  const supabase = await createSupabaseServerClient().catch(() => null);
  if (!supabase) {
    return <main><h1>Power Stack unavailable</h1><p>Owner authentication is not configured.</p></main>;
  }
  const { data: identity, error: identityError } = await supabase.auth.getUser();
  if (identityError || !identity.user?.id || !identity.user.email) {
    redirect("/auth/google?next=%2Fpower-stack");
  }
  const { data: allowed, error: allowError } = await supabase
    .from("app_access_allowlist").select("email")
    .eq("email", identity.user.email.toLowerCase().trim())
    .eq("active", true).maybeSingle();
  if (allowError || !allowed) redirect("/login?error=not_allowed&next=%2Fpower-stack");

  const { data: record, error: readError } = await supabase
    .from("power_stack_owner_snapshots")
    .select("snapshot_as_of,legacy_source_retired,snapshot")
    .eq("owner_user_id", identity.user.id)
    .order("snapshot_as_of", { ascending: false })
    .limit(1).maybeSingle();
  const row = !readError && record ? record as SnapshotRow : null;
  // An authenticated view must not imply privacy while original holdings,
  // quantities and account notes are still publicly served by GitHub Pages.
  const snapshotTime = row ? Date.parse(row.snapshot_as_of + "T00:00:00Z") : NaN;
  const snapshotIsDated = Number.isFinite(snapshotTime) && snapshotTime <= Date.now();
  const snapshotAgeDays = snapshotIsDated ? Math.floor((Date.now() - snapshotTime) / 86400000) : null;
  const ready = row?.legacy_source_retired === true && snapshotIsDated;
  // Historical only. No brokerage or quote-provider reconciliation is implied.
  const holdings = ready && row ? parseOwnerHoldings(row.snapshot) : [];
  const watchlist = ready && row ? parseOwnerWatchlist(row.snapshot) : [];
  // Add current, independently-maintained bond ideas to the legacy research list
  // without rewriting the frozen original Power Stack snapshot.
  const { data: ideaRecords, error: ideasError } = ready
    ? await supabase.from("power_stack_idea_tracker")
        .select("ticker,name,currency,macro_state,macro_reason,macro_as_of,note,watch_low,watch_high,updated_at")
        .eq("owner_user_id", identity.user.id).eq("idea_type", "INVESTMENT").limit(250)
    : { data: null, error: null };
  const bondPriority = ["TLT","IEF","SGOV","SHY","EDV","ZROZ","TIP","LQD","HYG","AGG","GOVT","USFR","TLH"];
  const bondWatch = (ideaRecords ?? [])
    .filter(item => typeof item.macro_reason === "string" && item.macro_reason.startsWith("Bond Watch role "))
    .sort((a,b) => {
      const ai = bondPriority.indexOf(a.ticker);
      const bi = bondPriority.indexOf(b.ticker);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi) || a.ticker.localeCompare(b.ticker);
    });
  // Current watch universe and market observations are owned by BB; legacy ranks
  // remain archive-only. Keep original private holdings and manually reviewed theses.
  const publicTape=ready?await getMarketMonitor().catch(()=>null):null;
  const bbCoverage=projectPublicEquityCoverage(publicTape?.rows??[]);
  const params=await searchParams;
  const requested=ready&&typeof params.technical==="string"?findStockIdentity(params.technical):undefined;
  const reference=requested&&requested.theme!=="REAL_ESTATE"?bbCoverage.rows.find(q=>q.ticker===requested.ticker&&q.status==="SOURCE_DATED"):undefined;
  const longHistory=requested&&reference?.price!=null&&reference.asOf?await readLongEquityHistory(requested,{price:reference.price,asOf:reference.asOf}):null;
  const fourHAllowed=TECHNICAL_UNIVERSE.filter(x=>findStockIdentity(x.ticker)?.theme!=="REAL_ESTATE"&&!["XLRE","ITB","XHB"].includes(x.ticker)).map(x=>x.ticker);
  const fourHPriority=ready?[...holdings.map(x=>marketTicker(x.ticker)),...(ideaRecords??[]).map(x=>marketTicker(x.ticker)),...watchlist.map(x=>marketTicker(x.ticker)),...BLUEBELLY_STOCK_UNIVERSE.map(x=>x.ticker),...fourHAllowed]:[];
  const fourHPlan=planFourHWatch(fourHPriority,fourHAllowed,params.fourh??(requested?undefined:"1"));
  const fourHSelected=ready&&requested&&fourHAllowed.includes(requested.ticker)?requested.ticker:null;
  const sharedTechnical=ready&&fourHSelected?await readTechnicalSnapshot(fourHSelected):null;
  const fourHSymbols=fourHPlan.symbols.length?fourHPlan.symbols:fourHSelected?[fourHSelected]:[];
  const fourHWatch=ready&&fourHSymbols.length?await readFourHWatch(new Date(),fourHSymbols):null;
  const privateLevels=(ideaRecords??[]).flatMap(i=>{
    const lo=i.watch_low==null?null:Number(i.watch_low),hi=i.watch_high==null?null:Number(i.watch_high);
    if((lo===null&&hi===null)||(lo!==null&&(!Number.isFinite(lo)||lo<=0))||(hi!==null&&(!Number.isFinite(hi)||hi<=0))||(lo!==null&&hi!==null&&lo>hi))return [];
    return [{ticker:marketTicker(i.ticker),currency:i.currency,low:lo,high:hi,note:i.note,updatedAt:i.updated_at}];
  });
  const trackedTickers = ready?[...new Set([
    ...holdings.filter(item=>item.ticker!=="6742UW").map(item=>marketTicker(item.ticker)),
    ...BLUEBELLY_STOCK_UNIVERSE.map(item=>item.ticker),
    ...bondWatch.map(item=>item.ticker)
  ])]:[];
  const quoteError=ready&&!publicTape;
  const latestQuotes = new Map<string, {
    price:number; currency:string; observed_on:string; source_name:string; source_url:string; timestamp_basis:string; source_recorded_at:string|null;
  }>();
  for(const q of bbCoverage.rows){
    if(q.status!=="SOURCE_DATED"||q.price===null||!q.asOf||!q.sourceName||!q.sourceUrl)continue;
    latestQuotes.set(q.ticker,{price:q.price,currency:q.currency,observed_on:q.asOf,source_name:q.sourceName,source_url:q.sourceUrl,timestamp_basis:"source_observation",source_recorded_at:null});
  }
  // Bonds remain their own instrument class; only exact BB observations, no PS fallback.
  for(const q of publicTape?.rows??[]){
    if(!bondWatch.some(b=>b.ticker===q.symbol)||q.frequency!=="daily"||q.last===null||q.last<=0||!q.asOf||!q.sourceName||!q.sourceUrl)continue;
    latestQuotes.set(q.symbol,{price:q.last,currency:"USD",observed_on:q.asOf,source_name:q.sourceName,source_url:q.sourceUrl,timestamp_basis:"source_observation",source_recorded_at:null});
  }
  const canonicalQuoteCount=latestQuotes.size;
  for(const [alias,ticker] of Object.entries(aliases)){const q=latestQuotes.get(ticker);if(q)latestQuotes.set(alias,q);}
  // Private, manually source-attested PEG snapshots. Never exposed on public Markets.
  // A fetched forecast period date is NOT an analyst revision date.
  const {data:pegRecords,error:pegError}=ready&&trackedTickers.length
    ? await supabase.from("power_stack_peg_research_observations")
        .select("ticker,retrieved_at,estimate_native_updated_at,forecast_first_fy_end,forecast_second_fy_end,eps_first_fy,eps_second_fy,first_fy_analysts,second_fy_analysts,quote_price,quote_observed_on,quote_currency,estimate_currency,forecast_source,forecast_source_url,quote_source")
        .eq("owner_user_id",identity.user.id).in("ticker",trackedTickers.slice(0,250))
        .order("retrieved_at",{ascending:false}).limit(300)
    : {data:null,error:null};
  const pegByTicker=new Map<string,RebasedPegResearchEvaluation & {
    analystsFirst:number|null; analystsSecond:number|null; source:string;forecastSourceUrl:string;
  }>();
  if(!pegError)for(const record of pegRecords??[]){
    if(pegByTicker.has(record.ticker))continue;
    const ownerQuote=latestQuotes.get(record.ticker);
    const evaluation=repricePegResearch(record as PegResearchObservation,ownerQuote?{
      price:ownerQuote.price,currency:ownerQuote.currency,observed_on:ownerQuote.observed_on,
      source_url:ownerQuote.source_url,timestamp_basis:ownerQuote.timestamp_basis,
      source_recorded_at:ownerQuote.source_recorded_at,
    }:null);
    pegByTicker.set(record.ticker,{
      ...evaluation,
      analystsFirst:typeof record.first_fy_analysts==="number"?record.first_fy_analysts:null,
      analystsSecond:typeof record.second_fy_analysts==="number"?record.second_fy_analysts:null,
      source:typeof record.forecast_source==="string"?record.forecast_source:"",
      forecastSourceUrl:typeof record.forecast_source_url==="string"?record.forecast_source_url:"",
    });
  }

  // Reviewer-attested per-issuer valuations live in a *separate* owner-RLS
  // store. An absent table/migration is a visible coverage gap, never a buy.
  const {data:issuerValuationRows,error:issuerValuationError}=ready&&trackedTickers.length
    ? await supabase.from("power_stack_issuer_valuation_reviews")
        .select("ticker,reviewed_at,review_status,price_observed_on,market_price,price_currency,price_source_url,source_timestamp_basis,valuation_low,valuation_high,valuation_currency,valuation_method,valuation_source_url,method_explanation,downside_case,invalidation_test,financial_period_end,financials_currency,financials_unit,fundamental_source_url,revenue,net_income,operating_cash_flow,capital_expenditure,share_based_compensation,net_debt,reviewer_note")
        .eq("owner_user_id",identity.user.id).in("ticker",trackedTickers.slice(0,250))
        .order("reviewed_at",{ascending:false}).limit(300)
    : {data:null,error:null};
  const issuerReviews=projectIssuerValuationReviews(issuerValuationRows??[],trackedTickers,new Date(),250);
  // The source lookup starts ONLY after the verified owner session, allowlist,
  // and retired-public-snapshot gates. Never put ticker/holding data in public Regime routes.
  const researchedAt=new Date();
  const researchAssets:PowerStackTracked[]=ready?[
    ...holdings.filter(item=>item.ticker!=="6742UW").map(item=>({ticker:marketTicker(item.ticker),name:item.name,scope:"archived_holding" as const})),
    ...BLUEBELLY_STOCK_UNIVERSE.map(item=>({ticker:item.ticker,name:item.company,scope:"bb_market" as const})),
    ...bondWatch.map(item=>({ticker:item.ticker,name:item.name,scope:"bond_watch" as const})),
  ]:[];
  const researchTopics=ready?powerStackResearchTopics(researchAssets):[];
  // Funds and digital assets retain their private records but use separate analysis.
  const issuers:ValuationResearchAsset[]=ready?researchAssets.filter(item=>
    item.scope!=="bond_watch"&&!isNonIssuerInstrument(item.ticker)).filter((item,index,all)=>
      all.findIndex(other=>other.ticker.toUpperCase()===item.ticker.toUpperCase())===index).map(item=>({
      ...item,peg:pegByTicker.get(item.ticker)||null,
      quote:latestQuotes.get(item.ticker)?{
        price:latestQuotes.get(item.ticker)!.price,
        currency:latestQuotes.get(item.ticker)!.currency,
        observed_on:latestQuotes.get(item.ticker)!.observed_on,
        source_url:latestQuotes.get(item.ticker)!.source_url,
        timestamp_basis:latestQuotes.get(item.ticker)!.timestamp_basis,
      }:null,
    })):[];


  // Both reads happen only after owner/allowlist gating. Run in parallel to
  // avoid slowing the private terminal by sequential source collection.
  const [researchReads,reboundCapitalLeads,bbFundamentals,breadthFeed]=await Promise.all([
   researchTopics.length?getTopicInfluences(researchTopics,researchedAt):Promise.resolve([]),
   ready?getReboundCapitalResearchLeads(researchedAt):Promise.resolve(null),
   ready?readPublicFundamentalComparison(bbCoverage.rows,researchedAt):Promise.resolve(null),
   ready?getSourceDatedBreadth(true).catch(()=>({series:[],retrievalStatus:"fallback" as const})):Promise.resolve({series:[],retrievalStatus:"fallback" as const}),
  ]);
  const ownerOpportunityAssets=[...holdings,...watchlist,...(ideaRecords??[])].filter(item=>item.ticker!=="6742UW"&&!isNonIssuerInstrument(marketTicker(item.ticker))).map(item=>({ticker:marketTicker(item.ticker),name:item.name}));
  const opportunities=ready?projectOpportunityQueue(bbCoverage.rows,bbFundamentals?.rows??[],issuerReviews,ownerOpportunityAssets,researchedAt):[];
  const researchGroups=ready?projectPowerStackResearch(researchAssets,researchReads,researchedAt):[];
  const tape=publicMarketObservations(publicTape?.rows??[],"all");
  const compare=buildCompareResearch([...(publicTape?.rows??[]),...(publicTape?.divergenceRows??[])],[...tape,...compareBreadthObservations(breadthFeed.series,researchedAt)],researchedAt,breadthFeed.series);
  const tapeComparisons=buildMarketDivergenceWatch(tape,"1D");
  const measuredSignals=selectMeasuredMarketSignals(tapeComparisons,"1D",researchedAt,5);

  return (
    <main className={styles.page} data-power-stack="owner-only"
      data-private-data-ready={ready ? "yes" : "no"}>
      <BlueDeskHeader activePath="/power-stack" />
      <div className={styles.content}>
        <header className={portfolio.hero} data-v7-power-stack="dated-private-portfolio">
          <div>
            <p className={portfolio.eyebrow}>PRIVATE / POWER STACK · OWNER-VERIFIED RECORDS</p>
            <h1>Power Stack</h1>
            <p className={portfolio.deck}>
              My decision terminal for long-term investments, short-term setups and source-checked market intelligence.
              Private historical holdings remain below; portfolio values are not live brokerage data.
            </p>
          </div>
        </header>
        {ready?<PowerStackDecisionOverview compare={compare} tape={tape} now={researchedAt} breadthStatus={breadthFeed.retrievalStatus}/>:null}
        {ready?<p><Link href="/market-tools?view=technical-scan&scope=ps">Open EMA Scanner · My PowerStack →</Link></p>:null}
        {ready?<PowerStackFourHWatch reads={fourHWatch} plan={fourHPlan} selected={fourHSelected} snapshot={sharedTechnical}/>:null}
        {ready?<PowerStackBBMarketSweep rows={bbCoverage.rows} reviews={issuerReviews} asOf={bbCoverage.asOf} levels={privateLevels} fundamentals={bbFundamentals?.rows??[]} longHistory={longHistory} />:null}
        {ready?<PowerStackOpportunityQueue rows={opportunities} issuerUnavailable={bbFundamentals?.status!=="OK"}/>:null}
        <PowerStackDecisionHub now={researchedAt}/>
        {ready?<PowerStackMeasuredSignals signals={measuredSignals} trackedTickers={trackedTickers} topics={researchTopics}/>:null}
        {ready?<PowerStackResearchFocus assets={issuers} now={researchedAt}/>:null}
        {ready?<PowerStackValuationWorkbench assets={issuers} reviews={issuerReviews}
          storeError={Boolean(issuerValuationError)}/>:null}
        <NvidiaEarningsDecisionWatch mode="power-stack" now={researchedAt} owner={{
          recordedScope:holdings.some(h=>h.ticker==="NVDA")?"ARCHIVED_HOLDING":
            watchlist.some(w=>w.ticker==="NVDA")?"ARCHIVED_WATCHLIST":"NOT_IN_RECORDED_PORTFOLIO",
          quote:latestQuotes.has("NVDA")?{
            price:latestQuotes.get("NVDA")!.price,
            currency:latestQuotes.get("NVDA")!.currency,
            observedOn:latestQuotes.get("NVDA")!.observed_on,
            sourceName:latestQuotes.get("NVDA")!.source_name,
            sourceUrl:latestQuotes.get("NVDA")!.source_url,
            timestampBasis:latestQuotes.get("NVDA")!.timestamp_basis,
          }:null,
        }}/>
        {!ready ? (
          <section className={portfolio.pending} data-power-stack-migration="pending">
            <h2>Historical portfolio migration not yet verified</h2>
            <p>The old Power Stack GitHub Pages origin still needs to be secured
              and its personal data migrated. Holdings, quantities and account
              notes are deliberately withheld until the original public access
              and private snapshot have been verified.</p>
            <p>This does not block the source-dated investment and trade research above.
              {" "}<Link href="/markets">Open public Markets</Link>.
              {" "}<Link href="/my-reports">Return to My Desk</Link>.</p>
          </section>
        ) : (
          <>

            <PowerStackResearchImpact groups={researchGroups}/>
            <section className={portfolio.section} data-power-stack-rebound-capital="private-opinion-research-leads">
              <h2>Rebound Capital · independent fundamental research</h2>
              <p>Tier 1 investment-idea reading queue from its public Substack RSS. These are analyst opinions, not verified issuer financials, trade recommendations or Power Stack valuation approvals. Check each thesis against original filings, market prices and dated catalysts before acting.</p>
              <details className={portfolio.assetDetails}>
                <summary>Inspect {reboundCapitalLeads?.length ?? 0} recent Rebound Capital research leads</summary>
                {reboundCapitalLeads === null
                  ? <p>Research intake store unavailable; source coverage cannot be verified here.</p>
                  : reboundCapitalLeads.length === 0
                    ? <p>No Rebound Capital article has been collected in the last 30 days. The next canonical research cycle will attempt the RSS feed; an empty queue is not a feed-health check.</p>
                    : <ul>{reboundCapitalLeads.map(lead=><li key={lead.url}>
                        <a href={lead.url} target="_blank" rel="noopener noreferrer">{lead.title}</a>
                        {" · Published "+lead.publishedAt.slice(0,10)}
                      </li>)}</ul>}
              </details>
            </section>
            <section className={portfolio.section} data-power-stack-quotes="dated-manual-observations">
              <h2>Bluebelly source-dated prices · {canonicalQuoteCount}/{trackedTickers.length}</h2>
              <p>Current market observations are read from Bluebelly only, not a separate Power Stack quote feed; these are not streaming prices. Missing or unsupported symbols are not assigned invented prices.</p>
              <p data-power-stack-peg-coverage="owner-research-only">
                Forward PEG research: {pegByTicker.size} of {trackedTickers.length} tracked symbols.
                Uncovered names are not assigned estimates; non-equities, overseas listings and
                instruments with missing comparable forecasts may be ineligible.
              </p>
              {quoteError ? <p>Quote store unavailable; no current prices can be verified.</p> : null}
              <details className={portfolio.assetDetails} data-power-stack-quote-ledger="collapsed">
                <summary>Inspect all {trackedTickers.length} tracked instruments, dates, currencies and providers</summary>
                <div className={portfolio.tableScroll}>
                <table className={portfolio.holdingsTable}>
                  <thead><tr><th>Symbol</th><th>Observed price</th><th>Source date / basis</th><th>Freshness</th><th>Provider</th><th>FY-to-FY PEG research</th><th>Forecast basis</th></tr></thead>
                  <tbody>{trackedTickers.map(ticker => {
                    const quote = latestQuotes.get(ticker);
                    const age = quote ? Math.floor((Date.now()-Date.parse(quote.observed_on+"T00:00:00Z"))/86400000) : null;
                    const peg=pegByTicker.get(ticker);
                    return <tr key={ticker}><td>{ticker}</td>
                      <td>{quote ? quote.currency+" "+Number(quote.price).toFixed(2) : "Unavailable"}</td>
                      <td>{quote ? quote.observed_on + (quote.timestamp_basis === "upstream_batch" ? " · Batch date (not last trade)" : " · Market observation") : "—"}</td>
                      <td>{age === null ? "Missing" : age > 5 ? "STALE" : quote?.timestamp_basis === "upstream_batch" ? "Batch date only · trade time unknown" : age > 2 ? "Delayed / market closed" : "Recent daily observation"}</td>
                      <td>{quote ? <a href={quote.source_url} target="_blank" rel="noopener noreferrer">{quote.source_name}</a> : "—"}</td>
                      <td>
                        {!peg ? "—" : peg.forwardPEG===null
                          ? peg.reason==="NON_POSITIVE_GROWTH" ? "N/A · non-positive EPS growth" : "N/A · "+peg.reason
                          : peg.forwardPEG.toFixed(2)+" · "+(peg.quality==="indicative"?"Indicative":"STALE")}
                        {peg?.forwardPE!==null && peg?.forwardPE!==undefined ? <div>
                          Forward P/E {peg.forwardPE.toFixed(2)}×
                          {peg.growthPct!==null ? " · EPS "+(peg.growthPct>=0?"+":"")+peg.growthPct.toFixed(2)+"%" : ""}
                          {peg.growthPct!==null && peg.growthPct>100 ? " · Rebound-base sensitivity" : ""}
                        </div> : null}
                      </td>
                      <td>
                        {peg ? <>
                          {peg.forecastPeriod+" · Retrieved "+peg.forecastRetrievedOn.slice(0,10)}
                          {" · Analysts "+(peg.analystsFirst??"—")+"/"+(peg.analystsSecond??"—")}
                          {peg.analystsFirst!==null && peg.analystsFirst<5 ||
                            peg.analystsSecond!==null && peg.analystsSecond<5 ? " · Thin consensus" : ""}
                          {peg.hasNativeEstimateRevision?" · Native revision recorded":" · Native revision unknown"}
                          {" · "+peg.source}
                          {" · Price "+peg.quoteObservedOn+" / "+(peg.quoteBasis==="FRESH_OWNER_PRICE"?"fresh owner quote":"forecast snapshot")}
                          {peg.quoteSourceUrl?<a href={peg.quoteSourceUrl} target="_blank" rel="noopener noreferrer">Quote receipt ↗</a>:null}
                        </> : "Not covered"}
                      </td>
                    </tr>;
                  })}</tbody>
                </table>
                </div>
              </details>
              <p data-power-stack-peg-contract="private-retrieval-only">
                PEG research is calculated from a dated quote and two annual consensus EPS forecasts:
                forward P/E divided by the forecast EPS growth percentage from the first to second fiscal year.
                It is a one-year growth comparison, not a long-term PEG recommendation.
                Provider retrieval date is not the forecast's original revision date.
                Indicative observations are not ranked in the public Markets screener or counted in technical alignment.
                A PEG below 1 is not a standalone buy signal.
              </p>
              {pegError ? <p>Private PEG research is unavailable; Bluebelly market observations remain separate.</p> : null}
            </section>
            <section className={portfolio.section} data-power-stack-bond-watch="owner-research">
              <h2>Bond Watch · {bondWatch.length}</h2>
              <p>TLT and alternatives across Treasury duration, inflation protection and corporate credit.
                These are monitoring candidates, not holdings or trade instructions.</p>
              {ideasError ? <p>Bond watch unavailable: owner research could not be read.</p> : null}
              {bondWatch.length ? (
                <>
                  <p><strong>TLT</strong> · {latestQuotes.get("TLT")?.currency ?? "USD"} {latestQuotes.get("TLT") ? Number(latestQuotes.get("TLT")!.price).toFixed(2) : "Unavailable"}
                    {" "}· Source date {latestQuotes.get("TLT")?.observed_on ?? "unknown"}.
                    Main test: inflation and Treasury term-premium response to 10 November US CPI.
                    Long-duration prices can fall sharply when yields rise.</p>
                  <details className={portfolio.assetDetails} data-power-stack-bond-details="collapsed">
                    <summary>Compare {bondWatch.length} bond ETFs and research triggers</summary>
                    <div className={portfolio.watchGrid}>
                      {bondWatch.map(asset => {
                        const quote = latestQuotes.get(asset.ticker);
                        return (
                          <details key={asset.ticker} className={portfolio.assetDetails}>
                            <summary><strong>{asset.ticker} · {asset.name}</strong>
                              {" · "}{quote ? quote.currency + " " + Number(quote.price).toFixed(2) : "No verified quote"}
                              {" · "}{quote?.observed_on ?? "Source date unknown"}</summary>
                            <p>{asset.note ?? "Monitoring rationale pending"}</p>
                            <p><strong>Rate/credit test:</strong> {asset.macro_reason ?? "Await updated source evidence"}</p>
                            <p>Research checked {asset.macro_as_of ?? "undated"} · Macro context {asset.macro_state ?? "unknown"}.
                              ETF price is a dated provider observation, not a live executable quote.</p>
                          </details>
                        );
                      })}
                    </div>
                  </details>
                </>
              ) : <p>No current bond watch rows. Run a manually sourced Power Stack bond sweep first.</p>}
            </section>
            <section className={portfolio.section} data-power-stack-holdings="private">
              <h2>Recorded holdings · {holdings.length}</h2>
              <p data-power-stack-source-date="historical-only">Archived portfolio record dated {row?.snapshot_as_of ?? "unknown"}
                {snapshotAgeDays===null?"":` · ${snapshotAgeDays} days old`}.
                Quantities are historical and require broker reconciliation before any order.
                The latest verified prices are separate sourced market observations, not a broker balance, and do not change quantities or original entry records.</p>
              <div className={portfolio.tableScroll}>
                <table className={portfolio.holdingsTable}>
                  <thead><tr>
                    <th scope="col">Instrument</th><th scope="col">Quantity</th>
                    <th scope="col">Price as recorded</th><th scope="col">Latest verified price</th><th scope="col">Quantity / price date</th>
                  </tr></thead>
                  <tbody>{holdings.map(holding => (
                    <tr key={holding.ticker}>
                      <td>{holding.ticker} · {holding.name}</td>
                      <td>{holding.quantity ?? "Unavailable"}</td>
                      <td>{holding.lastPrice === null ? "Unavailable" : holding.currency + " " + holding.lastPrice}</td>
                      <td>{latestQuotes.has(holding.ticker)
                        ? latestQuotes.get(holding.ticker)!.currency + " " +
                          Number(latestQuotes.get(holding.ticker)!.price).toFixed(2) +
                          " · " + latestQuotes.get(holding.ticker)!.observed_on
                        : "Unavailable"}</td>
                      <td>{holding.quantityAsOf ?? "Unknown"} / {holding.priceAsOf ?? "Unknown"}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
              {holdings.length === 0 ? <p>No valid positions in this private snapshot.</p> : null}
            </section>
            <section className={portfolio.section} data-power-stack-watchlist="private" data-watchlist-mode="BB_CANONICAL">
              <h2>Market watch moved to Bluebelly</h2>
              <p>Bluebelly is the canonical market universe. The {watchlist.length} original Power Stack rankings remain in the immutable private archive, not an active watchlist. Manual sweeps use BB prices, EMA readings and verified fundamentals, then add issuer research and portfolio decisions.</p>
              <p><Link href="/markets">Open Bluebelly Markets</Link>{" · "}<Link href="/api/markets/stocks">Inspect source-dated equity coverage</Link>.</p>
              <details className={portfolio.assetDetails}><summary>Historical thesis and entry notes (archive only)</summary>
                {watchlist.map(asset=><details key={asset.ticker} className={portfolio.assetDetails}><summary>{asset.ticker} · {asset.name}</summary><p>{asset.theme}</p><p>Recorded entry: {asset.entry||"Unavailable"}</p><p>Invalidation: {asset.invalidation||"Unavailable"}</p></details>)}
              </details>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
