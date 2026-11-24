import Link from "next/link";
import {blueDeskPublicHref} from "@/lib/blue-desk-host";
import type {MarketInternalsDiagnostic} from "@/lib/bluebelly-market-internals-research";
export default function MarketInternalsEvidence({diagnostics,host}:{diagnostics:readonly MarketInternalsDiagnostic[];host:string|null}){
 return <section data-market-internals-research="source-dated" style={{border:"1px solid var(--bb-card-border)",background:"var(--bb-card-bg)",padding:16,margin:"12px 0"}}>
 <small>MARKET INTERNALS · SOURCE-DATED RESEARCH CHECK</small>
 <h2 style={{margin:"6px 0"}}>Participation &amp; sector leadership</h2>
 {diagnostics.map(d=><details key={d.headline} style={{borderTop:"1px solid var(--bb-line)",padding:"10px 0"}}>
 <summary style={{cursor:"pointer"}}><strong>{d.headline}</strong> <small>· {d.asOf??"unavailable"}</small></summary>
 <p>{d.interpretation}</p><p><strong>Next test:</strong> {d.nextTest}</p>
 <div>{d.sourceUrls.slice(0,4).map((u,i)=><a key={u} href={u} target="_blank" rel="noopener noreferrer" style={{marginRight:12}}>Source {i+1} ↗</a>)}</div>
 </details>)}
 <Link href={blueDeskPublicHref("/blue-desk/markets?mode=compare",host)}>Inspect full comparison matrix ↗</Link>
 <p style={{fontSize:12}}>Measured context, not a new canonical regime classification or automatic trade trigger.</p>
 </section>;
}
