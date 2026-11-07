import Link from "next/link";
import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import {getXWireOwnerView} from "@/lib/x-wire-owner-view";
import {X_WIRE_THEMES,xWireOwnerHref} from "@/lib/x-wire-owner-query";
import {getBluebellyAbsorptionHealth} from "@/lib/bluebelly-absorption-health";
import styles from "./x-wire.module.css";

export const dynamic="force-dynamic";
export const revalidate=0;
export const maxDuration=30;
export const metadata={title:"X Wire | Bluebelly",robots:{index:false,follow:false},
  description:"Owner-only X source and research intake diagnostics."};

function clock(x:string|null){
  return x&&Number.isFinite(Date.parse(x))?new Date(x).toLocaleString("en-GB",{
    timeZone:"Asia/Kuala_Lumpur",day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit",
    hour12:false})+" MYT":"Not observed";
}
export default async function OwnerXWirePage({searchParams}:{
  searchParams:Promise<Record<string,string|string[]|undefined>>;
}){
  const params=await searchParams;
  const [wire,absorption]=await Promise.all([getXWireOwnerView(params),getBluebellyAbsorptionHealth()]);
  const f=wire.filters;
  const from=wire.total?(f.page-1)*25+1:0;
  const to=Math.min(f.page*25,wire.total);
  return <>
    <BlueDeskHeader activePath="/owner/x-wire"/>
    <main className={styles.page} data-x-wire="owner-paginated-ledger">
      <header className={styles.header}>
        <p className={styles.eyebrow}>BLUEBELLY / PRIVATE SOURCE OPERATIONS</p>
        <h1>X Intelligence Wire</h1>
        <p>Search the durable X archive, examine source coverage and distinguish discovery from research handoff.</p>
        <p className={styles.secondary}>Owner-only · Server-side filtered pages · No third-party source requests during browsing</p>
      </header>
      <div className={styles.stats}>
        <div><strong>{wire.error?"—":wire.sourceHealthy+"/"+wire.sourceMonitored}</strong><span>Complete, fresh source checks</span></div>
        <div><strong>{wire.error?"—":wire.total.toLocaleString("en-GB")}</strong><span>Posts matching the filters</span></div>
        <div><strong>{absorption?.handedToResearch48h??"—"}</strong><span>X leads handed to research · 48h</span></div>
        <div><strong>{absorption?.historicalGaps??"—"}</strong><span>Unresolved source-history gaps</span></div>
      </div>
      <aside className={styles.caution} role="note">
        <strong>Third-party discovery is not verification.</strong>
        <p>Stored X posts and research intake records do not prove the social claims. Provider retries and historical gaps remain visible. Existing scheduled research jobs own ingestion and editorial promotion; navigating pages never triggers another scan.</p>
      </aside>
      <section className={styles.filters} aria-label="Search X Wire">
        <h2>Browse the archive</h2>
        <form method="get" action="/owner/x-wire" className={styles.filterForm}>
          <label>Topic<select name="theme" defaultValue={f.theme}><option value="">All topics</option>{X_WIRE_THEMES.map(([key,label])=><option value={key} key={key}>{label}</option>)}</select></label>
          <label>Account<select name="handle" defaultValue={f.handle}><option value="">All accounts</option>{wire.accounts.map(a=><option value={a.handle} key={a.handle}>@{a.handle}</option>)}</select></label>
          <label>Status<select name="status" defaultValue={f.status}><option value="">All statuses</option><option value="discovery">Discovery</option><option value="deferred">Deferred</option><option value="reviewed">Reviewed</option><option value="rejected">Rejected</option></select></label>
          <label>Period<select name="period" defaultValue={f.period}><option value="24h">Last 24h</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="all">All history</option></select></label>
          <label className={styles.searchLabel}>Search posts<input type="search" name="q" maxLength={100} defaultValue={f.q} placeholder="Keyword or phrase"/></label>
          <button type="submit">Apply filters</button><Link href="/owner/x-wire">Reset</Link>
        </form>
        <p className={styles.filterHint}>Topics are overlapping keyword lenses. A post can appear under more than one topic.</p>
      </section>
      <section className={styles.grid}>
        <div>
          <div className={styles.listHead}><h2>Stored posts</h2><span>{wire.error?"Read unavailable":`Showing ${from}–${to} of ${wire.total}`}</span></div>
          {wire.error?<p className={styles.empty}>{wire.error}</p>:wire.posts.length?<div className={styles.posts}>{wire.posts.map(p=>
            <article className={styles.post} key={p.id}>
              <div className={styles.postMeta}><strong>@{p.handle} · {p.status.toUpperCase()}</strong><time dateTime={p.publishedAt}>{clock(p.publishedAt)}</time></div>
              <div className={styles.themeTags}>{p.themes.length?p.themes.map(t=><span key={t}>{X_WIRE_THEMES.find(x=>x[0]===t)?.[1]||t}</span>):<span>Unclassified</span>}</div>
              <p className={styles.body}>{p.text}</p>
              <div className={styles.links}><a href={p.url} target="_blank" rel="noopener noreferrer">Original X post</a>{p.quoteUrl?<a href={p.quoteUrl} target="_blank" rel="noopener noreferrer">Quoted post</a>:null}{p.mediaCount?<span>{p.mediaCount} media attachment(s)</span>:null}</div>
            </article>
          )}</div>:<p className={styles.empty}>No stored posts match these filters. This does not establish that the source had no posts.</p>}
          {!wire.error&&wire.pageCount>1?<nav className={styles.pagination} aria-label="X Wire pages">
            {f.page>1?<Link href={xWireOwnerHref(f,{page:f.page-1})}>Previous</Link>:<span>Previous</span>}
            <strong>Page {f.page} of {wire.pageCount}</strong>
            {f.page<wire.pageCount?<Link href={xWireOwnerHref(f,{page:f.page+1})}>Next</Link>:<span>Next</span>}
          </nav>:null}
        </div>
        <aside>
          <h2>Source health · {wire.accounts.length} accounts</h2>
          <div className={styles.accounts}>{wire.accounts.map(a=><article className={styles.account} key={a.handle}>
            <div className={styles.accountTop}><strong>@{a.handle}</strong><span data-health={a.status}>{a.status.toUpperCase()}</span></div>
            <div className={styles.accountMeta}>Attempt: {clock(a.attemptedAt)} · fetched {a.lastFetched}</div>
            <div className={styles.accountMeta}>Last complete check: {clock(a.completedAt)}</div>
            <div className={styles.accountMeta}>Latest observed post: {clock(a.observedAt)}</div>
            {a.historicalGap?<p className={styles.error}>Historical gap remains unverified. Recent posts may still be arriving.</p>:null}
            {a.resumePending?<p className={styles.accountMeta}>Continuation pending on next eligible scan</p>:null}
            {a.error?<p className={styles.error}>{a.error}</p>:null}
          </article>)}</div>
        </aside>
      </section>
      <footer className={styles.footer}>Provider source health, post intake, research handoff and canonical verification are separate stages. An accepted intake record is not evidence that its market claim was verified.</footer>
    </main>
  </>;
}
