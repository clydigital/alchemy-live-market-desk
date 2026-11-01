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
  const holdings = ready ? parseOwnerHoldings(row.snapshot) : [];

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
          <section className={styles.section} data-power-stack-holdings="private">
            <h2>Recorded positions</h2>
            <p>Snapshot dated {row.snapshot_as_of}. These are historical position
              records, not a live broker reconciliation or trade instruction.</p>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",textAlign:"left"}}>
                <thead><tr><th scope="col">Instrument</th><th scope="col">Quantity</th>
                  <th scope="col">Last recorded price</th><th scope="col">Quote as of</th></tr></thead>
                <tbody>{holdings.map(holding => (
                  <tr key={holding.ticker}>
                    <td>{holding.ticker} · {holding.name}</td>
                    <td>{holding.quantity ?? "Unavailable"}</td>
                    <td>{holding.lastPrice === null ? "Unavailable" : holding.currency + " " + holding.lastPrice}</td>
                    <td>{holding.priceAsOf ?? "Unknown"}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            {holdings.length === 0 ? <p>No valid positions in this private snapshot.</p> : null}
            <p>Position quantities last checked on their individual quantity-as-of dates;
              confirm with your broker before using these figures for orders.</p>
          </section>
        )}
      </div>
    </main>
  );
}
