"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { marketTrend, type TrendWindow } from "@/lib/market-trend-series";
import type { PublicGovernmentRateTrend } from "@/lib/blue-desk-public-markets";
import styles from "./public-government-rate-trend.module.css";
import { EntityMark } from "./EntityIdentity";

type Props = { series: PublicGovernmentRateTrend[]; nowIso: string };

export default function PublicGovernmentRateTrendChart({ series, nowIso }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [window, setWindow] = useState<TrendWindow>("MAX");
  const router = useRouter();
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") router.refresh(); };
    const id = globalThis.setInterval(refresh, 5 * 60 * 1000);
    document.addEventListener("visibilitychange", refresh);
    return () => { globalThis.clearInterval(id); document.removeEventListener("visibilitychange", refresh); };
  }, [router]);
  const selected = series.find(row=>row.id===selectedId) ?? series[0] ?? null;
  const trend = selected ? marketTrend({points:selected.points,frequency:"daily",type:"Rates"},window,new Date(nowIso)) : null;
  const points = trend?.points ?? [];
  const ready = Boolean(trend && !trend.missing);
  const width=810,height=280,left=65,right=20,top=18,bottom=43;
  const min=trend?.min ?? 0,max=trend?.max ?? 0;
  const pad=Math.max((max-min)*0.1,0.02);
  const yMin=min-pad,yMax=max+pad;
  const firstTime=points[0]?.time ?? 0,lastTime=points.at(-1)?.time ?? 0;
  const x=(time:number)=>left+(time-firstTime)/Math.max(1,lastTime-firstTime)*(width-left-right);
  const y=(value:number)=>top+(height-top-bottom)*(1-(value-yMin)/Math.max(0.00001,yMax-yMin));
  const path=(trend?.segments ?? []).filter(segment=>segment.length>=2)
    .map(segment=>segment.map((point,i)=>`${i?"L":"M"}${x(point.time).toFixed(1)} ${y(point.close).toFixed(1)}`).join(" "));
  const date=(time:number)=>new Date(time*1000).toLocaleDateString("en-GB",{timeZone:"UTC",day:"numeric",month:"short",year:"2-digit"});

  return <section aria-label="Government yield historical trend" className={styles.panel} data-testid="blue-public-government-trend">
    <div className={styles.head}>
      <div><span className={styles.kicker}>MARKET DATA · SOURCE HISTORY</span>
        <h2><EntityMark kind="country" code="US" size="sm" /> Government yield trend</h2>
        <p>Original US Treasury nominal-yield observations, or US Treasury series distributed by FRED. Other provider price histories are not available in this public chart.</p>
      </div>
      <div className={styles.controls}>
        <label><span>Yield series</span>
          <select value={selected?.id ?? ""} onChange={event=>setSelectedId(event.target.value)} aria-label="Select Treasury yield trend">
            {!selected ? <option value="">Not available</option>:null}
            {series.map(row=><option key={row.id} value={row.id}>{row.label}</option>)}
          </select>
        </label>
        <div className={styles.range} role="group" aria-label="Chart time range">
          {(["30D","90D","MAX"] as TrendWindow[]).map(item=><button type="button" key={item}
            aria-pressed={window===item} onClick={()=>setWindow(item)}>{item}</button>)}
        </div>
      </div>
    </div>
    {selected && trend ? <>
      <div className={styles.summary}>
        <strong>{points.length ? points.at(-1)!.close.toFixed(3)+"%" : "No reading"}</strong>
        <span>{trend.coverageStart ?? "—"} → {trend.coverageEnd ?? "—"} · {points.length} observed dates</span>
        <span>{trend.netChange===null ? "No period change" : (trend.netChange>0?"+":"")+trend.netChange.toFixed(1)+" bp"}</span>
      </div>
      {trend.stale ? <p role="status" className={styles.stale}>Historical, not live · last government-rate observation {trend.sourceDate ?? "unavailable"}.</p> : null}
      {ready ? <div className={styles.chartWrap}>
        <svg className={styles.plot} viewBox={`0 0 ${width} ${height}`} role="img"
          aria-label={`${selected.label} from ${date(firstTime)} to ${date(lastTime)}. ${points.length} verified recorded yields; end ${points.at(-1)!.close.toFixed(3)} percent.`}>
          {[0,1,2,3,4].map(i=>{
            const value=yMax-(yMax-yMin)*i/4;
            const at=y(value);
            return <g key={i}><line x1={left} x2={width-right} y1={at} y2={at} className={styles.gridLine}/>
              <text x={left-9} y={at+4} textAnchor="end">{value.toFixed(2)}%</text></g>;
          })}
          {path.map((line,i)=><path key={i} d={line} className={styles.line}/>)}
          {(trend.segments??[]).filter(s=>s.length===1).map((s,i)=><circle key={i}
            cx={x(s[0].time)} cy={y(s[0].close)} r="3.2" className={styles.dot}/>)}
          <circle cx={x(points.at(-1)!.time)} cy={y(points.at(-1)!.close)} r="4.2" className={styles.dot}/>
          {[firstTime,(firstTime+lastTime)/2,lastTime].map((time,i)=><text key={i}
            x={x(time)} y={height-14} textAnchor={i===0?"start":i===2?"end":"middle"}>{date(time)}</text>)}
        </svg>
      </div> : <p className={styles.empty} role="status">Fewer than two dated government-rate observations in {window}. Try MAX or another series.</p>}
      <footer className={styles.footer}><span>Daily close · percentage yield · exact dates, no interpolation across long gaps</span>
        <a target="_blank" rel="noreferrer" href={selected.sourceUrl}>{selected.sourceName} · source ↗</a></footer>
    </> : <p className={styles.empty} role="status">Historical government-rate data is unavailable. No chart has been manufactured from current prices.</p>}
  </section>;
}
