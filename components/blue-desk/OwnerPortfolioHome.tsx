import "server-only";
import Link from "next/link";
import {redirect} from "next/navigation";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import OwnerPowerStackFullScan from "./OwnerPowerStackFullScan";
import type {PortfolioTableQuery} from "@/lib/bluebelly-owner-portfolio-filter";
import ui from "./OwnerPortfolioHome.module.css";

type PrivateSnapshot={snapshot_as_of:string;legacy_source_retired:boolean;snapshot:unknown};
/** Private owner-only snapshot; no new price service or external provider reads.
 * Full issuer work belongs in manually researched Power Stack editions. */
export default async function OwnerPortfolioHome({filters}:{filters:PortfolioTableQuery}){
 const supabase=await createSupabaseServerClient().catch(()=>null);
 if(!supabase)return <section className={ui.status}><h2>Portfolio unavailable</h2><p>Google authentication is not configured.</p></section>;
 const {data:{user},error:authError}=await supabase.auth.getUser();
 if(authError||!user?.id||!user.email)redirect("/auth/google?next=%2Fmy-reports%3Fview%3Dportfolio");
 const {data:access,error:allowError}=await supabase.from("app_access_allowlist")
  .select("email").eq("email",user.email.trim().toLowerCase()).eq("active",true).maybeSingle();
 if(allowError||!access)redirect("/login?error=not_allowed&next=%2Fmy-reports%3Fview%3Dportfolio");
 const {data:record,error:readError}=await supabase.from("power_stack_owner_snapshots")
  .select("snapshot_as_of,legacy_source_retired,snapshot").eq("owner_user_id",user.id)
  .order("snapshot_as_of",{ascending:false}).limit(1).maybeSingle();
 const snapshot=!readError&&record?record as PrivateSnapshot:null;
 const ready=snapshot?.legacy_source_retired===true;
 return <section className={ui.root} data-my-desk-portfolio="google-allowlisted" data-private-data-ready={ready?"yes":"no"}>
  <div className={ui.intro}>
   <div><p className={ui.kicker}>02 / MY PORTFOLIO · PRIVATE</p>
    <h2>My Portfolio</h2>
    <p>Recorded holdings and research watchlist in one sortable market-style table. Prices are source-dated observations, not live broker balances.</p></div>
   <a href="https://clydigital.github.io/power-stack/" target="_blank" rel="noopener noreferrer">Power Stack analysis ↗</a>
  </div>
  {!ready?<div className={ui.status} role="status" data-portfolio-migration="pending">
    <strong>Portfolio snapshot not available</strong>
    <p>Your private snapshot has not cleared its migration gate. We won't substitute public prices, invent quantities, or display stale account values.</p>
    <p><Link href="/markets">Browse the public Markets table</Link> while access is reviewed.</p>
   </div>:<>
    <p className={ui.vintage}>Private owner snapshot · {snapshot?.snapshot_as_of||"Date unavailable"} · Historic research, not broker-verified cash or P&amp;L. Select any column to sort; select an instrument to see its saved thesis.</p>
    <OwnerPowerStackFullScan snapshot={snapshot?.snapshot} ownerSnapshotAsOf={snapshot?.snapshot_as_of||null} filters={filters}/>
   </>}
 </section>;
}
