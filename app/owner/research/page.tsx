import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import ResearchLibraryExplorer from "@/components/blue-desk/ResearchLibraryExplorer";
import MarketResearchGapQueue from "@/components/blue-desk/MarketResearchGapQueue";
import { fetchTodayNotionResearch } from "@/lib/notion-market-research";
import {getOwnerResearchHandoffStatus} from "@/lib/bluebelly-owner-research-handoff-status";
import desk from "@/app/blue-desk/blue-desk.module.css";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Research Library | Bluebelly",
  description: "Private source-linked market research archive, topic map and research gaps.",
};

/** Never expose this route via the public Bluebelly allowlist.
 * Middleware enforces private-host owner auth; the Notion reader is owner-only.
 * No canonical Dossier writes, source promotion or research scheduling here.
 */
export default async function OwnerResearchLibraryPage() {
  const intake = await fetchTodayNotionResearch().catch(() => ({
    status: "UNAVAILABLE" as const,
    sources: [],
    warnings: ["Research source retrieval failed; the archive links remain available."],
    fetchedAt: new Date().toISOString(),
  }));
  const handoff=await getOwnerResearchHandoffStatus().catch(()=>null);
  return (
    <main className={desk.page} data-owner-research-library="private-read-only">
      <BlueDeskHeader activePath="/owner/research" />
      <section data-owner-research-handoff="source-to-publication-readonly"
        style={{margin:"16px auto",maxWidth:1120,padding:"18px 22px",border:"1px solid var(--border, #527084)",borderRadius:14}}>
       <h2 style={{fontSize:"1.15rem",marginBottom:8}}>Research → Newsroom handoff</h2>
       <p style={{marginBottom:12}}>Research completed is not the same as content reviewed and published. This private read-only summary shows the last confirmed database receipts.</p>
       {handoff?<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12}}>
        <div><small>LAST AUTONOMOUS RESEARCH RUN</small><p><strong>{handoff.lastRunAt?new Date(handoff.lastRunAt).toLocaleString("en-GB",{timeZone:"Asia/Kuala_Lumpur"}):"Unavailable"}</strong></p><small>{handoff.lastRunStatus||"No run receipt"} · {handoff.lastRunPublications} updates published</small></div>
        <div><small>MACROPULSE BRIEFS IN REVIEW</small><p><strong>{handoff.pendingReview}</strong></p><small>Not in public dispatch feed</small></div>
        <div><small>MACROPULSE BRIEFS PUBLISHED</small><p><strong>{handoff.publishedBriefs}</strong></p><small>Public dispatch projection only</small></div>
        <div><small>LATEST CANONICAL REASONING</small><p><strong>{handoff.lastReasonedAt?new Date(handoff.lastReasonedAt).toLocaleDateString("en-GB",{timeZone:"Asia/Kuala_Lumpur"}):"Unavailable"}</strong></p><small>Not implied by later intake</small></div>
       </div>:<p role="status">Publication handoff status unavailable. Do not infer that the Newsroom is current.</p>}
       <p style={{marginTop:12,fontSize:"0.85rem"}}>Work-mode MacroPulse and manual investigation notes remain in the Notion research library below. Only approved, source-qualified outputs with publication readback become public Newsroom dispatches. No research or regime state is changed by this panel.</p>
      </section>
      <MarketResearchGapQueue />
      <ResearchLibraryExplorer intake={intake} />
    </main>
  );
}
