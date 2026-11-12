import {MARKET_RESEARCH_GAPS} from "@/lib/bluebelly-market-research-gaps";
export default function MarketResearchGapQueue(){
 return <details data-owner-market-research-queue="source-and-verdict-gated"
   style={{margin:"18px auto",maxWidth:1120,padding:"14px 18px",border:"1px solid var(--bb-card-border)",borderRadius:10}}>
  <summary style={{cursor:"pointer",fontWeight:800}}>
   Editorial market-reaction queue · {MARKET_RESEARCH_GAPS.length} researched or pending developments
  </summary>
  <p style={{fontSize:12,lineHeight:1.65}}>
   These are owner-only research assignments, not published Newsroom stories. Each requires a pre-event expectation, verified uncertainty change, physical or financial supply-demand mechanism, asset-by-asset positive/negative exposure, dated tape and falsifier. A missing measurement is not a zero or a bearish outcome.
  </p>
  <div style={{overflowX:"auto"}}>
   <table style={{width:"100%",borderCollapse:"collapse",minWidth:680,fontSize:12,lineHeight:1.6}}>
    <thead><tr><th scope="col">Priority</th><th scope="col">Research question</th><th scope="col">Signal</th><th scope="col">Missing evidence and next test</th></tr></thead>
    <tbody>{MARKET_RESEARCH_GAPS.map(item=><tr key={item.id}>
     <td style={{padding:9,verticalAlign:"top",borderTop:"1px solid var(--bb-card-border)"}}>{item.priority}<p>{item.sourceStatus.replaceAll("_"," ")}</p></td>
     <td style={{padding:9,verticalAlign:"top",borderTop:"1px solid var(--bb-card-border)"}}><strong>{item.headline}</strong>{item.sourceUrl?<p><a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">Source or attributed report ↗</a></p>:<p>Original source check pending</p>}</td>
     <td style={{padding:9,verticalAlign:"top",borderTop:"1px solid var(--bb-card-border)"}}>{item.signal}</td>
     <td style={{padding:9,verticalAlign:"top",borderTop:"1px solid var(--bb-card-border)"}}>{item.unresolved}<p><strong>Next:</strong> {item.next}</p></td>
    </tr>)}</tbody>
   </table>
  </div>
 </details>;
}
