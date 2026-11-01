import "server-only";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import styles from "@/app/blue-desk/blue-desk.module.css";

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
type ArchivedMove={id:string;title:string;description:string;do:string;notYet:string};
type ArchivedOpportunity={symbol:string;name:string;action:string;buyWhen:string;sellWhen:string};
type ArchivedAdvisor={
  headline:string;summary:string;asOf:string;totalMYR:number|null;
  cashVerified:boolean;positionsVerified:boolean;
  moves:ArchivedMove[];opportunities:ArchivedOpportunity[];
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

/** Decision-first archive; no stored recommendation becomes a live order. */
function parseOwnerAdvisor(snapshot:unknown):ArchivedAdvisor|null {
  if(!snapshot || typeof snapshot!=="object" || Array.isArray(snapshot))return null;
  const raw=(snapshot as Record<string,unknown>).investmentAdvisor;
  if(!raw || typeof raw!=="object" || Array.isArray(raw))return null;
  const obj=raw as Record<string,unknown>;
  const capital=obj.capital && typeof obj.capital==="object" && !Array.isArray(obj.capital)
    ? obj.capital as Record<string,unknown> : {};
  const moves=(Array.isArray(obj.firstMoves)?obj.firstMoves:[]).slice(0,4)
    .filter((item:unknown)=>item && typeof item==="object" && !Array.isArray(item))
    .map((value:unknown)=>{
      const x=value as Record<string,unknown>;
      return {id:cleanString(x.id,25),title:cleanString(x.title,180),
        description:cleanString(x.description,500),do:cleanString(x.do,600),
        notYet:cleanString(x.notYet,600)};
    });
  const opportunities=(Array.isArray(obj.opportunities)?obj.opportunities:[]).slice(0,12)
    .filter((item:unknown)=>item && typeof item==="object" && !Array.isArray(item))
    .map((value:unknown)=>{
      const x=value as Record<string,unknown>;
      return {symbol:cleanString(x.symbol,20),name:cleanString(x.name),
        action:cleanString(x.action,150),buyWhen:cleanString(x.buyWhen,600),
        sellWhen:cleanString(x.sellWhen,600)};
    });
  return {headline:cleanString(obj.heading,180),summary:cleanString(obj.standfirst,650),
    asOf:cleanString(obj.asOf,30),totalMYR:finiteOrNull(capital.totalMYR),
    cashVerified:capital.cashVerified===true,positionsVerified:capital.positionsVerified===true,
    moves,opportunities};
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

export default async function PrivatePowerStack() {
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
  const ready = row?.legacy_source_retired === true;
  const holdings = ready && row ? parseOwnerHoldings(row.snapshot) : [];
  const watchlist = ready && row ? parseOwnerWatchlist(row.snapshot) : [];
  const advisor = ready && row ? parseOwnerAdvisor(row.snapshot) : null;

  return (
    <main className={styles.page} data-power-stack="owner-only"
      data-private-data-ready={ready ? "yes" : "no"}>
      <BlueDeskHeader activePath="/power-stack" />
      <div className={styles.content}>
        <header className={styles.calendarHero}>
          <div>
            <p className={styles.kicker}>PRIVATE / POWER STACK</p>
            <h1>My Portfolio</h1>
            <p className={styles.heroDeck}>
              Power Stack investment research and positions, using the same
              approved Google session as My Desk. No separate account picker.
            </p>
          </div>
        </header>
        {!ready ? (
          <section className={styles.section} data-power-stack-migration="pending">
            <h2>Private portfolio migration not yet verified</h2>
            <p>The old Power Stack GitHub Pages origin still needs to be secured
              and its personal data migrated. Holdings, quantities and account
              notes are deliberately withheld until the original public access
              and private snapshot have been verified.</p>
            <p>This does not block anonymous market research.
              {" "}<Link href="/markets">Open public Markets</Link>.
              {" "}<Link href="/my-reports">Return to My Desk</Link>.</p>
          </section>
        ) : (
          <>
            {advisor ? <section className={styles.section} data-power-stack-advisor="private">
              <p className={styles.kicker}>ARCHIVED DECISION BRIEF · {advisor.asOf || "Date unavailable"}</p>
              <h2>{advisor.headline || "Investment decision brief"}</h2>
              <p>{advisor.summary}</p>
              <p><strong>Recorded total mandate:</strong> {advisor.totalMYR === null ?
                "Unavailable" : "RM" + advisor.totalMYR.toLocaleString("en-MY")}
                {" · "}Cash independently verified: {advisor.cashVerified ? "Yes" : "No"}
                {" · "}Positions reconciled: {advisor.positionsVerified ? "Yes" : "No"}</p>
              <h3>Decisions to revisit</h3>
              <div style={{display:"grid",gap:12,gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,290px),1fr))"}}>
                {advisor.moves.map((move,i)=><article key={move.id||i}
                  style={{padding:16,border:"1px solid currentColor",borderRadius:10}}>
                  <h3>{move.title}</h3>
                  <p>{move.description}</p>
                  <p><strong>Original next step:</strong> {move.do}</p>
                  <p><strong>Hold off until:</strong> {move.notYet}</p>
                </article>)}
              </div>
              <h3>Investigated opportunities</h3>
              {advisor.opportunities.map((asset,i)=><details key={asset.symbol||i}
                style={{padding:12,marginBottom:8,border:"1px solid currentColor",borderRadius:8}}>
                <summary>{asset.symbol} · {asset.name} — {asset.action}</summary>
                <p><strong>Original entry test:</strong> {asset.buyWhen||"Unavailable"}</p>
                <p><strong>Risk / exit test:</strong> {asset.sellWhen||"Unavailable"}</p>
              </details>)}
              <p>Archived decision support only. No new capital is committed, and broker verification,
                cash reconciliation and fresh issuer/price evidence are required.</p>
            </section> : null}
            <section className={styles.section} data-power-stack-holdings="private">
              <h2>Recorded holdings · {holdings.length}</h2>
              <p>Archived portfolio record dated {row?.snapshot_as_of ?? "unknown"}.
                Quantities are historical and require broker reconciliation before any order.
                Prices use their original observation dates.</p>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",textAlign:"left"}}>
                  <thead><tr>
                    <th scope="col">Instrument</th><th scope="col">Quantity</th>
                    <th scope="col">Price as recorded</th><th scope="col">Quantity / price date</th>
                  </tr></thead>
                  <tbody>{holdings.map(holding => (
                    <tr key={holding.ticker}>
                      <td>{holding.ticker} · {holding.name}</td>
                      <td>{holding.quantity ?? "Unavailable"}</td>
                      <td>{holding.lastPrice === null ? "Unavailable" : holding.currency + " " + holding.lastPrice}</td>
                      <td>{holding.quantityAsOf ?? "Unknown"} / {holding.priceAsOf ?? "Unknown"}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
              {holdings.length === 0 ? <p>No valid positions in this private snapshot.</p> : null}
            </section>
            <section className={styles.section} data-power-stack-watchlist="private">
              <h2>Research watchlist · {watchlist.length}</h2>
              <p>Archived rankings and thesis gates from the original Power Stack.
                Scores are historical research assessments, not present-day trade signals.
                Open a ticker for its entry condition and invalidation.</p>
              <div style={{display:"grid",gap:12,gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,320px),1fr))"}}>
                {watchlist.map(asset => (
                  <details key={asset.ticker} style={{padding:16,border:"1px solid currentColor",borderRadius:10}}>
                    <summary>
                      <strong>{asset.ticker} · {asset.name}</strong>
                      {" · "}Rank {asset.rank ?? "—"}
                      {" · "}Score {asset.score ?? "—"}
                    </summary>
                    <p>{asset.theme || "Theme not recorded"}</p>
                    <p><strong>Recorded action:</strong> {asset.action || asset.bucket || "Research pending"}</p>
                    <p><strong>Entry test:</strong> {asset.entry || "Unavailable"}</p>
                    <p><strong>Invalidation:</strong> {asset.invalidation || "Unavailable"}</p>
                  </details>
                ))}
              </div>
              <p>Research dates, price levels and assertions may now be stale. Recheck
                broker balances, official issuer releases and live quotes before acting.</p>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
