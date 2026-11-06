import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import Link from "next/link";
import {redirect} from "next/navigation";
import styles from "@/app/blue-desk/blue-desk.module.css";
import layout from "./my-desk.module.css";

export const dynamic="force-dynamic";
export const revalidate=0;
export const metadata={title:"My Desk | Bluebelly",robots:{index:false,follow:false}};

/**
 * Private navigation hub, NOT a second research-generation or report reader.
 * Legacy source receipts, HTML/PDF editions and Writing Brain parent IDs
 * remain stored and protected by their existing authenticated routes.
 * The site's role is monitoring; ChatGPT handles synthesis and writing.
 */
export default async function MyBluebellyReports({searchParams}:{
 searchParams:Promise<Record<string,string|string[]|undefined>>
}){
 const params=await searchParams;
 if(params.view==="portfolio")redirect("/my-reports");
 return <main className={styles.page} data-bluebelly-my-reports="owner-only"
   data-private-desk="source-first-market-workspace">
  <BlueDeskHeader activePath="/my-reports"/>
  <div className={styles.content}>
   <header className={styles.calendarHero}>
    <div>
     <p className={styles.kicker}>PRIVATE / BLUEBELLY</p>
     <h1>My Desk</h1>
     <p className={styles.heroDeck}>Your shortcuts to markets, source evidence and research tools. Analysis and writing now happen in ChatGPT.</p>
    </div>
   </header>

   <section className={layout.hub} aria-label="My Desk workspace">
    <div className={layout.hubHeading}>
     <div>
      <p className={layout.hubEyebrow}>MONITOR / VERIFY / RESEARCH</p>
      <h2>One market workspace</h2>
     </div>
     <Link href="/newsroom">Latest verified news</Link>
    </div>
    <div className={layout.hubGrid} data-my-desk-primary="market-research-shortcuts">
     <article className={layout.hubCard}>
      <span>01 / MARKET MONITOR</span>
      <h3>Markets &amp; breadth</h3>
      <p>Source-dated instruments, sector moves and yield comparisons where observations are available.</p>
      <Link href="/markets">Open Markets</Link>
     </article>
     <article className={layout.hubCard}>
      <span>02 / EVIDENCE</span>
      <h3>Research Library</h3>
      <p>Inspect source receipts and archived research without starting a duplicate daily report.</p>
      <Link href="/owner/research">Open Research Library</Link>
     </article>
     <article className={layout.hubCard}>
      <span>03 / CREATOR SIGNALS</span>
      <h3>X Wire</h3>
      <p>Review creator and social observations as leads, separate from original-source verification.</p>
      <Link href="/owner/x-wire">Review X Wire</Link>
     </article>
     <article className={layout.hubCard}>
      <span>04 / ANALYSIS TOOLS</span>
      <h3>Market Tools</h3>
      <p>Access existing authenticated market utilities and technical checks.</p>
      <Link href="/market-tools">Open Market Tools</Link>
     </article>
    </div>

    <div className={layout.hubNote} data-my-desk-portfolio-status="not-verified">
     <p><strong>ChatGPT-first research:</strong> use the installed Bluebelly Read-Only Desk plugin for dated evidence and the existing writing workflows for article preparation. No new research schedule is started here.</p>
     <p><strong>Portfolio:</strong> holdings are not displayed until an authenticated source and complete readback are verified. The Markets page remains available independently.</p>
    </div>
   </section>
  </div>
 </main>;
}
