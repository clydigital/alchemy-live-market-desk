"use client";

import {useMemo,useState} from "react";
import type {PublicMarketObservation,PublicGovernmentRateTrend} from "@/lib/blue-desk-public-markets";

type SovereignRow={country:string;tenor:string;yieldPct:number|null;asOf:string|null;change5dBp:number|null;sourceUrl:string|null;status:string};
type Window="1D"|"3D"|"5D";
type Mode="single"|"spread";
const TENORS=["2Y","5Y","10Y","20Y","30Y"] as const;
const FRED_IDS:Record<string,string>={"2Y":"DGS2","5Y":"DGS5","10Y":"DGS10","20Y":"DGS20","30Y":"DGS30"};
const change=(value:number|null)=>value===null?"—":`${value>0?"+":""}${value.toFixed(1)} bp`;
const date=(timestamp:number)=>new Date(timestamp*1000).toISOString().slice(0,10);

function sessionMove(points:PublicGovernmentRateTrend["points"],window:Window){
  const n=window==="1D"?1:window==="3D"?3:5;
  const ordered=[...points].sort((a,b)=>a.time-b.time);
  if(ordered.length<=n)return null;
  return (ordered.at(-1)!.close-ordered.at(-(n+1))!.close)*100;
}
function pairedMove(a:PublicGovernmentRateTrend,b:PublicGovernmentRateTrend,window:Window){
  const n=window==="1D"?1:window==="3D"?3:5;
  const map=new Map(b.points.map(p=>[date(p.time),p.close]));
  const matched=a.points.filter(p=>map.has(date(p.time))).sort((x,y)=>x.time-y.time);
  if(matched.length<=n)return null;
  const end=matched.at(-1)!,start=matched.at(-(n+1))!;
  return {asOf:date(end.time),spread:(end.close-map.get(date(end.time))!)*100,
    delta:((end.close-map.get(date(end.time))!)-(start.close-map.get(date(start.time))!))*100};
}
export default function RatesPolicyMonitor({observations,trends,sovereigns}:{observations:PublicMarketObservation[];trends:PublicGovernmentRateTrend[];sovereigns:SovereignRow[]}){
  const [tab,setTab]=useState<"yields"|"fedwatch">("yields");
  const [mode,setMode]=useState<Mode>("single");
  const [window,setWindow]=useState<Window>("1D");
  const [tenor,setTenor]=useState("2Y");
  const [other,setOther]=useState("10Y");
  const canonical=useMemo(()=>TENORS.map(t=>{
    const trend=trends.find(r=>r.symbol===FRED_IDS[t])??trends.find(r=>r.id===`us${t.toLowerCase()}`);
    const observation=observations.find(r=>r.symbol===FRED_IDS[t] || r.id===`us${t.toLowerCase()}`);
    return {tenor:t,trend,observation};
  }),[trends,observations]);
  const latestSourceDate=canonical.map(r=>r.trend?.asOf).filter((d):d is string=>!!d).sort().at(-1)??null;
  const isCurrent=(d:string|null|undefined)=>!!d&&!!latestSourceDate&&d===latestSourceDate;
  const first=canonical.find(r=>r.tenor===tenor);
  const second=canonical.find(r=>r.tenor===other);
  const pair=first?.trend&&second?.trend?pairedMove(first.trend,second.trend,window):null;
  const latestFirst=first?.trend?.points.at(-1);
  const latestSecond=second?.trend?.points.at(-1);
  const dateMatch=!!latestFirst&&!!latestSecond&&date(latestFirst.time)===date(latestSecond.time)&&isCurrent(date(latestFirst.time));
  const spread=mode==="spread"&&tenor!==other&&dateMatch&&pair?.asOf===latestSourceDate?pair:null;
  return <section aria-label="Rates and policy monitor" data-rates-policy-monitor="source-dated" style={{border:"1px solid #455b61",borderRadius:12,padding:18,margin:"16px 0",background:"rgba(12,26,31,.65)"}}>
    <header style={{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap",alignItems:"center"}}>
      <div><small>RATES / POLICY</small><h2 style={{margin:"4px 0"}}>Yield monitor & FedWatch</h2><p style={{margin:0}}>Source-dated yields; changes in basis points, not percentage returns.</p></div>
      <div role="group" aria-label="Rates monitor tabs" style={{display:"flex",gap:6}}>
        <button type="button" aria-pressed={tab==="yields"} onClick={()=>setTab("yields")}>Yield monitor</button>
        <button type="button" aria-pressed={tab==="fedwatch"} onClick={()=>setTab("fedwatch")}>FedWatch</button>
      </div>
    </header>
    {tab==="yields"?<>
      <div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"end",margin:"16px 0"}}>
        <label>View <select aria-label="Yield view" value={mode} onChange={e=>setMode(e.target.value as Mode)}><option value="single">Individual yields</option><option value="spread">Yield spread</option></select></label>
        <label>Primary <select aria-label="Primary tenor" value={tenor} onChange={e=>setTenor(e.target.value)}>{TENORS.map(t=><option key={t}>{t}</option>)}</select></label>
        {mode==="spread"?<label>Against <select aria-label="Comparison tenor" value={other} onChange={e=>setOther(e.target.value)}>{TENORS.map(t=><option key={t}>{t}</option>)}</select></label>:null}
        <label>Change <select aria-label="Yield change window" value={window} onChange={e=>setWindow(e.target.value as Window)}>{(["1D","3D","5D"] as const).map(w=><option key={w}>{w}</option>)}</select></label>
      </div>
      <p style={{fontSize:13}}>US Treasury nominal yields · Germany, UK and Japan have selected official-source observations below; Australia, New Zealand and Canada remain pending. Cross-country daily history alignment is not yet enabled.</p>
      {mode==="single"?<div style={{overflowX:"auto"}}><table style={{width:"100%",textAlign:"left",borderCollapse:"collapse"}}>
        <thead><tr><th>Tenor</th><th>Yield</th><th>1D</th><th>3D</th><th>5D</th><th>As of</th></tr></thead>
        <tbody>{canonical.map(({tenor:t,trend,observation})=><tr key={t} style={{borderTop:"1px solid #455b61"}}>
          <th>{t}</th><td>{isCurrent(trend?.asOf)&&trend?.points.at(-1)?.close!=null?`${trend.points.at(-1)!.close.toFixed(2)}%`:isCurrent(observation?.asOf)&&observation?.last!=null?`${observation.last.toFixed(2)}%`:"—"}</td>
          {(["1D","3D","5D"] as const).map(w=><td key={w}>{trend&&isCurrent(trend.asOf)?change(sessionMove(trend.points,w)):"—"}</td>)}
          <td>{trend?.asOf??observation?.asOf??"Unavailable"}{trend&&!isCurrent(trend.asOf)?" · not latest source session":""}{trend?.sourceUrl?<><br/><a href={trend.sourceUrl} target="_blank" rel="noreferrer">Source</a></>:observation?.sourceUrl?<><br/><a href={observation.sourceUrl} target="_blank" rel="noreferrer">Source</a></>:null}</td>
        </tr>)}</tbody>
      </table></div>:<div style={{padding:"12px 0"}}>
        <strong>US {tenor} − US {other}</strong>
        <p style={{fontSize:26,margin:"8px 0"}}>{tenor===other?"Choose two different tenors":spread?`${spread.spread.toFixed(1)} bp`:"—"}</p>
        <p>{window} spread change: {spread?change(spread.delta):"—"}</p>
        <small>{spread?`Matched source session ${spread.asOf}`:"Missing matched daily observations, mismatched latest dates, or identical tenors; no inferred spread."}</small>
      </div>}
      <div style={{marginTop:20}}>
        <h3>International sovereign yields · official sources</h3>
        <p style={{fontSize:13}}>Daily observations only. Missing or stale values are withheld. International 1D/3D and cross-country spread changes remain unavailable until aligned daily histories are approved.</p>
        <div style={{overflowX:"auto"}}><table style={{width:"100%",textAlign:"left",borderCollapse:"collapse"}}>
          <thead><tr><th>Country</th><th>Tenor</th><th>Yield</th><th>5D</th><th>As of</th><th>Source</th></tr></thead>
          <tbody>{sovereigns.map((r,i)=><tr key={r.country+r.tenor+i} style={{borderTop:"1px solid #455b61"}}>
            <th>{r.country}</th><td>{r.tenor}</td>
            <td>{r.yieldPct===null?"—":r.yieldPct.toFixed(2)+"%"}</td>
            <td>{change(r.change5dBp)}</td>
            <td>{r.asOf??"Unavailable"}{r.status==="STALE"?" · stale":""}</td>
            <td>{r.sourceUrl?<a href={r.sourceUrl} target="_blank" rel="noreferrer">Official source</a>:"—"}</td>
          </tr>)}</tbody>
        </table></div>
      </div>
      <small>Daily source sessions, not calendar days. The historical calculations use the existing public, allowlisted Treasury curve. No private provider histories or research signals are exposed.</small>
    </>:<div style={{padding:"16px 0"}}>
      <h3>Next FOMC meetings · probabilities not connected</h3>
      <p>CME FedWatch target-rate probabilities require meeting-specific Fed Funds futures inputs and historical snapshots. Treasury yields or the effective Fed Funds rate cannot substitute for them.</p>
      <p><a href="https://www.cmegroup.com/markets/interest-rates/cme-fedwatch-tool.html" target="_blank" rel="noreferrer">View CME FedWatch at source ↗</a></p>
      <small>Live probabilities and 1D/3D/5D probability changes remain unavailable until an approved, licensed feed and stored snapshots are verified.</small>
    </div>}
  </section>;
}
