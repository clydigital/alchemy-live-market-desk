import { fetchXWirePreview } from "@/lib/x-wire-provider";
import styles from "./x-wire.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = {
  title: "X Wire | Private Blue Desk",
  description: "Owner-only X source-attempt diagnostics and recent attributed leads.",
};

function clock(value: string | null) {
  return value ? new Date(value).toLocaleString("en-GB", {
    timeZone: "Asia/Kuala_Lumpur", day: "2-digit", month: "short",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }) + " MYT" : "Not observed";
}

export default async function OwnerXWirePage() {
  const data = await fetchXWirePreview();
  return (
    <main className={styles.page} data-x-wire="private-on-demand">
      <header className={styles.header}>
        <p className={styles.eyebrow}>PRIVATE BLUE DESK / RESEARCH INPUTS</p>
        <h1>X Intelligence Wire</h1>
        <p>Recent attributed X posts from registered accounts. Discovery only, not verified market evidence.</p>
        <p className={styles.secondary}>Provider: FxEmbed public X API · Retrieved {clock(data.retrievedAt)} · {data.window.windowHours}h lookback</p>
      </header>
      <div className={styles.stats}>
        <div><strong>{data.posts.length}</strong><span>Displayed candidates</span></div>
        <div><strong>{data.health.healthy}/{data.health.monitored}</strong><span>Provider requests healthy</span></div>
        <div><strong>{data.health.partial + data.health.inaccessible}</strong><span>Incomplete / inaccessible</span></div>
        <div><strong>{data.deferredCount}</strong><span>Deferred (not persisted)</span></div>
      </div>
      <aside className={styles.caution} role="note">
        <strong>Third-party provider preview — not a live verified feed.</strong>
        <p>{data.disclaimer} The 250-candidate and 40-per-account limits apply; only the existing MacroPulse task performs scheduled research.</p>
      </aside>
      <section className={styles.grid}>
        <div>
          <h2>Recent post candidates</h2>
          {data.posts.length ? (
            <div className={styles.posts}>
              {data.posts.map(post => (
                <article className={styles.post} key={post.id}>
                  <div className={styles.postMeta}><strong>@{post.handle}</strong><time dateTime={post.publishedAt}>{clock(post.publishedAt)}</time></div>
                  <p className={styles.body}>{post.text}</p>
                  <div className={styles.links}>
                    <a href={post.url} target="_blank" rel="noopener noreferrer">Open original X post ↗</a>
                    {post.quoteUrl ? <a href={post.quoteUrl} target="_blank" rel="noopener noreferrer">Quoted post ↗</a> : null}
                    {post.images.length ? <span>{post.images.length} media attachment(s) · view at original post</span> : null}
                  </div>
                </article>
              ))}
            </div>
          ) : <p className={styles.empty}>No dated, attributable post candidates returned in this window. Check account health below; this is not proof of a quiet X feed.</p>}
        </div>
        <div>
          <h2>Source health · {data.accounts.length} accounts</h2>
          <div className={styles.accounts}>
            {data.accounts.map(account => (
              <article className={styles.account} key={account.handle}>
                <div className={styles.accountTop}><strong>@{account.handle}</strong><span data-health={account.status}>{account.status.toUpperCase()}</span></div>
                <div className={styles.accountMeta}>Returned {account.fetched} · attributable {account.newPosts}</div>
                <div className={styles.accountMeta}>Last observed: {clock(account.lastObservedPostAt)}</div>
                {account.error ? <p className={styles.error}>{account.error}</p> : null}
              </article>
            ))}
          </div>
        </div>
      </section>
      <footer className={styles.footer}>No story, thesis version, canonical evidence UUID, research task, Supabase row or Notion entry is changed by opening this page.</footer>
    </main>
  );
}
