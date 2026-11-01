import "server-only";

import Link from "next/link";
import { redirect } from "next/navigation";

import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import PublicMarketScreener from "@/components/blue-desk/PublicMarketScreener";
import { getMarketMonitor } from "@/lib/market-monitor-public";
import { publicMarketObservations } from "@/lib/blue-desk-public-markets";
import {
  getPowerStackResearchAssets, mergePowerStackMarketSearch,
} from "@/lib/bluebelly-power-stack-public";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import styles from "@/app/blue-desk/blue-desk.module.css";
import legibility from "@/app/blue-desk/markets/legibility.module.css";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Power Stack | Bluebelly Private Markets",
  robots: { index: false, follow: false },
};

export default async function PrivatePowerStackMarkets() {
  // Defense in depth: middleware already gates this exact private path,
  // but page data itself must never load before the Google session and
  // active access allowlist have been verified on the server.
  const supabase = await createSupabaseServerClient().catch(()=>null);
  if (!supabase) redirect("/login?error=configuration&next=%2Fmarkets%2Fpowerstack");
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user?.email)
    redirect("/auth/google?next=%2Fmarkets%2Fpowerstack");
  // Only Google identity sessions are eligible for this personal research view.
  if (user.app_metadata?.provider !== "google")
    redirect("/login?error=not_allowed&next=%2Fmarkets%2Fpowerstack");
  const { data: access, error: accessError } = await supabase
    .from("app_access_allowlist").select("email")
    .eq("email",user.email.toLowerCase().trim()).eq("active",true).maybeSingle();
  if (accessError || !access)
    redirect("/login?error=not_allowed&next=%2Fmarkets%2Fpowerstack");

  const [monitor, powerStack] = await Promise.all([
    getMarketMonitor().catch(()=>null),
    getPowerStackResearchAssets(),
  ]);
  const publicRows = publicMarketObservations(monitor?.rows||[],"all");
  const observations=mergePowerStackMarketSearch(publicRows,powerStack.items)
    .filter(row=>Boolean(row.researchRole));

  return (
    <main className={`${styles.page} ${legibility.publicMarketsLegibility}`}
      data-powerstack-auth-boundary="google-allowlisted" data-private-page="powerstack">
      <BlueDeskHeader activePath="/markets/powerstack"/>
      <div className={styles.content}>
        <header className={`${styles.calendarHero} ${legibility.marketHero}`}>
          <div>
            <p className={styles.kicker}>PRIVATE · APPROVED GOOGLE ACCOUNT</p>
            <h1>Power Stack watchlist</h1>
            <p className={styles.heroDeck}>Watchlist and holding-research labels
              with source-dated 1D, 3D and 5D changes. This is not a trading console.</p>
          </div>
          <div className={styles.calendarClock}>
            <span className={styles.kicker}>RESEARCH COVERAGE</span>
            <strong className={styles.publicMarketTotal}>{observations.length} assets</strong>
            <small>Source timestamps and gaps are shown below</small>
          </div>
        </header>
        <section className={`${styles.section} ${legibility.marketSection}`}>
          <p><Link href="/markets">← Return to public Markets</Link></p>
          <div className={styles.sectionHead}><div>
            <h2>Filter your Power Stack research</h2>
            <p>Search, compare and sort 1D/3D/5D. Holdings and watchlist records
            are visible here only after Google sign-in and allowlist approval.</p>
          </div></div>
          <p className={styles.muted}>Power Stack source:
            {" "}<a href="https://clydigital.github.io/power-stack/"
              target="_blank" rel="noreferrer">original research repository ↗</a>
            . Registry {powerStack.status}; dated price feed {powerStack.tapeStatus}.
            No account values, quantities, cost basis or broker sessions are loaded.
            Upstream Power Stack content itself is hosted publicly; the gate
            controls visibility through Bluebelly, not the upstream repository.</p>
          <PublicMarketScreener observations={observations}
            group="powerstack" dataAvailable={powerStack.items.length>0}/>
        </section>
      </div>
    </main>
  );
}
