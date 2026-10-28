import Link from "next/link";
import { getMarketMonitor } from "@/lib/market-monitor-public";

export default async function ResearchTriggerIntake() {
  const monitor = await getMarketMonitor().catch(() => null);
  const triggers = (monitor?.researchTriggers || []).slice(0, 6);
  return (
    <section style={{marginBottom:32,padding:22,border:"1px solid #365348",borderRadius:16,background:"#142b2d"}} aria-label="Market research trigger intake">
      <p style={{color:"#9cdd86",fontSize:11,fontWeight:800,letterSpacing:2}}>EXISTING MONITOR / RESEARCH INTAKE</p>
      <h2 style={{margin:"8px 0 12px"}}>Observed research candidates</h2>
      <p style={{color:"#afc3c5",fontSize:13}}>These are prompts from Bluebelly's existing market monitor, not verified trade recommendations. Investigate the catalyst, original source, timestamp and invalidation before admitting evidence.</p>
      <p style={{color:"#9baebc",fontSize:11}}>{monitor ? "Monitor snapshot: "+monitor.updatedAt+" · "+monitor.rows.length+" instruments" : "Monitor unavailable; no synthetic fallback"}</p>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(245px,1fr))",gap:12,marginTop:18}}>
        {triggers.length ? triggers.map(t=><article key={t.id} style={{padding:16,background:"#1a3439",border:"1px solid #3c535a",borderRadius:10}}>
          <small style={{color:"#a4dc9c"}}>RESEARCH CANDIDATE · PRIORITY {t.priority}</small>
          <h3 style={{fontSize:16}}>{t.assets.join(" / ")}</h3>
          <p style={{fontSize:12,color:"#b2c6d1"}}>{t.reason}</p>
          <p style={{fontSize:12,color:"#b2c6d1"}}><strong>Research question:</strong> {t.researchQuestion}</p>
          <Link href="/owner/research" style={{fontSize:12,color:"#a4dc9c"}}>Open Research Library →</Link>
        </article>) : <p style={{fontSize:13,color:"#afc3c5"}}>No current research triggers available.</p>}
      </div>
    </section>
  );
}
