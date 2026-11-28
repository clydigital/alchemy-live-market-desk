"use client";
import type {ResearchChart} from "@/lib/bluebelly-research-charts";

/** Private source-packet preview. The SVG is a server-produced image, never
 * injected as markup or taken from an external chart widget. */
export default function ResearchChartPreview({charts,initialOpen=false}:{charts?:readonly ResearchChart[];initialOpen?:boolean}){
 const rows=(charts??[]).slice(0,20);
 const downloadable=rows.filter(c=>c.status!=="UNAVAILABLE"&&c.svg);
 return <section aria-label="Source-dated research charts" data-private-research-charts="true">
  <h3>Research charts</h3>
  <p>{downloadable.length}/{rows.length} charts available from this source packet. Partial coverage is not a complete market reading. Review source rights before external publication.</p>
  {!rows.length?<p>Chart artifacts unavailable in this packet.</p>:null}
  {rows.map((c,i)=>{
   const image=c.status!=="UNAVAILABLE"&&c.svg?"data:image/svg+xml;charset=utf-8,"+encodeURIComponent(c.svg):null;
   return <details key={c.id+":"+c.dataHash} open={initialOpen&&i===0?true:undefined}>
    <summary>{c.title} · {c.status} · {c.marks.length}/{c.expected} · {c.asOf??"No eligible source date"}</summary>
    {image?<><img src={image} alt={c.title+" — "+c.window+"; "+c.unit+"; source date "+c.asOf} loading="lazy" style={{width:"100%",height:"auto"}}/>
      <p><a href={image} download={c.id+"-"+c.dataHash.slice(0,12)+".svg"}>Download SVG</a></p></>:<p>No graphic: fewer than two comparable source-backed observations.</p>}
    {c.kind==="RESEARCH_SNAPSHOT"?<p>Saved research only · {c.window}. READY means chart coverage, not source verification or live data.</p>:null}
    {c.missing.length?<p>Missing: {c.missing.join(", ")}</p>:null}
    {c.marks.length?<details><summary>Inspect source values ({c.unit})</summary>
     <table><thead><tr><th>Series</th><th>Value</th><th>Sources</th></tr></thead><tbody>
      {c.marks.map(m=><tr key={m.label}><td>{m.label}</td><td>{m.value.toFixed(2)} {c.unit}</td><td>{m.sources.map((s,i)=><span key={s.url+":"+i}>{i?" · ":""}<a href={s.url} target="_blank" rel="noreferrer">{s.name}</a></span>)}</td></tr>)}
     </tbody></table>
    </details>:null}
   </details>;
  })}
 </section>;
}
