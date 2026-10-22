import { getXWireDurable } from "@/lib/x-wire-durable";
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
  const data = await getXWireDurable();
  return (
    <main className={styles.page} data-x-wire="private-durable-intake">
      <header className={styles.header}>
        <p className={styles.eyebrow}>PRIVATE BLUE DESK / RESEARCH INPUTS</p>
        <h1>X Intelligence Wire</h1>
        <p>Recent attributed X posts from registered accounts. Discovery only, not verified market evidence.</p>
        <p className={styles.secondary}>FxEmbed public API · Last checked {clock(data.retrievedAt)} · 2.5h normal lookback / 72h recovery cap · Storage {data.storageHealthy ? "connected" : "unavailable"}</p>
      </header>
      <div className={styles.stats}>
        <div><strong>{data.pendingCount}</strong><span>Stored discovery candidates</span></div>
        <div><strong>{data.health.healthy}/{data.health.monitored}</strong><span>Provider requests healthy</span></div>
        <div><strong>{data.health.partial + data.health.inaccessible}</strong><span>Incomplete / inaccessible</span></div>
        <div><strong>{data.deferredCount}</strong><span>Deferred, saved in backlog</span></div>
      </div>
      <aside className={styles.caution} role="note">
        <strong>Third-party discovery ledger — not verified market evidence.</strong>
        <p>{data.notice} The 250-candidate and 40-per-account budgets apply to active review, not persistence. Only the existing MacroPulse task runs scheduled research.</p>
      </aside>
      <section className={styles.grid}>
        <div>
          <h2>Recent post candidates</h2>
          {data.posts.length ? (
            <div className={styles.posts}>
              {data.posts.map(post => (
                <article className={styles.post} key={post.id}>
                  <div className={styles.postMeta}><strong>@{post.handle} · {post.intakeStatus.toUpperCase()}</strong><time dateTime={post.publishedAt}>{clock(post.publishedAt)}</time></div>
                  <p className={styles.body}>{post.text}</p>
                  <div className={styles.links}>
                    <a href={post.url} target="_blank" rel="noopener noreferrer">Open original X post ↗</a>
                    {post.quoteUrl ? <a href={post.quoteUrl} target="_blank" rel="noopener noreferrer">Quoted post ↗</a> : null}
                    {post.images.length ? <span>{post.images.length} media attachment(s) · view at original post</span> : null}
                  </div>
                </article>
              ))}
            </div>
          ) : <p className={styles.empty}>No persisted attributable post candidates. Check account health; absence of posts does not establish that X has been quiet.</p>}
        </div>
        <div>
          <h2>Source health · {data.accounts.length} accounts</h2>
          <div className={styles.accounts}>
            {data.accounts.map(account => (
              <article className={styles.account} key={account.handle}>
                <div className={styles.accountTop}><strong>@{account.handle}</strong><span data-health={account.status}>{account.status.toUpperCase()}</span></div>
                <div className={styles.accountMeta}>Last fetch returned {account.fetched} · Last completed scan: {clock(account.lastSuccessAt)}</div>
                <div className={styles.accountMeta}>Last observed: {clock(account.lastObservedPostAt)}</div>
                {account.error ? <p className={styles.error}>{account.error}</p> : null}
              </article>
            ))}
          </div>
        </div>
      </section>
      <footer className={styles.footer}>Opening this owner-only page may refresh the protected source cache and durable discovery queue when a lease is due. No Story, canonical evidence UUID, research schedule, or Notion research post is changed.</footer>
    </main>
  );
}
