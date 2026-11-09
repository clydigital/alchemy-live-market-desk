import type {CSSProperties} from "react";
import {projectWindowChangeLanes,type WindowUnit} from "@/lib/bluebelly-market-bar-visuals";
import s from "./MarketWindowBars.module.css";

/** Source-dated cumulative change windows; not synthetic chart history. */
export default function MarketWindowBars({
  change,change3d,change5d,unit,
}:{
  change:number|null;change3d:number|null;change5d:number|null;
  unit:WindowUnit;
}){
  const lanes=projectWindowChangeLanes({change,change3d,change5d},unit);
  return <div className={s.windows} role="group"
    aria-label="Source-dated one, three and five trading-session changes. Relative bars are not historical price charts."
    data-market-window-visual="source-dated-relative-bars">
    {lanes.map(lane=>{
      const bar:CSSProperties={width:`${lane.widthPercent}%`,left:`${lane.leftPercent}%`};
      return <div className={s.row} key={lane.name} data-direction={lane.direction}>
        <span className={s.windowName}>{lane.name}</span>
        <span className={s.rail} aria-hidden="true">
          {lane.direction==="up"||lane.direction==="down"
            ?<span className={s.bar} style={bar}/>:null}
        </span>
        <span className={s.value}>{lane.display}</span>
      </div>;
    })}
  </div>;
}
