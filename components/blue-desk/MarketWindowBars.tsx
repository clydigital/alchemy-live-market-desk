import type {CSSProperties} from "react";
import s from "./MarketWindowBars.module.css";

/**
 * Observed cumulative 1D/3D/5D changes, not an invented price series.
 * Each bar is scaled against the largest available absolute change in this
 * instrument only. No cross-instrument magnitude is implied by bar length.
 */
export default function MarketWindowBars({
  change,change3d,change5d,unit,
}:{
  change:number|null;change3d:number|null;change5d:number|null;
  unit:"%"|"bp"|"pp";
}){
  const windows=[
    {name:"1D",value:change},
    {name:"3D",value:change3d},
    {name:"5D",value:change5d},
  ] as const;
  const available=windows
    .map(item=>item.value)
    .filter((value):value is number=>value!==null&&Number.isFinite(value));
  const max=Math.max(0,...available.map(Math.abs));
  const format=(value:number)=>`${value>0?"+":""}${value.toFixed(unit==="bp"?1:2)}${unit}`;
  return <div className={s.windows} role="group"
    aria-label="Source-dated one, three and five trading-session changes. Bars are comparative, not a price-history chart."
    data-market-window-visual="source-dated-relative-bars">
    {windows.map(({name,value})=>{
      const valid=value!==null&&Number.isFinite(value);
      const direction=!valid?"unknown":value!>0?"up":value!<0?"down":"flat";
      const magnitude=valid&&max>0?Math.min(49.5,Math.max(1.5,Math.abs(value!)/max*49.5)):0;
      const bar:CSSProperties={
        width:`${magnitude}%`,
        left:valid&&value!<0?`calc(50% - ${magnitude}%)`:"50%",
      };
      return <div className={s.row} key={name} data-direction={direction}>
        <span className={s.windowName}>{name}</span>
        <span className={s.rail} aria-hidden="true">
          {valid&&value!==0?<span className={s.bar} style={bar}/>:null}
        </span>
        <span className={s.value}>{valid?format(value!):"—"}</span>
      </div>;
    })}
  </div>;
}
